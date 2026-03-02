// ============================================================
// GTKAdapter Handler
//
// Transforms framework-neutral props into GTK bindings:
// g_signal_connect, widget property assignments.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const GTK_SIGNAL_MAP: Record<string, string> = {
  onclick: 'clicked',
  onchange: 'changed',
  onactivate: 'activate',
  onfocus: 'focus-in-event',
  onblur: 'focus-out-event',
  onkeydown: 'key-press-event',
  onkeyup: 'key-release-event',
  onmouseenter: 'enter-notify-event',
  onmouseleave: 'leave-notify-event',
  onscroll: 'scroll-event',
  ondestroy: 'destroy',
  onshow: 'show',
  onhide: 'hide',
  onresize: 'size-allocate',
};

export const gtkAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through as accessibility properties
      if (key.startsWith('aria-')) {
        const atkProp = key.replace('aria-', 'atk-');
        normalized[atkProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> GTK CSS class
      if (key === 'class') {
        normalized['__cssClass'] = value;
        continue;
      }

      // Event handlers -> g_signal_connect
      if (key.startsWith('on')) {
        const signal = GTK_SIGNAL_MAP[key.toLowerCase()];
        if (signal) {
          normalized[`g_signal_connect:${signal}`] = {
            g_signal_connect: { signal, handler: value },
          };
        } else {
          const eventName = key.slice(2).toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          normalized[`g_signal_connect:${eventName}`] = {
            g_signal_connect: { signal: eventName, handler: value },
          };
        }
        continue;
      }

      // style -> GTK CSS properties
      if (key === 'style') {
        normalized['__cssProperties'] = value;
        continue;
      }

      // Layout -> GTK container widgets (GtkBox, GtkGrid, GtkPaned, etc.)
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
        switch (kind) {
          case 'grid':
            layout.container = 'GtkGrid';
            break;
          case 'split':
            layout.container = 'GtkPaned';
            break;
          case 'overlay':
            layout.container = 'GtkOverlay';
            break;
          case 'flow':
            layout.container = 'GtkFlowBox';
            break;
          case 'sidebar':
            layout.container = 'GtkPaned';
            break;
          case 'center':
            layout.container = 'GtkBox';
            layout.halign = 'CENTER';
            layout.valign = 'CENTER';
            break;
          case 'stack':
          default:
            layout.container = 'GtkBox';
            layout.orientation = direction === 'row' ? 'HORIZONTAL' : 'VERTICAL';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__layout'] = layout;
        continue;
      }

      // Theme -> GTK CSS provider entries (@define-color, font-family)
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const gtkTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) {
            gtkTokens[`@define-color:${tokenName.replace('color-', '')}`] = tokenValue;
          } else if (tokenName.startsWith('font-')) {
            gtkTokens[tokenName] = tokenValue;
          } else {
            gtkTokens[tokenName] = tokenValue;
          }
        }
        normalized['__themeTokens'] = gtkTokens;
        continue;
      }

      // All other props -> widget properties (g_object_set)
      normalized[key] = { g_object_set: { property: key, value } };
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
