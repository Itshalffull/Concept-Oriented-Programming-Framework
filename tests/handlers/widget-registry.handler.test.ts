import { beforeEach, describe, expect, it } from 'vitest';
import { widgetRegistryHandler } from '../../handlers/ts/app/widget-registry.handler.js';

interface TestStorage {
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  find(relation: string, criteria?: unknown): Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
  const data = new Map<string, Map<string, Record<string, unknown>>>();
  function getRelation(name: string) {
    let rel = data.get(name);
    if (!rel) {
      rel = new Map();
      data.set(name, rel);
    }
    return rel;
  }
  return {
    async get(relation, key) {
      const entry = getRelation(relation).get(key);
      return entry ? { ...entry } : null;
    },
    async put(relation, key, value) {
      getRelation(relation).set(key, { ...value });
    },
    async find(relation) {
      return Array.from(getRelation(relation).values()).map((entry) => ({ ...entry }));
    },
  };
}

describe('widgetRegistryHandler', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('registers entries and preserves contract metadata', async () => {
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
      storage as any,
    );
    expect(result.variant).toBe('ok');
    const stored = await storage.get('widgetRegistry', 'approval-detail/entity-detail');
    expect(stored!.contractSlots).toBe('["status","actor","body"]');
  });

  it('queries by concept and sorts by specificity', async () => {
    await widgetRegistryHandler.register!(
      {
        entry: 'approval-detail/entity-detail',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        concept: 'Approval',
        suite: 'governance',
        tags: '[]',
        specificity: 20,
        contractVersion: 1,
        contractSlots: '[]',
        contractActions: '[]',
        secondaryRoles: '[]',
      },
      storage as any,
    );
    await widgetRegistryHandler.register!(
      {
        entry: 'approval-card/entity-card',
        widget: 'approval-card',
        interactor: 'entity-card',
        concept: 'Approval',
        suite: 'governance',
        tags: '[]',
        specificity: 10,
        contractVersion: 1,
        contractSlots: '[]',
        contractActions: '[]',
        secondaryRoles: '[]',
      },
      storage as any,
    );
    const result = await widgetRegistryHandler.query!(
      { concept: 'Approval', suite: null, interactor: null },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.map((entry: { widget: string }) => entry.widget)).toEqual(['approval-detail', 'approval-card']);
  });
});
