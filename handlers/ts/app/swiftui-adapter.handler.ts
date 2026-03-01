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
        normalized['__container'] = value; // "vstack", "hstack", "zstack"
        continue;
      }

      // All other props pass through as view modifiers
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
