// ============================================================
// SvelteAdapter Handler
//
// Transforms framework-neutral props into Svelte bindings:
// on:click handlers, class directive, bind: directives.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

export const svelteAdapterHandler: ConceptHandler = {
  async normalize(input, storage) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      return { variant: 'error', message: 'Props cannot be empty' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      return { variant: 'error', message: 'Props must be valid JSON' };
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      // ARIA and data-* pass through unchanged
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> Svelte class directive
      if (key === 'class') {
        normalized['class'] = value;
        continue;
      }

      // Event handlers: onclick -> on:click
      if (key.startsWith('on')) {
        const eventName = key.slice(2).toLowerCase();
        normalized[`on:${eventName}`] = value;
        continue;
      }

      // Bind directives: bind:value, bind:checked, etc.
      if (key.startsWith('bind:')) {
        normalized[key] = value;
        continue;
      }

      // style -> Svelte style prop
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

      // Two-way binding props (prefixed with $) -> bind: directive
      if (key.startsWith('$')) {
        const propName = key.slice(1);
        normalized[`bind:${propName}`] = value;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
