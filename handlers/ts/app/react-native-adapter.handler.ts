// ============================================================
// ReactNativeAdapter Handler
//
// Transforms framework-neutral props into React Native bindings:
// onPress, StyleSheet, Touchable/Pressable event model.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const RN_EVENT_MAP: Record<string, string> = {
  onclick: 'onPress',
  ondoubleclick: 'onDoublePress',
  onlongpress: 'onLongPress',
  onchange: 'onChangeText',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onsubmit: 'onSubmitEditing',
  onscroll: 'onScroll',
  onlayout: 'onLayout',
  onkeydown: 'onKeyPress',
};

export const reactNativeAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* -> React Native accessibility props
      if (key.startsWith('aria-')) {
        const a11yProp = key.replace('aria-', '');
        normalized[`accessible${a11yProp.charAt(0).toUpperCase()}${a11yProp.slice(1)}`] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> React Native does not use className; convert to style reference
      if (key === 'class') {
        normalized['style'] = { __styleSheet: true, className: value };
        continue;
      }

      // Event handlers -> React Native event props
      if (key.startsWith('on')) {
        const rnEvent = RN_EVENT_MAP[key.toLowerCase()];
        if (rnEvent) {
          normalized[rnEvent] = value;
        } else {
          // CamelCase fallback for unknown events
          const eventPart = key.slice(2);
          normalized['on' + eventPart.charAt(0).toUpperCase() + eventPart.slice(1)] = value;
        }
        continue;
      }

      // style -> React Native StyleSheet object
      if (key === 'style') {
        normalized['style'] = { __styleSheet: true, value };
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
