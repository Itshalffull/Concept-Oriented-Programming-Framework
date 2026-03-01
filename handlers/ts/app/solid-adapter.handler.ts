// ============================================================
// SolidAdapter Handler
//
// Transforms framework-neutral props into Solid.js bindings:
// events stay lowercase (onclick), class stays as class,
// createSignal wrappers for reactive state.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

export const solidAdapterHandler: ConceptHandler = {
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

      // class stays as class in Solid (not className)
      if (key === 'class') {
        normalized['class'] = value;
        continue;
      }

      // Event handlers: Solid uses lowercase native event names (onclick, oninput)
      if (key.startsWith('on')) {
        normalized[key.toLowerCase()] = value;
        continue;
      }

      // style -> Solid supports both string and object styles
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

      // Reactive props -> wrap with createSignal accessor pattern
      if (key.startsWith('$')) {
        const propName = key.slice(1);
        normalized[propName] = { __createSignal: true, value };
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
