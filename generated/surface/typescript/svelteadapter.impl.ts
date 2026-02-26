// generated: svelteadapter.handler.ts
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'output';

// Svelte uses on:event prefix for event handlers
function toSvelteEvent(key: string): string | null {
  if (key.startsWith('on') && key.length > 2 && !key.startsWith('on:')) {
    const eventName = key.slice(2).toLowerCase();
    return `on:${eventName}`;
  }
  return null;
}

// Svelte keeps `class` as-is (Svelte uses `class` natively)
// Svelte-specific attribute remapping (minimal - Svelte aligns closely with HTML)
const SVELTE_ATTR_MAP: Record<string, string> = {
  for: 'htmlFor',
  tabindex: 'tabIndex',
};

function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Preserve aria-* and data-* attributes unchanged
    if (key.startsWith('aria-') || key.startsWith('data-')) {
      result[key] = value;
    } else {
      const svelteEvent = toSvelteEvent(key);
      if (svelteEvent) {
        result[svelteEvent] = value;
      } else if (SVELTE_ATTR_MAP[key]) {
        result[SVELTE_ATTR_MAP[key]] = value;
      } else {
        // class stays as class, style stays as style, etc.
        result[key] = value;
      }
    }
  }
  return result;
}

export const svelteadapterHandler: ConceptHandler = {
  async normalize(input, storage) {
    const adapter = input.adapter as string;
    const propsStr = input.props as string;

    if (!propsStr || propsStr.trim() === '') {
      return { variant: 'error', message: 'Props string is empty' };
    }

    let props: Record<string, unknown>;
    try {
      props = JSON.parse(propsStr) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Invalid JSON in props string' };
    }

    const normalized = normalizeProps(props);
    const normalizedStr = JSON.stringify(normalized);

    await storage.put(RELATION, adapter, {
      adapter,
      outputs: normalizedStr,
    });

    return { variant: 'ok', adapter, normalized: normalizedStr };
  },
};
