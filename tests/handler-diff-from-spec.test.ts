// ============================================================
// HandlerEntity diffFromSpec Tests — Monadic Implementation
//
// Tests for comparing handler implementations against concept
// specs via the StorageProgram DSL. All operations go through
// the interpreter for full traceability.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interpret } from '../runtime/interpreter.js';
import { handlerDiffFromSpecHandler } from '../handlers/ts/score/handler-diff-from-spec.handler.js';

describe('HandlerEntity diffFromSpec (Monadic)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  async function run(program: any) {
    const execResult = await interpret(program, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  // Helper: seed a concept entity in storage
  async function seedConcept(name: string, actions: string[], opts: {
    actionsDetail?: Array<{ name: string; variants?: string[]; params?: string[] }>;
    stateFieldsDetail?: Array<{ name: string; type: string; cardinality: string }>;
  } = {}) {
    await storage.put('concept-entity', `concept:${name}`, {
      id: `concept:${name}`,
      name,
      actionsRef: JSON.stringify(actions),
      actionsDetailRef: JSON.stringify(opts.actionsDetail || []),
      stateFieldsRef: JSON.stringify([]),
      stateFieldsDetailRef: JSON.stringify(opts.stateFieldsDetail || []),
    });
  }

  // Helper: seed a handler entity in storage
  async function seedHandler(concept: string, methods: Array<{ name: string; variants?: string[] }>, opts: {
    collections?: string[];
    stateFieldsDetail?: Array<{ name: string; type: string; cardinality: string }>;
  } = {}) {
    await storage.put('handlers', `handler:${concept}:ts`, {
      id: `handler:${concept}:ts`,
      concept,
      language: 'ts',
      sourceFile: `handlers/ts/${concept.toLowerCase()}.handler.ts`,
      actionMethods: JSON.stringify(methods),
      storageCollections: JSON.stringify(opts.collections || []),
      stateFieldsDetail: JSON.stringify(opts.stateFieldsDetail || []),
    });
  }

  // ----------------------------------------------------------
  // In-sync case
  // ----------------------------------------------------------

  describe('inSync', () => {
    it('reports inSync when handler implements all spec actions', async () => {
      await seedConcept('Todo', ['create', 'complete', 'delete']);
      await seedHandler('Todo', [
        { name: 'create' },
        { name: 'complete' },
        { name: 'delete' },
      ]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Todo',
      }));

      expect(result.variant).toBe('inSync');
      expect(result.actionCount).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // Missing actions
  // ----------------------------------------------------------

  describe('missing actions', () => {
    it('detects actions declared in spec but missing from handler', async () => {
      await seedConcept('Todo', ['create', 'complete', 'delete', 'archive']);
      await seedHandler('Todo', [
        { name: 'create' },
        { name: 'complete' },
      ]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Todo',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const missing = diffs.filter((d: any) => d.kind === 'missing_action');
      expect(missing).toHaveLength(2);
      expect(missing.map((d: any) => d.specValue)).toContain('delete');
      expect(missing.map((d: any) => d.specValue)).toContain('archive');
      expect(result.missing_count).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Extra actions
  // ----------------------------------------------------------

  describe('extra actions', () => {
    it('detects actions in handler not declared in spec', async () => {
      await seedConcept('Todo', ['create', 'complete']);
      await seedHandler('Todo', [
        { name: 'create' },
        { name: 'complete' },
        { name: 'bulkDelete' },
      ]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Todo',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const extra = diffs.filter((d: any) => d.kind === 'extra_action');
      expect(extra).toHaveLength(1);
      expect(extra[0].implValue).toBe('bulkDelete');
      expect(result.extra_count).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Mixed drift
  // ----------------------------------------------------------

  describe('mixed drift', () => {
    it('detects both missing and extra actions', async () => {
      await seedConcept('User', ['create', 'verify', 'deactivate']);
      await seedHandler('User', [
        { name: 'create' },
        { name: 'ban' },
      ]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'User',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      expect(result.missing_count).toBe(2); // verify, deactivate
      expect(result.extra_count).toBe(1);   // ban
      expect(result.total_differences).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // Variant-level checking
  // ----------------------------------------------------------

  describe('variant-level checking', () => {
    it('detects missing variant tags for an action', async () => {
      await seedConcept('User', ['create'], {
        actionsDetail: [
          { name: 'create', variants: ['ok', 'duplicate', 'invalid'] },
        ],
      });
      await seedHandler('User', [
        { name: 'create', variants: ['ok'] },
      ]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'User',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const missingVariants = diffs.filter((d: any) => d.kind === 'missing_variant');
      expect(missingVariants).toHaveLength(2);
      expect(missingVariants.map((d: any) => d.specValue)).toContain('create/duplicate');
      expect(missingVariants.map((d: any) => d.specValue)).toContain('create/invalid');
      expect(result.missing_variants).toBe(2);
    });

    it('detects extra variant tags not in spec', async () => {
      await seedConcept('User', ['create'], {
        actionsDetail: [
          { name: 'create', variants: ['ok', 'duplicate'] },
        ],
      });
      await seedHandler('User', [
        { name: 'create', variants: ['ok', 'duplicate', 'throttled'] },
      ]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'User',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const extraVariants = diffs.filter((d: any) => d.kind === 'extra_variant');
      expect(extraVariants).toHaveLength(1);
      expect(extraVariants[0].implValue).toBe('create/throttled');
      expect(result.extra_variants).toBe(1);
    });

    it('reports inSync when all variant tags match', async () => {
      await seedConcept('Item', ['create', 'delete'], {
        actionsDetail: [
          { name: 'create', variants: ['ok', 'error'] },
          { name: 'delete', variants: ['ok', 'notfound'] },
        ],
      });
      await seedHandler('Item', [
        { name: 'create', variants: ['ok', 'error'] },
        { name: 'delete', variants: ['ok', 'notfound'] },
      ]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Item',
      }));

      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // State field type/cardinality checking (lens-aware)
  // ----------------------------------------------------------

  describe('state field type/cardinality checking', () => {
    it('detects type mismatch between spec and handler state fields', async () => {
      await seedConcept('Session', ['create'], {
        stateFieldsDetail: [
          { name: 'token', type: 'primitive', cardinality: 'one' },
          { name: 'expiresAt', type: 'primitive', cardinality: 'one' },
        ],
      });
      await seedHandler('Session', [{ name: 'create' }], {
        stateFieldsDetail: [
          { name: 'token', type: 'primitive', cardinality: 'one' },
          { name: 'expiresAt', type: 'record', cardinality: 'one' },
        ],
      });

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Session',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const typeMismatches = diffs.filter((d: any) => d.kind === 'state_field_type_mismatch');
      expect(typeMismatches).toHaveLength(1);
      expect(typeMismatches[0].specValue).toContain('expiresAt');
      expect(result.state_field_mismatches).toBe(1);
    });

    it('detects cardinality mismatch (set vs list)', async () => {
      await seedConcept('Group', ['create'], {
        stateFieldsDetail: [
          { name: 'members', type: 'param', cardinality: 'set' },
        ],
      });
      await seedHandler('Group', [{ name: 'create' }], {
        stateFieldsDetail: [
          { name: 'members', type: 'param', cardinality: 'list' },
        ],
      });

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Group',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const cardMismatches = diffs.filter((d: any) => d.kind === 'state_field_cardinality_mismatch');
      expect(cardMismatches).toHaveLength(1);
      expect(cardMismatches[0].specValue).toContain('set');
      expect(cardMismatches[0].implValue).toContain('list');
    });

    it('reports inSync when state fields match', async () => {
      await seedConcept('Simple', ['create'], {
        actionsDetail: [{ name: 'create', variants: ['ok'] }],
        stateFieldsDetail: [
          { name: 'name', type: 'primitive', cardinality: 'one' },
        ],
      });
      await seedHandler('Simple', [{ name: 'create', variants: ['ok'] }], {
        stateFieldsDetail: [
          { name: 'name', type: 'primitive', cardinality: 'one' },
        ],
      });

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Simple',
      }));

      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------

  describe('edge cases', () => {
    it('returns noHandler when no handler exists for concept', async () => {
      await seedConcept('Ghost', ['create']);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Ghost',
      }));

      expect(result.variant).toBe('noHandler');
    });

    it('returns noSpec when no concept entity exists', async () => {
      await seedHandler('Orphan', [{ name: 'create' }]);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Orphan',
      }));

      expect(result.variant).toBe('noSpec');
    });

    it('handles empty spec and empty handler as inSync', async () => {
      await seedConcept('Empty', []);
      await seedHandler('Empty', []);

      const result = await run(handlerDiffFromSpecHandler.diffFromSpec({
        concept: 'Empty',
      }));

      expect(result.variant).toBe('inSync');
      expect(result.actionCount).toBe(0);
    });
  });
});
