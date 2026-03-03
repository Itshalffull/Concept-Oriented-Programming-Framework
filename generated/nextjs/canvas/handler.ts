import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { CanvasStorage, CanvasAddNodeInput, CanvasAddNodeOutput, CanvasMoveNodeInput, CanvasMoveNodeOutput, CanvasGroupNodesInput, CanvasGroupNodesOutput } from './types.js';
import { addNodeOk, moveNodeOk, groupNodesOk } from './types.js';

export interface CanvasError { readonly code: string; readonly message: string; }
export interface CanvasHandler {
  readonly addNode: (input: CanvasAddNodeInput, storage: CanvasStorage) => TE.TaskEither<CanvasError, CanvasAddNodeOutput>;
  readonly moveNode: (input: CanvasMoveNodeInput, storage: CanvasStorage) => TE.TaskEither<CanvasError, CanvasMoveNodeOutput>;
  readonly groupNodes: (input: CanvasGroupNodesInput, storage: CanvasStorage) => TE.TaskEither<CanvasError, CanvasGroupNodesOutput>;
}

const err = (error: unknown): CanvasError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const canvasHandler: CanvasHandler = {
  addNode: (input, storage) => pipe(TE.tryCatch(async () => {
    const key = `${input.canvas}:${input.node}`;
    await storage.put('canvas_nodes', key, { canvas: input.canvas, node: input.node, x: input.x, y: input.y });
    return addNodeOk();
  }, err)),
  moveNode: (input, storage) => pipe(TE.tryCatch(async () => {
    const key = `${input.canvas}:${input.node}`;
    await storage.put('canvas_nodes', key, { canvas: input.canvas, node: input.node, x: input.x, y: input.y });
    return moveNodeOk();
  }, err)),
  groupNodes: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.put('canvas_groups', `${input.canvas}:${input.group}`, { canvas: input.canvas, group: input.group, nodes: input.nodes });
    return groupNodesOk();
  }, err)),
};
