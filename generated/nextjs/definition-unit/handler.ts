import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DefinitionUnitStorage, DefinitionUnitExtractInput, DefinitionUnitExtractOutput, DefinitionUnitFindBySymbolInput, DefinitionUnitFindBySymbolOutput } from './types.js';
import { extractOk, findBySymbolNotfound } from './types.js';

export interface DefinitionUnitError { readonly code: string; readonly message: string; }
export interface DefinitionUnitHandler {
  readonly extract: (input: DefinitionUnitExtractInput, storage: DefinitionUnitStorage) => TE.TaskEither<DefinitionUnitError, DefinitionUnitExtractOutput>;
  readonly findBySymbol: (input: DefinitionUnitFindBySymbolInput, storage: DefinitionUnitStorage) => TE.TaskEither<DefinitionUnitError, DefinitionUnitFindBySymbolOutput>;
}

let _unitCounter = 0;
const err = (error: unknown): DefinitionUnitError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const definitionUnitHandler: DefinitionUnitHandler = {
  extract: (input, storage) => pipe(TE.tryCatch(async () => {
    _unitCounter++;
    const unit = `unit-${_unitCounter}`;
    await storage.put('units', unit, { unit, tree: input.tree, startByte: input.startByte, endByte: input.endByte });
    return extractOk(unit);
  }, err)),
  findBySymbol: (input, storage) => pipe(TE.tryCatch(async () => {
    return findBySymbolNotfound();
  }, err)),
};
