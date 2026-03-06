import { StackLayout, Label, Button, ScrollView, FlexboxLayout, ActivityIndicator } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * AgentTimeline state machine
 * ------------------------------------------------------------------------- */

export type AgentTimelineState = 'idle' | 'entrySelected' | 'interrupted' | 'inactive' | 'active';
export type AgentTimelineEvent =
  | { type: 'NEW_ENTRY' }
  | { type: 'SELECT_ENTRY'; id?: string }
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

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type EntryType = 'thought' | 'tool-call' | 'tool-result' | 'response' | 'error';
export type EntryStatus = 'running' | 'complete' | 'error';

export interface TimelineEntry {
  id: string;
  type: EntryType;
  label: string;
  timestamp: string;
  duration?: number;
  detail?: string;
  status?: EntryStatus;
}

export interface AgentTimelineProps {
  entries: TimelineEntry[];
  agentName: string;
  status: string;
  showDelegations?: boolean;
  autoScroll?: boolean;
  maxEntries?: number;
  onInterrupt?: () => void;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const TYPE_ICONS: Record<EntryType, string> = {
  'thought': '\u2022\u2022\u2022',
  'tool-call': '\u2699',
  'tool-result': '\u2611',
  'response': '\u25B6',
  'error': '\u2717',
};

const TYPE_LABELS: Record<EntryType, string> = {
  'thought': 'Thought',
  'tool-call': 'Tool Call',
  'tool-result': 'Tool Result',
  'response': 'Response',
  'error': 'Error',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createAgentTimeline(props: AgentTimelineProps): { view: StackLayout; dispose: () => void } {
  const {
    entries,
    agentName,
    status,
    maxEntries = 100,
    onInterrupt,
  } = props;

  let widgetState: AgentTimelineState = 'idle';
  let selectedEntryId: string | null = null;
  let expandedIds = new Set<string>();
  let typeFilter: EntryType | null = null;
  const disposers: (() => void)[] = [];

  function send(event: AgentTimelineEvent) {
    widgetState = agentTimelineReducer(widgetState, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'agent-timeline';
  root.automationText = `Agent timeline: ${agentName}`;

  // Header
  const header = new FlexboxLayout();
  header.className = 'agent-timeline-header';
  header.flexDirection = 'row' as any;
  header.alignItems = 'center' as any;

  const agentBadge = new Label();
  agentBadge.className = 'agent-timeline-agent-badge';
  agentBadge.text = agentName;
  header.addChild(agentBadge);

  const statusLabel = new Label();
  statusLabel.className = 'agent-timeline-status';
  statusLabel.text = `${status === 'running' ? '\u25CF' : '\u25CB'} ${status}`;
  header.addChild(statusLabel);

  const interruptBtn = new Button();
  interruptBtn.className = 'agent-timeline-interrupt';
  interruptBtn.text = 'Interrupt';
  interruptBtn.automationText = 'Interrupt agent';
  interruptBtn.visibility = (status === 'running' ? 'visible' : 'collapse') as any;
  const interruptHandler = () => {
    send({ type: 'INTERRUPT' });
    onInterrupt?.();
  };
  interruptBtn.on('tap', interruptHandler);
  disposers.push(() => interruptBtn.off('tap', interruptHandler));
  header.addChild(interruptBtn);

  root.addChild(header);

  // Filter bar
  const filterBar = new FlexboxLayout();
  filterBar.className = 'agent-timeline-filter-bar';
  filterBar.flexDirection = 'row' as any;

  const allFilterBtn = new Button();
  allFilterBtn.className = 'agent-timeline-filter-button';
  allFilterBtn.text = 'All';
  const allFilterHandler = () => { typeFilter = null; rebuildEntries(); };
  allFilterBtn.on('tap', allFilterHandler);
  disposers.push(() => allFilterBtn.off('tap', allFilterHandler));
  filterBar.addChild(allFilterBtn);

  const allTypes: EntryType[] = ['thought', 'tool-call', 'tool-result', 'response', 'error'];
  for (const t of allTypes) {
    const btn = new Button();
    btn.className = 'agent-timeline-filter-button';
    btn.text = `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`;
    const handler = () => {
      typeFilter = typeFilter === t ? null : t;
      rebuildEntries();
    };
    btn.on('tap', handler);
    disposers.push(() => btn.off('tap', handler));
    filterBar.addChild(btn);
  }

  root.addChild(filterBar);

  // Interrupted banner
  const interruptBanner = new Label();
  interruptBanner.className = 'agent-timeline-interrupt-banner';
  interruptBanner.text = 'Agent execution interrupted';
  interruptBanner.visibility = 'collapse' as any;
  root.addChild(interruptBanner);

  // Timeline scroll area
  const scrollView = new ScrollView();
  scrollView.className = 'agent-timeline-scroll';

  const timelineContainer = new StackLayout();
  timelineContainer.className = 'agent-timeline-entries';
  scrollView.content = timelineContainer;
  root.addChild(scrollView);

  function rebuildEntries() {
    timelineContainer.removeChildren();
    const limited = entries.slice(-maxEntries);
    const visible = typeFilter ? limited.filter((e) => e.type === typeFilter) : limited;

    for (const entry of visible) {
      const entryView = new StackLayout();
      entryView.className = 'agent-timeline-entry';
      entryView.automationText = `${TYPE_LABELS[entry.type]}: ${entry.label}`;

      const entryRow = new FlexboxLayout();
      entryRow.flexDirection = 'row' as any;
      entryRow.alignItems = 'center' as any;

      // Type badge
      const badge = new Label();
      badge.className = 'agent-timeline-type-badge';
      badge.text = TYPE_ICONS[entry.type];
      entryRow.addChild(badge);

      // Label
      const entryLabel = new Label();
      entryLabel.className = 'agent-timeline-entry-label';
      entryLabel.text = entry.label;
      entryRow.addChild(entryLabel);

      // Running indicator
      if (entry.status === 'running') {
        const indicator = new ActivityIndicator();
        indicator.className = 'agent-timeline-running-indicator';
        indicator.busy = true;
        indicator.width = 16;
        indicator.height = 16;
        entryRow.addChild(indicator);
      }

      // Duration
      if (entry.duration != null && entry.status !== 'running') {
        const durationLabel = new Label();
        durationLabel.className = 'agent-timeline-duration';
        durationLabel.text = formatDuration(entry.duration);
        entryRow.addChild(durationLabel);
      }

      // Timestamp
      const tsLabel = new Label();
      tsLabel.className = 'agent-timeline-timestamp';
      tsLabel.text = entry.timestamp;
      entryRow.addChild(tsLabel);

      entryView.addChild(entryRow);

      // Expanded detail
      if (expandedIds.has(entry.id) && entry.detail) {
        const detailLabel = new Label();
        detailLabel.className = 'agent-timeline-detail';
        detailLabel.text = entry.detail;
        detailLabel.textWrap = true;
        entryView.addChild(detailLabel);
      }

      // Tap to select/expand
      const tapHandler = () => {
        selectedEntryId = entry.id;
        if (expandedIds.has(entry.id)) {
          expandedIds.delete(entry.id);
        } else {
          expandedIds.add(entry.id);
        }
        send({ type: 'SELECT_ENTRY', id: entry.id });
        rebuildEntries();
      };
      entryView.on('tap', tapHandler);

      timelineContainer.addChild(entryView);
    }
  }

  rebuildEntries();

  function update() {
    interruptBanner.visibility = (widgetState === 'interrupted' ? 'visible' : 'collapse') as any;
  }

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createAgentTimeline;
