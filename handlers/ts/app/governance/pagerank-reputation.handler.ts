// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// PageRankReputation Provider
// PageRank: iterative computation of reputation scores from a directed contribution graph.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _pageRankReputationHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `pr-${Date.now()}`;
    const dampingFactor = typeof input.dampingFactor === 'number' ? input.dampingFactor :
      parseFloat(input.dampingFactor as string) || 0.85;
    const maxIterations = typeof input.maxIterations === 'number' ? input.maxIterations :
      parseInt(input.maxIterations as string, 10) || 20;
    const convergenceThreshold = typeof input.convergenceThreshold === 'number' ? input.convergenceThreshold :
      parseFloat(input.convergenceThreshold as string) || 0.0001;

    let p = createProgram();
    p = put(p, 'pagerank', id, {
      id,
      dampingFactor,
      maxIterations,
      convergenceThreshold,
      preTrusted: input.preTrusted ?? null,
    });
    p = put(p, 'plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'PageRankReputation',
      instanceId: id,
    });
    return complete(p, 'ok', { id, graph: id, config: id }) as StorageProgram<Result>;
  },

  addEdge(input: Record<string, unknown>) {
    const { graph, source, target } = input;
    if (!graph || !source || !target) {
      return complete(createProgram(), 'error', { message: 'graph, source, and target are required' }) as StorageProgram<Result>;
    }
    const weight = typeof input.weight === 'number' ? input.weight :
      parseFloat(input.weight as string) || 1;
    const edgeKey = `${graph}:${source}:${target}`;
    let p = createProgram();
    p = put(p, 'pr_edge', edgeKey, {
      id: edgeKey, graph, source, target, weight,
    });
    return complete(p, 'ok', { id: edgeKey, graph, source, target, weight }) as StorageProgram<Result>;
  },

  removeEdge(input: Record<string, unknown>) {
    const { graph, source, target } = input;
    if (!graph || !source || !target) {
      return complete(createProgram(), 'error', { message: 'graph, source, and target are required' }) as StorageProgram<Result>;
    }
    const edgeKey = `${graph}:${source}:${target}`;
    let p = createProgram();
    p = get(p, 'pr_edge', edgeKey, 'record');

    p = branch(p, 'record',
      (b) => {
        b = del(b, 'pr_edge', edgeKey);
        return complete(b, 'ok', { graph, source, target });
      },
      (b) => complete(b, 'not_found', { graph, source, target }),
    );

    return p as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const { graph } = input;
    if (!graph) {
      return complete(createProgram(), 'not_found', { graph }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'pagerank', graph as string, 'cfg');
    p = find(p, 'pr_edge', { graph: graph as string }, 'edges');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const edges = bindings.edges as Array<Record<string, unknown>>;
      const d = cfg ? (cfg.dampingFactor as number) : 0.85;
      const iterations = cfg ? ((cfg.maxIterations as number) ?? (cfg.iterations as number) ?? 20) : 20;

      const nodeSet = new Set<string>();
      const outgoing = new Map<string, Array<{ to: string; weight: number }>>();
      for (const edge of edges) {
        const from = (edge.source ?? edge.from) as string;
        const to = (edge.target ?? edge.to) as string;
        const w = edge.weight as number;
        nodeSet.add(from);
        nodeSet.add(to);
        if (!outgoing.has(from)) outgoing.set(from, []);
        outgoing.get(from)!.push({ to, weight: w });
      }

      const nodes = Array.from(nodeSet);
      const N = nodes.length;
      if (N === 0) return { scores: '{}', scoreEntries: [] };

      const scores = new Map<string, number>();
      for (const node of nodes) scores.set(node, 1 / N);

      for (let iter = 0; iter < iterations; iter++) {
        const newScores = new Map<string, number>();
        for (const node of nodes) newScores.set(node, (1 - d) / N);

        for (const node of nodes) {
          const outs = outgoing.get(node) || [];
          const totalOutWeight = outs.reduce((s, e) => s + e.weight, 0);
          if (totalOutWeight === 0) continue;

          const nodeScore = scores.get(node)!;
          for (const edge of outs) {
            const share = (edge.weight / totalOutWeight) * nodeScore * d;
            newScores.set(edge.to, newScores.get(edge.to)! + share);
          }
        }

        for (const node of nodes) scores.set(node, newScores.get(node)!);
      }

      const result: Record<string, number> = {};
      const scoreEntries: Array<{ node: string; score: number }> = [];
      for (const [node, score] of scores) {
        result[node] = score;
        scoreEntries.push({ node, score });
      }

      return { scores: JSON.stringify(result), scoreEntries };
    }, 'computed');

    p = putFrom(p, 'pr_scores', graph as string, (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { graph, scores: computed.scores };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { graph, scores: computed.scores };
    }) as StorageProgram<Result>;
  },

  getScore(input: Record<string, unknown>) {
    const { graph, participant } = input;
    if (!graph || !participant) {
      return complete(createProgram(), 'error', { message: 'graph and participant are required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'pr_scores', graph as string, 'record');

    return completeFrom(p, 'ok', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      if (!record) return { participant, pageRank: 0 };
      const scores = JSON.parse(record.scores as string) as Record<string, number>;
      const pageRank = scores[participant as string] ?? 0;
      return { participant, pageRank };
    }) as StorageProgram<Result>;
  },
};

export const pageRankReputationHandler = autoInterpret(_pageRankReputationHandler);
