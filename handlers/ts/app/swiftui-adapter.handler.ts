// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SwiftUIAdapter Handler
//
// Transforms framework-neutral props into SwiftUI bindings:
// .onTapGesture, view modifiers, VStack/HStack layout.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const SWIFTUI_EVENT_MAP: Record<string, string> = {
  onclick: 'onTapGesture', ondoubleclick: 'onTapGesture(count: 2)', onlongpress: 'onLongPressGesture',
  ondrag: 'onDrag', ondrop: 'onDrop', onappear: 'onAppear', ondisappear: 'onDisappear',
  onchange: 'onChange', onsubmit: 'onSubmit',
};

const _swiftUIAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(props); } catch {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-')) { normalized[key.replace('aria-', 'accessibility')] = value; continue; }
      if (key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['__styleClass'] = value; continue; }
      if (key.startsWith('on')) {
        const swiftuiEvent = SWIFTUI_EVENT_MAP[key.toLowerCase()];
        if (swiftuiEvent) { normalized[swiftuiEvent] = value; }
        else { const eventName = key.slice(2).toLowerCase(); normalized[`on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`] = value; }
        continue;
      }
      if (key === 'style') { normalized['__modifiers'] = value; continue; }
      if (key === 'layout') {
        let layoutConfig: Record<string, unknown>;
        try { layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { layoutConfig = { kind: value }; }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const columns = layoutConfig.columns as string | undefined;
        const layout: Record<string, unknown> = {};
        switch (kind) {
          case 'grid': layout.container = 'LazyVGrid'; if (columns) layout.columns = columns; break;
          case 'split': layout.container = 'HSplitView'; break;
          case 'overlay': layout.container = 'ZStack'; break;
          case 'flow': layout.container = 'LazyVGrid'; layout.columns = 'adaptive'; break;
          case 'sidebar': layout.container = 'NavigationSplitView'; break;
          case 'center': layout.container = direction === 'row' ? 'HStack' : 'VStack'; layout.modifier = '.center'; break;
          case 'stack': default: layout.container = direction === 'row' ? 'HStack' : 'VStack'; break;
        }
        if (gap) layout.spacing = gap;
        normalized['__container'] = layout;
        continue;
      }
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const swiftuiTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) swiftuiTokens[`Color:${tokenName.replace('color-', '')}`] = tokenValue;
          else if (tokenName.startsWith('font-')) swiftuiTokens[`Font:${tokenName.replace('font-', '')}`] = tokenValue;
          else swiftuiTokens[tokenName] = tokenValue;
        }
        normalized['__themeTokens'] = swiftuiTokens;
        continue;
      }
      normalized[key] = value;
    }

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const swiftUIAdapterHandler = autoInterpret(_swiftUIAdapterHandler);

