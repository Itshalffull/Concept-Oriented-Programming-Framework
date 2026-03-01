// ============================================================
// BrowserAdapter Handler
//
// Transforms framework-neutral props into browser Web API bindings:
// addEventListener, DOM events, Web Components attributes.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

export const browserAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through unchanged (native browser attributes)
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> classList manipulation
      if (key === 'class') {
        const classes = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : value;
        normalized['classList'] = classes;
        continue;
      }

      // Event handlers -> addEventListener
      if (key.startsWith('on')) {
        const eventType = key.slice(2).toLowerCase();
        normalized[`addEventListener:${eventType}`] = {
          addEventListener: { type: eventType, listener: value },
        };
        continue;
      }

      // style -> CSSStyleDeclaration assignments
      if (key === 'style') {
        normalized['style'] = { __cssStyleDeclaration: true, value };
        continue;
      }

      // slot -> Web Component slot attribute
      if (key === 'slot') {
        normalized['slot'] = value;
        continue;
      }

      // part -> Web Component CSS part
      if (key === 'part') {
        normalized['part'] = value;
        continue;
      }

      // All other props -> setAttribute
      normalized[key] = { setAttribute: { name: key, value } };
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
