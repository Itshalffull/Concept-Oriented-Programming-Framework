// ============================================================
// Installer Concept Conformance Tests
//
// Staged transactional installation of resolved packages. Validates
// stage, activate, rollback, and clean actions against the concept
// spec's action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  installerHandler,
  resetInstallerIds,
} from '../handlers/ts/installer.handler.js';

describe('Installer', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const sampleEntries = [
    {
      module_id: 'auth',
      version: '1.0.0',
      content_hash: 'sha256:aaa',
      target_path: 'node_modules/auth',
      kind: 'library',
    },
    {
      module_id: 'logging',
      version: '2.0.0',
      content_hash: 'sha256:bbb',
      target_path: 'node_modules/logging',
      kind: 'library',
    },
  ];

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetInstallerIds();
  });

  describe('stage', () => {
    it('returns ok when staging a new installation generation', async () => {
      const result = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.installation).toBe('inst-1');
    });

    it('creates an inactive installation with generation > 0', async () => {
      const result = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );

      const inst = await storage.get('installation', result.installation as string);
      expect(inst!.active).toBe(false);
      expect(inst!.generation).toBeGreaterThan(0);
    });

    it('records the previous active installation as previous_generation', async () => {
      // Stage and activate the first installation
      const first = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!(
        { installation: first.installation },
        storage,
      );

      // Stage a second installation
      const second = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );

      const inst = await storage.get('installation', second.installation as string);
      expect(inst!.previous_generation).toBe(first.installation);
    });
  });

  describe('activate', () => {
    it('returns ok and marks installation as active', async () => {
      const staged = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );

      const result = await installerHandler.activate!(
        { installation: staged.installation },
        storage,
      );
      expect(result.variant).toBe('ok');

      const inst = await storage.get('installation', staged.installation as string);
      expect(inst!.active).toBe(true);
      expect(inst!.installed_at).toBeDefined();
    });

    it('deactivates the previous installation when activating a new one', async () => {
      const first = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!(
        { installation: first.installation },
        storage,
      );

      const second = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!(
        { installation: second.installation },
        storage,
      );

      const firstInst = await storage.get('installation', first.installation as string);
      expect(firstInst!.active).toBe(false);
      const secondInst = await storage.get('installation', second.installation as string);
      expect(secondInst!.active).toBe(true);
    });
  });

  describe('rollback', () => {
    it('returns ok and reactivates the previous generation', async () => {
      const first = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!(
        { installation: first.installation },
        storage,
      );

      const second = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!(
        { installation: second.installation },
        storage,
      );

      const result = await installerHandler.rollback!(
        { installation: second.installation },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.previous).toBe(first.installation);

      // Previous is now active
      const firstInst = await storage.get('installation', first.installation as string);
      expect(firstInst!.active).toBe(true);

      // Current is now inactive
      const secondInst = await storage.get('installation', second.installation as string);
      expect(secondInst!.active).toBe(false);
    });

    it('returns no_previous when there is no previous generation', async () => {
      const staged = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!(
        { installation: staged.installation },
        storage,
      );

      const result = await installerHandler.rollback!(
        { installation: staged.installation },
        storage,
      );
      expect(result.variant).toBe('no_previous');
    });
  });

  describe('clean', () => {
    it('returns ok and removes old inactive installations', async () => {
      // Create 3 installations, activate each in sequence
      const first = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!({ installation: first.installation }, storage);

      const second = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!({ installation: second.installation }, storage);

      const third = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!({ installation: third.installation }, storage);

      // Clean, keeping only 1 inactive generation
      const result = await installerHandler.clean!(
        { keep_generations: 1 },
        storage,
      );
      expect(result.variant).toBe('ok');
      // first and second are inactive; keeping 1 means removing 1
      expect(result.removed).toBe(1);
    });
  });

  describe('multi-step sequences', () => {
    it('stages then activates to make the installation active', async () => {
      const staged = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      expect(staged.variant).toBe('ok');

      const beforeActivate = await storage.get('installation', staged.installation as string);
      expect(beforeActivate!.active).toBe(false);

      await installerHandler.activate!(
        { installation: staged.installation },
        storage,
      );

      const afterActivate = await storage.get('installation', staged.installation as string);
      expect(afterActivate!.active).toBe(true);
    });

    it('activates then rolls back to restore the previous installation', async () => {
      const gen1 = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!({ installation: gen1.installation }, storage);

      const gen2 = await installerHandler.stage!(
        { lockfile_entries: sampleEntries, project_root: '/projects/my-app' },
        storage,
      );
      await installerHandler.activate!({ installation: gen2.installation }, storage);

      // Rollback gen2
      const rollbackResult = await installerHandler.rollback!(
        { installation: gen2.installation },
        storage,
      );
      expect(rollbackResult.variant).toBe('ok');

      const gen1Inst = await storage.get('installation', gen1.installation as string);
      expect(gen1Inst!.active).toBe(true);

      const gen2Inst = await storage.get('installation', gen2.installation as string);
      expect(gen2Inst!.active).toBe(false);
    });
  });
});
