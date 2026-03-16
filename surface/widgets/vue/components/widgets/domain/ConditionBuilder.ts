// ============================================================
// ConditionBuilder -- Vue 3 Component
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

export interface ConditionRow {
  field?: string;
  operator?: string;
  value?: string;
}

export interface FieldDef {
  name: string;
  type: string;
  operators: string[];
}

export interface ConditionBuilderProps {
  /** Condition rows. */
  conditions: ConditionRow[];
  /** Available fields. */
  fields: FieldDef[];
  /** Logic combinator. */
  logic?: 'and' | 'or';
  /** Accessible label. */
  ariaLabel?: string;
  /** Max rows. */
  maxRows?: number;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Allow nested groups. */
  allowGroups?: boolean;
  /** Called on conditions change. */
  onConditionsChange?: (conditions: ConditionRow[]) => void;
  /** Called on logic change. */
  onLogicChange?: (logic: 'and' | 'or') => void;
  /** Custom field selector renderer. */
  renderFieldSelector?: (index: number, field?: string) => VNode | string;
  /** Custom operator selector renderer. */
  renderOperatorSelector?: (index: number, field?: string, operator?: string) => VNode | string;
  /** Custom value input renderer. */
  renderValueInput?: (index: number, field?: string, operator?: string, value?: string) => VNode | string;
}

export const ConditionBuilder = defineComponent({
  name: 'ConditionBuilder',

  props: {
    conditions: { type: Array as PropType<any[]>, required: true as const },
    fields: { type: Array as PropType<any[]>, required: true as const },
    logic: { type: String, default: 'and' },
    ariaLabel: { type: String, default: 'Condition Builder' },
    maxRows: { type: Number, default: 20 },
    readOnly: { type: Boolean, default: false },
    allowGroups: { type: Boolean, default: false },
    onConditionsChange: { type: Array as PropType<any[]> },
    onLogicChange: { type: Function as PropType<(...args: any[]) => any> },
    renderFieldSelector: { type: Function as PropType<(...args: any[]) => any> },
    renderOperatorSelector: { type: Function as PropType<(...args: any[]) => any> },
    renderValueInput: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['conditions-change', 'logic-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ current: 'idle' });
    const send = (action: any) => { /* state machine dispatch */ };
    const handleAddRow = () => {
      if (props.conditions.length >= props.maxRows) return;
      props.onConditionsChange?.([...conditions, {}]);
      send({ type: 'ADD_ROW' });
    };
    const handleRemoveRow = (index: number) => {
        if (props.conditions.length <= 1) return;
        const next = props.conditions.filter((_, i) => i !== index);
        props.onConditionsChange?.(next);
        send({ type: 'REMOVE_ROW', index });
      };

    const handleToggleLogic = () => {
      props.onLogicChange?.(props.logic === 'and' ? 'or' : 'and');
      send({ type: 'TOGGLE_LOGIC' });
    };

    return (): VNode =>
      h('div', {}, [
        index > 0 ? h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': `Logic: ${logic}. Click to toggle.`,
            'aria-pressed': props.logic === 'or',
            'data-part': 'logic-toggle',
            'data-logic': props.logic,
            'data-visible': 'true',
            'onClick': handleToggleLogic,
          }, [
            props.logic.toUpperCase(),
          ]) : null,
        h('div', {
          'role': 'listitem',
          'aria-label': `Condition ${index}: ${row.field ?? ''} ${row.operator ?? ''} ${row.value ?? ''}`,
          'data-row-index': index,
          'data-complete': isComplete ? 'true' : 'false',
          'data-part': 'row',
        }, [
          h('div', {
            'data-part': 'field-selector',
            'data-row-index': index,
            'aria-label': `Field for condition ${index}`,
          }, [
            props.renderFieldSelector ? props.renderFieldSelector(index, row.field) : h('select', {
                        'value': row.field ?? '',
                        'aria-label': `Field for condition ${index}`,
                        'onChange': (e) => {
                          const next = [...conditions];
                          next[index] = { field: e.target.value, operator: undefined, value: undefined };
                          props.onConditionsChange?.(next);
                          send({ type: 'CHANGE_FIELD' });
                        },
                      }, [
                        h('option', { value: '' }, 'Select field...'),
                        ...props.fields.map((f) => h('option', { 'value': f.name }, [
                f.name,
              ])),
                      ]),
          ]),
          h('div', {
            'data-part': 'operator-selector',
            'data-row-index': index,
            'data-field-type': fieldDef?.type,
            'aria-label': `Operator for condition ${index}`,
          }, [
            props.renderOperatorSelector ? props.renderOperatorSelector(index, row.field, row.operator) : h('select', {
                        'value': row.operator ?? '',
                        'aria-label': `Operator for condition ${index}`,
                        'disabled': !row.field,
                        'onChange': (e) => {
                          const next = [...conditions];
                          next[index] = { ...next[index], operator: e.target.value };
                          props.onConditionsChange?.(next);
                          send({ type: 'CHANGE_OPERATOR' });
                        },
                      }, [
                        h('option', { value: '' }, 'Operator...'),
                        ...(fieldDef?.operators ?? []).map((op) => h('option', { 'value': op }, [
                op,
              ])),
                      ]),
          ]),
          h('div', {
            'data-part': 'value-input',
            'data-row-index': index,
            'data-field-type': fieldDef?.type,
            'data-operator': row.operator,
            'aria-label': `Value for condition ${index}`,
          }, [
            props.renderValueInput ? props.renderValueInput(index, row.field, row.operator, row.value) : h('input', {
                        'type': 'text',
                        'value': row.value ?? '',
                        'placeholder': 'Value...',
                        'aria-label': `Value for condition ${index}`,
                        'disabled': !row.operator,
                        'onChange': (e) => {
                          const next = [...conditions];
                          next[index] = { ...next[index], value: e.target.value };
                          props.onConditionsChange?.(next);
                          send({ type: 'CHANGE_VALUE' });
                        },
                      }),
          ]),
          !props.readOnly && props.conditions.length > 1 ? h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': `Remove condition ${index}`,
              'data-part': 'remove',
              'data-visible': 'true',
              'onClick': () => handleRemoveRow(index),
            }, '✕') : null,
        ]),
      ]);
  },
});

export default ConditionBuilder;