// ============================================================
// WinUIAdapter Handler
//
// Transforms framework-neutral props into WinUI/XAML bindings:
// event handlers, dependency properties, XAML attribute syntax.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const WINUI_EVENT_MAP: Record<string, string> = {
  onclick: 'Click',
  ondoubleclick: 'DoubleTapped',
  onchange: 'TextChanged',
  onfocus: 'GotFocus',
  onblur: 'LostFocus',
  onkeydown: 'KeyDown',
  onkeyup: 'KeyUp',
  onpointerenter: 'PointerEntered',
  onpointerleave: 'PointerExited',
  onpointerdown: 'PointerPressed',
  onpointerup: 'PointerReleased',
  onloaded: 'Loaded',
  onunloaded: 'Unloaded',
  onscroll: 'ViewChanged',
  ondrag: 'DragStarting',
  ondrop: 'Drop',
};

export const winUIAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* -> AutomationProperties
      if (key.startsWith('aria-')) {
        const automationProp = key.replace('aria-', 'AutomationProperties.');
        normalized[automationProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> XAML Style resource
      if (key === 'class') {
        normalized['Style'] = { __xamlStyle: true, value };
        continue;
      }

      // Event handlers -> WinUI event names
      if (key.startsWith('on')) {
        const winuiEvent = WINUI_EVENT_MAP[key.toLowerCase()];
        if (winuiEvent) {
          normalized[winuiEvent] = value;
        } else {
          // PascalCase fallback for unknown events
          const eventName = key.slice(2);
          normalized[eventName.charAt(0).toUpperCase() + eventName.slice(1)] = value;
        }
        continue;
      }

      // style -> XAML dependency properties
      if (key === 'style') {
        normalized['__dependencyProperties'] = value;
        continue;
      }

      // All other props -> XAML attributes / dependency properties
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
