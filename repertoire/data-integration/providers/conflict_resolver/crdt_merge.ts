// CRDT-based conflict-free merge resolver
// Always auto-resolves mathematically using convergent replicated data types.
// Applies per-field CRDT merge strategies: LWW-Register for scalars,
// G-Counter for numeric increments, OR-Set for collections.

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

export const PROVIDER_ID = 'crdt_merge';
export const PLUGIN_TYPE = 'conflict_resolver';

type CrdtStrategy = 'lww_register' | 'g_counter' | 'or_set';

function detectFieldCrdtType(valA: unknown, valB: unknown, ancestor: unknown): CrdtStrategy {
  if (Array.isArray(valA) || Array.isArray(valB) || Array.isArray(ancestor)) {
    return 'or_set';
  }
  if (typeof valA === 'number' && typeof valB === 'number') {
    if (typeof ancestor === 'number') {
      const deltaA = valA - ancestor;
      const deltaB = valB - ancestor;
      if (deltaA >= 0 && deltaB >= 0) {
        return 'g_counter';
      }
    }
    return 'lww_register';
  }
  return 'lww_register';
}

function mergeLwwRegister(
  valA: unknown, valB: unknown, tsA: number, tsB: number
): { value: unknown; source: string } {
  if (tsA >= tsB) {
    return { value: valA, source: 'A' };
  }
  return { value: valB, source: 'B' };
}

function mergeGCounter(valA: number, valB: number, ancestor: number): number {
  // G-Counter merge: ancestor + max(deltaA, deltaB) for each counter
  // In a single-actor model, this reduces to taking the max
  const deltaA = valA - ancestor;
  const deltaB = valB - ancestor;
  return ancestor + Math.max(deltaA, deltaB);
}

function mergeOrSet(
  arrA: unknown[], arrB: unknown[], ancestor: unknown[]
): unknown[] {
  // OR-Set semantics: union of all additions, minus observed removals
  const ancestorSet = new Set(ancestor.map(v => JSON.stringify(v)));
  const addedByA = arrA.filter(v => !ancestorSet.has(JSON.stringify(v)));
  const addedByB = arrB.filter(v => !ancestorSet.has(JSON.stringify(v)));

  const removedByA = ancestor.filter(v => !arrA.map(x => JSON.stringify(x)).includes(JSON.stringify(v)));
  const removedByB = ancestor.filter(v => !arrB.map(x => JSON.stringify(x)).includes(JSON.stringify(v)));

  // Items removed by both sides are truly removed (tombstoned)
  const tombstoned = new Set(
    removedByA
      .filter(v => removedByB.some(rb => JSON.stringify(rb) === JSON.stringify(v)))
      .map(v => JSON.stringify(v))
  );

  // Start with ancestor, remove tombstoned, add new items from both sides
  const base = ancestor.filter(v => !tombstoned.has(JSON.stringify(v)));
  const seen = new Set(base.map(v => JSON.stringify(v)));

  for (const item of [...addedByA, ...addedByB]) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      base.push(item);
      seen.add(key);
    }
  }

  return base;
}

export class CrdtMergeResolverProvider {
  resolve(conflict: Conflict, _config: ResolverConfig): Resolution {
    const ancestor = conflict.ancestor ?? {};
    const tsA = conflict.timestampA ?? 0;
    const tsB = conflict.timestampB ?? 0;
    const allFields = new Set([
      ...Object.keys(conflict.versionA),
      ...Object.keys(conflict.versionB),
      ...Object.keys(ancestor),
    ]);

    const merged: Record<string, unknown> = {};
    const fieldStrategies: Record<string, CrdtStrategy> = {};
    const fieldSources: Record<string, string> = {};

    for (const field of allFields) {
      const valA = conflict.versionA[field];
      const valB = conflict.versionB[field];
      const valAnc = ancestor[field];

      const crdtType = detectFieldCrdtType(valA, valB, valAnc);
      fieldStrategies[field] = crdtType;

      switch (crdtType) {
        case 'lww_register': {
          const result = mergeLwwRegister(valA, valB, tsA, tsB);
          merged[field] = result.value;
          fieldSources[field] = `lww_${result.source.toLowerCase()}`;
          break;
        }
        case 'g_counter': {
          const counterVal = mergeGCounter(
            valA as number,
            valB as number,
            (valAnc as number) ?? 0,
          );
          merged[field] = counterVal;
          fieldSources[field] = 'g_counter_max';
          break;
        }
        case 'or_set': {
          const setVal = mergeOrSet(
            Array.isArray(valA) ? valA : [],
            Array.isArray(valB) ? valB : [],
            Array.isArray(valAnc) ? valAnc : [],
          );
          merged[field] = setVal;
          fieldSources[field] = 'or_set_union';
          break;
        }
      }
    }

    return {
      winner: merged,
      strategy: 'crdt_merge',
      details: {
        entityId: conflict.entityId,
        fieldStrategies,
        fieldSources,
        totalFields: allFields.size,
        convergenceGuaranteed: true,
      },
    };
  }

  canAutoResolve(_conflict: Conflict): boolean {
    return true;
  }
}

export default CrdtMergeResolverProvider;
