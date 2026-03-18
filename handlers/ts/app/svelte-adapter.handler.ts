// @migrated dsl-constructs 2026-03-18
// ============================================================
// SvelteAdapter Handler
//
// Transforms framework-neutral props into Svelte bindings:
// on:click handlers, class directive, bind: directives.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';

export const svelteAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      // ARIA and data-* pass through unchanged
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> Svelte class directive
      if (key === 'class') {
        normalized['class'] = value;
        continue;
      }

      // Event handlers: onclick -> on:click
      if (key.startsWith('on')) {
        const eventName = key.slice(2).toLowerCase();
        normalized[`on:${eventName}`] = value;
        continue;
      }

      // Bind directives: bind:value, bind:checked, etc.
      if (key.startsWith('bind:')) {
        normalized[key] = value;
        continue;
      }

      // style -> Svelte style prop
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

      // Two-way binding props (prefixed with $) -> bind: directive
      if (key.startsWith('$')) {
        const propName = key.slice(1);
        normalized[`bind:${propName}`] = value;
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

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
