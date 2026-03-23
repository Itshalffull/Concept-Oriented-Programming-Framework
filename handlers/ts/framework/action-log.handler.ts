// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ActionLog Concept Implementation
//
// Append-only log of all action invocations and completions.
// The engine's memory, exposed as a concept so it can be
// queried and participate in synchronizations.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { generateId } from '../../../runtime/types.js';

const _handler: FunctionalConceptHandler = {
  append(input) {
    const record = input.record as Record<string, unknown>;
    const id = generateId();

    let p = createProgram();
    // Store in the "records" set relation
    p = put(p, 'records', id, { id, ...record });
    p = complete(p, 'ok', { id });
    return p;
  },

  addEdge(input) {
    const from = input.from as string;
    const to = input.to as string;
    const sync = input.sync as string;

    // Store the edge in the "edges" relation keyed by source record
    // Use a composite key since one record can have multiple edges
    const edgeId = `${from}:${to}`;
    let p = createProgram();
    p = put(p, 'edges', edgeId, { from, target: to, sync });
    p = complete(p, 'ok', {});
    return p;
  },

  query(input) {
    if (!input.flow || (typeof input.flow === 'string' && (input.flow as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'flow is required' }) as StorageProgram<Result>;
    }
    const flow = input.flow as string;

    let p = createProgram();
    // Try to get a record by ID first
    p = get(p, 'records', flow, 'record');
    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => ({ records: [bindings.record] })),
      (elseP) => {
        // Fall back: find all records and filter by flow field (direct or structured)
        let p2 = find(elseP, 'records', {}, 'allRecords');
        return completeFrom(p2, '', (bindings) => {
          const all = bindings.allRecords as any[];
          const matched = all.filter((r: any) => {
            if (r.flow === flow) return true;
            if (Array.isArray(r.fields)) {
              const flowField = r.fields.find((f: any) => f.name === 'flow');
              if (flowField && flowField.value?.value === flow) return true;
            }
            return false;
          });
          if (matched.length === 0) return { variant: 'error', message: `no records for flow: ${flow}` };
          return { variant: 'ok', records: matched };
        });
      },
    ) as StorageProgram<any>;
  },
};

export const actionLogHandler = autoInterpret(_handler);
