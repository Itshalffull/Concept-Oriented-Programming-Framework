// @migrated dsl-constructs 2026-03-18
// Graph Analysis Concept Implementation
// Implements graph analysis algorithms on adjacency list data:
// centrality (degree, betweenness, pagerank), community (louvain, label-propagation),
// pattern (cycles, bridges, articulation-points), structural (connected-components,
// strongly-connected), clustering (clustering-coefficient), path (shortest-path).
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

// ---------------------------------------------------------------------------
// Internal graph representation
// ---------------------------------------------------------------------------

interface Edge {
  source: string;
  target: string;
  weight?: number;
}

interface GraphInput {
  nodes: string[];
  edges: Edge[];
}

interface AdjEntry {
  target: string;
  weight: number;
}

interface Graph {
  nodes: string[];
  adj: Map<string, AdjEntry[]>;   // outgoing
  radj: Map<string, AdjEntry[]>;  // incoming (reverse)
  directed: boolean;
}

function parseGraph(json: string): Graph {
  const data: GraphInput = JSON.parse(json);
  const nodes = data.nodes;
  const adj = new Map<string, AdjEntry[]>();
  const radj = new Map<string, AdjEntry[]>();

  for (const n of nodes) {
    adj.set(n, []);
    radj.set(n, []);
  }

  let directed = false;
  const edgeSet = new Set<string>();
  for (const e of data.edges) {
    const fwd = `${e.source}->${e.target}`;
    const rev = `${e.target}->${e.source}`;
    if (edgeSet.has(fwd) && !edgeSet.has(rev)) directed = true;
    edgeSet.add(fwd);

    adj.get(e.source)!.push({ target: e.target, weight: e.weight ?? 1 });
    radj.get(e.target)!.push({ target: e.source, weight: e.weight ?? 1 });
  }
  // Heuristic: if no reverse edge exists for any edge, treat as directed
  if (!directed) {
    for (const e of data.edges) {
      if (!edgeSet.has(`${e.target}->${e.source}`)) {
        directed = true;
        break;
      }
    }
  }

  return { nodes, adj, radj, directed };
}

// ---------------------------------------------------------------------------
// Centrality algorithms
// ---------------------------------------------------------------------------

function degreeCentrality(g: Graph): Record<string, unknown> {
  const n = g.nodes.length;
  const norm = n > 1 ? n - 1 : 1;
  const result: Record<string, { in: number; out: number; total: number; normalized: number }> = {};

  for (const node of g.nodes) {
    const outDeg = g.adj.get(node)!.length;
    const inDeg = g.radj.get(node)!.length;
    const total = g.directed ? inDeg + outDeg : outDeg;
    result[node] = { in: inDeg, out: outDeg, total, normalized: total / norm };
  }
  return result;
}

function betweennessCentrality(g: Graph): Record<string, number> {
  const cb: Record<string, number> = {};
  for (const v of g.nodes) cb[v] = 0;

  for (const s of g.nodes) {
    const stack: string[] = [];
    const pred: Record<string, string[]> = {};
    const sigma: Record<string, number> = {};
    const dist: Record<string, number> = {};

    for (const v of g.nodes) {
      pred[v] = [];
      sigma[v] = 0;
      dist[v] = -1;
    }
    sigma[s] = 1;
    dist[s] = 0;

    const queue: string[] = [s];
    let qi = 0;
    while (qi < queue.length) {
      const v = queue[qi++];
      stack.push(v);
      for (const { target: w } of g.adj.get(v)!) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }

    const delta: Record<string, number> = {};
    for (const v of g.nodes) delta[v] = 0;

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) {
        cb[w] += delta[w];
      }
    }
  }

  if (!g.directed) {
    for (const v of g.nodes) cb[v] /= 2;
  }

  return cb;
}

function pagerank(g: Graph, config?: Record<string, unknown>): Record<string, number> {
  const damping = (config?.damping as number) ?? 0.85;
  const maxIter = (config?.max_iterations as number) ?? 100;
  const tolerance = (config?.tolerance as number) ?? 1e-6;
  const n = g.nodes.length;
  if (n === 0) return {};

  let rank: Record<string, number> = {};
  for (const v of g.nodes) rank[v] = 1 / n;

  for (let iter = 0; iter < maxIter; iter++) {
    const newRank: Record<string, number> = {};
    for (const v of g.nodes) newRank[v] = (1 - damping) / n;

    for (const u of g.nodes) {
      const outDeg = g.adj.get(u)!.length;
      if (outDeg === 0) {
        const share = rank[u] / n;
        for (const v of g.nodes) newRank[v] += damping * share;
      } else {
        const share = rank[u] / outDeg;
        for (const { target: v } of g.adj.get(u)!) {
          newRank[v] += damping * share;
        }
      }
    }

    let diff = 0;
    for (const v of g.nodes) diff += Math.abs(newRank[v] - rank[v]);
    rank = newRank;
    if (diff < tolerance) break;
  }

  return rank;
}

// ---------------------------------------------------------------------------
// Community algorithms
// ---------------------------------------------------------------------------

function louvain(g: Graph): Record<string, unknown> {
  const community: Record<string, string> = {};
  for (const n of g.nodes) community[n] = n;

  const weights = new Map<string, Map<string, number>>();
  for (const n of g.nodes) weights.set(n, new Map());
  let totalWeight = 0;

  for (const u of g.nodes) {
    for (const { target: v, weight: w } of g.adj.get(u)!) {
      const cur = weights.get(u)!.get(v) ?? 0;
      weights.get(u)!.set(v, cur + w);
      if (g.directed) {
        const cur2 = weights.get(v)!.get(u) ?? 0;
        weights.get(v)!.set(u, cur2 + w);
      }
      totalWeight += w;
    }
  }
  if (!g.directed) {
    totalWeight = totalWeight;
  }
  const m2 = totalWeight;

  if (m2 === 0) {
    return { communities: community, modularity: 0 };
  }

  const ki: Record<string, number> = {};
  for (const n of g.nodes) {
    let k = 0;
    for (const [, w] of weights.get(n)!) k += w;
    ki[n] = k;
  }

  const commTot: Record<string, number> = {};
  for (const n of g.nodes) commTot[n] = ki[n];

  const commIn: Record<string, number> = {};
  for (const n of g.nodes) {
    commIn[n] = weights.get(n)!.get(n) ?? 0;
  }

  let improved = true;
  let iterations = 0;
  while (improved && iterations < 50) {
    improved = false;
    iterations++;
    for (const node of g.nodes) {
      const currentComm = community[node];
      const nodeKi = ki[node];

      const neighborComms = new Map<string, number>();
      for (const [neighbor, w] of weights.get(node)!) {
        const nc = community[neighbor];
        neighborComms.set(nc, (neighborComms.get(nc) ?? 0) + w);
      }

      const wToCurrent = neighborComms.get(currentComm) ?? 0;

      commTot[currentComm] -= nodeKi;
      commIn[currentComm] -= 2 * wToCurrent + (weights.get(node)!.get(node) ?? 0);

      let bestComm = currentComm;
      let bestGain = 0;

      for (const [nc, wToNc] of neighborComms) {
        const gain = wToNc - (commTot[nc] * nodeKi) / m2;
        if (gain > bestGain) {
          bestGain = gain;
          bestComm = nc;
        }
      }

      community[node] = bestComm;
      commTot[bestComm] = (commTot[bestComm] ?? 0) + nodeKi;
      const wToBest = neighborComms.get(bestComm) ?? 0;
      commIn[bestComm] = (commIn[bestComm] ?? 0) + 2 * wToBest + (weights.get(node)!.get(node) ?? 0);

      if (bestComm !== currentComm) improved = true;
    }
  }

  let Q = 0;
  for (const u of g.nodes) {
    for (const [v, w] of weights.get(u)!) {
      if (community[u] === community[v]) {
        Q += w - (ki[u] * ki[v]) / m2;
      }
    }
  }
  Q /= m2;

  return { communities: community, modularity: Q };
}

function labelPropagation(g: Graph): Record<string, unknown> {
  const label: Record<string, string> = {};
  for (const n of g.nodes) label[n] = n;

  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    const order = [...g.nodes].sort(() => Math.random() - 0.5);

    for (const node of order) {
      const neighbors = [
        ...g.adj.get(node)!.map(e => e.target),
        ...g.radj.get(node)!.map(e => e.target),
      ];
      if (neighbors.length === 0) continue;

      const freq = new Map<string, number>();
      for (const nb of neighbors) {
        const l = label[nb];
        freq.set(l, (freq.get(l) ?? 0) + 1);
      }

      let maxFreq = 0;
      let bestLabel = label[node];
      for (const [l, f] of freq) {
        if (f > maxFreq) {
          maxFreq = f;
          bestLabel = l;
        }
      }

      if (bestLabel !== label[node]) {
        label[node] = bestLabel;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return { labels: label };
}

// ---------------------------------------------------------------------------
// Pattern algorithms
// ---------------------------------------------------------------------------

function findCycles(g: Graph, config?: Record<string, unknown>): string[][] {
  const maxLength = (config?.max_length as number) ?? 10;
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function dfs(node: string, start: string, depth: number): void {
    if (depth > maxLength) return;
    if (cycles.length >= 1000) return;

    for (const { target } of g.adj.get(node)!) {
      if (target === start && depth >= 2) {
        cycles.push([...stack, start]);
        continue;
      }
      if (!visited.has(target) && !onStack.has(target)) {
        onStack.add(target);
        stack.push(target);
        dfs(target, start, depth + 1);
        stack.pop();
        onStack.delete(target);
      }
    }
  }

  for (const node of g.nodes) {
    stack.push(node);
    onStack.add(node);
    dfs(node, node, 1);
    stack.pop();
    onStack.delete(node);
    visited.add(node);
  }

  return cycles;
}

function findBridges(g: Graph): Array<[string, string]> {
  const disc: Record<string, number> = {};
  const low: Record<string, number> = {};
  const visited = new Set<string>();
  const bridges: Array<[string, string]> = [];
  let timer = 0;

  function dfs(u: string, parent: string | null): void {
    visited.add(u);
    disc[u] = low[u] = timer++;

    for (const { target: v } of g.adj.get(u)!) {
      if (!visited.has(v)) {
        dfs(v, u);
        low[u] = Math.min(low[u], low[v]);
        if (low[v] > disc[u]) {
          bridges.push([u, v]);
        }
      } else if (v !== parent) {
        low[u] = Math.min(low[u], disc[v]);
      }
    }

    if (!g.directed) {
      for (const { target: v } of g.radj.get(u)!) {
        if (!visited.has(v)) {
          dfs(v, u);
          low[u] = Math.min(low[u], low[v]);
          if (low[v] > disc[u]) {
            bridges.push([u, v]);
          }
        } else if (v !== parent) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    }
  }

  for (const node of g.nodes) {
    if (!visited.has(node)) dfs(node, null);
  }

  return bridges;
}

function findArticulationPoints(g: Graph): string[] {
  const disc: Record<string, number> = {};
  const low: Record<string, number> = {};
  const visited = new Set<string>();
  const ap = new Set<string>();
  let timer = 0;

  function neighbors(u: string): string[] {
    const out = g.adj.get(u)!.map(e => e.target);
    if (!g.directed) {
      const inc = g.radj.get(u)!.map(e => e.target);
      const all = new Set([...out, ...inc]);
      return [...all];
    }
    return out;
  }

  function dfs(u: string, parent: string | null): void {
    visited.add(u);
    disc[u] = low[u] = timer++;
    let children = 0;

    for (const v of neighbors(u)) {
      if (!visited.has(v)) {
        children++;
        dfs(v, u);
        low[u] = Math.min(low[u], low[v]);

        if (parent === null && children > 1) ap.add(u);
        if (parent !== null && low[v] >= disc[u]) ap.add(u);
      } else if (v !== parent) {
        low[u] = Math.min(low[u], disc[v]);
      }
    }
  }

  for (const node of g.nodes) {
    if (!visited.has(node)) dfs(node, null);
  }

  return [...ap];
}

// ---------------------------------------------------------------------------
// Structural algorithms
// ---------------------------------------------------------------------------

function connectedComponents(g: Graph): Record<string, number> {
  const component: Record<string, number> = {};
  let compId = 0;

  function neighbors(u: string): string[] {
    const out = g.adj.get(u)!.map(e => e.target);
    const inc = g.radj.get(u)!.map(e => e.target);
    return [...new Set([...out, ...inc])];
  }

  for (const node of g.nodes) {
    if (component[node] !== undefined) continue;
    const queue = [node];
    let qi = 0;
    component[node] = compId;
    while (qi < queue.length) {
      const u = queue[qi++];
      for (const v of neighbors(u)) {
        if (component[v] === undefined) {
          component[v] = compId;
          queue.push(v);
        }
      }
    }
    compId++;
  }

  return component;
}

function stronglyConnectedComponents(g: Graph): Record<string, unknown> {
  const disc: Record<string, number> = {};
  const low: Record<string, number> = {};
  const onStack = new Set<string>();
  const stack: string[] = [];
  let timer = 0;
  const sccs: string[][] = [];
  const visited = new Set<string>();

  function dfs(u: string): void {
    disc[u] = low[u] = timer++;
    visited.add(u);
    stack.push(u);
    onStack.add(u);

    for (const { target: v } of g.adj.get(u)!) {
      if (!visited.has(v)) {
        dfs(v);
        low[u] = Math.min(low[u], low[v]);
      } else if (onStack.has(v)) {
        low[u] = Math.min(low[u], disc[v]);
      }
    }

    if (low[u] === disc[u]) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== u);
      sccs.push(scc);
    }
  }

  for (const node of g.nodes) {
    if (!visited.has(node)) dfs(node);
  }

  const nodeToScc: Record<string, number> = {};
  for (let i = 0; i < sccs.length; i++) {
    for (const n of sccs[i]) nodeToScc[n] = i;
  }

  return { components: sccs, nodeToComponent: nodeToScc };
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

function clusteringCoefficient(g: Graph): Record<string, unknown> {
  const coefficients: Record<string, number> = {};

  function neighbors(u: string): Set<string> {
    const out = g.adj.get(u)!.map(e => e.target);
    const inc = g.radj.get(u)!.map(e => e.target);
    return new Set([...out, ...inc]);
  }

  let sum = 0;
  for (const node of g.nodes) {
    const nbrs = neighbors(node);
    const k = nbrs.size;
    if (k < 2) {
      coefficients[node] = 0;
      continue;
    }

    let triangles = 0;
    const nbrArr = [...nbrs];
    for (let i = 0; i < nbrArr.length; i++) {
      for (let j = i + 1; j < nbrArr.length; j++) {
        const ni = nbrArr[i];
        const nj = nbrArr[j];
        const niNeighbors = neighbors(ni);
        if (niNeighbors.has(nj)) triangles++;
      }
    }

    const possible = (k * (k - 1)) / 2;
    coefficients[node] = triangles / possible;
    sum += coefficients[node];
  }

  const average = g.nodes.length > 0 ? sum / g.nodes.length : 0;
  return { coefficients, average };
}

// ---------------------------------------------------------------------------
// Path algorithms
// ---------------------------------------------------------------------------

function shortestPath(g: Graph, config?: Record<string, unknown>): Record<string, unknown> {
  const source = config?.source as string;
  const target = config?.target as string;
  if (!source || !target) {
    return { error: 'source and target required in config' };
  }

  let weighted = false;
  for (const [, edges] of g.adj) {
    for (const e of edges) {
      if (e.weight !== 1) { weighted = true; break; }
    }
    if (weighted) break;
  }

  if (weighted) {
    return dijkstra(g, source, target);
  }
  return bfsShortestPath(g, source, target);
}

function bfsShortestPath(g: Graph, source: string, target: string): Record<string, unknown> {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const n of g.nodes) {
    dist[n] = Infinity;
    prev[n] = null;
  }
  dist[source] = 0;

  const queue = [source];
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++];
    if (u === target) break;
    for (const { target: v } of g.adj.get(u)!) {
      if (dist[v] === Infinity) {
        dist[v] = dist[u] + 1;
        prev[v] = u;
        queue.push(v);
      }
    }
  }

  if (dist[target] === Infinity) {
    return { distance: -1, path: [], reachable: false };
  }

  const path: string[] = [];
  let cur: string | null = target;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur];
  }

  return { distance: dist[target], path, reachable: true };
}

function dijkstra(g: Graph, source: string, target: string): Record<string, unknown> {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const n of g.nodes) {
    dist[n] = Infinity;
    prev[n] = null;
  }
  dist[source] = 0;

  const pq: Array<{ node: string; dist: number }> = [{ node: source, dist: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.dist - b.dist);
    const { node: u } = pq.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === target) break;

    for (const { target: v, weight: w } of g.adj.get(u)!) {
      const alt = dist[u] + w;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
        pq.push({ node: v, dist: alt });
      }
    }
  }

  if (dist[target] === Infinity) {
    return { distance: -1, path: [], reachable: false };
  }

  const path: string[] = [];
  let cur: string | null = target;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur];
  }

  return { distance: dist[target], path, reachable: true };
}

// ---------------------------------------------------------------------------
// Algorithm registry and dispatch
// ---------------------------------------------------------------------------

const BUILTIN_ALGORITHMS: Array<{ algorithm: string; category: string; provider: string }> = [
  { algorithm: 'degree', category: 'centrality', provider: 'builtin' },
  { algorithm: 'betweenness', category: 'centrality', provider: 'builtin' },
  { algorithm: 'pagerank', category: 'centrality', provider: 'builtin' },
  { algorithm: 'louvain', category: 'community', provider: 'builtin' },
  { algorithm: 'label-propagation', category: 'community', provider: 'builtin' },
  { algorithm: 'cycles', category: 'pattern', provider: 'builtin' },
  { algorithm: 'bridges', category: 'pattern', provider: 'builtin' },
  { algorithm: 'articulation-points', category: 'pattern', provider: 'builtin' },
  { algorithm: 'connected-components', category: 'structural', provider: 'builtin' },
  { algorithm: 'strongly-connected', category: 'structural', provider: 'builtin' },
  { algorithm: 'clustering-coefficient', category: 'clustering', provider: 'builtin' },
  { algorithm: 'shortest-path', category: 'path', provider: 'builtin' },
];

const ALGORITHM_DISPATCH: Record<string, { category: string; fn: (g: Graph, config?: Record<string, unknown>) => unknown }> = {
  'degree': { category: 'centrality', fn: degreeCentrality },
  'betweenness': { category: 'centrality', fn: betweennessCentrality },
  'pagerank': { category: 'centrality', fn: pagerank },
  'louvain': { category: 'community', fn: louvain },
  'label-propagation': { category: 'community', fn: labelPropagation },
  'cycles': { category: 'pattern', fn: findCycles },
  'bridges': { category: 'pattern', fn: (g) => findBridges(g) },
  'articulation-points': { category: 'pattern', fn: (g) => findArticulationPoints(g) },
  'connected-components': { category: 'structural', fn: connectedComponents },
  'strongly-connected': { category: 'structural', fn: stronglyConnectedComponents },
  'clustering-coefficient': { category: 'clustering', fn: clusteringCoefficient },
  'shortest-path': { category: 'path', fn: shortestPath },
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const graphAnalysisHandler: FunctionalConceptHandler = {

  analyze(input: Record<string, unknown>) {
    const graphJson = input.graph as string;
    const algorithm = input.algorithm as string;
    const configJson = input.config as string | undefined;

    const dispatch = ALGORITHM_DISPATCH[algorithm];
    if (!dispatch) {
      const p = createProgram();
      return complete(p, 'unknown_algorithm', { message: `Unknown algorithm: ${algorithm}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    try {
      const graph = parseGraph(graphJson);
      const config = configJson ? JSON.parse(configJson) : undefined;
      const payload = dispatch.fn(graph, config);

      const resultId = `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let p = createProgram();
      p = put(p, 'graph-result', resultId, {
        id: resultId,
        algorithm,
        category: dispatch.category,
        graphHash: graphJson.length.toString(),
        payload: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
      });

      return complete(p, 'ok', {
        result: resultId,
        category: dispatch.category,
        payload: JSON.stringify(payload),
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const p = createProgram();
      return complete(p, 'analysis_failed', { message }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  register(input: Record<string, unknown>) {
    const algorithm = input.algorithm as string;
    const category = input.category as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = put(p, 'graph-algorithm', algorithm, {
      algorithm,
      category,
      provider,
      registeredAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listAlgorithms(input: Record<string, unknown>) {
    const category = input.category as string | undefined;

    let p = createProgram();
    p = find(p, 'graph-algorithm', {}, 'registered');
    return complete(p, 'ok', { algorithms: JSON.stringify(BUILTIN_ALGORITHMS) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getResult(input: Record<string, unknown>) {
    const resultId = input.result as string;

    let p = createProgram();
    p = spGet(p, 'graph-result', resultId, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', {
        id: resultId,
        algorithm: '',
        category: '',
        payload: '',
        createdAt: '',
      }),
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listResults(input: Record<string, unknown>) {
    const graphJson = input.graph as string;

    let p = createProgram();
    p = find(p, 'graph-result', {}, 'allResults');
    return complete(p, 'ok', { results: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clearResults(input: Record<string, unknown>) {
    const graphJson = input.graph as string;

    let p = createProgram();
    p = find(p, 'graph-result', {}, 'allResults');
    return complete(p, 'ok', { cleared: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
