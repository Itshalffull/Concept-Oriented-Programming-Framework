// ============================================================
// ColorLabelPicker -- Vue 3 Component
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

export interface LabelDef {
  name: string;
  color: string;
}

export interface ColorLabelPickerProps {
  /** Available labels. */
  labels: LabelDef[];
  /** Currently selected label names. */
  selectedLabels?: string[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Allow multiple selections. */
  multiSelect?: boolean;
  /** Allow creating new labels. */
  allowCreate?: boolean;
  /** Maximum number of selections. */
  maxSelected?: number;
  /** Whether read-only. */
  readOnly?: boolean;
  /** Called when selection changes. */
  onSelectionChange?: (selected: string[]) => void;
  /** Called when a new label is created. */
  onCreate?: (name: string) => void;
  /** Trigger content. */
  trigger?: VNode | string;
}

export const ColorLabelPicker = defineComponent({
  name: 'ColorLabelPicker',

  props: {
    labels: { type: Array as PropType<any[]>, required: true as const },
    selectedLabels: { type: Array as PropType<any[]>, default: () => ([]) },
    ariaLabel: { type: String, default: 'Labels' },
    multiSelect: { type: Boolean, default: true },
    allowCreate: { type: Boolean, default: false },
    maxSelected: { type: Number },
    readOnly: { type: Boolean, default: false },
    onSelectionChange: { type: Array as PropType<any[]> },
    onCreate: { type: Function as PropType<(...args: any[]) => any> },
    trigger: { type: null as unknown as PropType<any> },
  },

  emits: ['selection-change', 'create'],

  setup(props, { slots, emit }) {
    const state = ref<any>('closed');
    const send = (action: any) => { /* state machine dispatch */ };
    const filterValue = ref<any>('');
    const setFilterValue = (v: any) => { filterValue.value = typeof v === 'function' ? v(filterValue.value) : v; };
    const selected = ref<any>(props.selectedLabels);
    const setSelected = (v: any) => { selected.value = typeof v === 'function' ? v(selected.value) : v; };
    const searchRef = ref<any>(null);
    const toggleLabel = (name: string) => {
        setSelected((prev) => {
          const isSelected = prev.includes(name);
          let next: string[];
          if (isSelected) {
            next = prev.filter((n) => n !== name);
            send({ type: 'DESELECT', name });
          } else {
            if (props.maxSelected && prev.length >= props.maxSelected) return prev;
            next = props.multiSelect ? [...prev, name] : [name];
            send({ type: 'SELECT', name });
          }
          props.onSelectionChange?.(next);
          if (!props.multiSelect && !isSelected) {
            send({ type: 'CLOSE' });
          }
          return next;
        });
      };

    const handleFilter = (value: string) => {
        setFilterValue(value);
        const matches = props.labels.filter((l) =>
          l.name.toLowerCase().includes(value.toLowerCase()),
        );
        if (matches.length === 0) {
          send({ type: 'FILTER_EMPTY' });
        } else {
          send({ type: 'FILTER', value });
        }
      };

    const handleCreate = () => {
      if (!filterValue.trim()) return;
      props.onCreate?.(filterValue.trim());
      send({ type: 'CREATE', name: filterValue.trim() });
      setFilterValue('');
    };
    const isOpen = state.value === 'open' || state.value === 'empty';
    onMounted(() => {
      setSelected(props.selectedLabels);
    });
    onMounted(() => {
      if (isOpen && searchRef.value) {
      searchRef.value.focus();
      }
    });

    return (): VNode =>
      h('div', {
        'role': 'option',
        'aria-selected': isSelected,
        'data-part': 'option',
        'data-label': label.name,
        'data-color': label.color,
        'data-selected': isSelected ? 'true' : 'false',
        'onClick': () => toggleLabel(label.name),
      }, [
        h('span', {
          'data-part': 'color-swatch',
          'style': { backgroundColor: label.color },
          'aria-hidden': 'true',
        }),
        h('span', { 'data-part': 'option-label' }, [
          label.name,
        ]),
      ]);
  },
});

export default ColorLabelPicker;