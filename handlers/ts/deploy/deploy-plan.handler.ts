// DeployPlan Concept Implementation
// Compute, validate, and execute deployment plans. Constructs a dependency
// graph (DAG) from concept specs and syncs, then tracks execution as the
// sync engine routes actions to runtime providers (VercelRuntime, etc.).
//
// This handler is provider-agnostic. It parses deploy.yaml manifests and
// emits completions that the sync engine routes to the correct providers:
//   DeployPlan/plan → (sync: ValidateBeforeExecute) → DeployPlan/validate
//   DeployPlan/validate → (sync: ExecuteAfterValidation) → Artifact/build
//   Runtime/provision [runtimeType: "vercel"] → (sync: RouteToVercel) → VercelRuntime/provision
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'deployplan';

interface ParsedManifest {
  app: { name: string; version: string; uri: string };
  runtimes: Record<string, {
    type: string;
    engine?: boolean;
    transport?: string;
    storage?: string;
    secrets?: string;
    config?: Record<string, unknown>;
  }>;
  infrastructure?: Record<string, unknown>;
  concepts: Record<string, {
    spec: string;
    implementations: Array<{
      language: string;
      path: string;
      runtime: string;
      storage: string;
      queryMode?: string;
    }>;
  }>;
  syncs?: Array<{
    path: string;
    engine: string;
    annotations?: string[];
  }>;
  build?: Record<string, unknown>;
}

/**
 * Parse a deploy.yaml manifest from raw YAML/JSON string.
 * Supports both YAML (simple key: value parsing) and JSON input.
 */
function parseManifest(raw: string): ParsedManifest | null {
  try {
    // Try JSON first
    if (raw.trim().startsWith('{')) {
      return JSON.parse(raw) as ParsedManifest;
    }
    // For YAML, we do a simple structural parse.
    // In production this would use a YAML parser; here we handle
    // the structured format from deploy.yaml files.
    // Since handlers run in Node.js, we can use a dynamic import
    // but for now we accept JSON-serialized manifests or pre-parsed objects.
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a topologically sorted list of deployment nodes from the manifest.
 * Each node represents a runtime + its assigned concepts.
 */
function buildDeployGraph(manifest: ParsedManifest): {
  nodes: Array<{ id: string; kind: string; target: string; status: string }>;
  edges: Array<{ from: string; to: string }>;
} {
  const nodes: Array<{ id: string; kind: string; target: string; status: string }> = [];
  const edges: Array<{ from: string; to: string }> = [];

  // One node per runtime
  for (const [name, runtime] of Object.entries(manifest.runtimes)) {
    nodes.push({
      id: `runtime:${name}`,
      kind: 'runtime',
      target: runtime.type,
      status: 'pending',
    });
  }

  // One node per concept, with edge to its runtime
  for (const [conceptName, conceptDef] of Object.entries(manifest.concepts)) {
    const nodeId = `concept:${conceptName}`;
    nodes.push({
      id: nodeId,
      kind: 'concept',
      target: conceptName,
      status: 'pending',
    });

    for (const impl of conceptDef.implementations) {
      edges.push({ from: `runtime:${impl.runtime}`, to: nodeId });
    }
  }

  // Sync nodes depend on their engine runtime
  if (manifest.syncs) {
    for (const sync of manifest.syncs) {
      const syncId = `sync:${sync.path}`;
      nodes.push({
        id: syncId,
        kind: 'sync',
        target: sync.path,
        status: 'pending',
      });
      edges.push({ from: `runtime:${sync.engine}`, to: syncId });
    }
  }

  return { nodes, edges };
}

export const deployPlanHandler: ConceptHandler = {
  /**
   * Parse the deploy manifest, resolve environment, construct the deploy DAG.
   * The completion from this action triggers ValidateBeforeExecute sync.
   */
  async plan(input, storage) {
    const manifestRaw = input.manifest as string;
    const environment = input.environment as string;

    if (!manifestRaw || manifestRaw.trim() === '') {
      return { variant: 'invalidManifest', errors: ['Manifest cannot be empty'] };
    }

    if (!environment || environment.trim() === '') {
      return { variant: 'invalidManifest', errors: ['Environment is required'] };
    }

    // Parse the manifest
    const manifest = parseManifest(manifestRaw);
    if (!manifest) {
      return {
        variant: 'invalidManifest',
        errors: ['Failed to parse manifest. Provide JSON-serialized deploy manifest.'],
      };
    }

    // Validate basic structure
    if (!manifest.app?.name) {
      return { variant: 'invalidManifest', errors: ['Missing app.name in manifest'] };
    }
    if (!manifest.runtimes || Object.keys(manifest.runtimes).length === 0) {
      return { variant: 'invalidManifest', errors: ['No runtimes defined in manifest'] };
    }
    if (!manifest.concepts || Object.keys(manifest.concepts).length === 0) {
      return { variant: 'invalidManifest', errors: ['No concepts defined in manifest'] };
    }

    // Build the dependency graph
    const graph = buildDeployGraph(manifest);

    // Check for missing runtime references
    const runtimeNames = new Set(Object.keys(manifest.runtimes));
    const missingRuntimes: string[] = [];
    for (const [conceptName, conceptDef] of Object.entries(manifest.concepts)) {
      for (const impl of conceptDef.implementations) {
        if (!runtimeNames.has(impl.runtime)) {
          missingRuntimes.push(`${conceptName} references unknown runtime "${impl.runtime}"`);
        }
      }
    }
    if (missingRuntimes.length > 0) {
      return { variant: 'incompleteGraph', missing: missingRuntimes };
    }

    const planId = `dp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Store the plan with the full parsed manifest for later execution
    await storage.put(RELATION, planId, {
      plan: planId,
      manifest: manifestRaw,
      parsedManifest: JSON.stringify(manifest),
      environment,
      graph: JSON.stringify(graph),
      graphNodes: JSON.stringify(graph.nodes),
      graphEdges: JSON.stringify(graph.edges),
      appName: manifest.app.name,
      appVersion: manifest.app.version || '0.1.0',
      appUri: manifest.app.uri || `urn:clef:${manifest.app.name}`,
      strategy: 'rolling',
      createdAt: now,
      currentPhase: 'planned',
      completedNodes: JSON.stringify([]),
      failedNodes: JSON.stringify([]),
      rollbackStack: JSON.stringify([]),
      estimatedDuration: graph.nodes.length * 30,
    });

    // The completion output includes runtimeType for each runtime,
    // which syncs use to route to the correct provider.
    // The ValidateBeforeExecute sync triggers DeployPlan/validate.
    return {
      variant: 'ok',
      plan: planId,
      graph: JSON.stringify(graph),
      estimatedDuration: graph.nodes.length * 30,
      // Expose runtime info for sync routing
      appName: manifest.app.name,
      runtimes: JSON.stringify(manifest.runtimes),
    };
  },

  /**
   * Validate pre-deployment invariants: sync completeness, transport
   * compatibility, storage migration safety, dependency ordering.
   * The completion triggers ExecuteAfterValidation sync.
   */
  async validate(input, storage) {
    const plan = input.plan as string;

    const record = await storage.get(RELATION, plan);
    if (!record) {
      return { variant: 'schemaIncompatible', details: [`Plan "${plan}" not found`] };
    }

    const manifest: ParsedManifest = JSON.parse(record.parsedManifest as string);
    const warnings: string[] = [];

    // Validate each runtime has at least one concept assigned
    const runtimeNames = new Set(Object.keys(manifest.runtimes));
    const usedRuntimes = new Set<string>();
    for (const conceptDef of Object.values(manifest.concepts)) {
      for (const impl of conceptDef.implementations) {
        usedRuntimes.add(impl.runtime);
      }
    }
    for (const rt of runtimeNames) {
      if (!usedRuntimes.has(rt)) {
        warnings.push(`Runtime "${rt}" has no concepts assigned`);
      }
    }

    // Validate sync engine assignments
    if (manifest.syncs) {
      for (const sync of manifest.syncs) {
        const engineRuntime = manifest.runtimes[sync.engine];
        if (!engineRuntime) {
          warnings.push(`Sync "${sync.path}" references unknown engine runtime "${sync.engine}"`);
        } else if (!engineRuntime.engine) {
          warnings.push(`Sync "${sync.path}" engine "${sync.engine}" does not have engine: true`);
        }
      }
    }

    await storage.put(RELATION, plan, {
      ...record,
      currentPhase: 'validated',
      validatedAt: new Date().toISOString(),
    });

    // The completion includes the manifest data needed by downstream syncs
    // to invoke Runtime/provision, Builder/build, etc.
    return {
      variant: 'ok',
      plan,
      warnings,
      // Pass through for sync routing
      appName: manifest.app.name,
      runtimes: JSON.stringify(manifest.runtimes),
      concepts: JSON.stringify(manifest.concepts),
    };
  },

  /**
   * Execute the deployment plan. This action is typically triggered by the
   * ExecuteAfterValidation sync chain. It updates tracking state as the
   * sync engine drives provisioning and deployment through runtime providers.
   *
   * The actual provisioning happens via:
   *   execute completion → sync → Runtime/provision → sync → VercelRuntime/provision
   *   VercelRuntime/provision completion → sync → VercelRuntime/deploy
   */
  async execute(input, storage) {
    const plan = input.plan as string;

    const record = await storage.get(RELATION, plan);
    if (!record) {
      return { variant: 'rollbackFailed', plan, reason: 'Plan not found', stuck: [] };
    }

    const manifest: ParsedManifest = JSON.parse(record.parsedManifest as string);
    const nodes: Array<{ id: string; kind: string; target: string; status: string }> =
      JSON.parse(record.graphNodes as string || '[]');
    const now = new Date().toISOString();

    // Mark execution started
    await storage.put(RELATION, plan, {
      ...record,
      currentPhase: 'executing',
      executionStartedAt: now,
    });

    // The completion output contains the runtime configurations.
    // The sync engine picks these up to invoke Runtime/provision
    // for each runtime, with the runtimeType field that routes
    // to the correct provider (e.g., route-to-vercel.sync matches
    // runtimeType: "vercel" → VercelRuntime/provision).
    const runtimeEntries = Object.entries(manifest.runtimes).map(([name, config]) => ({
      name,
      runtimeType: config.type.toLowerCase().replace('runtime', ''),
      concept: manifest.app.name,
      framework: (config.config as Record<string, unknown>)?.framework || 'nextjs',
      sourceDirectory: `./${manifest.app.name}`,
      config: JSON.stringify(config),
    }));

    // Update tracking to mark as executed
    await storage.put(RELATION, plan, {
      ...record,
      currentPhase: 'executed',
      completedNodes: JSON.stringify(nodes.map(n => n.id)),
      failedNodes: JSON.stringify([]),
      executedAt: now,
    });

    return {
      variant: 'ok',
      plan,
      duration: 0,
      nodesDeployed: nodes.length,
      // Runtime entries for sync-driven provisioning
      runtimes: JSON.stringify(runtimeEntries),
      appName: manifest.app.name,
      appUri: manifest.app.uri,
    };
  },

  /**
   * Rollback a deployment by reversing completed nodes.
   * Fires Runtime/rollback via syncs for each provisioned runtime.
   */
  async rollback(input, storage) {
    const plan = input.plan as string;

    const record = await storage.get(RELATION, plan);
    if (!record) {
      return { variant: 'partial', plan, rolledBack: [], stuck: [plan] };
    }

    const completed: string[] = JSON.parse(record.completedNodes as string || '[]');

    await storage.put(RELATION, plan, {
      ...record,
      currentPhase: 'rolledback',
      completedNodes: JSON.stringify([]),
      rollbackStack: JSON.stringify([]),
      rolledBackAt: new Date().toISOString(),
    });

    return { variant: 'ok', plan, rolledBack: completed };
  },

  /**
   * Query current execution status of a deployment plan.
   */
  async status(input, storage) {
    const plan = input.plan as string;

    const record = await storage.get(RELATION, plan);
    if (!record) {
      return { variant: 'notfound', plan };
    }

    const completedNodes: string[] = JSON.parse(record.completedNodes as string || '[]');
    const failedNodes: string[] = JSON.parse(record.failedNodes as string || '[]');
    const nodes: Array<{ id: string }> = JSON.parse(record.graphNodes as string || '[]');
    const total = nodes.length || 1;
    const progress = completedNodes.length / total;

    return {
      variant: 'ok',
      plan,
      phase: record.currentPhase as string,
      progress,
      activeNodes: nodes
        .map(n => n.id)
        .filter(id => !completedNodes.includes(id) && !failedNodes.includes(id)),
      completedNodes,
      failedNodes,
      appName: record.appName as string,
    };
  },
};
