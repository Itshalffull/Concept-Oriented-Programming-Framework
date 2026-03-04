// ============================================================
// DragHandle -- Vue 3 Component
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

export interface DragHandleProps {
  /** Drag orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Whether the handle is disabled. */
  disabled?: boolean;
  /** Accessible label for the drag handle. */
  ariaLabel?: string;
  /** Index of the draggable item. */
  itemIndex?: number;
  /** Icon content for the grip. */
  icon?: VNode | string;
  /** Callback when a move event occurs. */
  onMove?: (direction: string) => void;
  /** Callback when drag starts. */
  onDragBegin?: () => void;
  /** Callback when drag ends. */
  onDragFinish?: () => void;
}

export const DragHandle = defineComponent({
  name: 'DragHandle',

  props: {
    orientation: { type: String, default: 'vertical' },
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: 'Drag to reorder' },
    itemIndex: { type: Number },
    icon: { type: null as unknown as PropType<any> },
    onMove: { type: Function as PropType<(...args: any[]) => any> },
    onDragBegin: { type: Function as PropType<(...args: any[]) => any> },
    onDragFinish: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['drag-begin', 'pointer-down', 'drag-finish', 'pointer-up', 'pointer-move', 'move', 'key-down'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('button', {
        'type': 'button',
        'role': 'button',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'drag handle',
        'aria-grabbed': isGrabbed,
        'aria-disabled': props.disabled || undefined,
        'tabindex': props.disabled ? -1 : 0,
        'draggable': !props.disabled,
        'data-surface-widget': '',
        'data-widget-name': 'drag-handle',
        'data-part': 'drag-handle',
        'data-state': state.value,
        'data-orientation': props.orientation,
        'onPointerDown': handlePointerDown,
        'onPointerUp': handlePointerUp,
        'onPointerMove': handlePointerMove,
        'onPointerEnter': () => send({ type: 'HOVER' }),
        'onPointerLeave': () => send({ type: 'UNHOVER' }),
        'onFocus': () => send({ type: 'FOCUS' }),
        'onBlur': () => send({ type: 'BLUR' }),
        'onKeyDown': handleKeyDown,
      }, [
        h('span', {
          'data-part': 'icon',
          'data-orientation': props.orientation,
          'aria-hidden': 'true',
        }, [
          props.icon ?? '⠿',
        ]),
      ]);
  },
});

export default DragHandle;