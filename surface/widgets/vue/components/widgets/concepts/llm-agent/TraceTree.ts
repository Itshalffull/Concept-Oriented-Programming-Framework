import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type TraceTreeState = 'idle' | 'spanSelected';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN'; id?: string }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'FILTER' }
  | { type: 'DESELECT' };

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
    default:
      return state;
  }
}

interface TraceSpan {
  id: string;
  label: string;
  type: 'llm' | 'tool' | 'chain' | 'agent';
  status: 'success' | 'error' | 'running' | 'pending';
  duration?: number;
  tokens?: number;
  children?: TraceSpan[];
}

const TYPE_ICONS: Record<string, string> = { llm: '\u{1F916}', tool: '\u{1F527}', chain: '\u{1F517}', agent: '\u{1F9D1}' };
const STATUS_ICONS: Record<string, string> = { success: '\u2713', error: '\u2717', running: '\u25CF', pending: '\u25CB' };
const SPAN_TYPES = ['llm', 'tool', 'chain', 'agent'] as const;

export const TraceTree = defineComponent({
  name: 'TraceTree',
  props: {
    spans: { type: Array as PropType<TraceSpan[]>, required: true },
    rootLabel: { type: String, required: true },
    totalDuration: { type: Number, default: undefined },
    totalTokens: { type: Number, default: undefined },
    selectedSpanId: { type: String, default: undefined },
    expandedIds: { type: Array as PropType<string[]>, default: () => [] },
    visibleTypes: { type: Array as PropType<string[]>, default: () => ['llm', 'tool', 'chain', 'agent'] },
    showMetrics: { type: Boolean, default: true },
  },
  emits: ['selectSpan', 'expand', 'collapse', 'filterType'],
  setup(props, { emit }) {
    const state = ref<TraceTreeState>('idle');
    const selectedId = ref<string | null>(props.selectedSpanId ?? null);
    const expandedSet = ref(new Set(props.expandedIds));
    const activeTypes = ref(new Set(props.visibleTypes));
    const focusIndex = ref(0);

    function send(event: TraceTreeEvent) {
      state.value = traceTreeReducer(state.value, event);
    }

    function toggleExpand(id: string) {
      if (expandedSet.value.has(id)) {
        expandedSet.value.delete(id);
        send({ type: 'COLLAPSE' });
        emit('collapse', id);
      } else {
        expandedSet.value.add(id);
        send({ type: 'EXPAND' });
        emit('expand', id);
      }
    }

    function selectSpan(id: string) {
      selectedId.value = id;
      send({ type: 'SELECT_SPAN', id });
      emit('selectSpan', id);
    }

    function toggleType(type: string) {
      if (activeTypes.value.has(type)) activeTypes.value.delete(type);
      else activeTypes.value.add(type);
      send({ type: 'FILTER' });
      emit('filterType', [...activeTypes.value]);
    }

    function flattenVisible(spans: TraceSpan[]): TraceSpan[] {
      const result: TraceSpan[] = [];
      for (const span of spans) {
        if (!activeTypes.value.has(span.type)) continue;
        result.push(span);
        if (expandedSet.value.has(span.id) && span.children) {
          result.push(...flattenVisible(span.children));
        }
      }
      return result;
    }

    const flatSpans = computed(() => flattenVisible(props.spans));
    const selectedSpan = computed(() => flatSpans.value.find((s) => s.id === selectedId.value));

    function renderSpan(span: TraceSpan, depth: number): any {
      if (!activeTypes.value.has(span.type)) return null;
      const isExpanded = expandedSet.value.has(span.id);
      const isSelected = selectedId.value === span.id;
      const hasChildren = span.children && span.children.length > 0;

      const nodeChildren: any[] = [
        hasChildren ? h('span', {
          'data-part': 'expand-toggle', 'aria-hidden': 'true',
          onClick: (e: Event) => { e.stopPropagation(); toggleExpand(span.id); },
          style: { cursor: 'pointer' },
        }, isExpanded ? '\u25BC' : '\u25B6') : h('span', { style: { width: '1em', display: 'inline-block' } }),
        h('div', { 'data-part': 'span-icon', 'data-type': span.type }, TYPE_ICONS[span.type] ?? ''),
        h('span', { 'data-part': 'span-label' }, span.label),
        h('div', { 'data-part': 'span-status', 'data-status': span.status }, STATUS_ICONS[span.status] ?? ''),
      ];
      if (span.duration != null) nodeChildren.push(h('span', { 'data-part': 'span-duration' }, `${span.duration}ms`));
      if (span.tokens != null) nodeChildren.push(h('span', { 'data-part': 'span-tokens' }, `${span.tokens} tok`));

      const items: any[] = [
        h('div', {
          'data-part': 'span-node',
          'data-type': span.type,
          'data-status': span.status,
          'data-selected': isSelected ? 'true' : 'false',
          role: 'treeitem',
          'aria-expanded': hasChildren ? (isExpanded ? 'true' : 'false') : undefined,
          'aria-selected': isSelected ? 'true' : 'false',
          tabindex: -1,
          style: { paddingLeft: `${depth * 16}px`, cursor: 'pointer' },
          onClick: () => selectSpan(span.id),
        }, nodeChildren),
      ];

      if (isExpanded && span.children) {
        items.push(h('div', { 'data-part': 'span-children', role: 'group' },
          span.children.map((child) => renderSpan(child, depth + 1))));
      }

      return h('div', { key: span.id }, items);
    }

    function handleKeydown(e: KeyboardEvent) {
      const flat = flatSpans.value;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, flat.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const s = flat[focusIndex.value]; if (s) selectSpan(s.id); }
      if (e.key === 'ArrowRight') { e.preventDefault(); const s = flat[focusIndex.value]; if (s) { expandedSet.value.add(s.id); send({ type: 'EXPAND' }); } }
      if (e.key === 'ArrowLeft') { e.preventDefault(); const s = flat[focusIndex.value]; if (s) { expandedSet.value.delete(s.id); send({ type: 'COLLAPSE' }); } }
      if (e.key === 'Escape') { e.preventDefault(); selectedId.value = null; send({ type: 'DESELECT' }); }
    }

    return () => {
      const children: any[] = [];

      // Header
      if (props.showMetrics) {
        const headerParts: any[] = [h('span', { 'data-part': 'root-label' }, props.rootLabel)];
        if (props.totalDuration != null) headerParts.push(h('span', { 'data-part': 'total-duration' }, `${props.totalDuration}ms`));
        if (props.totalTokens != null) headerParts.push(h('span', { 'data-part': 'total-tokens' }, `${props.totalTokens} tokens`));
        children.push(h('div', { 'data-part': 'header' }, headerParts));
      }

      // Filter bar
      children.push(h('div', { 'data-part': 'filter-bar', role: 'toolbar', 'aria-label': 'Filter by type' },
        SPAN_TYPES.map((t) => h('button', {
          type: 'button', 'data-part': 'filter-chip', 'data-type': t,
          'data-active': activeTypes.value.has(t) ? 'true' : 'false',
          'aria-pressed': activeTypes.value.has(t) ? 'true' : 'false',
          onClick: () => toggleType(t),
        }, t.toUpperCase()))));

      // Tree
      children.push(h('div', { 'data-part': 'tree', role: 'tree', 'aria-label': 'Trace spans' },
        props.spans.map((span) => renderSpan(span, 0))));

      // Detail panel
      if (state.value === 'spanSelected' && selectedSpan.value) {
        const sp = selectedSpan.value;
        children.push(h('div', { 'data-part': 'detail-panel', 'data-visible': 'true', role: 'complementary' }, [
          h('div', { 'data-part': 'detail-header' }, [
            h('span', {}, sp.label),
            h('button', { type: 'button', 'data-part': 'close-detail', onClick: () => { selectedId.value = null; send({ type: 'DESELECT' }); }, 'aria-label': 'Close' }, '\u2715'),
          ]),
          h('div', { 'data-part': 'detail-type' }, `Type: ${sp.type}`),
          h('div', { 'data-part': 'detail-status' }, `Status: ${sp.status}`),
          sp.duration != null ? h('div', { 'data-part': 'detail-duration' }, `Duration: ${sp.duration}ms`) : null,
          sp.tokens != null ? h('div', { 'data-part': 'detail-tokens' }, `Tokens: ${sp.tokens}`) : null,
        ]));
      }

      return h('div', {
        role: 'tree',
        'aria-label': 'Execution trace',
        'data-surface-widget': '',
        'data-widget-name': 'trace-tree',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default TraceTree;
