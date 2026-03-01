// ProcessEvent — Append-only event stream recording everything that happens in a process run.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  ProcessEventStorage,
  ProcessEventAppendInput,
  ProcessEventAppendOutput,
  ProcessEventQueryInput,
  ProcessEventQueryOutput,
  ProcessEventQueryByTypeInput,
  ProcessEventQueryByTypeOutput,
  ProcessEventGetCursorInput,
  ProcessEventGetCursorOutput,
} from './types.js';

import { appendOk, queryOk, queryByTypeOk, getCursorOk } from './types.js';

export interface ProcessEventError {
  readonly code: string;
  readonly message: string;
}

export interface ProcessEventHandler {
  readonly append: (input: ProcessEventAppendInput, storage: ProcessEventStorage) => TE.TaskEither<ProcessEventError, ProcessEventAppendOutput>;
  readonly query: (input: ProcessEventQueryInput, storage: ProcessEventStorage) => TE.TaskEither<ProcessEventError, ProcessEventQueryOutput>;
  readonly queryByType: (input: ProcessEventQueryByTypeInput, storage: ProcessEventStorage) => TE.TaskEither<ProcessEventError, ProcessEventQueryByTypeOutput>;
  readonly getCursor: (input: ProcessEventGetCursorInput, storage: ProcessEventStorage) => TE.TaskEither<ProcessEventError, ProcessEventGetCursorOutput>;
}

const storageError = (error: unknown): ProcessEventError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const cursorKey = (run_ref: string): string => `cursor::${run_ref}`;
const eventKey = (run_ref: string, seq: number): string => `${run_ref}::${seq}`;

export const processEventHandler: ProcessEventHandler = {
  append: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const cursorRecord = await storage.get('event_cursors', cursorKey(input.run_ref));
        const nextSeq = cursorRecord
          ? (typeof (cursorRecord as Record<string, unknown>).seq === 'number'
            ? ((cursorRecord as Record<string, unknown>).seq as number) + 1
            : 1)
          : 1;

        const eventId = eventKey(input.run_ref, nextSeq);
        const now = new Date().toISOString();

        await storage.put('process_events', eventId, {
          run_ref: input.run_ref,
          event_type: input.event_type,
          payload: input.payload,
          timestamp: now,
          sequence_num: nextSeq,
        });

        await storage.put('event_cursors', cursorKey(input.run_ref), { seq: nextSeq });

        return appendOk(eventId, nextSeq);
      }, storageError),
    ),

  query: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const all = await storage.find('process_events', { run_ref: input.run_ref });
        const filtered = all
          .filter((e) => (e.sequence_num as number) > input.after_seq)
          .sort((a, b) => (a.sequence_num as number) - (b.sequence_num as number))
          .slice(0, input.limit);
        return queryOk(JSON.stringify(filtered), filtered.length);
      }, storageError),
    ),

  queryByType: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const all = await storage.find('process_events', { run_ref: input.run_ref });
        const filtered = all
          .filter((e) => e.event_type === input.event_type)
          .sort((a, b) => (a.sequence_num as number) - (b.sequence_num as number))
          .slice(0, input.limit);
        return queryByTypeOk(JSON.stringify(filtered), filtered.length);
      }, storageError),
    ),

  getCursor: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const cursorRecord = await storage.get('event_cursors', cursorKey(input.run_ref));
        const seq = cursorRecord ? (cursorRecord.seq as number) ?? 0 : 0;
        return getCursorOk(seq);
      }, storageError),
    ),
};
