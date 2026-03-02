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

      // Layout -> WKInterfaceGroup (limited: stack and center only)
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
        const layout: Record<string, unknown> = {};
        // WatchKit only supports WKInterfaceGroup with vertical/horizontal
        switch (kind) {
          case 'center':
          case 'stack':
          default:
            // grid, split, overlay, flow, sidebar all unsupported — fallback to group
            layout.container = 'WKInterfaceGroup';
            layout.orientation = direction === 'row' ? 'horizontal' : 'vertical';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__layout'] = layout;
        continue;
      }

      // Theme -> flat key-value (limited: color + dimension tokens only)
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const wkTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) {
            // color-primary -> primaryColor
            const name = tokenName.replace('color-', '');
            wkTokens[`${name}Color`] = tokenValue;
          } else if (tokenName.startsWith('spacing-') || tokenName.startsWith('dimension-')) {
            wkTokens[tokenName] = tokenValue;
          }
        }
        normalized['__themeTokens'] = wkTokens;
        continue;
      }

      // All other props -> outlet configuration
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
