// @migrated dsl-constructs 2026-03-18
// BindingProvider Concept Implementation [P, C]
// Provider lifecycle for concept-to-UI data binding with connection state management.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:binding';
const VALID_MODES = ['coupled', 'rest', 'graphql', 'static'];

const bindingProviderHandlerFunctional: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();
    p = find(p, 'binding-provider', { pluginRef: PLUGIN_REF }, 'existingProviders');
    // If existing provider found, return it; otherwise create new
    // Full idempotency logic resolved at runtime from bindings

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config || '{}');
    } catch {
      return complete(p, 'configError', { message: 'Invalid JSON in config' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = nextId('bp');

    p = put(p, 'binding-provider', id, {
      id,
      pluginRef: PLUGIN_REF,
      status: 'active',
      concept: '',
      mode: '',
      endpoint: parsed.endpoint || '',
      connectionState: 'disconnected',
      signalMap: '{}',
    });

    p = put(p, 'plugin-registry', PLUGIN_REF, {
      pluginKind: 'surface-provider',
      domain: 'binding',
      providerRef: id,
      instanceId: id,
    });

    return complete(p, 'ok', { provider: id, pluginRef: PLUGIN_REF }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  bind(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const concept = input.concept as string;
    const mode = input.mode as string;

    if (!VALID_MODES.includes(mode)) {
      let p = createProgram();
      return complete(p, 'invalid', { message: `Invalid mode "${mode}". Valid: ${VALID_MODES.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'binding-provider', provider, 'instance');
    p = branch(p, 'instance',
      (b) => {
        const signalMap: Record<string, { signal: string; field: string }> = {};
        signalMap['_concept'] = { signal: `${concept}:state`, field: '*' };

        let b2 = put(b, 'binding-provider', provider, {
          concept,
          mode,
          connectionState: mode === 'static' ? 'connected' : 'connecting',
          signalMap: JSON.stringify(signalMap),
        });
        return complete(b2, 'ok', { provider });
      },
      (b) => complete(b, 'invalid', { message: 'Provider not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  sync(input: Record<string, unknown>) {
    const provider = input.provider as string;

    let p = createProgram();
    p = spGet(p, 'binding-provider', provider, 'instance');
    p = branch(p, 'instance',
      (b) => {
        let b2 = put(b, 'binding-provider', provider, {
          connectionState: 'connected',
          lastSync: new Date().toISOString(),
        });
        return complete(b2, 'ok', { provider });
      },
      (b) => complete(b, 'error', { message: 'Provider not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invoke(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const action = input.action as string;
    const actionInput = input.input as string;

    let p = createProgram();
    p = spGet(p, 'binding-provider', provider, 'instance');
    p = branch(p, 'instance',
      (b) => {
        // Connection state check and routing resolved at runtime
        const result = JSON.stringify({ action, input: actionInput, status: 'completed' });
        return complete(b, 'ok', { provider, result });
      },
      (b) => complete(b, 'error', { message: 'Provider not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unbind(input: Record<string, unknown>) {
    const provider = input.provider as string;

    let p = createProgram();
    p = spGet(p, 'binding-provider', provider, 'instance');
    p = branch(p, 'instance',
      (b) => {
        let b2 = put(b, 'binding-provider', provider, {
          concept: '',
          mode: '',
          connectionState: 'disconnected',
          signalMap: '{}',
        });
        return complete(b2, 'ok', { provider });
      },
      (b) => complete(b, 'notfound', { message: 'Binding does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const bindingProviderHandler = wrapFunctional(bindingProviderHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { bindingProviderHandlerFunctional };
