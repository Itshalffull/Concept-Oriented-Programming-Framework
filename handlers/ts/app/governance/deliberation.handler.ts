// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Deliberation Concept Handler
// Async threaded discussion with signals and summaries.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _deliberationHandler: FunctionalConceptHandler = {
  open(input: Record<string, unknown>) {
    const id = `thread-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'thread', id, {
      id, topic: input.topic, proposalRef: input.proposalRef ?? null,
      status: 'Open', entries: [], openedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { thread: id }) as StorageProgram<Result>;
  },

  addEntry(input: Record<string, unknown>) {
    const { thread, author, content, parentEntry } = input;
    let p = createProgram();
    p = get(p, 'thread', thread as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return branch(b,
          (bindings) => (bindings.record as Record<string, unknown>).status !== 'Open',
          (b2) => complete(b2, 'ok', { thread }),
          (b2) => {
            const entryId = `entry-${Date.now()}`;
            let b3 = mapBindings(b2, (bindings) => {
              const rec = bindings.record as Record<string, unknown>;
              const entries = [...(rec.entries as unknown[])];
              entries.push({ entryId, author, content, parentEntry: parentEntry ?? null, postedAt: new Date().toISOString() });
              return { ...rec, entries };
            }, 'updated');
            b3 = putFrom(b3, 'thread', thread as string, (bindings) => bindings.updated as Record<string, unknown>);
            return complete(b3, 'ok', { entry: entryId });
          },
        );
      },
      (b) => complete(b, 'not_found', { thread }),
    );

    return p as StorageProgram<Result>;
  },

  signal(input: Record<string, unknown>) {
    const { thread, participant, signal } = input;
    let p = createProgram();
    return complete(p, 'ok', { thread, participant, signal }) as StorageProgram<Result>;
  },

  close(input: Record<string, unknown>) {
    const { thread, summary } = input;
    let p = createProgram();
    p = get(p, 'thread', thread as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Closed', summary, closedAt: new Date().toISOString() };
        }, 'updated');
        b2 = putFrom(b2, 'thread', thread as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'ok', { thread });
      },
      (b) => complete(b, 'not_found', { thread }),
    );

    return p as StorageProgram<Result>;
  },
};

export const deliberationHandler = autoInterpret(_deliberationHandler);
