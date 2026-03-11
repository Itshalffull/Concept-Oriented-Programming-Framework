// ============================================================
// DeploymentEntity Handler Tests
//
// Tests for deployment registration, retrieval, runtime listing,
// concept-to-runtime mapping, sync engine lookup, topology graph,
// transport routes, storage topology, environment diff, and
// spec validation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { deploymentEntityHandler } from '../handlers/ts/score/deployment-entity.handler.js';

describe('DeploymentEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const sampleManifest = JSON.stringify({
    app: { name: 'myapp', version: '1.0.0' },
    runtimes: [
      { name: 'api', type: 'node' },
      { name: 'worker', type: 'node' },
    ],
    conceptAssignments: [
      { concept: 'Todo', runtime: 'api', transport: 'http', storage: 'postgres' },
      { concept: 'Notification', runtime: 'worker', transport: 'redis', storage: 'postgres' },
    ],
    syncEngineAssignments: [
      { sync: 'onTodoCreate', engine: 'local', runtime: 'api' },
    ],
    storageBindings: [
      { adapter: 'postgres-main', runtime: 'api', backend: 'postgres' },
    ],
    transportBindings: [
      { from: 'api', to: 'worker', transport: 'redis', latencyEstimate: '5ms' },
    ],
    environmentOverlays: [
      { env: 'production', overrides: { DB_POOL: 20 } },
    ],
  });

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new deployment', async () => {
      const result = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.deployment).toBeDefined();
    });

    it('returns alreadyRegistered for duplicate name', async () => {
      await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy2.yaml', manifest: sampleManifest },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });
  });

  describe('get', () => {
    it('retrieves by name', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.get({ name: 'prod' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.deployment).toBe(reg.deployment);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await deploymentEntityHandler.get({ name: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('listRuntimes', () => {
    it('returns runtimes from deployment', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.listRuntimes(
        { deployment: reg.deployment },
        storage,
      );
      expect(result.variant).toBe('ok');
      const runtimes = JSON.parse(result.runtimes as string);
      expect(runtimes).toHaveLength(2);
      expect(runtimes[0].name).toBe('api');
    });

    it('returns empty for nonexistent deployment', async () => {
      const result = await deploymentEntityHandler.listRuntimes(
        { deployment: 'bad-id' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.runtimes).toBe('[]');
    });
  });

  describe('findConceptRuntime', () => {
    it('finds runtime for an assigned concept', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.findConceptRuntime(
        { deployment: reg.deployment, concept: 'Todo' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.runtime).toBe('api');
      expect(result.transport).toBe('http');
    });

    it('returns notAssigned for unassigned concept', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.findConceptRuntime(
        { deployment: reg.deployment, concept: 'Unknown' },
        storage,
      );
      expect(result.variant).toBe('notAssigned');
    });
  });

  describe('findSyncEngine', () => {
    it('finds engine for an assigned sync', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.findSyncEngine(
        { deployment: reg.deployment, sync: 'onTodoCreate' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.engine).toBe('local');
    });

    it('returns notAssigned for unassigned sync', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.findSyncEngine(
        { deployment: reg.deployment, sync: 'unknown' },
        storage,
      );
      expect(result.variant).toBe('notAssigned');
    });
  });

  describe('topology', () => {
    it('returns a graph with runtime nodes and transport edges', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.topology(
        { deployment: reg.deployment },
        storage,
      );
      expect(result.variant).toBe('ok');
      const graph = JSON.parse(result.graph as string);
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].transport).toBe('redis');
    });
  });

  describe('transportRoutes', () => {
    it('finds route between concepts on different runtimes', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.transportRoutes(
        { deployment: reg.deployment, fromConcept: 'Todo', toConcept: 'Notification' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const routes = JSON.parse(result.routes as string);
      expect(routes).toHaveLength(1);
      expect(routes[0].transport).toBe('redis');
    });

    it('returns sameRuntime for concepts on the same runtime', async () => {
      const manifest = JSON.stringify({
        runtimes: [{ name: 'api' }],
        conceptAssignments: [
          { concept: 'Todo', runtime: 'api' },
          { concept: 'Tag', runtime: 'api' },
        ],
        transportBindings: [],
      });
      const reg = await deploymentEntityHandler.register(
        { name: 'local', source: 'deploy.yaml', manifest },
        storage,
      );
      const result = await deploymentEntityHandler.transportRoutes(
        { deployment: reg.deployment, fromConcept: 'Todo', toConcept: 'Tag' },
        storage,
      );
      expect(result.variant).toBe('sameRuntime');
    });

    it('returns noRoute when no transport binding exists', async () => {
      const manifest = JSON.stringify({
        runtimes: [{ name: 'api' }, { name: 'worker' }],
        conceptAssignments: [
          { concept: 'Todo', runtime: 'api' },
          { concept: 'Notification', runtime: 'worker' },
        ],
        transportBindings: [],
      });
      const reg = await deploymentEntityHandler.register(
        { name: 'broken', source: 'deploy.yaml', manifest },
        storage,
      );
      const result = await deploymentEntityHandler.transportRoutes(
        { deployment: reg.deployment, fromConcept: 'Todo', toConcept: 'Notification' },
        storage,
      );
      expect(result.variant).toBe('noRoute');
    });
  });

  describe('storageTopology', () => {
    it('returns storage bindings', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.storageTopology(
        { deployment: reg.deployment },
        storage,
      );
      expect(result.variant).toBe('ok');
      const bindings = JSON.parse(result.bindings as string);
      expect(bindings).toHaveLength(1);
    });
  });

  describe('environmentDiff', () => {
    it('returns same when deployments have identical overlays (stub)', async () => {
      const regA = await deploymentEntityHandler.register(
        { name: 'staging', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const regB = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy-prod.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.environmentDiff(
        { deploymentA: regA.deployment, deploymentB: regB.deployment },
        storage,
      );
      expect(result.variant).toBe('same');
    });
  });

  describe('validateAgainstSpecs', () => {
    it('returns valid (stub)', async () => {
      const reg = await deploymentEntityHandler.register(
        { name: 'prod', source: 'deploy.yaml', manifest: sampleManifest },
        storage,
      );
      const result = await deploymentEntityHandler.validateAgainstSpecs(
        { deployment: reg.deployment },
        storage,
      );
      expect(result.variant).toBe('ok');
      const valid = JSON.parse(result.valid as string);
      expect(valid.valid).toBe(true);
    });
  });
});
