// @migrated dsl-constructs 2026-03-18
// PeerAllocation Reputation Provider
// Coordinape-style: peers allocate a budget to each other, normalized on finalize.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _peerAllocationHandler: FunctionalConceptHandler = {
  openRound(input: Record<string, unknown>) {
    const id = `peer-alloc-${Date.now()}`;
    const deadline = new Date(Date.now() + (input.deadlineDays as number) * 86400000).toISOString();
    let p = createProgram();
    p = put(p, 'peer_alloc', id, {
      id,
      budget: input.budget as number,
      deadline,
      status: 'Open',
    });
    p = put(p, 'plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'PeerAllocation',
      instanceId: id,
    });
    return complete(p, 'opened', { round: id }) as StorageProgram<Result>;
  },

  allocate(input: Record<string, unknown>) {
    const { round, allocator, recipient, amount, note } = input;
    let p = createProgram();
    p = get(p, 'peer_alloc', round as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'allocated', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Open') return { variant: 'round_closed', round };
          if (allocator === recipient) return { variant: 'self_allocation', allocator };
          return { variant: 'allocated', round, totalAllocated: 0, budget: record.budget };
        });
      },
      (b) => complete(b, 'not_found', { round }),
    );

    return p as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const { round } = input;
    let p = createProgram();
    p = get(p, 'peer_alloc', round as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = find(b, 'peer_alloc_entry', { round: round as string }, 'allEntries');
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const allEntries = bindings.allEntries as Array<Record<string, unknown>>;
          const totals: Record<string, number> = {};
          for (const entry of allEntries) {
            const r = entry.recipient as string;
            totals[r] = (totals[r] ?? 0) + (entry.amount as number);
          }
          const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
          const budget = record.budget as number;
          const normalized: Record<string, number> = {};
          for (const [recipient, total] of Object.entries(totals)) {
            normalized[recipient] = grandTotal > 0 ? (total / grandTotal) * budget : 0;
          }
          return JSON.stringify(normalized);
        }, 'results');

        let b2 = put(b, 'peer_alloc', round as string, {
          status: 'Finalized',
          finalizedAt: new Date().toISOString(),
        });

        return completeFrom(b2, 'finalized', (bindings) => {
          return { round, results: bindings.results as string };
        });
      },
      (b) => complete(b, 'not_found', { round }),
    );

    return p as StorageProgram<Result>;
  },
};

export const peerAllocationHandler = autoInterpret(_peerAllocationHandler);
