// ============================================================
// BuildCache Concept Implementation
//
// Tracks input/output hashes for generation steps. Enables
// incremental rebuilds by skipping generation when inputs
// haven't changed since the last successful run.
// See copf-generation-kit.md Part 1.3
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';
import { randomUUID } from 'crypto';

const ENTRIES_RELATION = 'entries';

export const buildCacheHandler: ConceptHandler = {
  /**
   * Check whether a generation step needs to re-run.
   *
   * Returns 'unchanged' if the input hash matches the stored hash
   * AND the transform is deterministic. Returns 'changed' otherwise.
   * Nondeterministic transforms always return 'changed'.
   */
  async check(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const stepKey = input.stepKey as string;
    const inputHash = input.inputHash as string;
    const deterministic = input.deterministic as boolean;

    const existing = await storage.get(ENTRIES_RELATION, stepKey);

    if (!existing) {
      return { variant: 'changed', previousHash: null };
    }

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
  },

  /**
   * Record a successful generation step.
   */
  async record(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const stepKey = input.stepKey as string;
    const inputHash = input.inputHash as string;
    const outputHash = input.outputHash as string;
    const outputRef = input.outputRef as string | undefined;
    const sourceLocator = input.sourceLocator as string | undefined;
    const deterministic = input.deterministic as boolean;

    const existing = await storage.get(ENTRIES_RELATION, stepKey);
    const entryId = existing ? (existing.id as string) : randomUUID();
    const now = new Date().toISOString();

    const kind = input.kind as string | undefined;

    await storage.put(ENTRIES_RELATION, stepKey, {
      id: entryId,
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

    return { variant: 'ok', entry: entryId };
  },

  /**
   * Force a specific step to re-run by marking it stale.
   */
  async invalidate(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const stepKey = input.stepKey as string;
    const existing = await storage.get(ENTRIES_RELATION, stepKey);

    if (!existing) {
      return { variant: 'notFound' };
    }

    await storage.put(ENTRIES_RELATION, stepKey, {
      ...existing,
      stale: true,
    });

    return { variant: 'ok' };
  },

  /**
   * Invalidate all cache entries whose sourceLocator matches.
   */
  async invalidateBySource(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const sourceLocator = input.sourceLocator as string;
    const allEntries = await storage.find(ENTRIES_RELATION);
    const invalidated: string[] = [];

    for (const entry of allEntries) {
      if (entry.sourceLocator === sourceLocator) {
        await storage.put(ENTRIES_RELATION, entry.stepKey as string, {
          ...entry,
          stale: true,
        });
        invalidated.push(entry.stepKey as string);
      }
    }

    return { variant: 'ok', invalidated };
  },

  /**
   * Invalidate all cache entries whose step key relates to a given kind.
   * Uses simple string matching on the step key convention
   * {family}:{generator}:{target}.
   */
  async invalidateByKind(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const kind = (input.kind || input.kindName) as string;
    const allEntries = await storage.find(ENTRIES_RELATION);
    const invalidated: string[] = [];

    for (const entry of allEntries) {
      const stepKey = entry.stepKey as string;
      const entryKind = entry.kind as string | null;

      // Match on stored kind field, or fall back to stepKey substring match
      const matches = entryKind
        ? entryKind === kind
        : stepKey.includes(kind);

      if (matches) {
        await storage.put(ENTRIES_RELATION, stepKey, {
          ...entry,
          stale: true,
        });
        invalidated.push(stepKey);
      }
    }

    return { variant: 'ok', invalidated };
  },

  /**
   * Clear all cache entries. Full rebuild on next run.
   */
  async invalidateAll(
    _input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const allEntries = await storage.find(ENTRIES_RELATION);
    let cleared = 0;

    for (const entry of allEntries) {
      await storage.put(ENTRIES_RELATION, entry.stepKey as string, {
        ...entry,
        stale: true,
      });
      cleared++;
    }

    return { variant: 'ok', cleared };
  },

  /**
   * Return current cache status for all entries.
   */
  async status(
    _input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const allEntries = await storage.find(ENTRIES_RELATION);
    const entries = allEntries.map(entry => ({
      stepKey: entry.stepKey as string,
      inputHash: entry.inputHash as string,
      lastRun: entry.lastRun as string,
      stale: (entry.stale as boolean) || false,
    }));

    return { variant: 'ok', entries };
  },

  /**
   * Return step keys for all stale entries.
   */
  async staleSteps(
    _input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const allEntries = await storage.find(ENTRIES_RELATION);
    const steps = allEntries
      .filter(entry => entry.stale === true)
      .map(entry => entry.stepKey as string);

    return { variant: 'ok', steps };
  },
};
