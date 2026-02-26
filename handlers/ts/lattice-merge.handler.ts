// ============================================================
// LatticeMerge Handler
//
// Merge CRDT-based content using lattice join semantics. Always
// produces a clean result -- lattice joins are conflict-free by
// construction. Suitable for OR-Sets, G-Counters, LWW registers,
// and similar convergent data types.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `lattice-merge-${++idCounter}`;
}

interface CRDTValue {
  type: string;
  [key: string]: unknown;
}

/**
 * Lattice join for CRDT types.
 * Supports the following CRDT lattice types:
 *
 * - g-counter: Element-wise max of counter vectors
 * - or-set: Union of observed elements, respecting removes
 * - lww-register: Keep the value with the highest timestamp
 * - max-register: Keep the maximum value
 */
function latticeJoin(base: CRDTValue, ours: CRDTValue, theirs: CRDTValue): CRDTValue | null {
  if (ours.type !== theirs.type) {
    return null;
  }

  const crdtType = ours.type;

  switch (crdtType) {
    case 'g-counter': {
      // Element-wise max of counter vectors
      const oursCounters = (ours.counters || {}) as Record<string, number>;
      const theirsCounters = (theirs.counters || {}) as Record<string, number>;
      const merged: Record<string, number> = {};

      const allKeys = new Set([...Object.keys(oursCounters), ...Object.keys(theirsCounters)]);
      for (const key of allKeys) {
        merged[key] = Math.max(oursCounters[key] || 0, theirsCounters[key] || 0);
      }

      return { type: 'g-counter', counters: merged };
    }

    case 'pn-counter': {
      // Positive-negative counter: element-wise max for both P and N
      const oursP = (ours.positive || {}) as Record<string, number>;
      const theirsP = (theirs.positive || {}) as Record<string, number>;
      const oursN = (ours.negative || {}) as Record<string, number>;
      const theirsN = (theirs.negative || {}) as Record<string, number>;

      const mergedP: Record<string, number> = {};
      const mergedN: Record<string, number> = {};

      for (const key of new Set([...Object.keys(oursP), ...Object.keys(theirsP)])) {
        mergedP[key] = Math.max(oursP[key] || 0, theirsP[key] || 0);
      }
      for (const key of new Set([...Object.keys(oursN), ...Object.keys(theirsN)])) {
        mergedN[key] = Math.max(oursN[key] || 0, theirsN[key] || 0);
      }

      return { type: 'pn-counter', positive: mergedP, negative: mergedN };
    }

    case 'or-set': {
      // Observed-Remove Set: union of all elements, respecting tombstones
      const oursElements = new Set((ours.elements || []) as string[]);
      const theirsElements = new Set((theirs.elements || []) as string[]);
      const oursTombstones = new Set((ours.tombstones || []) as string[]);
      const theirsTombstones = new Set((theirs.tombstones || []) as string[]);

      const allElements = new Set([...oursElements, ...theirsElements]);
      const allTombstones = new Set([...oursTombstones, ...theirsTombstones]);

      // Keep elements not in tombstones
      const merged: string[] = [];
      for (const elem of allElements) {
        if (!allTombstones.has(elem)) {
          merged.push(elem);
        }
      }

      return {
        type: 'or-set',
        elements: merged,
        tombstones: [...allTombstones],
      };
    }

    case 'lww-register': {
      // Last-Writer-Wins: keep the value with higher timestamp
      const oursTs = (ours.timestamp || 0) as number;
      const theirsTs = (theirs.timestamp || 0) as number;

      if (oursTs >= theirsTs) {
        return { type: 'lww-register', value: ours.value, timestamp: oursTs };
      }
      return { type: 'lww-register', value: theirs.value, timestamp: theirsTs };
    }

    case 'max-register': {
      // Max register: keep the larger value
      const oursVal = (ours.value || 0) as number;
      const theirsVal = (theirs.value || 0) as number;
      return { type: 'max-register', value: Math.max(oursVal, theirsVal) };
    }

    default: {
      // Unknown CRDT type -- attempt generic object merge (union of keys)
      const merged: Record<string, unknown> = { type: crdtType };
      const allKeys = new Set([...Object.keys(ours), ...Object.keys(theirs)]);
      for (const key of allKeys) {
        if (key === 'type') continue;
        if (key in ours && key in theirs) {
          // Both have the key -- take the one that differs from base
          const baseVal = base[key];
          if (JSON.stringify(ours[key]) !== JSON.stringify(baseVal)) {
            merged[key] = ours[key];
          } else {
            merged[key] = theirs[key];
          }
        } else if (key in ours) {
          merged[key] = ours[key];
        } else {
          merged[key] = theirs[key];
        }
      }
      return merged as CRDTValue;
    }
  }
}

export const latticeMergeHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'lattice',
      category: 'merge',
      contentTypes: ['application/crdt+json'],
    };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string;
    const ours = input.ours as string;
    const theirs = input.theirs as string;

    let parsedBase: CRDTValue;
    let parsedOurs: CRDTValue;
    let parsedTheirs: CRDTValue;

    try {
      parsedBase = JSON.parse(base) as CRDTValue;
    } catch {
      return { variant: 'unsupportedContent', message: 'Base content is not valid CRDT JSON' };
    }

    try {
      parsedOurs = JSON.parse(ours) as CRDTValue;
    } catch {
      return { variant: 'unsupportedContent', message: 'Ours content is not valid CRDT JSON' };
    }

    try {
      parsedTheirs = JSON.parse(theirs) as CRDTValue;
    } catch {
      return { variant: 'unsupportedContent', message: 'Theirs content is not valid CRDT JSON' };
    }

    if (!parsedOurs.type || !parsedTheirs.type) {
      return { variant: 'unsupportedContent', message: 'Content is not a recognized CRDT lattice type (missing type field)' };
    }

    const merged = latticeJoin(parsedBase, parsedOurs, parsedTheirs);
    if (merged === null) {
      return { variant: 'unsupportedContent', message: `Cannot merge incompatible CRDT types: '${parsedOurs.type}' and '${parsedTheirs.type}'` };
    }

    const result = JSON.stringify(merged);

    const id = nextId();
    await storage.put('lattice-merge', id, {
      id,
      result,
    });

    return { variant: 'clean', result };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetLatticeMergeCounter(): void {
  idCounter = 0;
}
