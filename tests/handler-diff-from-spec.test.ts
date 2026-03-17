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
  async function seedConcept(name: string, actions: string[]) {
    await storage.put('concept-entity', `concept:${name}`, {
      id: `concept:${name}`,
      name,
      actionsRef: JSON.stringify(actions),
      stateFieldsRef: JSON.stringify([]),
    });
  }

  // Helper: seed a handler entity in storage
  async function seedHandler(concept: string, methods: Array<{ name: string; variants?: string[] }>, collections: string[] = []) {
    await storage.put('handlers', `handler:${concept}:ts`, {
      id: `handler:${concept}:ts`,
      concept,
      language: 'ts',
      sourceFile: `handlers/ts/${concept.toLowerCase()}.handler.ts`,
      actionMethods: JSON.stringify(methods),
      storageCollections: JSON.stringify(collections),
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
