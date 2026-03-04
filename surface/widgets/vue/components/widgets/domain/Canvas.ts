// ============================================================
// Canvas -- Vue 3 Component
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

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasProps {
  /** Array of canvas nodes (rendered via children). */
  nodes?: Array<{ id: string; x: number; y: number; [k: string]: unknown }>;
  /** Array of canvas edges. */
  edges?: Array<{ id: string; source: string; target: string; [k: string]: unknown }>;
  /** Active tool. */
  tool?: CanvasTool;
  /** Current zoom. */
  zoom?: number;
  /** Pan X. */
  panX?: number;
  /** Pan Y. */
  panY?: number;
  /** Grid size in px. */
  gridSize?: number;
  /** Show grid. */
  gridVisible?: boolean;
  /** Snap to grid. */
  snapToGrid?: boolean;
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Currently selected node/edge IDs. */
  selectedIds?: string[];
  /** Zoom percentage for minimap. */
  viewportPercent?: number;
  /** Shape type for shape tool. */
  shapeType?: 'rectangle' | 'ellipse' | 'diamond' | 'triangle';
  /** Called on zoom change. */
  onZoomChange?: (zoom: number) => void;
  /** Called on pan change. */
  onPanChange?: (x: number, y: number) => void;
  /** Called on tool change. */
  onToolChange?: (tool: CanvasTool) => void;
  /** Node layer content. */
  nodeLayer?: VNode | string;
  /** Edge layer content. */
  edgeLayer?: VNode | string;
  /** Toolbar slot. */
  toolbar?: VNode | string;
  /** Minimap slot. */
  minimap?: VNode | string;
  /** Property panel slot. */
  propertyPanel?: VNode | string;
}

export const Canvas = defineComponent({
  name: 'Canvas',

  props: {
    nodes: { type: Array as PropType<any[]>, default: () => ([]) },
    edges: { type: Array as PropType<any[]>, default: () => ([]) },
    tool: { type: String, default: 'select' },
    zoom: { type: Number, default: 1.0 },
    panX: { type: Number, default: 0 },
    panY: { type: Number, default: 0 },
    gridSize: { type: Number, default: 20 },
    gridVisible: { type: Boolean, default: true },
    snapToGrid: { type: Boolean, default: false },
    ariaLabel: { type: String, default: 'Canvas' },
    readOnly: { type: Boolean, default: false },
    selectedIds: { type: Array as PropType<any[]>, default: () => ([]) },
    viewportPercent: { type: Number, default: 100 },
    shapeType: { type: String, default: 'rectangle' },
    onZoomChange: { type: Function as PropType<(...args: any[]) => any> },
    onPanChange: { type: Function as PropType<(...args: any[]) => any> },
    onToolChange: { type: Function as PropType<(...args: any[]) => any> },
    nodeLayer: { type: null as unknown as PropType<any> },
    edgeLayer: { type: null as unknown as PropType<any> },
    toolbar: { type: null as unknown as PropType<any> },
    minimap: { type: null as unknown as PropType<any> },
    propertyPanel: { type: null as unknown as PropType<any> },
  },

  emits: ['zoom-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ tool: props.tool, interaction: 'idle', });
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'application',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'canvas',
        'data-surface-widget': '',
        'data-widget-name': 'canvas',
        'data-tool': props.tool,
        'data-state': state.value.interaction,
        'data-readonly': props.readOnly ? 'true' : 'false',
        'data-zoom': props.zoom,
        'tabindex': 0,
        'onWheel': handleWheel,
      }, [
        props.toolbar ? h('div', { 'data-part': 'toolbar', 'aria-label': 'Canvas tools' }, [
            props.toolbar,
          ]) : null,
        h('div', {
          'data-part': 'viewport',
          'style': { transform: `translate(${panX}px, ${panY}px) scale(${zoom})` },
          'data-zoom': props.zoom,
        }, [
          props.gridVisible ? h('div', {
              'data-part': 'grid',
              'data-visible': 'true',
              'data-size': props.gridSize,
              'data-zoom': props.zoom,
              'aria-hidden': 'true',
            }) : null,
          h('svg', {
            'data-part': 'edge-layer',
            'role': 'img',
            'aria-label': 'Connections between nodes',
          }, [
            props.edgeLayer,
          ]),
          h('div', {
            'data-part': 'node-layer',
            'role': 'group',
            'aria-label': 'Canvas nodes',
          }, [
            props.nodeLayer,
            slots.default?.(),
          ]),
          state.value.interaction === 'marquee' ? h('div', {
              'data-part': 'selection-box',
              'data-visible': 'true',
              'aria-hidden': state.value.interaction !== 'marquee' ? 'true' : undefined,
            }) : null,
        ]),
        props.minimap ? h('div', {
            'data-part': 'minimap',
            'role': 'img',
            'aria-label': `Minimap: viewport at ${viewportPercent}% zoom`,
            'data-zoom': props.zoom,
            'data-pan-x': props.panX,
            'data-pan-y': props.panY,
          }, [
            props.minimap,
          ]) : null,
        props.selectedIds.length > 0 && props.propertyPanel ? h('div', {
            'data-part': 'property-panel',
            'role': 'complementary',
            'aria-label': 'Element properties',
            'data-visible': 'true',
          }, [
            props.propertyPanel,
          ]) : null,
      ]);
  },
});

export default Canvas;