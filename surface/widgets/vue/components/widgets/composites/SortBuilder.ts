// ============================================================
// SortBuilder -- Vue 3 Component
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

export interface SortFieldDef {
  key: string;
  label: string;
}

export interface SortBuilderProps {
  sorts?: SortCriterion[];
  fields: SortFieldDef[];
  maxSorts?: number;
  disabled?: boolean;
  onChange?: (sorts: SortCriterion[]) => void;
}

export const SortBuilder = defineComponent({
  name: 'SortBuilder',

  props: {
    sorts: { type: Array as PropType<any[]> },
    fields: { type: Array as PropType<any[]>, required: true as const },
    maxSorts: { type: Number, default: 5 },
    disabled: { type: Boolean, default: false },
    onChange: { type: Array as PropType<any[]> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const state = ref<any>(initialState);
    const send = (action: any) => { /* state machine dispatch */ };
    const handleAdd = () => {
      if (props.disabled || effectiveSorts.length >= props.maxSorts) return;
      const newSort: SortCriterion = { id: nextSortId(), field: '', direction: 'ascending' };
      send({ type: 'ADD_SORT' });
      props.onChange?.([...effectiveSorts, newSort]);
    };
    const effectiveSorts = props.sorts ?? state.sorts;
    const usedFields = new Set(effectiveSorts.map((s) => s.field));

    return (): VNode =>
      h('div', {
        'role': 'list',
        'aria-label': 'Sort criteria',
        'data-surface-widget': '',
        'data-widget-name': 'sort-builder',
        'data-part': 'root',
        'data-state': effectiveSorts.length === 0 ? 'empty' : 'has-sorts',
        'data-disabled': props.disabled ? 'true' : 'false',
      }, [
        effectiveSorts.length === 0 ? h('div', { 'data-part': 'empty-state', 'aria-hidden': 'false' }, 'No sort criteria defined') : null,
        ...effectiveSorts.map((sort, index) => h('div', {
            'role': 'listitem',
            'aria-label': `Sort by ${fieldLabel(sort.field)}`,
            'data-part': 'sort-row',
            'data-direction': sort.direction,
            'data-dragging': state.draggingId === sort.id ? 'true' : 'false',
            'data-priority': index,
          }, [
            h('span', { 'data-part': 'priority-label', 'aria-hidden': 'true' }, [
              index + 1,
              ordinalSuffix(index + 1),
            ]),
            h('button', {
              'type': 'button',
              'data-part': 'drag-handle',
              'role': 'button',
              'aria-roledescription': 'sortable',
              'aria-label': `Reorder sort criterion ${fieldLabel(sort.field)}`,
              'tabindex': 0,
              'props': true,
              'disabled': props.disabled,
              'data-dragging': state.draggingId === sort.id ? 'true' : 'false',
              'onPointerDown': () => send({ type: 'DRAG_START', id: sort.id }),
              'onPointerUp': () => send({ type: 'DRAG_END' }),
              'onKeyDown': (e) => {
                if (e.key === 'ArrowUp') handleMoveUp(sort.id);
                if (e.key === 'ArrowDown') handleMoveDown(sort.id);
              },
            }, '&#x2630;'),
            h('select', {
              'data-part': 'field-selector',
              'value': sort.field,
              'props': true,
              'disabled': props.disabled,
              'aria-label': 'Sort field',
              'props': true,
              'onChange': (e) => handleFieldChange(sort.id, e.target.value),
            }, [
              h('option', { 'value': '' }, 'Select field...'),
              ...props.fields
                .filter((f) => !usedFields.has(f.key) || f.key === sort.field)
                .map((f) => h('option', { 'value': f.key }, [
                  f.label,
                ])),
            ]),
            h('button', {
              'type': 'button',
              'data-part': 'direction-toggle',
              'role': 'button',
              'aria-label': sort.direction === 'ascending'
                  ? 'Sort ascending, click to change to descending'
                  : 'Sort descending, click to change to ascending',
              'aria-pressed': sort.direction === 'descending' ? 'true' : 'false',
              'data-direction': sort.direction,
              'props': true,
              'disabled': props.disabled,
              'onClick': () => handleToggleDirection(sort.id),
            }, [
              sort.direction === 'ascending' ? '\u2191' : '\u2193',
            ]),
            h('button', {
              'type': 'button',
              'data-part': 'remove-button',
              'aria-label': `Remove sort by ${fieldLabel(sort.field)}`,
              'props': true,
              'disabled': props.disabled,
              'onClick': () => handleRemove(sort.id),
            }, 'Remove'),
          ])),
        h('button', {
          'type': 'button',
          'data-part': 'add-button',
          'aria-label': 'Add sort criterion',
          'disabled': props.disabled || effectiveSorts.length >= props.maxSorts,
          'onClick': handleAdd,
        }, 'Add sort'),
        slots.default?.(),
      ]);
  },
});

export default SortBuilder;