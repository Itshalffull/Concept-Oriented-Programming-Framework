// ============================================================
// SchemaEditor -- Vue 3 Component
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

export interface TypeDef {
  key: FieldType;
  label: string;
}

export interface SchemaEditorProps {
  fields?: FieldDefinition[];
  availableTypes?: FieldType[];
  maxFields?: number;
  disabled?: boolean;
  reorderable?: boolean;
  showValidation?: boolean;
  onChange?: (fields: FieldDefinition[]) => void;
  renderConfigPanel?: (field: FieldDefinition, onUpdate: (config: Record<string, unknown>) => void) => VNode | string;
}

export const SchemaEditor = defineComponent({
  name: 'SchemaEditor',

  props: {
    fields: { type: Array as PropType<any[]> },
    availableTypes: { type: Array as PropType<any[]>, default: () => (['text', 'number', 'date', 'select', 'checkbox', 'url', 'email', 'relation', 'formula']) },
    maxFields: { type: Number, default: 50 },
    disabled: { type: Boolean, default: false },
    reorderable: { type: Boolean, default: true },
    showValidation: { type: Boolean, default: true },
    onChange: { type: Array as PropType<any[]> },
    renderConfigPanel: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ fieldCount: (props.fields?.length ?? 0) > 0 ? 'hasFields' : 'empty', expandedFieldId: null, draggingFieldId: null, fields: props.fields ?? [], });
    const send = (action: any) => { /* state machine dispatch */ };
    const emitChange = (fields: FieldDefinition[]) => {
        props.onChange?.(props.fields);
      };

    const handleAdd = () => {
      if (props.disabled || effectiveFields.length >= props.maxFields) return;
      const newField: FieldDefinition = {
        id: nextFieldId(),
        name: '',
        type: 'text',
        required: false,
      };
      send({ type: 'ADD_FIELD' });
      emitChange([...effectiveFields, newField]);
    };
    const effectiveFields = props.fields ?? state.value.fields;
    const isExpanded = (id: string) => state.value.expandedFieldId === id;

    return (): VNode =>
      h('div', {
        'role': 'list',
        'aria-label': 'Schema editor',
        'data-surface-widget': '',
        'data-widget-name': 'schema-editor',
        'data-part': 'root',
        'data-state': effectiveFields.length === 0 ? 'empty' : 'has-fields',
        'data-disabled': props.disabled ? 'true' : 'false',
      }, [
        h('div', { 'data-part': 'field-list', 'data-count': effectiveFields.length }, [
          ...effectiveFields.map((field) => h('div', {
              'role': 'listitem',
              'aria-label': `Field: ${field.name || 'Unnamed'}`,
              'aria-expanded': isExpanded(field.id) ? 'true' : 'false',
              'data-part': 'field-row',
              'data-type': field.type,
              'data-state': isExpanded(field.id) ? 'expanded' : 'collapsed',
              'data-dragging': state.value.draggingFieldId === field.id ? 'true' : 'false',
              'data-valid': isDuplicateName(field) ? 'false' : 'true',
            }, [
              props.reorderable ? h('button', {
              'type': 'button',
              'data-part': 'drag-handle',
              'role': 'button',
              'aria-roledescription': 'sortable',
              'aria-label': `Reorder field ${field.name}`,
              'hidden': !props.reorderable,
              'disabled': props.disabled,
              'tabindex': 0,
              'onPointerDown': () => send({ type: 'DRAG_START', id: field.id }),
              'onPointerUp': () => send({ type: 'DRAG_END' }),
              'onKeyDown': (e) => {
                    if (e.key === 'ArrowUp') handleMoveUp(field.id);
                    if (e.key === 'ArrowDown') handleMoveDown(field.id);
                  },
            }, '&#x2630;') : null,
            ])),
        ]),
        h('button', {
          'type': 'button',
          'data-part': 'add-field-button',
          'aria-label': 'Add field',
          'disabled': props.disabled || effectiveFields.length >= props.maxFields,
          'onClick': handleAdd,
        }, 'Add field'),
        slots.default?.(),
      ]);
  },
});

export default SchemaEditor;