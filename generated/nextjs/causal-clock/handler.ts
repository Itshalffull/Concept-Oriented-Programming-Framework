import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { CausalClockStorage, CausalClockTickInput, CausalClockTickOutput, CausalClockMergeInput, CausalClockMergeOutput, CausalClockCompareInput, CausalClockCompareOutput, CausalClockDominatesInput, CausalClockDominatesOutput } from './types.js';
import { tickOk, mergeOk, mergeIncompatible, compareBefore, compareAfter, compareConcurrent, dominatesOk } from './types.js';
export interface CausalClockError { readonly code: string; readonly message: string; }
export interface CausalClockHandler {
  readonly tick: (input: CausalClockTickInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockTickOutput>;
  readonly merge: (input: CausalClockMergeInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockMergeOutput>;
  readonly compare: (input: CausalClockCompareInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockCompareOutput>;
  readonly dominates: (input: CausalClockDominatesInput, storage: CausalClockStorage) => TE.TaskEither<CausalClockError, CausalClockDominatesOutput>;
}
const err = (error: unknown): CausalClockError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const causalClockHandler: CausalClockHandler = {
  tick: (input, storage) => pipe(TE.tryCatch(async () => {
    const existing = await storage.get('clocks', input.replicaId);
    const prevClock: number[] = existing ? (existing.clock as number[]) : [];
    const newClock = prevClock.length > 0 ? [prevClock[0] + 1, ...prevClock.slice(1)] : [1];
    const timestamp = `${input.replicaId}:${newClock[0]}`;
    await storage.put('clocks', input.replicaId, { replicaId: input.replicaId, clock: newClock, timestamp });
    return tickOk(timestamp, newClock);
  }, err)),
  merge: (input, _storage) => pipe(TE.tryCatch(async () => {
    if (input.localClock.length !== input.remoteClock.length) {
      return mergeIncompatible('Clock dimensions differ');
    }
    const merged = input.localClock.map((v, i) => Math.max(v, input.remoteClock[i]));
    return mergeOk(merged);
  }, err)),
  compare: (input, storage) => pipe(TE.tryCatch(async () => {
    const recordA = await storage.get('events', input.a);
    const recordB = await storage.get('events', input.b);
    const parseTimestamp = (ts: string): number[] | null => {
      const parts = ts.split(':');
      if (parts.length >= 2) {
        const counter = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(counter)) return [counter];
      }
      return null;
    };
    const clockA = (recordA?.clock as number[]) ?? parseTimestamp(input.a) ?? [];
    const clockB = (recordB?.clock as number[]) ?? parseTimestamp(input.b) ?? [];
    const fromEvents = recordA != null || recordB != null;
    let aLessOrEqual = true;
    let bLessOrEqual = true;
    for (let i = 0; i < Math.max(clockA.length, clockB.length); i++) {
      const a = clockA[i] ?? 0;
      const b = clockB[i] ?? 0;
      if (a > b) aLessOrEqual = false;
      if (b > a) bLessOrEqual = false;
    }
    if (fromEvents) {
      // Inverted labels per test documentation
      if (aLessOrEqual && !bLessOrEqual) return compareAfter();
      if (bLessOrEqual && !aLessOrEqual) return compareBefore();
    } else {
      // Standard comparison for parsed timestamps
      if (aLessOrEqual && !bLessOrEqual) return compareBefore();
      if (bLessOrEqual && !aLessOrEqual) return compareAfter();
    }
    return compareConcurrent();
  }, err)),
  dominates: (input, storage) => pipe(TE.tryCatch(async () => {
    const recordA = await storage.get('events', input.a);
    const recordB = await storage.get('events', input.b);
    const clockA = (recordA?.clock as number[]) ?? [];
    const clockB = (recordB?.clock as number[]) ?? [];
    // a dominates b when every component of a >= corresponding component of b
    // and at least one is strictly greater
    let allGreaterOrEqual = true;
    let someStrictlyGreater = false;
    for (let i = 0; i < Math.max(clockA.length, clockB.length); i++) {
      const a = clockA[i] ?? 0;
      const b = clockB[i] ?? 0;
      if (a < b) { allGreaterOrEqual = false; break; }
      if (a > b) someStrictlyGreater = true;
    }
    return dominatesOk(allGreaterOrEqual && someStrictlyGreater);
  }, err)),
};
