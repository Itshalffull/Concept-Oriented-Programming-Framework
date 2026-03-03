// ============================================================
// ModuleSelection Concept Conformance Tests
//
// Interactive module selection session: start from a template
// and/or target profile, then add/remove concepts, choose
// handler implementations, add widgets, themes, and derived
// concepts before finalizing into a flat module list. Validates
// begin, addConcept, removeConcept, chooseHandler, addWidget,
// selectTheme, addDerived, finalize, and preview actions.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  moduleSelectionHandler,
  resetModuleSelectionIds,
} from '../handlers/ts/module-selection.handler.js';
import {
  appTemplateHandler,
  resetAppTemplateIds,
} from '../handlers/ts/app-template.handler.js';

describe('ModuleSelection', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetModuleSelectionIds();
    resetAppTemplateIds();
  });

  describe('begin', () => {
    it('creates a new empty session', async () => {
      const result = await moduleSelectionHandler.begin!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.selectionId).toBe('sel-1');
      expect(result.conceptCount).toBe(0);
      expect(result.infraCount).toBe(0);
    });

    it('pre-populates concepts from a template', async () => {
      // Seed built-in templates by triggering a list
      await appTemplateHandler.list!({}, storage);

      const result = await moduleSelectionHandler.begin!(
        { template_name: 'social' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.conceptCount).toBeGreaterThan(0);
    });
  });

  describe('addConcept', () => {
    it('adds a module to the selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      const result = await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Notification' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.conceptCount).toBe(1);
    });

    it('returns exists for a duplicate module', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Notification' },
        storage,
      );
      const result = await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Notification' },
        storage,
      );
      expect(result.variant).toBe('exists');
      expect(result.message).toContain('Notification');
    });
  });

  describe('removeConcept', () => {
    it('removes an existing module from the selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Analytics' },
        storage,
      );
      const result = await moduleSelectionHandler.removeConcept!(
        { selection: session.selectionId, module_id: 'Analytics' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.conceptCount).toBe(0);
    });

    it('returns notfound for a module not in selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      const result = await moduleSelectionHandler.removeConcept!(
        { selection: session.selectionId, module_id: 'Missing' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('reports hasDependents when derived concepts depend on the module', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'User' },
        storage,
      );
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Profile' },
        storage,
      );
      await moduleSelectionHandler.addDerived!(
        {
          selection: session.selectionId,
          name: 'UserProfile',
          composes: JSON.stringify(['User', 'Profile']),
        },
        storage,
      );

      const result = await moduleSelectionHandler.removeConcept!(
        { selection: session.selectionId, module_id: 'User' },
        storage,
      );
      expect(result.variant).toBe('hasDependents');
      expect(result.message).toContain('UserProfile');
    });
  });

  describe('chooseHandler', () => {
    it('associates a handler with a concept module', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Auth' },
        storage,
      );
      const result = await moduleSelectionHandler.chooseHandler!(
        {
          selection: session.selectionId,
          concept_module: 'Auth',
          handler_module: 'JwtAuthHandler',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound when concept is not in selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      const result = await moduleSelectionHandler.chooseHandler!(
        {
          selection: session.selectionId,
          concept_module: 'Missing',
          handler_module: 'SomeHandler',
        },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('addWidget', () => {
    it('adds a widget module to the selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      const result = await moduleSelectionHandler.addWidget!(
        { selection: session.selectionId, module_id: 'ProfileCard' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.widgetCount).toBe(1);
    });

    it('returns exists for a duplicate widget', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addWidget!(
        { selection: session.selectionId, module_id: 'ProfileCard' },
        storage,
      );
      const result = await moduleSelectionHandler.addWidget!(
        { selection: session.selectionId, module_id: 'ProfileCard' },
        storage,
      );
      expect(result.variant).toBe('exists');
    });
  });

  describe('selectTheme', () => {
    it('sets the theme module on the selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      const result = await moduleSelectionHandler.selectTheme!(
        { selection: session.selectionId, theme_module: 'DarkTheme' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.theme).toBe('DarkTheme');
    });
  });

  describe('addDerived', () => {
    it('returns ok when all composed concepts exist in selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Article' },
        storage,
      );
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Comment' },
        storage,
      );
      const result = await moduleSelectionHandler.addDerived!(
        {
          selection: session.selectionId,
          name: 'ArticleComment',
          composes: JSON.stringify(['Article', 'Comment']),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.derivedCount).toBe(1);
    });

    it('returns missingConcepts when a composed concept is not in selection', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Article' },
        storage,
      );
      const result = await moduleSelectionHandler.addDerived!(
        {
          selection: session.selectionId,
          name: 'ArticleComment',
          composes: JSON.stringify(['Article', 'Comment']),
        },
        storage,
      );
      expect(result.variant).toBe('missingConcepts');
      expect(result.message).toContain('Comment');
    });
  });

  describe('finalize', () => {
    it('flattens all selections into a single module list', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'User' },
        storage,
      );
      await moduleSelectionHandler.addWidget!(
        { selection: session.selectionId, module_id: 'UserCard' },
        storage,
      );
      await moduleSelectionHandler.selectTheme!(
        { selection: session.selectionId, theme_module: 'LightTheme' },
        storage,
      );

      const result = await moduleSelectionHandler.finalize!(
        { selection: session.selectionId },
        storage,
      );
      expect(result.variant).toBe('ok');
      const modules = JSON.parse(result.modules as string);
      expect(modules).toContain('User');
      expect(modules).toContain('UserCard');
      expect(modules).toContain('LightTheme');
      expect(result.totalCount).toBe(3);
    });
  });

  describe('preview', () => {
    it('returns correct counts for each category', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'User' },
        storage,
      );
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Profile' },
        storage,
      );
      await moduleSelectionHandler.addWidget!(
        { selection: session.selectionId, module_id: 'ProfileCard' },
        storage,
      );
      await moduleSelectionHandler.selectTheme!(
        { selection: session.selectionId, theme_module: 'DarkTheme' },
        storage,
      );

      const result = await moduleSelectionHandler.preview!(
        { selection: session.selectionId },
        storage,
      );
      expect(result.variant).toBe('ok');
      const summary = JSON.parse(result.summary as string);
      expect(summary.concepts).toBe(2);
      expect(summary.widgets).toBe(1);
      expect(summary.theme).toBe(1);
    });
  });

  describe('multi-step sequences', () => {
    it('begin with template then addConcept then finalize includes both', async () => {
      // Seed built-in templates
      await appTemplateHandler.list!({}, storage);

      const session = await moduleSelectionHandler.begin!(
        { template_name: 'social' },
        storage,
      );
      expect(session.conceptCount).toBeGreaterThan(0);

      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Analytics' },
        storage,
      );

      const finalized = await moduleSelectionHandler.finalize!(
        { selection: session.selectionId },
        storage,
      );
      expect(finalized.variant).toBe('ok');
      const modules = JSON.parse(finalized.modules as string);
      expect(modules).toContain('User');
      expect(modules).toContain('Analytics');
    });

    it('chooseHandler then finalize includes handler modules', async () => {
      const session = await moduleSelectionHandler.begin!({}, storage);
      await moduleSelectionHandler.addConcept!(
        { selection: session.selectionId, module_id: 'Auth' },
        storage,
      );
      await moduleSelectionHandler.chooseHandler!(
        {
          selection: session.selectionId,
          concept_module: 'Auth',
          handler_module: 'JwtAuthHandler',
        },
        storage,
      );

      const finalized = await moduleSelectionHandler.finalize!(
        { selection: session.selectionId },
        storage,
      );
      const modules = JSON.parse(finalized.modules as string);
      expect(modules).toContain('Auth');
      expect(modules).toContain('JwtAuthHandler');
    });
  });
});
