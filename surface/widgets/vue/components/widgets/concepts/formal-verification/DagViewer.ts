import { defineComponent, h, ref, computed } from 'vue';

/* ---------------------------------------------------------------------------
 * DagViewer state machine
 * ------------------------------------------------------------------------- */

export type DagViewerState = 'idle' | 'nodeSelected' | 'computing';
export type DagViewerEvent =
  | { type: 'SELECT_NODE'; id?: string }
  | { type: 'ZOOM' }
  | { type: 'PAN' }
  | { type: 'LAYOUT' }
  | { type: 'DESELECT' }
  | { type: 'LAYOUT_COMPLETE' };

export function dagViewerReducer(state: DagViewerState, event: DagViewerEvent): DagViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      if (event.type === 'ZOOM') return 'idle';
      if (event.type === 'PAN') return 'idle';
      if (event.type === 'LAYOUT') return 'computing';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      return state;
    case 'computing':
      if (event.type === 'LAYOUT_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface DagNode {
  id: string;
  label: string;
  type?: string;
  status?: string;
}

export interface DagEdge {
  from: string;
  to: string;
  label?: string;
}

/* ---------------------------------------------------------------------------
 * Topological sort & helpers
 * ------------------------------------------------------------------------- */

function computeLevels(nodes: DagNode[], edges: DagEdge[]): Map<string, number> {
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const n of nodes) { inDegree.set(n.id, 0); children.set(n.id, []); }
  for (const e of edges) { inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1); children.get(e.from)?.push(e.to); }
  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) { if (deg === 0) { queue.push(id); levels.set(id, 0); } }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    for (const child of children.get(current) ?? []) {
      const existing = levels.get(child);
      const nextLevel = currentLevel + 1;
      if (existing === undefined || nextLevel > existing) levels.set(child, nextLevel);
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }
  for (const n of nodes) { if (!levels.has(n.id)) levels.set(n.id, 0); }
  return levels;
}

function groupByLevel(nodes: DagNode[], levels: Map<string, number>): DagNode[][] {
  const maxLevel = Math.max(0, ...levels.values());
  const groups: DagNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const n of nodes) groups[levels.get(n.id) ?? 0].push(n);
  return groups;
}

function getUpstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) { if (e.to === nodeId) ids.add(e.from); }
  return ids;
}

function getDownstream(nodeId: string, edges: DagEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) { if (e.from === nodeId) ids.add(e.to); }
  return ids;
}

function getConnectedEdges(nodeId: string, edges: DagEdge[]): DagEdge[] {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId);
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const DagViewer = defineComponent({
  name: 'DagViewer',
  props: {
    nodes: { type: Array as () => DagNode[], required: true },
    edges: { type: Array as () => DagEdge[], required: true },
    layout: { type: String as () => 'dagre' | 'elk' | 'layered', default: 'dagre' },
    zoom: { type: Number, default: 1.0 },
    panX: { type: Number, default: 0.0 },
    panY: { type: Number, default: 0.0 },
    selectedNodeId: { type: String, default: undefined },
  },
  emits: ['selectNode'],
  setup(props, { slots, emit }) {
    const state = ref<DagViewerState>('idle');
    const send = (event: DagViewerEvent) => { state.value = dagViewerReducer(state.value, event); };

    const internalSelectedId = ref<string | undefined>(undefined);
    const focusedIndex = ref(0);

    const selectedId = computed(() => props.selectedNodeId ?? internalSelectedId.value);

    const selectNode = (id: string | undefined) => {
      internalSelectedId.value = id;
      emit('selectNode', id);
      if (id !== undefined) send({ type: 'SELECT_NODE', id });
      else send({ type: 'DESELECT' });
    };

    const levels = computed(() => computeLevels(props.nodes, props.edges));
    const levelGroups = computed(() => groupByLevel(props.nodes, levels.value));
    const flatNodes = computed(() => levelGroups.value.flat());

    const nodeMap = computed(() => {
      const m = new Map<string, DagNode>();
      for (const n of props.nodes) m.set(n.id, n);
      return m;
    });

    const upstream = computed(() => selectedId.value ? getUpstream(selectedId.value, props.edges) : new Set<string>());
    const downstream = computed(() => selectedId.value ? getDownstream(selectedId.value, props.edges) : new Set<string>());
    const connectedEdges = computed(() => selectedId.value ? getConnectedEdges(selectedId.value, props.edges) : []);

    const isHighlighted = (id: string) => id === selectedId.value || upstream.value.has(id) || downstream.value.has(id);
    const isEdgeHighlighted = (edge: DagEdge) => selectedId.value !== undefined && (edge.from === selectedId.value || edge.to === selectedId.value);

    const handleKeyDown = (e: KeyboardEvent) => {
      const count = flatNodes.value.length;
      if (count === 0) return;
      switch (e.key) {
        case 'ArrowDown': { e.preventDefault(); focusedIndex.value = Math.min(focusedIndex.value + 1, count - 1); break; }
        case 'ArrowUp': { e.preventDefault(); focusedIndex.value = Math.max(focusedIndex.value - 1, 0); break; }
        case 'Home': { e.preventDefault(); focusedIndex.value = 0; break; }
        case 'End': { e.preventDefault(); focusedIndex.value = count - 1; break; }
        case 'Enter': {
          e.preventDefault();
          const node = flatNodes.value[focusedIndex.value];
          if (node) selectNode(node.id === selectedId.value ? undefined : node.id);
          break;
        }
        case 'Escape': { e.preventDefault(); selectNode(undefined); break; }
      }
    };

    return () => h('div', {
      role: 'application', 'aria-label': 'Dependency graph',
      'data-surface-widget': '', 'data-widget-name': 'dag-viewer',
      'data-part': 'root', 'data-state': state.value, 'data-layout': props.layout,
      onKeydown: handleKeyDown, tabindex: 0,
    }, [
      // Canvas
      h('div', {
        'data-part': 'canvas', 'data-state': state.value,
        'data-zoom': props.zoom, 'data-pan-x': props.panX, 'data-pan-y': props.panY,
        role: 'list', 'aria-label': `DAG with ${props.nodes.length} nodes`,
      }, levelGroups.value.map((group, levelIdx) =>
        h('div', { key: levelIdx, 'data-part': 'level', 'data-level': levelIdx, role: 'group', 'aria-label': `Level ${levelIdx}` },
          group.map((node) => {
            const globalIdx = flatNodes.value.indexOf(node);
            const isFocused = globalIdx === focusedIndex.value;
            const isSelected = node.id === selectedId.value;
            const highlighted = isHighlighted(node.id);
            return h('div', {
              key: node.id, 'data-part': 'node', 'data-state': state.value,
              'data-status': node.status ?? 'unknown',
              'data-selected': isSelected ? 'true' : 'false',
              'data-highlighted': highlighted ? 'true' : 'false',
              role: 'button',
              'aria-label': `${node.label} \u2014 ${node.status ?? 'unknown'}`,
              'aria-pressed': isSelected,
              tabindex: isFocused ? 0 : -1,
              onClick: () => selectNode(isSelected ? undefined : node.id),
            }, [
              h('span', { 'data-part': 'node-label', 'data-state': state.value }, node.label),
              node.type ? h('span', { 'data-part': 'node-badge', 'data-state': state.value, 'data-type': node.type }, node.type) : null,
              h('span', {
                'data-part': 'node-badge', 'data-state': state.value,
                'data-status': node.status ?? 'unknown',
                'aria-label': `Status: ${node.status ?? 'unknown'}`,
              }, node.status ?? 'unknown'),
            ]);
          }),
        ),
      )),
      // Edges
      h('div', { 'data-part': 'edges', 'data-state': state.value, role: 'list', 'aria-label': 'Graph edges' },
        props.edges.map((edge, idx) => {
          const fromLabel = nodeMap.value.get(edge.from)?.label ?? edge.from;
          const toLabel = nodeMap.value.get(edge.to)?.label ?? edge.to;
          const highlighted = isEdgeHighlighted(edge);
          return h('div', {
            key: `${edge.from}-${edge.to}-${idx}`, 'data-part': 'edge', 'data-state': state.value,
            'data-from': edge.from, 'data-to': edge.to,
            'data-highlighted': highlighted ? 'true' : 'false',
            role: 'listitem',
          }, [
            h('span', null, `${fromLabel} \u2192 ${toLabel}`),
            edge.label ? h('span', { 'data-part': 'edge-label', 'data-state': state.value }, edge.label) : null,
          ]);
        }),
      ),
      // Controls toolbar
      h('div', { 'data-part': 'controls', 'data-state': state.value, role: 'toolbar', 'aria-label': 'Graph controls' },
        slots.default ? slots.default() : null),
      // Detail panel
      h('div', {
        'data-part': 'detail-panel', 'data-state': state.value,
        'data-visible': state.value === 'nodeSelected' || selectedId.value !== undefined ? 'true' : 'false',
        role: 'complementary', 'aria-label': 'Node details',
      }, (() => {
        if (selectedId.value === undefined) return [];
        const selected = nodeMap.value.get(selectedId.value);
        if (!selected) return [];
        return [
          h('h3', { 'data-part': 'detail-title' }, selected.label),
          selected.type ? h('div', { 'data-part': 'detail-type' }, [h('strong', null, 'Type:'), ` ${selected.type}`]) : null,
          h('div', { 'data-part': 'detail-status' }, [h('strong', null, 'Status:'), ` ${selected.status ?? 'unknown'}`]),
          h('div', { 'data-part': 'detail-upstream', 'aria-label': 'Upstream dependencies' }, [
            h('strong', null, `Upstream (${upstream.value.size}):`),
            upstream.value.size > 0
              ? h('ul', null, [...upstream.value].map((id) => h('li', { key: id }, nodeMap.value.get(id)?.label ?? id)))
              : h('span', null, ' None'),
          ]),
          h('div', { 'data-part': 'detail-downstream', 'aria-label': 'Downstream dependents' }, [
            h('strong', null, `Downstream (${downstream.value.size}):`),
            downstream.value.size > 0
              ? h('ul', null, [...downstream.value].map((id) => h('li', { key: id }, nodeMap.value.get(id)?.label ?? id)))
              : h('span', null, ' None'),
          ]),
          h('div', { 'data-part': 'detail-edges', 'aria-label': 'Connected edges' }, [
            h('strong', null, `Connected edges (${connectedEdges.value.length}):`),
            connectedEdges.value.length > 0
              ? h('ul', null, connectedEdges.value.map((ce, i) => {
                  const fl = nodeMap.value.get(ce.from)?.label ?? ce.from;
                  const tl = nodeMap.value.get(ce.to)?.label ?? ce.to;
                  return h('li', { key: i }, `${fl} \u2192 ${tl}${ce.label ? ` (${ce.label})` : ''}`);
                }))
              : h('span', null, ' None'),
          ]),
        ];
      })()),
    ]);
  },
});

export default DagViewer;
