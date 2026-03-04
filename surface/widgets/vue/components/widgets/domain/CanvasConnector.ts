// ============================================================
// CanvasConnector -- Vue 3 Component
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

export interface CanvasConnectorProps {
  /** Connector ID. */
  id: string;
  /** Source node ID. */
  startNodeId: string;
  /** Target node ID. */
  endNodeId: string;
  /** Source node label. */
  startNodeLabel?: string;
  /** Target node label. */
  endNodeLabel?: string;
  /** Source port. */
  startPort?: string;
  /** Target port. */
  endPort?: string;
  /** Connector label. */
  label?: string;
  /** Line style. */
  lineStyle?: 'straight' | 'curved' | 'step';
  /** Arrow at start. */
  arrowStart?: boolean;
  /** Arrow at end. */
  arrowEnd?: boolean;
  /** Stroke color. */
  color?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Dashed line. */
  dashed?: boolean;
  /** Start coordinates. */
  startPos?: { x: number; y: number };
  /** End coordinates. */
  endPos?: { x: number; y: number };
  /** Called on select. */
  onSelect?: (id: string) => void;
  /** Called on delete. */
  onDelete?: (id: string) => void;
  /** Called on label change. */
  onLabelChange?: (id: string, value: string) => void;
}

export const CanvasConnector = defineComponent({
  name: 'CanvasConnector',

  props: {
    id: { type: String, required: true as const },
    startNodeId: { type: String, required: true as const },
    endNodeId: { type: String, required: true as const },
    startNodeLabel: { type: String, default: '' },
    endNodeLabel: { type: String, default: '' },
    startPort: { type: String },
    endPort: { type: String },
    label: { type: String },
    lineStyle: { type: String, default: 'curved' },
    arrowStart: { type: Boolean, default: false },
    arrowEnd: { type: Boolean, default: true },
    color: { type: String, default: '#000000' },
    strokeWidth: { type: Number, default: 2 },
    dashed: { type: Boolean, default: false },
    startPos: { type: Object as PropType<any>, default: () => ({ x: 0, y: 0 }) },
    endPos: { type: Object as PropType<any>, default: () => ({ x: 100, y: 100 }) },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    onDelete: { type: Function as PropType<(...args: any[]) => any> },
    onLabelChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['delete', 'select', 'label-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('g', {
        'role': 'img',
        'aria-label': ariaLabel,
        'aria-roledescription': 'connector',
        'aria-selected': state.value === 'selected' || undefined,
        'data-surface-widget': '',
        'data-widget-name': 'canvas-connector',
        'data-part': 'connector',
        'data-id': props.id,
        'data-state': state.value,
        'data-start-node': props.startNodeId,
        'data-end-node': props.endNodeId,
        'data-line-style': props.lineStyle,
        'tabindex': 0,
        'onClick': () => { send({ type: 'SELECT' }); props.onSelect?.(props.id); },
        'onDoubleClick': () => send({ type: 'EDIT_LABEL' }),
        'onPointerEnter': () => send({ type: 'HOVER' }),
        'onPointerLeave': () => send({ type: 'UNHOVER' }),
        'onKeyDown': handleKeyDown,
      }, [
        h('path', {
          'data-part': 'path',
          'data-line-style': props.lineStyle,
          'd': d,
          'stroke': props.color,
          'strokeWidth': props.strokeWidth,
          'strokeDasharray': props.dashed ? '8 4' : undefined,
          'fill': 'none',
          'markerStart': props.arrowStart ? 'url(#arrowhead-start)' : undefined,
          'markerEnd': props.arrowEnd ? 'url(#arrowhead-end)' : undefined,
          'aria-hidden': 'true',
        }),
        showHandles ? [
            h('circle', {
              'data-part': 'start-handle',
              'data-visible': 'true',
              'cx': props.startPos.x,
              'cy': props.startPos.y,
              'r': 5,
              'aria-label': `Start handle, connected to ${startNodeLabel}`,
              'aria-grabbed': state.value === 'draggingStart' || undefined,
              'onPointerDown': () => send({ type: 'DRAG_START_HANDLE' }),
              'onPointerUp': () => send({ type: 'DROP' }),
            }),
            h('circle', {
              'data-part': 'end-handle',
              'data-visible': 'true',
              'cx': props.endPos.x,
              'cy': props.endPos.y,
              'r': 5,
              'aria-label': `End handle, connected to ${endNodeLabel}`,
              'aria-grabbed': state.value === 'draggingEnd' || undefined,
              'onPointerDown': () => send({ type: 'DRAG_END_HANDLE' }),
              'onPointerUp': () => send({ type: 'DROP' }),
            }),
          ] : null,
        props.label ? h('foreignObject', {
            'x': midX - 40,
            'y': midY - 10,
            'width': 80,
            'height': 20,
            'data-part': 'label',
            'data-visible': 'true',
            'style': { transform: `translate(${midX}px, ${midY}px)` },
          }, [
            h('span', {
              'contenteditable': state.value === 'editingLabel',
              'suppressContentEditableWarning': true,
              'onInput': (e) => props.onLabelChange?.(props.id, (e.target as HTMLElement).textContent ?? ''),
              'onBlur': () => send({ type: 'BLUR' }),
              'onKeyDown': (e) => {
              if (e.key === 'Enter') { e.preventDefault(); send({ type: 'CONFIRM' }); }
              if (e.key === 'Escape') { e.preventDefault(); send({ type: 'ESCAPE' }); }
            },
            }, [
              props.label,
            ]),
          ]) : null,
      ]);
  },
});

export default CanvasConnector;