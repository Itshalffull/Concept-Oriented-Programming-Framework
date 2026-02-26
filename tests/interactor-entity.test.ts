// ============================================================
// InteractorEntity Handler Tests
//
// Tests for interactor-entity: registration, retrieval,
// category queries, matching widgets, classified fields,
// and coverage reporting.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  interactorEntityHandler,
  resetInteractorEntityCounter,
} from '../implementations/typescript/interactor-entity.impl.js';

describe('InteractorEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetInteractorEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new interactor and returns ok', async () => {
      const result = await interactorEntityHandler.register(
        { name: 'Toggle', category: 'boolean', properties: '{"dataType":"boolean"}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.entity).toBe('interactor-entity-1');
    });

    it('stores the interactor with the correct symbol', async () => {
      await interactorEntityHandler.register(
        { name: 'Toggle', category: 'boolean', properties: '{}' },
        storage,
      );
      const record = await storage.get('interactor-entity', 'interactor-entity-1');
      expect(record).not.toBeNull();
      expect(record!.symbol).toBe('copf/interactor/Toggle');
      expect(record!.classificationRules).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the interactor details', async () => {
      const reg = await interactorEntityHandler.register(
        { name: 'Toggle', category: 'boolean', properties: '{"dataType":"boolean"}' },
        storage,
      );
      const result = await interactorEntityHandler.get({ interactor: reg.entity }, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('Toggle');
      expect(result.category).toBe('boolean');
      expect(result.properties).toBe('{"dataType":"boolean"}');
    });

    it('returns notfound for nonexistent interactor', async () => {
      const result = await interactorEntityHandler.get({ interactor: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByCategory
  // ----------------------------------------------------------

  describe('findByCategory', () => {
    it('returns interactors matching the given category', async () => {
      await interactorEntityHandler.register(
        { name: 'Toggle', category: 'boolean', properties: '{}' },
        storage,
      );
      await interactorEntityHandler.register(
        { name: 'Checkbox', category: 'boolean', properties: '{}' },
        storage,
      );
      await interactorEntityHandler.register(
        { name: 'Slider', category: 'numeric', properties: '{}' },
        storage,
      );

      const result = await interactorEntityHandler.findByCategory({ category: 'boolean' }, storage);
      expect(result.variant).toBe('ok');
      const interactors = JSON.parse(result.interactors as string);
      expect(interactors).toHaveLength(2);
    });

    it('returns empty for an unmatched category', async () => {
      const result = await interactorEntityHandler.findByCategory({ category: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.interactors as string)).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // matchingWidgets
  // ----------------------------------------------------------

  describe('matchingWidgets', () => {
    it('finds widgets that declare affordance for this interactor', async () => {
      const reg = await interactorEntityHandler.register(
        { name: 'Toggle', category: 'boolean', properties: '{}' },
        storage,
      );

      await storage.put('widget-entity', 'w-1', {
        id: 'w-1',
        name: 'SwitchWidget',
        ast: JSON.stringify({ affordances: [{ interactor: 'Toggle' }] }),
      });
      await storage.put('widget-entity', 'w-2', {
        id: 'w-2',
        name: 'TextInput',
        ast: JSON.stringify({ affordances: [{ interactor: 'TextEntry' }] }),
      });

      const result = await interactorEntityHandler.matchingWidgets(
        { interactor: reg.entity, context: 'default' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const widgets = JSON.parse(result.widgets as string);
      expect(widgets).toHaveLength(1);
      expect(widgets[0].widget).toBe('SwitchWidget');
    });

    it('returns empty for nonexistent interactor', async () => {
      const result = await interactorEntityHandler.matchingWidgets(
        { interactor: 'nope', context: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.widgets).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // classifiedFields
  // ----------------------------------------------------------

  describe('classifiedFields', () => {
    it('classifies state fields matching interactor properties', async () => {
      const reg = await interactorEntityHandler.register(
        { name: 'Toggle', category: 'boolean', properties: '{"dataType":"boolean"}' },
        storage,
      );

      await storage.put('state-field', 'sf-1', {
        id: 'sf-1',
        concept: 'Settings',
        name: 'darkMode',
        typeExpr: 'boolean',
        cardinality: 'scalar',
      });
      await storage.put('state-field', 'sf-2', {
        id: 'sf-2',
        concept: 'Todo',
        name: 'items',
        typeExpr: 'list string',
        cardinality: 'list',
      });

      const result = await interactorEntityHandler.classifiedFields(
        { interactor: reg.entity },
        storage,
      );
      expect(result.variant).toBe('ok');
      const fields = JSON.parse(result.fields as string);
      expect(fields).toHaveLength(1);
      expect(fields[0].field).toBe('darkMode');
    });

    it('returns empty for nonexistent interactor', async () => {
      const result = await interactorEntityHandler.classifiedFields(
        { interactor: 'nope' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.fields).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // coverageReport
  // ----------------------------------------------------------

  describe('coverageReport', () => {
    it('generates a coverage report of interactors vs widgets', async () => {
      await interactorEntityHandler.register(
        { name: 'Toggle', category: 'boolean', properties: '{}' },
        storage,
      );
      await interactorEntityHandler.register(
        { name: 'Slider', category: 'numeric', properties: '{}' },
        storage,
      );

      await storage.put('widget-entity', 'w-1', {
        id: 'w-1',
        name: 'Switch',
        ast: JSON.stringify({ affordances: [{ interactor: 'Toggle' }] }),
      });

      const result = await interactorEntityHandler.coverageReport({}, storage);
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report).toHaveLength(2);

      const toggleEntry = report.find((r: Record<string, unknown>) => r.interactor === 'Toggle');
      const sliderEntry = report.find((r: Record<string, unknown>) => r.interactor === 'Slider');
      expect(toggleEntry.widgetCount).toBe(1);
      expect(sliderEntry.widgetCount).toBe(0);
    });
  });
});
