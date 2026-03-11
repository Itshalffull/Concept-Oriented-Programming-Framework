import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type TraceTreeState = 'idle' | 'spanSelected' | 'ready' | 'fetching';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'FILTER' }
  | { type: 'DESELECT' }
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' };

export function traceTreeReducer(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'spanSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    case 'ready':
      if (event.type === 'LOAD') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      return state;
    default:
      return state;
  }
}

interface TraceSpan {
  id: string;
  type: string;
  label: string;
  duration: number;
  tokens?: number;
  status: string;
  children?: TraceSpan[];
}

const SPAN_TYPE_ICONS: Record<string, string> = { llm: '\uD83E\uDDE0', tool: '\u2699', chain: '\uD83D\uDD17', agent: '\uD83E\uDD16' };
const SPAN_TYPE_LABELS: Record<string, string> = { llm: 'LLM', tool: 'Tool', chain: 'Chain', agent: 'Agent' };
const STATUS_ICONS: Record<string, string> = { success: '\u2713', running: '\u25CB', error: '\u2717', pending: '\u2022' };

function findSpan(spans: TraceSpan[], id: string): TraceSpan | undefined {
  for (const span of spans) {
    if (span.id === id) return span;
    if (span.children?.length) { const found = findSpan(span.children, id); if (found) return found; }
  }
  return undefined;
}

export interface TraceTreeProps { [key: string]: unknown; class?: string; }
export interface TraceTreeResult { element: HTMLElement; dispose: () => void; }

export function TraceTree(props: TraceTreeProps): TraceTreeResult {
  const sig = surfaceCreateSignal<TraceTreeState>('idle');
  const send = (event: TraceTreeEvent) => { sig.set(traceTreeReducer(sig.get(), event)); };

  const spans = (props.spans ?? []) as TraceSpan[];
  const rootLabel = String(props.rootLabel ?? 'Trace');
  const totalDuration = props.totalDuration as number | undefined;
  const totalTokens = props.totalTokens as number | undefined;
  const showMetrics = props.showMetrics !== false;
  const onSelectSpan = props.onSelectSpan as ((id: string | undefined) => void) | undefined;

  let selectedId: string | undefined = props.selectedSpanId as string | undefined;
  const expandedSet = new Set<string>((props.expandedIds as string[]) ?? []);
  const visibleSet = new Set<string>((props.visibleTypes as string[]) ?? ['llm', 'tool', 'chain', 'agent']);

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'trace-tree');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Execution trace');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const rootLabelEl = document.createElement('span');
  rootLabelEl.setAttribute('data-part', 'root-label');
  rootLabelEl.textContent = rootLabel;
  headerEl.appendChild(rootLabelEl);

  if (showMetrics && totalDuration != null) {
    const durEl = document.createElement('span');
    durEl.setAttribute('data-part', 'total-duration');
    durEl.textContent = `${totalDuration}ms`;
    headerEl.appendChild(durEl);
  }
  if (showMetrics && totalTokens != null) {
    const tokEl = document.createElement('span');
    tokEl.setAttribute('data-part', 'total-tokens');
    tokEl.textContent = `${totalTokens} tokens`;
    headerEl.appendChild(tokEl);
  }

  // Filter bar
  const filterBarEl = document.createElement('div');
  filterBarEl.setAttribute('data-part', 'filter-bar');
  filterBarEl.setAttribute('role', 'toolbar');
  filterBarEl.setAttribute('aria-label', 'Span type filters');
  root.appendChild(filterBarEl);

  const availableTypes = new Set<string>();
  const collectTypes = (nodes: TraceSpan[]) => { for (const s of nodes) { availableTypes.add(s.type); if (s.children?.length) collectTypes(s.children); } };
  collectTypes(spans);

  for (const spanType of availableTypes) {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('role', 'checkbox');
    btn.setAttribute('aria-checked', String(visibleSet.has(spanType)));
    btn.setAttribute('aria-label', `Filter ${SPAN_TYPE_LABELS[spanType] ?? spanType}`);
    btn.setAttribute('data-part', 'filter-toggle');
    btn.setAttribute('data-type', spanType);
    btn.setAttribute('data-active', visibleSet.has(spanType) ? 'true' : 'false');
    btn.setAttribute('tabindex', '0');
    btn.textContent = SPAN_TYPE_LABELS[spanType] ?? spanType;
    btn.addEventListener('click', () => {
      if (visibleSet.has(spanType)) visibleSet.delete(spanType);
      else visibleSet.add(spanType);
      btn.setAttribute('aria-checked', String(visibleSet.has(spanType)));
      btn.setAttribute('data-active', visibleSet.has(spanType) ? 'true' : 'false');
      renderTree();
    });
    filterBarEl.appendChild(btn);
  }

  // Tree
  const treeEl = document.createElement('div');
  treeEl.setAttribute('data-part', 'tree');
  treeEl.setAttribute('role', 'tree');
  treeEl.setAttribute('aria-label', 'Trace spans');
  root.appendChild(treeEl);

  // Detail panel
  const detailPanelEl = document.createElement('div');
  detailPanelEl.setAttribute('data-part', 'detail-panel');
  detailPanelEl.setAttribute('role', 'complementary');
  detailPanelEl.setAttribute('aria-label', 'Span details');
  detailPanelEl.setAttribute('data-visible', 'false');
  root.appendChild(detailPanelEl);

  const renderSpanNode = (span: TraceSpan, depth: number): HTMLElement => {
    const hasChildren = !!(span.children?.length);
    const isExpanded = expandedSet.has(span.id);
    const isSelected = selectedId === span.id;
    const visibleChildren = span.children?.filter(c => visibleSet.has(c.type)) ?? [];

    const node = document.createElement('div');
    node.setAttribute('role', 'treeitem');
    if (hasChildren) node.setAttribute('aria-expanded', String(isExpanded));
    node.setAttribute('aria-selected', String(isSelected));
    node.setAttribute('aria-label', `${span.type}: ${span.label} (${span.duration}ms)`);
    node.setAttribute('aria-level', String(depth + 1));
    node.setAttribute('data-part', 'span-node');
    node.setAttribute('data-type', span.type);
    node.setAttribute('data-status', span.status);
    node.setAttribute('data-id', span.id);
    node.setAttribute('tabindex', '-1');
    node.style.paddingLeft = `${depth * 16}px`;

    node.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedId = selectedId === span.id ? undefined : span.id;
      if (selectedId) { send({ type: 'SELECT_SPAN' }); } else { send({ type: 'DESELECT' }); }
      onSelectSpan?.(selectedId);
      renderTree();
      renderDetail();
    });

    if (hasChildren) {
      const toggle = document.createElement('span');
      toggle.setAttribute('data-part', 'expand-toggle');
      toggle.setAttribute('aria-hidden', 'true');
      toggle.textContent = isExpanded ? '\u25BC' : '\u25B6';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedSet.has(span.id)) expandedSet.delete(span.id);
        else expandedSet.add(span.id);
        renderTree();
      });
      node.appendChild(toggle);
    }

    const iconEl = document.createElement('span');
    iconEl.setAttribute('data-part', 'span-icon');
    iconEl.setAttribute('data-type', span.type);
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = SPAN_TYPE_ICONS[span.type] ?? '\u25CF';
    node.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.setAttribute('data-part', 'span-label');
    labelEl.textContent = span.label;
    node.appendChild(labelEl);

    const durEl = document.createElement('span');
    durEl.setAttribute('data-part', 'span-duration');
    durEl.textContent = `${span.duration}ms`;
    node.appendChild(durEl);

    if (showMetrics && span.tokens != null) {
      const tokEl = document.createElement('span');
      tokEl.setAttribute('data-part', 'span-tokens');
      tokEl.setAttribute('data-visible', 'true');
      tokEl.textContent = `${span.tokens} tok`;
      node.appendChild(tokEl);
    }

    const statusEl = document.createElement('span');
    statusEl.setAttribute('data-part', 'span-status');
    statusEl.setAttribute('data-status', span.status);
    statusEl.textContent = STATUS_ICONS[span.status] ?? '\u2022';
    node.appendChild(statusEl);

    if (hasChildren && isExpanded && visibleChildren.length > 0) {
      const childrenEl = document.createElement('div');
      childrenEl.setAttribute('data-part', 'span-children');
      childrenEl.setAttribute('role', 'group');
      childrenEl.setAttribute('data-visible', 'true');
      for (const child of visibleChildren) {
        childrenEl.appendChild(renderSpanNode(child, depth + 1));
      }
      node.appendChild(childrenEl);
    }

    return node;
  };

  const renderTree = () => {
    treeEl.innerHTML = '';
    const visibleSpans = spans.filter(s => visibleSet.has(s.type));
    for (const span of visibleSpans) {
      treeEl.appendChild(renderSpanNode(span, 0));
    }
  };

  const renderDetail = () => {
    detailPanelEl.innerHTML = '';
    detailPanelEl.setAttribute('data-visible', selectedId ? 'true' : 'false');
    if (!selectedId) return;
    const span = findSpan(spans, selectedId);
    if (!span) return;

    const dHeader = document.createElement('div');
    dHeader.setAttribute('data-part', 'detail-header');
    const dType = document.createElement('span');
    dType.setAttribute('data-part', 'detail-type');
    dType.setAttribute('data-type', span.type);
    dType.textContent = `${SPAN_TYPE_ICONS[span.type] ?? '\u25CF'} ${SPAN_TYPE_LABELS[span.type] ?? span.type}`;
    dHeader.appendChild(dType);
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('data-part', 'detail-close');
    closeBtn.setAttribute('aria-label', 'Close detail panel');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => { selectedId = undefined; send({ type: 'DESELECT' }); onSelectSpan?.(undefined); renderTree(); renderDetail(); });
    dHeader.appendChild(closeBtn);
    detailPanelEl.appendChild(dHeader);

    const dBody = document.createElement('div');
    dBody.setAttribute('data-part', 'detail-body');

    const fields: [string, string][] = [
      ['Label', span.label],
      ['Status', `${STATUS_ICONS[span.status] ?? '\u2022'} ${span.status}`],
      ['Duration', `${span.duration}ms`],
    ];
    if (span.tokens != null) fields.push(['Tokens', String(span.tokens)]);
    if (span.children && span.children.length > 0) fields.push(['Children', `${span.children.length} spans`]);

    for (const [label, value] of fields) {
      const fieldEl = document.createElement('div');
      fieldEl.setAttribute('data-part', 'detail-field');
      const labelEl = document.createElement('span');
      labelEl.setAttribute('data-part', 'detail-label');
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.setAttribute('data-part', 'detail-value');
      valueEl.textContent = value;
      fieldEl.appendChild(labelEl);
      fieldEl.appendChild(valueEl);
      dBody.appendChild(fieldEl);
    }
    detailPanelEl.appendChild(dBody);
  };

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); selectedId = undefined; send({ type: 'DESELECT' }); onSelectSpan?.(undefined); renderTree(); renderDetail(); }
  });

  renderTree();
  renderDetail();

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default TraceTree;
