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

      // Layout -> WinUI/XAML panel containers
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
        const rows = layoutConfig.rows as string | undefined;
        const layout: Record<string, unknown> = {};
        switch (kind) {
          case 'grid':
            layout.container = 'Grid';
            if (columns) layout.columnDefinitions = columns;
            if (rows) layout.rowDefinitions = rows;
            break;
          case 'split':
            layout.container = 'SplitView';
            break;
          case 'overlay':
            layout.container = 'Canvas';
            break;
          case 'flow':
            layout.container = 'ItemsWrapGrid';
            break;
          case 'sidebar':
            layout.container = 'NavigationView';
            break;
          case 'center':
            layout.container = 'Grid';
            layout.horizontalAlignment = 'Center';
            layout.verticalAlignment = 'Center';
            break;
          case 'stack':
          default:
            layout.container = 'StackPanel';
            layout.orientation = direction === 'row' ? 'Horizontal' : 'Vertical';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__layout'] = layout;
        continue;
      }

      // Theme -> XAML ThemeResource keys
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const xamlTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          // Convert token-name to PascalCase: color-primary -> ColorPrimary
          const pascalKey = tokenName.replace(/(^|-)([a-z])/g, (_, _sep, c) => c.toUpperCase());
          xamlTokens[`ThemeResource:${pascalKey}`] = tokenValue;
        }
        normalized['__themeTokens'] = xamlTokens;
        continue;
      }

      // All other props -> XAML attributes / dependency properties
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
