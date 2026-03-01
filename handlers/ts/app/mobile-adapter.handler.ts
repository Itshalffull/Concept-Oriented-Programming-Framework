// ============================================================
// MobileAdapter Handler
//
// Transforms framework-neutral props into mobile bindings:
// touch events, gesture handlers, press/long-press model.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const MOBILE_EVENT_MAP: Record<string, string> = {
  onclick: 'onPress',
  ondoubleclick: 'onDoublePress',
  onlongpress: 'onLongPress',
  onswipe: 'onSwipe',
  onswipeleft: 'onSwipeLeft',
  onswiperight: 'onSwipeRight',
  onswipeup: 'onSwipeUp',
  onswipedown: 'onSwipeDown',
  onpan: 'onPan',
  onpinch: 'onPinch',
  onrotate: 'onRotate',
  onchange: 'onValueChange',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onscroll: 'onScroll',
  onlayout: 'onLayout',
};

export const mobileAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through as accessibility props
      if (key.startsWith('aria-')) {
        const a11yProp = key.replace('aria-', 'accessible-');
        normalized[a11yProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> mobile style reference
      if (key === 'class') {
        normalized['style'] = { __mobileStyle: true, className: value };
        continue;
      }

      // Event handlers -> mobile gesture/touch events
      if (key.startsWith('on')) {
        const mobileEvent = MOBILE_EVENT_MAP[key.toLowerCase()];
        if (mobileEvent) {
          normalized[mobileEvent] = value;
          // Add long-press null default when press is set
          if (mobileEvent === 'onPress') {
            normalized['onLongPress'] = normalized['onLongPress'] ?? null;
          }
        } else {
          const eventName = key.slice(2);
          normalized['on' + eventName.charAt(0).toUpperCase() + eventName.slice(1)] = value;
        }
        continue;
      }

      // style -> native style object
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
