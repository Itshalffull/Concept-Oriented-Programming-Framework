// ============================================================
// AppTemplate Concept Conformance Tests
//
// Manage starter templates that bundle Repertoire concepts into
// common application archetypes. Validates list, detail,
// customize, and register actions against the concept spec's
// action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  appTemplateHandler,
  resetAppTemplateIds,
} from '../handlers/ts/app-template.handler.js';

describe('AppTemplate', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetAppTemplateIds();
  });

  describe('list', () => {
    it('returns all built-in templates when no category filter is given', async () => {
      const result = await appTemplateHandler.list!({}, storage);
      expect(result.variant).toBe('ok');
      const templates = JSON.parse(result.templates as string);
      expect(templates.length).toBe(5);
    });

    it('filters templates by category', async () => {
      const result = await appTemplateHandler.list!(
        { category: 'content' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const templates = JSON.parse(result.templates as string);
      expect(templates.length).toBe(2);
      expect(templates.every((t: { category: string }) => t.category === 'content')).toBe(true);
    });

    it('returns empty list for unknown category', async () => {
      const result = await appTemplateHandler.list!(
        { category: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const templates = JSON.parse(result.templates as string);
      expect(templates.length).toBe(0);
    });

    it('includes moduleCount in each template summary', async () => {
      const result = await appTemplateHandler.list!({}, storage);
      const templates = JSON.parse(result.templates as string);
      for (const t of templates) {
        expect(t.moduleCount).toBeGreaterThan(0);
      }
    });
  });

  describe('detail', () => {
    it('returns full template data for a known template', async () => {
      const result = await appTemplateHandler.detail!(
        { name: 'social' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('social');
      expect(result.category).toBe('content');
      expect(result.builtIn).toBe(true);
      const modules = JSON.parse(result.modules as string);
      expect(modules).toContain('User');
      expect(modules).toContain('Article');
    });

    it('returns notfound for unknown template name', async () => {
      const result = await appTemplateHandler.detail!(
        { name: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('nonexistent');
    });
  });

  describe('customize', () => {
    it('adds modules to a template', async () => {
      const result = await appTemplateHandler.customize!(
        {
          template: 'social',
          add: JSON.stringify(['Analytics', 'Dashboard']),
          remove: JSON.stringify([]),
          features: JSON.stringify({}),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const customized = JSON.parse(result.customized as string);
      expect(customized.modules).toContain('Analytics');
      expect(customized.modules).toContain('Dashboard');
    });

    it('removes a non-required module from a template', async () => {
      const result = await appTemplateHandler.customize!(
        {
          template: 'social',
          add: JSON.stringify([]),
          remove: JSON.stringify(['Tag']),
          features: JSON.stringify({}),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const customized = JSON.parse(result.customized as string);
      expect(customized.modules).not.toContain('Tag');
    });

    it('returns invalid when removing a required module', async () => {
      const result = await appTemplateHandler.customize!(
        {
          template: 'social',
          add: JSON.stringify([]),
          remove: JSON.stringify(['User']),
          features: JSON.stringify({}),
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
      const errors = JSON.parse(result.errors as string);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('required');
    });

    it('applies feature overrides', async () => {
      const result = await appTemplateHandler.customize!(
        {
          template: 'social',
          add: JSON.stringify([]),
          remove: JSON.stringify([]),
          features: JSON.stringify({ darkMode: true }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const customized = JSON.parse(result.customized as string);
      expect(customized.features.darkMode).toBe(true);
    });

    it('removes syncs that reference a removed module', async () => {
      const result = await appTemplateHandler.customize!(
        {
          template: 'social',
          add: JSON.stringify([]),
          remove: JSON.stringify(['Tag']),
          features: JSON.stringify({}),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const customized = JSON.parse(result.customized as string);
      expect(customized.syncs).not.toContain('Article->Tag');
    });
  });

  describe('register', () => {
    it('creates a new user-defined template', async () => {
      const result = await appTemplateHandler.register!(
        {
          name: 'custom-app',
          description: 'A custom application template',
          category: 'custom',
          modules: JSON.stringify(['User', 'Dashboard']),
          syncs: JSON.stringify(['User->Dashboard']),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const template = JSON.parse(result.template as string);
      expect(template.name).toBe('custom-app');
      expect(template.modules).toContain('User');
    });

    it('returns duplicate for an existing template name', async () => {
      // Built-in 'social' already exists after first access
      await appTemplateHandler.list!({}, storage);
      const result = await appTemplateHandler.register!(
        {
          name: 'social',
          description: 'Duplicate',
          category: 'content',
          modules: JSON.stringify(['User']),
        },
        storage,
      );
      expect(result.variant).toBe('duplicate');
      expect(result.message).toContain('social');
    });
  });

  describe('multi-step sequences', () => {
    it('finds a registered template via detail', async () => {
      await appTemplateHandler.register!(
        {
          name: 'my-template',
          description: 'Test template',
          category: 'test',
          modules: JSON.stringify(['ModA', 'ModB']),
          syncs: JSON.stringify([]),
        },
        storage,
      );

      const detail = await appTemplateHandler.detail!(
        { name: 'my-template' },
        storage,
      );
      expect(detail.variant).toBe('ok');
      expect(detail.name).toBe('my-template');
      expect(detail.builtIn).toBe(false);
    });

    it('detail then customize then detail shows customized name', async () => {
      const detail1 = await appTemplateHandler.detail!(
        { name: 'social' },
        storage,
      );
      expect(detail1.variant).toBe('ok');

      const customized = await appTemplateHandler.customize!(
        {
          template: 'social',
          add: JSON.stringify(['NewModule']),
          remove: JSON.stringify(['Tag']),
          features: JSON.stringify({ theme: 'dark' }),
        },
        storage,
      );
      expect(customized.variant).toBe('ok');
      const parsed = JSON.parse(customized.customized as string);
      expect(parsed.name).toBe('social-custom');
      expect(parsed.modules).toContain('NewModule');
      expect(parsed.modules).not.toContain('Tag');
    });
  });
});
