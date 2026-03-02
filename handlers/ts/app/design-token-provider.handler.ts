// DesignTokenProvider Concept Implementation [P]
// Provider lifecycle for design token resolution with plugin-registry integration.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:design-token';
const VALID_FORMATS = ['css', 'dtcg', 'scss', 'json', 'tailwind', 'swift', 'kotlin'];

export const designTokenProviderHandler: ConceptHandler = {
  async initialize(input, storage) {
    const config = input.config as string;

    // Idempotent — check for existing registration
    const existing = await storage.find('design-token-provider', { pluginRef: PLUGIN_REF });
    if (existing.length > 0) {
      return { variant: 'ok', provider: (existing[0] as Record<string, unknown>).id as string, pluginRef: PLUGIN_REF };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config || '{}');
    } catch {
      return { variant: 'configError', message: 'Invalid JSON in config' };
    }

    const id = nextId('dtp');
    const activeTheme = (parsed.theme as string) || 'default';

    await storage.put('design-token-provider', id, {
      id,
      pluginRef: PLUGIN_REF,
      status: 'active',
      activeTheme,
      tokenCache: '{}',
      config,
    });

    // Register with plugin-registry
    await storage.put('plugin-registry', PLUGIN_REF, {
      pluginKind: 'surface-provider',
      domain: 'design-token',
      providerRef: id,
      instanceId: id,
    });

    return { variant: 'ok', provider: id, pluginRef: PLUGIN_REF };
  },

  async resolve(input, storage) {
    const provider = input.provider as string;
    const tokenName = input.tokenName as string;

    const instance = await storage.get('design-token-provider', provider);
    if (!instance) {
      return { variant: 'notfound', name: tokenName };
    }

    // Walk token alias chain
    let current = tokenName;
    const visited = new Set<string>();
    while (true) {
      if (visited.has(current)) {
        return { variant: 'notfound', name: `Circular alias at "${current}"` };
      }
      visited.add(current);

      const token = await storage.get('token', current);
      if (!token) {
        return { variant: 'notfound', name: tokenName };
      }

      const ref = token.reference as string;
      if (!ref) {
        return { variant: 'ok', value: token.value as string, type: token.type as string, tier: token.tier as string };
      }
      current = ref;
    }
  },

  async switchTheme(input, storage) {
    const provider = input.provider as string;
    const theme = input.theme as string;

    const instance = await storage.get('design-token-provider', provider);
    if (!instance) {
      return { variant: 'notfound', theme };
    }

    // Check theme exists
    const themeRecord = await storage.get('theme', theme);
    if (!themeRecord) {
      return { variant: 'notfound', theme };
    }

    await storage.put('design-token-provider', provider, {
      ...instance,
      activeTheme: theme,
      tokenCache: '{}', // Invalidate cache on theme switch
    });

    return { variant: 'ok', provider };
  },

  async getTokens(input, storage) {
    const provider = input.provider as string;

    const instance = await storage.get('design-token-provider', provider);
    const tokens = await storage.find('token', {});
    const resolved: Record<string, string> = {};

    for (const token of tokens) {
      const t = token as Record<string, unknown>;
      const name = t.name as string;
      const value = t.value as string;
      if (name && value) {
        resolved[name] = value;
      }
    }

    return { variant: 'ok', tokens: JSON.stringify(resolved) };
  },

  async export(input, storage) {
    const provider = input.provider as string;
    const format = input.format as string;

    if (!VALID_FORMATS.includes(format)) {
      return { variant: 'unsupported', message: `Unsupported format "${format}". Supported: ${VALID_FORMATS.join(', ')}` };
    }

    const tokens = await storage.find('token', {});
    let output: string;

    switch (format) {
      case 'css':
        output = ':root {\n' + tokens.map(t => {
          const tok = t as Record<string, unknown>;
          return `  --${tok.name}: ${tok.value};`;
        }).join('\n') + '\n}';
        break;
      case 'dtcg':
        output = JSON.stringify({ $type: 'design-tokens', tokens: Object.fromEntries(
          tokens.map(t => {
            const tok = t as Record<string, unknown>;
            return [tok.name, { $value: tok.value, $type: tok.type }];
          })
        ) });
        break;
      default:
        output = JSON.stringify({ tokens: Object.fromEntries(
          tokens.map(t => {
            const tok = t as Record<string, unknown>;
            return [tok.name, tok.value];
          })
        ) });
    }

    return { variant: 'ok', output, format };
  },
};
