// ============================================================
// UISchemaForm — Vue 3 Component
//
// Auto-generates a form from a Clef Surface UISchema definition.
// Each UISchemaField is rendered via ElementRenderer, with
// reactive form data collected into a single model object.
// Supports create, edit, detail, and list views.
// ============================================================

import {
  defineComponent,
  h,
  reactive,
  computed,
  watch,
  type PropType,
  type VNode,
} from 'vue';

import type {
  UISchema,
  UISchemaView,
  UISchemaField,
  ElementConfig,
} from '../../shared/types.js';

import { ElementRenderer } from './ElementRenderer.js';

// --- Types ---

export type UISchemaViewName = 'create' | 'edit' | 'detail' | 'list';

export const UISchemaForm = defineComponent({
  name: 'UISchemaForm',

  props: {
    /** UI Schema definition */
    schema: {
      type: Object as PropType<UISchema>,
      required: true,
    },
    /** Which view to render */
    view: {
      type: String as PropType<UISchemaViewName>,
      default: 'create',
    },
    /** Current form data (v-model compatible) */
    modelValue: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({}),
    },
    /** Whether the form is read-only (for detail view) */
    readonly: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    /** Whether to show validation errors */
    showErrors: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    /** Validation error map keyed by field name */
    errors: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
    /** HTML tag for the form wrapper */
    tag: {
      type: String as PropType<string>,
      default: 'form',
    },
  },

  emits: {
    /** Emitted when form data changes */
    'update:modelValue': (_value: Record<string, unknown>) => true,
    /** Emitted on form submit */
    submit: (_value: Record<string, unknown>) => true,
    /** Emitted when a field value changes */
    'field-change': (_payload: { name: string; value: unknown }) => true,
  },

  setup(props, { slots, emit }) {
    // Internal reactive form data
    const formData = reactive<Record<string, unknown>>({ ...props.modelValue });

    // Sync external modelValue changes into internal formData
    watch(
      () => props.modelValue,
      (newVal) => {
        if (newVal) {
          for (const key of Object.keys(newVal)) {
            formData[key] = newVal[key];
          }
        }
      },
      { deep: true },
    );

    // Resolve the active view from the schema
    const activeView = computed<UISchemaView | null>(() => {
      const views = props.schema.views;
      return (views[props.view] as UISchemaView | undefined) ?? null;
    });

    // Whether the form is effectively disabled (detail view or readonly prop)
    const isDisabled = computed(() =>
      props.readonly || props.view === 'detail' || props.view === 'list',
    );

    // Convert a UISchemaField to an ElementConfig for ElementRenderer
    function fieldToElementConfig(field: UISchemaField): ElementConfig {
      return {
        id: `${props.schema.concept}-${field.name}`,
        kind: field.element,
        label: field.label,
        dataType: field.dataType,
        required: field.required,
        constraints: field.constraints,
      };
    }

    // Handle field value change
    function onFieldChange(fieldName: string, value: unknown): void {
      formData[fieldName] = value;
      emit('update:modelValue', { ...formData });
      emit('field-change', { name: fieldName, value });
    }

    // Handle form submit
    function onSubmit(event: Event): void {
      event.preventDefault();
      emit('submit', { ...formData });
    }

    // Render a single field
    function renderField(field: UISchemaField): VNode {
      const config = fieldToElementConfig(field);
      const fieldError = props.errors[field.name];

      return h(ElementRenderer, {
        key: field.name,
        config,
        modelValue: formData[field.name],
        disabled: isDisabled.value,
        showErrors: props.showErrors && !!fieldError,
        errorMessage: fieldError,
        'onUpdate:modelValue': (value: unknown) => onFieldChange(field.name, value),
      });
    }

    // Render the list view (table-like output)
    function renderListView(view: UISchemaView): VNode {
      return h('div', { class: 'surface-ui-schema-form__list' }, [
        h(
          'div',
          { class: 'surface-ui-schema-form__list-header', role: 'row' },
          view.fields.map((field) =>
            h(
              'span',
              {
                key: field.name,
                class: 'surface-ui-schema-form__list-col',
                role: 'columnheader',
              },
              field.label,
            ),
          ),
        ),
        // Actual rows would be populated by the consumer via slots
        slots.listRows?.({ fields: view.fields, formData }) ??
          h(
            'div',
            { class: 'surface-ui-schema-form__list-empty' },
            'No data available.',
          ),
      ]);
    }

    return (): VNode => {
      const view = activeView.value;

      if (!view) {
        return h(
          'div',
          { class: 'surface-ui-schema-form surface-ui-schema-form--empty' },
          `No "${props.view}" view defined in schema for "${props.schema.concept}".`,
        );
      }

      // List view has a different structure
      if (props.view === 'list') {
        return h(
          'div',
          {
            class: [
              'surface-ui-schema-form',
              'surface-ui-schema-form--list',
            ],
            'data-concept': props.schema.concept,
            'data-view': props.view,
          },
          [
            // Optional header slot
            slots.header?.() ?? null,
            renderListView(view),
            // Optional footer slot
            slots.footer?.() ?? null,
          ],
        );
      }

      // Form views (create, edit, detail)
      const fieldNodes = view.fields.map(renderField);

      return h(
        props.tag,
        {
          class: [
            'surface-ui-schema-form',
            `surface-ui-schema-form--${props.view}`,
            { 'surface-ui-schema-form--readonly': isDisabled.value },
          ],
          'data-concept': props.schema.concept,
          'data-view': props.view,
          onSubmit: props.tag === 'form' ? onSubmit : undefined,
          novalidate: props.tag === 'form' ? true : undefined,
        },
        [
          // Optional header slot
          slots.header?.() ?? null,

          // Form fields
          h('div', { class: 'surface-ui-schema-form__fields' }, fieldNodes),

          // Actions slot (submit button etc.) or default
          slots.actions?.({ formData, isDisabled: isDisabled.value }) ??
            (props.view !== 'detail'
              ? h(
                  'div',
                  { class: 'surface-ui-schema-form__actions' },
                  [
                    h(
                      'button',
                      {
                        type: 'submit',
                        class: 'surface-ui-schema-form__submit',
                        disabled: isDisabled.value,
                      },
                      props.view === 'edit' ? 'Update' : 'Create',
                    ),
                  ],
                )
              : null),

          // Optional footer slot
          slots.footer?.() ?? null,
        ],
      );
    };
  },
});

export default UISchemaForm;
