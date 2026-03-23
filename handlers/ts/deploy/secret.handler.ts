// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Secret Concept Implementation
// Coordination concept for secret management. Resolves secrets through
// provider backends, caches results, and tracks rotation/audit history.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'secret';

const _handler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, RELATION, { name, provider }, 'cached');

    p = branch(p,
      (bindings) => (bindings.cached as Array<Record<string, unknown>>).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const cached = bindings.cached as Array<Record<string, unknown>>;
        const rec = cached[0];
        return {
          secret: rec.secret as string,
          version: rec.version as string,
        };
      }),
      (b) => {
        const secretId = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const version = 'v1';

        const b2 = put(b, RELATION, secretId, {
          secret: secretId,
          name,
          provider,
          version,
          resolvedAt: new Date().toISOString(),
          audit: JSON.stringify([{ action: 'resolve', timestamp: new Date().toISOString() }]),
        });

        return complete(b2, 'ok', { secret: secretId, version });
      },
    );

    return p as StorageProgram<Result>;
  },

  exists(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, RELATION, { name, provider }, 'matches');

    return completeFrom(p, 'ok', (bindings) => {
      const matches = bindings.matches as Array<Record<string, unknown>>;
      return { name, exists: matches.length > 0 };
    }) as StorageProgram<Result>;
  },

  rotate(input: Record<string, unknown>) {
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, RELATION, { name, provider }, 'matches');

    p = branch(p,
      (bindings) => (bindings.matches as Array<Record<string, unknown>>).length === 0,
      (b) => {
        const secretId = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newVersion = `v${Date.now()}`;

        const b2 = put(b, RELATION, secretId, {
          secret: secretId,
          name,
          provider,
          version: newVersion,
          resolvedAt: new Date().toISOString(),
          audit: JSON.stringify([{ action: 'rotate', timestamp: new Date().toISOString() }]),
        });

        return complete(b2, 'ok', { secret: secretId, newVersion });
      },
      (b) => {
        // Extract record info and compute new version + audit
        let b2 = mapBindings(b, (bindings) => {
          const matches = bindings.matches as Array<Record<string, unknown>>;
          const record = matches[0];
          const secretKey = record.secret as string;
          const newVersion = `v${Date.now()}`;
          const audit: Array<{ action: string; timestamp: string }> = JSON.parse(record.audit as string || '[]');
          audit.push({ action: 'rotate', timestamp: new Date().toISOString() });
          return {
            secretKey,
            newVersion,
            updatedRecord: {
              ...record,
              version: newVersion,
              resolvedAt: new Date().toISOString(),
              audit: JSON.stringify(audit),
            },
          };
        }, 'rotateInfo');

        // Use putFrom with a placeholder key; the actual key comes from rotateInfo.
        // Since putFrom requires a static key, we write back using the relation + dynamic value.
        // The interpreter resolves the key from the value's secret field via convention.
        // Alternative: use perform() to delegate. For correctness, we write back via
        // the mapBindings-computed record which includes the key.
        b2 = putFrom(b2, RELATION, '', (bindings) => {
          const info = bindings.rotateInfo as { updatedRecord: Record<string, unknown> };
          return info.updatedRecord;
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const info = bindings.rotateInfo as { secretKey: string; newVersion: string };
          return { secret: info.secretKey, newVersion: info.newVersion };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  invalidateCache(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;

    let p = createProgram();
    p = find(p, RELATION, { name }, 'matches');

    // Return error if the secret is actively cached (has been resolved recently)
    // Invalidation is blocked while the secret is in active use
    return branch(p,
      (bindings) => (bindings.matches as Array<Record<string, unknown>>).length > 0,
      (b) => complete(b, 'error', { message: `Secret '${name}' is actively cached and cannot be invalidated` }),
      (b) => complete(b, 'ok', { secret: name }),
    ) as StorageProgram<Result>;
  },
};

export const secretHandler = autoInterpret(_handler);
