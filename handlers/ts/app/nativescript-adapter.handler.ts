// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// NativeScriptAdapter Handler
//
// Transforms framework-neutral props into NativeScript bindings:
// on({ tap: handler }), native view properties.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const NATIVESCRIPT_EVENT_MAP: Record<string, string> = {
  onclick: 'tap',
  ondoubleclick: 'doubleTap',
  onlongpress: 'longPress',
  onswipe: 'swipe',
  onpan: 'pan',
  onpinch: 'pinch',
  onrotation: 'rotation',
  ontouch: 'touch',
  onloaded: 'loaded',
  onunloaded: 'unloaded',
  onchange: 'propertyChange',
  onfocus: 'focus',
  onblur: 'blur',
};

const _nativeScriptAdapterHandler: FunctionalConceptHandler = {
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
      if (key.startsWith('aria-')) {
        const a11yProp = key.replace('aria-', 'accessible-');
        normalized[a11yProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      if (key === 'class') {
        normalized['cssClass'] = value;
        continue;
      }

      if (key.startsWith('on')) {
        const nsEvent = NATIVESCRIPT_EVENT_MAP[key.toLowerCase()];
        if (nsEvent) {
          normalized[`on:${nsEvent}`] = { on: { [nsEvent]: value } };
        } else {
          const eventName = key.slice(2).toLowerCase();
          normalized[`on:${eventName}`] = { on: { [eventName]: value } };
        }
        continue;
      }

      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }

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
        const layout: Record<string, unknown> = {};
        switch (kind) {
          case 'grid':
            layout.container = 'GridLayout';
            if (columns) layout.columns = columns;
            break;
          case 'split':
            layout.container = 'GridLayout';
            layout.columns = '*, *';
            break;
          case 'overlay':
            layout.container = 'AbsoluteLayout';
            break;
          case 'flow':
            layout.container = 'WrapLayout';
            break;
          case 'sidebar':
            layout.container = 'SideDrawer';
            break;
          case 'center':
            layout.container = 'GridLayout';
            layout.horizontalAlignment = 'center';
            layout.verticalAlignment = 'center';
            break;
          case 'stack':
          default:
            layout.container = 'StackLayout';
            if (direction === 'row') layout.orientation = 'horizontal';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__layout'] = layout;
        continue;
      }

      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const nsTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          nsTokens[`--ns-${tokenName}`] = tokenValue;
        }
        normalized['__themeTokens'] = nsTokens;
        continue;
      }

      normalized[key] = value;
    }

    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const nativeScriptAdapterHandler = autoInterpret(_nativeScriptAdapterHandler);

