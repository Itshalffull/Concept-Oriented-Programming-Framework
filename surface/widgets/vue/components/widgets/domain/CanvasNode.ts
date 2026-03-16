// ============================================================
// CanvasNode -- Vue 3 Component
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

export interface CanvasNodeProps {
  /** Node ID. */
  id: string;
  /** Node type. */
  type?: 'sticky' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'frame';
  /** Position on canvas. */
  position?: { x: number; y: number };
  /** Node dimensions. */
  size?: { width: number; height: number };
  /** Optional text label. */
  label?: string;
  /** Fill color. */
  color?: string;
  /** Border color. */
  borderColor?: string;
  /** Border width. */
  borderWidth?: number;
  /** Rotation in degrees. */
  rotation?: number;
  /** Lock interactions. */
  locked?: boolean;
  /** Visibility. */
  visible?: boolean;
  /** Opacity. */
  opacity?: number;
  /** Z-index. */
  zIndex?: number;
  /** Called on selection. */
  onSelect?: (id: string) => void;
  /** Called on edit. */
  onEdit?: (id: string) => void;
  /** Called on delete. */
  onDelete?: (id: string) => void;
  /** Called on label change. */
  onLabelChange?: (id: string, value: string) => void;
  /** Called on drag. */
  onDragStart?: (id: string) => void;
  /** Resize handles slot. */
  handles?: VNode | string;
}

export const CanvasNode = defineComponent({
  name: 'CanvasNode',

  props: {
    id: { type: String, required: true as const },
    type: { type: String, default: 'rectangle' },
    position: { type: Object as PropType<any>, default: () => ({ x: 0, y: 0 }) },
    size: { type: Object as PropType<any>, default: () => ({ width: 200, height: 200 }) },
    label: { type: String },
    color: { type: String, default: '#ffffff' },
    borderColor: { type: String, default: '#000000' },
    borderWidth: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    opacity: { type: Number, default: 1 },
    zIndex: { type: Number, default: 0 },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    onEdit: { type: Function as PropType<(...args: any[]) => any> },
    onDelete: { type: Function as PropType<(...args: any[]) => any> },
    onLabelChange: { type: Function as PropType<(...args: any[]) => any> },
    onDragStart: { type: Function as PropType<(...args: any[]) => any> },
    handles: { type: null as unknown as PropType<any> },
  },

  emits: ['edit', 'delete', 'select', 'drag-start', 'label-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };

    if (!props.visible) return () => null as unknown as VNode;
    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': `${type} node${label ? `: ${props.label}` : ''}`,
        'aria-roledescription': 'canvas node',
        'aria-grabbed': state.value === 'dragging' || undefined,
        'aria-selected': isSelected || undefined,
        'data-surface-widget': '',
        'data-widget-name': 'canvas-node',
        'data-type': props.type,
        'data-state': state.value,
        'data-id': props.id,
        'data-locked': props.locked ? 'true' : 'false',
        'data-visible': 'true',
        'tabindex': 0,
        'style': {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: props.rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        opacity: props.opacity,
        zIndex: props.zIndex,
      },
        'onClick': () => { send({ type: 'SELECT' }); props.onSelect?.(props.id); },
        'onDoubleClick': () => { send({ type: 'EDIT' }); props.onEdit?.(props.id); },
        'onPointerDown': () => { if (!props.locked) { send({ type: 'DRAG_START' }); props.onDragStart?.(props.id); } },
        'onPointerEnter': () => send({ type: 'HOVER' }),
        'onPointerLeave': () => send({ type: 'UNHOVER' }),
        'onKeyDown': handleKeyDown,
      }, [
        h('div', {
          'data-part': 'content',
          'data-type': props.type,
          'style': {
          backgroundColor: props.color,
          borderColor: props.borderColor,
          borderWidth: `${borderWidth}px`,
          borderStyle: 'solid',
        },
        }, slots.default?.()),
        showHandles ? h('div', {
            'data-part': 'handles',
            'data-visible': 'true',
            'aria-hidden': !showHandles || undefined,
          }, [
            ...props.handles ?? HANDLE_POSITIONS.map((pos) => h('div', {
                'data-part': 'handle',
                'data-props': true,
                'position': pos,
                'onPointerDown': (e) => { e.stopPropagation(); send({ type: 'RESIZE_START' }); },
                'onPointerUp': () => send({ type: 'RESIZE_END' }),
              })),
          ]) : null,
        props.label !== undefined ? h('span', {
            'data-part': 'label',
            'data-visible': 'true',
            'contenteditable': state.value === 'editing' && !props.locked,
            'suppressContentEditableWarning': true,
            'onInput': (e) => props.onLabelChange?.(props.id, (e.target as HTMLElement).textContent ?? ''),
            'onBlur': () => send({ type: 'BLUR' }),
            'onKeyDown': (e) => {
            if (e.key === 'Enter') { e.preventDefault(); send({ type: 'CONFIRM' }); }
            if (e.key === 'Escape') { e.preventDefault(); send({ type: 'ESCAPE' }); }
          },
          }, [
            props.label,
          ]) : null,
      ]);
  },
});

export default CanvasNode;