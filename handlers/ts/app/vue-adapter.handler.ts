// ============================================================
// VueAdapter Handler
//
// Transforms framework-neutral props into Vue 3 bindings:
// v-on event handlers, v-bind, class binding objects, Vue refs.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

export const vueAdapterHandler: ConceptHandler = {
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

      // class -> Vue class binding object
      if (key === 'class') {
        if (typeof value === 'string') {
          const classObj: Record<string, boolean> = {};
          for (const cls of value.split(/\s+/).filter(Boolean)) {
            classObj[cls] = true;
          }
          normalized[':class'] = classObj;
        } else {
          normalized[':class'] = value;
        }
        continue;
      }

      // Event handlers: onclick -> v-on:click
      if (key.startsWith('on')) {
        const eventName = key.slice(2).toLowerCase();
        normalized[`v-on:${eventName}`] = value;
        continue;
      }

      // style -> v-bind:style
      if (key === 'style') {
        normalized['v-bind:style'] = value;
        continue;
      }

      // ref -> Vue ref binding
      if (key === 'ref') {
        normalized['ref'] = { __vueRef: true, value };
        continue;
      }

      // All other props -> v-bind
      normalized[`v-bind:${key}`] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
