// ============================================================
// SwiftUIAdapter Handler
//
// Transforms framework-neutral props into SwiftUI bindings:
// .onTapGesture, view modifiers, VStack/HStack layout.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const SWIFTUI_EVENT_MAP: Record<string, string> = {
  onclick: 'onTapGesture',
  ondoubleclick: 'onTapGesture(count: 2)',
  onlongpress: 'onLongPressGesture',
  ondrag: 'onDrag',
  ondrop: 'onDrop',
  onappear: 'onAppear',
  ondisappear: 'onDisappear',
  onchange: 'onChange',
  onsubmit: 'onSubmit',
};

export const swiftUIAdapterHandler: ConceptHandler = {
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
        const accessibilityProp = key.replace('aria-', 'accessibility');
        normalized[accessibilityProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> SwiftUI does not use class; map to custom modifier
      if (key === 'class') {
        normalized['__styleClass'] = value;
        continue;
      }

      // Event handlers -> SwiftUI gesture/lifecycle modifiers
      if (key.startsWith('on')) {
        const swiftuiEvent = SWIFTUI_EVENT_MAP[key.toLowerCase()];
        if (swiftuiEvent) {
          normalized[swiftuiEvent] = value;
        } else {
          // Fallback: generic action modifier
          const eventName = key.slice(2).toLowerCase();
          normalized[`on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`] = value;
        }
        continue;
      }

      // style -> SwiftUI view modifiers
      if (key === 'style') {
        normalized['__modifiers'] = value;
        continue;
      }

      // Layout props -> SwiftUI stack containers
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
        const columns = layoutConfig.columns as string | undefined;
        const layout: Record<string, unknown> = {};
        switch (kind) {
          case 'grid':
            layout.container = 'LazyVGrid';
            if (columns) layout.columns = columns;
            break;
          case 'split':
            layout.container = 'HSplitView';
            break;
          case 'overlay':
            layout.container = 'ZStack';
            break;
          case 'flow':
            layout.container = 'LazyVGrid';
            layout.columns = 'adaptive';
            break;
          case 'sidebar':
            layout.container = 'NavigationSplitView';
            break;
          case 'center':
            layout.container = direction === 'row' ? 'HStack' : 'VStack';
            layout.modifier = '.center';
            break;
          case 'stack':
          default:
            layout.container = direction === 'row' ? 'HStack' : 'VStack';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__container'] = layout;
        continue;
      }

      // Theme -> SwiftUI asset references (Color:, Font:)
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const swiftuiTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) {
            swiftuiTokens[`Color:${tokenName.replace('color-', '')}`] = tokenValue;
          } else if (tokenName.startsWith('font-')) {
            swiftuiTokens[`Font:${tokenName.replace('font-', '')}`] = tokenValue;
          } else {
            swiftuiTokens[tokenName] = tokenValue;
          }
        }
        normalized['__themeTokens'] = swiftuiTokens;
        continue;
      }

      // All other props pass through as view modifiers
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
