// ============================================================
// ConflictResolution Handler
//
// Detect and resolve incompatible concurrent modifications using a
// pluggable strategy selected by data type and domain policy.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export const conflictResolutionHandler: ConceptHandler = {
  async registerPolicy(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const priority = input.priority as number;

    const existing = await storage.find('conflict-resolution-policy', { name });
    if (existing.length > 0) {
      return { variant: 'duplicate', message: `Policy "${name}" already exists` };
    }

    const id = nextId('policy');
    await storage.put('conflict-resolution-policy', id, {
      id,
      name,
      priority,
    });

    return { variant: 'ok', policy: id };
  },

  async detect(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string | undefined;
    const version1 = input.version1 as string;
    const version2 = input.version2 as string;
    const context = input.context as string;

    // If both versions are identical, no conflict
    if (version1 === version2) {
      return { variant: 'noConflict' };
    }

    // Versions differ — record as a conflict
    const conflictId = nextId('conflict');
    const detail = JSON.stringify({
      base: base ?? null,
      version1,
      version2,
      context,
    });

    await storage.put('conflict-resolution', conflictId, {
      id: conflictId,
      base: base ?? null,
      version1,
      version2,
      clock1: '',
      clock2: '',
      context,
      resolution: null,
      status: 'pending',
    });

    return {
      variant: 'detected',
      conflictId,
      detail,
    };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const conflictId = input.conflictId as string;
    const policyOverride = input.policyOverride as string | undefined;

    const conflict = await storage.get('conflict-resolution', conflictId);
    if (!conflict) {
      return { variant: 'noPolicy', message: `Conflict "${conflictId}" not found` };
    }

    // Gather policies, sorted by priority (lowest first)
    const allPolicies = await storage.find('conflict-resolution-policy', {});
    const sortedPolicies = allPolicies.sort(
      (a, b) => (a.priority as number) - (b.priority as number),
    );

    // If override specified, filter to that policy only
    const candidates = policyOverride
      ? sortedPolicies.filter((p) => p.name === policyOverride)
      : sortedPolicies;

    if (candidates.length === 0) {
      return {
        variant: 'noPolicy',
        message: policyOverride
          ? `No policy named "${policyOverride}" registered`
          : 'No resolution policies registered',
      };
    }

    // Attempt automatic resolution with each candidate policy in priority order.
    // In a full system, policies would be external providers called through the
    // registry. Here we check whether the conflict already carries a resolution
    // (e.g. set by an external provider or a previous manual step).
    if (conflict.resolution !== null && conflict.resolution !== undefined) {
      const result = conflict.resolution as string;
      await storage.put('conflict-resolution', conflictId, {
        ...conflict,
        status: 'resolved',
      });
      return { variant: 'resolved', result };
    }

    // No automatic resolution found — escalate to human review
    const options = [
      JSON.stringify(conflict.version1),
      JSON.stringify(conflict.version2),
    ];
    if (conflict.base !== null && conflict.base !== undefined) {
      options.push(JSON.stringify(conflict.base));
    }

    return {
      variant: 'requiresHuman',
      conflictId,
      options,
    };
  },

  async manualResolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const conflictId = input.conflictId as string;
    const chosen = input.chosen as string;

    const conflict = await storage.get('conflict-resolution', conflictId);
    if (!conflict || conflict.status !== 'pending') {
      return {
        variant: 'notPending',
        message: conflict
          ? `Conflict "${conflictId}" is already resolved`
          : `Conflict "${conflictId}" not found`,
      };
    }

    await storage.put('conflict-resolution', conflictId, {
      ...conflict,
      resolution: chosen,
      status: 'resolved',
    });

    return { variant: 'ok', result: chosen };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConflictResolutionCounter(): void {
  idCounter = 0;
}
