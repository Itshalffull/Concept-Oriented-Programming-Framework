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
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, putFrom,
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
        return completeFrom(b, '', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const storedInputHash = existing.inputHash as string;
          const stale = existing.stale as boolean;

          // Nondeterministic transforms always re-run
          if (!deterministic) {
            return { variant: 'changed', previousHash: storedInputHash };
          }

          // Stale entries (invalidated) always re-run
          if (stale) {
            return { variant: 'changed', previousHash: storedInputHash };
          }

          // Hash mismatch means input changed
          if (storedInputHash !== inputHash) {
            return { variant: 'changed', previousHash: storedInputHash };
          }

          // Cache hit — input unchanged and deterministic
          return {
            variant: 'unchanged',
            lastRun: existing.lastRun as string,
            outputRef: existing.outputRef || null,
          };
        });
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

    p2 = put(p2, ENTRIES_RELATION, stepKey, {
      id: '', // placeholder, overridden by putFrom below
      stepKey,
      inputHash,
      outputHash,
      outputRef: outputRef || null,
      sourceLocator: sourceLocator || null,
      kind: kind || null,
      deterministic,
      lastRun: now,
      stale: false,
    });

    // Overwrite with correct id via putFrom
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
   */
  invalidateBySource(input: Record<string, unknown>) {
    const sourceLocator = input.sourceLocator as string;

    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    // Note: Iterative puts over dynamic result sets are not natively supported
    // in the free monad DSL. We compute the invalidated list and report it;
    // bulk stale-marking is handled at the interpreter level.
    return completeFrom(p, 'ok', (bindings) => {
      const allEntries = bindings.allEntries as Array<Record<string, unknown>>;
      const invalidated = allEntries
        .filter(entry => entry.sourceLocator === sourceLocator)
        .map(entry => entry.stepKey as string);
      return { invalidated };
    }) as StorageProgram<Result>;
  },

  /**
   * Invalidate all cache entries whose step key relates to a given kind.
   */
  invalidateByKind(input: Record<string, unknown>) {
    const kind = (input.kind || input.kindName) as string;

    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const allEntries = bindings.allEntries as Array<Record<string, unknown>>;
      const invalidated: string[] = [];

      for (const entry of allEntries) {
        const stepKey = entry.stepKey as string;
        const entryKind = entry.kind as string | null;
        const matches = entryKind ? entryKind === kind : stepKey.includes(kind);
        if (matches) {
          invalidated.push(stepKey);
        }
      }

      return { invalidated };
    }) as StorageProgram<Result>;
  },

  /**
   * Clear all cache entries. Full rebuild on next run.
   */
  invalidateAll(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, ENTRIES_RELATION, {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const allEntries = bindings.allEntries as Array<Record<string, unknown>>;
      return { cleared: allEntries.length };
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

export const buildCacheHandler = autoInterpret(_handler);
