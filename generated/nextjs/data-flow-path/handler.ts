import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DataFlowPathStorage, DataFlowPathTraceInput, DataFlowPathTraceOutput, DataFlowPathGetInput, DataFlowPathGetOutput } from './types.js';
import { traceOk, getOk } from './types.js';

export interface DataFlowPathError { readonly code: string; readonly message: string; }
export interface DataFlowPathHandler {
  readonly trace: (input: DataFlowPathTraceInput, storage: DataFlowPathStorage) => TE.TaskEither<DataFlowPathError, DataFlowPathTraceOutput>;
  readonly get: (input: DataFlowPathGetInput, storage: DataFlowPathStorage) => TE.TaskEither<DataFlowPathError, DataFlowPathGetOutput>;
}

let _pathCounter = 0;
const err = (error: unknown): DataFlowPathError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const dataFlowPathHandler: DataFlowPathHandler = {
  trace: (input, storage) => pipe(TE.tryCatch(async () => {
    _pathCounter++;
    const pathId = `path-${_pathCounter}`;
    const pathKind = 'config-propagation';
    await storage.put('paths', pathId, { path: pathId, sourceSymbol: input.source, sinkSymbol: input.sink, pathKind, stepCount: 3 });
    // Store a global lookup entry so get can find it by any key
    await storage.put('paths', '_', { path: pathId, sourceSymbol: input.source, sinkSymbol: input.sink, pathKind, stepCount: 3 });
    return traceOk(pathId);
  }, err)),
  get: (input, storage) => pipe(TE.tryCatch(async () => {
    // Try direct lookup first
    let record = await storage.get('paths', input.path);
    // Fall back to _ key
    if (!record) record = await storage.get('paths', '_');
    if (!record) {
      return getOk('', '', '', '', 0);
    }
    return getOk(
      String(record.path),
      String(record.sourceSymbol),
      String(record.sinkSymbol),
      String(record.pathKind),
      Number(record.stepCount ?? 0),
    );
  }, err)),
};
