// @migrated dsl-constructs 2026-03-18
// PageRankReputation Provider
// PageRank: iterative computation of reputation scores from a directed contribution graph.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _pageRankReputationHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `pr-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'pagerank', id, {
      id,
      dampingFactor: input.dampingFactor ?? 0.85,
      iterations: input.iterations ?? 20,
    });
    p = put(p, 'plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'PageRankReputation',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  addContribution(input: Record<string, unknown>) {
    const { config, from, to, weight } = input;
    const edgeKey = `${config}:${from}:${to}`;
    let p = createProgram();
    p = put(p, 'pr_edge', edgeKey, {
      config, from, to, weight: weight ?? 1,
    });
    return complete(p, 'added', { edge: `${from}:${to}` }) as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const { config } = input;
    let p = createProgram();
    p = get(p, 'pagerank', config as string, 'cfg');
    p = find(p, 'pr_edge', { config: config as string }, 'edges');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const edges = bindings.edges as Array<Record<string, unknown>>;
      const d = cfg ? (cfg.dampingFactor as number) : 0.85;
      const iterations = cfg ? (cfg.iterations as number) : 20;

      const nodeSet = new Set<string>();
      const outgoing = new Map<string, Array<{ to: string; weight: number }>>();
      for (const edge of edges) {
        const from = edge.from as string;
        const to = edge.to as string;
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

    // Store all scores in a single document keyed by config
    p = putFrom(p, 'pr_scores', config as string, (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { config, scores: computed.scores };
    });

    return completeFrom(p, 'computed', (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { config, scores: computed.scores };
    }) as StorageProgram<Result>;
  },

  getScore(input: Record<string, unknown>) {
    const { config, participant } = input;
    let p = createProgram();
    p = get(p, 'pr_scores', config as string, 'record');

    return completeFrom(p, 'score', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      if (!record) return { participant, pageRank: 0 };
      const scores = JSON.parse(record.scores as string) as Record<string, number>;
      const pageRank = scores[participant as string] ?? 0;
      return { participant, pageRank };
    }) as StorageProgram<Result>;
  },
};

export const pageRankReputationHandler = autoInterpret(_pageRankReputationHandler);
