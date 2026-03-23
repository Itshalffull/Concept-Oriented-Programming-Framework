// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SuiteManager Handler
//
// Manage suites -- scaffold new suites, validate suite
// manifests and cross-suite references, run suite tests, list
// active suites, and check app overrides.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, get, put, complete, completeFrom,
  branch, mapBindings, traverse, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `suite-manager-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  init(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'alreadyExists', { message: 'name is required' }) as StorageProgram<Result>;
    }
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

  /**
   * Validate a suite at the given path.
   * Uses find + traverse to update existing records with dynamic storage keys,
   * or creates a new entry if none exists.
   */
  validate(input: Record<string, unknown>) {
    if (!input.path || (typeof input.path === 'string' && (input.path as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }
    const path = input.path as string;

    let p = createProgram();
    p = find(p, 'suite-manager', { path }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (thenP) => {
        // Update existing suite status using traverse for dynamic key access
        thenP = traverse(thenP, 'existing', '_entity', (item) => {
          const entity = item as Record<string, unknown>;
          const entityId = entity.id as string;
          const updated = { ...entity, status: 'validated' };
          delete updated._key;

          let sub = createProgram();
          sub = put(sub, 'suite-manager', entityId, updated);
          return complete(sub, 'ok', {
            suite: entityId,
            concepts: (typeof entity.conceptCount === 'number') ? entity.conceptCount : 0,
            syncs: (typeof entity.syncCount === 'number') ? entity.syncCount : 0,
          });
        }, '_validateResults', { writes: ['suite-manager'], completionVariants: ['ok'] });

        return completeFrom(thenP, 'ok', (b) => {
          const results = (b._validateResults || []) as Array<Record<string, unknown>>;
          if (results.length > 0) {
            return {
              suite: results[0].suite as string,
              concepts: results[0].concepts as number,
              syncs: results[0].syncs as number,
            };
          }
          return { suite: '', concepts: 0, syncs: 0 };
        });
      },
      (elseP) => {
        const suiteId = nextId();
        const suiteName = path.replace(/^\.\/suites\//, '').replace(/\/$/, '');
        elseP = put(elseP, 'suite-manager', suiteId, {
          id: suiteId,
          name: suiteName,
          path,
          status: 'validated',
          createdAt: new Date().toISOString(),
        });
        return complete(elseP, 'ok', { suite: suiteId, concepts: 0, syncs: 0 }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  test(input: Record<string, unknown>) {
    if (!input.path || (typeof input.path === 'string' && (input.path as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }
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

// All actions are now fully functional — no imperative overrides needed.
export const suiteManagerHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSuiteManagerCounter(): void {
  idCounter = 0;
}
