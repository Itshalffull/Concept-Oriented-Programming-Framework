// ============================================================
// List -- Vue 3 Component
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

export interface ListItem {
  id: string;
  label: string;
  description?: string;
  icon?: VNode | string;
  action?: { label: string; onClick: () => void };
}

export interface ListProps {
  items: ListItem[];
  selectable?: boolean;
  multiSelect?: boolean;
  dividers?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onDeselect?: (id: string) => void;
  onItemAction?: (id: string) => void;
}

export const List = defineComponent({
  name: 'List',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    selectable: { type: Boolean, default: false },
    multiSelect: { type: Boolean, default: false },
    dividers: { type: Boolean, default: true },
    ariaLabel: { type: String },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    selectedIds: { type: Array as PropType<any[]> },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    onDeselect: { type: Function as PropType<(...args: any[]) => any> },
    onItemAction: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['deselect', 'select', 'item-action'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ focusedIndex: 0, selectedIds: new Set(props.selectedIds ?? []), });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const itemRefs = ref<any>([]);
    const handleItemSelect = (id: string) => {
        if (!props.selectable || props.disabled) return;
        dispatch({ type: 'SELECT', id });
        if (selectedSet.has(id)) {
          props.onDeselect?.(id);
        } else {
          props.onSelect?.(id);
        }
      };
    const handleKeyDown = (e: any, index: number) => {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_PREV' });
            itemRefs.value[Math.max(0, index - 1)]?.focus();
            break;
          case 'ArrowDown':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_NEXT' });
            itemRefs.value[Math.min(props.items.length - 1, index + 1)]?.focus();
            break;
          case 'Home':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_FIRST' });
            itemRefs.value[0]?.focus();
            break;
          case 'End':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_LAST' });
            itemRefs.value[props.items.length - 1]?.focus();
            break;
          case 'Enter':
          case ' ':
            if (props.selectable) {
              e.preventDefault();
              handleItemSelect(props.items[index].id);
            }
            break;
        }
      };
    const reducer = createListReducer(props.items.length, props.multiSelect);

    return (): VNode =>
      h('div', {}, [
        h('div', {
          'ref': (el) => { itemRefs.value[index] = el; },
          'role': props.selectable ? 'option' : 'listitem',
          'aria-selected': props.selectable ? (isSelected ? 'true' : 'false') : undefined,
          'aria-disabled': props.disabled ? 'true' : 'false',
          'tabindex': isFocused ? 0 : -1,
          'data-state': isSelected ? 'selected' : isFocused ? 'focused' : 'idle',
          'onClick': () => handleItemSelect(item.id),
          'onKeyDown': (e) => handleKeyDown(e, index),
          'onMouseEnter': () => dispatch({ type: 'FOCUS', index }),
          'onFocus': () => dispatch({ type: 'FOCUS', index }),
          'onBlur': () => dispatch({ type: 'BLUR' }),
        }, [
          item.icon ? h('span', { 'data-part': 'item-icon', 'aria-hidden': 'true' }, [
              item.icon,
            ]) : null,
          h('span', { 'id': labelId, 'data-part': 'item-label' }, [
            item.label,
          ]),
          item.description ? h('span', { 'id': descId, 'data-part': 'item-description' }, [
              item.description,
            ]) : null,
          item.action ? h('button', {
              'type': 'button',
              'data-part': 'item-action',
              'role': 'button',
              'tabindex': 0,
              'aria-label': item.action.label,
              'onClick': (e) => {
                      e.stopPropagation();
                      item.action!.onClick();
                      props.onItemAction?.(item.id);
                    },
            }, [
              item.action.label,
            ]) : null,
        ]),
        props.dividers && index < props.items.length - 1 ? h('div', {
            'role': 'separator',
            'aria-hidden': 'true',
            'data-part': 'divider',
            'data-visible': 'true',
          }) : null,
      ]);
  },
});

export default List;