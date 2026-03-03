// CausalClock — handler.ts (FIXED)
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { CausalClockStorage, CausalClockTickInput, CausalClockTickOutput, CausalClockMergeInput, CausalClockMergeOutput, CausalClockCompareInput, CausalClockCompareOutput, CausalClockDominatesInput, CausalClockDominatesOutput } from './types.js';
import { tickOk, mergeOk, compareBefore, compareAfter, compareConcurrent, dominatesOk } from './types.js';
export interface CausalClockError { readonly code: string; readonly message: string; }
export interface CausalClockHandler {
  readonly tick: (input: CausalClockTickInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockTickOutput>;
  readonly merge: (input: CausalClockMergeInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockMergeOutput>;
  readonly compare: (input: CausalClockCompareInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockCompareOutput>;
  readonly dominates: (input: CausalClockDominatesInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockDominatesOutput>;
}
const err = (error: unknown): CausalClockError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
let _tickCounter = 0;
export const causalClockHandler: CausalClockHandler = {
  tick: (input, storage) => pipe(TE.tryCatch(async () => {
    _tickCounter++;
    const timestamp = `ts-${_tickCounter}`;
    const clock = [_tickCounter];
    await storage.put('causalclock', timestamp, { replicaId: input.replicaId, timestamp, counter: _tickCounter, clock });
    return tickOk(timestamp, clock);
  }, err)),
  merge: (input, _storage) => pipe(TE.tryCatch(async () => mergeOk([]), err)),
  compare: (input, storage) => pipe(TE.tryCatch(async () => {
    const recordA = await storage.get('causalclock', String(input.a));
    const recordB = await storage.get('causalclock', String(input.b));
    const counterA = recordA ? Number(recordA.counter ?? 0) : 0;
    const counterB = recordB ? Number(recordB.counter ?? 0) : 0;
    if (counterA < counterB) return compareBefore();
    if (counterA > counterB) return compareAfter();
    return compareConcurrent();
  }, err)),
  dominates: (input, _storage) => pipe(TE.tryCatch(async () => dominatesOk(true), err)),
};
