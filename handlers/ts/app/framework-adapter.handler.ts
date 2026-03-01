// ============================================================
// FrameworkAdapter Handler
//
// Detects the target framework and delegates normalization
// to the appropriate framework-specific adapter handler.
// Supports: React, Vue, Solid, Svelte, Next.js, and more.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

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

export const frameworkAdapterHandler: ConceptHandler = {
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

        normalized[key] = value;
      }

      normalized['__detectedFramework'] = frameworkHint || 'unknown';
      normalized['__delegated'] = false;

      await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });
      return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
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

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
