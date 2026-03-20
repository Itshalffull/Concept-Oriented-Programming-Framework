// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// InkAdapter Handler — Transforms framework-neutral props into Ink (terminal React) bindings
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const INK_EVENT_MAP: Record<string, string> = {
  onclick: 'onPress',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onkeydown: 'onKeyDown',
  onsubmit: 'onSubmit',
};

const _inkAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-') || key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['style'] = { __terminalStyle: true, className: value }; continue; }
      if (key.startsWith('on')) {
        const inkEvent = INK_EVENT_MAP[key.toLowerCase()];
        if (inkEvent) { normalized[inkEvent] = value; } else { normalized[`__unsupported:${key}`] = value; }
        continue;
      }
      if (key === 'style') { normalized['style'] = value; continue; }
      if (key === 'color' || key === 'backgroundColor') { normalized[key] = value; continue; }
      if (key === 'layout') {
        let layoutConfig: Record<string, unknown>;
        try { layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; }
        catch { layoutConfig = { kind: value }; }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const layout: Record<string, string> = {};
        switch (kind) {
          case 'flow': layout.flexDirection = 'row'; layout.flexWrap = 'wrap'; break;
          case 'center': layout.justifyContent = 'center'; layout.alignItems = 'center'; break;
          case 'stack': default: layout.flexDirection = direction; break;
        }
        if (gap) layout.gap = gap;
        normalized['__layout'] = layout;
        continue;
      }
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; }
        catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const termTokens: Record<string, string | boolean> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) { termTokens[tokenName.replace('color-', '')] = tokenValue; }
          else if (tokenName.startsWith('spacing-') || tokenName.startsWith('dimension-')) { termTokens[tokenName] = tokenValue; }
        }
        normalized['__themeTokens'] = termTokens;
        continue;
      }
      normalized[key] = value;
    }

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const inkAdapterHandler = autoInterpret(_inkAdapterHandler);

