import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type AgentTimelineState = 'idle' | 'entrySelected' | 'interrupted' | 'inactive' | 'active';
export type AgentTimelineEvent =
  | { type: 'NEW_ENTRY' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'INTERRUPT' }
  | { type: 'DESELECT' }
  | { type: 'RESUME' }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' };

export function agentTimelineReducer(state: AgentTimelineState, event: AgentTimelineEvent): AgentTimelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'NEW_ENTRY') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      if (event.type === 'INTERRUPT') return 'interrupted';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'interrupted':
      if (event.type === 'RESUME') return 'idle';
      return state;
    case 'inactive':
      if (event.type === 'STREAM_START') return 'active';
      return state;
    case 'active':
      if (event.type === 'STREAM_END') return 'inactive';
      return state;
    default:
      return state;
  }
}

type EntryType = 'thought' | 'tool-call' | 'tool-result' | 'response' | 'error';

interface TimelineEntry {
  id: string;
  type: EntryType;
  label: string;
  timestamp: string;
  duration?: number;
  detail?: string;
  status?: string;
}

const TYPE_TEXT_ICONS: Record<EntryType, string> = {
  'thought': '\u2022\u2022\u2022',
  'tool-call': '\u2699',
  'tool-result': '\u2611',
  'response': '\u25B6',
  'error': '\u2717',
};
const TYPE_LABELS: Record<EntryType, string> = {
  'thought': 'Thought', 'tool-call': 'Tool Call', 'tool-result': 'Tool Result', 'response': 'Response', 'error': 'Error',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export interface AgentTimelineProps { [key: string]: unknown; class?: string; }
export interface AgentTimelineResult { element: HTMLElement; dispose: () => void; }

export function AgentTimeline(props: AgentTimelineProps): AgentTimelineResult {
  const sig = surfaceCreateSignal<AgentTimelineState>('idle');
  const send = (event: AgentTimelineEvent) => { sig.set(agentTimelineReducer(sig.get(), event)); };

  const entries = (props.entries ?? []) as TimelineEntry[];
  const agentName = String(props.agentName ?? 'Agent');
  const status = String(props.status ?? 'idle');
  const maxEntries = Number(props.maxEntries ?? 100);
  const onInterrupt = props.onInterrupt as (() => void) | undefined;

  let selectedId: string | null = null;
  const expandedIds = new Set<string>();
  let typeFilter: EntryType | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'agent-timeline');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-agent', agentName);
  root.setAttribute('role', 'log');
  root.setAttribute('aria-label', `Agent timeline: ${agentName}`);
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-status', status);
  root.appendChild(headerEl);

  const agentBadge = document.createElement('span');
  agentBadge.setAttribute('data-part', 'agent-badge');
  agentBadge.textContent = agentName;
  headerEl.appendChild(agentBadge);

  const statusIndicator = document.createElement('span');
  statusIndicator.setAttribute('data-part', 'status-indicator');
  statusIndicator.setAttribute('data-status', status);
  statusIndicator.textContent = `${status === 'running' ? '\u25CF' : '\u25CB'} ${status}`;
  headerEl.appendChild(statusIndicator);

  if (status === 'running') {
    const interruptBtn = document.createElement('button');
    interruptBtn.setAttribute('type', 'button');
    interruptBtn.setAttribute('data-part', 'interrupt');
    interruptBtn.setAttribute('data-visible', 'true');
    interruptBtn.setAttribute('aria-label', 'Interrupt agent');
    interruptBtn.setAttribute('tabindex', '0');
    interruptBtn.textContent = 'Interrupt';
    interruptBtn.addEventListener('click', () => { send({ type: 'INTERRUPT' }); onInterrupt?.(); });
    headerEl.appendChild(interruptBtn);
  }

  // Filter bar
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter by entry type');
  root.appendChild(filterBarEl);

  const allTypes: EntryType[] = ['thought', 'tool-call', 'tool-result', 'response', 'error'];

  const allBtn = document.createElement('button');
  allBtn.setAttribute('type', 'button');
  allBtn.setAttribute('data-part', 'filter-button');
  allBtn.setAttribute('data-active', 'true');
  allBtn.setAttribute('aria-pressed', 'true');
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => { typeFilter = null; renderEntries(); updateFilterButtons(); });
  filterBarEl.appendChild(allBtn);

  const filterBtns: HTMLButtonElement[] = [allBtn];
  for (const t of allTypes) {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-part', 'filter-button');
    btn.setAttribute('data-filter-type', t);
    btn.setAttribute('data-active', 'false');
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = `${TYPE_TEXT_ICONS[t]} ${TYPE_LABELS[t]}`;
    btn.addEventListener('click', () => { typeFilter = typeFilter === t ? null : t; renderEntries(); updateFilterButtons(); });
    filterBarEl.appendChild(btn);
    filterBtns.push(btn);
  }

  const updateFilterButtons = () => {
    allBtn.setAttribute('data-active', typeFilter === null ? 'true' : 'false');
    allBtn.setAttribute('aria-pressed', String(typeFilter === null));
    for (let i = 1; i < filterBtns.length; i++) {
      const t = allTypes[i - 1];
      filterBtns[i].setAttribute('data-active', typeFilter === t ? 'true' : 'false');
      filterBtns[i].setAttribute('aria-pressed', String(typeFilter === t));
    }
  };

  // Interrupted banner
  const interruptBanner = document.createElement('div');
  interruptBanner.setAttribute('data-part', 'interrupt-banner');
  interruptBanner.setAttribute('role', 'alert');
  interruptBanner.textContent = 'Agent execution interrupted';
  interruptBanner.style.display = 'none';
  root.appendChild(interruptBanner);

  // Timeline
  const timelineEl = document.createElement('div');
  timelineEl.setAttribute('data-part', 'timeline');
  timelineEl.setAttribute('role', 'list');
  timelineEl.setAttribute('aria-label', 'Timeline entries');
  root.appendChild(timelineEl);

  const renderEntries = () => {
    timelineEl.innerHTML = '';
    let visible = entries.slice(-maxEntries);
    if (typeFilter) visible = visible.filter(e => e.type === typeFilter);

    for (const entry of visible) {
      const isExpanded = expandedIds.has(entry.id);
      const isSelected = selectedId === entry.id;
      const isRunning = entry.status === 'running';

      const entryEl = document.createElement('div');
      entryEl.setAttribute('role', 'listitem');
      entryEl.setAttribute('aria-label', `${TYPE_LABELS[entry.type]}: ${entry.label}`);
      entryEl.setAttribute('data-part', 'entry');
      entryEl.setAttribute('data-type', entry.type);
      entryEl.setAttribute('data-status', entry.status ?? 'complete');
      entryEl.setAttribute('data-selected', isSelected ? 'true' : 'false');
      entryEl.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
      entryEl.setAttribute('tabindex', '-1');

      const typeBadge = document.createElement('span');
      typeBadge.setAttribute('data-part', 'type-badge');
      typeBadge.setAttribute('data-type', entry.type);
      typeBadge.setAttribute('aria-hidden', 'true');
      typeBadge.textContent = TYPE_TEXT_ICONS[entry.type];
      entryEl.appendChild(typeBadge);

      const bodyDiv = document.createElement('div');
      bodyDiv.setAttribute('data-part', 'entry-body');
      const labelSpan = document.createElement('span');
      labelSpan.setAttribute('data-part', 'entry-label');
      labelSpan.textContent = entry.label;
      bodyDiv.appendChild(labelSpan);

      if (isRunning) {
        const runInd = document.createElement('span');
        runInd.setAttribute('data-part', 'running-indicator');
        runInd.setAttribute('data-visible', 'true');
        runInd.setAttribute('role', 'status');
        runInd.setAttribute('aria-label', 'Running');
        runInd.textContent = '\u25CB';
        bodyDiv.appendChild(runInd);
      }

      if (entry.duration != null && entry.status !== 'running') {
        const durSpan = document.createElement('span');
        durSpan.setAttribute('data-part', 'duration');
        durSpan.setAttribute('data-visible', 'true');
        durSpan.textContent = formatDuration(entry.duration);
        bodyDiv.appendChild(durSpan);
      }

      const tsSpan = document.createElement('span');
      tsSpan.setAttribute('data-part', 'timestamp');
      tsSpan.textContent = entry.timestamp;
      bodyDiv.appendChild(tsSpan);
      entryEl.appendChild(bodyDiv);

      if (isExpanded && entry.detail) {
        const contentDiv = document.createElement('div');
        contentDiv.setAttribute('data-part', 'content');
        contentDiv.setAttribute('data-visible', 'true');
        contentDiv.textContent = String(entry.detail);
        entryEl.appendChild(contentDiv);
      }

      entryEl.addEventListener('click', () => {
        selectedId = entry.id;
        if (expandedIds.has(entry.id)) expandedIds.delete(entry.id);
        else expandedIds.add(entry.id);
        send({ type: 'SELECT_ENTRY' });
        renderEntries();
      });

      timelineEl.appendChild(entryEl);
    }
  };

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); selectedId = null; send({ type: 'DESELECT' }); renderEntries(); }
    if (e.key === 'i') {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault(); send({ type: 'INTERRUPT' }); onInterrupt?.();
      }
    }
  });

  renderEntries();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    interruptBanner.style.display = s === 'interrupted' ? '' : 'none';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default AgentTimeline;
