// ============================================================
// Branch Handler
//
// Named parallel lines of development with lifecycle management.
// Branches are mutable pointers over immutable DAG history --
// advancing the head, protecting against direct writes, and
// tracking upstream relationships.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `branch-${++idCounter}`;
}

export const branchHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const fromNode = input.fromNode as string;

    // Check if branch name already exists
    const existing = await storage.find('branch', { name });
    if (existing.length > 0) {
      return { variant: 'exists', message: `Branch '${name}' already exists` };
    }

    // Check if fromNode exists in DAG history
    const nodeRecords = await storage.find('dag-history', { id: fromNode });
    if (nodeRecords.length === 0) {
      // Also try looking by nodeId
      const nodeByNodeId = await storage.find('dag-history', { nodeId: fromNode });
      if (nodeByNodeId.length === 0) {
        // If no dag-history store exists yet, allow creation anyway for standalone use
      }
    }

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('branch', id, {
      id,
      name,
      head: fromNode,
      protected: false,
      upstream: null,
      created: now,
      archived: false,
    });

    return { variant: 'ok', branch: id };
  },

  async advance(input: Record<string, unknown>, storage: ConceptStorage) {
    const branch = input.branch as string;
    const newNode = input.newNode as string;

    const record = await storage.get('branch', branch);
    if (!record) {
      return { variant: 'notFound', message: `Branch '${branch}' not found` };
    }

    if (record.protected === true) {
      return { variant: 'protected', message: `Branch '${record.name}' is protected. Direct advance rejected.` };
    }

    await storage.put('branch', branch, {
      ...record,
      head: newNode,
    });

    return { variant: 'ok' };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage) {
    const branch = input.branch as string;

    const record = await storage.get('branch', branch);
    if (!record) {
      return { variant: 'notFound', message: `Branch '${branch}' not found` };
    }

    if (record.protected === true) {
      return { variant: 'protected', message: `Protected branch '${record.name}' cannot be deleted` };
    }

    await storage.del('branch', branch);
    return { variant: 'ok' };
  },

  async protect(input: Record<string, unknown>, storage: ConceptStorage) {
    const branch = input.branch as string;

    const record = await storage.get('branch', branch);
    if (!record) {
      return { variant: 'notFound', message: `Branch '${branch}' not found` };
    }

    await storage.put('branch', branch, {
      ...record,
      protected: true,
    });

    return { variant: 'ok' };
  },

  async setUpstream(input: Record<string, unknown>, storage: ConceptStorage) {
    const branch = input.branch as string;
    const upstream = input.upstream as string;

    const branchRecord = await storage.get('branch', branch);
    if (!branchRecord) {
      return { variant: 'notFound', message: `Branch '${branch}' not found` };
    }

    const upstreamRecord = await storage.get('branch', upstream);
    if (!upstreamRecord) {
      return { variant: 'notFound', message: `Upstream branch '${upstream}' not found` };
    }

    await storage.put('branch', branch, {
      ...branchRecord,
      upstream,
    });

    return { variant: 'ok' };
  },

  async divergencePoint(input: Record<string, unknown>, storage: ConceptStorage) {
    const b1 = input.b1 as string;
    const b2 = input.b2 as string;

    const branch1 = await storage.get('branch', b1);
    if (!branch1) {
      return { variant: 'notFound', message: `Branch '${b1}' not found` };
    }

    const branch2 = await storage.get('branch', b2);
    if (!branch2) {
      return { variant: 'notFound', message: `Branch '${b2}' not found` };
    }

    // Walk both branches' ancestor chains to find divergence point.
    // Collect ancestors of b1 head via dag-history parent traversal.
    const head1 = branch1.head as string;
    const head2 = branch2.head as string;

    if (head1 === head2) {
      return { variant: 'noDivergence', message: 'Both branches point to the same node' };
    }

    // Collect ancestor sets for both heads
    const ancestors1 = new Set<string>();
    const queue1: string[] = [head1];
    while (queue1.length > 0) {
      const current = queue1.shift()!;
      if (ancestors1.has(current)) continue;
      ancestors1.add(current);
      const node = await storage.get('dag-history', current);
      if (node && Array.isArray(node.parents)) {
        for (const p of node.parents as string[]) {
          queue1.push(p);
        }
      }
    }

    // Walk b2's ancestors in BFS order, first hit in ancestors1 is the divergence point
    const visited = new Set<string>();
    const queue2: string[] = [head2];
    while (queue2.length > 0) {
      const current = queue2.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (ancestors1.has(current) && current !== head1 && current !== head2) {
        return { variant: 'ok', nodeId: current };
      }

      const node = await storage.get('dag-history', current);
      if (node && Array.isArray(node.parents)) {
        for (const p of node.parents as string[]) {
          queue2.push(p);
        }
      }
    }

    // Check if one is ancestor of the other
    if (ancestors1.has(head2)) {
      return { variant: 'noDivergence', message: `'${b2}' is an ancestor of '${b1}'` };
    }

    return { variant: 'noDivergence', message: 'No divergence point found. One may be a direct ancestor of the other.' };
  },

  async archive(input: Record<string, unknown>, storage: ConceptStorage) {
    const branch = input.branch as string;

    const record = await storage.get('branch', branch);
    if (!record) {
      return { variant: 'notFound', message: `Branch '${branch}' not found` };
    }

    await storage.put('branch', branch, {
      ...record,
      archived: true,
    });

    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetBranchCounter(): void {
  idCounter = 0;
}
