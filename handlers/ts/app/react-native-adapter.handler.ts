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

      // Layout -> React Native flexbox (limited: no grid/split/sidebar)
      if (key === 'layout') {
        let layoutConfig: Record<string, unknown>;
        try {
          layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch {
          layoutConfig = { kind: value };
        }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const layout: Record<string, string> = {};
        switch (kind) {
          case 'overlay':
            layout.position = 'absolute';
            break;
          case 'flow':
            layout.flexDirection = 'row';
            layout.flexWrap = 'wrap';
            break;
          case 'center':
            layout.justifyContent = 'center';
            layout.alignItems = 'center';
            break;
          case 'stack':
          default:
            // grid, split, sidebar fall back to stack in RN
            layout.flexDirection = direction;
            break;
        }
        if (gap) layout.gap = gap;
        normalized['__layout'] = layout;
        continue;
      }

      // Theme -> camel-cased flat values (dimensions parsed to numbers)
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const rnTokens: Record<string, string | number> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          // Convert token-name to camelCase: color-primary -> colorPrimary
          const camelKey = tokenName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          // Parse pure numeric or px values to numbers
          const numMatch = tokenValue.match(/^(\d+(?:\.\d+)?)(px)?$/);
          rnTokens[camelKey] = numMatch ? parseFloat(numMatch[1]) : tokenValue;
        }
        normalized['__themeTokens'] = rnTokens;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
