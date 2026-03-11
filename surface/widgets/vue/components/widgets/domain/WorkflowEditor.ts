// ============================================================
// WorkflowEditor -- Vue 3 Component
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

export interface WorkflowNodeDef {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  [k: string]: unknown;
}

export interface WorkflowEdgeDef {
  id: string;
  source: string;
  target: string;
  [k: string]: unknown;
}

export interface WorkflowEditorProps {
  /** Workflow nodes. */
  nodes: WorkflowNodeDef[];
  /** Workflow edges. */
  edges: WorkflowEdgeDef[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Execution state. */
  executionState?: 'idle' | 'running' | 'success' | 'error';
  /** Selected node ID. */
  selectedNodeId?: string;
  /** Zoom level. */
  zoom?: number;
  /** Pan X. */
  panX?: number;
  /** Pan Y. */
  panY?: number;
  /** Palette open state. */
  paletteOpen?: boolean;
  /** Config panel open state. */
  configOpen?: boolean;
  /** Workflow name. */
  workflowName?: string;
  /** Called on execute. */
  onExecute?: () => void;
  /** Called on cancel execution. */
  onCancel?: () => void;
  /** Canvas slot. */
  canvas?: VNode | string;
  /** Node palette slot. */
  nodePalette?: VNode | string;
  /** Config panel slot. */
  configPanel?: VNode | string;
  /** Minimap slot. */
  minimap?: VNode | string;
  /** Toolbar slot. */
  toolbar?: VNode | string;
}

export const WorkflowEditor = defineComponent({
  name: 'WorkflowEditor',

  props: {
    nodes: { type: Array as PropType<any[]>, required: true as const },
    edges: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'Workflow Editor' },
    readOnly: { type: Boolean, default: false },
    executionState: { type: String, default: 'idle' },
    selectedNodeId: { type: String },
    zoom: { type: Number, default: 1.0 },
    panX: { type: Number, default: 0 },
    panY: { type: Number, default: 0 },
    paletteOpen: { type: Boolean, default: true },
    configOpen: { type: Boolean, default: false },
    workflowName: { type: String, default: 'Untitled Workflow' },
    onExecute: { type: Function as PropType<(...args: any[]) => any> },
    onCancel: { type: Function as PropType<(...args: any[]) => any> },
    canvas: { type: null as unknown as PropType<any> },
    nodePalette: { type: null as unknown as PropType<any> },
    configPanel: { type: null as unknown as PropType<any> },
    minimap: { type: null as unknown as PropType<any> },
    toolbar: { type: null as unknown as PropType<any> },
  },

  emits: ['cancel', 'execute'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleExecute = () => {
    if (isExecuting) {
      send({ type: 'CANCEL' });
      props.onCancel?.();
    } else {
      send({ type: 'EXECUTE' });
      props.onExecute?.();
    }
  };

    return (): VNode =>
      h('div', {
        'role': 'application',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'workflow editor',
        'aria-busy': isExecuting || undefined,
        'data-surface-widget': '',
        'data-widget-name': 'workflow-editor',
        'data-state': state.value,
        'data-execution': props.executionState,
        'data-readonly': props.readOnly ? 'true' : 'false',
      }, [
        props.toolbar ? h('div', {
            'role': 'toolbar',
            'aria-label': 'Workflow actions',
            'data-part': 'toolbar',
            'data-state': state.value,
          }, [
            props.toolbar,
          ]) : null,
        h('button', {
          'type': 'button',
          'role': 'button',
          'aria-label': isExecuting ? 'Cancel execution' : 'Execute workflow',
          'aria-disabled': props.readOnly || undefined,
          'data-part': 'execute-button',
          'data-state': isExecuting ? 'running' : 'idle',
          'onClick': handleExecute,
        }, [
          isExecuting ? 'Cancel' : 'Execute',
        ]),
        h('div', {
          'data-part': 'canvas',
          'aria-label': 'Workflow canvas',
          'data-zoom': props.zoom,
          'data-pan-x': props.panX,
          'data-pan-y': props.panY,
          'data-node-count': props.nodes.length,
          'data-edge-count': props.edges.length,
        }, [
          props.canvas ?? slots.default?.(),
        ]),
        props.paletteOpen && props.nodePalette ? h('div', {
            'data-part': 'node-palette',
            'role': 'complementary',
            'aria-label': 'Node palette',
            'data-visible': 'true',
          }, [
            props.nodePalette,
          ]) : null,
        props.configOpen && props.configPanel ? h('div', {
            'data-part': 'config-panel',
            'role': 'complementary',
            'aria-label': 'Node configuration',
            'data-visible': 'true',
            'data-node-id': props.selectedNodeId,
          }, [
            props.configPanel,
          ]) : null,
        props.minimap ? h('div', {
            'data-part': 'minimap',
            'role': 'img',
            'aria-label': 'Workflow minimap',
            'data-zoom': props.zoom,
            'data-pan-x': props.panX,
            'data-pan-y': props.panY,
          }, [
            props.minimap,
          ]) : null,
      ]);
  },
});

export default WorkflowEditor;