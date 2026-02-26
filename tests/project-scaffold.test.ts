// ============================================================
// ProjectScaffold Handler Tests
//
// Initialize new COPF projects with the standard directory
// structure, example concept specs, and configuration files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  projectScaffoldHandler,
  resetProjectScaffoldCounter,
} from '../implementations/typescript/project-scaffold.impl.js';

describe('ProjectScaffold', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetProjectScaffoldCounter();
  });

  describe('scaffold', () => {
    it('scaffolds a new project and returns ok', async () => {
      const result = await projectScaffoldHandler.scaffold!(
        { name: 'my-project' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.project).toBe('project-scaffold-1');
      expect(result.path).toBe('./my-project/');
    });

    it('stores project metadata in storage', async () => {
      await projectScaffoldHandler.scaffold!(
        { name: 'test-app' },
        storage,
      );
      const stored = await storage.get('project-scaffold', 'project-scaffold-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('test-app');
      expect(stored!.path).toBe('./test-app/');
      expect(stored!.createdAt).toBeDefined();
    });

    it('returns alreadyExists when project name is taken', async () => {
      await projectScaffoldHandler.scaffold!(
        { name: 'duplicate' },
        storage,
      );
      const result = await projectScaffoldHandler.scaffold!(
        { name: 'duplicate' },
        storage,
      );
      expect(result.variant).toBe('alreadyExists');
      expect(result.name).toBe('duplicate');
    });

    it('assigns unique IDs to different projects', async () => {
      const first = await projectScaffoldHandler.scaffold!(
        { name: 'project-a' },
        storage,
      );
      const second = await projectScaffoldHandler.scaffold!(
        { name: 'project-b' },
        storage,
      );
      expect(first.project).toBe('project-scaffold-1');
      expect(second.project).toBe('project-scaffold-2');
    });

    it('derives path from project name', async () => {
      const result = await projectScaffoldHandler.scaffold!(
        { name: 'copf-demo' },
        storage,
      );
      expect(result.path).toBe('./copf-demo/');
    });
  });
});
