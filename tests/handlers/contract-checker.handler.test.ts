import { beforeEach, describe, expect, it } from 'vitest';
import { affordanceHandler } from '../../handlers/ts/app/affordance.handler.js';
import { contractCheckerHandler } from '../../handlers/ts/app/contract-checker.handler.js';

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

describe('contractCheckerHandler', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    await storage.put('widget', 'approval-detail', {
      widget: 'approval-detail',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'status', type: 'String' },
          { name: 'actor', type: 'entity' },
          { name: 'body', type: 'String' },
        ],
      }),
    });
    await storage.put('concept', 'Approval', {
      concept: 'Approval',
      fields: JSON.stringify([
        { name: 'status', type: 'String' },
        { name: 'approver', type: 'String' },
        { name: 'reasoning', type: 'String' },
      ]),
      actions: JSON.stringify(['approve', 'reject']),
    });
    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval', suite: 'governance' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
      },
      storage as any,
    );
  });

  it('resolves slots using bind and exact-name matching', async () => {
    const result = await contractCheckerHandler.check!(
      { checker: 'c1', widget: 'approval-detail', concept: 'Approval', suite: 'governance' },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(JSON.parse(result.unresolved as string)).toEqual([]);
    expect(JSON.parse(result.mismatches as string)).toEqual([]);
  });

  it('reports unresolved and mismatched slots', async () => {
    await storage.put('concept', 'Approval', {
      concept: 'Approval',
      fields: JSON.stringify([
        { name: 'count', type: 'String' },
        { name: 'status', type: 'String' },
      ]),
      actions: JSON.stringify(['approve', 'reject']),
    });

    await storage.put('widget', 'typed-widget', {
      widget: 'typed-widget',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'count', type: 'Int' },
          { name: 'reviewer', type: 'entity' },
        ],
      }),
    });

    const result = await contractCheckerHandler.check!(
      { checker: 'c2', widget: 'typed-widget', concept: 'Approval' },
      storage as any,
    );
    expect(JSON.parse(result.unresolved as string)).toContain('reviewer');
    expect(JSON.parse(result.mismatches as string)).toEqual([{ slot: 'count', expected: 'Int', actual: 'String' }]);
  });

  it('checks all registered widgets for a concept and suite', async () => {
    await storage.put('widgetRegistry', 'approval-detail/entity-detail', {
      entry: 'approval-detail/entity-detail',
      widget: 'approval-detail',
      interactor: 'entity-detail',
      concept: 'Approval',
      suite: 'governance',
      specificity: 20,
    });

    const all = await contractCheckerHandler.checkAll!(
      { checker: 'check-all', concept: 'Approval' },
      storage as any,
    );
    expect(all.variant).toBe('ok');

    const suite = await contractCheckerHandler.checkSuite!(
      { checker: 'suite-check', suite: 'governance' },
      storage as any,
    );
    expect(suite.variant).toBe('ok');
  });
});
