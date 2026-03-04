// ============================================================
// TreeSelect -- Vue 3 Component
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

export interface TreeSelectProps {
  /** Tree data. */
  items: TreeNode[];
  /** Enable selection checkboxes. */
  selectable?: boolean;
  /** Allow multiple selection. */
  multiSelect?: boolean;
  /** IDs of initially expanded nodes. */
  defaultExpanded?: string[];
  /** Accessible label. */
  label?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Controlled selected IDs. */
  value?: string[];
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when selection changes. */
  onChange?: (selectedIds: string[]) => void;
}

export const TreeSelect = defineComponent({
  name: 'TreeSelect',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    selectable: { type: Boolean, default: true },
    multiSelect: { type: Boolean, default: true },
    defaultExpanded: { type: Array as PropType<any[]>, default: () => ([]) },
    label: { type: String, default: 'Tree' },
    disabled: { type: Boolean, default: false },
    value: { type: Array as PropType<any[]> },
    size: { type: String, default: 'md' },
    onChange: { type: Array as PropType<any[]> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const machine = ref<any>({ expandedIds: new Set(props.defaultExpanded), checkedIds: new Set(props.value ?? []), focusedId: null, });
    const send = (action: any) => { /* state machine dispatch */ };
    const hasChildren = !!(node.slots.default?.() && node.slots.default?.().length > 0);
    const isExpanded = machine.value.expandedIds.has(node.id);
    const isFocused = machine.value.focusedId === node.id;
    const selState = props.selectable ? getSelectionState(node) : 'unchecked';
    const isChecked = selState === 'checked';
    const isIndeterminate = selState === 'indeterminate';

    return (): VNode =>
      h('div', {
        'role': 'tree',
        'aria-label': props.label,
        'aria-multiselectable': props.multiSelect ? 'true' : 'false',
        'data-part': 'root',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'tree-select',
      }, [
        ...props.items.map((item, idx) => renderItem(item, 0, props.items, idx)),
      ]);
  },
});

export default TreeSelect;