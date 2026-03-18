// @migrated dsl-constructs 2026-03-18
// ============================================================
// ComposeAdapter Handler
//
// Transforms framework-neutral props into Jetpack Compose bindings:
// Modifier chains, onClick, Composable function parameters.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const COMPOSE_MODIFIER_MAP: Record<string, string> = {
  onclick: 'Modifier.clickable',
  onlongpress: 'Modifier.combinedClickable(onLongClick)',
  ondoubleclick: 'Modifier.combinedClickable(onDoubleClick)',
  ondrag: 'Modifier.draggable',
  onscroll: 'Modifier.verticalScroll',
  onfocus: 'Modifier.onFocusChanged',
};

export const composeAdapterHandler: FunctionalConceptHandler = {
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
      if (key.startsWith('aria-')) {
        const semanticProp = key.replace('aria-', 'semantics:');
        normalized[semanticProp] = value;
        continue;
      }
      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }
      if (key === 'class') {
        normalized['__themeClass'] = value;
        continue;
      }
      if (key.startsWith('on')) {
        const modifier = COMPOSE_MODIFIER_MAP[key.toLowerCase()];
        if (modifier) {
          normalized[modifier] = value;
        } else {
          const eventName = key.slice(2);
          normalized[`Modifier.${eventName.charAt(0).toLowerCase()}${eventName.slice(1)}`] = value;
        }
        continue;
      }
      if (key === 'style') {
        normalized['__modifierChain'] = value;
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
            layout.container = 'LazyVerticalGrid';
            if (columns) layout.columns = columns;
            break;
          case 'split':
            layout.container = 'Row';
            layout.modifier = 'weight';
            break;
          case 'overlay':
            layout.container = 'Box';
            break;
          case 'flow':
            layout.container = 'FlowRow';
            break;
          case 'sidebar':
            layout.container = 'Scaffold';
            layout.drawer = true;
            break;
          case 'center':
            layout.container = 'Box';
            layout.alignment = 'Alignment.Center';
            break;
          case 'stack':
          default:
            layout.container = direction === 'row' ? 'Row' : 'Column';
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
        const m3Tokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) {
            m3Tokens[`colorScheme.${tokenName.replace('color-', '')}`] = tokenValue;
          } else if (tokenName.startsWith('font-') || tokenName.startsWith('typography-')) {
            const tKey = tokenName.replace('font-', '').replace('typography-', '');
            m3Tokens[`typography.${tKey}`] = tokenValue;
          } else {
            m3Tokens[tokenName] = tokenValue;
          }
        }
        normalized['__themeTokens'] = m3Tokens;
        continue;
      }
      normalized[key] = value;
    }

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
