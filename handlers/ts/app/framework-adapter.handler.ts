// @migrated dsl-constructs 2026-03-18
// ============================================================
// FrameworkAdapter Handler
//
// Detects the target framework and delegates normalization
// to the appropriate framework-specific adapter handler.
// Supports: React, Vue, Solid, Svelte, Next.js, and more.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const FRAMEWORK_ADAPTER_MAP: Record<string, string> = {
  react: 'react-adapter',
  vue: 'vue-adapter',
  solid: 'solid-adapter',
  solidjs: 'solid-adapter',
  svelte: 'svelte-adapter',
  nextjs: 'nextjs-adapter',
  next: 'nextjs-adapter',
  vanilla: 'vanilla-adapter',
  ink: 'ink-adapter',
  reactnative: 'react-native-adapter',
  'react-native': 'react-native-adapter',
  nativescript: 'nativescript-adapter',
  swiftui: 'swiftui-adapter',
  appkit: 'appkit-adapter',
  gtk: 'gtk-adapter',
  compose: 'compose-adapter',
  jetpackcompose: 'compose-adapter',
  winui: 'winui-adapter',
  xaml: 'winui-adapter',
  watchkit: 'watchkit-adapter',
  wearcompose: 'wear-compose-adapter',
};

export const frameworkAdapterHandler: FunctionalConceptHandler = {
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

    // Detect framework from adapter identifier or __framework hint
    const frameworkHint = (parsed['__framework'] as string || adapter || '').toLowerCase().replace(/[\s.-]/g, '');
    const delegateAdapter = FRAMEWORK_ADAPTER_MAP[frameworkHint];

    if (!delegateAdapter) {
      // Default normalization: pass through with framework metadata
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(parsed)) {
        if (key === '__framework') continue;

        // ARIA and data-* pass through unchanged
        if (key.startsWith('aria-') || key.startsWith('data-')) {
          normalized[key] = value;
          continue;
        }

        // Layout -> CSS flexbox/grid container (default normalization)
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

        // Theme -> CSS custom properties (default normalization)
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

        normalized[key] = value;
      }

      normalized['__detectedFramework'] = frameworkHint || 'unknown';
      normalized['__delegated'] = false;

      let p = createProgram();
      p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
      return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Delegate to the resolved framework adapter
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '__framework') continue;
      normalized[key] = value;
    }

    normalized['__detectedFramework'] = frameworkHint;
    normalized['__delegateTo'] = delegateAdapter;
    normalized['__delegated'] = true;

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
