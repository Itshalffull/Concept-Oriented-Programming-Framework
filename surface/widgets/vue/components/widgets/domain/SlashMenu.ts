// ============================================================
// SlashMenu -- Vue 3 Component
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

export interface BlockTypeDef {
  label: string;
  description: string;
  icon: string;
  group: string;
}

export interface SlashMenuProps {
  /** Available block types. */
  blockTypes: BlockTypeDef[];
  /** Whether the menu is open. */
  open?: boolean;
  /** Maximum visible items before scroll. */
  maxVisible?: number;
  /** Position for the floating menu. */
  position?: { x: number; y: number };
  /** Called when a block type is selected. */
  onSelect?: (type: BlockTypeDef) => void;
  /** Called when the menu closes. */
  onClose?: () => void;
}

export const SlashMenu = defineComponent({
  name: 'SlashMenu',

  props: {
    blockTypes: { type: Array as PropType<any[]>, required: true as const },
    open: { type: Boolean, default: false },
    maxVisible: { type: Number, default: 10 },
    position: { type: Object as PropType<any> },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    onClose: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['select', 'close'],

  setup(props, { slots, emit }) {
    const state = ref<any>(props.open ? 'open' : 'closed');
    const send = (action: any) => { /* state machine dispatch */ };
    const filterValue = ref<any>('');
    const setFilterValue = (v: any) => { filterValue.value = typeof v === 'function' ? v(filterValue.value) : v; };
    const highlightIndex = ref<any>(0);
    const setHighlightIndex = (v: any) => { highlightIndex.value = typeof v === 'function' ? v(highlightIndex.value) : v; };
    const inputRef = ref<any>(null);

    if (!isVisible) return () => null as unknown as VNode;
    if (groupItems.length === 0) return () => null as unknown as VNode;
    return (): VNode =>
      h('div', {
        'role': 'option',
        'aria-selected': globalIdx === highlightIndex,
        'aria-label': bt.label,
        'data-part': 'item',
        'data-highlighted': globalIdx === highlightIndex ? 'true' : 'false',
        'data-type': bt.label,
        'data-group': bt.group,
        'onClick': () => handleSelect(bt),
        'onPointerEnter': () => setHighlightIndex(globalIdx),
      }, [
        h('span', {
          'aria-hidden': 'true',
          'data-part': 'item-icon',
          'data-type': bt.label,
        }, [
          bt.icon,
        ]),
        h('span', { 'data-part': 'item-label' }, [
          bt.label,
        ]),
        h('span', { 'data-part': 'item-description' }, [
          bt.description,
        ]),
      ]);
  },
});

export default SlashMenu;