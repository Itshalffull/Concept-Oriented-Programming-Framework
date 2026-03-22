// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// BuildCache Concept Implementation
//
// Tracks input/output hashes for generation steps. Enables
// incremental rebuilds by skipping generation when inputs
// haven't changed since the last successful run.
// See clef-generation-suite.md Part 1.3
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, putFrom, traverse,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const ENTRIES_RELATION = 'entries';

const _handler: FunctionalConceptHandler = {
  /**
   * Check whether a generation step needs to re-run.
   *
   * Returns 'unchanged' if the input hash matches the stored hash
   * AND the transform is deterministic. Returns 'changed' otherwise.
   * Nondeterministic transforms always return 'changed'.
   */
  check(input: Record<string, unknown>) {
    const stepKey = input.stepKey as string;
    const inputHash = input.inputHash as string;
    const deterministic = input.deterministic as boolean;

    let p = createProgram();
    p = get(p, ENTRIES_RELATION, stepKey, 'existing');

    p = branch(p, 'existing',
      (b) => {
        // Compute whether the cache is a hit and extract relevant fields
        const b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const storedInputHash = existing.inputHash as string;
          const stale = existing.stale as boolean;
          if (!deterministic || stale || storedInputHash !== inputHash) {
            return { cacheHit: false, previousHash: storedInputHash };
          }
          return { cacheHit: true, lastRun: existing.lastRun, outputRef: existing.outputRef || null };
        }, '_cacheInfo');

        return branch(b2,
          (bindings) => {
            const info = bindings._cacheInfo as Record<string, unknown>;
            return !!info.cacheHit;
          },
          (t) => completeFrom(t, 'unchanged', (bindings) => {
            const info = bindings._cacheInfo as Record<string, unknown>;
            return {
              lastRun: info.lastRun as string,
              outputRef: info.outputRef,
            };
          }),
          (e) => completeFrom(e, 'changed', (bindings) => {
            const info = bindings._cacheInfo as Record<string, unknown>;
            return {
              previousHash: info.previousHash as string,
            };
          }),
        );
      },
      (b) => complete(b, 'changed', { previousHash: null }),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Record a successful generation step.
   */
  record(input: Record<string, unknown>) {
    const stepKey = input.stepKey as string;
    const inputHash = input.inputHash as string;
    const outputHash = input.outputHash as string;
    const outputRef = input.outputRef as string | undefined;
    const sourceLocator = input.sourceLocator as string | undefined;
    const deterministic = input.deterministic as boolean;
    const kind = input.kind as string | undefined;

    let p = createProgram();
    p = get(p, ENTRIES_RELATION, stepKey, 'existing');

    let p2 = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      return existing ? (existing.id as string) : randomUUID();
    }, 'entryId');

    const now = new Date().toISOString();

    p2 = putFrom(p2, ENTRIES_RELATION, stepKey, (bindings) => ({
      id: bindings.entryId as string,
      stepKey,
      inputHash,
      outputHash,
      outputRef: outputRef || null,
      sourceLocator: sourceLocator || null,
      kind: kind || null,
      deterministic,
      lastRun: now,
      stale: false,
    }));

    return completeFrom(p2, 'ok', (bindings) => ({
      entry: bindings.entryId as string,
    })) as StorageProgram<Result>;
  },

  /**
   * Force a specific step to re-run by marking it stale.
   */
  invalidate(input: Record<string, unknown>) {
    const stepKey = input.stepKey as string;

    let p = createProgram();
    p = get(p, ENTRIES_RELATION, stepKey, 'existing');

    p = branch(p, 'existing',
      (b) => {
        const b2 = putFrom(b, ENTRIES_RELATION, stepKey, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, stale: true };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notFound', {}),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Invalidate all cache entries whose sourceLocator matches.
   * Uses traverse to iterate over find results and mark matching entries stale.
   */
  invalidateBySource(input: Record<string, unknown>) {
    const sourceLocator = input.sourceLocator as string;

    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    p = traverse(p, 'allEntries', '_entry', (item) => {
      const entry = item as Record<string, unknown>;
      let sub = createProgram();
      if (entry.sourceLocator === sourceLocator) {
        sub = put(sub, ENTRIES_RELATION, entry.stepKey as string, { ...entry, stale: true });
        return complete(sub, 'invalidated', { stepKey: entry.stepKey });
      }
      return complete(sub, 'ok', {});
    }, '_traverseResults', { writes: ['entries'], completionVariants: ['invalidated', 'skipped'] });

    return completeFrom(p, 'ok', (bindings) => {
      const results = (bindings._traverseResults || []) as Array<Record<string, unknown>>;
      const invalidated = results
        .filter(r => r.variant === 'invalidated')
        .map(r => r.stepKey as string);
      return { invalidated };
    }) as StorageProgram<Result>;
  },

  /**
   * Invalidate all cache entries whose step key relates to a given kind.
   * Uses traverse to iterate over find results and mark matching entries stale.
   */
  invalidateByKind(input: Record<string, unknown>) {
    const kind = (input.kind || input.kindName) as string;

    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    p = traverse(p, 'allEntries', '_entry', (item) => {
      const entry = item as Record<string, unknown>;
      const stepKey = entry.stepKey as string;
      const entryKind = entry.kind as string | null;
      const matches = entryKind ? entryKind === kind : stepKey.includes(kind);

      let sub = createProgram();
      if (matches) {
        sub = put(sub, ENTRIES_RELATION, stepKey, { ...entry, stale: true });
        return complete(sub, 'invalidated', { stepKey });
      }
      return complete(sub, 'ok', {});
    }, '_traverseResults', { writes: ['entries'], completionVariants: ['invalidated', 'skipped'] });

    return completeFrom(p, 'ok', (bindings) => {
      const results = (bindings._traverseResults || []) as Array<Record<string, unknown>>;
      const invalidated = results
        .filter(r => r.variant === 'invalidated')
        .map(r => r.stepKey as string);
      return { invalidated };
    }) as StorageProgram<Result>;
  },

  /**
   * Clear all cache entries. Full rebuild on next run.
   * Uses traverse to iterate over all entries and mark each stale.
   */
  invalidateAll(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    p = traverse(p, 'allEntries', '_entry', (item) => {
      const entry = item as Record<string, unknown>;
      let sub = createProgram();
      sub = put(sub, ENTRIES_RELATION, entry.stepKey as string, { ...entry, stale: true });
      return complete(sub, 'ok', {});
    }, '_traverseResults', { writes: ['entries'], completionVariants: ['ok'] });

    return completeFrom(p, 'ok', (bindings) => {
      const results = (bindings._traverseResults || []) as Array<Record<string, unknown>>;
      return { cleared: results.length };
    }) as StorageProgram<Result>;
  },

  /**
   * Return current cache status for all entries.
   */
  status(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const allEntries = bindings.allEntries as Array<Record<string, unknown>>;
      const entries = allEntries.map(entry => ({
        stepKey: entry.stepKey as string,
        inputHash: entry.inputHash as string,
        lastRun: entry.lastRun as string,
        stale: (entry.stale as boolean) || false,
      }));
      return { entries };
    }) as StorageProgram<Result>;
  },

  /**
   * Return step keys for all stale entries.
   */
  staleSteps(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const allEntries = bindings.allEntries as Array<Record<string, unknown>>;
      const steps = allEntries
        .filter(entry => entry.stale === true)
        .map(entry => entry.stepKey as string);
      return { steps };
    }) as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const buildCacheHandler = autoInterpret(_handler);
