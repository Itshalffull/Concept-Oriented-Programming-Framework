// @clef-handler style=functional
// Deliberation Concept Implementation
// Structures asynchronous collective discussion with threaded conversation,
// argument mapping, and consensus signals.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `thread-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Deliberation' }) as StorageProgram<Result>;
  },

  open(input: Record<string, unknown>) {
    const proposalRef = input.proposalRef as string;

    if (!proposalRef || proposalRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'proposalRef is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'thread', id, {
      id,
      proposalRef,
      status: 'Open',
      entries: [],
      signals: [],
    });
    return complete(p, 'ok', { thread: id }) as StorageProgram<Result>;
  },

  addEntry(input: Record<string, unknown>) {
    const threadId = input.thread as string;
    const author = input.author as string;
    const content = input.content as string;
    const entryType = input.entryType as string;
    const parentEntry = input.parentEntry as string | null | undefined;

    if (!threadId) {
      return complete(createProgram(), 'error', { message: 'thread is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'thread', threadId, 'threadRecord');

    return branch(
      p,
      (b) => !b.threadRecord,
      complete(createProgram(), 'error', { message: 'Thread not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.threadRecord as Record<string, unknown>;
          return rec.status === 'Closed';
        }, '_isClosed');

        return branch(
          b2,
          (b) => !!b._isClosed,
          complete(createProgram(), 'ok', { thread: threadId }),
          (() => {
            let b3 = createProgram();
            b3 = putFrom(b3, 'thread', threadId, (b) => {
              const rec = b.threadRecord as Record<string, unknown>;
              const entries = [...(rec.entries as unknown[])];
              entries.push({
                author,
                content,
                timestamp: new Date().toISOString(),
                parentEntry: parentEntry ?? null,
                entryType,
              });
              return { ...rec, entries };
            });
            b3 = mapBindings(b3, (b) => {
              const rec = b.threadRecord as Record<string, unknown>;
              return (rec.entries as unknown[]).length;
            }, '_entryIndex');
            return completeFrom(b3, 'ok', (b) => ({
              thread: threadId,
              entryIndex: b._entryIndex,
            })) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  signal(input: Record<string, unknown>) {
    const threadId = input.thread as string;
    const signaller = input.signaller as string;
    const signal = input.signal as string;

    if (!threadId) {
      return complete(createProgram(), 'error', { message: 'thread is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'thread', threadId, 'threadRecord');

    return branch(
      p,
      (b) => !b.threadRecord,
      complete(createProgram(), 'error', { message: 'Thread not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'thread', threadId, (b) => {
          const rec = b.threadRecord as Record<string, unknown>;
          const signals = [...(rec.signals as unknown[])];
          signals.push({ signaller, signal, timestamp: new Date().toISOString() });
          return { ...rec, signals };
        });
        return complete(b2, 'ok', { thread: threadId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  close(input: Record<string, unknown>) {
    const threadId = input.thread as string;

    if (!threadId) {
      return complete(createProgram(), 'error', { message: 'thread is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'thread', threadId, 'threadRecord');

    return branch(
      p,
      (b) => !b.threadRecord,
      complete(createProgram(), 'error', { message: 'Thread not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'thread', threadId, (b) => {
          const rec = b.threadRecord as Record<string, unknown>;
          return { ...rec, status: 'Closed' };
        });
        return complete(b2, 'ok', { thread: threadId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const deliberationHandler = autoInterpret(_handler);
