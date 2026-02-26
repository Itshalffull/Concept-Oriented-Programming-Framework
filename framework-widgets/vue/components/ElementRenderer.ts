// ============================================================
// ElementRenderer — Vue 3 Component
//
// Renders the correct HTML element (input, select, button, etc.)
// from an ElementConfig definition, applying proper ARIA
// attributes. Recursively renders children for group/container
// element kinds.
// ============================================================

import {
  defineComponent,
  h,
  ref,
  type PropType,
  type VNode,
} from 'vue';

import type { ElementConfig } from '../../shared/types.js';

import { mapElementToHTML } from '../../shared/surface-bridge.js';

export const ElementRenderer = defineComponent({
  name: 'ElementRenderer',

  props: {
    /** Element configuration describing what to render */
    config: {
      type: Object as PropType<ElementConfig>,
      required: true,
    },
    /** Current value for the element (v-model compatible) */
    modelValue: {
      type: [String, Number, Boolean, Array, Object] as PropType<unknown>,
      default: undefined,
    },
    /** Whether the element is disabled */
    disabled: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    /** Whether to show validation errors */
    showErrors: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    /** External validation error message */
    errorMessage: {
      type: String as PropType<string>,
      default: undefined,
    },
  },

  emits: {
    /** Emitted when the element value changes */
    'update:modelValue': (_value: unknown) => true,
    /** Emitted on blur */
    blur: (_event: FocusEvent) => true,
    /** Emitted on focus */
    focus: (_event: FocusEvent) => true,
    /** Emitted on trigger click */
    trigger: (_config: ElementConfig) => true,
  },

  setup(props, { emit, slots }) {
    const localValue = ref(props.modelValue);

    function handleInput(event: Event): void {
      const target = event.target as HTMLInputElement;
      let value: unknown;

      if (props.config.kind === 'input-bool') {
        value = target.checked;
      } else if (props.config.kind === 'input-number') {
        value = target.valueAsNumber;
      } else {
        value = target.value;
      }

      localValue.value = value;
      emit('update:modelValue', value);
    }

    function handleClick(): void {
      emit('trigger', props.config);
    }

    // --- Determine ARIA attributes ---
    function getAriaAttrs(): Record<string, string | undefined> {
      const attrs: Record<string, string | undefined> = {};

      if (props.config.required) {
        attrs['aria-required'] = 'true';
      }
      if (props.disabled) {
        attrs['aria-disabled'] = 'true';
      }
      if (props.showErrors && props.errorMessage) {
        attrs['aria-invalid'] = 'true';
        attrs['aria-errormessage'] = `${props.config.id}-error`;
      }

      return attrs;
    }

    // --- Render a single element (non-recursive) ---
    function renderElement(config: ElementConfig): VNode {
      const hint = mapElementToHTML(config.kind);
      const ariaAttrs = getAriaAttrs();

      // Merge static attributes from the HTML mapper
      const baseAttrs: Record<string, unknown> = {
        id: config.id,
        ...hint.attributes,
        ...ariaAttrs,
      };

      if (hint.role) {
        baseAttrs['role'] = hint.role;
      }
      if (props.disabled) {
        baseAttrs['disabled'] = true;
      }

      // --- Input elements ---
      if (hint.tag === 'input') {
        return h('input', {
          ...baseAttrs,
          type: hint.inputType ?? 'text',
          name: config.id,
          value: config.kind === 'input-bool' ? undefined : (localValue.value as string),
          checked: config.kind === 'input-bool' ? Boolean(localValue.value) : undefined,
          onInput: handleInput,
          onBlur: (e: FocusEvent) => emit('blur', e),
          onFocus: (e: FocusEvent) => emit('focus', e),
          class: 'surface-element-renderer__input',
        });
      }

      // --- Select elements ---
      if (hint.tag === 'select') {
        const isMulti = config.kind === 'selection-multi';
        return h(
          'select',
          {
            ...baseAttrs,
            name: config.id,
            multiple: isMulti || undefined,
            value: localValue.value as string,
            onChange: handleInput,
            onBlur: (e: FocusEvent) => emit('blur', e),
            onFocus: (e: FocusEvent) => emit('focus', e),
            class: 'surface-element-renderer__select',
          },
          // Placeholder option; real options come from slot or constraints
          slots.options?.() ?? [
            h('option', { value: '', disabled: true }, `Select ${config.label}...`),
          ],
        );
      }

      // --- Button / trigger ---
      if (hint.tag === 'button') {
        return h(
          'button',
          {
            ...baseAttrs,
            type: 'button',
            onClick: handleClick,
            class: 'surface-element-renderer__trigger',
          },
          slots.default?.() ?? config.label,
        );
      }

      // --- Navigation (anchor) ---
      if (hint.tag === 'a') {
        return h(
          'a',
          {
            ...baseAttrs,
            href: (config.constraints?.['href'] as string) ?? '#',
            class: 'surface-element-renderer__navigation',
          },
          slots.default?.() ?? config.label,
        );
      }

      // --- Output elements ---
      if (config.kind.startsWith('output-')) {
        return h(
          hint.tag,
          {
            ...baseAttrs,
            class: 'surface-element-renderer__output',
          },
          String(localValue.value ?? ''),
        );
      }

      // --- Rich text ---
      if (config.kind === 'rich-text') {
        return h(hint.tag, {
          ...baseAttrs,
          contenteditable: !props.disabled ? 'true' : 'false',
          class: 'surface-element-renderer__rich-text',
          onInput: (e: Event) => {
            const target = e.target as HTMLElement;
            localValue.value = target.innerHTML;
            emit('update:modelValue', target.innerHTML);
          },
          innerHTML: localValue.value as string ?? '',
        });
      }

      // --- Fallback: generic container ---
      return h(
        hint.tag,
        {
          ...baseAttrs,
          class: 'surface-element-renderer__generic',
        },
        slots.default?.(),
      );
    }

    // --- Render group / container (recursive) ---
    function renderGroup(config: ElementConfig): VNode {
      const hint = mapElementToHTML(config.kind);
      const children: VNode[] = [];

      // Fieldset legend for groups
      if (config.kind === 'group' && config.label) {
        children.push(h('legend', { class: 'surface-element-renderer__legend' }, config.label));
      }

      // Recursively render child elements
      if (config.children && config.children.length > 0) {
        for (const child of config.children) {
          const isGroupKind = child.kind === 'group' || child.kind === 'container';
          children.push(
            isGroupKind
              ? renderGroup(child)
              : renderFieldWrapper(child),
          );
        }
      }

      return h(
        hint.tag,
        {
          id: config.id,
          role: hint.role ?? undefined,
          class: [
            'surface-element-renderer__group',
            `surface-element-renderer__group--${config.kind}`,
          ],
        },
        children,
      );
    }

    // --- Wrap a single element with label + error ---
    function renderFieldWrapper(config: ElementConfig): VNode {
      const children: VNode[] = [];

      // Label
      if (config.label && config.kind !== 'trigger') {
        children.push(
          h(
            'label',
            {
              for: config.id,
              class: 'surface-element-renderer__label',
            },
            [
              config.label,
              config.required
                ? h('span', { class: 'surface-element-renderer__required', 'aria-hidden': 'true' }, ' *')
                : null,
            ],
          ),
        );
      }

      // The element itself
      children.push(renderElement(config));

      // Error message
      if (props.showErrors && props.errorMessage) {
        children.push(
          h(
            'span',
            {
              id: `${config.id}-error`,
              class: 'surface-element-renderer__error',
              role: 'alert',
            },
            props.errorMessage,
          ),
        );
      }

      return h(
        'div',
        {
          class: [
            'surface-element-renderer__field',
            { 'surface-element-renderer__field--error': props.showErrors && props.errorMessage },
          ],
        },
        children,
      );
    }

    // --- Root render ---
    return (): VNode => {
      const config = props.config;
      const isGroup = config.kind === 'group' || config.kind === 'container';

      return h(
        'div',
        {
          class: 'surface-element-renderer',
          'data-element-kind': config.kind,
          'data-element-id': config.id,
        },
        [isGroup ? renderGroup(config) : renderFieldWrapper(config)],
      );
    };
  },
});

export default ElementRenderer;
