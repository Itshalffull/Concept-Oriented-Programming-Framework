// ============================================================
// Splitter -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

export interface SplitterProps {
  orientation?: 'horizontal' | 'vertical';
  defaultSize?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onSizeChange?: (size: number) => void;
  panelBefore?: VNode | string;
  panelAfter?: VNode | string;
  variant?: string;
  size?: string;
}

export const Splitter = defineComponent({
  name: 'Splitter',

  props: {
    orientation: { type: String, default: 'horizontal' },
    defaultSize: { type: Number, default: 50 },
    min: { type: Number, default: 10 },
    max: { type: Number, default: 90 },
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    onSizeChange: { type: Function as PropType<(...args: any[]) => any> },
    panelBefore: { type: null as unknown as PropType<any> },
    panelAfter: { type: null as unknown as PropType<any> },
    variant: { type: String },
    size: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['size-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ interaction: 'idle', panelSize: props.defaultSize, });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const rootRef = ref<any>(null);
    const prevSizeRef = ref<any>(state.value.panelSize);
    const handlePointerDown = (e: any) => {
        if (props.disabled) return;
        e.preventDefault();
        dispatch({ type: 'DRAG_START' });
      };
    const handleKeyDown = (e: any) => {
        if (props.disabled) return;

        const decrementKeys = props.orientation === 'horizontal' ? ['ArrowLeft'] : ['ArrowUp'];
        const incrementKeys = props.orientation === 'horizontal' ? ['ArrowRight'] : ['ArrowDown'];

        if (incrementKeys.includes(e.key)) {
          e.preventDefault();
          dispatch({ type: 'RESIZE_INCREMENT', step: props.step, max: props.max });
        } else if (decrementKeys.includes(e.key)) {
          e.preventDefault();
          dispatch({ type: 'RESIZE_DECREMENT', step: props.step, min: props.min });
        } else if (e.key === 'Home') {
          e.preventDefault();
          dispatch({ type: 'RESIZE_MIN', min: props.min });
        } else if (e.key === 'End') {
          e.preventDefault();
          dispatch({ type: 'RESIZE_MAX', max: props.max });
        }
      };
    const isDragging = state.value.interaction === 'dragging';
    const cursor = props.orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    onMounted(() => {
      if (prevSizeRef.value !== state.value.panelSize) {
      prevSizeRef.value = state.value.panelSize;
      props.onSizeChange?.(state.value.panelSize);
      }
    });
    onMounted(() => {
      if (!isDragging || props.disabled) return;
      
      const handlePointerMove = (e: PointerEvent) => {
      const root = rootRef.value;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      
      let ratio: number;
      if (props.orientation === 'horizontal') {
      ratio = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
      ratio = ((e.clientY - rect.top) / rect.height) * 100;
      }
      const clamped = Math.max(props.min, Math.min(props.max, ratio));
      dispatch({ type: 'DRAG_MOVE', panelSize: Math.round(clamped * 100) / 100 });
      };
      
      const handlePointerUp = () => {
      dispatch({ type: 'DRAG_END' });
      };
      
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    });
    onUnmounted(() => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    });

    return (): VNode =>
      h('div', {
        'ref': (node) => {
          rootRef.value = node;
        },
        'data-surface-widget': '',
        'data-widget-name': 'splitter',
        'data-part': 'root',
        'data-orientation': props.orientation,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-state': state.value.interaction,
        'data-variant': props.variant,
        'data-size': props.size,
        'style': {
          display: 'flex',
          flexDirection: props.orientation === 'horizontal' ? 'row' : 'column',
        },
      }, [
        h('div', {
          'data-part': 'panel-before',
          'data-orientation': props.orientation,
          'style': {
            flexBasis: `${state.value.panelSize}%`,
            minWidth: props.orientation === 'horizontal' ? `${min}%` : undefined,
            minHeight: props.orientation === 'vertical' ? `${min}%` : undefined,
            overflow: 'auto',
          },
        }, [
          props.panelBefore,
        ]),
        h('div', {
          'role': 'separator',
          'aria-orientation': props.orientation,
          'aria-valuenow': Math.round(state.value.panelSize),
          'aria-valuemin': props.min,
          'aria-valuemax': props.max,
          'aria-label': 'Resize',
          'tabindex': props.disabled ? -1 : 0,
          'data-part': 'handle',
          'data-orientation': props.orientation,
          'data-state': state.value.interaction,
          'data-disabled': props.disabled ? 'true' : 'false',
          'style': { cursor },
          'onPointerDown': handlePointerDown,
          'onKeyDown': handleKeyDown,
          'onFocus': () => dispatch({ type: 'FOCUS' }),
          'onBlur': () => dispatch({ type: 'BLUR' }),
        }),
        h('div', {
          'data-part': 'panel-after',
          'data-orientation': props.orientation,
          'style': {
            flexBasis: `${100 - state.value.panelSize}%`,
            maxWidth: props.orientation === 'horizontal' ? `${max}%` : undefined,
            maxHeight: props.orientation === 'vertical' ? `${max}%` : undefined,
            overflow: 'auto',
          },
        }, [
          props.panelAfter,
        ]),
      ]);
  },
});

export default Splitter;