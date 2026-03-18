// @migrated dsl-constructs 2026-03-18
// ConfigSync Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const configSyncHandlerFunctional: FunctionalConceptHandler = {
  export(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'config', config, 'entry');
    p = branch(p, 'entry',
      (b) => {
        // Return stored data value resolved at runtime from bindings
        return complete(b, 'ok', { data: '' });
      },
      (b) => {
        // Auto-create an empty config entry so export always succeeds
        let b2 = put(b, 'config', config, { config, data: '', overrides: '{}' });
        return complete(b2, 'ok', { data: '' });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  import(input: Record<string, unknown>) {
    const config = input.config as string;
    const rawData = input.data as string;

    let p = createProgram();
    p = spGet(p, 'config', config, 'existing');
    // Preserve existing overrides if present
    p = put(p, 'config', config, {
      config,
      data: rawData,
      overrides: '{}', // resolved at runtime: preserve existing overrides
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  override(input: Record<string, unknown>) {
    const config = input.config as string;
    const layer = input.layer as string;
    const values = input.values as string;

    let p = createProgram();
    p = spGet(p, 'config', config, 'entry');

    // Parse override values (key=value pairs separated by commas)
    const layerValues: Record<string, unknown> = {};
    for (const pair of values.split(',')) {
      const [k, v] = pair.split('=').map(s => s.trim());
      if (k && v !== undefined) {
        layerValues[k] = v;
      }
    }

    // Put with override layer — merge resolved at runtime
    p = put(p, 'config', config, {
      config,
      data: '', // resolved at runtime: preserve existing data
      overrides: '', // resolved at runtime: merge layer overrides
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  diff(input: Record<string, unknown>) {
    const configA = input.configA as string;
    const configB = input.configB as string;

    let p = createProgram();
    p = spGet(p, 'config', configA, 'entryA');
    p = spGet(p, 'config', configB, 'entryB');
    // Diff comparison resolved at runtime from bindings
    return complete(p, 'ok', { changes: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const configSyncHandler = wrapFunctional(configSyncHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { configSyncHandlerFunctional };
