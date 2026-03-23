// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DAGHistory Handler
//
// Organize versions into a directed acyclic graph supporting
// branching, merging, and topological traversal. Nodes reference
// content by hash and track parent relationships for full history
// reconstruction.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `dag-history-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

/** Topological sort of nodes based on parent relationships (pure computation) */
function topologicalSortPure(
  nodeIds: string[],
  allNodes: Map<string, Record<string, unknown>>,
): string[] {
  if (nodeIds.length <= 1) return nodeIds;

  const nodeSet = new Set(nodeIds);
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjList.set(id, []);
  }

  for (const id of nodeIds) {
    const node = allNodes.get(id);
    if (node && Array.isArray(node.parents)) {
      for (const parent of node.parents as string[]) {
        if (nodeSet.has(parent)) {
          adjList.get(parent)!.push(id);
          inDegree.set(id, (inDegree.get(id) || 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adjList.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return result;
}

/** Build a lookup map from an array of DAG node records */
function buildNodeMap(records: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const rec of records) {
    const id = (rec.id ?? rec.nodeId) as string;
    if (id) map.set(id, rec);
  }
  return map;
}

const _dagHistoryHandler: FunctionalConceptHandler = {
  append(input: Record<string, unknown>) {
    if (!input.parents || (typeof input.parents === 'string' && (input.parents as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'parents is required' }) as StorageProgram<Result>;
    }
    if (!input.contentRef || (typeof input.contentRef === 'string' && (input.contentRef as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'contentRef is required' }) as StorageProgram<Result>;
    }
    if (!input.metadata || (typeof input.metadata === 'string' && (input.metadata as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'metadata is required' }) as StorageProgram<Result>;
    }
    const parents = input.parents as string[];
    const contentRef = input.contentRef as string;
    const metadata = input.metadata as string;
    const parentList = Array.isArray(parents) ? parents : [];

    // Load all existing nodes to verify parents and update children
    let p = createProgram();
    p = find(p, 'dag-history', {}, 'allNodes');
    p = mapBindings(p, (bindings) => {
      const nodes = bindings.allNodes as Record<string, unknown>[];
      return buildNodeMap(nodes);
    }, 'nodeMap');

    // Check all parents exist
    p = mapBindings(p, (bindings) => {
      const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;
      for (const parentId of parentList) {
        if (!nodeMap.has(parentId)) {
          return parentId;
        }
      }
      return null;
    }, 'missingParent');

    p = branch(p, 'missingParent',
      (b) => completeFrom(b, 'unknownParent', (bindings) => ({
        message: `Parent node '${bindings.missingParent as string}' not found in the DAG`,
      })),
      (b) => {
        const nodeId = nextId();
        const now = new Date().toISOString();
        const isRoot = parentList.length === 0;

        let b2 = put(b, 'dag-history', nodeId, {
          id: nodeId,
          nodeId,
          parents: parentList,
          contentRef,
          metadata,
          created: now,
          isRoot,
        });

        // Update parent nodes with new child reference — done via putFrom
        // for each parent to merge children arrays
        for (const parentId of parentList) {
          b2 = mapBindings(b2, (bindings) => {
            const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;
            const parent = nodeMap.get(parentId);
            if (parent) {
              const children = Array.isArray(parent.children)
                ? [...(parent.children as string[]), nodeId]
                : [nodeId];
              return { ...parent, children };
            }
            return parent;
          }, `updatedParent_${parentId}`);
        }

        // Write updated parent records
        for (const parentId of parentList) {
          b2 = putFrom(b2, 'dag-history', parentId, (bindings) => {
            const updated = bindings[`updatedParent_${parentId}`] as Record<string, unknown>;
            return updated || {};
          });
        }

        return complete(b2, 'ok', { nodeId });
      },
    );

    return p as StorageProgram<Result>;
  },

  ancestors(input: Record<string, unknown>) {
    const nodeId = input.nodeId as string;

    let p = createProgram();
    p = find(p, 'dag-history', {}, 'allNodes');
    p = mapBindings(p, (bindings) => {
      const nodes = bindings.allNodes as Record<string, unknown>[];
      return buildNodeMap(nodes);
    }, 'nodeMap');

    p = mapBindings(p, (bindings) => {
      const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;
      return nodeMap.has(nodeId);
    }, 'nodeExists');

    p = branch(p, 'nodeExists',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;
          const node = nodeMap.get(nodeId)!;

          // BFS collecting all ancestors
          const visited = new Set<string>();
          const ancestors: string[] = [];
          const queue: string[] = [];

          const parents = Array.isArray(node.parents) ? (node.parents as string[]) : [];
          for (const p of parents) queue.push(p);

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            ancestors.push(current);

            const currentNode = nodeMap.get(current);
            if (currentNode && Array.isArray(currentNode.parents)) {
              for (const p of currentNode.parents as string[]) {
                if (!visited.has(p)) queue.push(p);
              }
            }
          }

          const sorted = topologicalSortPure(ancestors, nodeMap);
          return { nodes: sorted };
        });
      },
      (b) => complete(b, 'notFound', { message: `Node '${nodeId}' not in DAG` }),
    );

    return p as StorageProgram<Result>;
  },

  commonAncestor(input: Record<string, unknown>) {
    const a = input.a as string;
    const b = input.b as string;

    let p = createProgram();
    p = find(p, 'dag-history', {}, 'allNodes');
    p = mapBindings(p, (bindings) => {
      const nodes = bindings.allNodes as Record<string, unknown>[];
      return buildNodeMap(nodes);
    }, 'nodeMap');

    return completeFrom(p, 'ok', (bindings) => {
      const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;

      if (!nodeMap.has(a)) {
        return { variant: 'notFound', message: `Node '${a}' not in DAG` };
      }
      if (!nodeMap.has(b)) {
        return { variant: 'notFound', message: `Node '${b}' not in DAG` };
      }

      // Collect all ancestors of A (including A itself)
      const ancestorsA = new Set<string>();
      const queueA: string[] = [a];
      while (queueA.length > 0) {
        const current = queueA.shift()!;
        if (ancestorsA.has(current)) continue;
        ancestorsA.add(current);
        const node = nodeMap.get(current);
        if (node && Array.isArray(node.parents)) {
          for (const p of node.parents as string[]) queueA.push(p);
        }
      }

      // BFS from B, find first intersection with A's ancestors
      const visitedB = new Set<string>();
      const queueB: string[] = [b];
      while (queueB.length > 0) {
        const current = queueB.shift()!;
        if (visitedB.has(current)) continue;
        visitedB.add(current);

        if (ancestorsA.has(current) && current !== a && current !== b) {
          return { variant: 'found', nodeId: current };
        }

        const node = nodeMap.get(current);
        if (node && Array.isArray(node.parents)) {
          for (const p of node.parents as string[]) {
            if (!visitedB.has(p)) queueB.push(p);
          }
        }
      }

      if (visitedB.has(a)) return { variant: 'found', nodeId: a };
      if (ancestorsA.has(b)) return { variant: 'found', nodeId: b };

      return { variant: 'none', message: 'No common ancestor exists -- disjoint DAG histories' };
    }) as StorageProgram<Result>;
  },

  descendants(input: Record<string, unknown>) {
    const nodeId = input.nodeId as string;

    let p = createProgram();
    p = find(p, 'dag-history', {}, 'allNodes');
    p = mapBindings(p, (bindings) => {
      const nodes = bindings.allNodes as Record<string, unknown>[];
      return buildNodeMap(nodes);
    }, 'nodeMap');

    p = mapBindings(p, (bindings) => {
      const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;
      return nodeMap.has(nodeId);
    }, 'nodeExists');

    p = branch(p, 'nodeExists',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;
          const node = nodeMap.get(nodeId)!;

          const visited = new Set<string>();
          const descendants: string[] = [];
          const queue: string[] = [];

          const children = Array.isArray(node.children) ? (node.children as string[]) : [];
          for (const c of children) queue.push(c);

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            descendants.push(current);

            const currentNode = nodeMap.get(current);
            if (currentNode && Array.isArray(currentNode.children)) {
              for (const c of currentNode.children as string[]) {
                if (!visited.has(c)) queue.push(c);
              }
            }
          }

          return { nodes: descendants };
        });
      },
      (b) => complete(b, 'notFound', { message: `Node '${nodeId}' not in DAG` }),
    );

    return p as StorageProgram<Result>;
  },

  between(input: Record<string, unknown>) {
    const from = input.from as string;
    const to = input.to as string;

    let p = createProgram();
    p = find(p, 'dag-history', {}, 'allNodes');
    p = mapBindings(p, (bindings) => {
      const nodes = bindings.allNodes as Record<string, unknown>[];
      return buildNodeMap(nodes);
    }, 'nodeMap');

    return completeFrom(p, 'ok', (bindings) => {
      const nodeMap = bindings.nodeMap as Map<string, Record<string, unknown>>;

      if (!nodeMap.has(from)) {
        return { variant: 'notFound', message: `Node '${from}' not in DAG` };
      }
      if (!nodeMap.has(to)) {
        return { variant: 'notFound', message: `Node '${to}' not in DAG` };
      }

      // BFS from 'to' backwards, looking for 'from'
      const visited = new Map<string, string | null>();
      const queue: string[] = [to];
      visited.set(to, null);
      let foundFrom = false;

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (current === from) {
          foundFrom = true;
          // Build forward path using BFS ancestor map
          const ancestorMap = new Map<string, string[]>();
          const bfsQ: string[] = [to];
          const bfsVisited = new Set<string>();
          bfsVisited.add(to);

          while (bfsQ.length > 0) {
            const cur = bfsQ.shift()!;
            const curNode = nodeMap.get(cur);
            if (curNode && Array.isArray(curNode.parents)) {
              for (const p of curNode.parents as string[]) {
                if (!ancestorMap.has(p)) ancestorMap.set(p, []);
                ancestorMap.get(p)!.push(cur);
                if (!bfsVisited.has(p)) {
                  bfsVisited.add(p);
                  bfsQ.push(p);
                }
              }
            }
            if (cur === from) break;
          }

          // DFS from 'from' to 'to' using forward edges
          const dfsPath: string[] = [from];
          const dfsVisited = new Set<string>([from]);

          function dfs(current: string): boolean {
            if (current === to) return true;
            const nexts = ancestorMap.get(current) || [];
            for (const next of nexts) {
              if (!dfsVisited.has(next)) {
                dfsVisited.add(next);
                dfsPath.push(next);
                if (dfs(next)) return true;
                dfsPath.pop();
              }
            }
            return false;
          }

          if (dfs(from)) {
            return { variant: 'ok', path: dfsPath };
          }
          return { variant: 'ok', path: [from, to] };
        }

        const currentNode = nodeMap.get(current);
        if (currentNode && Array.isArray(currentNode.parents)) {
          for (const p of currentNode.parents as string[]) {
            if (!visited.has(p)) {
              visited.set(p, current);
              queue.push(p);
            }
          }
        }
      }

      return { variant: 'noPath', message: `No directed path between '${from}' and '${to}'` };
    }) as StorageProgram<Result>;
  },

  getNode(input: Record<string, unknown>) {
    const nodeId = input.nodeId as string;

    let p = createProgram();
    p = get(p, 'dag-history', nodeId, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return {
          parents: rec.parents as string[],
          contentRef: rec.contentRef as string,
          metadata: rec.metadata as string,
        };
      }),
      (b) => complete(b, 'notFound', { message: `Node '${nodeId}' not in DAG` }),
    );

    return p as StorageProgram<Result>;
  },
};

export const dagHistoryHandler = autoInterpret(_dagHistoryHandler);

/** Reset the ID counter. Useful for testing. */
export function resetDAGHistoryCounter(): void {
  idCounter = 0;
}
