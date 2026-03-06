// ============================================================
// SuiteManifestEntity Handler Tests
//
// Tests for suite registration, retrieval, listing, concept/sync
// queries, dependency graph, transitive dependencies, dependency
// validation, and cross-suite conflict detection.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { suiteManifestEntityHandler } from '../handlers/ts/score/suite-manifest-entity.handler.js';

describe('SuiteManifestEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  const coreSuiteManifest = JSON.stringify({
    version: '1.0.0',
    description: 'Core suite',
    concepts: ['Todo', 'User'],
    syncs: ['onTodoCreate'],
    dependencies: [],
  });

  const collabSuiteManifest = JSON.stringify({
    version: '2.0.0',
    description: 'Collaboration suite',
    concepts: ['Comment', 'Share'],
    syncs: ['onComment'],
    dependencies: [{ name: 'core', version: '^1.0.0' }],
  });

  describe('register', () => {
    it('registers a new suite', async () => {
      const result = await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.suite).toBeDefined();
    });

    it('returns alreadyRegistered for duplicate name', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite2.yaml', manifest: coreSuiteManifest },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });
  });

  describe('get', () => {
    it('retrieves by name', async () => {
      const reg = await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.get({ name: 'core' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.suite).toBe(reg.suite);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await suiteManifestEntityHandler.get({ name: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('listAll', () => {
    it('lists all registered suites with counts', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      await suiteManifestEntityHandler.register(
        { name: 'collab', source: 'suites/collab/suite.yaml', manifest: collabSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.listAll({}, storage);
      expect(result.variant).toBe('ok');
      const suites = JSON.parse(result.suites as string);
      expect(suites).toHaveLength(2);
      expect(suites[0].conceptCount).toBe(2);
      expect(suites[0].syncCount).toBe(1);
    });
  });

  describe('findByConcept', () => {
    it('finds suites containing a concept', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      await suiteManifestEntityHandler.register(
        { name: 'collab', source: 'suites/collab/suite.yaml', manifest: collabSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.findByConcept(
        { concept: 'Todo' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const suites = JSON.parse(result.suites as string);
      expect(suites).toHaveLength(1);
    });
  });

  describe('findBySync', () => {
    it('finds suites containing a sync', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.findBySync(
        { sync: 'onTodoCreate' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const suites = JSON.parse(result.suites as string);
      expect(suites).toHaveLength(1);
    });
  });

  describe('concepts', () => {
    it('returns concepts for a suite', async () => {
      const reg = await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.concepts(
        { suite: reg.suite },
        storage,
      );
      expect(result.variant).toBe('ok');
      const concepts = JSON.parse(result.concepts as string);
      expect(concepts).toContain('Todo');
      expect(concepts).toContain('User');
    });

    it('returns empty for nonexistent suite', async () => {
      const result = await suiteManifestEntityHandler.concepts(
        { suite: 'bad-id' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.concepts).toBe('[]');
    });
  });

  describe('syncs', () => {
    it('returns syncs for a suite', async () => {
      const reg = await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.syncs(
        { suite: reg.suite },
        storage,
      );
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toContain('onTodoCreate');
    });
  });

  describe('dependencyGraph', () => {
    it('builds a graph of suite dependencies', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suites/core/suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      await suiteManifestEntityHandler.register(
        { name: 'collab', source: 'suites/collab/suite.yaml', manifest: collabSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.dependencyGraph({}, storage);
      expect(result.variant).toBe('ok');
      const graph = JSON.parse(result.graph as string);
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].from).toBe('collab');
      expect(graph.edges[0].to).toBe('core');
    });
  });

  describe('transitiveDependencies', () => {
    it('resolves transitive dependency chain', async () => {
      const baseSuite = JSON.stringify({ version: '0.1.0', concepts: [], syncs: [], dependencies: [] });
      const midSuite = JSON.stringify({
        version: '1.0.0', concepts: [], syncs: [],
        dependencies: [{ name: 'base', version: '^0.1.0' }],
      });
      const topSuite = JSON.stringify({
        version: '2.0.0', concepts: [], syncs: [],
        dependencies: [{ name: 'mid', version: '^1.0.0' }],
      });

      await suiteManifestEntityHandler.register(
        { name: 'base', source: 'suite.yaml', manifest: baseSuite },
        storage,
      );
      await suiteManifestEntityHandler.register(
        { name: 'mid', source: 'suite.yaml', manifest: midSuite },
        storage,
      );
      const reg = await suiteManifestEntityHandler.register(
        { name: 'top', source: 'suite.yaml', manifest: topSuite },
        storage,
      );

      const result = await suiteManifestEntityHandler.transitiveDependencies(
        { suite: reg.suite },
        storage,
      );
      expect(result.variant).toBe('ok');
      const deps = JSON.parse(result.dependencies as string);
      expect(deps).toHaveLength(2);
      expect(deps[0].name).toBe('mid');
      expect(deps[0].depth).toBe(1);
      expect(deps[1].name).toBe('base');
      expect(deps[1].depth).toBe(2);
    });
  });

  describe('validateDependencies', () => {
    it('returns valid when all dependencies are registered', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      const reg = await suiteManifestEntityHandler.register(
        { name: 'collab', source: 'suite.yaml', manifest: collabSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.validateDependencies(
        { suite: reg.suite },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns invalid when dependencies are missing', async () => {
      const reg = await suiteManifestEntityHandler.register(
        { name: 'collab', source: 'suite.yaml', manifest: collabSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.validateDependencies(
        { suite: reg.suite },
        storage,
      );
      expect(result.variant).toBe('invalid');
      const errors = JSON.parse(result.errors as string);
      expect(errors).toHaveLength(1);
      expect(errors[0].dependency).toBe('core');
    });
  });

  describe('crossSuiteConflicts', () => {
    it('detects duplicate concepts across suites', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      const overlapping = JSON.stringify({
        version: '1.0.0', concepts: ['Todo', 'Project'], syncs: [], dependencies: [],
      });
      await suiteManifestEntityHandler.register(
        { name: 'project', source: 'suite.yaml', manifest: overlapping },
        storage,
      );
      const result = await suiteManifestEntityHandler.crossSuiteConflicts({}, storage);
      expect(result.variant).toBe('conflicts');
      const issues = JSON.parse(result.issues as string);
      expect(issues).toHaveLength(1);
      expect(issues[0].entity).toBe('Todo');
    });

    it('returns ok when no conflicts exist', async () => {
      await suiteManifestEntityHandler.register(
        { name: 'core', source: 'suite.yaml', manifest: coreSuiteManifest },
        storage,
      );
      await suiteManifestEntityHandler.register(
        { name: 'collab', source: 'suite.yaml', manifest: collabSuiteManifest },
        storage,
      );
      const result = await suiteManifestEntityHandler.crossSuiteConflicts({}, storage);
      expect(result.variant).toBe('ok');
    });
  });
});
