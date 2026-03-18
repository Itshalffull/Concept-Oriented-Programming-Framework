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
    const name = input.name as string;
    const source = input.source as string;
    const manifest = input.manifest as string;

    const key = `deployment:${name}`;

    let p = createProgram();
    p = get(p, 'deployments', key, 'existing');

    return branch(p, 'existing',
      (thenP) => completeFrom(thenP, 'alreadyRegistered', (bindings) => ({
        existing: (bindings.existing as Record<string, unknown>).id,
      })),
      (elseP) => {
        const id = crypto.randomUUID();
        const parsed = manifest ? JSON.parse(manifest) : {};

        elseP = put(elseP, 'deployments', key, {
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

        return complete(elseP, 'ok', { deployment: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'deployments', `deployment:${name}`, 'entry');

    return branch(p, 'entry',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => ({
        deployment: (bindings.entry as Record<string, unknown>).id,
      })),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },

  listRuntimes(input: Record<string, unknown>) {
    const deploymentId = input.deployment as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entry = all.find((d) => d.id === deploymentId);
      if (!entry) {
        return { runtimes: '[]' };
      }
      return { runtimes: entry.runtimes as string || '[]' };
    }) as StorageProgram<Result>;
  },

  findConceptRuntime(input: Record<string, unknown>) {
    const deploymentId = input.deployment as string;
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entry = all.find((d) => d.id === deploymentId);
      if (!entry) {
        return { variant: 'notAssigned', concept };
      }

      const assignments = JSON.parse(entry.conceptAssignments as string || '[]');
      const assignment = assignments.find((a: { concept: string }) => a.concept === concept);
      if (!assignment) {
        return { variant: 'notAssigned', concept };
      }

      return {
        runtime: assignment.runtime || '',
        transport: assignment.transport || '',
        storage: assignment.storage || '',
      };
    }) as StorageProgram<Result>;
  },

  findSyncEngine(input: Record<string, unknown>) {
    const deploymentId = input.deployment as string;
    const sync = input.sync as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entry = all.find((d) => d.id === deploymentId);
      if (!entry) {
        return { variant: 'notAssigned', sync };
      }

      const assignments = JSON.parse(entry.syncEngineAssignments as string || '[]');
      const assignment = assignments.find((a: { sync: string }) => a.sync === sync);
      if (!assignment) {
        return { variant: 'notAssigned', sync };
      }

      return {
        engine: assignment.engine || '',
        runtime: assignment.runtime || '',
      };
    }) as StorageProgram<Result>;
  },

  topology(input: Record<string, unknown>) {
    const deploymentId = input.deployment as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entry = all.find((d) => d.id === deploymentId);
      if (!entry) {
        return { graph: JSON.stringify({ nodes: [], edges: [] }) };
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

      return { graph: JSON.stringify({ nodes, edges }) };
    }) as StorageProgram<Result>;
  },

  transportRoutes(input: Record<string, unknown>) {
    const deploymentId = input.deployment as string;
    const fromConcept = input.fromConcept as string;
    const toConcept = input.toConcept as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entry = all.find((d) => d.id === deploymentId);
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
          t.from === fromAssignment.runtime && t.to === toAssignment.runtime,
      );

      if (!route) {
        return { variant: 'noRoute' };
      }

      return {
        routes: JSON.stringify([{
          hop: 1,
          runtime: toAssignment.runtime,
          transport: route.transport || 'unknown',
          latencyEstimate: route.latencyEstimate || null,
        }]),
      };
    }) as StorageProgram<Result>;
  },

  storageTopology(input: Record<string, unknown>) {
    const deploymentId = input.deployment as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entry = all.find((d) => d.id === deploymentId);
      if (!entry) {
        return { bindings: '[]' };
      }
      return { bindings: entry.storageBindings as string || '[]' };
    }) as StorageProgram<Result>;
  },

  environmentDiff(input: Record<string, unknown>) {
    const deploymentAId = input.deploymentA as string;
    const deploymentBId = input.deploymentB as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entryA = all.find((d) => d.id === deploymentAId);
      const entryB = all.find((d) => d.id === deploymentBId);

      if (!entryA || !entryB) {
        return { variant: 'same' };
      }

      // TODO: Deep diff environment overlays
      return { variant: 'same' };
    }) as StorageProgram<Result>;
  },

  validateAgainstSpecs(input: Record<string, unknown>) {
    const deploymentId = input.deployment as string;

    let p = createProgram();
    p = find(p, 'deployments', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const entry = all.find((d) => d.id === deploymentId);
      // TODO: Cross-reference ConceptEntities and SyncEntities
      return { valid: JSON.stringify({ valid: true, checkedAt: new Date().toISOString() }) };
    }) as StorageProgram<Result>;
  },
};

export const deploymentEntityHandler = autoInterpret(_handler);
