// ============================================================
// VanillaAdapter Handler
//
// Transforms framework-neutral props into vanilla DOM APIs:
// addEventListener, classList, style property assignments.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

export const vanillaAdapterHandler: ConceptHandler = {
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

      // class -> classList array
      if (key === 'class') {
        const classes = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : value;
        normalized['classList'] = classes;
        continue;
      }

      // Event handlers: onclick -> addEventListener({ event: 'click', handler })
      if (key.startsWith('on')) {
        const eventName = key.slice(2).toLowerCase();
        normalized[`addEventListener:${eventName}`] = {
          addEventListener: { event: eventName, handler: value },
        };
        continue;
      }

      // style -> style property assignments
      if (key === 'style') {
        normalized['style'] = { __propertyAssignment: true, value };
        continue;
      }

      // id, name, etc. -> setAttribute
      normalized[key] = { setAttribute: { name: key, value } };
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
