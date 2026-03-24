// @clef-handler style=functional
// ============================================================
// Checkpoint Concept Implementation
//
// Capture and restore complete process state snapshots for
// recovery, time-travel debugging, and audit. Storage is
// delegated to providers.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, traverse, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const _checkpointHandler: FunctionalConceptHandler = {
  capture(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const runState = input.run_state as string;
    const variablesSnapshot = input.variables_snapshot as string;
    const tokenSnapshot = input.token_snapshot as string;
    const eventCursor = input.event_cursor as number;
    const label = (input.label as string | undefined) ?? null;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const checkpointId = randomUUID();
    const timestamp = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'checkpoints', checkpointId, {
      id: checkpointId,
      run_ref: runRef,
      timestamp,
      run_state: runState,
      variables_snapshot: variablesSnapshot,
      token_snapshot: tokenSnapshot,
      event_cursor: eventCursor,
      label,
    });

    return complete(p, 'ok', { checkpoint: checkpointId, timestamp }) as StorageProgram<Result>;
  },

  restore(input: Record<string, unknown>) {
    const checkpointId = input.checkpoint as string;

    let p = createProgram();
    p = get(p, 'checkpoints', checkpointId, 'existing');

    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          checkpoint: checkpointId,
          run_state: rec.run_state as string,
          variables_snapshot: rec.variables_snapshot as string,
          token_snapshot: rec.token_snapshot as string,
          event_cursor: rec.event_cursor as number,
        };
      }),
      (b) => complete(b, 'not_found', { checkpoint: checkpointId }),
    );

    return p as StorageProgram<Result>;
  },

  find_latest(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'checkpoints', { run_ref: runRef }, 'matches');

    p = mapBindings(p, (bindings) => {
      const matches = (bindings.matches || []) as Array<Record<string, unknown>>;
      if (matches.length === 0) return null;
      // Sort by timestamp descending and return the latest
      const sorted = [...matches].sort((a, b) => {
        const ta = a.timestamp as string;
        const tb = b.timestamp as string;
        return tb.localeCompare(ta);
      });
      return sorted[0];
    }, 'latest');

    p = branch(p, 'latest',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const latest = bindings.latest as Record<string, unknown>;
        return { checkpoint: latest.id as string };
      }),
      (b) => complete(b, 'ok', { run_ref: runRef }),
    );

    return p as StorageProgram<Result>;
  },

  prune(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const keepCount = input.keep_count as number;

    let p = createProgram();
    p = find(p, 'checkpoints', { run_ref: runRef }, 'matches');

    p = mapBindings(p, (bindings) => {
      const matches = (bindings.matches || []) as Array<Record<string, unknown>>;
      // Sort by timestamp descending — keep the most recent keepCount
      const sorted = [...matches].sort((a, b) => {
        const ta = a.timestamp as string;
        const tb = b.timestamp as string;
        return tb.localeCompare(ta);
      });
      return sorted.slice(keepCount);
    }, 'toPrune');

    p = traverse(p, 'toPrune', '_item', (item) => {
      const entry = item as Record<string, unknown>;
      let sub = createProgram();
      sub = del(sub, 'checkpoints', entry.id as string);
      return complete(sub, 'ok', {});
    }, '_pruneResults', {
      writes: ['checkpoints'],
      completionVariants: ['ok'],
    });

    return completeFrom(p, 'ok', (bindings) => {
      const toPrune = (bindings.toPrune || []) as unknown[];
      return { pruned: toPrune.length };
    }) as StorageProgram<Result>;
  },
};

export const checkpointHandler = autoInterpret(_checkpointHandler);
