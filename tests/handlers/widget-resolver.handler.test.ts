import { beforeEach, describe, expect, it } from 'vitest';
import { affordanceHandler } from '../../handlers/ts/app/affordance.handler.js';
import { widgetResolverHandler } from '../../handlers/ts/app/widget-resolver.handler.js';

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

describe('widgetResolverHandler', () => {
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
        actions: [{ name: 'approve' }, { name: 'reject' }],
      }),
    });
    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval', motif: 'stacked' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
        contractVersion: 1,
        densityExempt: true,
        motifOptimized: 'stacked',
      },
      storage as any,
    );
  });

  it('resolves entity widgets with a binding map and contract validation', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-1',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          motif: 'stacked',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
            { name: 'reasoning', type: 'String' },
          ],
          actions: ['approve', 'reject'],
        }),
      },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.reason).toContain('motifBonus=stacked');
    const bindingMap = JSON.parse(result.bindingMap as string);
    expect(bindingMap.actor).toBe('approver');
    expect(bindingMap.body).toBe('reasoning');
  });

  it('rejects widgets with unresolved contract requirements', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-2',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [{ name: 'status', type: 'String' }],
          actions: ['approve', 'reject'],
        }),
      },
      storage as any,
    );
    expect(result.variant).toBe('none');
    const diag = await storage.get('diagnostics', 'diag:entity-detail');
    expect(diag).not.toBeNull();
  });

  it('adds density bonus for density-exempt affordances', async () => {
    await storage.put('widget', 'comfortable-dialog', { widget: 'comfortable-dialog' });
    await affordanceHandler.declare!(
      {
        affordance: 'dialog-aff',
        widget: 'comfortable-dialog',
        interactor: 'dialog',
        specificity: 10,
        conditions: '{}',
        densityExempt: true,
      },
      storage as any,
    );
    const result = await widgetResolverHandler.resolve!(
      { resolver: 'field-1', element: 'dialog', context: JSON.stringify({ density: 'compact' }) },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    expect(result.reason).toContain('densityExempt=true');
  });
});
