// ============================================================
// ProjectInit Concept Conformance Tests
//
// Orchestrate project scaffolding: create the init record,
// write clef.yaml and interface/deploy manifests, emit derived
// concept files, then advance through install and generate
// stages. Validates create, writeManifest,
// writeInterfaceManifests, writeDeployManifests,
// writeDerivedConcepts, triggerInstall, triggerGenerate,
// and complete actions.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  projectInitHandler,
  resetProjectInitIds,
} from '../handlers/ts/project-init.handler.js';

describe('ProjectInit', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const baseProfile = {
    backend_languages: ['typescript'],
    frontend_frameworks: ['react'],
    api_interfaces: ['rest', 'graphql'],
    deploy_targets: ['vercel'],
  };

  const baseModules = ['User', 'Password', 'JWT', 'Article', 'Comment'];

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetProjectInitIds();
  });

  describe('create', () => {
    it('creates an init record with scaffolding status', async () => {
      const result = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.initId).toBe('init-1');
      expect(result.status).toBe('scaffolding');
    });

    it('rejects an empty project name', async () => {
      const result = await projectInitHandler.create!(
        {
          project_name: '',
          project_path: '/projects/empty',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('name');
    });

    it('rejects an empty module list', async () => {
      const result = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify([]),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Module list');
    });
  });

  describe('writeManifest', () => {
    it('generates manifest content and sets resolving status', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );

      const result = await projectInitHandler.writeManifest!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.status).toBe('resolving');
      const manifest = JSON.parse(result.manifest as string);
      expect(manifest.name).toBe('my-app');
      expect(manifest.clef).toBe('1.0');
      expect(manifest.packages.User).toBeDefined();
    });

    it('excludes derived modules from the packages list', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify([...baseModules, 'derived:UserProfile']),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );

      const result = await projectInitHandler.writeManifest!(
        { init: created.initId },
        storage,
      );
      const manifest = JSON.parse(result.manifest as string);
      expect(manifest.packages['derived:UserProfile']).toBeUndefined();
    });
  });

  describe('writeInterfaceManifests', () => {
    it('generates interface manifest files based on profile API interfaces', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );

      const result = await projectInitHandler.writeInterfaceManifests!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2); // rest + graphql
      const interfaces = JSON.parse(result.interfaces as string);
      expect(interfaces).toContain('interfaces/openapi.yaml');
      expect(interfaces).toContain('interfaces/schema.graphql');
    });

    it('returns zero interfaces when profile has no API interfaces', async () => {
      const noApiProfile = { ...baseProfile, api_interfaces: [] };
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(noApiProfile),
        },
        storage,
      );

      const result = await projectInitHandler.writeInterfaceManifests!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);
    });
  });

  describe('writeDeployManifests', () => {
    it('generates deploy manifest files based on profile deploy targets', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );

      const result = await projectInitHandler.writeDeployManifests!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1); // vercel
      const targets = JSON.parse(result.targets as string);
      expect(targets).toContain('deploy/vercel.json');
    });
  });

  describe('writeDerivedConcepts', () => {
    it('generates derived concept files', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
          derived_concepts: JSON.stringify([
            { name: 'UserArticle', composes: ['User', 'Article'] },
            { name: 'ArticleComment', composes: ['Article', 'Comment'] },
          ]),
        },
        storage,
      );

      const result = await projectInitHandler.writeDerivedConcepts!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      const files = JSON.parse(result.files as string);
      expect(files).toContain('concepts/derived/UserArticle.derived.yaml');
      expect(files).toContain('concepts/derived/ArticleComment.derived.yaml');
    });

    it('returns zero files when no derived concepts are specified', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );

      const result = await projectInitHandler.writeDerivedConcepts!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);
    });
  });

  describe('triggerInstall', () => {
    it('sets status to installing and returns module count', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );

      const result = await projectInitHandler.triggerInstall!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.status).toBe('installing');
      expect(result.moduleCount).toBe(baseModules.length);
    });
  });

  describe('triggerGenerate', () => {
    it('sets status to generating and returns manifest counts', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
        },
        storage,
      );

      // Write manifests first so counts are populated
      await projectInitHandler.writeInterfaceManifests!(
        { init: created.initId },
        storage,
      );
      await projectInitHandler.writeDeployManifests!(
        { init: created.initId },
        storage,
      );

      const result = await projectInitHandler.triggerGenerate!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.status).toBe('generating');
      expect(result.interfaceCount).toBe(2);
      expect(result.deployCount).toBe(1);
    });
  });

  describe('complete', () => {
    it('returns summary with counts and sets complete status', async () => {
      const created = await projectInitHandler.create!(
        {
          project_name: 'my-app',
          project_path: '/projects/my-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
          derived_concepts: JSON.stringify([
            { name: 'UserArticle', composes: ['User', 'Article'] },
          ]),
        },
        storage,
      );

      await projectInitHandler.writeManifest!(
        { init: created.initId },
        storage,
      );
      await projectInitHandler.writeInterfaceManifests!(
        { init: created.initId },
        storage,
      );
      await projectInitHandler.writeDeployManifests!(
        { init: created.initId },
        storage,
      );
      await projectInitHandler.writeDerivedConcepts!(
        { init: created.initId },
        storage,
      );

      const result = await projectInitHandler.complete!(
        { init: created.initId },
        storage,
      );
      expect(result.variant).toBe('ok');
      const summary = JSON.parse(result.summary as string);
      expect(summary.projectName).toBe('my-app');
      expect(summary.status).toBe('complete');
      expect(summary.modules).toBe(baseModules.length);
      expect(summary.manifests).toBe(1);
      expect(summary.interfaceManifests).toBe(2);
      expect(summary.deployManifests).toBe(1);
      expect(summary.derivedConcepts).toBe(1);
    });
  });

  describe('multi-step sequences', () => {
    it('full lifecycle from create through complete', async () => {
      // Step 1: Create
      const created = await projectInitHandler.create!(
        {
          project_name: 'full-app',
          project_path: '/projects/full-app',
          module_list: JSON.stringify(baseModules),
          profile: JSON.stringify(baseProfile),
          derived_concepts: JSON.stringify([
            { name: 'UserArticle', composes: ['User', 'Article'] },
          ]),
        },
        storage,
      );
      expect(created.status).toBe('scaffolding');

      // Step 2: Write main manifest
      const manifest = await projectInitHandler.writeManifest!(
        { init: created.initId },
        storage,
      );
      expect(manifest.status).toBe('resolving');

      // Step 3: Write interface manifests
      const interfaces = await projectInitHandler.writeInterfaceManifests!(
        { init: created.initId },
        storage,
      );
      expect(interfaces.count).toBe(2);

      // Step 4: Write deploy manifests
      const deploy = await projectInitHandler.writeDeployManifests!(
        { init: created.initId },
        storage,
      );
      expect(deploy.count).toBe(1);

      // Step 5: Write derived concepts
      const derived = await projectInitHandler.writeDerivedConcepts!(
        { init: created.initId },
        storage,
      );
      expect(derived.count).toBe(1);

      // Step 6: Trigger install
      const install = await projectInitHandler.triggerInstall!(
        { init: created.initId },
        storage,
      );
      expect(install.status).toBe('installing');

      // Step 7: Trigger generate
      const generate = await projectInitHandler.triggerGenerate!(
        { init: created.initId },
        storage,
      );
      expect(generate.status).toBe('generating');

      // Step 8: Complete
      const completed = await projectInitHandler.complete!(
        { init: created.initId },
        storage,
      );
      expect(completed.variant).toBe('ok');
      const summary = JSON.parse(completed.summary as string);
      expect(summary.status).toBe('complete');
      expect(summary.projectName).toBe('full-app');
    });

    it('returns notfound for actions on non-existent init record', async () => {
      const result = await projectInitHandler.writeManifest!(
        { init: 'init-999' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });
});
