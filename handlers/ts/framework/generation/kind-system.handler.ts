// ============================================================
// KindSystem Concept Implementation
//
// Defines the taxonomy of intermediate representations and
// artifacts in generation pipelines. Tracks which IR kinds
// can transform into which others. Enables pipeline validation,
// execution ordering, and cascading invalidation.
// See clef-generation-suite.md Part 1.2
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';

const KINDS_RELATION = 'kinds';
const EDGES_RELATION = 'edges';

/** Edge key convention: "from:to" */
function edgeKey(from: string, to: string): string {
  return `${from}:${to}`;
}

/**
 * Check if adding an edge from→to would create a cycle.
 * Uses DFS from 'to' to see if we can reach 'from'.
 */
async function wouldCreateCycle(
  storage: ConceptStorage,
  from: string,
  to: string,
): Promise<boolean> {
  if (from === to) return true;

  const visited = new Set<string>();
  const stack = [to];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === from) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all edges where this kind is the source
    const edges = await storage.find(EDGES_RELATION, { fromName: current });
    for (const edge of edges) {
      stack.push(edge.toName as string);
    }
  }

  return false;
}

/**
 * BFS to find shortest path between two kinds.
 */
async function findShortestPath(
  storage: ConceptStorage,
  from: string,
  to: string,
): Promise<Array<{ kind: string; relation: string; transform: string | null }> | null> {
  if (from === to) return [];

  const visited = new Set<string>();
  const queue: Array<{
    kind: string;
    path: Array<{ kind: string; relation: string; transform: string | null }>;
  }> = [{ kind: from, path: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.kind)) continue;
    visited.add(current.kind);

    const edges = await storage.find(EDGES_RELATION, { fromName: current.kind });

    for (const edge of edges) {
      const toName = edge.toName as string;
      const newPath = [
        ...current.path,
        {
          kind: toName,
          relation: edge.relation as string,
          transform: (edge.transformName as string) || null,
        },
      ];

      if (toName === to) {
        return newPath;
      }

      if (!visited.has(toName)) {
        queue.push({ kind: toName, path: newPath });
      }
    }
  }

  return null;
}

/**
 * DFS to collect all transitively reachable kinds.
 */
async function findAllDependents(
  storage: ConceptStorage,
  startKind: string,
): Promise<string[]> {
  const visited = new Set<string>();
  const stack = [startKind];
  const result: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const edges = await storage.find(EDGES_RELATION, { fromName: current });
    for (const edge of edges) {
      const toName = edge.toName as string;
      if (!visited.has(toName)) {
        result.push(toName);
        stack.push(toName);
      }
    }
  }

  return result;
}

export const kindSystemHandler: ConceptHandler = {
  /**
   * Register a new kind in the taxonomy. Idempotent — returns
   * 'exists' if the kind is already defined.
   */
  async define(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const name = input.name as string;
    const category = input.category as string;

    const existing = await storage.get(KINDS_RELATION, name);

    if (existing) {
      return { variant: 'exists', kind: existing.id as string };
    }

    const kindId = randomUUID();
    await storage.put(KINDS_RELATION, name, {
      id: kindId,
      name,
      category,
    });

    return { variant: 'ok', kind: kindId };
  },

  /**
   * Declare a transform edge between two kinds.
   * Validates both kinds exist and the edge wouldn't create a cycle.
   */
  async connect(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const from = input.from as string;
    const to = input.to as string;
    const relation = input.relation as string;
    const transformName = input.transformName as string | undefined;

    // Resolve kind names — accept both kind IDs and kind names
    const fromKind = await storage.get(KINDS_RELATION, from);
    const toKind = await storage.get(KINDS_RELATION, to);

    // Try to find by ID if not found by name
    let fromName = from;
    let toName = to;

    if (!fromKind) {
      // Try finding by ID
      const allKinds = await storage.find(KINDS_RELATION, { id: from });
      if (allKinds.length === 0) {
        return { variant: 'invalid', message: `Kind '${from}' does not exist` };
      }
      fromName = allKinds[0].name as string;
    } else {
      fromName = fromKind.name as string;
    }

    if (!toKind) {
      const allKinds = await storage.find(KINDS_RELATION, { id: to });
      if (allKinds.length === 0) {
        return { variant: 'invalid', message: `Kind '${to}' does not exist` };
      }
      toName = allKinds[0].name as string;
    } else {
      toName = toKind.name as string;
    }

    // Check for cycles
    if (await wouldCreateCycle(storage, fromName, toName)) {
      return {
        variant: 'invalid',
        message: `Edge ${fromName} → ${toName} would create a cycle`,
      };
    }

    // Store edge
    const key = edgeKey(fromName, toName);
    await storage.put(EDGES_RELATION, key, {
      fromName,
      toName,
      relation,
      transformName: transformName || null,
    });

    return { variant: 'ok' };
  },

  /**
   * Compute shortest valid transform chain between two kinds.
   */
  async route(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const from = input.from as string;
    const to = input.to as string;

    // Resolve names
    const fromKind = await storage.get(KINDS_RELATION, from);
    const toKind = await storage.get(KINDS_RELATION, to);

    const fromName = fromKind ? (fromKind.name as string) : from;
    const toName = toKind ? (toKind.name as string) : to;

    const path = await findShortestPath(storage, fromName, toName);

    if (!path) {
      return {
        variant: 'unreachable',
        message: `No valid path from ${fromName} to ${toName}`,
      };
    }

    return { variant: 'ok', path };
  },

  /**
   * Confirm that a direct edge exists between two kinds.
   */
  async validate(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const from = input.from as string;
    const to = input.to as string;

    const fromKind = await storage.get(KINDS_RELATION, from);
    const toKind = await storage.get(KINDS_RELATION, to);

    const fromName = fromKind ? (fromKind.name as string) : from;
    const toName = toKind ? (toKind.name as string) : to;

    const key = edgeKey(fromName, toName);
    const edge = await storage.get(EDGES_RELATION, key);

    if (edge) {
      return { variant: 'ok' };
    }

    // Find nearest valid targets for suggestions
    const edges = await storage.find(EDGES_RELATION, { fromName });
    const suggestions = edges.map(e => e.toName as string);

    return {
      variant: 'invalid',
      message: `No direct edge from ${fromName} to ${toName}. Reachable from ${fromName}: ${suggestions.join(', ') || 'none'}`,
    };
  },

  /**
   * Return all kinds transitively reachable from this kind.
   */
  async dependents(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const kind = input.kind as string;
    const kindRecord = await storage.get(KINDS_RELATION, kind);
    const kindName = kindRecord ? (kindRecord.name as string) : kind;

    const downstream = await findAllDependents(storage, kindName);

    return { variant: 'ok', downstream };
  },

  /**
   * What transforms can produce this kind?
   */
  async producers(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const kind = input.kind as string;
    const kindRecord = await storage.get(KINDS_RELATION, kind);
    const kindName = kindRecord ? (kindRecord.name as string) : kind;

    const edges = await storage.find(EDGES_RELATION, { toName: kindName });
    const transforms = edges.map(e => ({
      fromKind: e.fromName as string,
      transformName: (e.transformName as string) || null,
    }));

    return { variant: 'ok', transforms };
  },

  /**
   * What transforms consume this kind?
   */
  async consumers(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const kind = input.kind as string;
    const kindRecord = await storage.get(KINDS_RELATION, kind);
    const kindName = kindRecord ? (kindRecord.name as string) : kind;

    const edges = await storage.find(EDGES_RELATION, { fromName: kindName });
    const transforms = edges.map(e => ({
      toKind: e.toName as string,
      transformName: (e.transformName as string) || null,
    }));

    return { variant: 'ok', transforms };
  },

  /**
   * Return the full topology graph.
   */
  async graph(
    _input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const allKinds = await storage.find(KINDS_RELATION);
    const allEdges = await storage.find(EDGES_RELATION);

    const kinds = allKinds.map(k => ({
      name: k.name as string,
      category: k.category as string,
    }));

    const edges = allEdges.map(e => ({
      from: e.fromName as string,
      to: e.toName as string,
      relation: e.relation as string,
      transform: (e.transformName as string) || null,
    }));

    return { variant: 'ok', kinds, edges };
  },
};
