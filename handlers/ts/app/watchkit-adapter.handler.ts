// ============================================================
// WatchKitAdapter Handler
//
// Transforms framework-neutral props into legacy WatchKit bindings:
// WKInterfaceObject actions, IBOutlet/IBAction patterns.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const WATCHKIT_ACTION_MAP: Record<string, string> = {
  onclick: 'IBAction:buttonTapped',
  onchange: 'IBAction:valueChanged',
  onselect: 'IBAction:itemSelected',
};

// WatchKit has a very limited event set
const UNSUPPORTED_WATCHKIT_EVENTS = new Set([
  'ondoubleclick', 'onlongpress', 'ondrag', 'ondrop',
  'onhover', 'onmouseenter', 'onmouseleave', 'onkeydown',
  'onkeyup', 'onresize', 'oncontextmenu', 'onscroll',
  'onfocus', 'onblur',
]);

export const watchKitAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through as accessibility
      if (key.startsWith('aria-')) {
        const a11yProp = key.replace('aria-', 'accessibility');
        normalized[a11yProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> WKInterfaceObject type
      if (key === 'class') {
        normalized['__interfaceObject'] = value;
        continue;
      }

      // Event handlers -> IBAction pattern (very limited set)
      if (key.startsWith('on')) {
        if (UNSUPPORTED_WATCHKIT_EVENTS.has(key.toLowerCase())) {
          normalized[`__unsupported:${key}`] = value;
          continue;
        }
        const wkAction = WATCHKIT_ACTION_MAP[key.toLowerCase()];
        if (wkAction) {
          normalized[wkAction] = { __ibAction: true, handler: value };
        } else {
          const eventName = key.slice(2).toLowerCase();
          normalized[`IBAction:${eventName}`] = { __ibAction: true, handler: value };
        }
        continue;
      }

      // style -> WKInterfaceObject property setters
      if (key === 'style') {
        normalized['__wkProperties'] = value;
        continue;
      }

      // All other props -> outlet configuration
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
