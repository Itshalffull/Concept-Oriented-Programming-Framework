// ============================================================
// VanillaAdapter Handler
//
// Transforms framework-neutral props into vanilla DOM APIs:
// addEventListener, classList, style property assignments.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

export const vanillaAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through unchanged
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> classList array
      if (key === 'class') {
        const classes = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : value;
        normalized['classList'] = classes;
        continue;
      }

      // Event handlers: onclick -> addEventListener({ event: 'click', handler })
      if (key.startsWith('on')) {
        const eventName = key.slice(2).toLowerCase();
        normalized[`addEventListener:${eventName}`] = {
          addEventListener: { event: eventName, handler: value },
        };
        continue;
      }

      // style -> style property assignments
      if (key === 'style') {
        normalized['style'] = { __propertyAssignment: true, value };
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

      // id, name, etc. -> setAttribute
      normalized[key] = { setAttribute: { name: key, value } };
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
