// ============================================================
// NextjsAdapter Handler
//
// Transforms framework-neutral props into Next.js React bindings:
// onclick -> onClick, class -> className, marks interactive
// components with 'use client' directive.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

/**
 * Convert a lowercase DOM event name to React camelCase convention.
 */
function toReactEventName(key: string): string {
  if (!key.startsWith('on')) return key;
  const eventPart = key.slice(2);
  return 'on' + eventPart.charAt(0).toUpperCase() + eventPart.slice(1);
}

export const nextjsAdapterHandler: ConceptHandler = {
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
    let hasInteractivity = false;

    for (const [key, value] of Object.entries(parsed)) {
      // ARIA and data-* pass through unchanged
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> className
      if (key === 'class') {
        normalized['className'] = value;
        continue;
      }

      // for -> htmlFor
      if (key === 'for') {
        normalized['htmlFor'] = value;
        continue;
      }

      // Event handlers: onclick -> onClick, mark as interactive
      if (key.startsWith('on')) {
        hasInteractivity = true;
        const reactName = toReactEventName(key);
        normalized[reactName] = { __syntheticEvent: true, handler: value };
        continue;
      }

      // style as object pass-through
      if (key === 'style' && typeof value === 'string') {
        normalized['style'] = { __cssText: value };
        continue;
      }

      // Layout -> CSS flexbox/grid container
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
        const layout: Record<string, string> = {};
        switch (kind) {
          case 'grid':
            layout.display = 'grid';
            if (columns) layout.gridTemplateColumns = columns;
            if (rows) layout.gridTemplateRows = rows;
            break;
          case 'split':
            layout.display = 'flex';
            layout.flexDirection = 'row';
            break;
          case 'overlay':
            layout.position = 'relative';
            break;
          case 'flow':
            layout.display = 'flex';
            layout.flexWrap = 'wrap';
            break;
          case 'sidebar':
            layout.display = 'grid';
            layout.gridTemplateColumns = 'auto 1fr';
            break;
          case 'center':
            layout.display = 'flex';
            layout.justifyContent = 'center';
            layout.alignItems = 'center';
            break;
          case 'stack':
          default:
            layout.display = 'flex';
            layout.flexDirection = direction;
            break;
        }
        if (gap) layout.gap = gap;
        normalized['__layout'] = layout;
        continue;
      }

      // Theme -> CSS custom properties
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const cssVars: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          cssVars[`--${tokenName}`] = tokenValue;
        }
        normalized['__themeTokens'] = cssVars;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    // Mark interactive components with 'use client' directive
    if (hasInteractivity) {
      normalized['__useClient'] = true;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
