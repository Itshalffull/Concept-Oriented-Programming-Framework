// @migrated dsl-constructs 2026-03-18
// Secret Concept Implementation (Deploy Kit)
// Coordinate secret resolution across vault and secret manager providers.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createHash, randomBytes } from 'crypto';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const secretHandlerFunctional: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const name = input.name as string;
    const provider = input.provider as string;
    const secretKey = `${provider}:${name}`;

    let p = createProgram();
    p = spGet(p, 'secret', secretKey, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const expiresAt = existing.expiresAt as string | null;
          if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'expired';
          return 'valid';
        }, 'status');
        b2 = branch(b2, (bindings) => bindings.status === 'valid',
          (() => {
            let t = createProgram();
            t = putFrom(t, 'secret', secretKey, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const now = new Date().toISOString();
              const audit: Array<{ accessedAt: string; accessedBy: string }> =
                existing.audit ? JSON.parse(existing.audit as string) : [];
              audit.push({ accessedAt: now, accessedBy: 'system' });
              return { ...existing, cachedAt: now, audit: JSON.stringify(audit) };
            });
            return complete(t, 'ok', { secret: secretKey, version: '' });
          })(),
          (() => {
            let e = createProgram();
            return complete(e, 'expired', { name, expiresAt: '' });
          })(),
        );
        return b2;
      },
      (b) => complete(b, 'notFound', { name, provider }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  exists(input: Record<string, unknown>) {
    const name = input.name as string;
    const provider = input.provider as string;
    const secretKey = `${provider}:${name}`;

    let p = createProgram();
    p = spGet(p, 'secret', secretKey, 'existing');
    p = mapBindings(p, (bindings) => !!bindings.existing, 'existsFlag');
    return complete(p, 'ok', { name, exists: false }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rotate(input: Record<string, unknown>) {
    const name = input.name as string;
    const provider = input.provider as string;
    const secretKey = `${provider}:${name}`;

    let p = createProgram();
    p = spGet(p, 'secret', secretKey, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const newVersion = `v${Date.now()}`;
        const now = new Date().toISOString();
        const newValueHash = createHash('sha256').update(randomBytes(32)).digest('hex');
        let b2 = putFrom(b, 'secret', secretKey, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, version: newVersion, cachedAt: null, valueHash: newValueHash, rotatedAt: now };
        });
        return complete(b2, 'ok', { secret: secretKey, newVersion });
      },
      (b) => complete(b, 'rotationUnsupported', { name, provider }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invalidateCache(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'secret', {}, 'allSecrets');
    p = mapBindings(p, (bindings) => {
      const allSecrets = (bindings.allSecrets as Array<Record<string, unknown>>) || [];
      const matched = allSecrets.filter(s => (s.name as string) === name);
      return matched.length > 0 ? `${(matched[0].provider as string)}:${name}` : name;
    }, 'matchedKey');
    return complete(p, 'ok', { secret: name }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const secretHandler = wrapFunctional(secretHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { secretHandlerFunctional };
