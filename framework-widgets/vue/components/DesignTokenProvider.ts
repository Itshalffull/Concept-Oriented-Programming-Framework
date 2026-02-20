// ============================================================
// DesignTokenProvider — Vue 3 Component
//
// Provide/inject pattern that supplies resolved design tokens
// to descendant components. Applies CSS custom properties to
// the root wrapper element so all children inherit them.
// ============================================================

import {
  defineComponent,
  h,
  provide,
  reactive,
  watch,
  computed,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue';

import type {
  DesignTokenValue,
  ThemeConfig,
  ResolvedTheme,
} from '../../shared/types.js';

import { resolveTheme } from '../../shared/coif-bridge.js';

// --- Injection Key ---

export const DESIGN_TOKENS_KEY: InjectionKey<ResolvedTheme> = Symbol('coif-design-tokens');

// --- Component ---

export const DesignTokenProvider = defineComponent({
  name: 'DesignTokenProvider',

  props: {
    /** Raw design token definitions */
    tokens: {
      type: Array as PropType<DesignTokenValue[]>,
      required: true,
      validator: (v: unknown) => Array.isArray(v),
    },
    /** Theme configuration layers */
    themes: {
      type: Array as PropType<ThemeConfig[]>,
      default: () => [],
    },
    /** HTML tag for the wrapper element */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
  },

  setup(props, { slots }) {
    // Resolve tokens + theme overrides into a single flat map
    const resolved = computed<ResolvedTheme>(() =>
      resolveTheme(props.tokens, props.themes),
    );

    // Make the resolved theme available to all descendants
    const reactiveResolved = reactive({ name: '', tokens: {} }) as ResolvedTheme;

    watch(
      resolved,
      (val) => {
        reactiveResolved.name = val.name;
        // Clear and repopulate tokens
        for (const key of Object.keys(reactiveResolved.tokens)) {
          delete reactiveResolved.tokens[key];
        }
        Object.assign(reactiveResolved.tokens, val.tokens);
      },
      { immediate: true },
    );

    provide(DESIGN_TOKENS_KEY, reactiveResolved);

    // Compute CSS custom properties from resolved tokens
    const cssVars = computed<Record<string, string>>(() => {
      const style: Record<string, string> = {};
      for (const [name, value] of Object.entries(resolved.value.tokens)) {
        const cssName = `--${name.replace(/\./g, '-').replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        style[cssName] = value;
      }
      return style;
    });

    return (): VNode =>
      h(
        props.tag,
        {
          class: 'coif-design-token-provider',
          style: cssVars.value,
          'data-theme': resolved.value.name,
        },
        slots.default?.(),
      );
  },
});

export default DesignTokenProvider;
