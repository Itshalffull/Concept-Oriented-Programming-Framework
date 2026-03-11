// ============================================================
// FocusTrap -- Vue 3 Component
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

export interface FocusTrapProps {
  active?: boolean;
  initialFocus?: string;
  returnFocus?: boolean;
  loop?: boolean;
}

export const FocusTrap = defineComponent({
  name: 'FocusTrap',

  props: {
    active: { type: Boolean, default: false },
    initialFocus: { type: String },
    returnFocus: { type: Boolean, default: true },
    loop: { type: Boolean, default: true },
  },

  setup(props, { slots, emit }) {
    const rootRef = ref<any>(null);
    const previousFocusRef = ref<any>(null);
    const setRef = (node: HTMLDivElement | null) => {
        rootRef.value = node;
      };
    const handleSentinelStartFocus = () => {
      if (!props.active || !props.loop || !rootRef.value) return;
      // Focus last focusable element
      const focusable = getFocusableElements(rootRef.value);
      if (focusable.length > 0) {
        focusable[focusable.length - 1].focus();
      }
    };
    const handleSentinelEndFocus = () => {
      if (!props.active || !props.loop || !rootRef.value) return;
      // Focus first focusable element
      const focusable = getFocusableElements(rootRef.value);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    };
    onMounted(() => {
      if (!props.active || !rootRef.value) return;
      
      previousFocusRef.value = document.activeElement;
      
      const focusInitial = () => {
      if (props.initialFocus && rootRef.value) {
      const target = rootRef.value.querySelector<HTMLElement>(props.initialFocus);
      if (target) {
      target.focus();
      return;
      }
      }
      // Focus first focusable element
      if (rootRef.value) {
      const focusable = getFocusableElements(rootRef.value);
      if (focusable.length > 0) {
      focusable[0].focus();
      }
      }
      };
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(focusInitial);
    });
    onUnmounted(() => {
      // Restore focus on deactivation
      if (props.returnFocus && previousFocusRef.value instanceof HTMLElement) {
      previousFocusRef.value.focus();
      }
    });

    return (): VNode =>
      h('div', {
        'ref': setRef,
        'data-surface-widget': '',
        'data-widget-name': 'focus-trap',
        'data-part': 'root',
        'data-state': props.active ? 'active' : 'inactive',
        'data-focus-trap': props.active ? 'true' : 'false',
      }, [
        h('span', {
          'data-part': 'sentinel-start',
          'data-focus-sentinel': '',
          'tabindex': props.active ? 0 : -1,
          'aria-hidden': 'true',
          'style': sentinelStyle,
          'onFocus': handleSentinelStartFocus,
        }),
        slots.default?.(),
        h('span', {
          'data-part': 'sentinel-end',
          'data-focus-sentinel': '',
          'tabindex': props.active ? 0 : -1,
          'aria-hidden': 'true',
          'style': sentinelStyle,
          'onFocus': handleSentinelEndFocus,
        }),
      ]);
  },
});

export default FocusTrap;