// Per-field comparison conflict resolver with partial auto-resolve capability
// Iterates all fields in both versions, comparing against the ancestor to determine
// which side changed each field. True conflicts arise only when both sides modified
// the same field to different values.

export interface Conflict {
  entityId: string;
  versionA: Record<string, unknown>;
  versionB: Record<string, unknown>;
  ancestor?: Record<string, unknown>;
  fieldConflicts: string[];
  timestampA?: number;
  timestampB?: number;
}

export interface ResolverConfig {
  options?: Record<string, unknown>;
}

export interface Resolution {
  winner: Record<string, unknown>;
  strategy: string;
  details: Record<string, unknown>;
}

export const PROVIDER_ID = 'field_merge';
export const PLUGIN_TYPE = 'conflict_resolver';

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

function collectAllFields(...records: (Record<string, unknown> | undefined)[]): Set<string> {
  const fields = new Set<string>();
  for (const rec of records) {
    if (rec) {
      for (const key of Object.keys(rec)) {
        fields.add(key);
      }
    }
  }
  return fields;
}

export class FieldMergeResolverProvider {
  resolve(conflict: Conflict, _config: ResolverConfig): Resolution {
    const ancestor = conflict.ancestor ?? {};
    const allFields = collectAllFields(conflict.versionA, conflict.versionB, ancestor);

    const merged: Record<string, unknown> = {};
    const autoMerged: string[] = [];
    const trueConflicts: string[] = [];
    const fieldDecisions: Record<string, string> = {};

    for (const field of allFields) {
      const valAncestor = ancestor[field];
      const valA = conflict.versionA[field];
      const valB = conflict.versionB[field];

      const aChanged = !deepEqual(valAncestor, valA);
      const bChanged = !deepEqual(valAncestor, valB);

      if (!aChanged && !bChanged) {
        // Neither side changed this field, keep ancestor value
        merged[field] = valAncestor;
        fieldDecisions[field] = 'unchanged';
      } else if (aChanged && !bChanged) {
        // Only A changed this field — take A's value
        merged[field] = valA;
        autoMerged.push(field);
        fieldDecisions[field] = 'took_version_a';
      } else if (!aChanged && bChanged) {
        // Only B changed this field — take B's value
        merged[field] = valB;
        autoMerged.push(field);
        fieldDecisions[field] = 'took_version_b';
      } else if (deepEqual(valA, valB)) {
        // Both changed to the same value — take either
        merged[field] = valA;
        autoMerged.push(field);
        fieldDecisions[field] = 'both_agree';
      } else {
        // True conflict: both sides changed to different values
        trueConflicts.push(field);
        merged[field] = valA; // Default to version A for unresolved conflicts
        fieldDecisions[field] = 'conflict_defaulted_to_a';
      }
    }

    return {
      winner: merged,
      strategy: 'field_merge',
      details: {
        entityId: conflict.entityId,
        autoMergedFields: autoMerged,
        trueConflicts,
        fieldDecisions,
        totalFields: allFields.size,
        autoMergedCount: autoMerged.length,
        trueConflictCount: trueConflicts.length,
        fullyResolved: trueConflicts.length === 0,
      },
    };
  }

  canAutoResolve(conflict: Conflict): boolean {
    const ancestor = conflict.ancestor ?? {};
    const allFields = collectAllFields(conflict.versionA, conflict.versionB, ancestor);

    for (const field of allFields) {
      const valAncestor = ancestor[field];
      const valA = conflict.versionA[field];
      const valB = conflict.versionB[field];

      const aChanged = !deepEqual(valAncestor, valA);
      const bChanged = !deepEqual(valAncestor, valB);

      if (aChanged && bChanged && !deepEqual(valA, valB)) {
        return false;
      }
    }

    return true;
  }
}

export default FieldMergeResolverProvider;
