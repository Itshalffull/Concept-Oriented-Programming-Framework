// Manual queue conflict resolver — never auto-resolves
// Stores both versions in a queue with side-by-side field comparison,
// generates a human-readable diff, and marks conflicts as pending manual review.

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

interface FieldComparison {
  field: string;
  valueA: unknown;
  valueB: unknown;
  ancestorValue: unknown;
  isConflicting: boolean;
  diffDescription: string;
}

export const PROVIDER_ID = 'manual_queue';
export const PLUGIN_TYPE = 'conflict_resolver';

function formatValue(val: unknown): string {
  if (val === undefined) return '<undefined>';
  if (val === null) return '<null>';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function generateFieldComparison(
  field: string,
  valA: unknown,
  valB: unknown,
  valAnc: unknown
): FieldComparison {
  const aStr = formatValue(valA);
  const bStr = formatValue(valB);
  const isConflicting = aStr !== bStr;

  let diffDescription: string;
  if (!isConflicting) {
    diffDescription = `${field}: both versions agree = ${aStr}`;
  } else if (valAnc !== undefined) {
    diffDescription = `${field}: ancestor=${formatValue(valAnc)} | A=${aStr} | B=${bStr}`;
  } else {
    diffDescription = `${field}: A=${aStr} | B=${bStr}`;
  }

  return { field, valueA: valA, valueB: valB, ancestorValue: valAnc, isConflicting, diffDescription };
}

function generateHumanReadableDiff(comparisons: FieldComparison[]): string {
  const lines: string[] = [
    '=== Conflict Review Required ===',
    '',
  ];

  const conflicting = comparisons.filter(c => c.isConflicting);
  const agreeing = comparisons.filter(c => !c.isConflicting);

  if (conflicting.length > 0) {
    lines.push(`Conflicting fields (${conflicting.length}):`);
    for (const comp of conflicting) {
      lines.push(`  [!] ${comp.diffDescription}`);
    }
    lines.push('');
  }

  if (agreeing.length > 0) {
    lines.push(`Agreeing fields (${agreeing.length}):`);
    for (const comp of agreeing) {
      lines.push(`  [=] ${comp.diffDescription}`);
    }
  }

  return lines.join('\n');
}

function buildConflictMarkerRecord(
  comparisons: FieldComparison[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const comp of comparisons) {
    if (comp.isConflicting) {
      merged[comp.field] = {
        __conflict: true,
        versionA: comp.valueA,
        versionB: comp.valueB,
        ancestor: comp.ancestorValue,
      };
    } else {
      merged[comp.field] = comp.valueA;
    }
  }
  return merged;
}

export class ManualQueueResolverProvider {
  resolve(conflict: Conflict, _config: ResolverConfig): Resolution {
    const ancestor = conflict.ancestor ?? {};
    const allFields = new Set([
      ...Object.keys(conflict.versionA),
      ...Object.keys(conflict.versionB),
      ...Object.keys(ancestor),
    ]);

    const comparisons: FieldComparison[] = [];
    for (const field of allFields) {
      comparisons.push(generateFieldComparison(
        field,
        conflict.versionA[field],
        conflict.versionB[field],
        ancestor[field],
      ));
    }

    const humanReadableDiff = generateHumanReadableDiff(comparisons);
    const markerRecord = buildConflictMarkerRecord(comparisons);

    const conflictingFields = comparisons.filter(c => c.isConflicting).map(c => c.field);
    const agreeingFields = comparisons.filter(c => !c.isConflicting).map(c => c.field);

    return {
      winner: markerRecord,
      strategy: 'manual_queue',
      details: {
        status: 'pending_manual_review',
        entityId: conflict.entityId,
        humanReadableDiff,
        sideBySide: comparisons,
        conflictingFields,
        agreeingFields,
        totalFields: allFields.size,
        conflictCount: conflictingFields.length,
        versionA: conflict.versionA,
        versionB: conflict.versionB,
        queuedAt: Date.now(),
      },
    };
  }

  canAutoResolve(_conflict: Conflict): boolean {
    return false;
  }
}

export default ManualQueueResolverProvider;
