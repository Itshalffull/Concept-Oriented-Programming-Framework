import { beforeEach, describe, expect, it } from 'vitest';
import { interactorHandler } from '../../handlers/ts/app/interactor.handler.js';

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

describe('interactorHandler', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('stores entity metadata on define', async () => {
    const result = await interactorHandler.define!(
      {
        interactor: 'entity-with-meta',
        name: 'entity-detail',
        category: 'entity',
        properties: JSON.stringify({ concept: 'Approval', suite: 'governance', tags: ['stateful'] }),
      },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    const stored = await storage.get('interactor', 'entity-with-meta');
    const props = JSON.parse(stored!.properties as string);
    expect(props.concept).toBe('Approval');
    expect(props.suite).toBe('governance');
    expect(props.tags).toEqual(['stateful']);
  });

  it('classifies entity detail views and passes metadata through', async () => {
    const result = await interactorHandler.classify!(
      {
        fieldType: 'entity',
        constraints: JSON.stringify({ view: 'detail', concept: 'Approval', suite: 'governance', tags: ['stateful'] }),
        intent: null,
      },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.interactor).toBe('entity-detail');
    expect(result.concept).toBe('Approval');
    expect(result.suite).toBe('governance');
    expect(JSON.parse(result.tags as string)).toEqual(['stateful']);
  });

  it('skips entity interactors during field classification', async () => {
    await interactorHandler.define!(
      { interactor: 'entity-detail', name: 'entity-detail', category: 'entity', properties: JSON.stringify({ dataType: 'string' }) },
      storage as any,
    );
    await interactorHandler.define!(
      { interactor: 'text-short', name: 'text-short', category: 'edit', properties: JSON.stringify({ dataType: 'string' }) },
      storage as any,
    );

    const result = await interactorHandler.classify!(
      { fieldType: 'string', constraints: '{}', intent: 'edit' },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.interactor).toBe('text-short');
  });
});
