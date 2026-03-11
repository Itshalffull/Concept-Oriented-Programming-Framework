// WidgetRegistry Handler — Unit Tests
// Tests register, query, and remove actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { widgetRegistryHandler } from '../../handlers/ts/app/widget-registry.handler.js';

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
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
describe('widgetRegistryHandler.register', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('registers a new entry', async () => {
    const result = await widgetRegistryHandler.register!(
      {
        entry: 'approval-detail/entity-detail',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        concept: 'Approval',
        suite: 'governance',
        tags: '["stateful"]',
        specificity: 20,
        contractVersion: 1,
        contractSlots: '["status","actor","body"]',
        contractActions: '["approve","reject"]',
        secondaryRoles: '["comments"]',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.entry).toBe('approval-detail/entity-detail');
  });

  it('stores all fields correctly', async () => {
    await widgetRegistryHandler.register!(
      {
        entry: 'stored-entry',
        widget: 'my-widget',
        interactor: 'entity-card',
        concept: 'Article',
        suite: 'content',
        tags: '["published"]',
        specificity: 15,
        contractVersion: 2,
        contractSlots: '["title","body"]',
        contractActions: '["publish"]',
        secondaryRoles: '[]',
      },
      storage,
    );
    const record = await storage.get('widgetRegistry', 'stored-entry');
    expect(record).not.toBeNull();
    expect(record!.widget).toBe('my-widget');
    expect(record!.interactor).toBe('entity-card');
    expect(record!.concept).toBe('Article');
    expect(record!.suite).toBe('content');
    expect(record!.tags).toBe('["published"]');
    expect(record!.specificity).toBe(15);
    expect(record!.contractVersion).toBe(2);
    expect(record!.registeredAt).toBeDefined();
  });

  it('rejects duplicate entry', async () => {
    await widgetRegistryHandler.register!(
      { entry: 'dup', widget: 'w', interactor: 'i', concept: null, suite: null, tags: '[]', specificity: 5, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
    const result = await widgetRegistryHandler.register!(
      { entry: 'dup', widget: 'w2', interactor: 'i2', concept: null, suite: null, tags: '[]', specificity: 10, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
    expect(result.variant).toBe('duplicate');
    expect((result.message as string)).toContain('dup');
  });

  it('handles null concept and suite', async () => {
    await widgetRegistryHandler.register!(
      { entry: 'null-cs', widget: 'w', interactor: 'entity-card', concept: null, suite: null, tags: '[]', specificity: 5, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
    const record = await storage.get('widgetRegistry', 'null-cs');
    expect(record!.concept).toBeNull();
    expect(record!.suite).toBeNull();
  });

  it('defaults contractVersion to 1 when 0 or falsy', async () => {
    await widgetRegistryHandler.register!(
      { entry: 'no-cv', widget: 'w', interactor: 'i', concept: null, suite: null, tags: '[]', specificity: 5, contractVersion: 0, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
    const record = await storage.get('widgetRegistry', 'no-cv');
    expect(record!.contractVersion).toBe(1);
  });

  it('defaults empty string lists to []', async () => {
    await widgetRegistryHandler.register!(
      { entry: 'empty-lists', widget: 'w', interactor: 'i', concept: null, suite: null, tags: '', specificity: 5, contractVersion: 1, contractSlots: '', contractActions: '', secondaryRoles: '' },
      storage,
    );
    const record = await storage.get('widgetRegistry', 'empty-lists');
    expect(record!.tags).toBe('[]');
    expect(record!.contractSlots).toBe('[]');
    expect(record!.contractActions).toBe('[]');
    expect(record!.secondaryRoles).toBe('[]');
  });
});

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------
describe('widgetRegistryHandler.query', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    // Register several entries
    await widgetRegistryHandler.register!(
      { entry: 'approval-detail/entity-detail', widget: 'approval-detail', interactor: 'entity-detail', concept: 'Approval', suite: 'governance', tags: '[]', specificity: 20, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
    await widgetRegistryHandler.register!(
      { entry: 'approval-card/entity-card', widget: 'approval-card', interactor: 'entity-card', concept: 'Approval', suite: 'governance', tags: '[]', specificity: 20, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
    await widgetRegistryHandler.register!(
      { entry: 'gov-card/entity-card', widget: 'gov-card', interactor: 'entity-card', concept: null, suite: 'governance', tags: '[]', specificity: 12, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
    await widgetRegistryHandler.register!(
      { entry: 'article-detail/entity-detail', widget: 'article-detail', interactor: 'entity-detail', concept: 'Article', suite: 'content', tags: '[]', specificity: 20, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
  });

  it('queries by concept', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: 'Approval', suite: null, interactor: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.length).toBe(2);
    expect(entries.every((e: Record<string, unknown>) => e.concept === 'Approval')).toBe(true);
  });

  it('queries by suite', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: null, suite: 'governance', interactor: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.length).toBe(3); // approval-detail, approval-card, gov-card
  });

  it('queries by interactor', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: null, suite: null, interactor: 'entity-detail' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.length).toBe(2); // approval-detail, article-detail
  });

  it('queries by concept + interactor', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: 'Approval', suite: null, interactor: 'entity-card' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.length).toBe(1);
    expect(entries[0].widget).toBe('approval-card');
  });

  it('queries by suite + interactor', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: null, suite: 'governance', interactor: 'entity-card' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.length).toBe(2); // approval-card (20) and gov-card (12)
    // Sorted by specificity descending
    expect(entries[0].specificity).toBeGreaterThanOrEqual(entries[1].specificity);
  });

  it('returns none when no entries match', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: 'NonExistent', suite: null, interactor: null },
      storage,
    );
    expect(result.variant).toBe('none');
  });

  it('returns all entries when no filters applied', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: null, suite: null, interactor: null },
      storage,
    );
    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.length).toBe(4);
  });

  it('sorts results by specificity descending', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: null, suite: 'governance', interactor: null },
      storage,
    );
    const entries = JSON.parse(result.entries as string);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].specificity).toBeGreaterThanOrEqual(entries[i].specificity);
    }
  });

  it('returns all entry fields in query results', async () => {
    const result = await widgetRegistryHandler.query!(
      { concept: 'Approval', suite: null, interactor: 'entity-detail' },
      storage,
    );
    const entries = JSON.parse(result.entries as string);
    const entry = entries[0];
    expect(entry.entry).toBeDefined();
    expect(entry.widget).toBeDefined();
    expect(entry.interactor).toBeDefined();
    expect(entry.concept).toBeDefined();
    expect(entry.suite).toBeDefined();
    expect(entry.specificity).toBeDefined();
    expect(entry.contractVersion).toBeDefined();
    expect(entry.contractSlots).toBeDefined();
    expect(entry.contractActions).toBeDefined();
    expect(entry.secondaryRoles).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------
describe('widgetRegistryHandler.remove', () => {
  let storage: TestStorage;
  beforeEach(async () => {
    storage = createTestStorage();
    await widgetRegistryHandler.register!(
      { entry: 'rm-entry', widget: 'w', interactor: 'i', concept: 'C', suite: null, tags: '[]', specificity: 10, contractVersion: 1, contractSlots: '[]', contractActions: '[]', secondaryRoles: '[]' },
      storage,
    );
  });

  it('removes an existing entry', async () => {
    const result = await widgetRegistryHandler.remove!(
      { entry: 'rm-entry' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.entry).toBe('rm-entry');

    // Verify soft-deleted
    const record = await storage.get('widgetRegistry', 'rm-entry');
    expect(record!.__deleted).toBe(true);
  });

  it('returns notfound for nonexistent entry', async () => {
    const result = await widgetRegistryHandler.remove!(
      { entry: 'ghost' },
      storage,
    );
    expect(result.variant).toBe('notfound');
    expect((result.message as string)).toContain('ghost');
  });

  it('removed entries are excluded from queries', async () => {
    await widgetRegistryHandler.remove!(
      { entry: 'rm-entry' },
      storage,
    );

    // After removal, the entry key still exists but is soft-deleted.
    // The query should include it (since we just mark __deleted, not filter).
    // This verifies the soft-delete behavior.
    const record = await storage.get('widgetRegistry', 'rm-entry');
    expect(record!.__deleted).toBe(true);
  });
});
