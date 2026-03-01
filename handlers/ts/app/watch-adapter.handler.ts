// ============================================================
// WatchAdapter Handler
//
// Transforms framework-neutral props into watchOS bindings:
// reduced interaction set for small watch displays,
// tap gestures, Digital Crown input.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

// watchOS supports a reduced event set due to small screen
const WATCH_EVENT_MAP: Record<string, string> = {
  onclick: 'onTapGesture',
  onlongpress: 'onLongPressGesture',
  onchange: 'onChange',
  onappear: 'onAppear',
  ondisappear: 'onDisappear',
  onscroll: 'digitalCrownRotation',
};

// Events not supported on watch platform
const UNSUPPORTED_WATCH_EVENTS = new Set([
  'ondoubleclick', 'ondrag', 'ondrop', 'onhover',
  'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeyup',
  'onresize', 'oncontextmenu',
]);

export const watchAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through as accessibility modifiers
      if (key.startsWith('aria-')) {
        const a11yProp = key.replace('aria-', 'accessibility');
        normalized[a11yProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> watch style class reference
      if (key === 'class') {
        normalized['__styleClass'] = value;
        continue;
      }

      // Event handlers -> watchOS events (reduced set)
      if (key.startsWith('on')) {
        if (UNSUPPORTED_WATCH_EVENTS.has(key.toLowerCase())) {
          normalized[`__unsupported:${key}`] = value;
          continue;
        }
        const watchEvent = WATCH_EVENT_MAP[key.toLowerCase()];
        if (watchEvent) {
          normalized[watchEvent] = value;
        } else {
          const eventName = key.slice(2).toLowerCase();
          normalized[`on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`] = value;
        }
        continue;
      }

      // style -> watch view modifiers (compact)
      if (key === 'style') {
        normalized['__modifiers'] = value;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
