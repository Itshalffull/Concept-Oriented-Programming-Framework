import { beforeEach, describe, expect, it } from 'vitest';
import { uiSchemaHandler } from '../../handlers/ts/app/ui-schema.handler.js';

interface TestStorage {
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
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
  };
}

const approvalSpec = JSON.stringify({
  name: 'Approval',
  suite: 'governance',
  fields: [
    { name: 'status', type: 'String' },
    { name: 'approver', type: 'String' },
    { name: 'reasoning', type: 'String' },
  ],
  actions: ['approve', 'reject', 'request_changes'],
  annotations: {
    surface: { preferredView: 'entity-detail', tags: ['stateful', 'approvable'] },
  },
});

describe('uiSchemaHandler', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('builds entity metadata and field elements from the concept spec', async () => {
    const result = await uiSchemaHandler.inspect!(
      { schema: 'approval-schema', conceptSpec: approvalSpec },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.elementCount).toBe(3);

    const record = await storage.get('uiSchema', 'approval-schema');
    const entityElement = JSON.parse(record!.entityElement as string);
    expect(entityElement.kind).toBe('entity');
    expect(entityElement.concept).toBe('Approval');
    expect(entityElement.suite).toBe('governance');
    expect(entityElement.tags).toEqual(['stateful', 'approvable']);
    expect(entityElement.actions).toEqual(['approve', 'reject', 'request_changes']);
  });

  it('returns resolved from getElements after markResolved', async () => {
    await uiSchemaHandler.inspect!({ schema: 'elem-schema', conceptSpec: approvalSpec }, storage as any);
    await uiSchemaHandler.markResolved!({ schema: 'elem-schema' }, storage as any);
    const result = await uiSchemaHandler.getElements!({ schema: 'elem-schema' }, storage as any);
    expect(result.variant).toBe('resolved');
  });
});
