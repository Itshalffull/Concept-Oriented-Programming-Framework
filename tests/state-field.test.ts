// ============================================================
// StateField Handler Tests
//
// Tests for state-field: registration with cardinality inference,
// retrieval, concept queries, provenance tracing, and storage
// mapping lookup.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  stateFieldHandler,
  resetStateFieldCounter,
} from '../handlers/ts/state-field.handler.js';

describe('StateField Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetStateFieldCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a scalar field', async () => {
      const result = await stateFieldHandler.register(
        { concept: 'Todo', name: 'title', typeExpr: 'String' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.field).toBe('state-field-1');
    });

    it('infers cardinality for set types', async () => {
      await stateFieldHandler.register(
        { concept: 'Todo', name: 'tags', typeExpr: 'set String' },
        storage,
      );
      const record = await storage.get('state-field', 'state-field-1');
      expect(record!.cardinality).toBe('set');
    });

    it('infers cardinality for list types', async () => {
      await stateFieldHandler.register(
        { concept: 'Todo', name: 'items', typeExpr: 'list TodoItem' },
        storage,
      );
      const record = await storage.get('state-field', 'state-field-1');
      expect(record!.cardinality).toBe('list');
    });

    it('infers cardinality for mapping types', async () => {
      await stateFieldHandler.register(
        { concept: 'Todo', name: 'assignments', typeExpr: 'UserId -> TodoItem' },
        storage,
      );
      const record = await storage.get('state-field', 'state-field-1');
      expect(record!.cardinality).toBe('mapping');
    });

    it('infers cardinality for option types (prefix)', async () => {
      await stateFieldHandler.register(
        { concept: 'Todo', name: 'dueDate', typeExpr: 'option DateTime' },
        storage,
      );
      const record = await storage.get('state-field', 'state-field-1');
      expect(record!.cardinality).toBe('option');
    });

    it('infers cardinality for option types (suffix ?)', async () => {
      await stateFieldHandler.register(
        { concept: 'Todo', name: 'dueDate', typeExpr: 'DateTime?' },
        storage,
      );
      const record = await storage.get('state-field', 'state-field-1');
      expect(record!.cardinality).toBe('option');
    });

    it('infers scalar for simple types', async () => {
      await stateFieldHandler.register(
        { concept: 'Todo', name: 'count', typeExpr: 'Int' },
        storage,
      );
      const record = await storage.get('state-field', 'state-field-1');
      expect(record!.cardinality).toBe('scalar');
    });

    it('stores the correct symbol', async () => {
      await stateFieldHandler.register(
        { concept: 'Todo', name: 'title', typeExpr: 'String' },
        storage,
      );
      const record = await storage.get('state-field', 'state-field-1');
      expect(record!.symbol).toBe('clef/field/Todo/title');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the field details after registration', async () => {
      const reg = await stateFieldHandler.register(
        { concept: 'Todo', name: 'title', typeExpr: 'String' },
        storage,
      );
      const result = await stateFieldHandler.get({ field: reg.field }, storage);
      expect(result.variant).toBe('ok');
      expect(result.concept).toBe('Todo');
      expect(result.name).toBe('title');
      expect(result.typeExpr).toBe('String');
      expect(result.cardinality).toBe('scalar');
    });

    it('returns notfound for nonexistent field', async () => {
      const result = await stateFieldHandler.get({ field: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByConcept
  // ----------------------------------------------------------

  describe('findByConcept', () => {
    it('returns fields filtered by concept', async () => {
      await stateFieldHandler.register({ concept: 'Todo', name: 'title', typeExpr: 'String' }, storage);
      await stateFieldHandler.register({ concept: 'Todo', name: 'done', typeExpr: 'Boolean' }, storage);
      await stateFieldHandler.register({ concept: 'User', name: 'email', typeExpr: 'String' }, storage);

      const result = await stateFieldHandler.findByConcept({ concept: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      const fields = JSON.parse(result.fields as string);
      expect(fields).toHaveLength(2);
      expect(fields.every((f: Record<string, unknown>) => f.concept === 'Todo')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // traceToGenerated
  // ----------------------------------------------------------

  describe('traceToGenerated', () => {
    it('returns provenance targets for the field symbol', async () => {
      const reg = await stateFieldHandler.register(
        { concept: 'Todo', name: 'title', typeExpr: 'String' },
        storage,
      );

      await storage.put('provenance', 'prov-1', {
        id: 'prov-1',
        sourceSymbol: 'clef/field/Todo/title',
        targetSymbol: 'Todo.title',
        language: 'typescript',
        targetFile: 'generated/Todo.ts',
      });

      const result = await stateFieldHandler.traceToGenerated({ field: reg.field }, storage);
      expect(result.variant).toBe('ok');
      const targets = JSON.parse(result.targets as string);
      expect(targets).toHaveLength(1);
      expect(targets[0].language).toBe('typescript');
      expect(targets[0].file).toBe('generated/Todo.ts');
    });

    it('returns empty for nonexistent field', async () => {
      const result = await stateFieldHandler.traceToGenerated({ field: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.targets).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // traceToStorage
  // ----------------------------------------------------------

  describe('traceToStorage', () => {
    it('returns storage mappings for the field symbol', async () => {
      const reg = await stateFieldHandler.register(
        { concept: 'Todo', name: 'title', typeExpr: 'String' },
        storage,
      );

      await storage.put('storage-mapping', 'sm-1', {
        id: 'sm-1',
        fieldSymbol: 'clef/field/Todo/title',
        adapter: 'postgres',
        columnOrKey: 'todo_title',
      });

      const result = await stateFieldHandler.traceToStorage({ field: reg.field }, storage);
      expect(result.variant).toBe('ok');
      const targets = JSON.parse(result.targets as string);
      expect(targets).toHaveLength(1);
      expect(targets[0].adapter).toBe('postgres');
      expect(targets[0].columnOrKey).toBe('todo_title');
    });

    it('returns empty for nonexistent field', async () => {
      const result = await stateFieldHandler.traceToStorage({ field: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.targets).toBe('[]');
    });
  });
});
