import { beforeEach, describe, expect, it } from 'vitest';
import { affordanceHandler } from '../../handlers/ts/app/affordance.handler.js';

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

describe('affordanceHandler', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('stores entity-level conditions, bind data, and theme metadata', async () => {
    const result = await affordanceHandler.declare!(
      {
        affordance: 'approval-detail-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval', suite: 'governance', tags: ['stateful'], motif: 'stacked' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
        contractVersion: 1,
        densityExempt: true,
        motifOptimized: 'stacked',
      },
      storage as any,
    );

    expect(result.variant).toBe('ok');
    const record = await storage.get('affordance', 'approval-detail-aff');
    expect(record!.contractVersion).toBe(1);
    expect(record!.densityExempt).toBe(true);
    expect(record!.motifOptimized).toBe('stacked');
  });

  it('matches entity-level concept, suite, and tag conditions', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval', suite: 'governance', tags: ['stateful'] }),
        bind: JSON.stringify({ actor: 'approver' }),
        contractVersion: 1,
        densityExempt: true,
        motifOptimized: 'stacked',
      },
      storage as any,
    );

    const result = await affordanceHandler.match!(
      {
        interactor: 'entity-detail',
        context: JSON.stringify({ concept: 'Approval', suite: 'governance', tags: ['stateful', 'approvable'] }),
      },
      storage as any,
    );
    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    expect(matches).toHaveLength(1);
    expect(matches[0].widget).toBe('approval-detail');
    expect(matches[0].densityExempt).toBe(true);
    expect(matches[0].motifOptimized).toBe('stacked');
  });

  it('includes bind, contract, and theme metadata in explanations', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'explain-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval', suite: 'governance' }),
        bind: JSON.stringify({ actor: 'approver' }),
        contractVersion: 1,
        densityExempt: true,
        motifOptimized: 'stacked',
      },
      storage as any,
    );

    const result = await affordanceHandler.explain!({ affordance: 'explain-aff' }, storage as any);
    expect(result.variant).toBe('ok');
    expect(result.reason).toContain('contract: @1');
    expect(result.reason).toContain('densityExempt: true');
    expect(result.reason).toContain('motifOptimized: stacked');
  });
});
