// ============================================================
// DAGHistory Handler
//
// Organize versions into a directed acyclic graph supporting
// branching, merging, and topological traversal. Nodes reference
// content by hash and track parent relationships for full history
// reconstruction.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `dag-history-${++idCounter}`;
}

export const dagHistoryHandler: ConceptHandler = {
  async append(input: Record<string, unknown>, storage: ConceptStorage) {
    const parents = input.parents as string[];
    const contentRef = input.contentRef as string;
    const metadata = input.metadata as string;

    const parentList = Array.isArray(parents) ? parents : [];

    // Verify all parents exist
    for (const parentId of parentList) {
      const parent = await storage.get('dag-history', parentId);
      if (!parent) {
        return { variant: 'unknownParent', message: `Parent node '${parentId}' not found in the DAG` };
      }
    }

    const nodeId = nextId();
    const now = new Date().toISOString();
    const isRoot = parentList.length === 0;

    await storage.put('dag-history', nodeId, {
      id: nodeId,
      nodeId,
      parents: parentList,
      contentRef,
      metadata,
      created: now,
      isRoot,
    });

    // Register children on parent nodes for descendant traversal
    for (const parentId of parentList) {
      const parent = await storage.get('dag-history', parentId);
      if (parent) {
        const children = Array.isArray(parent.children)
          ? [...(parent.children as string[]), nodeId]
          : [nodeId];
        await storage.put('dag-history', parentId, {
          ...parent,
          children,
        });
      }
    }

    return { variant: 'ok', nodeId };
  },

  async ancestors(input: Record<string, unknown>, storage: ConceptStorage) {
    const nodeId = input.nodeId as string;

    const node = await storage.get('dag-history', nodeId);
    if (!node) {
      return { variant: 'notFound', message: `Node '${nodeId}' not in DAG` };
    }

    // BFS collecting all ancestors, then topological sort
    const visited = new Set<string>();
    const ancestors: string[] = [];
    const queue: string[] = [];

    // Start from parents of the given node
    const parents = Array.isArray(node.parents) ? (node.parents as string[]) : [];
    for (const p of parents) {
      queue.push(p);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      ancestors.push(current);

      const currentNode = await storage.get('dag-history', current);
      if (currentNode && Array.isArray(currentNode.parents)) {
        for (const p of currentNode.parents as string[]) {
          if (!visited.has(p)) {
            queue.push(p);
          }
        }
      }
    }

    // Topological sort: ancestors from oldest to newest
    const sorted = await topologicalSort(ancestors, storage);

    return { variant: 'ok', nodes: sorted };
  },

  async commonAncestor(input: Record<string, unknown>, storage: ConceptStorage) {
    const a = input.a as string;
    const b = input.b as string;

    const nodeA = await storage.get('dag-history', a);
    if (!nodeA) {
      return { variant: 'notFound', message: `Node '${a}' not in DAG` };
    }

    const nodeB = await storage.get('dag-history', b);
    if (!nodeB) {
      return { variant: 'notFound', message: `Node '${b}' not in DAG` };
    }

    // Collect all ancestors of A (including A itself)
    const ancestorsA = new Set<string>();
    const queueA: string[] = [a];
    while (queueA.length > 0) {
      const current = queueA.shift()!;
      if (ancestorsA.has(current)) continue;
      ancestorsA.add(current);
      const node = await storage.get('dag-history', current);
      if (node && Array.isArray(node.parents)) {
        for (const p of node.parents as string[]) {
          queueA.push(p);
        }
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

      const node = await storage.get('dag-history', current);
      if (node && Array.isArray(node.parents)) {
        for (const p of node.parents as string[]) {
          if (!visitedB.has(p)) {
            queueB.push(p);
          }
        }
      }
    }

    // Check if a itself is an ancestor of b
    if (visitedB.has(a)) {
      return { variant: 'found', nodeId: a };
    }

    // Check if b is an ancestor of a
    if (ancestorsA.has(b)) {
      return { variant: 'found', nodeId: b };
    }

    return { variant: 'none', message: 'No common ancestor exists -- disjoint DAG histories' };
  },

  async descendants(input: Record<string, unknown>, storage: ConceptStorage) {
    const nodeId = input.nodeId as string;

    const node = await storage.get('dag-history', nodeId);
    if (!node) {
      return { variant: 'notFound', message: `Node '${nodeId}' not in DAG` };
    }

    // BFS through children
    const visited = new Set<string>();
    const descendants: string[] = [];
    const queue: string[] = [];

    const children = Array.isArray(node.children) ? (node.children as string[]) : [];
    for (const c of children) {
      queue.push(c);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      descendants.push(current);

      const currentNode = await storage.get('dag-history', current);
      if (currentNode && Array.isArray(currentNode.children)) {
        for (const c of currentNode.children as string[]) {
          if (!visited.has(c)) {
            queue.push(c);
          }
        }
      }
    }

    return { variant: 'ok', nodes: descendants };
  },

  async between(input: Record<string, unknown>, storage: ConceptStorage) {
    const from = input.from as string;
    const to = input.to as string;

    const fromNode = await storage.get('dag-history', from);
    if (!fromNode) {
      return { variant: 'notFound', message: `Node '${from}' not in DAG` };
    }

    const toNode = await storage.get('dag-history', to);
    if (!toNode) {
      return { variant: 'notFound', message: `Node '${to}' not in DAG` };
    }

    // BFS from 'to' backwards, looking for 'from'
    const visited = new Map<string, string | null>();
    const queue: string[] = [to];
    visited.set(to, null);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === from) {
        // Reconstruct path from 'from' to 'to'
        const path: string[] = [];
        let node: string | null = from;
        // Need to reverse-walk the visited map
        // Actually, rebuild: we walked from 'to' to 'from', so reverse
        const reversePath: string[] = [];
        let cursor: string | null = from;
        // Visited tracks child -> parent, but we walked backwards (to -> parents)
        // So visited tracks node -> the node that discovered it (child direction from 'to')
        // Let's rebuild by walking forward

        // Different approach: collect ancestors of 'to' until 'from', build path
        const ancestorMap = new Map<string, string[]>();
        const bfsQ: string[] = [to];
        const bfsVisited = new Set<string>();
        bfsVisited.add(to);

        while (bfsQ.length > 0) {
          const cur = bfsQ.shift()!;
          const curNode = await storage.get('dag-history', cur);
          if (curNode && Array.isArray(curNode.parents)) {
            for (const p of curNode.parents as string[]) {
              if (!ancestorMap.has(p)) {
                ancestorMap.set(p, []);
              }
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

      const currentNode = await storage.get('dag-history', current);
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
  },

  async getNode(input: Record<string, unknown>, storage: ConceptStorage) {
    const nodeId = input.nodeId as string;

    const record = await storage.get('dag-history', nodeId);
    if (!record) {
      return { variant: 'notFound', message: `Node '${nodeId}' not in DAG` };
    }

    return {
      variant: 'ok',
      parents: record.parents as string[],
      contentRef: record.contentRef as string,
      metadata: record.metadata as string,
    };
  },
};

/** Topological sort of node IDs based on parent relationships */
async function topologicalSort(nodeIds: string[], storage: ConceptStorage): Promise<string[]> {
  if (nodeIds.length <= 1) return nodeIds;

  const nodeSet = new Set(nodeIds);
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjList.set(id, []);
  }

  for (const id of nodeIds) {
    const node = await storage.get('dag-history', id);
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

/** Reset the ID counter. Useful for testing. */
export function resetDAGHistoryCounter(): void {
  idCounter = 0;
}
