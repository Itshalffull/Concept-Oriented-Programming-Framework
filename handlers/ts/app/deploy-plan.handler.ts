// DeployPlan Concept Implementation (Deploy Kit)
// Compute, validate, and execute deployment plans for kits.
import type { ConceptHandler } from '@clef/kernel';

export const deployPlanHandler: ConceptHandler = {
  async plan(input, storage) {
    const manifest = input.manifest as string;
    const environment = input.environment as string;

    // Attempt to parse manifest as JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return { variant: 'invalidManifest', errors: JSON.stringify(['Invalid JSON in manifest']) };
    }

    const nodes = parsed.nodes as Array<{ id: string; kind: string; target: string }> | undefined;
    const edges = parsed.edges as Array<{ from: string; to: string }> | undefined;

    if (!nodes || !Array.isArray(nodes)) {
      return { variant: 'invalidManifest', errors: JSON.stringify(['Missing nodes in manifest']) };
    }

    // Check for circular dependencies
    if (edges && Array.isArray(edges)) {
      const adjacency: Record<string, string[]> = {};
      for (const node of nodes) {
        adjacency[node.id] = [];
      }
      for (const edge of edges) {
        if (adjacency[edge.from]) {
          adjacency[edge.from].push(edge.to);
        }
      }
      const visited = new Set<string>();
      const inStack = new Set<string>();
      const cycle: string[] = [];

      function hasCycle(nodeId: string): boolean {
        visited.add(nodeId);
        inStack.add(nodeId);
        for (const neighbor of adjacency[nodeId] || []) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) {
              cycle.unshift(nodeId);
              return true;
            }
          } else if (inStack.has(neighbor)) {
            cycle.unshift(neighbor);
            cycle.unshift(nodeId);
            return true;
          }
        }
        inStack.delete(nodeId);
        return false;
      }

      for (const node of nodes) {
        if (!visited.has(node.id) && hasCycle(node.id)) {
          return { variant: 'circularDependency', cycle: JSON.stringify(cycle) };
        }
      }
    }

    const planId = `dp-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const estimatedDuration = nodes.length * 60;

    const graphNodes = nodes.map(n => ({
      id: n.id,
      kind: n.kind,
      target: n.target,
      status: 'pending',
    }));

    const graph = JSON.stringify({ nodes: graphNodes, edges: edges || [] });

    await storage.put('deployPlan', planId, {
      planId,
      kitName: (parsed.kitName as string) || 'unknown',
      kitVersion: (parsed.kitVersion as string) || '0.0.0',
      environment,
      createdAt,
      strategy: (parsed.strategy as string) || 'rolling',
      currentPhase: 'planned',
      completedNodes: JSON.stringify([]),
      failedNodes: JSON.stringify([]),
      rollbackStack: JSON.stringify([]),
      graph,
      estimatedDuration,
    });

    return { variant: 'ok', plan: planId, graph, estimatedDuration };
  },

  async validate(input, storage) {
    const plan = input.plan as string;

    const existing = await storage.get('deployPlan', plan);
    if (!existing) {
      return { variant: 'notfound', plan };
    }

    const warnings: string[] = [];
    const graph = JSON.parse(existing.graph as string);
    const nodes = graph.nodes as Array<{ id: string; kind: string; target: string }>;

    // Check for migration requirements (simplified simulation)
    if (nodes.some((n: { kind: string }) => n.kind === 'migration')) {
      const migrationConcepts = nodes
        .filter((n: { kind: string }) => n.kind === 'migration')
        .map((n: { target: string }) => n.target);
      return {
        variant: 'migrationRequired',
        plan,
        concepts: JSON.stringify(migrationConcepts),
        fromVersions: JSON.stringify(migrationConcepts.map(() => 1)),
        toVersions: JSON.stringify(migrationConcepts.map(() => 2)),
      };
    }

    if (nodes.length > 10) {
      warnings.push('Large deployment graph - consider staged rollout');
    }

    await storage.put('deployPlan', plan, {
      ...existing,
      currentPhase: 'validated',
    });

    return { variant: 'ok', plan, warnings: JSON.stringify(warnings) };
  },

  async execute(input, storage) {
    const plan = input.plan as string;

    const existing = await storage.get('deployPlan', plan);
    if (!existing) {
      return { variant: 'notfound', plan };
    }

    const graph = JSON.parse(existing.graph as string);
    const nodes = graph.nodes as Array<{ id: string; kind: string; target: string; status: string }>;
    const startTime = Date.now();

    const deployed: string[] = [];
    const failed: string[] = [];

    // Simulate execution of each node
    for (const node of nodes) {
      node.status = 'completed';
      deployed.push(node.id);
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    if (failed.length > 0 && deployed.length > 0) {
      await storage.put('deployPlan', plan, {
        ...existing,
        currentPhase: 'partial',
        completedNodes: JSON.stringify(deployed),
        failedNodes: JSON.stringify(failed),
        graph: JSON.stringify(graph),
      });
      return {
        variant: 'partial',
        plan,
        deployed: JSON.stringify(deployed),
        failed: JSON.stringify(failed),
      };
    }

    await storage.put('deployPlan', plan, {
      ...existing,
      currentPhase: 'completed',
      completedNodes: JSON.stringify(deployed),
      failedNodes: JSON.stringify([]),
      graph: JSON.stringify(graph),
    });

    return { variant: 'ok', plan, duration, nodesDeployed: deployed.length };
  },

  async rollback(input, storage) {
    const plan = input.plan as string;

    const existing = await storage.get('deployPlan', plan);
    if (!existing) {
      return { variant: 'notfound', plan };
    }

    const completedNodes: string[] = JSON.parse(existing.completedNodes as string);

    // Rollback in reverse order
    const rolledBack = [...completedNodes].reverse();

    await storage.put('deployPlan', plan, {
      ...existing,
      currentPhase: 'rolledback',
      completedNodes: JSON.stringify([]),
      rollbackStack: JSON.stringify(rolledBack),
    });

    return { variant: 'ok', plan, rolledBack: JSON.stringify(rolledBack) };
  },

  async status(input, storage) {
    const plan = input.plan as string;

    const existing = await storage.get('deployPlan', plan);
    if (!existing) {
      return { variant: 'notfound', plan };
    }

    const graph = JSON.parse(existing.graph as string);
    const nodes = graph.nodes as Array<{ id: string; status: string }>;
    const totalNodes = nodes.length;
    const completedNodes: string[] = JSON.parse(existing.completedNodes as string);
    const progress = totalNodes > 0 ? completedNodes.length / totalNodes : 0;
    const activeNodes = nodes
      .filter((n: { status: string }) => n.status === 'in_progress')
      .map((n: { id: string }) => n.id);

    return {
      variant: 'ok',
      plan,
      phase: existing.currentPhase as string,
      progress,
      activeNodes: JSON.stringify(activeNodes),
    };
  },
};
