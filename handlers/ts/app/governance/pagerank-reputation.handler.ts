// PageRankReputation Provider
// PageRank: iterative computation of reputation scores from a directed contribution graph.
import type { ConceptHandler } from '@clef/runtime';

export const pageRankReputationHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `pr-${Date.now()}`;
    await storage.put('pagerank', id, {
      id,
      dampingFactor: input.dampingFactor ?? 0.85,
      iterations: input.iterations ?? 20,
    });

    await storage.put('plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'PageRankReputation',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async addContribution(input, storage) {
    const { config, from, to, weight } = input;
    const edgeKey = `${config}:${from}:${to}`;
    await storage.put('pr_edge', edgeKey, {
      config, from, to, weight: weight ?? 1,
    });
    return { variant: 'added', edge: `${from}:${to}` };
  },

  async compute(input, storage) {
    const { config } = input;
    const cfg = await storage.get('pagerank', config as string);
    const d = cfg ? (cfg.dampingFactor as number) : 0.85;
    const iterations = cfg ? (cfg.iterations as number) : 20;

    const edges = await storage.find('pr_edge', { config: config as string });

    // Collect all nodes
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
    if (N === 0) return { variant: 'computed', config, scores: '{}' };

    // Initialize scores
    const scores = new Map<string, number>();
    for (const node of nodes) scores.set(node, 1 / N);

    // Iterate
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
    for (const [node, score] of scores) result[node] = score;

    // Store individual scores for getScore lookups
    for (const [node, score] of scores) {
      await storage.put('pr_score', `${config}:${node}`, { config, participant: node, pageRank: score });
    }

    return { variant: 'computed', config, scores: JSON.stringify(result) };
  },

  async getScore(input, storage) {
    const { config, participant } = input;
    const key = `${config}:${participant}`;
    const record = await storage.get('pr_score', key);
    const pageRank = record ? (record.pageRank as number) : 0;
    return { variant: 'score', participant, pageRank };
  },
};
