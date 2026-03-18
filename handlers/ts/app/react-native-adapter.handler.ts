// @migrated dsl-constructs 2026-03-18
// ============================================================
// ReactNativeAdapter Handler
//
// Transforms framework-neutral props into React Native bindings:
// onPress, StyleSheet, Touchable/Pressable event model.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const RN_EVENT_MAP: Record<string, string> = {
  onclick: 'onPress',
  ondoubleclick: 'onDoublePress',
  onlongpress: 'onLongPress',
  onchange: 'onChangeText',
  onfocus: 'onFocus',
  onblur: 'onBlur',
  onsubmit: 'onSubmitEditing',
  onscroll: 'onScroll',
  onlayout: 'onLayout',
  onkeydown: 'onKeyPress',
};

const reactNativeAdapterHandlerFunctional: FunctionalConceptHandler = {
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
        const a11yProp = key.replace('aria-', '');
        normalized[`accessible${a11yProp.charAt(0).toUpperCase()}${a11yProp.slice(1)}`] = value;
        continue;
      }
      if (key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['style'] = { __styleSheet: true, className: value }; continue; }
      if (key.startsWith('on')) {
        const rnEvent = RN_EVENT_MAP[key.toLowerCase()];
        if (rnEvent) { normalized[rnEvent] = value; }
        else {
          const eventPart = key.slice(2);
          normalized['on' + eventPart.charAt(0).toUpperCase() + eventPart.slice(1)] = value;
        }
        continue;
      }
      if (key === 'style') { normalized['style'] = { __styleSheet: true, value }; continue; }
      if (key === 'layout') {
        let layoutConfig: Record<string, unknown>;
        try { layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; }
        catch { layoutConfig = { kind: value }; }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const layout: Record<string, string> = {};
        switch (kind) {
          case 'overlay': layout.position = 'absolute'; break;
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
        try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const rnTokens: Record<string, string | number> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          const camelKey = tokenName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          const numMatch = tokenValue.match(/^(\d+(?:\.\d+)?)(px)?$/);
          rnTokens[camelKey] = numMatch ? parseFloat(numMatch[1]) : tokenValue;
        }
        normalized['__themeTokens'] = rnTokens;
        continue;
      }
      normalized[key] = value;
    }

    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const reactNativeAdapterHandler = wrapFunctional(reactNativeAdapterHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { reactNativeAdapterHandlerFunctional };
