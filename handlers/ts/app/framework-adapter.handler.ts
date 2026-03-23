// @clef-handler style=functional
// ============================================================
// FrameworkAdapter Handler
//
// Registers framework adapters and delegates normalization,
// mounting, rendering, and unmounting to the appropriate adapter.
// Supports: React, Vue, Solid, Svelte, Next.js, and more.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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

const _frameworkAdapterHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const renderer = input.renderer as string;
    const framework = input.framework as string;
    const version = input.version as string;
    const normalizer = input.normalizer as string;
    const mountFn = input.mountFn as string;

    if (!renderer || (renderer as string).trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'renderer is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = get(p, 'adapter', renderer, '_existing');
    return branch(p,
      (b) => b._existing != null,
      complete(createProgram(), 'duplicate', { message: `Adapter '${renderer}' is already registered` }),
      (() => {
        let b = createProgram();
        b = put(b, 'adapter', renderer, { renderer, framework, version, normalizer, mountFn, status: 'active' });
        return completeFrom(b, 'ok', () => ({ renderer }));
      })(),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || (props as string).trim() === '') {
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
    const frameworkHint = ((parsed['__framework'] as string) || adapter || '').toLowerCase().replace(/[\s.-]/g, '');
    const delegateAdapter = FRAMEWORK_ADAPTER_MAP[frameworkHint];

    // Look up registered adapter (either by exact renderer name or delegate adapter name)
    const lookupKey = delegateAdapter || adapter;

    let p = createProgram();
    p = get(p, 'adapter', lookupKey, '_registeredAdapter');

    // Also try looking up by adapter directly if the lookupKey didn't match
    p = get(p, 'adapter', adapter, '_adapterDirect');

    return branch(p,
      (b) => b._registeredAdapter == null && b._adapterDirect == null,
      // No registered adapter found — for unknown frameworks, still pass through
      // but for known frameworks, allow passthrough too (the invariant checks via register state)
      (() => {
        // Compute normalized props for passthrough
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (key === '__framework') continue;
          if (key.startsWith('aria-') || key.startsWith('data-')) {
            normalized[key] = value;
            continue;
          }
          normalized[key] = value;
        }
        normalized['__detectedFramework'] = frameworkHint || 'unknown';
        normalized['__delegated'] = false;

        let b = createProgram();
        b = put(b, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
        return complete(b, 'ok', { adapter, normalized: JSON.stringify(normalized) });
      })(),
      // Registered adapter found — perform normalization
      (() => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (key === '__framework') continue;

          // ARIA and data-* pass through unchanged
          if (key.startsWith('aria-') || key.startsWith('data-')) {
            normalized[key] = value;
            continue;
          }

          // Layout -> CSS flexbox/grid container normalization
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

          // Theme -> CSS custom properties normalization
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
        normalized['__delegateTo'] = delegateAdapter || adapter;
        normalized['__delegated'] = !!delegateAdapter;

        let b = createProgram();
        b = put(b, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
        return complete(b, 'ok', { adapter, normalized: JSON.stringify(normalized) });
      })(),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  mount(input: Record<string, unknown>) {
    const renderer = input.renderer as string;
    const machine = input.machine as string;
    const target = input.target as string;

    if (!renderer || (renderer as string).trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'renderer is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = get(p, 'adapter', renderer, '_rendererRec');
    return branch(p,
      (b) => b._rendererRec == null,
      complete(createProgram(), 'error', { message: `Renderer '${renderer}' is not registered` }),
      (() => {
        const mountKey = `${renderer}::${target}`;
        let b = createProgram();
        b = put(b, 'mount', mountKey, { renderer, machine, target, mounted: true });
        return completeFrom(b, 'ok', () => ({ renderer, machine, target }));
      })(),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  render(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!adapter || (adapter as string).trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'adapter is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = get(p, 'adapter', adapter, '_adapterRec');
    return branch(p,
      (b) => b._adapterRec == null,
      complete(createProgram(), 'error', { message: `Adapter '${adapter}' is not registered` }),
      (() => {
        let b = createProgram();
        b = put(b, 'output', adapter, { adapter, props, rendered: true });
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings._adapterRec as Record<string, unknown>;
          return { adapter, output: props, framework: rec.framework };
        });
      })(),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unmount(input: Record<string, unknown>) {
    const renderer = input.renderer as string;
    const target = input.target as string;

    // Check if the renderer is registered — unmount succeeds if the renderer
    // is registered (whether or not a specific mount target record exists).
    // Returns notfound if the renderer has never been registered.
    let p = createProgram();
    p = get(p, 'adapter', renderer, '_rendererRec');
    return branch(p,
      (b) => b._rendererRec == null,
      complete(createProgram(), 'notfound', { message: `Renderer '${renderer}' is not registered` }),
      (() => {
        const mountKey = `${renderer}::${target}`;
        let b = createProgram();
        b = del(b, 'mount', mountKey);
        return complete(b, 'ok', { renderer, target });
      })(),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const frameworkAdapterHandler = autoInterpret(_frameworkAdapterHandler);
