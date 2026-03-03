import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ChangeStreamStorage, ChangeStreamAppendInput, ChangeStreamAppendOutput, ChangeStreamReplayInput, ChangeStreamReplayOutput } from './types.js';
import { appendOk, replayOk } from './types.js';

export interface ChangeStreamError { readonly code: string; readonly message: string; }
export interface ChangeStreamHandler {
  readonly append: (input: ChangeStreamAppendInput, storage: ChangeStreamStorage) => TE.TaskEither<ChangeStreamError, ChangeStreamAppendOutput>;
  readonly replay: (input: ChangeStreamReplayInput, storage: ChangeStreamStorage) => TE.TaskEither<ChangeStreamError, ChangeStreamReplayOutput>;
}

let _offsetCounter = 0;
let _eventCounter = 0;
const err = (error: unknown): ChangeStreamError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const changeStreamHandler: ChangeStreamHandler = {
  append: (input, storage) => pipe(TE.tryCatch(async () => {
    _offsetCounter++;
    _eventCounter++;
    const offset = _offsetCounter;
    const eventId = `evt-${_eventCounter}`;
    await storage.put('events', String(offset), {
      offset, eventId, type: input.type,
      before: input.before, after: input.after,
      source: input.source, timestamp: new Date().toISOString(),
    });
    return appendOk(offset, eventId);
  }, err)),
  replay: (input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('events');
    const from = Number(input.from);
    const to = Number(input.to);
    const events = all
      .filter(r => Number(r.offset) >= from && Number(r.offset) <= to)
      .map(r => String(r.eventId));
    return replayOk(events);
  }, err)),
};
