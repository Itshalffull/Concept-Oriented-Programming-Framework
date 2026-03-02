// ClaudeSkillsTarget — handler.test.ts
// Unit tests for claudeSkillsTarget handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { claudeSkillsTargetHandler } from './handler.js';
import type { ClaudeSkillsTargetStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): ClaudeSkillsTargetStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): ClaudeSkillsTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ClaudeSkillsTarget handler', () => {
  describe('generate', () => {
    it('should return ok with skills and files for valid JSON projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'UserProfile',
        actions: ['create', 'update'],
        refs: ['auth-context'],
        description: 'User profile management',
      });

      const result = await claudeSkillsTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.skills.length).toBe(2);
          expect(result.right.files.length).toBe(2);
        }
      }
    });

    it('should return ok with fallback for non-JSON projection string', async () => {
      const storage = createTestStorage();

      const result = await claudeSkillsTargetHandler.generate(
        { projection: 'SimpleTask', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.skills.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('should return missingProjection for empty projection', async () => {
      const storage = createTestStorage();

      const result = await claudeSkillsTargetHandler.generate(
        { projection: '', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('missingProjection');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await claudeSkillsTargetHandler.generate(
        { projection: 'TestConcept', config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok for a skill that does not exist in storage', async () => {
      const storage = createTestStorage();

      const result = await claudeSkillsTargetHandler.validate(
        { skill: 'nonexistent-skill' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return ok for a valid skill with all required frontmatter', async () => {
      const storage = createTestStorage();
      await storage.put('skills', 'test-skill', {
        name: 'Test Skill',
        description: 'A test skill',
        version: '1.0.0',
        refs: [],
      });

      const result = await claudeSkillsTargetHandler.validate(
        { skill: 'test-skill' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalidFrontmatter when required fields are missing', async () => {
      const storage = createTestStorage();
      await storage.put('skills', 'test-skill', {
        name: 'Test Skill',
        // missing description and version
      });

      const result = await claudeSkillsTargetHandler.validate(
        { skill: 'test-skill' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidFrontmatter');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await claudeSkillsTargetHandler.validate(
        { skill: 'test-skill' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listSkills', () => {
    it('should return ok with categorized skills', async () => {
      const storage = createTestStorage();
      await storage.put('skills', 'user-create', {
        concept: 'UserProfile',
        skillId: 'user-create',
        enriched: true,
      });
      await storage.put('skills', 'user-delete', {
        concept: 'UserProfile',
        skillId: 'user-delete',
        enriched: false,
      });

      const result = await claudeSkillsTargetHandler.listSkills(
        { kit: 'User' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.skills.length).toBe(2);
        expect(result.right.enriched).toContain('user-create');
        expect(result.right.flat).toContain('user-delete');
      }
    });

    it('should return ok with empty lists when no skills match', async () => {
      const storage = createTestStorage();

      const result = await claudeSkillsTargetHandler.listSkills(
        { kit: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.skills.length).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await claudeSkillsTargetHandler.listSkills(
        { kit: 'test' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
