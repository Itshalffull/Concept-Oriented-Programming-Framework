// ============================================================
// GTKAdapter Handler
//
// Transforms framework-neutral props into GTK bindings:
// g_signal_connect, widget property assignments.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const GTK_SIGNAL_MAP: Record<string, string> = {
  onclick: 'clicked',
  onchange: 'changed',
  onactivate: 'activate',
  onfocus: 'focus-in-event',
  onblur: 'focus-out-event',
  onkeydown: 'key-press-event',
  onkeyup: 'key-release-event',
  onmouseenter: 'enter-notify-event',
  onmouseleave: 'leave-notify-event',
  onscroll: 'scroll-event',
  ondestroy: 'destroy',
  onshow: 'show',
  onhide: 'hide',
  onresize: 'size-allocate',
};

export const gtkAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through as accessibility properties
      if (key.startsWith('aria-')) {
        const atkProp = key.replace('aria-', 'atk-');
        normalized[atkProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> GTK CSS class
      if (key === 'class') {
        normalized['__cssClass'] = value;
        continue;
      }

      // Event handlers -> g_signal_connect
      if (key.startsWith('on')) {
        const signal = GTK_SIGNAL_MAP[key.toLowerCase()];
        if (signal) {
          normalized[`g_signal_connect:${signal}`] = {
            g_signal_connect: { signal, handler: value },
          };
        } else {
          const eventName = key.slice(2).toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          normalized[`g_signal_connect:${eventName}`] = {
            g_signal_connect: { signal: eventName, handler: value },
          };
        }
        continue;
      }

      // style -> GTK CSS properties
      if (key === 'style') {
        normalized['__cssProperties'] = value;
        continue;
      }

      // All other props -> widget properties (g_object_set)
      normalized[key] = { g_object_set: { property: key, value } };
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
