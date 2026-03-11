/* ---------------------------------------------------------------------------
 * AgentTimeline — Vanilla implementation
 *
 * Chronological timeline of agent actions with expand/collapse, filtering,
 * keyboard navigation, running indicators, and interrupt button.
 * ------------------------------------------------------------------------- */

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

export type EntryType = 'thought' | 'tool-call' | 'tool-result' | 'response' | 'error';
export interface TimelineEntry {
  id: string;
  type: EntryType;
  label: string;
  timestamp: string;
  duration?: number;
  detail?: string;
  status?: 'running' | 'complete' | 'error';
}

const TYPE_ICONS: Record<string, string> = { thought: '\u2022\u2022\u2022', 'tool-call': '\u2699', 'tool-result': '\u2611', response: '\u25B6', error: '\u2717' };
const TYPE_LABELS: Record<string, string> = { thought: 'Thought', 'tool-call': 'Tool Call', 'tool-result': 'Tool Result', response: 'Response', error: 'Error' };

export interface AgentTimelineProps {
  [key: string]: unknown;
  className?: string;
  entries?: TimelineEntry[];
  agentName?: string;
  status?: string;
  autoScroll?: boolean;
  maxEntries?: number;
  onInterrupt?: () => void;
}
export interface AgentTimelineOptions { target: HTMLElement; props: AgentTimelineProps; }

let _agentTimelineUid = 0;

export class AgentTimeline {
  private el: HTMLElement;
  private props: AgentTimelineProps;
  private state: AgentTimelineState = 'idle';
  private disposers: Array<() => void> = [];
  private expandedIds = new Set<string>();
  private selectedEntryId: string | null = null;
  private focusIndex = -1;
  private typeFilter: EntryType | null = null;

  constructor(options: AgentTimelineOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'agent-timeline');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'log');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'agent-timeline-' + (++_agentTimelineUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = agentTimelineReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<AgentTimelineProps>): void { Object.assign(this.props, props); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private getVisible(): TimelineEntry[] {
    const entries = (this.props.entries ?? []) as TimelineEntry[];
    const max = (this.props.maxEntries as number) ?? 100;
    let visible = entries.slice(-max);
    if (this.typeFilter) visible = visible.filter(e => e.type === this.typeFilter);
    return visible;
  }

  private render(): void {
    const { agentName = 'Agent', status = 'idle', autoScroll = true } = this.props;
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-agent', agentName);
    if (this.props.className) this.el.className = this.props.className;
    const visible = this.getVisible();

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, visible.length - 1); this.updateFocus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.updateFocus(); }
      if (e.key === 'Enter') { e.preventDefault(); const entry = visible[this.focusIndex]; if (entry) this.toggleEntry(entry); }
      if (e.key === 'Escape') { e.preventDefault(); this.selectedEntryId = null; this.send('DESELECT'); this.rerender(); }
      if (e.key === 'i') { const t = e.target as HTMLElement; if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') { e.preventDefault(); this.send('INTERRUPT'); this.props.onInterrupt?.(); } }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.setAttribute('data-status', status);
    const badge = document.createElement('span');
    badge.setAttribute('data-part', 'agent-badge');
    badge.textContent = agentName;
    header.appendChild(badge);
    const statusEl = document.createElement('span');
    statusEl.setAttribute('data-part', 'status-indicator');
    statusEl.setAttribute('data-status', status);
    statusEl.textContent = `${status === 'running' ? '\u25CF' : '\u25CB'} ${status}`;
    header.appendChild(statusEl);
    if (status === 'running') {
      const interruptBtn = document.createElement('button');
      interruptBtn.setAttribute('data-part', 'interrupt');
      interruptBtn.setAttribute('type', 'button');
      interruptBtn.setAttribute('aria-label', 'Interrupt agent');
      interruptBtn.textContent = 'Interrupt';
      const onInterrupt = () => { this.send('INTERRUPT'); this.props.onInterrupt?.(); };
      interruptBtn.addEventListener('click', onInterrupt);
      this.disposers.push(() => interruptBtn.removeEventListener('click', onInterrupt));
      header.appendChild(interruptBtn);
    }
    this.el.appendChild(header);

    // Filter bar
    const filterBar = document.createElement('div');
    filterBar.setAttribute('data-part', 'filter-bar');
    filterBar.setAttribute('role', 'toolbar');
    const allBtn = document.createElement('button');
    allBtn.setAttribute('type', 'button');
    allBtn.setAttribute('data-part', 'filter-button');
    allBtn.setAttribute('data-active', this.typeFilter === null ? 'true' : 'false');
    allBtn.setAttribute('aria-pressed', this.typeFilter === null ? 'true' : 'false');
    allBtn.textContent = 'All';
    const onAll = () => { this.typeFilter = null; this.rerender(); };
    allBtn.addEventListener('click', onAll);
    this.disposers.push(() => allBtn.removeEventListener('click', onAll));
    filterBar.appendChild(allBtn);
    for (const t of ['thought', 'tool-call', 'tool-result', 'response', 'error'] as EntryType[]) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.setAttribute('data-part', 'filter-button');
      btn.setAttribute('data-filter-type', t);
      btn.setAttribute('data-active', this.typeFilter === t ? 'true' : 'false');
      btn.setAttribute('aria-pressed', this.typeFilter === t ? 'true' : 'false');
      btn.textContent = `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`;
      const onFilter = () => { this.typeFilter = this.typeFilter === t ? null : t; this.rerender(); };
      btn.addEventListener('click', onFilter);
      this.disposers.push(() => btn.removeEventListener('click', onFilter));
      filterBar.appendChild(btn);
    }
    this.el.appendChild(filterBar);

    // Interrupted banner
    if (this.state === 'interrupted') {
      const banner = document.createElement('div');
      banner.setAttribute('data-part', 'interrupt-banner');
      banner.setAttribute('role', 'alert');
      banner.textContent = 'Agent execution interrupted';
      this.el.appendChild(banner);
    }

    // Timeline
    const timeline = document.createElement('div');
    timeline.setAttribute('data-part', 'timeline');
    timeline.setAttribute('role', 'list');
    visible.forEach((entry, index) => {
      const isExpanded = this.expandedIds.has(entry.id);
      const isSelected = this.selectedEntryId === entry.id;
      const node = document.createElement('div');
      node.setAttribute('data-part', 'entry');
      node.setAttribute('role', 'listitem');
      node.setAttribute('data-type', entry.type);
      node.setAttribute('data-status', entry.status ?? 'complete');
      node.setAttribute('data-selected', isSelected ? 'true' : 'false');
      node.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
      node.setAttribute('tabindex', this.focusIndex === index ? '0' : '-1');
      node.setAttribute('aria-label', `${TYPE_LABELS[entry.type]}: ${entry.label}`);

      const typeBadge = document.createElement('span');
      typeBadge.setAttribute('data-part', 'type-badge');
      typeBadge.setAttribute('data-type', entry.type);
      typeBadge.textContent = TYPE_ICONS[entry.type] ?? '';
      node.appendChild(typeBadge);

      const body = document.createElement('div');
      body.setAttribute('data-part', 'entry-body');
      const labelEl = document.createElement('span');
      labelEl.setAttribute('data-part', 'entry-label');
      labelEl.textContent = entry.label;
      body.appendChild(labelEl);
      if (entry.status === 'running') {
        const ri = document.createElement('span');
        ri.setAttribute('data-part', 'running-indicator');
        ri.setAttribute('role', 'status');
        ri.textContent = '\u25CB';
        body.appendChild(ri);
      }
      if (entry.duration != null && entry.status !== 'running') {
        const dur = document.createElement('span');
        dur.setAttribute('data-part', 'duration');
        dur.textContent = entry.duration < 1000 ? `${entry.duration}ms` : `${(entry.duration / 1000).toFixed(1)}s`;
        body.appendChild(dur);
      }
      const ts = document.createElement('span');
      ts.setAttribute('data-part', 'timestamp');
      ts.textContent = entry.timestamp;
      body.appendChild(ts);
      node.appendChild(body);

      if (isExpanded && entry.detail) {
        const content = document.createElement('div');
        content.setAttribute('data-part', 'content');
        content.setAttribute('data-visible', 'true');
        content.textContent = entry.detail;
        node.appendChild(content);
      }

      const onClick = () => this.toggleEntry(entry);
      node.addEventListener('click', onClick);
      this.disposers.push(() => node.removeEventListener('click', onClick));
      timeline.appendChild(node);
    });
    this.el.appendChild(timeline);

    if (autoScroll) timeline.scrollTop = timeline.scrollHeight;
  }

  private toggleEntry(entry: TimelineEntry): void {
    this.selectedEntryId = entry.id;
    if (this.expandedIds.has(entry.id)) this.expandedIds.delete(entry.id); else this.expandedIds.add(entry.id);
    this.send('SELECT_ENTRY');
    this.rerender();
  }

  private updateFocus(): void {
    const nodes = this.el.querySelectorAll('[data-part="entry"]');
    nodes.forEach((n, i) => {
      (n as HTMLElement).setAttribute('tabindex', i === this.focusIndex ? '0' : '-1');
      if (i === this.focusIndex) (n as HTMLElement).focus();
    });
  }
}

export default AgentTimeline;
