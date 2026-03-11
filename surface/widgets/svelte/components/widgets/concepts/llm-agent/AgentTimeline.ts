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

export interface AgentTimelineProps { [key: string]: unknown; class?: string; }
export interface AgentTimelineResult { element: HTMLElement; dispose: () => void; }

export function AgentTimeline(props: AgentTimelineProps): AgentTimelineResult {
  const sig = surfaceCreateSignal<AgentTimelineState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(agentTimelineReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'agent-timeline');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'log');
  root.setAttribute('aria-label', 'Agent timeline');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      send('DESELECT');
    }
    if (e.key === 'i') {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        send('INTERRUPT');
      }
    }
  });

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const agentBadgeEl = document.createElement('span');
  agentBadgeEl.setAttribute('data-part', 'agent-badge');
  headerEl.appendChild(agentBadgeEl);

  const statusIndicatorEl = document.createElement('span');
  statusIndicatorEl.setAttribute('data-part', 'status-indicator');
  statusIndicatorEl.setAttribute('role', 'status');
  headerEl.appendChild(statusIndicatorEl);

  const interruptButtonEl = document.createElement('button');
  interruptButtonEl.setAttribute('type', 'button');
  interruptButtonEl.setAttribute('data-part', 'interrupt-button');
  interruptButtonEl.setAttribute('aria-label', 'Interrupt agent');
  interruptButtonEl.setAttribute('tabindex', '0');
  interruptButtonEl.textContent = 'Interrupt';
  interruptButtonEl.addEventListener('click', () => send('INTERRUPT'));
  headerEl.appendChild(interruptButtonEl);

  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Filter by entry type');
  root.appendChild(filterBarEl);

  const interruptBannerEl = document.createElement('div');
  interruptBannerEl.setAttribute('data-part', 'interrupt-banner');
  interruptBannerEl.setAttribute('role', 'alert');
  interruptBannerEl.textContent = 'Agent execution interrupted';
  interruptBannerEl.style.display = 'none';
  root.appendChild(interruptBannerEl);

  const timelineEl = document.createElement('div');
  timelineEl.setAttribute('data-part', 'timeline');
  timelineEl.setAttribute('role', 'list');
  timelineEl.setAttribute('aria-label', 'Timeline entries');
  root.appendChild(timelineEl);

  const entryEl = document.createElement('div');
  entryEl.setAttribute('data-part', 'entry');
  entryEl.setAttribute('role', 'listitem');
  entryEl.setAttribute('tabindex', '-1');
  entryEl.addEventListener('click', () => send('SELECT_ENTRY'));
  timelineEl.appendChild(entryEl);

  const typeBadgeEl = document.createElement('span');
  typeBadgeEl.setAttribute('data-part', 'type-badge');
  typeBadgeEl.setAttribute('aria-hidden', 'true');
  entryEl.appendChild(typeBadgeEl);

  const entryBodyEl = document.createElement('div');
  entryBodyEl.setAttribute('data-part', 'entry-body');
  entryEl.appendChild(entryBodyEl);

  const entryLabelEl = document.createElement('span');
  entryLabelEl.setAttribute('data-part', 'entry-label');
  entryBodyEl.appendChild(entryLabelEl);

  const timestampEl = document.createElement('span');
  timestampEl.setAttribute('data-part', 'timestamp');
  entryBodyEl.appendChild(timestampEl);

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  contentEl.style.display = 'none';
  entryEl.appendChild(contentEl);

  const delegationEl = document.createElement('div');
  delegationEl.setAttribute('data-part', 'delegation');
  entryEl.appendChild(delegationEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    interruptBannerEl.style.display = s === 'interrupted' ? '' : 'none';
    entryEl.setAttribute('data-selected', s === 'entrySelected' ? 'true' : 'false');
    contentEl.style.display = s === 'entrySelected' ? '' : 'none';
    contentEl.setAttribute('data-visible', s === 'entrySelected' ? 'true' : 'false');
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default AgentTimeline;
