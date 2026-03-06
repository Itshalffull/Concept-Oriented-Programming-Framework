// DeploymentEntity Concept Implementation
//
// Queryable representation of parsed deployment manifests (deploy.yaml).
// Covers runtime topology, concept-to-runtime assignments, storage and
// transport adapter bindings, sync engine configurations, and environment
// overlays. Enables deployment structure queries and topology analysis.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const deploymentEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const name = input.name as string;
    const source = input.source as string;
    const manifest = input.manifest as string;

    const key = `deployment:${name}`;
    const existing = await storage.get('deployments', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();
    const parsed = manifest ? JSON.parse(manifest) : {};

    await storage.put('deployments', key, {
      id,
      name,
      sourceFile: source,
      symbol: name,
      appName: parsed.app?.name || '',
      appVersion: parsed.app?.version || '',
      runtimes: JSON.stringify(parsed.runtimes || []),
      conceptAssignments: JSON.stringify(parsed.conceptAssignments || []),
      syncEngineAssignments: JSON.stringify(parsed.syncEngineAssignments || []),
      storageBindings: JSON.stringify(parsed.storageBindings || []),
      transportBindings: JSON.stringify(parsed.transportBindings || []),
      environmentOverlays: JSON.stringify(parsed.environmentOverlays || []),
      iacProvider: parsed.iacProvider || '',
      healthCheckConfig: JSON.stringify(parsed.healthCheckConfig || {}),
    });

    return { variant: 'ok', deployment: id };
  },

  async get(input, storage) {
    const name = input.name as string;

    const entry = await storage.get('deployments', `deployment:${name}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', deployment: entry.id };
  },

  async listRuntimes(input, storage) {
    const deploymentId = input.deployment as string;

    const all = await storage.find('deployments');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return { variant: 'ok', runtimes: '[]' };
    }

    return { variant: 'ok', runtimes: entry.runtimes as string || '[]' };
  },

  async findConceptRuntime(input, storage) {
    const deploymentId = input.deployment as string;
    const concept = input.concept as string;

    const all = await storage.find('deployments');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return { variant: 'notAssigned', concept };
    }

    const assignments = JSON.parse(entry.conceptAssignments as string || '[]');
    const assignment = assignments.find((a: { concept: string }) => a.concept === concept);
    if (!assignment) {
      return { variant: 'notAssigned', concept };
    }

    return {
      variant: 'ok',
      runtime: assignment.runtime || '',
      transport: assignment.transport || '',
      storage: assignment.storage || '',
    };
  },

  async findSyncEngine(input, storage) {
    const deploymentId = input.deployment as string;
    const sync = input.sync as string;

    const all = await storage.find('deployments');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return { variant: 'notAssigned', sync };
    }

    const assignments = JSON.parse(entry.syncEngineAssignments as string || '[]');
    const assignment = assignments.find((a: { sync: string }) => a.sync === sync);
    if (!assignment) {
      return { variant: 'notAssigned', sync };
    }

    return {
      variant: 'ok',
      engine: assignment.engine || '',
      runtime: assignment.runtime || '',
    };
  },

  async topology(input, storage) {
    const deploymentId = input.deployment as string;

    const all = await storage.find('deployments');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return { variant: 'ok', graph: JSON.stringify({ nodes: [], edges: [] }) };
    }

    const runtimes = JSON.parse(entry.runtimes as string || '[]');
    const transportBindings = JSON.parse(entry.transportBindings as string || '[]');

    const nodes = runtimes.map((r: { name: string; type?: string }) => ({
      id: r.name,
      kind: 'runtime',
      label: r.name,
    }));

    const edges = transportBindings.map((t: { from: string; to: string; transport?: string }) => ({
      from: t.from,
      to: t.to,
      transport: t.transport || 'unknown',
    }));

    return { variant: 'ok', graph: JSON.stringify({ nodes, edges }) };
  },

  async transportRoutes(input, storage) {
    const deploymentId = input.deployment as string;
    const fromConcept = input.fromConcept as string;
    const toConcept = input.toConcept as string;

    const all = await storage.find('deployments');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return { variant: 'noRoute' };
    }

    const assignments = JSON.parse(entry.conceptAssignments as string || '[]');
    const fromAssignment = assignments.find((a: { concept: string }) => a.concept === fromConcept);
    const toAssignment = assignments.find((a: { concept: string }) => a.concept === toConcept);

    if (!fromAssignment || !toAssignment) {
      return { variant: 'noRoute' };
    }

    if (fromAssignment.runtime === toAssignment.runtime) {
      return { variant: 'sameRuntime' };
    }

    const transportBindings = JSON.parse(entry.transportBindings as string || '[]');
    const route = transportBindings.find(
      (t: { from: string; to: string }) =>
        t.from === fromAssignment.runtime && t.to === toAssignment.runtime
    );

    if (!route) {
      return { variant: 'noRoute' };
    }

    return {
      variant: 'ok',
      routes: JSON.stringify([{
        hop: 1,
        runtime: toAssignment.runtime,
        transport: route.transport || 'unknown',
        latencyEstimate: route.latencyEstimate || null,
      }]),
    };
  },

  async storageTopology(input, storage) {
    const deploymentId = input.deployment as string;

    const all = await storage.find('deployments');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return { variant: 'ok', bindings: '[]' };
    }

    return { variant: 'ok', bindings: entry.storageBindings as string || '[]' };
  },

  async environmentDiff(input, storage) {
    const deploymentAId = input.deploymentA as string;
    const deploymentBId = input.deploymentB as string;

    const all = await storage.find('deployments');
    const entryA = all.find(d => d.id === deploymentAId);
    const entryB = all.find(d => d.id === deploymentBId);

    if (!entryA || !entryB) {
      return { variant: 'same' };
    }

    const overlaysA = JSON.parse(entryA.environmentOverlays as string || '[]');
    const overlaysB = JSON.parse(entryB.environmentOverlays as string || '[]');

    // TODO: Deep diff environment overlays
    const differences: Array<{ path: string; aValue: unknown; bValue: unknown }> = [];

    if (differences.length === 0) {
      return { variant: 'same' };
    }

    return { variant: 'ok', differences: JSON.stringify(differences) };
  },

  async validateAgainstSpecs(input, storage) {
    const deploymentId = input.deployment as string;

    const all = await storage.find('deployments');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return { variant: 'ok', valid: JSON.stringify({ valid: true }) };
    }

    // TODO: Cross-reference ConceptEntities and SyncEntities
    return { variant: 'ok', valid: JSON.stringify({ valid: true, checkedAt: new Date().toISOString() }) };
  },
};
