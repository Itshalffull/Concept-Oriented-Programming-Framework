// Three-way merge conflict resolver — diffs both versions against a common ancestor
// Computes diff(ancestor, versionA) and diff(ancestor, versionB), merges non-overlapping
// changes cleanly. For text fields, attempts line-by-line three-way merge similar to git.

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

interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export const PROVIDER_ID = 'three_way_merge';
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

function computeDiff(ancestor: Record<string, unknown>, version: Record<string, unknown>): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(ancestor), ...Object.keys(version)]);

  for (const key of allKeys) {
    if (!deepEqual(ancestor[key], version[key])) {
      diffs.push({ field: key, oldValue: ancestor[key], newValue: version[key] });
    }
  }
  return diffs;
}

function threeWayTextMerge(ancestor: string, textA: string, textB: string): { merged: string; hasConflict: boolean } {
  const ancestorLines = ancestor.split('\n');
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const maxLen = Math.max(ancestorLines.length, linesA.length, linesB.length);

  const mergedLines: string[] = [];
  let hasConflict = false;

  for (let i = 0; i < maxLen; i++) {
    const orig = ancestorLines[i] ?? '';
    const lineA = linesA[i] ?? '';
    const lineB = linesB[i] ?? '';

    const aChanged = orig !== lineA;
    const bChanged = orig !== lineB;

    if (!aChanged && !bChanged) {
      mergedLines.push(orig);
    } else if (aChanged && !bChanged) {
      mergedLines.push(lineA);
    } else if (!aChanged && bChanged) {
      mergedLines.push(lineB);
    } else if (lineA === lineB) {
      mergedLines.push(lineA);
    } else {
      hasConflict = true;
      mergedLines.push(`<<<<<<< version_a`);
      mergedLines.push(lineA);
      mergedLines.push(`=======`);
      mergedLines.push(lineB);
      mergedLines.push(`>>>>>>> version_b`);
    }
  }

  return { merged: mergedLines.join('\n'), hasConflict };
}

export class ThreeWayMergeResolverProvider {
  resolve(conflict: Conflict, _config: ResolverConfig): Resolution {
    const ancestor = conflict.ancestor ?? {};
    const diffA = computeDiff(ancestor, conflict.versionA);
    const diffB = computeDiff(ancestor, conflict.versionB);

    const diffAFields = new Set(diffA.map(d => d.field));
    const diffBFields = new Set(diffB.map(d => d.field));

    const merged: Record<string, unknown> = { ...ancestor };
    const cleanMerges: string[] = [];
    const overlappingConflicts: string[] = [];
    const textMerges: string[] = [];

    // Apply non-overlapping diffs from A
    for (const diff of diffA) {
      if (!diffBFields.has(diff.field)) {
        merged[diff.field] = diff.newValue;
        cleanMerges.push(diff.field);
      }
    }

    // Apply non-overlapping diffs from B
    for (const diff of diffB) {
      if (!diffAFields.has(diff.field)) {
        merged[diff.field] = diff.newValue;
        cleanMerges.push(diff.field);
      }
    }

    // Handle overlapping changes
    for (const diff of diffA) {
      if (diffBFields.has(diff.field)) {
        const valA = conflict.versionA[diff.field];
        const valB = conflict.versionB[diff.field];

        if (deepEqual(valA, valB)) {
          merged[diff.field] = valA;
          cleanMerges.push(diff.field);
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          const ancestorText = (ancestor[diff.field] as string) ?? '';
          const result = threeWayTextMerge(ancestorText, valA, valB);
          merged[diff.field] = result.merged;
          if (result.hasConflict) {
            overlappingConflicts.push(diff.field);
          } else {
            textMerges.push(diff.field);
          }
        } else {
          // Non-text overlapping conflict, default to version A
          merged[diff.field] = valA;
          overlappingConflicts.push(diff.field);
        }
      }
    }

    return {
      winner: merged,
      strategy: 'three_way_merge',
      details: {
        entityId: conflict.entityId,
        diffSetA: diffA.map(d => d.field),
        diffSetB: diffB.map(d => d.field),
        cleanMerges,
        textMerges,
        overlappingConflicts,
        hasAncestor: conflict.ancestor !== undefined,
        fullyResolved: overlappingConflicts.length === 0,
      },
    };
  }

  canAutoResolve(conflict: Conflict): boolean {
    const ancestor = conflict.ancestor ?? {};
    const diffA = computeDiff(ancestor, conflict.versionA);
    const diffB = computeDiff(ancestor, conflict.versionB);

    const diffAFields = new Set(diffA.map(d => d.field));

    for (const diff of diffB) {
      if (diffAFields.has(diff.field)) {
        const valA = conflict.versionA[diff.field];
        const valB = conflict.versionB[diff.field];
        if (!deepEqual(valA, valB)) {
          return false;
        }
      }
    }

    return true;
  }
}

export default ThreeWayMergeResolverProvider;
