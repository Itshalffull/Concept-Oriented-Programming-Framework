// ============================================================
// GraphView -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type?: string;
  [k: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  [k: string]: unknown;
}

export interface GraphViewProps {
  /** Graph nodes. */
  nodes: GraphNode[];
  /** Graph edges. */
  edges: GraphEdge[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Node count (can override). */
  nodeCount?: number;
  /** Edge count (can override). */
  edgeCount?: number;
  /** Zoom level. */
  zoom?: number;
  /** Pan X. */
  panX?: number;
  /** Pan Y. */
  panY?: number;
  /** Selected node ID. */
  selectedNodeId?: string;
  /** Search query. */
  searchQuery?: string;
  /** Visible node types. */
  visibleTypes?: string[];
  /** Node render size. */
  nodeSize?: number;
  /** Link thickness. */
  linkThickness?: number;
  /** Force charge strength. */
  chargeStrength?: number;
  /** Force link distance. */
  linkDistance?: number;
  /** View mode. */
  viewMode?: 'global' | 'local';
  /** Whether simulation is running. */
  simulationRunning?: boolean;
  /** Whether filter panel is open. */
  filterPanelOpen?: boolean;
  /** Called on node select. */
  onNodeSelect?: (id: string) => void;
  /** Called on search. */
  onSearch?: (query: string) => void;
  /** Called on view mode change. */
  onViewModeChange?: (mode: 'global' | 'local') => void;
  /** Canvas rendering slot. */
  canvas?: VNode | string;
  /** Filter panel slot. */
  filterPanel?: VNode | string;
  /** Detail panel slot. */
  detailPanel?: VNode | string;
  /** Minimap slot. */
  minimap?: VNode | string;
}

export const GraphView = defineComponent({
  name: 'GraphView',

  props: {
    nodes: { type: Array as PropType<any[]>, required: true as const },
    edges: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'Graph View' },
    nodeCount: { type: Number },
    edgeCount: { type: Number },
    zoom: { type: Number, default: 1.0 },
    panX: { type: Number, default: 0 },
    panY: { type: Number, default: 0 },
    selectedNodeId: { type: String },
    searchQuery: { type: String, default: '' },
    visibleTypes: { type: Array as PropType<any[]>, default: () => ([]) },
    nodeSize: { type: Number, default: 8 },
    linkThickness: { type: Number, default: 1.5 },
    chargeStrength: { type: Number, default: -300 },
    linkDistance: { type: Number, default: 100 },
    viewMode: { type: String, default: 'global' },
    simulationRunning: { type: Boolean, default: true },
    filterPanelOpen: { type: Boolean, default: true },
    onNodeSelect: { type: Function as PropType<(...args: any[]) => any> },
    onSearch: { type: Function as PropType<(...args: any[]) => any> },
    onViewModeChange: { type: Function as PropType<(...args: any[]) => any> },
    canvas: { type: null as unknown as PropType<any> },
    filterPanel: { type: null as unknown as PropType<any> },
    detailPanel: { type: null as unknown as PropType<any> },
    minimap: { type: null as unknown as PropType<any> },
  },

  emits: ['search', 'view-mode-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ view: 'globalView', simulation: props.simulationRunning ? 'running' : 'paused', });
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'application',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'graph visualization',
        'data-surface-widget': '',
        'data-widget-name': 'graph-view',
        'data-state': state.value.view,
        'data-view-mode': props.viewMode,
        'data-simulation': props.simulationRunning ? 'running' : 'paused',
      }, [
        h('div', {
          'data-part': 'canvas',
          'role': 'img',
          'aria-label': `Graph with ${actualNodeCount} nodes and ${actualEdgeCount} edges`,
          'data-zoom': props.zoom,
          'data-pan-x': props.panX,
          'data-pan-y': props.panY,
          'tabindex': 0,
          'onPointerDown': () => send({ type: 'PAN_START' }),
          'onPointerUp': () => send({ type: 'PAN_END' }),
        }, [
          props.canvas ?? slots.default?.(),
        ]),
        props.filterPanelOpen ? h('div', {
            'data-part': 'filter-panel',
            'role': 'complementary',
            'aria-label': 'Graph filters',
            'data-visible': 'true',
          }, [
            props.filterPanel ?? [
              h('div', { 'data-part': 'search-input', 'aria-label': 'Search nodes' }, [
                h('input', {
                  'type': 'text',
                  'value': props.searchQuery,
                  'aria-label': 'Search nodes',
                  'placeholder': 'Search nodes...',
                  'onChange': (e) => {
                    props.onSearch?.(e.target.value);
                    send({ type: e.target.value ? 'SEARCH' : 'CLEAR_SEARCH' });
                  },
                }),
              ]),
              h('div', { 'data-part': 'type-toggles', 'role': 'group', 'aria-label': 'Node type filters' }),
              h('div', { 'data-part': 'display-controls', 'role': 'group', 'aria-label': 'Display settings' }, [
                h('div', { 'data-part': 'node-size-slider', 'aria-label': 'Node size' }),
                h('div', { 'data-part': 'link-thickness-slider', 'aria-label': 'Link thickness' }),
              ]),
              h('div', { 'data-part': 'force-controls', 'role': 'group', 'aria-label': 'Force simulation controls' }),
            ],
          ]) : null,
        props.selectedNodeId ? h('div', {
            'data-part': 'detail-panel',
            'role': 'complementary',
            'aria-label': 'Node details',
            'data-visible': 'true',
            'data-node-id': props.selectedNodeId,
          }, [
            props.detailPanel,
          ]) : null,
        props.minimap ? h('div', {
            'data-part': 'minimap',
            'role': 'img',
            'aria-label': 'Graph minimap',
            'data-zoom': props.zoom,
            'data-pan-x': props.panX,
            'data-pan-y': props.panY,
          }, [
            props.minimap,
          ]) : null,
        h('div', {
          'data-part': 'mode-toggle',
          'role': 'switch',
          'aria-label': 'Toggle local neighborhood view',
          'aria-checked': props.viewMode === 'local',
          'data-mode': props.viewMode,
          'onClick': () => props.onViewModeChange?.(props.viewMode === 'global' ? 'local' : 'global'),
        }),
      ]);
  },
});

export default GraphView;