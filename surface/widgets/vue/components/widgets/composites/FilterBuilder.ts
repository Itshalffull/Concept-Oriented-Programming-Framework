// ============================================================
// FilterBuilder -- Vue 3 Component
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

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
}

export interface OperatorDef {
  key: string;
  label: string;
  fieldTypes?: string[];
}

export interface FilterGroup {
  id: string;
  logic: 'and' | 'or';
  filters: (FilterRow | FilterGroup)[];
  depth: number;
}

export interface FilterBuilderProps {
  filters?: FilterRow[];
  logic?: 'and' | 'or';
  fields: FieldDef[];
  operators: OperatorDef[];
  maxDepth?: number;
  maxFilters?: number;
  disabled?: boolean;
  allowGroups?: boolean;
  onChange?: (filters: FilterRow[], logic: 'and' | 'or') => void;
}

export const FilterBuilder = defineComponent({
  name: 'FilterBuilder',

  props: {
    filters: { type: Array as PropType<any[]> },
    logic: { type: String, default: 'and' },
    fields: { type: Array as PropType<any[]>, required: true as const },
    operators: { type: Array as PropType<any[]>, required: true as const },
    maxDepth: { type: Number, default: 3 },
    maxFilters: { type: Number, default: 20 },
    disabled: { type: Boolean, default: false },
    allowGroups: { type: Boolean, default: true },
    onChange: { type: Array as PropType<any[]> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>(initialState);
    const send = (action: any) => { /* state machine dispatch */ };
    const handleAdd = () => {
      if (props.disabled || effectiveFilters.length >= props.maxFilters) return;
      send({ type: 'ADD_FILTER' });
      props.onChange?.(
        [...effectiveFilters, { id: nextFilterId(), field: '', operator: '', value: '', logic: effectiveLogic }],
        effectiveLogic,
      );
    };
    const effectiveFilters = props.filters ?? state.filters;
    const effectiveLogic = props.logic ?? state.logic;
    const isRowValid = (row: FilterRow) => Boolean(row.field && row.operator && row.value);

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': 'Filter builder',
        'data-surface-widget': '',
        'data-widget-name': 'filter-builder',
        'data-part': 'root',
        'data-state': effectiveFilters.length === 0 ? 'empty' : 'has-filters',
        'data-logic': effectiveLogic,
        'data-disabled': props.disabled ? 'true' : 'false',
      }, [
        effectiveFilters.map((filter, index) => (
          <div key={filter.id}>
            {index > 0 ? h('button', {
            'type': 'button',
            'data-part': 'logic-toggle',
            'data-logic': filter.logic ?? effectiveLogic,
            'role': 'button',
            'aria-label': 'Toggle logic operator',
            'aria-pressed': (filter.logic ?? effectiveLogic) === 'or' ? 'true' : 'false',
            'disabled': props.disabled,
            'onClick': () => handleToggleLogic(filter.id),
          }, [
            (filter.logic ?? effectiveLogic).toUpperCase(),
          ]) : null,
        h('button', {
          'type': 'button',
          'data-part': 'add-button',
          'aria-label': 'Add filter',
          'disabled': props.disabled || effectiveFilters.length >= props.maxFilters,
          'onClick': handleAdd,
        }, 'Add filter'),
        slots.default?.(),
      ]);
  },
});
});)

export default FilterBuilder;