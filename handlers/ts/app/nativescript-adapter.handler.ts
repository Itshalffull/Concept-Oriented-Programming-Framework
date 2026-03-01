// ============================================================
// NativeScriptAdapter Handler
//
// Transforms framework-neutral props into NativeScript bindings:
// on({ tap: handler }), native view properties.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const NATIVESCRIPT_EVENT_MAP: Record<string, string> = {
  onclick: 'tap',
  ondoubleclick: 'doubleTap',
  onlongpress: 'longPress',
  onswipe: 'swipe',
  onpan: 'pan',
  onpinch: 'pinch',
  onrotation: 'rotation',
  ontouch: 'touch',
  onloaded: 'loaded',
  onunloaded: 'unloaded',
  onchange: 'propertyChange',
  onfocus: 'focus',
  onblur: 'blur',
};

export const nativeScriptAdapterHandler: ConceptHandler = {
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
        const a11yProp = key.replace('aria-', 'accessible-');
        normalized[a11yProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> NativeScript CSS class
      if (key === 'class') {
        normalized['cssClass'] = value;
        continue;
      }

      // Event handlers -> NativeScript on({ event: handler })
      if (key.startsWith('on')) {
        const nsEvent = NATIVESCRIPT_EVENT_MAP[key.toLowerCase()];
        if (nsEvent) {
          normalized[`on:${nsEvent}`] = { on: { [nsEvent]: value } };
        } else {
          const eventName = key.slice(2).toLowerCase();
          normalized[`on:${eventName}`] = { on: { [eventName]: value } };
        }
        continue;
      }

      // style -> NativeScript inline style
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

      // All other props -> native view property
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
