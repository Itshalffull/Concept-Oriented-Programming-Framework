// ============================================================
// ThemeSwitch — Vue 3 Component
//
// Toggle buttons for switching between available themes.
// Uses ref() for reactive local state tracking the currently
// active theme name, and emits 'change' when the user selects
// a different theme.
// ============================================================

import {
  defineComponent,
  h,
  ref,
  watch,
  type PropType,
  type VNode,
} from 'vue';

import type { ThemeConfig } from '../../shared/types.js';

export const ThemeSwitch = defineComponent({
  name: 'ThemeSwitch',

  props: {
    /** Available theme configurations */
    themes: {
      type: Array as PropType<ThemeConfig[]>,
      required: true,
      validator: (v: unknown) => Array.isArray(v) && (v as ThemeConfig[]).length > 0,
    },
    /** Currently active theme name (v-model compatible) */
    modelValue: {
      type: String as PropType<string>,
      default: undefined,
    },
    /** Visual variant */
    variant: {
      type: String as PropType<'buttons' | 'dropdown' | 'toggle'>,
      default: 'buttons',
    },
    /** Accessible label for the switch group */
    ariaLabel: {
      type: String as PropType<string>,
      default: 'Theme selector',
    },
  },

  emits: {
    /** Emitted when active theme changes */
    'update:modelValue': (name: string) => typeof name === 'string',
    change: (name: string) => typeof name === 'string',
  },

  setup(props, { emit }) {
    // Local reactive state for active theme name
    const activeTheme = ref<string>(
      props.modelValue
        ?? props.themes.find(t => t.active)?.name
        ?? props.themes[0]?.name
        ?? '',
    );

    // Sync external v-model changes into local state
    watch(
      () => props.modelValue,
      (val) => {
        if (val !== undefined && val !== activeTheme.value) {
          activeTheme.value = val;
        }
      },
    );

    function selectTheme(name: string): void {
      activeTheme.value = name;
      emit('update:modelValue', name);
      emit('change', name);
    }

    // --- Render: button group ---
    function renderButtons(): VNode[] {
      return props.themes.map((theme) =>
        h(
          'button',
          {
            key: theme.name,
            type: 'button',
            class: [
              'coif-theme-switch__button',
              { 'coif-theme-switch__button--active': activeTheme.value === theme.name },
            ],
            'aria-pressed': String(activeTheme.value === theme.name),
            onClick: () => selectTheme(theme.name),
          },
          theme.name,
        ),
      );
    }

    // --- Render: dropdown ---
    function renderDropdown(): VNode {
      return h(
        'select',
        {
          class: 'coif-theme-switch__select',
          value: activeTheme.value,
          'aria-label': props.ariaLabel,
          onChange: (e: Event) => {
            const target = e.target as HTMLSelectElement;
            selectTheme(target.value);
          },
        },
        props.themes.map((theme) =>
          h(
            'option',
            {
              key: theme.name,
              value: theme.name,
              selected: activeTheme.value === theme.name,
            },
            theme.name,
          ),
        ),
      );
    }

    // --- Render: binary toggle (first two themes) ---
    function renderToggle(): VNode {
      const [a, b] = props.themes;
      const isSecond = activeTheme.value === b?.name;
      return h(
        'button',
        {
          type: 'button',
          class: 'coif-theme-switch__toggle',
          role: 'switch',
          'aria-checked': String(isSecond),
          'aria-label': props.ariaLabel,
          onClick: () => selectTheme(isSecond ? a.name : (b?.name ?? a.name)),
        },
        [
          h('span', { class: 'coif-theme-switch__toggle-label' }, a?.name ?? ''),
          h('span', {
            class: [
              'coif-theme-switch__toggle-thumb',
              { 'coif-theme-switch__toggle-thumb--on': isSecond },
            ],
          }),
          h('span', { class: 'coif-theme-switch__toggle-label' }, b?.name ?? ''),
        ],
      );
    }

    return (): VNode =>
      h(
        'div',
        {
          class: 'coif-theme-switch',
          role: 'group',
          'aria-label': props.ariaLabel,
          'data-variant': props.variant,
        },
        props.variant === 'dropdown'
          ? [renderDropdown()]
          : props.variant === 'toggle'
            ? [renderToggle()]
            : renderButtons(),
      );
  },
});

export default ThemeSwitch;
