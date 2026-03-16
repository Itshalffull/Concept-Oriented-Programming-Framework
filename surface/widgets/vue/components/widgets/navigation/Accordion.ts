// ============================================================
// Accordion -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface AccordionItem {
  value: string;
  trigger: VNode | string;
  content: VNode | string;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  value?: string[];
  defaultValue?: string[];
  multiple?: boolean;
  collapsible?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string[]) => void;
  variant?: string;
  size?: string;
}

export const Accordion = defineComponent({
  name: 'Accordion',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    value: { type: Array as PropType<any[]> },
    defaultValue: { type: Array as PropType<any[]>, default: () => ([]) },
    multiple: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    onValueChange: { type: Array as PropType<any[]> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['value-change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const internalState = ref<any>({ expandedItems: props.defaultValue, });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleToggle = (itemValue: string) => {
        if (props.disabled) return;
        if (!isControlled) {
          dispatch({ type: 'TOGGLE', value: itemValue, multiple: props.multiple, collapsible: props.collapsible });
        }
        const isExpanded = expandedItems.includes(itemValue);
        let next: string[];
        if (isExpanded) {
          if (!props.collapsible && expandedItems.length === 1) return;
          next = expandedItems.filter((v) => v !== itemValue);
        } else {
          next = props.multiple ? [...expandedItems, itemValue] : [itemValue];
        }
        props.onValueChange?.(next);
      };
    const handleKeyDown = (e: any, index: number) => {
        const triggers = props.items.filter((it) => !it.disabled);
        const count = triggers.length;
        let targetIndex = -1;

        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            handleToggle(props.items[index].value);
            return;
          case 'ArrowDown':
            e.preventDefault();
            targetIndex = (index + 1) % count;
            break;
          case 'ArrowUp':
            e.preventDefault();
            targetIndex = (index - 1 + count) % count;
            break;
          case 'Home':
            e.preventDefault();
            targetIndex = 0;
            break;
          case 'End':
            e.preventDefault();
            targetIndex = count - 1;
            break;
          default:
            return;
        }

        const triggerId = `accordion-trigger-${id}-${targetIndex}`;
        document.getElementById(triggerId)?.focus();
      };
    const isControlled = props.value !== undefined;
    const expandedItems = isControlled ? value : internalState.value.expandedItems;

    return (): VNode =>
      h('div', {
        'data-part': 'item',
        'data-state': itemState,
        'data-disabled': isItemDisabled ? 'true' : 'false',
      }, [
        h('button', {
          'id': triggerId,
          'type': 'button',
          'role': 'button',
          'aria-expanded': isExpanded,
          'aria-controls': contentId,
          'data-part': 'trigger',
          'data-state': itemState,
          'data-disabled': isItemDisabled ? 'true' : 'false',
          'disabled': isItemDisabled,
          'tabindex': isItemDisabled ? -1 : 0,
          'onClick': () => handleToggle(item.value),
          'onKeyDown': (e) => handleKeyDown(e, index),
        }, [
          h('span', {
            'data-part': 'indicator',
            'data-state': itemState,
            'aria-hidden': 'true',
          }),
          item.trigger,
        ]),
        h('div', {
          'id': contentId,
          'role': 'region',
          'aria-labelledby': triggerId,
          'data-part': 'content',
          'data-state': itemState,
          'hidden': !isExpanded,
        }, [
          item.content,
        ]),
      ]);
  },
});

export default Accordion;