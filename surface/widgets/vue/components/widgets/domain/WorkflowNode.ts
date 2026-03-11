// ============================================================
// WorkflowNode -- Vue 3 Component
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

export interface PortDef {
  name: string;
  type: string;
  required?: boolean;
  connected?: boolean;
}

export interface WorkflowNodeProps {
  /** Node ID. */
  id: string;
  /** Node display title. */
  title: string;
  /** Node type identifier. */
  nodeType: string;
  /** Icon element. */
  icon?: VNode | string;
  /** Input port definitions. */
  inputPortDefs?: PortDef[];
  /** Output port definitions. */
  outputPortDefs?: PortDef[];
  /** Execution status. */
  executionStatus?: 'pending' | 'running' | 'success' | 'error';
  /** Position on canvas. */
  position?: { x: number; y: number };
  /** Config summary text. */
  configSummary?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Called on select. */
  onSelect?: (id: string) => void;
  /** Called on configure. */
  onConfigure?: (id: string) => void;
  /** Called on delete. */
  onDelete?: (id: string) => void;
  /** Called on port connection start. */
  onConnectStart?: (nodeId: string, portName: string, direction: 'input' | 'output') => void;
  /** Called on port connection end. */
  onConnectEnd?: (nodeId: string, portName: string, direction: 'input' | 'output') => void;
  /** Status badge slot. */
  statusBadge?: VNode | string;
}

export const WorkflowNode = defineComponent({
  name: 'WorkflowNode',

  props: {
    id: { type: String, required: true as const },
    title: { type: String, required: true as const },
    nodeType: { type: String, required: true as const },
    icon: { type: null as unknown as PropType<any> },
    inputPortDefs: { type: Array as PropType<any[]>, default: () => ([]) },
    outputPortDefs: { type: Array as PropType<any[]>, default: () => ([]) },
    executionStatus: { type: String, default: 'pending' },
    position: { type: Object as PropType<any>, default: () => ({ x: 0, y: 0 }) },
    configSummary: { type: String },
    disabled: { type: Boolean, default: false },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    onConfigure: { type: Function as PropType<(...args: any[]) => any> },
    onDelete: { type: Function as PropType<(...args: any[]) => any> },
    onConnectStart: { type: Function as PropType<(...args: any[]) => any> },
    onConnectEnd: { type: Function as PropType<(...args: any[]) => any> },
    statusBadge: { type: null as unknown as PropType<any> },
  },

  emits: ['configure', 'delete', 'select', 'connect-start', 'connect-end'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': `${title} node`,
        'aria-roledescription': 'workflow node',
        'aria-grabbed': state.value === 'dragging' || undefined,
        'aria-selected': isSelected || undefined,
        'aria-busy': props.executionStatus === 'running' || undefined,
        'data-surface-widget': '',
        'data-widget-name': 'workflow-node',
        'data-state': state.value,
        'data-execution': props.executionStatus,
        'data-node-type': props.nodeType,
        'data-id': props.id,
        'data-disabled': props.disabled ? 'true' : 'false',
        'tabindex': 0,
        'style': {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
      },
        'onClick': () => { send({ type: 'SELECT' }); props.onSelect?.(props.id); },
        'onDoubleClick': () => { send({ type: 'CONFIGURE' }); props.onConfigure?.(props.id); },
        'onPointerDown': () => send({ type: 'DRAG_START' }),
        'onPointerEnter': () => send({ type: 'HOVER' }),
        'onPointerLeave': () => send({ type: 'UNHOVER' }),
        'onKeyDown': handleKeyDown,
      }, [
        h('div', { 'data-part': 'header', 'data-execution': props.executionStatus }, [
          props.icon ? h('span', {
              'data-part': 'icon',
              'data-type': props.nodeType,
              'aria-hidden': 'true',
            }, [
              props.icon,
            ]) : null,
          h('span', { 'data-part': 'title' }, [
            props.title,
          ]),
          h('span', {
            'data-part': 'status-badge',
            'data-status': props.executionStatus,
            'role': 'status',
            'aria-label': `Status: ${executionStatus}`,
            'aria-live': 'polite',
          }, [
            props.statusBadge ?? props.executionStatus,
          ]),
        ]),
        props.inputPortDefs.length > 0 ? h('div', {
            'data-part': 'input-ports',
            'role': 'group',
            'aria-label': 'Input ports',
          }, [
            ...props.inputPortDefs.map((port) => h('div', {
                'data-part': 'input-port',
                'data-port-name': port.name,
                'data-port-type': port.type,
                'data-required': port.required ? 'true' : 'false',
                'data-connected': port.connected ? 'true' : 'false',
                'role': 'button',
                'aria-label': `Input: ${port.name} (${port.type})`,
                'aria-roledescription': 'connection port',
                'tabindex': -1,
                'onPointerDown': () => props.onConnectStart?.(props.id, port.name, 'input'),
                'onPointerUp': () => props.onConnectEnd?.(props.id, port.name, 'input'),
              })),
          ]) : null,
        props.outputPortDefs.length > 0 ? h('div', {
            'data-part': 'output-ports',
            'role': 'group',
            'aria-label': 'Output ports',
          }, [
            ...props.outputPortDefs.map((port) => h('div', {
                'data-part': 'output-port',
                'data-port-name': port.name,
                'data-port-type': port.type,
                'data-connected': port.connected ? 'true' : 'false',
                'role': 'button',
                'aria-label': `Output: ${port.name} (${port.type})`,
                'aria-roledescription': 'connection port',
                'tabindex': -1,
                'onPointerDown': () => props.onConnectStart?.(props.id, port.name, 'output'),
                'onPointerUp': () => props.onConnectEnd?.(props.id, port.name, 'output'),
              })),
          ]) : null,
        props.configSummary ? h('div', {
            'data-part': 'body',
            'data-visible': 'true',
            'role': 'region',
            'aria-label': 'Configuration preview',
          }, [
            props.configSummary,
          ]) : null,
        slots.default?.(),
      ]);
  },
});

export default WorkflowNode;