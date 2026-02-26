// ============================================================
// ConceptEntity Handler Tests
//
// Tests for concept-entity: registration, duplicate detection,
// get, capability queries, kit queries, generated artifacts,
// participating syncs, and type compatibility checks.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  conceptEntityHandler,
  resetConceptEntityCounter,
} from '../handlers/ts/concept-entity.handler.js';

describe('ConceptEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetConceptEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new concept entity and returns ok', async () => {
      const result = await conceptEntityHandler.register(
        {
          name: 'Todo',
          source: 'concepts/todo.copf',
          ast: JSON.stringify({
            purpose: 'Manage todo items',
            version: 1,
            capabilities: ['persistence', 'notification'],
            typeParams: ['T'],
            actions: [{ name: 'create' }, { name: 'delete' }],
            state: [{ name: 'items' }, { name: 'count' }],
            kit: 'core-kit',
          }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.entity).toBe('concept-entity-1');
    });

    it('extracts metadata from AST correctly', async () => {
      await conceptEntityHandler.register(
        {
          name: 'Todo',
          source: 'concepts/todo.copf',
          ast: JSON.stringify({
            purpose: 'Tasks',
            version: 2,
            annotations: { gate: true },
            capabilities: ['persistence'],
            typeParams: ['T', 'U'],
            actions: [{ name: 'create' }],
            state: [{ name: 'items' }],
            kit: 'todo-kit',
          }),
        },
        storage,
      );
      const record = await storage.get('concept-entity', 'concept-entity-1');
      expect(record!.purposeText).toBe('Tasks');
      expect(record!.version).toBe(2);
      expect(record!.gate).toBe('true');
      expect(JSON.parse(record!.capabilitiesList as string)).toEqual(['persistence']);
      expect(JSON.parse(record!.typeParams as string)).toEqual(['T', 'U']);
      expect(JSON.parse(record!.actionsRef as string)).toEqual(['create']);
      expect(JSON.parse(record!.stateFieldsRef as string)).toEqual(['items']);
      expect(record!.kit).toBe('todo-kit');
    });

    it('returns alreadyRegistered for a duplicate name', async () => {
      const first = await conceptEntityHandler.register(
        { name: 'Todo', source: 'a.copf', ast: '{}' },
        storage,
      );
      const second = await conceptEntityHandler.register(
        { name: 'Todo', source: 'b.copf', ast: '{}' },
        storage,
      );
      expect(second.variant).toBe('alreadyRegistered');
      expect(second.existing).toBe(first.entity);
    });

    it('handles non-JSON AST gracefully', async () => {
      const result = await conceptEntityHandler.register(
        { name: 'Broken', source: 'x.copf', ast: 'not-json' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const record = await storage.get('concept-entity', result.entity as string);
      expect(record!.purposeText).toBe('');
      expect(record!.gate).toBe('false');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the entity by name', async () => {
      const reg = await conceptEntityHandler.register(
        { name: 'Todo', source: 'a.copf', ast: '{}' },
        storage,
      );
      const result = await conceptEntityHandler.get({ name: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.entity).toBe(reg.entity);
    });

    it('returns notfound for unknown name', async () => {
      const result = await conceptEntityHandler.get({ name: 'Nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByCapability
  // ----------------------------------------------------------

  describe('findByCapability', () => {
    it('finds concepts with a given capability', async () => {
      await conceptEntityHandler.register(
        { name: 'Todo', source: 'a.copf', ast: JSON.stringify({ capabilities: ['persistence', 'notification'] }) },
        storage,
      );
      await conceptEntityHandler.register(
        { name: 'User', source: 'b.copf', ast: JSON.stringify({ capabilities: ['auth'] }) },
        storage,
      );

      const result = await conceptEntityHandler.findByCapability({ capability: 'persistence' }, storage);
      expect(result.variant).toBe('ok');
      const entities = JSON.parse(result.entities as string);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Todo');
    });

    it('returns empty for unmatched capability', async () => {
      const result = await conceptEntityHandler.findByCapability({ capability: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.entities as string)).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // findByKit
  // ----------------------------------------------------------

  describe('findByKit', () => {
    it('finds concepts in a given kit', async () => {
      await conceptEntityHandler.register(
        { name: 'Todo', source: 'a.copf', ast: JSON.stringify({ kit: 'core-kit' }) },
        storage,
      );
      await conceptEntityHandler.register(
        { name: 'User', source: 'b.copf', ast: JSON.stringify({ kit: 'auth-kit' }) },
        storage,
      );

      const result = await conceptEntityHandler.findByKit({ kit: 'core-kit' }, storage);
      expect(result.variant).toBe('ok');
      const entities = JSON.parse(result.entities as string);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Todo');
    });
  });

  // ----------------------------------------------------------
  // generatedArtifacts
  // ----------------------------------------------------------

  describe('generatedArtifacts', () => {
    it('returns provenance records for the concept symbol', async () => {
      const reg = await conceptEntityHandler.register(
        { name: 'Todo', source: 'a.copf', ast: '{}' },
        storage,
      );

      await storage.put('provenance', 'prov-1', {
        id: 'prov-1',
        sourceSymbol: 'copf/concept/Todo',
        targetFile: 'generated/Todo.ts',
      });

      const result = await conceptEntityHandler.generatedArtifacts({ entity: reg.entity }, storage);
      expect(result.variant).toBe('ok');
      const artifacts = JSON.parse(result.artifacts as string);
      expect(artifacts).toHaveLength(1);
    });

    it('returns empty for nonexistent entity', async () => {
      const result = await conceptEntityHandler.generatedArtifacts({ entity: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.artifacts).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // participatingSyncs
  // ----------------------------------------------------------

  describe('participatingSyncs', () => {
    it('finds syncs referencing this concept in when or then', async () => {
      const reg = await conceptEntityHandler.register(
        { name: 'Todo', source: 'a.copf', ast: '{}' },
        storage,
      );

      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'onTodoCreate',
        compiled: JSON.stringify({
          when: [{ concept: 'Todo', action: 'create' }],
          then: [{ concept: 'Audit', action: 'log' }],
        }),
      });
      await storage.put('sync-entity', 'sync-2', {
        id: 'sync-2',
        name: 'onUserSignup',
        compiled: JSON.stringify({
          when: [{ concept: 'User', action: 'signup' }],
          then: [{ concept: 'User', action: 'welcome' }],
        }),
      });

      const result = await conceptEntityHandler.participatingSyncs({ entity: reg.entity }, storage);
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
      expect(syncs[0].name).toBe('onTodoCreate');
    });

    it('returns empty for nonexistent entity', async () => {
      const result = await conceptEntityHandler.participatingSyncs({ entity: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.syncs).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // checkCompatibility
  // ----------------------------------------------------------

  describe('checkCompatibility', () => {
    it('returns compatible with shared type params', async () => {
      const a = await conceptEntityHandler.register(
        { name: 'A', source: 'a.copf', ast: JSON.stringify({ typeParams: ['T', 'U'] }) },
        storage,
      );
      const b = await conceptEntityHandler.register(
        { name: 'B', source: 'b.copf', ast: JSON.stringify({ typeParams: ['U', 'V'] }) },
        storage,
      );

      const result = await conceptEntityHandler.checkCompatibility(
        { a: a.entity, b: b.entity },
        storage,
      );
      expect(result.variant).toBe('compatible');
      const shared = JSON.parse(result.sharedTypeParams as string);
      expect(shared).toEqual(['U']);
    });

    it('returns compatible with empty shared params when no conflicts', async () => {
      const a = await conceptEntityHandler.register(
        { name: 'A', source: 'a.copf', ast: JSON.stringify({ typeParams: ['T'], capabilities: ['read'] }) },
        storage,
      );
      const b = await conceptEntityHandler.register(
        { name: 'B', source: 'b.copf', ast: JSON.stringify({ typeParams: ['U'], capabilities: ['write'] }) },
        storage,
      );

      const result = await conceptEntityHandler.checkCompatibility(
        { a: a.entity, b: b.entity },
        storage,
      );
      expect(result.variant).toBe('compatible');
      expect(JSON.parse(result.sharedTypeParams as string)).toEqual([]);
    });

    it('returns incompatible for conflicting exclusive capabilities', async () => {
      const a = await conceptEntityHandler.register(
        { name: 'A', source: 'a.copf', ast: JSON.stringify({ typeParams: [], capabilities: ['exclusive-owner'] }) },
        storage,
      );
      const b = await conceptEntityHandler.register(
        { name: 'B', source: 'b.copf', ast: JSON.stringify({ typeParams: [], capabilities: ['exclusive-owner'] }) },
        storage,
      );

      const result = await conceptEntityHandler.checkCompatibility(
        { a: a.entity, b: b.entity },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('exclusive-owner');
    });

    it('returns incompatible when one entity is missing', async () => {
      const a = await conceptEntityHandler.register(
        { name: 'A', source: 'a.copf', ast: '{}' },
        storage,
      );

      const result = await conceptEntityHandler.checkCompatibility(
        { a: a.entity, b: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect(result.reason).toContain('not found');
    });
  });
});
