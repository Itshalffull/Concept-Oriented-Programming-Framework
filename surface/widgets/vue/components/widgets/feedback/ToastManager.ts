// ============================================================
// ToastManager -- Vue 3 Component
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

export interface ToastItem {
  id: string;
  content: VNode | string;
}

export interface ToastManagerProps {
  /** Viewport edge placement for the toast stack. */
  placement?: string;
  /** Maximum number of visible toasts. */
  max?: number;
  /** Gap in px between stacked toasts. */
  gap?: number;
  /** Initial list of toasts. */
  toasts?: ToastItem[];
  /** Callback invoked when a toast is dismissed. */
  onToastDismiss?: (id: string) => void;
  /** Render function for each toast item. */
  renderToast?: (item: ToastItem, onDismiss: () => void) => VNode | string;
}

export const ToastManager = defineComponent({
  name: 'ToastManager',

  props: {
    placement: { type: String, default: 'bottom-right' },
    max: { type: Number, default: 5 },
    gap: { type: Number, default: 8 },
    toasts: { type: Array as PropType<any[]> },
    onToastDismiss: { type: Function as PropType<(...args: any[]) => any> },
    renderToast: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['toast-dismiss'],

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-live': 'polite',
        'aria-relevant': 'additions',
        'aria-label': 'Notifications',
        'data-part': 'root',
        'data-state': machineState,
        'data-placement': props.placement,
        'data-surface-widget': '',
        'data-widget-name': 'toast-manager',
        'style': { props.gap },
      }, [
        h('div', {
          'data-part': 'list',
          'data-placement': props.placement,
          'data-count': visibleToasts.length,
          'style': { display: 'flex', flexDirection: 'column', props.gap },
        }, [
          ...visibleToasts.map((item, index) => h('div', { 'data-part': 'item', 'data-index': index }, [
              props.renderToast
              ? props.renderToast(item, () => handleDismiss(item.id))
              : item.content,
            ])),
        ]),
      ]);
  },
});

export default ToastManager;