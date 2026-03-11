// ============================================================
// CommandPalette -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface CommandItem {
  id: string;
  label: string;
  icon?: VNode | string;
  shortcut?: string;
  group?: string;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  open?: boolean;
  defaultOpen?: boolean;
  items: CommandItem[];
  placeholder?: string;
  emptyMessage?: string;
  closeOnSelect?: boolean;
  loop?: boolean;
  onOpenChange?: (open: boolean) => void;
  onQueryChange?: (query: string) => void;
  filterFn?: (item: CommandItem, query: string) => boolean;
  footer?: VNode | string;
  variant?: string;
  size?: string;
}

export const CommandPalette = defineComponent({
  name: 'CommandPalette',

  props: {
    open: { type: Boolean },
    defaultOpen: { type: Boolean, default: false },
    items: { type: Array as PropType<any[]>, required: true as const },
    placeholder: { type: String, default: 'Type a command...' },
    emptyMessage: { type: String, default: 'No results found.' },
    closeOnSelect: { type: Boolean, default: true },
    loop: { type: Boolean, default: true },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    onQueryChange: { type: Function as PropType<(...args: any[]) => any> },
    filterFn: { type: Function as PropType<(...args: any[]) => any>, default: defaultFilter },
    footer: { type: null as unknown as PropType<any> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['open-change', 'select', 'query-change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ visibility: props.defaultOpen ? 'open' : 'closed', query: '', highlightedIndex: 0, });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const inputRef = ref<any>(null);
    const handleClose = () => {
      if (!isControlled) dispatch({ type: 'CLOSE' });
      props.onOpenChange?.(false);
    };
    const handleSelect = (item: CommandItem) => {
        item.onSelect?.();
        if (props.closeOnSelect) {
          handleClose();
        }
      };
    const handleInputChange = (e: any) => {
        const query = e.target.value;
        dispatch({ type: 'INPUT', query });
        props.onQueryChange?.(query);
      };
    const inputId = `cmd-input-${id}`;
    const listId = `cmd-list-${id}`;
    const isControlled = props.open !== undefined;
    const isOpen = isControlled ? controlledOpen : state.value.visibility === 'open';
    const hasResults = filteredItems.length > 0;
    const resultsState = !state.value.query ? 'empty' : hasResults ? 'hasResults' : 'noResults';
    const groups = new Map<string, CommandItem[]>();
    const flatFiltered = filteredItems.filter((item) => !item.disabled);
    const highlightedItem = flatFiltered[state.value.highlightedIndex];
    onMounted(() => {
      if (isOpen) {
      requestAnimationFrame(() => inputRef.value?.focus());
      }
    });
    onMounted(() => {
      const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (!isControlled) dispatch({ type: 'OPEN' });
      props.onOpenChange?.(true);
      }
      };
      document.addEventListener('keydown', handler);
    });
    onUnmounted(() => {
      document.removeEventListener('keydown', handler)
    });

    if (!isOpen) return () => null as unknown as VNode;
    return (): VNode =>
      h('div', {
        'id': `cmd-item-${id}-${item.id}`,
        'role': 'option',
        'aria-selected': isHighlighted ? 'true' : 'false',
        'data-part': 'item',
        'data-highlighted': isHighlighted ? 'true' : 'false',
        'tabindex': -1,
        'onClick': () => {
                    if (!item.disabled) handleSelect(item);
                  },
        'onPointerEnter': () =>
                    dispatch({ type: 'HIGHLIGHT', index: currentIndex }),
      }, [
        item.icon ? h('span', { 'aria-hidden': 'true', 'data-part': 'item-icon' }, [
            item.icon,
          ]) : null,
        h('span', { 'data-part': 'item-label' }, [
          item.label,
        ]),
        item.shortcut ? h('span', { 'aria-hidden': 'true', 'data-part': 'item-shortcut' }, [
            item.shortcut,
          ]) : null,
      ]);
  },
});

export default CommandPalette;