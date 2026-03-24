// @clef-handler style=functional
// ExtensionConfig Concept Implementation
// Per-extension configuration with schema validation, defaults, and user overrides.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ext-config-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ExtensionConfig' }) as StorageProgram<Result>;
  },

  initialize(input: Record<string, unknown>) {
    const extensionId = input.extensionId as string;
    const schema = (input.schema as string | undefined) ?? '{}';
    const defaults = (input.defaults as string | undefined) ?? '{}';

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }

    // Validate schema is valid JSON
    try {
      JSON.parse(schema);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'Schema definition is malformed.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'extensionConfig', { extensionId }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'Configuration already initialized for this extension.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'extensionConfig', id, {
          id, extensionId, schema, defaults, overrides: '{}',
        });
        return complete(b2, 'ok', { config: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const config = input.config as string;
    const key = input.key as string;

    let p = createProgram();
    p = get(p, 'extensionConfig', config, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        let overrides: Record<string, unknown> = {};
        let defaults: Record<string, unknown> = {};
        try { overrides = JSON.parse(record.overrides as string || '{}'); } catch { overrides = {}; }
        try { defaults = JSON.parse(record.defaults as string || '{}'); } catch { defaults = {}; }
        const value = key in overrides ? overrides[key] : defaults[key];
        if (value === undefined) {
          return { variant: 'notfound', message: 'No configuration or key found.' };
        }
        return { value: String(value) };
      }),
      (b) => complete(b, 'notfound', { message: 'No configuration or key found.' }),
    ) as StorageProgram<Result>;
  },

  set(input: Record<string, unknown>) {
    const config = input.config as string;
    const key = input.key as string;
    const value = input.value as string;

    if (!key || key.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'key is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'extensionConfig', config, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extensionConfig', config, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let overrides: Record<string, unknown> = {};
          try { overrides = JSON.parse(record.overrides as string || '{}'); } catch { overrides = {}; }
          overrides[key] = value;
          return { ...record, overrides: JSON.stringify(overrides) };
        });
        return complete(b2, 'ok', { config });
      },
      (b) => complete(b, 'notfound', { message: 'No configuration with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  reset(input: Record<string, unknown>) {
    const config = input.config as string;
    const key = input.key as string;

    let p = createProgram();
    p = get(p, 'extensionConfig', config, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extensionConfig', config, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let overrides: Record<string, unknown> = {};
          try { overrides = JSON.parse(record.overrides as string || '{}'); } catch { overrides = {}; }
          delete overrides[key];
          return { ...record, overrides: JSON.stringify(overrides) };
        });
        return complete(b2, 'ok', { config });
      },
      (b) => complete(b, 'notfound', { message: 'No configuration or key found.' }),
    ) as StorageProgram<Result>;
  },

  getSchema(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();
    p = get(p, 'extensionConfig', config, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return { schema: record.schema as string };
      }),
      (b) => complete(b, 'notfound', { message: 'No configuration with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  onChange(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();
    p = get(p, 'extensionConfig', config, 'record');
    return branch(p, 'record',
      (b) => complete(b, 'ok', { config }),
      (b) => complete(b, 'notfound', { message: 'No configuration with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const config = input.config as string;

    let p = createProgram();
    p = get(p, 'extensionConfig', config, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = del(b, 'extensionConfig', config);
        return complete(b2, 'ok', { config });
      },
      (b) => complete(b, 'notfound', { message: 'No configuration with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const extensionConfigHandler = autoInterpret(_handler);
