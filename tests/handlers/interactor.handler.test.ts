// ============================================================
// Interactor Handler Tests
//
// Tests for the interactor concept: define, classify (field-level
// and entity-level), get, and list actions. Validates category
// enforcement, property defaults, duplicate detection, confidence
// scoring, entity subtype mapping, and list filtering.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { interactorHandler } from '../../handlers/ts/app/interactor.handler.js';

// ----------------------------------------------------------
// In-memory TestStorage
//
// Provides get/put/del/find with no filtering on find — the
// handler performs its own filtering internally.
// ----------------------------------------------------------

interface TestStorage {
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  del(relation: string, key: string): Promise<void>;
  find(relation: string, criteria?: unknown): Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
  const data = new Map<string, Map<string, Record<string, unknown>>>();

  function getRelation(relation: string): Map<string, Record<string, unknown>> {
    let rel = data.get(relation);
    if (!rel) {
      rel = new Map();
      data.set(relation, rel);
    }
    return rel;
  }

  return {
    async get(relation: string, key: string) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry } : null;
    },

    async put(relation: string, key: string, value: Record<string, unknown>) {
      const rel = getRelation(relation);
      rel.set(key, { ...value });
    },

    async del(relation: string, key: string) {
      const rel = getRelation(relation);
      rel.delete(key);
    },

    async find(relation: string, _criteria?: unknown) {
      const rel = getRelation(relation);
      return Array.from(rel.values()).map((e) => ({ ...e }));
    },
  };
}

// ----------------------------------------------------------
// Helper to define an interactor via the handler
// ----------------------------------------------------------

async function defineInteractor(
  storage: TestStorage,
  overrides: Partial<{
    interactor: string;
    name: string;
    category: string;
    properties: string;
  }> = {},
) {
  return interactorHandler.define!(
    {
      interactor: overrides.interactor ?? 'text-input',
      name: overrides.name ?? 'Text Input',
      category: overrides.category ?? 'edit',
      properties: overrides.properties ?? JSON.stringify({ dataType: 'string', mutable: true }),
    },
    storage as any,
  );
}

// ==========================================================
// Tests
// ==========================================================

describe('Interactor Handler', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  // --------------------------------------------------------
  // define
  // --------------------------------------------------------

  describe('define', () => {
    it('stores a new interactor and returns ok', async () => {
      const result = await defineInteractor(storage);
      expect(result.variant).toBe('ok');
    });

    it('persists the interactor to storage', async () => {
      await defineInteractor(storage, { interactor: 'toggle', name: 'Toggle', category: 'control' });
      const stored = await storage.get('interactor', 'toggle');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('Toggle');
      expect(stored!.category).toBe('control');
    });

    it('rejects duplicate interactor identity', async () => {
      await defineInteractor(storage, { interactor: 'my-interactor' });
      const dup = await defineInteractor(storage, { interactor: 'my-interactor' });
      expect(dup.variant).toBe('duplicate');
      expect(dup.message).toBe('An interactor with this identity already exists');
    });

    it('rejects invalid category with duplicate variant and descriptive message', async () => {
      const result = await defineInteractor(storage, { category: 'bogus' });
      expect(result.variant).toBe('duplicate');
      expect(result.message).toContain('Invalid category');
      expect(result.message).toContain('bogus');
    });

    it('accepts all valid categories', async () => {
      const validCategories = ['selection', 'edit', 'control', 'output', 'navigation', 'composition', 'entity'];
      for (let i = 0; i < validCategories.length; i++) {
        const cat = validCategories[i];
        const result = await defineInteractor(storage, {
          interactor: `interactor-${cat}`,
          category: cat,
        });
        expect(result.variant).toBe('ok');
      }
    });

    it('applies default property values when properties is empty', async () => {
      await defineInteractor(storage, {
        interactor: 'defaults-test',
        properties: '{}',
      });
      const stored = await storage.get('interactor', 'defaults-test');
      const props = JSON.parse(stored!.properties as string);
      expect(props.dataType).toBe('string');
      expect(props.cardinality).toBe('one');
      expect(props.optionCount).toBeNull();
      expect(props.optionSource).toBeNull();
      expect(props.domain).toBeNull();
      expect(props.comparison).toBeNull();
      expect(props.mutable).toBe(true);
      expect(props.multiLine).toBe(false);
      expect(props.concept).toBeNull();
      expect(props.suite).toBeNull();
      expect(props.tags).toBeNull();
    });

    it('preserves explicit property values', async () => {
      await defineInteractor(storage, {
        interactor: 'explicit-props',
        properties: JSON.stringify({
          dataType: 'number',
          cardinality: 'many',
          optionCount: 5,
          optionSource: 'api',
          domain: 'finance',
          comparison: 'gte',
          mutable: false,
          multiLine: true,
          concept: 'Invoice',
          suite: 'billing',
          tags: ['urgent'],
        }),
      });
      const stored = await storage.get('interactor', 'explicit-props');
      const props = JSON.parse(stored!.properties as string);
      expect(props.dataType).toBe('number');
      expect(props.cardinality).toBe('many');
      expect(props.optionCount).toBe(5);
      expect(props.optionSource).toBe('api');
      expect(props.domain).toBe('finance');
      expect(props.comparison).toBe('gte');
      expect(props.mutable).toBe(false);
      expect(props.multiLine).toBe(true);
      expect(props.concept).toBe('Invoice');
      expect(props.suite).toBe('billing');
      expect(props.tags).toEqual(['urgent']);
    });

    it('stores a createdAt timestamp', async () => {
      await defineInteractor(storage, { interactor: 'ts-check' });
      const stored = await storage.get('interactor', 'ts-check');
      expect(stored!.createdAt).toBeDefined();
      // ISO string format check
      expect(() => new Date(stored!.createdAt as string)).not.toThrow();
    });

    it('handles undefined properties by using defaults', async () => {
      const result = await interactorHandler.define!(
        { interactor: 'no-props', name: 'No Props', category: 'output', properties: '' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      const stored = await storage.get('interactor', 'no-props');
      const props = JSON.parse(stored!.properties as string);
      expect(props.dataType).toBe('string');
      expect(props.mutable).toBe(true);
    });
  });

  // --------------------------------------------------------
  // classify — field-level
  // --------------------------------------------------------

  describe('classify (field-level)', () => {
    beforeEach(async () => {
      // Seed interactors for field-level classification
      await defineInteractor(storage, {
        interactor: 'text-input',
        name: 'Text Input',
        category: 'edit',
        properties: JSON.stringify({ dataType: 'string', cardinality: 'one', mutable: true }),
      });
      await defineInteractor(storage, {
        interactor: 'number-spinner',
        name: 'Number Spinner',
        category: 'edit',
        properties: JSON.stringify({ dataType: 'number', cardinality: 'one', mutable: true }),
      });
      await defineInteractor(storage, {
        interactor: 'text-display',
        name: 'Text Display',
        category: 'output',
        properties: JSON.stringify({ dataType: 'string', cardinality: 'one', mutable: false }),
      });
    });

    it('matches by dataType and returns ok with confidence', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'string', constraints: '{}', intent: '' },
        storage as any,
      );
      // Both text-input (dataType match + mutable default) and text-display (dataType match) could match.
      // text-input: 0.4 (dataType), text-display: 0.4 (dataType)
      // They are tied, difference is 0 which is not > 0.1, so ambiguous
      expect(result.variant).toBe('ambiguous');
    });

    it('scores dataType match at 0.4', async () => {
      // Only number-spinner matches dataType 'number'
      const result = await interactorHandler.classify!(
        { fieldType: 'number', constraints: '{}', intent: '' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      expect(result.confidence).toBe(0.4);
      expect(result.interactor).toBe('number-spinner');
    });

    it('adds 0.2 for cardinality match', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'number', constraints: JSON.stringify({ cardinality: 'one' }), intent: '' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      expect(result.confidence).toBeCloseTo(0.6, 10); // 0.4 dataType + 0.2 cardinality
      expect(result.interactor).toBe('number-spinner');
    });

    it('adds 0.1 for mutability match', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'number', constraints: JSON.stringify({ mutable: true }), intent: '' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      expect(result.confidence).toBe(0.5); // 0.4 dataType + 0.1 mutable
      expect(result.interactor).toBe('number-spinner');
    });

    it('adds 0.3 for intent/category match', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'number', constraints: '{}', intent: 'edit' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      expect(result.confidence).toBe(0.7); // 0.4 dataType + 0.3 intent
      expect(result.interactor).toBe('number-spinner');
    });

    it('combines all scoring factors', async () => {
      const result = await interactorHandler.classify!(
        {
          fieldType: 'number',
          constraints: JSON.stringify({ cardinality: 'one', mutable: true }),
          intent: 'edit',
        },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      // 0.4 + 0.2 + 0.1 + 0.3 = 1.0
      expect(result.confidence).toBe(1.0);
      expect(result.interactor).toBe('number-spinner');
    });

    it('caps confidence at 1.0', async () => {
      // Even though all factors sum to 1.0, confirm Math.min is applied
      const result = await interactorHandler.classify!(
        {
          fieldType: 'number',
          constraints: JSON.stringify({ cardinality: 'one', mutable: true }),
          intent: 'edit',
        },
        storage as any,
      );
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('returns ambiguous with empty candidates when nothing matches', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'boolean', constraints: '{}', intent: '' },
        storage as any,
      );
      expect(result.variant).toBe('ambiguous');
      expect(result.candidates).toBe(JSON.stringify([]));
      expect(result.message).toBe('No interactors matched the given criteria');
    });

    it('returns ambiguous with candidate list when scores are close', async () => {
      // text-input and text-display both match dataType 'string' at 0.4
      const result = await interactorHandler.classify!(
        { fieldType: 'string', constraints: '{}', intent: '' },
        storage as any,
      );
      expect(result.variant).toBe('ambiguous');
      const candidates = JSON.parse(result.candidates as string);
      expect(candidates.length).toBe(2);
      expect(candidates[0].confidence).toBe(0.4);
      expect(candidates[1].confidence).toBe(0.4);
    });

    it('picks clear winner when gap exceeds 0.1', async () => {
      // text-input: dataType 0.4 + intent 'edit' 0.3 = 0.7
      // text-display: dataType 0.4 + intent mismatch = 0.4
      // gap is 0.3, which > 0.1
      const result = await interactorHandler.classify!(
        { fieldType: 'string', constraints: '{}', intent: 'edit' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      expect(result.interactor).toBe('text-input');
      expect(result.confidence).toBe(0.7);
    });

    it('skips entity-category interactors during field-level classification', async () => {
      // Add an entity-category interactor
      await defineInteractor(storage, {
        interactor: 'entity-detail',
        name: 'entity-detail',
        category: 'entity',
        properties: JSON.stringify({ dataType: 'string', cardinality: 'one', mutable: true }),
      });

      // Classify field-level 'string' — entity-detail should be skipped
      const result = await interactorHandler.classify!(
        { fieldType: 'string', constraints: '{}', intent: 'edit' },
        storage as any,
      );
      // text-input matches at 0.7 (dataType 0.4 + intent 0.3), text-display at 0.4
      // entity-detail is skipped even though it would match dataType
      expect(result.variant).toBe('ok');
      expect(result.interactor).toBe('text-input');
    });

    it('returns ambiguous when scores are equal (gap not > 0.1)', async () => {
      // Add another edit interactor with matching dataType
      await defineInteractor(storage, {
        interactor: 'rich-text-input',
        name: 'Rich Text Input',
        category: 'edit',
        properties: JSON.stringify({ dataType: 'string', cardinality: 'one', mutable: true }),
      });

      // text-input: 0.4 (dataType) + 0.3 (intent=edit) = 0.7
      // rich-text-input: 0.4 (dataType) + 0.3 (intent=edit) = 0.7
      // text-display: 0.4 (dataType only)
      // number-spinner: 0.3 (intent=edit, no dataType match)
      // Gap between first two is 0, not > 0.1
      const result = await interactorHandler.classify!(
        { fieldType: 'string', constraints: '{}', intent: 'edit' },
        storage as any,
      );
      expect(result.variant).toBe('ambiguous');
      const candidates = JSON.parse(result.candidates as string);
      // All four candidates returned (sorted by confidence descending)
      expect(candidates.length).toBe(4);
      expect(candidates[0].confidence).toBe(0.7);
      expect(candidates[1].confidence).toBe(0.7);
      expect(candidates[2].confidence).toBe(0.4);
      expect(candidates[3].confidence).toBe(0.3);
    });
  });

  // --------------------------------------------------------
  // classify — entity-level
  // --------------------------------------------------------

  describe('classify (entity-level)', () => {
    it('triggers entity classification when fieldType is "entity"', async () => {
      const result = await interactorHandler.classify!(
        {
          fieldType: 'entity',
          constraints: JSON.stringify({ view: 'detail', concept: 'Todo', suite: 'core' }),
          intent: '',
        },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      // No registered entity-detail interactor, so fallback with 0.8
      expect(result.confidence).toBe(0.8);
      expect(result.interactor).toBe('entity-detail');
    });

    it('maps view "detail" to entity-detail subtype', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'detail' }), intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-detail');
    });

    it('maps view "list" to entity-card subtype', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'list' }), intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-card');
    });

    it('maps view "list-table" to entity-row subtype', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'list-table' }), intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-row');
    });

    it('maps view "inline" to entity-inline subtype', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'inline' }), intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-inline');
    });

    it('maps view "edit" to entity-editor subtype', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'edit' }), intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-editor');
    });

    it('maps view "graph" to entity-graph subtype', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'graph' }), intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-graph');
    });

    it('defaults to entity-detail when view is not provided', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: '{}', intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-detail');
    });

    it('defaults to entity-detail for unknown view context', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'unknown-view' }), intent: '' },
        storage as any,
      );
      expect(result.interactor).toBe('entity-detail');
    });

    it('returns confidence 1.0 when subtype is registered', async () => {
      // Register the entity-detail interactor
      await defineInteractor(storage, {
        interactor: 'entity-detail-registered',
        name: 'entity-detail',
        category: 'entity',
        properties: JSON.stringify({ dataType: 'entity' }),
      });

      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'detail' }), intent: '' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      expect(result.confidence).toBe(1.0);
      expect(result.interactor).toBe('entity-detail-registered');
    });

    it('returns confidence 0.8 when subtype is not registered', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'list' }), intent: '' },
        storage as any,
      );
      expect(result.confidence).toBe(0.8);
      expect(result.interactor).toBe('entity-card');
    });

    it('passes concept through in the result', async () => {
      const result = await interactorHandler.classify!(
        {
          fieldType: 'entity',
          constraints: JSON.stringify({ view: 'detail', concept: 'Invoice' }),
          intent: '',
        },
        storage as any,
      );
      expect(result.concept).toBe('Invoice');
    });

    it('passes suite through in the result', async () => {
      const result = await interactorHandler.classify!(
        {
          fieldType: 'entity',
          constraints: JSON.stringify({ view: 'detail', suite: 'billing' }),
          intent: '',
        },
        storage as any,
      );
      expect(result.suite).toBe('billing');
    });

    it('passes tags through as JSON string in the result', async () => {
      const result = await interactorHandler.classify!(
        {
          fieldType: 'entity',
          constraints: JSON.stringify({ view: 'detail', tags: ['important', 'beta'] }),
          intent: '',
        },
        storage as any,
      );
      expect(JSON.parse(result.tags as string)).toEqual(['important', 'beta']);
    });

    it('defaults tags to empty array when not provided', async () => {
      const result = await interactorHandler.classify!(
        { fieldType: 'entity', constraints: JSON.stringify({ view: 'detail' }), intent: '' },
        storage as any,
      );
      expect(JSON.parse(result.tags as string)).toEqual([]);
    });
  });

  // --------------------------------------------------------
  // get
  // --------------------------------------------------------

  describe('get', () => {
    it('returns interactor details when found', async () => {
      await defineInteractor(storage, {
        interactor: 'lookup-me',
        name: 'Lookup Interactor',
        category: 'selection',
        properties: JSON.stringify({ dataType: 'boolean' }),
      });

      const result = await interactorHandler.get!(
        { interactor: 'lookup-me' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('Lookup Interactor');
      expect(result.category).toBe('selection');
      const props = JSON.parse(result.properties as string);
      expect(props.dataType).toBe('boolean');
    });

    it('returns notfound when interactor does not exist', async () => {
      const result = await interactorHandler.get!(
        { interactor: 'does-not-exist' },
        storage as any,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toBe('Interactor not found');
    });
  });

  // --------------------------------------------------------
  // list
  // --------------------------------------------------------

  describe('list', () => {
    beforeEach(async () => {
      await defineInteractor(storage, {
        interactor: 'i-edit',
        name: 'Edit One',
        category: 'edit',
      });
      await defineInteractor(storage, {
        interactor: 'i-output',
        name: 'Output One',
        category: 'output',
      });
      await defineInteractor(storage, {
        interactor: 'i-edit2',
        name: 'Edit Two',
        category: 'edit',
      });
    });

    it('returns all interactors when no category filter', async () => {
      const result = await interactorHandler.list!(
        { category: '' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      const interactors = JSON.parse(result.interactors as string);
      expect(interactors.length).toBe(3);
    });

    it('filters by category when category is provided', async () => {
      const result = await interactorHandler.list!(
        { category: 'edit' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      const interactors = JSON.parse(result.interactors as string);
      expect(interactors.length).toBe(2);
      expect(interactors.every((i: any) => i.category === 'edit')).toBe(true);
    });

    it('returns empty array when category has no matches', async () => {
      const result = await interactorHandler.list!(
        { category: 'navigation' },
        storage as any,
      );
      expect(result.variant).toBe('ok');
      const interactors = JSON.parse(result.interactors as string);
      expect(interactors.length).toBe(0);
    });

    it('includes interactor, name, and category fields in listed items', async () => {
      const result = await interactorHandler.list!(
        { category: 'output' },
        storage as any,
      );
      const interactors = JSON.parse(result.interactors as string);
      expect(interactors.length).toBe(1);
      expect(interactors[0].interactor).toBe('i-output');
      expect(interactors[0].name).toBe('Output One');
      expect(interactors[0].category).toBe('output');
    });
  });
});
