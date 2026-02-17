// ============================================================
// ActionLog Concept Implementation
//
// Append-only log of all action invocations and completions.
// The engine's memory, exposed as a concept so it can be
// queried and participate in synchronizations.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';
import { generateId } from '../../../kernel/src/types.js';

export const actionLogHandler: ConceptHandler = {
  async append(input, storage) {
    const record = input.record as Record<string, unknown>;
    const id = generateId();

    // Store in the "records" set relation
    await storage.put('records', id, { id, ...record });

    return { variant: 'ok', id };
  },

  async addEdge(input, storage) {
    const from = input.from as string;
    const to = input.to as string;
    const sync = input.sync as string;

    // Store the edge in the "edges" relation keyed by source record
    // Use a composite key since one record can have multiple edges
    const edgeId = `${from}:${to}`;
    await storage.put('edges', edgeId, { from, target: to, sync });

    return { variant: 'ok' };
  },

  async query(input, storage) {
    const flow = input.flow as string;

    // Find all records matching the given flow
    const records = await storage.find('records', { flow });

    return { variant: 'ok', records };
  },
};
