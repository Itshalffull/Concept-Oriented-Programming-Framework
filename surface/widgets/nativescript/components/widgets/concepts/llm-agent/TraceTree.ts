import { StackLayout, Label, Button, ScrollView, FlexboxLayout } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * TraceTree state machine
 * States: idle (initial), spanSelected (with detail panel)
 * ------------------------------------------------------------------------- */

export type TraceTreeState = 'idle' | 'spanSelected';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN'; id: string }
  | { type: 'DESELECT' }
  | { type: 'EXPAND'; id: string }
  | { type: 'COLLAPSE'; id: string }
  | { type: 'FILTER'; spanType: string };

export function traceTreeReducer(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    case 'spanSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface TraceSpan {
  id: string;
  type: string;
  label: string;
  duration: number;
  tokens?: number;
  status: string;
  children?: TraceSpan[];
}

export interface TraceTreeProps {
  spans: TraceSpan[];
  rootLabel: string;
  totalDuration?: number;
  totalTokens?: number;
  selectedSpanId?: string;
  onSelectSpan?: (id: string | undefined) => void;
  expandedIds?: string[];
  visibleTypes?: string[];
  showMetrics?: boolean;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const SPAN_TYPE_LABELS: Record<string, string> = {
  llm: 'LLM', tool: 'Tool', chain: 'Chain', agent: 'Agent',
};

const SPAN_TYPE_ICONS: Record<string, string> = {
  llm: '\uD83E\uDDE0', tool: '\u2699', chain: '\uD83D\uDD17', agent: '\uD83E\uDD16',
};

const STATUS_ICONS: Record<string, string> = {
  success: '\u2713', running: '\u25CB', error: '\u2717', pending: '\u2022',
};

function findSpan(spans: TraceSpan[], id: string): TraceSpan | undefined {
  for (const span of spans) {
    if (span.id === id) return span;
    if (span.children?.length) {
      const found = findSpan(span.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function collectTypes(spans: TraceSpan[]): string[] {
  const types = new Set<string>();
  function walk(nodes: TraceSpan[]) {
    for (const s of nodes) {
      types.add(s.type);
      if (s.children?.length) walk(s.children);
    }
  }
  walk(spans);
  return Array.from(types);
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createTraceTree(props: TraceTreeProps): { view: StackLayout; dispose: () => void } {
  const {
    spans,
    rootLabel,
    totalDuration,
    totalTokens,
    selectedSpanId: initialSelectedId,
    onSelectSpan,
    expandedIds: controlledExpandedIds,
    visibleTypes: controlledVisibleTypes,
    showMetrics = true,
  } = props;

  let selectedId: string | undefined = initialSelectedId;
  let expandedSet = new Set<string>(controlledExpandedIds ?? []);
  let visibleSet = new Set<string>(controlledVisibleTypes ?? ['llm', 'tool', 'chain', 'agent']);
  const disposers: (() => void)[] = [];

  const root = new StackLayout();
  root.className = 'trace-tree';
  root.automationText = 'Execution trace';

  // Header
  const header = new FlexboxLayout();
  header.className = 'trace-tree-header';
  header.flexDirection = 'row' as any;
  header.alignItems = 'center' as any;

  const rootLabelView = new Label();
  rootLabelView.className = 'trace-tree-root-label';
  rootLabelView.text = rootLabel;
  header.addChild(rootLabelView);

  if (showMetrics && totalDuration != null) {
    const durationLabel = new Label();
    durationLabel.className = 'trace-tree-total-duration';
    durationLabel.text = `${totalDuration}ms`;
    header.addChild(durationLabel);
  }

  if (showMetrics && totalTokens != null) {
    const tokensLabel = new Label();
    tokensLabel.className = 'trace-tree-total-tokens';
    tokensLabel.text = `${totalTokens} tokens`;
    header.addChild(tokensLabel);
  }

  root.addChild(header);

  // Filter bar
  const filterBar = new FlexboxLayout();
  filterBar.className = 'trace-tree-filter-bar';
  filterBar.flexDirection = 'row' as any;

  const availableTypes = collectTypes(spans);
  for (const spanType of availableTypes) {
    const btn = new Button();
    btn.className = visibleSet.has(spanType) ? 'trace-tree-filter-active' : 'trace-tree-filter';
    btn.text = SPAN_TYPE_LABELS[spanType] ?? spanType;
    const handler = () => {
      if (visibleSet.has(spanType)) visibleSet.delete(spanType);
      else visibleSet.add(spanType);
      rebuildTree();
    };
    btn.on('tap', handler);
    disposers.push(() => btn.off('tap', handler));
    filterBar.addChild(btn);
  }
  root.addChild(filterBar);

  // Tree area
  const scrollView = new ScrollView();
  const treeContainer = new StackLayout();
  treeContainer.className = 'trace-tree-spans';
  scrollView.content = treeContainer;
  root.addChild(scrollView);

  // Detail panel
  const detailPanel = new StackLayout();
  detailPanel.className = 'trace-tree-detail-panel';
  detailPanel.visibility = 'collapse' as any;
  root.addChild(detailPanel);

  function renderSpan(span: TraceSpan, depth: number, container: StackLayout) {
    if (!visibleSet.has(span.type)) return;

    const hasChildren = !!(span.children?.length);
    const isExpanded = expandedSet.has(span.id);
    const isSelected = selectedId === span.id;

    const spanRow = new FlexboxLayout();
    spanRow.className = isSelected ? 'trace-tree-span-selected' : 'trace-tree-span';
    spanRow.flexDirection = 'row' as any;
    spanRow.alignItems = 'center' as any;
    spanRow.paddingLeft = depth * 16;
    spanRow.automationText = `${span.type}: ${span.label} (${span.duration}ms)`;

    if (hasChildren) {
      const expandLabel = new Label();
      expandLabel.className = 'trace-tree-expand';
      expandLabel.text = isExpanded ? '\u25BC' : '\u25B6';
      const expandHandler = () => {
        if (expandedSet.has(span.id)) expandedSet.delete(span.id);
        else expandedSet.add(span.id);
        rebuildTree();
      };
      expandLabel.on('tap', expandHandler);
      spanRow.addChild(expandLabel);
    }

    const iconLabel = new Label();
    iconLabel.className = 'trace-tree-span-icon';
    iconLabel.text = SPAN_TYPE_ICONS[span.type] ?? '\u25CF';
    spanRow.addChild(iconLabel);

    const labelView = new Label();
    labelView.className = 'trace-tree-span-label';
    labelView.text = span.label;
    spanRow.addChild(labelView);

    const durationView = new Label();
    durationView.className = 'trace-tree-span-duration';
    durationView.text = `${span.duration}ms`;
    spanRow.addChild(durationView);

    if (showMetrics && span.tokens != null) {
      const tokensView = new Label();
      tokensView.className = 'trace-tree-span-tokens';
      tokensView.text = `${span.tokens} tok`;
      spanRow.addChild(tokensView);
    }

    const statusView = new Label();
    statusView.className = 'trace-tree-span-status';
    statusView.text = STATUS_ICONS[span.status] ?? '\u2022';
    spanRow.addChild(statusView);

    const tapHandler = () => {
      selectedId = selectedId === span.id ? undefined : span.id;
      onSelectSpan?.(selectedId);
      rebuildTree();
      updateDetailPanel();
    };
    spanRow.on('tap', tapHandler);

    container.addChild(spanRow);

    if (hasChildren && isExpanded) {
      const visibleChildren = span.children!.filter((c) => visibleSet.has(c.type));
      for (const child of visibleChildren) {
        renderSpan(child, depth + 1, container);
      }
    }
  }

  function rebuildTree() {
    treeContainer.removeChildren();
    const visibleSpans = spans.filter((s) => visibleSet.has(s.type));
    for (const span of visibleSpans) {
      renderSpan(span, 0, treeContainer);
    }
    updateDetailPanel();
  }

  function updateDetailPanel() {
    detailPanel.removeChildren();
    if (!selectedId) {
      detailPanel.visibility = 'collapse' as any;
      return;
    }

    const span = findSpan(spans, selectedId);
    if (!span) {
      detailPanel.visibility = 'collapse' as any;
      return;
    }

    detailPanel.visibility = 'visible' as any;

    const detailHeader = new FlexboxLayout();
    detailHeader.flexDirection = 'row' as any;
    detailHeader.alignItems = 'center' as any;

    const typeLabel = new Label();
    typeLabel.text = `${SPAN_TYPE_ICONS[span.type] ?? '\u25CF'} ${SPAN_TYPE_LABELS[span.type] ?? span.type}`;
    detailHeader.addChild(typeLabel);

    const closeBtn = new Button();
    closeBtn.text = '\u2715';
    closeBtn.automationText = 'Close detail panel';
    const closeHandler = () => {
      selectedId = undefined;
      onSelectSpan?.(undefined);
      rebuildTree();
    };
    closeBtn.on('tap', closeHandler);
    detailHeader.addChild(closeBtn);
    detailPanel.addChild(detailHeader);

    const fields: [string, string][] = [
      ['Label', span.label],
      ['Status', `${STATUS_ICONS[span.status] ?? '\u2022'} ${span.status}`],
      ['Duration', `${span.duration}ms`],
    ];
    if (span.tokens != null) fields.push(['Tokens', String(span.tokens)]);
    if (span.children && span.children.length > 0) fields.push(['Children', `${span.children.length} spans`]);

    for (const [label, value] of fields) {
      const fieldRow = new FlexboxLayout();
      fieldRow.flexDirection = 'row' as any;

      const fieldLabel = new Label();
      fieldLabel.className = 'trace-tree-detail-label';
      fieldLabel.text = label;
      fieldRow.addChild(fieldLabel);

      const fieldValue = new Label();
      fieldValue.className = 'trace-tree-detail-value';
      fieldValue.text = value;
      fieldRow.addChild(fieldValue);

      detailPanel.addChild(fieldRow);
    }
  }

  rebuildTree();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createTraceTree;
