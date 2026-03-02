// SelectionPipelineDependenceProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { selectionPipelineDependenceProviderHandler } from './handler.js';
import type { SelectionPipelineDependenceProviderStorage } from './types.js';

const createTestStorage = (): SelectionPipelineDependenceProviderStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): SelectionPipelineDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = selectionPipelineDependenceProviderHandler;

describe('SelectionPipelineDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should return ok with instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('spdp-');
        }
      }
    });

    it('should return loadError on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('registerPipeline', () => {
    it('should register a pipeline with stages and compute dependencies', async () => {
      const storage = createTestStorage();
      const result = await handler.registerPipeline({
        pipelineId: 'pipe-1',
        stages: [
          { kind: 'source', fieldRefs: ['users'] },
          { kind: 'filter', fieldRefs: ['users'] },
          { kind: 'map', fieldRefs: ['name'] },
        ],
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.stageCount).toBe(3);
        expect(result.right.depCount).toBeGreaterThan(0);
      }
    });

    it('should create sequential dependencies between consecutive stages', async () => {
      const storage = createTestStorage();
      await handler.registerPipeline({
        pipelineId: 'pipe-2',
        stages: [
          { kind: 'source', fieldRefs: [] },
          { kind: 'filter', fieldRefs: [] },
        ],
      }, storage)();
      const depsResult = await handler.getStageDependencies(
        { stageId: 'pipe-2-stage-1' },
        storage,
      )();
      expect(E.isRight(depsResult)).toBe(true);
      if (E.isRight(depsResult)) {
        expect(depsResult.right.dependencies.length).toBeGreaterThanOrEqual(1);
        const seq = depsResult.right.dependencies.find(d => d.through === 'sequential');
        expect(seq).toBeDefined();
        expect(seq?.dependsOn).toBe('pipe-2-stage-0');
      }
    });

    it('should create field-level dependencies when stages share field refs', async () => {
      const storage = createTestStorage();
      await handler.registerPipeline({
        pipelineId: 'pipe-3',
        stages: [
          { kind: 'source', fieldRefs: ['price'] },
          { kind: 'map', fieldRefs: ['quantity'] },
          { kind: 'reduce', fieldRefs: ['price'] },
        ],
      }, storage)();
      const depsResult = await handler.getStageDependencies(
        { stageId: 'pipe-3-stage-2' },
        storage,
      )();
      expect(E.isRight(depsResult)).toBe(true);
      if (E.isRight(depsResult)) {
        const fieldDep = depsResult.right.dependencies.find(d => d.through === 'price');
        expect(fieldDep).toBeDefined();
        expect(fieldDep?.dependsOn).toBe('pipe-3-stage-0');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerPipeline({
        pipelineId: 'pipe-fail',
        stages: [{ kind: 'source', fieldRefs: [] }],
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getStageDependencies', () => {
    it('should return empty dependencies for unknown stage', async () => {
      const storage = createTestStorage();
      const result = await handler.getStageDependencies(
        { stageId: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies).toEqual([]);
      }
    });
  });

  describe('traceToSources', () => {
    it('should trace back to source stages through the dependency graph', async () => {
      const storage = createTestStorage();
      await handler.registerPipeline({
        pipelineId: 'trace-pipe',
        stages: [
          { kind: 'source', fieldRefs: ['data'] },
          { kind: 'filter', fieldRefs: ['data'] },
          { kind: 'map', fieldRefs: ['data'] },
        ],
      }, storage)();
      const result = await handler.traceToSources(
        { stageId: 'trace-pipe-stage-2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.sources).toContain('trace-pipe-stage-0');
      }
    });
  });

  describe('getImpactedStages', () => {
    it('should find downstream impacted stages', async () => {
      const storage = createTestStorage();
      await handler.registerPipeline({
        pipelineId: 'impact-pipe',
        stages: [
          { kind: 'source', fieldRefs: [] },
          { kind: 'filter', fieldRefs: [] },
          { kind: 'map', fieldRefs: [] },
        ],
      }, storage)();
      const result = await handler.getImpactedStages(
        { stageId: 'impact-pipe-stage-0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.impacted).toContain('impact-pipe-stage-1');
        expect(result.right.impacted).toContain('impact-pipe-stage-2');
      }
    });

    it('should return empty for terminal stage', async () => {
      const storage = createTestStorage();
      await handler.registerPipeline({
        pipelineId: 'terminal-pipe',
        stages: [
          { kind: 'source', fieldRefs: [] },
          { kind: 'map', fieldRefs: [] },
        ],
      }, storage)();
      const result = await handler.getImpactedStages(
        { stageId: 'terminal-pipe-stage-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.impacted).toEqual([]);
      }
    });
  });
});
