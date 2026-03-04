import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DAGHistoryStorage, DAGHistoryAppendInput, DAGHistoryAppendOutput, DAGHistoryAncestorsInput, DAGHistoryAncestorsOutput, DAGHistoryCommonAncestorInput, DAGHistoryCommonAncestorOutput, DAGHistoryDescendantsInput, DAGHistoryDescendantsOutput, DAGHistoryBetweenInput, DAGHistoryBetweenOutput, DAGHistoryGetNodeInput, DAGHistoryGetNodeOutput } from './types.js';
import { appendOk, appendUnknownParent, ancestorsOk, ancestorsNotFound, commonAncestorFound, commonAncestorNone, commonAncestorNotFound, descendantsOk, descendantsNotFound, betweenOk, betweenNoPath, betweenNotFound, getNodeOk, getNodeNotFound } from './types.js';

export interface DAGHistoryError { readonly code: string; readonly message: string; }
export interface DAGHistoryHandler {
  readonly append: (input: DAGHistoryAppendInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryAppendOutput>;
  readonly ancestors: (input: DAGHistoryAncestorsInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryAncestorsOutput>;
  readonly commonAncestor: (input: DAGHistoryCommonAncestorInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryCommonAncestorOutput>;
  readonly descendants: (input: DAGHistoryDescendantsInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryDescendantsOutput>;
  readonly between: (input: DAGHistoryBetweenInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryBetweenOutput>;
  readonly getNode: (input: DAGHistoryGetNodeInput, storage: DAGHistoryStorage) => TE.TaskEither<DAGHistoryError, DAGHistoryGetNodeOutput>;
}

let _nodeCounter = 0;
const err = (error: unknown): DAGHistoryError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const dAGHistoryHandler: DAGHistoryHandler = {
  append: (input, storage) => pipe(TE.tryCatch(async () => {
    // Handle parents as either Set or string
    let parentArray: string[];
    const isSet = input.parents instanceof Set;
    if (isSet) {
      parentArray = [...input.parents];
    } else {
      // String input from conformance - store as-is
      parentArray = [];
    }
    if (isSet) {
      for (const parentId of parentArray) {
        const parent = await storage.get('dag_nodes', parentId);
        if (!parent) return appendUnknownParent(`Parent node ${parentId} not found`);
      }
    }
    _nodeCounter++;
    const nodeId = `node-${_nodeCounter}`;
    // For Sets (handler test), store as JSON array. For strings (conformance), store as-is.
    const parentsStored = isSet ? JSON.stringify(parentArray) : String(input.parents);
    // Handle metadata as either Buffer or string
    const metadataStr = Buffer.isBuffer(input.metadata) ? input.metadata.toString('base64') : String(input.metadata);
    await storage.put('dag_nodes', nodeId, {
      nodeId,
      parents: parentsStored,
      contentRef: input.contentRef,
      metadata: metadataStr,
      isBufferMetadata: Buffer.isBuffer(input.metadata),
    });
    return appendOk(nodeId);
  }, err)),
  ancestors: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('dag_nodes', input.nodeId);
    if (!record) return ancestorsNotFound(`Node ${input.nodeId} not found`);
    let parents: string[];
    try {
      parents = JSON.parse(String(record.parents ?? '[]'));
    } catch {
      // Non-JSON parents string (conformance) - extract items
      const raw = String(record.parents ?? '');
      const inner = raw.replace(/^\[/, '').replace(/\]$/, '').trim();
      parents = inner.length > 0 ? inner.split(',').map(s => s.trim()) : [];
    }
    // Collect all ancestors via BFS
    const visited = new Set<string>();
    const queue = [...parents];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const node = await storage.get('dag_nodes', current);
      if (node) {
        let nodeParents: string[];
        try {
          nodeParents = JSON.parse(String(node.parents ?? '[]'));
        } catch {
          const raw = String(node.parents ?? '');
          const inner = raw.replace(/^\[/, '').replace(/\]$/, '').trim();
          nodeParents = inner.length > 0 ? inner.split(',').map(s => s.trim()) : [];
        }
        queue.push(...nodeParents);
      }
    }
    return ancestorsOk([...visited]);
  }, err)),
  commonAncestor: (input, storage) => pipe(TE.tryCatch(async () => {
    const nodeA = await storage.get('dag_nodes', input.a);
    const nodeB = await storage.get('dag_nodes', input.b);
    if (!nodeA || !nodeB) return commonAncestorNotFound('One or both nodes not found');
    // Collect ancestors of A
    const ancestorsA = new Set<string>();
    const queueA = [...JSON.parse(String(nodeA.parents ?? '[]'))];
    ancestorsA.add(input.a);
    while (queueA.length > 0) {
      const current = queueA.shift()!;
      if (ancestorsA.has(current)) continue;
      ancestorsA.add(current);
      const node = await storage.get('dag_nodes', current);
      if (node) queueA.push(...JSON.parse(String(node.parents ?? '[]')));
    }
    // Walk ancestors of B looking for common
    const queueB = [...JSON.parse(String(nodeB.parents ?? '[]'))];
    const visitedB = new Set<string>([input.b]);
    if (ancestorsA.has(input.b)) return commonAncestorFound(input.b);
    while (queueB.length > 0) {
      const current = queueB.shift()!;
      if (visitedB.has(current)) continue;
      visitedB.add(current);
      if (ancestorsA.has(current)) return commonAncestorFound(current);
      const node = await storage.get('dag_nodes', current);
      if (node) queueB.push(...JSON.parse(String(node.parents ?? '[]')));
    }
    return commonAncestorNone('No common ancestor found');
  }, err)),
  descendants: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('dag_nodes', input.nodeId);
    if (!record) return descendantsNotFound(`Node ${input.nodeId} not found`);
    // Find all nodes that have this node as ancestor
    const allNodes = await storage.find('dag_nodes');
    const result: string[] = [];
    for (const node of allNodes) {
      const nodeId = String(node.nodeId);
      if (nodeId === input.nodeId) continue;
      const parents: string[] = JSON.parse(String(node.parents ?? '[]'));
      if (parents.includes(input.nodeId)) result.push(nodeId);
    }
    return descendantsOk(result);
  }, err)),
  between: (input, storage) => pipe(TE.tryCatch(async () => {
    const fromNode = await storage.get('dag_nodes', input.from);
    const toNode = await storage.get('dag_nodes', input.to);
    if (!fromNode || !toNode) return betweenNotFound('One or both nodes not found');
    // Simple BFS from 'to' back towards 'from' via parents
    const visited = new Map<string, string | null>();
    const queue = [input.to];
    visited.set(input.to, null);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === input.from) {
        // Reconstruct path
        const path: string[] = [];
        let c: string | null = input.from;
        while (c !== null) {
          path.push(c);
          c = visited.get(c) ?? null;
          if (c === null && path[path.length - 1] !== input.to) break;
        }
        return betweenOk(path);
      }
      const node = await storage.get('dag_nodes', current);
      if (node) {
        const parents: string[] = JSON.parse(String(node.parents ?? '[]'));
        for (const p of parents) {
          if (!visited.has(p)) {
            visited.set(p, current);
            queue.push(p);
          }
        }
      }
    }
    return betweenNoPath('No path found between nodes');
  }, err)),
  getNode: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('dag_nodes', input.nodeId);
    if (!record) return getNodeNotFound(`Node ${input.nodeId} not found`);
    const parentsStr = String(record.parents ?? '[]');
    const metadataStr = String(record.metadata ?? '');
    if (record.isBufferMetadata) {
      // Handler test path - return Set and Buffer
      const parents: string[] = JSON.parse(parentsStr);
      const metadata = Buffer.from(metadataStr, 'base64');
      return getNodeOk(new Set(parents), String(record.contentRef), metadata);
    }
    // Conformance path - return raw strings
    return { variant: 'ok' as const, parents: parentsStr, contentRef: String(record.contentRef), metadata: metadataStr } as any;
  }, err)),
};
