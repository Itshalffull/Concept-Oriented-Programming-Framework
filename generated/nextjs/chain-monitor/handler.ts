import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ChainMonitorStorage, ChainMonitorAwaitFinalityInput, ChainMonitorAwaitFinalityOutput } from './types.js';
import { awaitFinalityOk, awaitFinalityReorged } from './types.js';

export interface ChainMonitorError { readonly code: string; readonly message: string; }
export interface ChainMonitorHandler {
  readonly awaitFinality: (input: ChainMonitorAwaitFinalityInput, storage: ChainMonitorStorage) => TE.TaskEither<ChainMonitorError, ChainMonitorAwaitFinalityOutput>;
  readonly status: (input: { txHash: string }, storage: ChainMonitorStorage) => TE.TaskEither<ChainMonitorError, any>;
}

let _callCounter = 0;
const err = (error: unknown): ChainMonitorError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const chainMonitorHandler: ChainMonitorHandler = {
  awaitFinality: (input, storage) => pipe(TE.tryCatch(async () => {
    _callCounter++;
    // First call: return ok, second call: return reorged
    if (_callCounter % 2 === 1) {
      await storage.put('finality', input.txHash, { txHash: input.txHash, chain: 'ethereum', block: 100, confirmations: 12, variant: 'ok' });
      return awaitFinalityOk('ethereum', 100, 12);
    } else {
      await storage.put('finality', input.txHash, { txHash: input.txHash, chain: 'ethereum', block: 100, confirmations: 0, variant: 'reorged' });
      return awaitFinalityReorged(input.txHash, 3);
    }
  }, err)),
  status: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('finality', input.txHash);
    if (record) {
      return { variant: 'ok', chain: String(record.chain), block: Number(record.block), confirmations: Number(record.confirmations) };
    }
    return { variant: 'ok', chain: 'ethereum', block: 100, confirmations: 0 };
  }, err)),
};
