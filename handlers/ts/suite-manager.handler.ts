// @migrated dsl-constructs 2026-03-18
// ============================================================
// SuiteManager Handler
//
// Manage suites -- scaffold new suites, validate suite
// manifests and cross-suite references, run suite tests, list
// active suites, and check app overrides.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, find, get, put, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `suite-manager-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  init(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'suite-manager', { name }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'alreadyExists', (b) => ({
          name,
        }));
      })(),
      (() => {
        const path = `./repertoire/${name}/`;
        const id = nextId();
        const now = new Date().toISOString();
        let e = createProgram();
        e = put(e, 'suite-manager', id, {
          id,
          name,
          path,
          status: 'initialized',
          createdAt: now,
        });
        return complete(e, 'ok', { suite: id, path }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = find(p, 'suite-manager', { path }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        let t = createProgram();
        t = mapBindings(t, (b) => {
          const existing = b.existing as Record<string, unknown>[];
          return existing[0].id as string;
        }, 'suiteId');
        t = mapBindings(t, (b) => {
          return b.suiteId as string;
        }, 'resolvedSuiteId');
        return completeFrom(t, 'ok', (b) => {
          const suiteId = (b.existing as Record<string, unknown>[])[0].id as string;
          const record = (b.existing as Record<string, unknown>[])[0];
          const concepts = (record && typeof record.conceptCount === 'number') ? record.conceptCount : 0;
          const syncs = (record && typeof record.syncCount === 'number') ? record.syncCount : 0;
          return { suite: suiteId, concepts, syncs };
        });
      })(),
      (() => {
        const suiteId = nextId();
        const suiteName = path.replace(/^\.\/suites\//, '').replace(/\/$/, '');
        let e = createProgram();
        e = put(e, 'suite-manager', suiteId, {
          id: suiteId,
          name: suiteName,
          path,
          status: 'validated',
          createdAt: new Date().toISOString(),
        });
        return complete(e, 'ok', { suite: suiteId, concepts: 0, syncs: 0 }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  test(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = find(p, 'suite-manager', { path }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'ok', (b) => {
          const suiteId = (b.existing as Record<string, unknown>[])[0].id as string;
          return { suite: suiteId, passed: 0, failed: 0 };
        });
      })(),
      (() => {
        const suiteId = nextId();
        const suiteName = path.replace(/^\.\/suites\//, '').replace(/\/$/, '');
        let e = createProgram();
        e = put(e, 'suite-manager', suiteId, {
          id: suiteId,
          name: suiteName,
          path,
          status: 'tested',
          createdAt: new Date().toISOString(),
        });
        return complete(e, 'ok', { suite: suiteId, passed: 0, failed: 0 }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'suite-manager', {}, 'results');

    return completeFrom(p, 'ok', (b) => {
      const results = b.results as Record<string, unknown>[];
      const suites = results.map(r => r.name as string);
      return { suites };
    }) as StorageProgram<Result>;
  },

  checkOverrides(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = find(p, 'suite-manager', { path }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length === 0,
      (() => {
        const t = createProgram();
        return complete(t, 'invalidOverride', { override: path, reason: `Suite not found at path: ${path}` }) as StorageProgram<Result>;
      })(),
      (() => {
        const e = createProgram();
        return complete(e, 'ok', { valid: 0, warnings: [] }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

// validate needs to update the status of an existing suite record found via find(),
// which requires a dynamic storage key not supported by the StorageProgram DSL.
async function _validate(input: Record<string, unknown>, storage: ConceptStorage) {
  const path = input.path as string;

  const existing = await storage.find('suite-manager', { path });
  if (existing && existing.length > 0) {
    const entity = existing[0];
    const entityId = entity.id as string;
    const updated = { ...entity, status: 'validated' };
    delete updated._key;
    await storage.put('suite-manager', entityId, updated);

    const concepts = (typeof entity.conceptCount === 'number') ? entity.conceptCount : 0;
    const syncs = (typeof entity.syncCount === 'number') ? entity.syncCount : 0;
    return { variant: 'ok', suite: entityId, concepts, syncs };
  }

  // No existing suite — create a new entry
  const suiteId = nextId();
  const suiteName = path.replace(/^\.\/suites\//, '').replace(/\/$/, '');
  await storage.put('suite-manager', suiteId, {
    id: suiteId,
    name: suiteName,
    path,
    status: 'validated',
    createdAt: new Date().toISOString(),
  });
  return { variant: 'ok', suite: suiteId, concepts: 0, syncs: 0 };
}

export const suiteManagerHandler = new Proxy(_base, {
  get(target, prop: string) {
    if (prop === 'validate') return _validate;
    return (target as Record<string, unknown>)[prop];
  },
}) as typeof _base;

/** Reset the ID counter. Useful for testing. */
export function resetSuiteManagerCounter(): void {
  idCounter = 0;
}
