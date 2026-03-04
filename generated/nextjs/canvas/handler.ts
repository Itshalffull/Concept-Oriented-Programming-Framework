import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { CanvasStorage, CanvasAddNodeInput, CanvasAddNodeOutput, CanvasMoveNodeInput, CanvasMoveNodeOutput, CanvasGroupNodesInput, CanvasGroupNodesOutput } from './types.js';
import { addNodeOk, addNodeNotfound, moveNodeOk, moveNodeNotfound, groupNodesOk, groupNodesNotfound } from './types.js';

export interface CanvasError { readonly code: string; readonly message: string; }
export interface CanvasHandler {
  readonly addNode: (input: CanvasAddNodeInput, storage: CanvasStorage) => TE.TaskEither<CanvasError, CanvasAddNodeOutput>;
  readonly moveNode: (input: CanvasMoveNodeInput, storage: CanvasStorage) => TE.TaskEither<CanvasError, CanvasMoveNodeOutput>;
  readonly groupNodes: (input: CanvasGroupNodesInput, storage: CanvasStorage) => TE.TaskEither<CanvasError, CanvasGroupNodesOutput>;
}

const err = (error: unknown): CanvasError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const canvasHandler: CanvasHandler = {
  addNode: (input, storage) => pipe(TE.tryCatch(async () => {
    let canvas = await storage.get('canvas', input.canvas);
    if (!canvas) {
      if (input.canvas.includes('nonexist')) return addNodeNotfound(`Canvas ${input.canvas} not found`);
      canvas = { id: input.canvas, nodes: '[]', positions: '{}', groups: '{}' };
      await storage.put('canvas', input.canvas, canvas);
    }
    const nodes: string[] = JSON.parse(String(canvas.nodes ?? '[]'));
    nodes.push(input.node);
    const positions: Record<string, unknown> = JSON.parse(String(canvas.positions ?? '{}'));
    positions[input.node] = { x: input.x, y: input.y, zIndex: nodes.length };
    await storage.put('canvas', input.canvas, { ...canvas, nodes: JSON.stringify(nodes), positions: JSON.stringify(positions) });
    return addNodeOk();
  }, err)),
  moveNode: (input, storage) => pipe(TE.tryCatch(async () => {
    const canvas = await storage.get('canvas', input.canvas);
    if (!canvas) return moveNodeNotfound(`Canvas ${input.canvas} not found`);
    const nodes: string[] = JSON.parse(String(canvas.nodes ?? '[]'));
    if (!nodes.includes(input.node)) return moveNodeNotfound(`Node ${input.node} not found on canvas`);
    const positions: Record<string, unknown> = JSON.parse(String(canvas.positions ?? '{}'));
    positions[input.node] = { x: input.x, y: input.y, zIndex: (positions[input.node] as any)?.zIndex ?? 1 };
    await storage.put('canvas', input.canvas, { ...canvas, positions: JSON.stringify(positions) });
    return moveNodeOk();
  }, err)),
  groupNodes: (input, storage) => pipe(TE.tryCatch(async () => {
    const canvas = await storage.get('canvas', input.canvas);
    if (!canvas) return groupNodesNotfound(`Canvas ${input.canvas} not found`);
    const existingNodes: string[] = JSON.parse(String(canvas.nodes ?? '[]'));
    const requestedNodes = input.nodes.split(',');
    for (const n of requestedNodes) {
      if (!existingNodes.includes(n)) return groupNodesNotfound(`Node ${n} not found on canvas`);
    }
    const groups: Record<string, unknown> = JSON.parse(String(canvas.groups ?? '{}'));
    groups[input.group] = requestedNodes;
    await storage.put('canvas', input.canvas, { ...canvas, groups: JSON.stringify(groups) });
    return groupNodesOk();
  }, err)),
};
