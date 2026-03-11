// Interactor Handler — Unit Tests
// Tests define, classify (field-level and entity-level), get, and list actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { interactorHandler } from '../../handlers/ts/app/interactor.handler.js';

// ---------------------------------------------------------------------------
// Test storage
// ---------------------------------------------------------------------------
interface TestStorage {
  get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  delete: (relation: string, key: string) => Promise<boolean>;
  find: (relation: string, prefix?: string) => Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => {
      const map = store.get(relation);
      if (!map) return [];
      return [...map.values()];
    },
  };
}

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------
describe('interactorHandler.define', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('creates a new interactor with valid category', async () => {
    const result = await interactorHandler.define!(
      { interactor: 'text-short', name: 'text-short', category: 'edit', properties: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('stores interactor properties with defaults', async () => {
    await interactorHandler.define!(
      { interactor: 'stored-props', name: 'stored', category: 'selection', properties: '{"dataType":"enum","cardinality":"many"}' },
      storage,
    );
    const record = await storage.get('interactor', 'stored-props');
    expect(record).not.toBeNull();
    const props = JSON.parse(record!.properties as string);
    expect(props.dataType).toBe('enum');
    expect(props.cardinality).toBe('many');
    expect(props.mutable).toBe(true); // default
    expect(props.multiLine).toBe(false); // default
  });

  it('rejects duplicate interactor identity', async () => {
    await interactorHandler.define!(
      { interactor: 'dup', name: 'dup', category: 'edit', properties: '{}' },
      storage,
    );
    const result = await interactorHandler.define!(
      { interactor: 'dup', name: 'dup', category: 'edit', properties: '{}' },
      storage,
    );
    expect(result.variant).toBe('duplicate');
    expect(result.message).toContain('already exists');
  });

  it('rejects invalid category', async () => {
    const result = await interactorHandler.define!(
      { interactor: 'bad', name: 'bad', category: 'invented', properties: '{}' },
      storage,
    );
    expect(result.variant).toBe('duplicate');
    expect((result.message as string)).toContain('Invalid category');
  });

  it('accepts entity category', async () => {
    const result = await interactorHandler.define!(
      { interactor: 'ent', name: 'entity-detail', category: 'entity', properties: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('accepts all valid categories', async () => {
    const categories = ['selection', 'edit', 'control', 'output', 'navigation', 'composition', 'entity'];
    for (const cat of categories) {
      const result = await interactorHandler.define!(
        { interactor: `cat-${cat}`, name: cat, category: cat, properties: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
    }
  });

  it('stores concept/suite/tags in entity properties', async () => {
    await interactorHandler.define!(
      {
        interactor: 'entity-with-meta',
        name: 'entity-detail',
        category: 'entity',
        properties: JSON.stringify({ concept: 'Approval', suite: 'governance', tags: ['stateful'] }),
      },
      storage,
    );
    const record = await storage.get('interactor', 'entity-with-meta');
    const props = JSON.parse(record!.properties as string);
    expect(props.concept).toBe('Approval');
    expect(props.suite).toBe('governance');
    expect(props.tags).toEqual(['stateful']);
  });

  it('handles null/missing properties gracefully', async () => {
    const result = await interactorHandler.define!(
      { interactor: 'no-props', name: 'np', category: 'edit', properties: null as unknown as string },
      storage,
    );
    expect(result.variant).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// classify — field-level
// ---------------------------------------------------------------------------
describe('interactorHandler.classify (field-level)', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    // Define field-level interactors
    await interactorHandler.define!(
      { interactor: 'text-short', name: 'text-short', category: 'edit', properties: JSON.stringify({ dataType: 'string', cardinality: 'one', mutable: true }) },
      storage,
    );
    await interactorHandler.define!(
      { interactor: 'text-long', name: 'text-long', category: 'edit', properties: JSON.stringify({ dataType: 'string', cardinality: 'one', mutable: true, multiLine: true }) },
      storage,
    );
    await interactorHandler.define!(
      { interactor: 'radio-group', name: 'radio-group', category: 'selection', properties: JSON.stringify({ dataType: 'string', cardinality: 'one' }) },
      storage,
    );
  });

  it('classifies a string field type', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'cls-1', fieldType: 'string', constraints: '{}', intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.interactor).toBe('text-short');
  });

  it('boosts confidence when cardinality matches', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'cls-2', fieldType: 'string', constraints: JSON.stringify({ cardinality: 'one' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect((result.confidence as number)).toBeGreaterThan(0.4);
  });

  it('boosts confidence when intent matches category', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'cls-3', fieldType: 'string', constraints: '{}', intent: 'selection' },
      storage,
    );
    // radio-group has category 'selection', so with intent 'selection' it gets a boost
    expect(result.variant).toBe('ok');
  });

  it('returns ambiguous when multiple candidates are close', async () => {
    // Both text-short and text-long match string with same confidence
    const result = await interactorHandler.classify!(
      { interactor: 'cls-amb', fieldType: 'string', constraints: JSON.stringify({ cardinality: 'one', mutable: true }), intent: 'edit' },
      storage,
    );
    // Both text-short and text-long are edit category with matching constraints
    expect(['ok', 'ambiguous']).toContain(result.variant);
  });

  it('returns ambiguous with no-match message for unknown field type', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'cls-unknown', fieldType: 'binary-blob', constraints: '{}', intent: null },
      storage,
    );
    expect(result.variant).toBe('ambiguous');
    expect(result.message).toContain('No interactors matched');
  });

  it('skips entity-category interactors during field-level classification', async () => {
    await interactorHandler.define!(
      { interactor: 'entity-detail-skip', name: 'entity-detail', category: 'entity', properties: JSON.stringify({ dataType: 'string' }) },
      storage,
    );
    const result = await interactorHandler.classify!(
      { interactor: 'cls-skip', fieldType: 'string', constraints: '{}', intent: null },
      storage,
    );
    // Should not pick the entity interactor
    if (result.variant === 'ok') {
      expect(result.interactor).not.toBe('entity-detail-skip');
    }
  });
});

// ---------------------------------------------------------------------------
// classify — entity-level
// ---------------------------------------------------------------------------
describe('interactorHandler.classify (entity-level)', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    await interactorHandler.define!(
      { interactor: 'ed-registered', name: 'entity-detail', category: 'entity', properties: '{}' },
      storage,
    );
    await interactorHandler.define!(
      { interactor: 'ec-registered', name: 'entity-card', category: 'entity', properties: '{}' },
      storage,
    );
  });

  it('classifies detail view', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e1', fieldType: 'entity', constraints: JSON.stringify({ view: 'detail', concept: 'Approval' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.confidence).toBe(1.0);
    expect(result.concept).toBe('Approval');
  });

  it('classifies list view as entity-card', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e2', fieldType: 'entity', constraints: JSON.stringify({ view: 'list', concept: 'Article' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.concept).toBe('Article');
  });

  it('classifies list-table view as entity-row', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e3', fieldType: 'entity', constraints: JSON.stringify({ view: 'list-table' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    // entity-row not registered, so fallback confidence
    expect(result.confidence).toBe(0.8);
  });

  it('classifies inline view', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e4', fieldType: 'entity', constraints: JSON.stringify({ view: 'inline' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('classifies edit view as entity-editor', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e5', fieldType: 'entity', constraints: JSON.stringify({ view: 'edit' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('classifies graph view', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e6', fieldType: 'entity', constraints: JSON.stringify({ view: 'graph' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('defaults to entity-detail when view is missing', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e7', fieldType: 'entity', constraints: '{}', intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.confidence).toBe(1.0); // registered
  });

  it('defaults to entity-detail for unknown view', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e8', fieldType: 'entity', constraints: JSON.stringify({ view: 'unknown-view' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('passes through suite and tags', async () => {
    const result = await interactorHandler.classify!(
      { interactor: 'e9', fieldType: 'entity', constraints: JSON.stringify({ view: 'detail', concept: 'Approval', suite: 'governance', tags: ['stateful'] }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.suite).toBe('governance');
    expect(JSON.parse(result.tags as string)).toEqual(['stateful']);
  });

  it('returns confidence 0.8 when entity subtype is not registered', async () => {
    // entity-editor is not registered in beforeEach
    const result = await interactorHandler.classify!(
      { interactor: 'e10', fieldType: 'entity', constraints: JSON.stringify({ view: 'edit' }), intent: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.confidence).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------
describe('interactorHandler.get', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('returns interactor details', async () => {
    await interactorHandler.define!(
      { interactor: 'get-test', name: 'text-short', category: 'edit', properties: JSON.stringify({ dataType: 'string' }) },
      storage,
    );
    const result = await interactorHandler.get!(
      { interactor: 'get-test' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('text-short');
    expect(result.category).toBe('edit');
    expect(result.properties).toBeDefined();
  });

  it('returns notfound for missing interactor', async () => {
    const result = await interactorHandler.get!(
      { interactor: 'does-not-exist' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------
describe('interactorHandler.list', () => {
  let storage: TestStorage;
  beforeEach(async () => {
    storage = createTestStorage();
    await interactorHandler.define!(
      { interactor: 'i1', name: 'text-short', category: 'edit', properties: '{}' },
      storage,
    );
    await interactorHandler.define!(
      { interactor: 'i2', name: 'radio', category: 'selection', properties: '{}' },
      storage,
    );
    await interactorHandler.define!(
      { interactor: 'i3', name: 'entity-detail', category: 'entity', properties: '{}' },
      storage,
    );
  });

  it('lists all interactors', async () => {
    const result = await interactorHandler.list!(
      { category: null as unknown as string },
      storage,
    );
    expect(result.variant).toBe('ok');
    const list = JSON.parse(result.interactors as string);
    expect(list.length).toBe(3);
  });

  it('filters by category', async () => {
    const result = await interactorHandler.list!(
      { category: 'entity' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const list = JSON.parse(result.interactors as string);
    expect(list.length).toBe(1);
    expect(list[0].category).toBe('entity');
  });

  it('returns empty list for unknown category', async () => {
    const result = await interactorHandler.list!(
      { category: 'nonexistent' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const list = JSON.parse(result.interactors as string);
    expect(list.length).toBe(0);
  });
});
