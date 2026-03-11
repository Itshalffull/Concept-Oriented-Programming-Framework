/**
 * Generates NativeScript concept widget implementations from stub files.
 * Run: node scripts/gen-ns-concept-widgets.cjs
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'surface', 'widgets', 'nativescript', 'components', 'widgets', 'concepts');

// Each widget: preserves existing state machine, adds typed Props, real NativeScript UI
const widgets = {};

// ── formal-verification/TraceTimelineViewer ──
widgets['formal-verification/TraceTimelineViewer.ts'] = () => `import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type TraceTimelineViewerState = 'idle' | 'playing' | 'cellSelected';
export type TraceTimelineViewerEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'SELECT_CELL' }
  | { type: 'ZOOM' }
  | { type: 'PAUSE' }
  | { type: 'STEP_END' }
  | { type: 'DESELECT' };

export function traceTimelineViewerReducer(state: TraceTimelineViewerState, event: TraceTimelineViewerEvent): TraceTimelineViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FORWARD') return 'idle';
      if (event.type === 'STEP_BACKWARD') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      if (event.type === 'ZOOM') return 'idle';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'idle';
      if (event.type === 'STEP_END') return 'idle';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

export interface TraceStep {
  index: number;
  label: string;
  state: Record<string, string>;
  isError?: boolean;
  timestamp?: string;
}

export interface TraceTimelineViewerProps {
  steps: TraceStep[];
  variables?: string[];
  currentStep?: number;
  playbackSpeed?: number;
  showChangesOnly?: boolean;
  zoom?: number;
  onStepChange?: (stepIndex: number) => void;
}

export function createTraceTimelineViewer(props: TraceTimelineViewerProps): { view: View; dispose: () => void } {
  let widgetState: TraceTimelineViewerState = 'idle';
  let activeStep = props.currentStep ?? 0;
  let selectedCell: { step: number; variable: string } | null = null;
  let playbackTimer: ReturnType<typeof setInterval> | null = null;
  const disposers: (() => void)[] = [];

  const variables: string[] = props.variables ?? (() => {
    const keys = new Set<string>();
    for (const step of props.steps) for (const k of Object.keys(step.state)) keys.add(k);
    return Array.from(keys);
  })();

  function send(event: TraceTimelineViewerEvent) {
    widgetState = traceTimelineViewerReducer(widgetState, event);
    render();
  }

  function goToStep(idx: number) {
    activeStep = Math.max(0, Math.min(idx, props.steps.length - 1));
    props.onStepChange?.(activeStep);
  }

  function didChange(stepIdx: number, variable: string): boolean {
    if (stepIdx === 0) return false;
    return props.steps[stepIdx - 1]?.state[variable] !== props.steps[stepIdx]?.state[variable];
  }

  const root = new StackLayout();
  root.className = 'clef-trace-timeline-viewer';
  root.automationText = 'Trace timeline';

  function render() {
    root.removeChildren();

    // Time axis
    const timeRow = new ScrollView();
    timeRow.orientation = 'horizontal';
    const timeBar = new StackLayout();
    timeBar.orientation = 'horizontal';
    timeBar.padding = '4';
    const corner = new Label();
    corner.text = '';
    corner.width = 80;
    timeBar.addChild(corner);
    for (const step of props.steps) {
      const lbl = new Label();
      lbl.text = String(step.index);
      lbl.width = 60;
      lbl.textAlignment = 'center';
      lbl.fontSize = 11;
      if (step.isError) lbl.color = new Color('#ef4444');
      if (step.index === activeStep) lbl.fontWeight = 'bold';
      timeBar.addChild(lbl);
    }
    timeRow.content = timeBar;
    root.addChild(timeRow);

    // Variable lanes
    const scroll = new ScrollView();
    const lanes = new StackLayout();
    variables.forEach((variable) => {
      const lane = new ScrollView();
      lane.orientation = 'horizontal';
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = '2 0';

      const varLabel = new Label();
      varLabel.text = variable;
      varLabel.width = 80;
      varLabel.fontSize = 12;
      varLabel.fontWeight = 'bold';
      row.addChild(varLabel);

      for (const step of props.steps) {
        const value = step.state[variable] ?? '';
        const changed = didChange(step.index, variable);
        if (props.showChangesOnly && !changed && step.index !== 0) {
          const empty = new Label();
          empty.text = '';
          empty.width = 60;
          row.addChild(empty);
          continue;
        }
        const cell = new Label();
        cell.text = value;
        cell.width = 60;
        cell.textAlignment = 'center';
        cell.fontSize = 11;
        if (changed) cell.fontWeight = 'bold';
        if (step.isError) cell.backgroundColor = new Color('#fee2e2');
        if (step.index === activeStep) cell.backgroundColor = new Color('#dbeafe');
        if (selectedCell?.step === step.index && selectedCell?.variable === variable) {
          cell.borderWidth = 2;
          cell.borderColor = new Color('#6366f1');
        }
        const cellHandler = () => {
          selectedCell = { step: step.index, variable };
          goToStep(step.index);
          send({ type: 'SELECT_CELL' });
        };
        cell.on('tap', cellHandler);
        disposers.push(() => cell.off('tap', cellHandler));
        row.addChild(cell);
      }
      lane.content = row;
      lanes.addChild(lane);
    });
    scroll.content = lanes;
    root.addChild(scroll);

    // Controls
    const controls = new StackLayout();
    controls.orientation = 'horizontal';
    controls.horizontalAlignment = 'center';
    controls.padding = '8';

    const backBtn = new Button();
    backBtn.text = '\\u00AB';
    backBtn.isEnabled = activeStep > 0;
    const bh = () => { send({ type: 'STEP_BACKWARD' }); goToStep(activeStep - 1); };
    backBtn.on('tap', bh);
    disposers.push(() => backBtn.off('tap', bh));
    controls.addChild(backBtn);

    const ppBtn = new Button();
    ppBtn.text = widgetState === 'playing' ? '\\u23F8' : '\\u25B6';
    const pph = () => {
      if (widgetState === 'playing') send({ type: 'PAUSE' });
      else send({ type: 'PLAY' });
    };
    ppBtn.on('tap', pph);
    disposers.push(() => ppBtn.off('tap', pph));
    controls.addChild(ppBtn);

    const fwdBtn = new Button();
    fwdBtn.text = '\\u00BB';
    fwdBtn.isEnabled = activeStep < props.steps.length - 1;
    const fh = () => { send({ type: 'STEP_FORWARD' }); goToStep(activeStep + 1); };
    fwdBtn.on('tap', fh);
    disposers.push(() => fwdBtn.off('tap', fh));
    controls.addChild(fwdBtn);

    const stepLabel = new Label();
    stepLabel.text = props.steps.length > 0 ? \` \${activeStep + 1} / \${props.steps.length}\` : ' 0 / 0';
    stepLabel.fontSize = 13;
    stepLabel.marginLeft = 8;
    controls.addChild(stepLabel);

    root.addChild(controls);

    // Playback timer
    if (widgetState === 'playing' && !playbackTimer) {
      const ms = Math.max(100, (1 / (props.playbackSpeed ?? 1)) * 1000);
      playbackTimer = setInterval(() => {
        if (activeStep >= props.steps.length - 1) { send({ type: 'STEP_END' }); return; }
        goToStep(activeStep + 1);
        render();
      }, ms);
      disposers.push(() => { if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null; } });
    } else if (widgetState !== 'playing' && playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }

    // Detail panel
    if (widgetState === 'cellSelected' && props.steps[activeStep]) {
      const detail = new StackLayout();
      detail.padding = '8 12';
      detail.borderTopWidth = 1;
      detail.borderTopColor = new Color('#e5e7eb');
      const step = props.steps[activeStep];
      const title = new Label();
      title.text = \`Step \${step.index}: \${step.label}\${step.isError ? ' (error)' : ''}\`;
      title.fontWeight = 'bold';
      title.fontSize = 14;
      detail.addChild(title);
      if (step.timestamp) {
        const ts = new Label();
        ts.text = step.timestamp;
        ts.fontSize = 12;
        ts.color = new Color('#6b7280');
        detail.addChild(ts);
      }
      for (const [k, v] of Object.entries(step.state)) {
        const entry = new Label();
        const ch = didChange(activeStep, k);
        entry.text = \`\${k}: \${v}\`;
        entry.fontSize = 13;
        if (ch) entry.fontWeight = 'bold';
        detail.addChild(entry);
      }
      root.addChild(detail);
    }
  }

  render();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); if (playbackTimer) clearInterval(playbackTimer); },
  };
}

export default createTraceTimelineViewer;
`;

// ── formal-verification/VerificationStatusBadge ──
widgets['formal-verification/VerificationStatusBadge.ts'] = () => `import {
  StackLayout,
  Label,
  Color,
  View,
} from '@nativescript/core';

export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(state: VerificationStatusBadgeState, event: VerificationStatusBadgeEvent): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

export type VerificationStatus = 'proved' | 'refuted' | 'unknown' | 'timeout' | 'running';

const STATUS_ICONS: Record<VerificationStatus, string> = {
  proved: '\\u2713',
  refuted: '\\u2717',
  unknown: '?',
  timeout: '\\u23F0',
  running: '\\u25CB',
};

export interface VerificationStatusBadgeProps {
  status?: VerificationStatus;
  label?: string;
  duration?: number | undefined;
  solver?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function createVerificationStatusBadge(props: VerificationStatusBadgeProps): { view: View; dispose: () => void } {
  let state: VerificationStatusBadgeState = 'idle';
  const disposers: (() => void)[] = [];
  const status = props.status ?? 'unknown';

  function send(event: VerificationStatusBadgeEvent) {
    state = verificationStatusBadgeReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.orientation = 'horizontal';
  root.className = 'clef-verification-status-badge';
  root.automationText = \`Verification status: \${props.label ?? 'Unknown'}\`;
  root.padding = '4 8';

  const iconLabel = new Label();
  iconLabel.text = STATUS_ICONS[status];
  iconLabel.fontSize = props.size === 'lg' ? 18 : props.size === 'sm' ? 12 : 14;
  iconLabel.marginRight = 4;
  root.addChild(iconLabel);

  const textLabel = new Label();
  textLabel.text = props.label ?? 'Unknown';
  textLabel.fontSize = props.size === 'lg' ? 16 : props.size === 'sm' ? 11 : 13;
  root.addChild(textLabel);

  const tooltipLabel = new Label();
  const tooltipParts: string[] = [];
  if (props.solver) tooltipParts.push(props.solver);
  if (props.duration != null) tooltipParts.push(props.duration + 'ms');
  tooltipLabel.text = tooltipParts.join(' \\u2014 ');
  tooltipLabel.fontSize = 11;
  tooltipLabel.color = new Color('#6b7280');
  tooltipLabel.marginLeft = 8;
  tooltipLabel.visibility = 'collapse';
  root.addChild(tooltipLabel);

  // Animate on status change
  const animTimer = setTimeout(() => send({ type: 'ANIMATION_END' }), 200);
  disposers.push(() => clearTimeout(animTimer));

  function update() {
    tooltipLabel.visibility = state === 'hovered' && tooltipParts.length > 0 ? 'visible' : 'collapse';
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createVerificationStatusBadge;
`;

// Helper to create a simple widget generator
function simpleWidget(cfg) {
  return () => {
    const {
      name, cssName, automationText, stateType, eventType, reducer, initialState,
      propsInterface, propsType, imports, body
    } = cfg;
    return `import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  TextField,
  TextView,
  ScrollView,
  Progress,
  ActivityIndicator,
  Switch,
  FlexboxLayout,
  WrapLayout,
  Color,
  View,
} from '@nativescript/core';

${stateType}
${eventType}

${reducer}

${propsType}

${propsInterface}

export function create${name}(props: ${name}Props): { view: View; dispose: () => void } {
  ${body}
}

export default create${name};
`;
  };
}

// ── governance-decision/DeliberationThread ──
widgets['governance-decision/DeliberationThread.ts'] = () => `import {
  StackLayout,
  Label,
  Button,
  TextField,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export function deliberationThreadReducer(state: DeliberationThreadState, event: DeliberationThreadEvent): DeliberationThreadState {
  switch (state) {
    case 'viewing':
      if (event.type === 'REPLY_TO') return 'composing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'composing':
      if (event.type === 'SEND') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      return state;
    default:
      return state;
  }
}

export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
export type SortMode = 'time' | 'tag' | 'relevance';

const TAG_COLORS: Record<ArgumentTag, string> = {
  for: '#22c55e',
  against: '#ef4444',
  question: '#3b82f6',
  amendment: '#eab308',
};

export interface DeliberationEntry {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  timestamp: string;
  tag: ArgumentTag;
  parentId?: string | null;
  relevance?: number;
}

export interface DeliberationThreadProps {
  entries: DeliberationEntry[];
  status: string;
  summary?: string;
  showSentiment?: boolean;
  showTags?: boolean;
  maxNesting?: number;
  sortMode?: SortMode;
  onReply?: (parentId: string, content: string) => void;
  onSortChange?: (mode: SortMode) => void;
  onEntrySelect?: (entryId: string) => void;
}

export function createDeliberationThread(props: DeliberationThreadProps): { view: View; dispose: () => void } {
  let state: DeliberationThreadState = 'viewing';
  let replyTargetId: string | null = null;
  let selectedEntryId: string | null = null;
  let replyText = '';
  const disposers: (() => void)[] = [];

  function send(event: DeliberationThreadEvent) {
    state = deliberationThreadReducer(state, event);
    render();
  }

  const root = new StackLayout();
  root.className = 'clef-deliberation-thread';
  root.automationText = 'Deliberation thread';

  function buildTree(entries: DeliberationEntry[], parentId: string | null | undefined, depth: number): DeliberationEntry[] {
    return entries.filter(e => (e.parentId ?? null) === parentId);
  }

  function render() {
    root.removeChildren();

    // Header
    if (props.summary) {
      const summaryLabel = new Label();
      summaryLabel.text = props.summary;
      summaryLabel.fontWeight = 'bold';
      summaryLabel.fontSize = 14;
      summaryLabel.padding = '8 12';
      root.addChild(summaryLabel);
    }

    const statusLabel = new Label();
    statusLabel.text = \`Status: \${props.status}\`;
    statusLabel.fontSize = 12;
    statusLabel.padding = '4 12';
    statusLabel.color = new Color('#6b7280');
    root.addChild(statusLabel);

    // Sentiment bar
    if (props.showSentiment !== false) {
      const forCount = props.entries.filter(e => e.tag === 'for').length;
      const againstCount = props.entries.filter(e => e.tag === 'against').length;
      const total = forCount + againstCount || 1;
      const sentLabel = new Label();
      sentLabel.text = \`Sentiment: \${forCount} for / \${againstCount} against (\${Math.round(forCount / total * 100)}% for)\`;
      sentLabel.fontSize = 12;
      sentLabel.padding = '4 12';
      root.addChild(sentLabel);
    }

    // Entries
    const scroll = new ScrollView();
    const list = new StackLayout();

    function renderEntry(entry: DeliberationEntry, depth: number) {
      const row = new StackLayout();
      row.padding = \`6 12 6 \${12 + depth * 16}\`;
      if (selectedEntryId === entry.id) row.backgroundColor = new Color('#dbeafe');

      const header = new StackLayout();
      header.orientation = 'horizontal';
      const authorLabel = new Label();
      authorLabel.text = entry.author;
      authorLabel.fontWeight = 'bold';
      authorLabel.fontSize = 13;
      header.addChild(authorLabel);

      if (props.showTags !== false) {
        const tagLabel = new Label();
        tagLabel.text = \` [\${entry.tag}]\`;
        tagLabel.fontSize = 12;
        tagLabel.color = new Color(TAG_COLORS[entry.tag]);
        header.addChild(tagLabel);
      }

      const tsLabel = new Label();
      tsLabel.text = \`  \${entry.timestamp}\`;
      tsLabel.fontSize = 11;
      tsLabel.color = new Color('#9ca3af');
      header.addChild(tsLabel);
      row.addChild(header);

      const contentLabel = new Label();
      contentLabel.text = entry.content;
      contentLabel.fontSize = 13;
      contentLabel.textWrap = true;
      contentLabel.padding = '2 0';
      row.addChild(contentLabel);

      // Actions
      const actions = new StackLayout();
      actions.orientation = 'horizontal';
      const replyBtn = new Button();
      replyBtn.text = 'Reply';
      replyBtn.fontSize = 11;
      replyBtn.padding = '2 8';
      const rh = () => { replyTargetId = entry.id; send({ type: 'REPLY_TO' }); };
      replyBtn.on('tap', rh);
      disposers.push(() => replyBtn.off('tap', rh));
      actions.addChild(replyBtn);
      row.addChild(actions);

      const rowHandler = () => {
        selectedEntryId = entry.id;
        send({ type: 'SELECT_ENTRY' });
        props.onEntrySelect?.(entry.id);
      };
      row.on('tap', rowHandler);
      disposers.push(() => row.off('tap', rowHandler));
      row.automationText = \`\${entry.author}: \${entry.content}\`;
      list.addChild(row);

      // Nested replies
      const maxDepth = props.maxNesting ?? 3;
      if (depth < maxDepth) {
        const children = props.entries.filter(e => e.parentId === entry.id);
        for (const child of children) renderEntry(child, depth + 1);
      }
    }

    const topLevel = props.entries.filter(e => !e.parentId);
    for (const entry of topLevel) renderEntry(entry, 0);

    scroll.content = list;
    root.addChild(scroll);

    // Compose area
    if (state === 'composing' && replyTargetId) {
      const compose = new StackLayout();
      compose.padding = '8 12';
      compose.borderTopWidth = 1;
      compose.borderTopColor = new Color('#e5e7eb');

      const replyLabel = new Label();
      const target = props.entries.find(e => e.id === replyTargetId);
      replyLabel.text = \`Replying to \${target?.author ?? 'unknown'}\`;
      replyLabel.fontSize = 12;
      replyLabel.color = new Color('#6b7280');
      compose.addChild(replyLabel);

      const textField = new TextField();
      textField.hint = 'Type your reply...';
      textField.fontSize = 13;
      const tfHandler = () => { replyText = textField.text ?? ''; };
      textField.on('textChange', tfHandler);
      disposers.push(() => textField.off('textChange', tfHandler));
      compose.addChild(textField);

      const btnRow = new StackLayout();
      btnRow.orientation = 'horizontal';
      const sendBtn = new Button();
      sendBtn.text = 'Send';
      sendBtn.fontSize = 12;
      const sendHandler = () => {
        if (replyTargetId && replyText) props.onReply?.(replyTargetId, replyText);
        replyText = '';
        replyTargetId = null;
        send({ type: 'SEND' });
      };
      sendBtn.on('tap', sendHandler);
      disposers.push(() => sendBtn.off('tap', sendHandler));
      btnRow.addChild(sendBtn);

      const cancelBtn = new Button();
      cancelBtn.text = 'Cancel';
      cancelBtn.fontSize = 12;
      cancelBtn.marginLeft = 8;
      const ch = () => { replyTargetId = null; replyText = ''; send({ type: 'CANCEL' }); };
      cancelBtn.on('tap', ch);
      disposers.push(() => cancelBtn.off('tap', ch));
      btnRow.addChild(cancelBtn);

      compose.addChild(btnRow);
      root.addChild(compose);
    }
  }

  render();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createDeliberationThread;
`;

// For the remaining ~40 widgets, generate them with consistent pattern
// I'll define each as a compact generator

const remaining = [
  {
    path: 'governance-decision/ProposalCard.ts',
    name: 'ProposalCard',
    states: "'idle' | 'hovered' | 'focused' | 'navigating'",
    events: `| { type: 'HOVER' }
  | { type: 'FOCUS' }
  | { type: 'CLICK' }
  | { type: 'UNHOVER' }
  | { type: 'BLUR' }
  | { type: 'ENTER' }
  | { type: 'NAVIGATE_COMPLETE' }`,
    reducerBody: `case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      if (event.type === 'ENTER') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;`,
    initial: "'idle'",
    propsFields: `title: string;
  description: string;
  author: string;
  status: string;
  timestamp: string;
  variant?: 'full' | 'compact' | 'minimal';
  showVoteBar?: boolean;
  showQuorum?: boolean;
  truncateDescription?: number;
  onClick?: () => void;
  onNavigate?: () => void;`,
    bodyFn: (n) => `
  const root = new StackLayout();
  root.className = 'clef-proposal-card';
  root.padding = '12';
  root.borderWidth = 1;
  root.borderColor = new Color('#e5e7eb');
  root.borderRadius = 8;

  const statusLabel = new Label();
  statusLabel.text = props.status;
  statusLabel.fontSize = 11;
  statusLabel.padding = '2 6';
  statusLabel.borderRadius = 4;
  statusLabel.className = 'proposal-status';
  root.addChild(statusLabel);

  const titleLabel = new Label();
  titleLabel.text = props.title;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 15;
  titleLabel.padding = '4 0';
  titleLabel.textWrap = true;
  root.addChild(titleLabel);

  const descLabel = new Label();
  const maxChars = props.truncateDescription ?? 150;
  descLabel.text = props.description.length > maxChars
    ? props.description.slice(0, maxChars).trimEnd() + '\\u2026'
    : props.description;
  descLabel.fontSize = 13;
  descLabel.textWrap = true;
  descLabel.color = new Color('#6b7280');
  root.addChild(descLabel);

  const metaRow = new StackLayout();
  metaRow.orientation = 'horizontal';
  metaRow.padding = '4 0';
  const authorLabel = new Label();
  authorLabel.text = props.author;
  authorLabel.fontSize = 12;
  authorLabel.fontWeight = 'bold';
  metaRow.addChild(authorLabel);
  const tsLabel = new Label();
  tsLabel.text = '  ' + props.timestamp;
  tsLabel.fontSize = 11;
  tsLabel.color = new Color('#9ca3af');
  metaRow.addChild(tsLabel);
  root.addChild(metaRow);

  root.automationText = 'Proposal: ' + props.title;

  const tapHandler = () => {
    send({ type: 'CLICK' });
    props.onClick?.();
    props.onNavigate?.();
    setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 100);
  };
  root.on('tap', tapHandler);
  disposers.push(() => root.off('tap', tapHandler));`,
  },
  {
    path: 'governance-decision/VoteResultBar.ts',
    name: 'VoteResultBar',
    states: "'idle' | 'animating' | 'segmentHovered'",
    events: `| { type: 'HOVER_SEGMENT' }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'UNHOVER' }`,
    reducerBody: `case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;`,
    initial: "'idle'",
    extraTypes: `export interface VoteSegment {
  label: string;
  count: number;
  color?: string;
}

const DEFAULT_COLORS = ['#4caf50', '#f44336', '#ff9800', '#2196f3', '#9c27b0'];`,
    propsFields: `segments: VoteSegment[];
  total?: number;
  variant?: 'binary' | 'multi' | 'weighted';
  showLabels?: boolean;
  showQuorum?: boolean;
  quorumThreshold?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSegmentHover?: (index: number | null, segment: VoteSegment | null) => void;`,
    bodyFn: () => `
  const total = props.total ?? props.segments.reduce((sum, s) => sum + s.count, 0);

  const root = new StackLayout();
  root.className = 'clef-vote-result-bar';
  root.padding = '8 12';
  root.automationText = 'Vote result bar';

  // Stacked bar
  const bar = new StackLayout();
  bar.orientation = 'horizontal';
  bar.borderRadius = 4;
  bar.height = props.size === 'lg' ? 24 : props.size === 'sm' ? 8 : 16;

  props.segments.forEach((seg, i) => {
    const pct = total > 0 ? (seg.count / total) * 100 : 0;
    const segView = new Label();
    segView.text = '';
    segView.backgroundColor = new Color(seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
    segView.width = { value: pct, unit: '%' } as any;
    segView.height = props.size === 'lg' ? 24 : props.size === 'sm' ? 8 : 16;
    bar.addChild(segView);
  });
  root.addChild(bar);

  // Quorum marker
  if (props.showQuorum && props.quorumThreshold != null) {
    const quorumLabel = new Label();
    quorumLabel.text = \`Quorum: \${props.quorumThreshold}%\`;
    quorumLabel.fontSize = 11;
    quorumLabel.color = new Color('#6b7280');
    quorumLabel.padding = '2 0';
    root.addChild(quorumLabel);
  }

  // Labels
  if (props.showLabels !== false) {
    const labelRow = new StackLayout();
    labelRow.orientation = 'horizontal';
    labelRow.padding = '4 0';
    props.segments.forEach((seg, i) => {
      const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
      const lbl = new Label();
      lbl.text = \`\${seg.label}: \${seg.count} (\${pct}%)\`;
      lbl.fontSize = 12;
      lbl.color = new Color(seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
      lbl.marginRight = 12;
      labelRow.addChild(lbl);
    });
    root.addChild(labelRow);
  }

  // Animation
  if (props.animate) {
    send({ type: 'ANIMATE_IN' });
    const t = setTimeout(() => send({ type: 'ANIMATION_END' }), 300);
    disposers.push(() => clearTimeout(t));
  }`,
  },
];

// Generate standardized widget template
function genStandardWidget(cfg) {
  const reducerName = cfg.name.charAt(0).toLowerCase() + cfg.name.slice(1) + 'Reducer';
  const createName = 'create' + cfg.name;
  const extraTypes = cfg.extraTypes || '';

  let bodyContent = cfg.bodyFn ? cfg.bodyFn(cfg.name) : `
  const root = new StackLayout();
  root.className = 'clef-${cfg.name.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1)}';
  root.automationText = '${cfg.name.replace(/([A-Z])/g, ' $1').trim()}';
  root.padding = '8 12';

  const titleLabel = new Label();
  titleLabel.text = '${cfg.name}';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 14;
  root.addChild(titleLabel);`;

  return `import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  TextField,
  TextView,
  ScrollView,
  Progress,
  ActivityIndicator,
  Switch,
  WrapLayout,
  Color,
  View,
} from '@nativescript/core';

export type ${cfg.name}State = ${cfg.states};
export type ${cfg.name}Event =
  ${cfg.events};

export function ${reducerName}(state: ${cfg.name}State, event: ${cfg.name}Event): ${cfg.name}State {
  switch (state) {
    ${cfg.reducerBody}
    default:
      return state;
  }
}

${extraTypes}

export interface ${cfg.name}Props {
  ${cfg.propsFields}
}

export function ${createName}(props: ${cfg.name}Props): { view: View; dispose: () => void } {
  let state: ${cfg.name}State = ${cfg.initial};
  const disposers: (() => void)[] = [];

  function send(event: ${cfg.name}Event) {
    state = ${reducerName}(state, event);
    update();
  }

  ${bodyContent}

  function update() {
    // State-dependent UI updates handled inline
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default ${createName};
`;
}

// Write the two manual ones
for (const [rel, gen] of Object.entries(widgets)) {
  const fp = path.join(BASE, rel);
  fs.writeFileSync(fp, gen(), 'utf8');
  console.log('Wrote:', rel);
}

// Write standardized remaining
for (const cfg of remaining) {
  const fp = path.join(BASE, cfg.path);
  fs.writeFileSync(fp, genStandardWidget(cfg), 'utf8');
  console.log('Wrote:', cfg.path);
}

console.log('Phase 1 complete. Now generating remaining widgets...');

// Phase 2: All remaining widgets using compact generator
const phase2 = [
  // governance-execution
  { path: 'governance-execution/ExecutionPipeline.ts', name: 'ExecutionPipeline',
    states: "'idle' | 'stageSelected' | 'failed'",
    events: `| { type: 'ADVANCE' }\n  | { type: 'SELECT_STAGE' }\n  | { type: 'FAIL' }\n  | { type: 'DESELECT' }\n  | { type: 'RETRY' }\n  | { type: 'RESET' }`,
    reducerBody: `case 'idle': if (event.type === 'ADVANCE') return 'idle'; if (event.type === 'SELECT_STAGE') return 'stageSelected'; if (event.type === 'FAIL') return 'failed'; return state;
    case 'stageSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    case 'failed': if (event.type === 'RETRY') return 'idle'; if (event.type === 'RESET') return 'idle'; return state;`,
    initial: "'idle'",
    extraTypes: `export type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';
export interface PipelineStage { id: string; name: string; status: PipelineStageStatus; description?: string; isTimelock?: boolean; }
const STATUS_ICONS: Record<PipelineStageStatus, string> = { pending: '\\u25CB', active: '\\u25B6', complete: '\\u2713', failed: '\\u2717', skipped: '\\u2298' };`,
    propsFields: `stages: PipelineStage[];\n  currentStage: string;\n  status: string;\n  showTimer?: boolean;\n  showActions?: boolean;\n  compact?: boolean;\n  onStageSelect?: (stageId: string) => void;\n  onRetry?: () => void;`,
    bodyFn: () => `
  let selectedStageId: string | null = null;
  const root = new StackLayout();
  root.className = 'clef-execution-pipeline';
  root.automationText = 'Execution pipeline';
  root.padding = '8';

  function render() {
    root.removeChildren();
    const statusBar = new Label();
    statusBar.text = 'Pipeline: ' + props.status;
    statusBar.fontWeight = 'bold';
    statusBar.fontSize = 14;
    statusBar.padding = '4 12';
    root.addChild(statusBar);

    const scroll = new ScrollView();
    const list = new StackLayout();
    props.stages.forEach((stage, i) => {
      const row = new StackLayout();
      row.orientation = 'horizontal';
      row.padding = '6 12';
      if (stage.id === props.currentStage) row.backgroundColor = new Color('#dbeafe');
      if (selectedStageId === stage.id) row.borderWidth = 2; row.borderColor = new Color(selectedStageId === stage.id ? '#6366f1' : 'transparent');

      const icon = new Label();
      icon.text = STATUS_ICONS[stage.status];
      icon.width = 24;
      icon.fontSize = 14;
      row.addChild(icon);

      const nameLabel = new Label();
      nameLabel.text = stage.name;
      nameLabel.fontSize = 13;
      nameLabel.fontWeight = stage.id === props.currentStage ? 'bold' : 'normal';
      row.addChild(nameLabel);

      if (stage.description) {
        const desc = new Label();
        desc.text = ' - ' + stage.description;
        desc.fontSize = 11;
        desc.color = new Color('#6b7280');
        row.addChild(desc);
      }

      const handler = () => { selectedStageId = stage.id; send({ type: 'SELECT_STAGE' }); props.onStageSelect?.(stage.id); render(); };
      row.on('tap', handler);
      disposers.push(() => row.off('tap', handler));
      row.automationText = stage.name + ' - ' + stage.status;
      list.addChild(row);

      if (i < props.stages.length - 1) {
        const connector = new Label();
        connector.text = '  |';
        connector.fontSize = 10;
        connector.color = new Color('#d1d5db');
        connector.padding = '0 0 0 18';
        list.addChild(connector);
      }
    });
    scroll.content = list;
    root.addChild(scroll);

    if (props.showActions && props.status === 'failed') {
      const retryBtn = new Button();
      retryBtn.text = 'Retry';
      retryBtn.fontSize = 13;
      retryBtn.margin = '8 12';
      const rh = () => { send({ type: 'RETRY' }); props.onRetry?.(); };
      retryBtn.on('tap', rh);
      disposers.push(() => retryBtn.off('tap', rh));
      root.addChild(retryBtn);
    }
  }
  render();`,
  },
  { path: 'governance-execution/GuardStatusPanel.ts', name: 'GuardStatusPanel',
    states: "'idle' | 'guardSelected'",
    events: `| { type: 'SELECT_GUARD' }\n  | { type: 'GUARD_TRIP' }\n  | { type: 'DESELECT' }`,
    reducerBody: `case 'idle': if (event.type === 'SELECT_GUARD') return 'guardSelected'; if (event.type === 'GUARD_TRIP') return 'idle'; return state;
    case 'guardSelected': if (event.type === 'DESELECT') return 'idle'; return state;`,
    initial: "'idle'",
    extraTypes: `export type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';
export interface Guard { id?: string; name: string; description: string; status: GuardStatus; lastChecked?: string; }
const STATUS_ICONS: Record<GuardStatus, string> = { passing: '\\u2713', failing: '\\u2717', pending: '\\u23F3', bypassed: '\\u2298' };
const STATUS_COLORS: Record<GuardStatus, string> = { passing: '#22c55e', failing: '#ef4444', pending: '#9ca3af', bypassed: '#6b7280' };`,
    propsFields: `guards: Guard[];\n  executionStatus: string;\n  showConditions?: boolean;\n  onGuardSelect?: (guard: Guard) => void;`,
    bodyFn: () => `
  let selectedGuard: Guard | null = null;
  const root = new StackLayout();
  root.className = 'clef-guard-status-panel';
  root.automationText = 'Guard status panel';
  root.padding = '8';

  function render() {
    root.removeChildren();
    const header = new Label();
    header.text = 'Guard Status - ' + props.executionStatus;
    header.fontWeight = 'bold';
    header.fontSize = 14;
    header.padding = '4 12';
    root.addChild(header);

    const hasFailing = props.guards.some(g => g.status === 'failing');
    const overallLabel = new Label();
    overallLabel.text = hasFailing ? '\\u26A0 Some guards failing' : '\\u2713 All guards passing';
    overallLabel.fontSize = 12;
    overallLabel.padding = '4 12';
    overallLabel.color = new Color(hasFailing ? '#ef4444' : '#22c55e');
    root.addChild(overallLabel);

    const scroll = new ScrollView();
    const list = new StackLayout();
    for (const guard of props.guards) {
      const row = new StackLayout();
      row.padding = '8 12';
      if (selectedGuard?.name === guard.name) row.backgroundColor = new Color('#dbeafe');
      row.borderBottomWidth = 1;
      row.borderBottomColor = new Color('#f3f4f6');

      const nameRow = new StackLayout();
      nameRow.orientation = 'horizontal';
      const icon = new Label();
      icon.text = STATUS_ICONS[guard.status];
      icon.color = new Color(STATUS_COLORS[guard.status]);
      icon.fontSize = 14;
      icon.width = 24;
      nameRow.addChild(icon);
      const nameLabel = new Label();
      nameLabel.text = guard.name;
      nameLabel.fontSize = 13;
      nameLabel.fontWeight = 'bold';
      nameRow.addChild(nameLabel);
      row.addChild(nameRow);

      if (props.showConditions !== false) {
        const descLabel = new Label();
        descLabel.text = guard.description;
        descLabel.fontSize = 12;
        descLabel.color = new Color('#6b7280');
        descLabel.textWrap = true;
        row.addChild(descLabel);
      }

      if (guard.lastChecked) {
        const checkedLabel = new Label();
        checkedLabel.text = 'Last checked: ' + guard.lastChecked;
        checkedLabel.fontSize = 11;
        checkedLabel.color = new Color('#9ca3af');
        row.addChild(checkedLabel);
      }

      const handler = () => { selectedGuard = guard; send({ type: 'SELECT_GUARD' }); props.onGuardSelect?.(guard); render(); };
      row.on('tap', handler);
      disposers.push(() => row.off('tap', handler));
      row.automationText = guard.name + ' - ' + guard.status;
      list.addChild(row);
    }
    scroll.content = list;
    root.addChild(scroll);
  }
  render();`,
  },
  { path: 'governance-execution/TimelockCountdown.ts', name: 'TimelockCountdown',
    states: "'running' | 'warning' | 'critical' | 'expired' | 'executing' | 'paused'",
    events: `| { type: 'TICK' }\n  | { type: 'WARNING_THRESHOLD' }\n  | { type: 'EXPIRE' }\n  | { type: 'PAUSE' }\n  | { type: 'CRITICAL_THRESHOLD' }\n  | { type: 'EXECUTE' }\n  | { type: 'RESET' }\n  | { type: 'EXECUTE_COMPLETE' }\n  | { type: 'EXECUTE_ERROR' }\n  | { type: 'RESUME' }`,
    reducerBody: `case 'running': if (event.type === 'TICK') return 'running'; if (event.type === 'WARNING_THRESHOLD') return 'warning'; if (event.type === 'EXPIRE') return 'expired'; if (event.type === 'PAUSE') return 'paused'; return state;
    case 'warning': if (event.type === 'TICK') return 'warning'; if (event.type === 'CRITICAL_THRESHOLD') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'critical': if (event.type === 'TICK') return 'critical'; if (event.type === 'EXPIRE') return 'expired'; return state;
    case 'expired': if (event.type === 'EXECUTE') return 'executing'; if (event.type === 'RESET') return 'running'; return state;
    case 'executing': if (event.type === 'EXECUTE_COMPLETE') return 'expired'; if (event.type === 'EXECUTE_ERROR') return 'expired'; return state;
    case 'paused': if (event.type === 'RESUME') return 'running'; return state;`,
    initial: "'running'",
    propsFields: `phase: string;\n  deadline: string;\n  elapsed: number;\n  total: number;\n  showChallenge?: boolean;\n  warningThreshold?: number;\n  criticalThreshold?: number;\n  variant?: 'phase-based' | 'simple';\n  onExecute?: () => void;\n  onChallenge?: () => void;`,
    bodyFn: () => `
  const STATE_COLORS: Record<string, string> = { running: '#22c55e', warning: '#eab308', critical: '#ef4444', expired: '#ef4444', executing: '#3b82f6', paused: '#9ca3af' };
  const root = new StackLayout();
  root.className = 'clef-timelock-countdown';
  root.automationText = 'Timelock countdown';
  root.padding = '12';

  const phaseLabel = new Label();
  phaseLabel.text = props.phase;
  phaseLabel.fontWeight = 'bold';
  phaseLabel.fontSize = 14;
  root.addChild(phaseLabel);

  const countdownLabel = new Label();
  countdownLabel.fontSize = 24;
  countdownLabel.fontWeight = 'bold';
  countdownLabel.textAlignment = 'center';
  countdownLabel.padding = '8 0';
  root.addChild(countdownLabel);

  const progressBar = new Progress();
  progressBar.maxValue = Math.max(1, props.total);
  progressBar.value = props.elapsed;
  progressBar.margin = '4 0';
  root.addChild(progressBar);

  const stateLabel = new Label();
  stateLabel.fontSize = 12;
  stateLabel.textAlignment = 'center';
  root.addChild(stateLabel);

  const actionRow = new StackLayout();
  actionRow.orientation = 'horizontal';
  actionRow.horizontalAlignment = 'center';
  actionRow.padding = '8 0';

  const execBtn = new Button();
  execBtn.text = 'Execute';
  execBtn.fontSize = 13;
  const eh = () => { send({ type: 'EXECUTE' }); props.onExecute?.(); };
  execBtn.on('tap', eh);
  disposers.push(() => execBtn.off('tap', eh));
  actionRow.addChild(execBtn);

  if (props.showChallenge !== false) {
    const challengeBtn = new Button();
    challengeBtn.text = 'Challenge';
    challengeBtn.fontSize = 13;
    challengeBtn.marginLeft = 8;
    const ch = () => props.onChallenge?.();
    challengeBtn.on('tap', ch);
    disposers.push(() => challengeBtn.off('tap', ch));
    actionRow.addChild(challengeBtn);
  }
  root.addChild(actionRow);

  // Timer
  function computeRemaining(): string {
    const deadline = new Date(props.deadline).getTime();
    const remaining = Math.max(0, deadline - Date.now());
    const secs = Math.floor(remaining / 1000);
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    return m + 'm ' + s + 's';
  }

  const tickInterval = setInterval(() => {
    if (state === 'paused') return;
    const deadline = new Date(props.deadline).getTime();
    const remaining = Math.max(0, deadline - Date.now());
    const fraction = props.total > 0 ? props.elapsed / props.total : 0;
    const warnT = props.warningThreshold ?? 0.8;
    const critT = props.criticalThreshold ?? 0.95;

    if (remaining <= 0 && state !== 'expired' && state !== 'executing') send({ type: 'EXPIRE' });
    else if (fraction >= critT && state === 'warning') send({ type: 'CRITICAL_THRESHOLD' });
    else if (fraction >= warnT && state === 'running') send({ type: 'WARNING_THRESHOLD' });
    else send({ type: 'TICK' });
  }, 1000);
  disposers.push(() => clearInterval(tickInterval));

  function update() {
    countdownLabel.text = computeRemaining();
    countdownLabel.color = new Color(STATE_COLORS[state] ?? '#000000');
    stateLabel.text = state.charAt(0).toUpperCase() + state.slice(1);
    stateLabel.color = new Color(STATE_COLORS[state] ?? '#6b7280');
    progressBar.value = props.elapsed;
    execBtn.visibility = state === 'expired' ? 'visible' : 'collapse';
  }`,
  },
];

for (const cfg of phase2) {
  const fp = path.join(BASE, cfg.path);
  fs.writeFileSync(fp, genStandardWidget(cfg), 'utf8');
  console.log('Wrote:', cfg.path);
}

console.log('Done with phase 2. Generating remaining...');
SCRIPT_EOF
