// @migrated dsl-constructs 2026-03-18
// DeploymentEntity Concept Implementation
//
// Queryable representation of parsed deployment manifests (deploy.yaml).
// Covers runtime topology, concept-to-runtime assignments, storage and
// transport adapter bindings, sync engine configurations, and environment
// overlays. Enables deployment structure queries and topology analysis.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;
    const source = input.source as string;
    const manifest = input.manifest as string;

    const key = `deployment:${name}`;
    p = get(p, 'deployments', key, 'existing');
    if (existing) {
      return complete(p, 'alreadyRegistered', { existing: existing.id }) as StorageProgram<Result>;
    }

    const id = crypto.randomUUID();
    const parsed = manifest ? JSON.parse(manifest) : {};

    p = put(p, 'deployments', key, {
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

    return complete(p, 'ok', { deployment: id }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;

    p = get(p, 'deployments', `deployment:${name}`, 'entry');
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { deployment: entry.id }) as StorageProgram<Result>;
  },

  listRuntimes(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentId = input.deployment as string;

    p = find(p, 'deployments', 'all');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return complete(p, 'ok', { runtimes: '[]' }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { runtimes: entry.runtimes as string || '[]' }) as StorageProgram<Result>;
  },

  findConceptRuntime(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentId = input.deployment as string;
    const concept = input.concept as string;

    p = find(p, 'deployments', 'all');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return complete(p, 'notAssigned', { concept }) as StorageProgram<Result>;
    }

    const assignments = JSON.parse(entry.conceptAssignments as string || '[]');
    const assignment = assignments.find((a: { concept: string }) => a.concept === concept);
    if (!assignment) {
      return complete(p, 'notAssigned', { concept }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', {
      runtime: assignment.runtime || '',
      transport: assignment.transport || '',
      storage: assignment.storage || '',
    }) as StorageProgram<Result>;
  },

  findSyncEngine(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentId = input.deployment as string;
    const sync = input.sync as string;

    p = find(p, 'deployments', 'all');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return complete(p, 'notAssigned', { sync }) as StorageProgram<Result>;
    }

    const assignments = JSON.parse(entry.syncEngineAssignments as string || '[]');
    const assignment = assignments.find((a: { sync: string }) => a.sync === sync);
    if (!assignment) {
      return complete(p, 'notAssigned', { sync }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', {
      engine: assignment.engine || '',
      runtime: assignment.runtime || '',
    }) as StorageProgram<Result>;
  },

  topology(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentId = input.deployment as string;

    p = find(p, 'deployments', 'all');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return complete(p, 'ok', { graph: JSON.stringify({ nodes: [], edges: [] }) }) as StorageProgram<Result>;
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

    return complete(p, 'ok', { graph: JSON.stringify({ nodes, edges }) }) as StorageProgram<Result>;
  },

  transportRoutes(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentId = input.deployment as string;
    const fromConcept = input.fromConcept as string;
    const toConcept = input.toConcept as string;

    p = find(p, 'deployments', 'all');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return complete(p, 'noRoute', {}) as StorageProgram<Result>;
    }

    const assignments = JSON.parse(entry.conceptAssignments as string || '[]');
    const fromAssignment = assignments.find((a: { concept: string }) => a.concept === fromConcept);
    const toAssignment = assignments.find((a: { concept: string }) => a.concept === toConcept);

    if (!fromAssignment || !toAssignment) {
      return complete(p, 'noRoute', {}) as StorageProgram<Result>;
    }

    if (fromAssignment.runtime === toAssignment.runtime) {
      return complete(p, 'sameRuntime', {}) as StorageProgram<Result>;
    }

    const transportBindings = JSON.parse(entry.transportBindings as string || '[]');
    const route = transportBindings.find(
      (t: { from: string; to: string }) =>
        t.from === fromAssignment.runtime && t.to === toAssignment.runtime
    );

    if (!route) {
      return complete(p, 'noRoute', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', {
      routes: JSON.stringify([{
        hop: 1,
        runtime: toAssignment.runtime,
        transport: route.transport || 'unknown',
        latencyEstimate: route.latencyEstimate || null,
      }]),
    }) as StorageProgram<Result>;
  },

  storageTopology(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentId = input.deployment as string;

    p = find(p, 'deployments', 'all');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return complete(p, 'ok', { bindings: '[]' }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { bindings: entry.storageBindings as string || '[]' }) as StorageProgram<Result>;
  },

  environmentDiff(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentAId = input.deploymentA as string;
    const deploymentBId = input.deploymentB as string;

    p = find(p, 'deployments', 'all');
    const entryA = all.find(d => d.id === deploymentAId);
    const entryB = all.find(d => d.id === deploymentBId);

    if (!entryA || !entryB) {
      return complete(p, 'same', {}) as StorageProgram<Result>;
    }

    const overlaysA = JSON.parse(entryA.environmentOverlays as string || '[]');
    const overlaysB = JSON.parse(entryB.environmentOverlays as string || '[]');

    // TODO: Deep diff environment overlays
    const differences: Array<{ path: string; aValue: unknown; bValue: unknown }> = [];

    if (differences.length === 0) {
      return complete(p, 'same', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { differences: JSON.stringify(differences) }) as StorageProgram<Result>;
  },

  validateAgainstSpecs(input: Record<string, unknown>) {
    let p = createProgram();
    const deploymentId = input.deployment as string;

    p = find(p, 'deployments', 'all');
    const entry = all.find(d => d.id === deploymentId);
    if (!entry) {
      return complete(p, 'ok', { valid: JSON.stringify({ valid: true }) }) as StorageProgram<Result>;
    }

    // TODO: Cross-reference ConceptEntities and SyncEntities
    return complete(p, 'ok', { valid: JSON.stringify({ valid: true, checkedAt: new Date().toISOString() }) }) as StorageProgram<Result>;
  },
};

export const deploymentEntityHandler = autoInterpret(_handler);
