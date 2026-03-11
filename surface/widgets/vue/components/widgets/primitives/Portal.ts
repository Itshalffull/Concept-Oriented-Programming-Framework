// ============================================================
// Portal -- Vue 3 Component
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
  Teleport,
} from 'vue';

export interface PortalProps {
  target?: string;
  disabled?: boolean;
}

export const Portal = defineComponent({
  name: 'Portal',

  props: {
    target: { type: String },
    disabled: { type: Boolean, default: false },
  },

  setup(props, { slots, emit }) {
    const mounted = ref<any>(false);
    const setMounted = (v: any) => { mounted.value = typeof v === 'function' ? v(mounted.value) : v; };
    const container = ref<any>(null);
    const setContainer = (v: any) => { container.value = typeof v === 'function' ? v(container.value) : v; };
    onMounted(() => {
      setMounted(true);
      if (props.target) {
      const el = document.querySelector(props.target);
      setContainer(el || document.body);
      } else {
      setContainer(document.body);
      }
    });
    onUnmounted(() => {
      setMounted(false)
    });

    return (): VNode =>
      h(Teleport as any, { to: 'body' }, [
        h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'portal',
        'data-part': 'root',
        'data-portal': 'true',
        'data-target': props.target,
        'data-state': 'mounted',
        'data-disabled': 'false',
      }, slots.default?.())
      ]);
  },
});

export default Portal;