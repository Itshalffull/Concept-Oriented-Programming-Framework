// ============================================================
// InkAdapter Handler
//
// Transforms framework-neutral props into Ink (terminal React)
// bindings: terminal-compatible event handlers, Box/Text styles.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const INK_EVENT_MAP: Record<string, string> = {
  onclick: 'onPress',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onkeydown: 'onKeyDown',
  onsubmit: 'onSubmit',
};

export const inkAdapterHandler: ConceptHandler = {
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

      // class -> Ink style object (no CSS classes in terminal)
      if (key === 'class') {
        normalized['style'] = { __terminalStyle: true, className: value };
        continue;
      }

      // Event handlers -> terminal-compatible handlers
      if (key.startsWith('on')) {
        const inkEvent = INK_EVENT_MAP[key.toLowerCase()];
        if (inkEvent) {
          normalized[inkEvent] = value;
        } else {
          // Unsupported events in terminal context are dropped with a marker
          normalized[`__unsupported:${key}`] = value;
        }
        continue;
      }

      // style -> Ink Box/Text style props
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

      // Color props -> Ink color system
      if (key === 'color' || key === 'backgroundColor') {
        normalized[key] = value;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
