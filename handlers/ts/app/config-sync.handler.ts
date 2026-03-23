// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ConfigSync Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _configSyncHandler: FunctionalConceptHandler = {
  export(input: Record<string, unknown>) {
    if (!input.config || (typeof input.config === 'string' && (input.config as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'config is required' }) as StorageProgram<Result>;
    }
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'config', config, 'entry');
    p = branch(p, 'entry',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const entry = bindings.entry as Record<string, unknown>;
          return { data: (entry.data as string) || '' };
        });
      },
      (b) => {
        let b2 = put(b, 'config', config, { config, data: '', overrides: '{}' });
        return complete(b2, 'ok', { data: '' });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  import(input: Record<string, unknown>) {
    if (!input.data || (typeof input.data === 'string' && (input.data as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'data is required' }) as StorageProgram<Result>;
    }
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

    p = putFrom(p, 'config', config, (bindings) => {
      const entry = (bindings.entry as Record<string, unknown>) || { config, data: values, overrides: '{}' };
      const overrides = JSON.parse((entry.overrides as string) || '{}') as Record<string, unknown>;
      overrides[layer] = layerValues;
      return { ...entry, config, overrides: JSON.stringify(overrides) };
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  diff(input: Record<string, unknown>) {
    const configA = input.configA as string;
    const configB = input.configB as string;

    let p = createProgram();
    p = spGet(p, 'config', configA, 'entryA');
    p = spGet(p, 'config', configB, 'entryB');
    return completeFrom(p, 'ok', (bindings) => {
      const a = bindings.entryA as Record<string, unknown> | null;
      const b = bindings.entryB as Record<string, unknown> | null;
      return { changes: JSON.stringify({ a: a?.data ?? null, b: b?.data ?? null }) };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const configSyncHandler = autoInterpret(_configSyncHandler);

