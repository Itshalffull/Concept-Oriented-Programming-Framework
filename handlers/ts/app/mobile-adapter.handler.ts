// @migrated dsl-constructs 2026-03-18
// ============================================================
// MobileAdapter Handler
//
// Transforms framework-neutral props into mobile bindings:
// touch events, gesture handlers, press/long-press model.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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

const _mobileAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    let p = createProgram();

    if (!props || props.trim() === '') {
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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

    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const mobileAdapterHandler = autoInterpret(_mobileAdapterHandler);

