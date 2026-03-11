// ============================================================
// FieldMapper -- Vue 3 Component
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

export interface TargetFieldDef {
  name: string;
  type: string;
  required: boolean;
}

export interface SourceFieldGroup {
  stepName: string;
  fields: Array<{ name: string; type: string }>;
}

export interface MappingEntry {
  targetName: string;
  value: string;
  tokens: Array<{ field: string; step: string }>;
}

export interface FieldMapperProps {
  /** Target fields. */
  targetFields: TargetFieldDef[];
  /** Source fields grouped by step. */
  sourceFields: SourceFieldGroup[];
  /** Current mappings. */
  mappings: MappingEntry[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Called on mapping change. */
  onMappingChange?: (mappings: MappingEntry[]) => void;
  /** Called on token insert. */
  onTokenInsert?: (targetName: string, field: string, step: string) => void;
  /** Field picker slot. */
  fieldPicker?: VNode | string;
}

export const FieldMapper = defineComponent({
  name: 'FieldMapper',

  props: {
    targetFields: { type: Array as PropType<any[]>, required: true as const },
    sourceFields: { type: Array as PropType<any[]>, required: true as const },
    mappings: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'Field Mapper' },
    readOnly: { type: Boolean, default: false },
    onMappingChange: { type: Array as PropType<any[]> },
    onTokenInsert: { type: Function as PropType<(...args: any[]) => any> },
    fieldPicker: { type: null as unknown as PropType<any> },
  },

  emits: ['token-insert'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': `Mapping for ${field.name}`,
        'data-part': 'mapping-row',
        'data-target': field.name,
        'data-required': field.required ? 'true' : 'false',
        'data-filled': mapping?.value ? 'true' : 'false',
      }, [
        h('div', {
          'data-part': 'target-field',
          'data-type': field.type,
          'data-required': field.required ? 'true' : 'false',
        }, [
          h('span', { 'data-part': 'target-label', 'id': `target-${index}` }, [
            field.name,
          ]),
        ]),
        h('div', {
          'data-part': 'mapping-input',
          'role': 'textbox',
          'aria-label': `Value for ${field.name}`,
          'aria-labelledby': `target-${index}`,
          'contenteditable': !props.readOnly,
          'suppressContentEditableWarning': true,
          'data-has-tokens': hasTokens ? 'true' : 'false',
          'onFocus': () => send({ type: 'FOCUS_INPUT', target: field.name }),
          'onBlur': () => send({ type: 'BLUR' }),
        }, [
          mapping?.value,
        ]),
        !props.readOnly ? h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': `Insert field token for ${field.name}`,
            'aria-haspopup': 'dialog',
            'aria-expanded': state.value === 'picking' || undefined,
            'data-part': 'insert-field',
            'data-visible': 'true',
            'tabindex': -1,
            'onClick': () => send({ type: 'OPEN_PICKER', target: field.name }),
          }, [
            '{',
            '...',
            '}',
          ]) : null,
      ]);
  },
});

export default FieldMapper;