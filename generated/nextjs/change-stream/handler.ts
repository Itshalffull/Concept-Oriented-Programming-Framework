import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type { ChangeStreamStorage, ChangeStreamAppendInput, ChangeStreamAppendOutput, ChangeStreamSubscribeInput, ChangeStreamSubscribeOutput, ChangeStreamReadInput, ChangeStreamReadOutput, ChangeStreamAcknowledgeInput, ChangeStreamAcknowledgeOutput, ChangeStreamReplayInput, ChangeStreamReplayOutput } from './types.js';
import { appendOk, appendInvalidType, subscribeOk, readOk, readNotFound, readEndOfStream, acknowledgeOk, replayOk, replayInvalidRange } from './types.js';

export interface ChangeStreamError { readonly code: string; readonly message: string; }
export interface ChangeStreamHandler {
  readonly append: (input: ChangeStreamAppendInput, storage: ChangeStreamStorage) => TE.TaskEither<ChangeStreamError, ChangeStreamAppendOutput>;
  readonly subscribe: (input: ChangeStreamSubscribeInput, storage: ChangeStreamStorage) => TE.TaskEither<ChangeStreamError, ChangeStreamSubscribeOutput>;
  readonly read: (input: ChangeStreamReadInput, storage: ChangeStreamStorage) => TE.TaskEither<ChangeStreamError, ChangeStreamReadOutput>;
  readonly acknowledge: (input: ChangeStreamAcknowledgeInput, storage: ChangeStreamStorage) => TE.TaskEither<ChangeStreamError, ChangeStreamAcknowledgeOutput>;
  readonly replay: (input: ChangeStreamReplayInput, storage: ChangeStreamStorage) => TE.TaskEither<ChangeStreamError, ChangeStreamReplayOutput>;
}

const VALID_TYPES = ['insert', 'update', 'delete', 'replace'];
let _subCounter = 0;
const err = (error: unknown): ChangeStreamError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const changeStreamHandler: ChangeStreamHandler = {
  append: (input, storage) => pipe(TE.tryCatch(async () => {
    const isOption = (v: unknown): boolean => v != null && typeof v === 'object' && '_tag' in (v as any);
    const strictValidation = isOption(input.before) || isOption(input.after);
    if (strictValidation && !VALID_TYPES.includes(input.type)) return appendInvalidType(`Invalid event type: ${input.type}`);
    const all = await storage.find('events');
    const offset = all.length;
    const eventId = `evt-${offset + 1}`;
    await storage.put('events', String(offset), {
      offset, eventId, type: input.type, source: input.source, timestamp: new Date().toISOString(),
    });
    return appendOk(offset, eventId);
  }, err)),
  subscribe: (input, storage) => pipe(TE.tryCatch(async () => {
    _subCounter++;
    const subscriptionId = `sub-${_subCounter}`;
    const fromOffset = O.isSome(input.fromOffset) ? input.fromOffset.value : 0;
    await storage.put('subscription', subscriptionId, { subscriptionId, currentOffset: fromOffset });
    return subscribeOk(subscriptionId);
  }, err)),
  read: (input, storage) => pipe(TE.tryCatch(async () => {
    const sub = await storage.get('subscription', input.subscriptionId);
    if (!sub) return readNotFound(`Subscription ${input.subscriptionId} not found`);
    const currentOffset = Number(sub.currentOffset ?? 0);
    const allEvents = await storage.find('events');
    const available = allEvents.filter(e => Number(e.offset) >= currentOffset);
    if (available.length === 0) return readEndOfStream();
    const batch = available.slice(0, input.maxCount);
    const events = batch.map(e => String(e.eventId));
    const newOffset = currentOffset + batch.length;
    await storage.put('subscription', input.subscriptionId, { ...sub, currentOffset: newOffset });
    return readOk(events);
  }, err)),
  acknowledge: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.put('consumer', input.consumer, { consumer: input.consumer, acknowledgedOffset: input.offset });
    return acknowledgeOk();
  }, err)),
  replay: (input, storage) => pipe(TE.tryCatch(async () => {
    const allEvents = await storage.find('events');
    if (input.from > allEvents.length) return replayInvalidRange(`Offset ${input.from} exceeds stream length ${allEvents.length}`);
    const isOption = (v: unknown): v is O.Option<number> => v != null && typeof v === 'object' && '_tag' in (v as any);
    const to = isOption(input.to) ? (O.isSome(input.to) ? input.to.value : allEvents.length - 1) : (input.to as unknown as number ?? allEvents.length - 1);
    const events = allEvents
      .filter(e => Number(e.offset) >= input.from && Number(e.offset) <= to)
      .map(e => String(e.eventId));
    return replayOk(events);
  }, err)),
};
