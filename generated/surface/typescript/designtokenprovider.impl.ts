// DesignTokenProvider Concept Implementation
// Provides design-token management with theme switching and export.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'designtokenprovider';
const META_KEY = '__meta__';

export const designtokenproviderHandler: ConceptHandler = {
  /**
   * initialize(config) -> ok(provider, pluginRef) | configError(message)
   * Idempotent initialization of the design-token provider.
   */
  async initialize(input, storage) {
    const config = input.config as Record<string, unknown>;

    if (!config || typeof config !== 'object') {
      return { variant: 'configError', message: 'Config must be a non-null object' };
    }

    const existing = await storage.get(RELATION, META_KEY);
    if (existing) {
      return {
        variant: 'ok',
        provider: existing.provider as string,
        pluginRef: existing.pluginRef as string,
      };
    }

    const provider = `designtokenprovider-${Date.now()}`;
    const pluginRef = 'surface-provider:design-token';

    await storage.put(RELATION, META_KEY, {
      provider,
      pluginRef,
      activeTheme: (config.defaultTheme as string) ?? 'default',
      config: JSON.stringify(config),
    });

    return { variant: 'ok', provider, pluginRef };
  },

  /**
   * resolve(tokenPath, theme?) -> ok(tokenPath, resolvedValue) | notfound(message) | broken(message, brokenAt)
   * Resolves a token path to its concrete value, optionally within a theme context.
   */
  async resolve(input, storage) {
    const tokenPath = input.tokenPath as string;
    const theme = input.theme as string | undefined;

    const meta = await storage.get(RELATION, META_KEY);
    const activeTheme = theme ?? (meta?.activeTheme as string) ?? 'default';

    // Try theme-specific token first
    const themedKey = `${activeTheme}:${tokenPath}`;
    const themedEntry = await storage.get(RELATION, themedKey);
    if (themedEntry) {
      // Walk alias chain
      return await resolveChain(themedEntry, themedKey, storage);
    }

    // Fallback to base token
    const baseEntry = await storage.get(RELATION, tokenPath);
    if (!baseEntry) {
      return { variant: 'notfound', message: `Token "${tokenPath}" does not exist` };
    }

    return await resolveChain(baseEntry, tokenPath, storage);
  },

  /**
   * switchTheme(theme) -> ok(theme) | notfound(message)
   * Switches the active theme used by resolve.
   */
  async switchTheme(input, storage) {
    const theme = input.theme as string;

    const meta = await storage.get(RELATION, META_KEY);
    if (!meta) {
      return { variant: 'notfound', message: 'Provider not initialized' };
    }

    // Check that at least one token exists for the requested theme
    const themeTokens = await storage.find(RELATION, { theme });
    if (themeTokens.length === 0) {
      return { variant: 'notfound', message: `Theme "${theme}" has no tokens registered` };
    }

    await storage.put(RELATION, META_KEY, {
      ...meta,
      activeTheme: theme,
    });

    return { variant: 'ok', theme };
  },

  /**
   * getTokens(filter?) -> ok(tokens)
   * Lists all registered tokens, optionally filtered by properties.
   */
  async getTokens(input, storage) {
    const filter = (input.filter as Record<string, string>) ?? {};
    const allEntries = await storage.find(RELATION, filter);

    const tokens = allEntries
      .filter((e) => (e._key as string) !== META_KEY && !(e._key as string).startsWith('__'))
      .map((e) => ({
        path: (e.path ?? e._key) as string,
        value: (e.value ?? '') as string,
        type: (e.type ?? 'unknown') as string,
      }));

    return { variant: 'ok', tokens };
  },

  /**
   * export(format, theme?) -> ok(output) | unsupported(message)
   * Exports tokens in the requested format (json or css).
   */
  async export(input, storage) {
    const format = input.format as string;
    const theme = input.theme as string | undefined;
    const supportedFormats = ['json', 'css'];

    if (!supportedFormats.includes(format.toLowerCase())) {
      return {
        variant: 'unsupported',
        message: `Format "${format}" is not supported. Supported formats: ${supportedFormats.join(', ')}`,
      };
    }

    const allEntries = await storage.find(RELATION);
    const tokens = allEntries.filter(
      (e) => (e._key as string) !== META_KEY && !(e._key as string).startsWith('__'),
    );

    // Optionally filter by theme
    const filtered = theme
      ? tokens.filter((t) => (t.theme as string) === theme || !(t.theme as string))
      : tokens;

    if (format.toLowerCase() === 'json') {
      const tokenMap: Record<string, unknown> = {};
      for (const t of filtered) {
        const path = (t.path ?? t._key) as string;
        tokenMap[path] = {
          value: t.value,
          type: t.type,
          ...(t.reference ? { reference: t.reference } : {}),
        };
      }
      return { variant: 'ok', output: JSON.stringify(tokenMap, null, 2) };
    }

    if (format.toLowerCase() === 'css') {
      const lines = [':root {'];
      for (const t of filtered) {
        const path = ((t.path ?? t._key) as string).replace(/\./g, '-');
        const value = (t.value ?? `var(--${((t.reference as string) ?? '').replace(/\./g, '-')})`) as string;
        lines.push(`  --${path}: ${value};`);
      }
      lines.push('}');
      return { variant: 'ok', output: lines.join('\n') };
    }

    return { variant: 'unsupported', message: `Format "${format}" is not supported` };
  },
};

async function resolveChain(
  entry: Record<string, unknown>,
  key: string,
  storage: { get(relation: string, key: string): Promise<Record<string, unknown> | null> },
): Promise<{ variant: string; [k: string]: unknown }> {
  const visited = new Set<string>();
  let current = entry;
  let currentKey = key;

  while (current.reference !== null && current.reference !== undefined) {
    if (visited.has(currentKey)) {
      return { variant: 'broken', message: `Cycle detected at "${currentKey}"`, brokenAt: currentKey };
    }
    visited.add(currentKey);

    const refKey = current.reference as string;
    const refEntry = await storage.get(RELATION, refKey);
    if (!refEntry) {
      return { variant: 'broken', message: `Broken reference: "${refKey}" does not exist`, brokenAt: refKey };
    }
    current = refEntry;
    currentKey = refKey;
  }

  return { variant: 'ok', tokenPath: key, resolvedValue: current.value as string };
}
