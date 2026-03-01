// ============================================================
// PlatformAdapter Handler
//
// Detects the target platform and delegates normalization
// to the appropriate platform-specific adapter handler.
// Supports: web, mobile, desktop, watch, terminal.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const PLATFORM_ADAPTER_MAP: Record<string, string> = {
  web: 'browser-adapter',
  browser: 'browser-adapter',
  mobile: 'mobile-adapter',
  ios: 'mobile-adapter',
  android: 'mobile-adapter',
  desktop: 'desktop-adapter',
  electron: 'desktop-adapter',
  tauri: 'desktop-adapter',
  watch: 'watch-adapter',
  watchos: 'watch-adapter',
  wearos: 'wear-compose-adapter',
  terminal: 'terminal-adapter',
  cli: 'terminal-adapter',
};

export const platformAdapterHandler: ConceptHandler = {
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

    // Detect platform from adapter identifier or __platform hint
    const platformHint = (parsed['__platform'] as string || adapter || '').toLowerCase();
    const delegateAdapter = PLATFORM_ADAPTER_MAP[platformHint];

    if (!delegateAdapter) {
      // Default normalization: pass through with platform metadata
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(parsed)) {
        if (key === '__platform') continue;

        // ARIA and data-* pass through unchanged
        if (key.startsWith('aria-') || key.startsWith('data-')) {
          normalized[key] = value;
          continue;
        }

        normalized[key] = value;
      }

      normalized['__detectedPlatform'] = platformHint || 'unknown';
      normalized['__delegated'] = false;

      await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });
      return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
    }

    // Delegate to the resolved platform adapter
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '__platform') continue;
      normalized[key] = value;
    }

    normalized['__detectedPlatform'] = platformHint;
    normalized['__delegateTo'] = delegateAdapter;
    normalized['__delegated'] = true;

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
