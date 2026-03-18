// @migrated dsl-constructs 2026-03-18
// DeployPlan Concept Implementation (Deploy Kit)
// Compute, validate, and execute deployment plans for suites.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const deployPlanHandler: FunctionalConceptHandler = {
  plan(input: Record<string, unknown>) {
    const manifest = input.manifest as string;
    const environment = input.environment as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(manifest);
    } catch {
      let p = createProgram();
      return complete(p, 'invalidManifest', { errors: JSON.stringify(['Invalid JSON in manifest']) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const nodes = parsed.nodes as Array<{ id: string; kind: string; target: string }> | undefined;
    const edges = parsed.edges as Array<{ from: string; to: string }> | undefined;

    if (!nodes || !Array.isArray(nodes)) {
      let p = createProgram();
      return complete(p, 'invalidManifest', { errors: JSON.stringify(['Missing nodes in manifest']) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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
          let p = createProgram();
          return complete(p, 'circularDependency', { cycle: JSON.stringify(cycle) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
        }
      }
    }

    const planId = `dp-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const estimatedDuration = nodes.length * 60;

    const graphNodes = nodes.map(n => ({
      id: n.id, kind: n.kind, target: n.target, status: 'pending',
    }));
    const graph = JSON.stringify({ nodes: graphNodes, edges: edges || [] });

    let p = createProgram();
    p = put(p, 'deployPlan', planId, {
      planId,
      suiteName: (parsed.suiteName as string) || 'unknown',
      kitVersion: (parsed.kitVersion as string) || '0.0.0',
      environment, createdAt,
      strategy: (parsed.strategy as string) || 'rolling',
      currentPhase: 'planned',
      completedNodes: JSON.stringify([]),
      failedNodes: JSON.stringify([]),
      rollbackStack: JSON.stringify([]),
      graph, estimatedDuration,
    });
    return complete(p, 'ok', { plan: planId, graph, estimatedDuration }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const plan = input.plan as string;

    let p = createProgram();
    p = spGet(p, 'deployPlan', plan, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Migration check and validation resolved at runtime from bindings
        let b2 = put(b, 'deployPlan', plan, { currentPhase: 'validated' });
        return complete(b2, 'ok', { plan, warnings: JSON.stringify([]) });
      },
      (b) => complete(b, 'notfound', { plan }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const plan = input.plan as string;

    let p = createProgram();
    p = spGet(p, 'deployPlan', plan, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Node execution resolved at runtime from bindings
        let b2 = put(b, 'deployPlan', plan, { currentPhase: 'completed' });
        return complete(b2, 'ok', { plan, duration: 0, nodesDeployed: 0 });
      },
      (b) => complete(b, 'notfound', { plan }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const plan = input.plan as string;

    let p = createProgram();
    p = spGet(p, 'deployPlan', plan, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'deployPlan', plan, {
          currentPhase: 'rolledback',
          completedNodes: JSON.stringify([]),
        });
        return complete(b2, 'ok', { plan, rolledBack: '' });
      },
      (b) => complete(b, 'notfound', { plan }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  status(input: Record<string, unknown>) {
    const plan = input.plan as string;

    let p = createProgram();
    p = spGet(p, 'deployPlan', plan, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { plan, phase: '', progress: 0, activeNodes: '' }),
      (b) => complete(b, 'notfound', { plan }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
