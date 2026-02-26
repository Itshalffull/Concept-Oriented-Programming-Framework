// ============================================================
// Merge Handler
//
// Combine two divergent versions of content that share a common
// ancestor, producing a unified result or identifying conflicts.
// Strategy is selected by content type and configuration.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `merge-${++idCounter}`;
}

interface ConflictRegion {
  region: string;
  oursContent: string;
  theirsContent: string;
  status: string;
  resolution?: string;
}

/** Simple three-way line merge */
function threeWayMerge(base: string, ours: string, theirs: string): {
  result: string | null;
  conflicts: ConflictRegion[];
} {
  const baseLines = base.split('\n');
  const ourLines = ours.split('\n');
  const theirLines = theirs.split('\n');
  const conflicts: ConflictRegion[] = [];
  const resultLines: string[] = [];

  const maxLen = Math.max(baseLines.length, ourLines.length, theirLines.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = i < baseLines.length ? baseLines[i] : undefined;
    const ourLine = i < ourLines.length ? ourLines[i] : undefined;
    const theirLine = i < theirLines.length ? theirLines[i] : undefined;

    if (ourLine === theirLine) {
      // Both agree
      if (ourLine !== undefined) resultLines.push(ourLine);
    } else if (ourLine === baseLine) {
      // Only theirs changed
      if (theirLine !== undefined) resultLines.push(theirLine);
    } else if (theirLine === baseLine) {
      // Only ours changed
      if (ourLine !== undefined) resultLines.push(ourLine);
    } else {
      // Both changed differently -- conflict
      conflicts.push({
        region: `line ${i + 1}`,
        oursContent: ourLine ?? '',
        theirsContent: theirLine ?? '',
        status: 'unresolved',
      });
      // Add conflict marker to result
      resultLines.push(`<<<<<<< ours`);
      if (ourLine !== undefined) resultLines.push(ourLine);
      resultLines.push(`=======`);
      if (theirLine !== undefined) resultLines.push(theirLine);
      resultLines.push(`>>>>>>> theirs`);
    }
  }

  if (conflicts.length === 0) {
    return { result: resultLines.join('\n'), conflicts: [] };
  }

  return { result: null, conflicts };
}

export const mergeHandler: ConceptHandler = {
  async registerStrategy(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const contentTypes = input.contentTypes as string[];

    // Check for duplicates
    const existing = await storage.find('merge-strategy', { name });
    if (existing.length > 0) {
      return { variant: 'duplicate', message: `Strategy '${name}' already registered` };
    }

    const id = nextId();
    await storage.put('merge-strategy', id, {
      id,
      name,
      contentTypes: Array.isArray(contentTypes) ? contentTypes : [],
    });

    return { variant: 'ok', strategy: id };
  },

  async merge(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string;
    const ours = input.ours as string;
    const theirs = input.theirs as string;
    const strategy = input.strategy as string | null | undefined;

    // If strategy specified, verify it exists
    if (strategy) {
      const strategies = await storage.find('merge-strategy', { name: strategy });
      if (strategies.length === 0) {
        return { variant: 'noStrategy', message: `No strategy registered for '${strategy}'` };
      }
    }

    // Perform three-way merge
    const { result, conflicts } = threeWayMerge(base, ours, theirs);

    if (result !== null && conflicts.length === 0) {
      return { variant: 'clean', result };
    }

    // Create active merge record with conflicts
    const mergeId = nextId();
    await storage.put('merge-active', mergeId, {
      id: mergeId,
      base,
      ours,
      theirs,
      conflicts: JSON.stringify(conflicts),
      result: null,
    });

    return { variant: 'conflicts', mergeId, conflictCount: conflicts.length };
  },

  async resolveConflict(input: Record<string, unknown>, storage: ConceptStorage) {
    const mergeId = input.mergeId as string;
    const conflictIndex = input.conflictIndex as number;
    const resolution = input.resolution as string;

    const mergeRecord = await storage.get('merge-active', mergeId);
    if (!mergeRecord) {
      return { variant: 'invalidIndex', message: `Merge '${mergeId}' not found` };
    }

    const conflicts = JSON.parse(mergeRecord.conflicts as string) as ConflictRegion[];

    if (conflictIndex < 0 || conflictIndex >= conflicts.length) {
      return { variant: 'invalidIndex', message: `Conflict index ${conflictIndex} out of range [0, ${conflicts.length - 1}]` };
    }

    if (conflicts[conflictIndex].status === 'resolved') {
      return { variant: 'alreadyResolved', message: `Conflict at index ${conflictIndex} was already resolved` };
    }

    conflicts[conflictIndex].status = 'resolved';
    conflicts[conflictIndex].resolution = resolution;

    const remaining = conflicts.filter(c => c.status !== 'resolved').length;

    await storage.put('merge-active', mergeId, {
      ...mergeRecord,
      conflicts: JSON.stringify(conflicts),
    });

    return { variant: 'ok', remaining };
  },

  async finalize(input: Record<string, unknown>, storage: ConceptStorage) {
    const mergeId = input.mergeId as string;

    const mergeRecord = await storage.get('merge-active', mergeId);
    if (!mergeRecord) {
      return { variant: 'unresolvedConflicts', count: 0 };
    }

    const conflicts = JSON.parse(mergeRecord.conflicts as string) as ConflictRegion[];
    const unresolved = conflicts.filter(c => c.status !== 'resolved');

    if (unresolved.length > 0) {
      return { variant: 'unresolvedConflicts', count: unresolved.length };
    }

    // Build final result by applying resolutions
    const base = mergeRecord.base as string;
    const ours = mergeRecord.ours as string;
    const theirs = mergeRecord.theirs as string;
    const baseLines = base.split('\n');
    const ourLines = ours.split('\n');
    const theirLines = theirs.split('\n');
    const maxLen = Math.max(baseLines.length, ourLines.length, theirLines.length);
    const resultLines: string[] = [];
    let conflictIdx = 0;

    for (let i = 0; i < maxLen; i++) {
      const baseLine = i < baseLines.length ? baseLines[i] : undefined;
      const ourLine = i < ourLines.length ? ourLines[i] : undefined;
      const theirLine = i < theirLines.length ? theirLines[i] : undefined;

      if (ourLine === theirLine) {
        if (ourLine !== undefined) resultLines.push(ourLine);
      } else if (ourLine === baseLine) {
        if (theirLine !== undefined) resultLines.push(theirLine);
      } else if (theirLine === baseLine) {
        if (ourLine !== undefined) resultLines.push(ourLine);
      } else {
        // This was a conflict -- use resolution
        if (conflictIdx < conflicts.length && conflicts[conflictIdx].resolution !== undefined) {
          resultLines.push(conflicts[conflictIdx].resolution!);
        }
        conflictIdx++;
      }
    }

    const result = resultLines.join('\n');

    // Clean up active merge
    await storage.del('merge-active', mergeId);

    return { variant: 'ok', result };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetMergeCounter(): void {
  idCounter = 0;
}
