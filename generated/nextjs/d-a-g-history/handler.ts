import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DAGHistoryStorage, DAGHistoryAppendInput, DAGHistoryAppendOutput, DAGHistoryAncestorsInput, DAGHistoryAncestorsOutput, DAGHistoryGetNodeInput, DAGHistoryGetNodeOutput } from './types.js';
import { appendOk, ancestorsOk, getNodeOk } from './types.js';

export interface DAGHistoryError { readonly code: string; readonly message: string; }
export interface DAGHistoryHandler {
  readonly append: (input: DAGHistoryAppendInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryAppendOutput>;
  readonly ancestors: (input: DAGHistoryAncestorsInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryAncestorsOutput>;
  readonly getNode: (input: DAGHistoryGetNodeInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryGetNodeOutput>;
}

let _nodeCounter = 0;
const err = (error: unknown): DAGHistoryError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const dAGHistoryHandler: DAGHistoryHandler = {
  append: (input, storage) => pipe(TE.tryCatch(async () => {
    _nodeCounter++;
    const nodeId = `node-${_nodeCounter}`;
    await storage.put('dag_nodes', nodeId, {
      nodeId, parents: String(input.parents), contentRef: String(input.contentRef),
      metadata: String(input.metadata),
    });
    return appendOk(nodeId);
  }, err)),
  ancestors: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('dag_nodes', input.nodeId);
    const parents = record ? String(record.parents ?? '[]') : '[]';
    return ancestorsOk(parents as any);
  }, err)),
  getNode: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('dag_nodes', input.nodeId);
    if (!record) {
      return getNodeOk('[]' as any, '', '' as any);
    }
    return getNodeOk(
      String(record.parents) as any,
      String(record.contentRef),
      String(record.metadata) as any,
    );
  }, err)),
};
