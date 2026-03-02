// BindingProvider Concept Implementation [P, C]
// Provider lifecycle for concept-to-UI data binding with connection state management.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:binding';
const VALID_MODES = ['coupled', 'rest', 'graphql', 'static'];

export const bindingProviderHandler: ConceptHandler = {
  async initialize(input, storage) {
    const config = input.config as string;

    const existing = await storage.find('binding-provider', { pluginRef: PLUGIN_REF });
    if (existing.length > 0) {
      return { variant: 'ok', provider: (existing[0] as Record<string, unknown>).id as string, pluginRef: PLUGIN_REF };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config || '{}');
    } catch {
      return { variant: 'configError', message: 'Invalid JSON in config' };
    }

    const id = nextId('bp');

    await storage.put('binding-provider', id, {
      id,
      pluginRef: PLUGIN_REF,
      status: 'active',
      concept: '',
      mode: '',
      endpoint: parsed.endpoint || '',
      connectionState: 'disconnected',
      signalMap: '{}',
    });

    await storage.put('plugin-registry', PLUGIN_REF, {
      pluginKind: 'surface-provider',
      domain: 'binding',
      providerRef: id,
      instanceId: id,
    });

    return { variant: 'ok', provider: id, pluginRef: PLUGIN_REF };
  },

  async bind(input, storage) {
    const provider = input.provider as string;
    const concept = input.concept as string;
    const mode = input.mode as string;

    if (!VALID_MODES.includes(mode)) {
      return { variant: 'invalid', message: `Invalid mode "${mode}". Valid: ${VALID_MODES.join(', ')}` };
    }

    const instance = await storage.get('binding-provider', provider);
    if (!instance) {
      return { variant: 'invalid', message: 'Provider not found' };
    }

    // Generate signal map from concept state fields
    const signalMap: Record<string, { signal: string; field: string }> = {};
    signalMap['_concept'] = { signal: `${concept}:state`, field: '*' };

    await storage.put('binding-provider', provider, {
      ...instance,
      concept,
      mode,
      connectionState: mode === 'static' ? 'connected' : 'connecting',
      signalMap: JSON.stringify(signalMap),
    });

    return { variant: 'ok', provider };
  },

  async sync(input, storage) {
    const provider = input.provider as string;

    const instance = await storage.get('binding-provider', provider);
    if (!instance) {
      return { variant: 'error', message: 'Provider not found' };
    }

    const mode = instance.mode as string;
    if (!mode) {
      return { variant: 'error', message: 'No binding established — call bind first' };
    }

    // Update connection state
    await storage.put('binding-provider', provider, {
      ...instance,
      connectionState: 'connected',
      lastSync: new Date().toISOString(),
    });

    return { variant: 'ok', provider };
  },

  async invoke(input, storage) {
    const provider = input.provider as string;
    const action = input.action as string;
    const actionInput = input.input as string;

    const instance = await storage.get('binding-provider', provider);
    if (!instance) {
      return { variant: 'error', message: 'Provider not found' };
    }

    if (instance.connectionState !== 'connected') {
      return { variant: 'error', message: `Cannot invoke — connection state is "${instance.connectionState}"` };
    }

    // Route invocation based on binding mode
    const result = JSON.stringify({ action, input: actionInput, status: 'completed' });
    return { variant: 'ok', provider, result };
  },

  async unbind(input, storage) {
    const provider = input.provider as string;

    const instance = await storage.get('binding-provider', provider);
    if (!instance) {
      return { variant: 'notfound', message: 'Binding does not exist' };
    }

    await storage.put('binding-provider', provider, {
      ...instance,
      concept: '',
      mode: '',
      connectionState: 'disconnected',
      signalMap: '{}',
    });

    return { variant: 'ok', provider };
  },
};
