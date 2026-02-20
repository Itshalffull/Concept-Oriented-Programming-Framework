// ============================================================
// SlotOutlet — Vue 3 Component
//
// Named slot with default content fallback. Wraps the Vue
// slot mechanism with COIF slot configuration, providing
// scoped data to the slot consumer and rendering fallback
// content when no slot content is provided.
// ============================================================

import {
  defineComponent,
  h,
  computed,
  useSlots,
  type PropType,
  type VNode,
} from 'vue';

import type { SlotConfig } from '../../shared/types.js';

export const SlotOutlet = defineComponent({
  name: 'SlotOutlet',

  props: {
    /** Slot configuration describing name, defaults, and scope */
    config: {
      type: Object as PropType<SlotConfig>,
      required: true,
    },
    /** HTML wrapper tag (null renders fragment-like) */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
    /** Additional scope data merged with config.scope */
    extraScope: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({}),
    },
  },

  setup(props, { slots }) {
    const vueSlots = useSlots();

    // Merge the config scope with any extra scope data
    const mergedScope = computed<Record<string, unknown>>(() => ({
      ...props.config.scope,
      ...props.extraScope,
      slotName: props.config.name,
      component: props.config.component,
    }));

    // Check if the named slot (or default) has been provided
    const hasContent = computed<boolean>(() => {
      const namedSlot = vueSlots[props.config.name];
      return typeof namedSlot === 'function' || typeof slots.default === 'function';
    });

    // Render the default fallback content
    function renderFallback(): VNode | string | null {
      if (props.config.defaultContent != null) {
        if (typeof props.config.defaultContent === 'string') {
          return h('span', { class: 'coif-slot-outlet__default' }, props.config.defaultContent);
        }
        // If defaultContent is a VNode-like object, render as-is
        return props.config.defaultContent as VNode;
      }
      return h(
        'span',
        { class: 'coif-slot-outlet__empty' },
        `[Slot: ${props.config.name}]`,
      );
    }

    return (): VNode => {
      // Try the named slot first, then fall back to default slot, then fallback content
      const namedSlot = vueSlots[props.config.name];
      let content: VNode[] | VNode | string | null;

      if (typeof namedSlot === 'function') {
        content = namedSlot(mergedScope.value);
      } else if (typeof slots.default === 'function') {
        content = slots.default(mergedScope.value);
      } else {
        content = renderFallback();
      }

      return h(
        props.tag,
        {
          class: [
            'coif-slot-outlet',
            `coif-slot-outlet--${props.config.name}`,
            { 'coif-slot-outlet--fallback': !hasContent.value },
          ],
          'data-slot-name': props.config.name,
          'data-slot-component': props.config.component,
        },
        Array.isArray(content) ? content : [content],
      );
    };
  },
});

export default SlotOutlet;
