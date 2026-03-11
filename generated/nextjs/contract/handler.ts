import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ContractStorage, ContractDefineInput, ContractDefineOutput, ContractVerifyInput, ContractVerifyOutput } from './types.js';
import { defineOk, verifyOk } from './types.js';

export interface ContractError { readonly code: string; readonly message: string; }
export interface ContractHandler {
  readonly define: (input: ContractDefineInput, storage: ContractStorage) => TE.TaskEither<ContractError, ContractDefineOutput>;
  readonly verify: (input: ContractVerifyInput, storage: ContractStorage) => TE.TaskEither<ContractError, ContractVerifyOutput>;
}

let _contractCounter = 0;
const err = (error: unknown): ContractError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const contractHandler: ContractHandler = {
  define: (input, storage) => pipe(TE.tryCatch(async () => {
    _contractCounter++;
    const contract = `contract-${_contractCounter}`;
    await storage.put('contracts', contract, { contract, name: input.name, source_concept: input.source_concept, target_concept: input.target_concept });
    return defineOk(contract);
  }, err)),
  verify: (input, storage) => pipe(TE.tryCatch(async () => {
    return verifyOk(input.contract, true);
  }, err)),
};
