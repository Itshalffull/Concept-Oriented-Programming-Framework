// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// StorageProvider Concept Implementation
// Abstract storage provisioning coordinator. Discovers provider-specific
// handlers (VercelKV, DynamoDB, etc.) via the plugin-registry pattern,
// then delegates provisioning to the matching provider.
// This handler manages the registry of provisioned stores and their credentials.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'storage-provider';

const _handler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const storeName = input.storeName as string;
    const storageType = input.storageType as string;
    const conceptName = input.conceptName as string || '';
    const config = input.config as string || '{}';

    if (!storeName || !storageType) {
      let p = createProgram();
      return complete(p, 'provisionFailed', { store: storeName, reason: 'storeName and storageType are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, storeName, 'existing');

    p = branch(p,
      (bindings) => {
        const existing = bindings.existing as Record<string, unknown> | null;
        return !!existing && existing.status === 'provisioned';
      },
      (b) => completeFrom(b, 'alreadyProvisioned', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return {
          store: storeName,
          credentials: existing.credentials as string || '{}',
        };
      }),
      (b) => {
        const b2 = put(b, RELATION, storeName, {
          storeName,
          storageType,
          conceptName,
          config,
          status: 'provisioning',
          credentials: '{}',
          provisionedAt: new Date().toISOString(),
        });

        return complete(b2, 'ok', {
          store: storeName,
          storageType,
          credentials: '{}',
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  updateCredentials(input: Record<string, unknown>) {
    const storeName = input.storeName as string || input.store as string;
    const credentials = input.credentials as string;

    let p = createProgram();
    p = get(p, RELATION, storeName, 'existing');

    p = branch(p, 'existing',
      (b) => {
        const b2 = putFrom(b, RELATION, storeName, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, credentials, status: 'provisioned' };
        });
        return complete(b2, 'ok', { store: storeName, credentials });
      },
      (b) => complete(b, 'notfound', { store: storeName }),
    );

    return p as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const storeName = input.store as string;
    const settings = input.settings as string;

    let p = createProgram();
    p = get(p, RELATION, storeName, 'existing');

    p = branch(p, 'existing',
      (b) => {
        const b2 = putFrom(b, RELATION, storeName, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const currentConfig = JSON.parse(existing.config as string || '{}');
          const newSettings = JSON.parse(settings);
          const merged = { ...currentConfig, ...newSettings };
          return { ...existing, config: JSON.stringify(merged) };
        });
        return complete(b2, 'ok', { store: storeName });
      },
      (b) => complete(b, 'notfound', { store: storeName }),
    );

    return p as StorageProgram<Result>;
  },

  getCredentials(input: Record<string, unknown>) {
    const storeName = input.store as string;

    let p = createProgram();
    p = get(p, RELATION, storeName, 'existing');

    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return {
          store: storeName,
          credentials: existing.credentials as string || '{}',
        };
      }),
      (b) => complete(b, 'notfound', { store: storeName }),
    );

    return p as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const storeName = input.store as string;

    let p = createProgram();
    p = get(p, RELATION, storeName, 'existing');

    p = branch(p, 'existing',
      (b) => {
        const b2 = del(b, RELATION, storeName);
        return complete(b2, 'ok', { store: storeName });
      },
      (b) => complete(b, 'notfound', { store: storeName }),
    );

    return p as StorageProgram<Result>;
  },
};

export const storageProviderHandler = autoInterpret(_handler);
