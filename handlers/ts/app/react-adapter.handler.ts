// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ReactAdapter Handler
//
// Transforms framework-neutral props into React-specific bindings:
// onclick -> onClick, class -> className, SyntheticEvent callbacks.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function toReactEventName(key: string): string {
  if (!key.startsWith('on')) return key;
  const eventPart = key.slice(2);
  return 'on' + eventPart.charAt(0).toUpperCase() + eventPart.slice(1);
}

const _reactAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    let p = createProgram();

    if (!props || props.trim() === '') {
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }
      if (key === 'class') { normalized['className'] = value; continue; }
      if (key === 'for') { normalized['htmlFor'] = value; continue; }
      if (key.startsWith('on')) {
        const reactName = toReactEventName(key);
        normalized[reactName] = { __syntheticEvent: true, handler: value };
        continue;
      }
      if (key === 'style' && typeof value === 'string') {
        normalized['style'] = { __cssText: value };
        continue;
      }
      if (key === 'layout') {
        let layoutConfig: Record<string, unknown>;
        try {
          layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { layoutConfig = { kind: value }; }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const columns = layoutConfig.columns as string | undefined;
        const rows = layoutConfig.rows as string | undefined;
        const layout: Record<string, string> = {};
        switch (kind) {
          case 'grid': layout.display = 'grid'; if (columns) layout.gridTemplateColumns = columns; if (rows) layout.gridTemplateRows = rows; break;
          case 'split': layout.display = 'flex'; layout.flexDirection = 'row'; break;
          case 'overlay': layout.position = 'relative'; break;
          case 'flow': layout.display = 'flex'; layout.flexWrap = 'wrap'; break;
          case 'sidebar': layout.display = 'grid'; layout.gridTemplateColumns = 'auto 1fr'; break;
          case 'center': layout.display = 'flex'; layout.justifyContent = 'center'; layout.alignItems = 'center'; break;
          case 'stack': default: layout.display = 'flex'; layout.flexDirection = direction; break;
        }
        if (gap) layout.gap = gap;
        normalized['__layout'] = layout;
        continue;
      }
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const cssVars: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) { cssVars[`--${tokenName}`] = tokenValue; }
        normalized['__themeTokens'] = cssVars;
        continue;
      }
      normalized[key] = value;
    }

    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const reactAdapterHandler = autoInterpret(_reactAdapterHandler);

