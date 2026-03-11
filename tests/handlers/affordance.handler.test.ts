// Affordance Handler — Unit Tests
// Tests declare, match (with concept/suite/tag/field-level conditions), explain, and remove.

import { describe, it, expect, beforeEach } from 'vitest';
import { affordanceHandler } from '../../handlers/ts/app/affordance.handler.js';

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
// declare
// ---------------------------------------------------------------------------
describe('affordanceHandler.declare', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('creates a field-level affordance', async () => {
    const result = await affordanceHandler.declare!(
      { affordance: 'radio-sc', widget: 'radio-group', interactor: 'single-choice', specificity: 10, conditions: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('creates an entity-level affordance with concept condition', async () => {
    const result = await affordanceHandler.declare!(
      {
        affordance: 'approval-detail-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
        contractVersion: 1,
      },
      storage,
    );
    expect(result.variant).toBe('ok');

    // Verify stored data
    const record = await storage.get('affordance', 'approval-detail-aff');
    expect(record).not.toBeNull();
    const conds = JSON.parse(record!.conditions as string);
    expect(conds.concept).toBe('Approval');
    const bind = JSON.parse(record!.bind as string);
    expect(bind.actor).toBe('approver');
    expect(record!.contractVersion).toBe(1);
  });

  it('creates a suite-level affordance', async () => {
    const result = await affordanceHandler.declare!(
      {
        affordance: 'gov-card',
        widget: 'governance-entity-card',
        interactor: 'entity-card',
        specificity: 12,
        conditions: JSON.stringify({ suite: 'governance' }),
      },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('stores tag conditions', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'tag-aff',
        widget: 'stateful-card',
        interactor: 'entity-card',
        specificity: 15,
        conditions: JSON.stringify({ tags: ['stateful', 'approvable'] }),
      },
      storage,
    );
    const record = await storage.get('affordance', 'tag-aff');
    const conds = JSON.parse(record!.conditions as string);
    expect(conds.tags).toEqual(['stateful', 'approvable']);
  });

  it('rejects duplicate affordance identity', async () => {
    await affordanceHandler.declare!(
      { affordance: 'dup-aff', widget: 'w', interactor: 'i', specificity: 5, conditions: '{}' },
      storage,
    );
    const result = await affordanceHandler.declare!(
      { affordance: 'dup-aff', widget: 'w2', interactor: 'i', specificity: 10, conditions: '{}' },
      storage,
    );
    expect(result.variant).toBe('duplicate');
  });

  it('defaults specificity to 0 when not provided', async () => {
    await affordanceHandler.declare!(
      { affordance: 'no-spec', widget: 'w', interactor: 'i', specificity: undefined as unknown as number, conditions: '{}' },
      storage,
    );
    const record = await storage.get('affordance', 'no-spec');
    expect(record!.specificity).toBe(0);
  });

  it('handles null bind gracefully', async () => {
    await affordanceHandler.declare!(
      { affordance: 'no-bind', widget: 'w', interactor: 'i', specificity: 5, conditions: '{}', bind: null as unknown as string },
      storage,
    );
    const record = await storage.get('affordance', 'no-bind');
    expect(record!.bind).toBeNull();
  });

  it('stores all condition types', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'full-conds',
        widget: 'w',
        interactor: 'i',
        specificity: 10,
        conditions: JSON.stringify({
          platform: 'browser',
          viewport: 'desktop',
          density: 'comfortable',
          mutable: false,
          minOptions: 2,
          maxOptions: 10,
          concept: 'Approval',
          suite: 'governance',
          tags: ['stateful'],
        }),
      },
      storage,
    );
    const record = await storage.get('affordance', 'full-conds');
    const conds = JSON.parse(record!.conditions as string);
    expect(conds.platform).toBe('browser');
    expect(conds.viewport).toBe('desktop');
    expect(conds.density).toBe('comfortable');
    expect(conds.mutable).toBe(false);
    expect(conds.minOptions).toBe(2);
    expect(conds.maxOptions).toBe(10);
    expect(conds.concept).toBe('Approval');
    expect(conds.suite).toBe('governance');
    expect(conds.tags).toEqual(['stateful']);
  });
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------
describe('affordanceHandler.match', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    await affordanceHandler.declare!(
      { affordance: 'radio-sc', widget: 'radio-group', interactor: 'single-choice', specificity: 10, conditions: JSON.stringify({ maxOptions: 8 }) },
      storage,
    );
    await affordanceHandler.declare!(
      { affordance: 'select-sc', widget: 'select', interactor: 'single-choice', specificity: 5, conditions: '{}' },
      storage,
    );
    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver' }),
        contractVersion: 1,
      },
      storage,
    );
    await affordanceHandler.declare!(
      { affordance: 'gov-fallback', widget: 'gov-card', interactor: 'entity-card', specificity: 12, conditions: JSON.stringify({ suite: 'governance' }) },
      storage,
    );
  });

  it('matches by interactor type', async () => {
    const result = await affordanceHandler.match!(
      { affordance: 'match-1', interactor: 'single-choice', context: JSON.stringify({ optionCount: 4 }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    expect(matches.length).toBe(2);
    // Sorted by specificity: radio-group (10) > select (5)
    expect(matches[0].widget).toBe('radio-group');
    expect(matches[1].widget).toBe('select');
  });

  it('excludes affordances that exceed maxOptions', async () => {
    const result = await affordanceHandler.match!(
      { affordance: 'match-2', interactor: 'single-choice', context: JSON.stringify({ optionCount: 15 }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    // radio-group has maxOptions=8, should be excluded for optionCount=15
    expect(matches.length).toBe(1);
    expect(matches[0].widget).toBe('select');
  });

  it('matches by concept condition', async () => {
    const result = await affordanceHandler.match!(
      { affordance: 'match-3', interactor: 'entity-detail', context: JSON.stringify({ concept: 'Approval' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    expect(matches.length).toBe(1);
    expect(matches[0].widget).toBe('approval-detail');
    expect(matches[0].bind).toEqual({ actor: 'approver' });
    expect(matches[0].contractVersion).toBe(1);
  });

  it('excludes when concept does not match', async () => {
    const result = await affordanceHandler.match!(
      { affordance: 'match-4', interactor: 'entity-detail', context: JSON.stringify({ concept: 'Workflow' }) },
      storage,
    );
    expect(result.variant).toBe('none');
  });

  it('matches by suite condition', async () => {
    const result = await affordanceHandler.match!(
      { affordance: 'match-5', interactor: 'entity-card', context: JSON.stringify({ suite: 'governance' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    expect(matches[0].widget).toBe('gov-card');
  });

  it('excludes when suite does not match', async () => {
    const result = await affordanceHandler.match!(
      { affordance: 'match-6', interactor: 'entity-card', context: JSON.stringify({ suite: 'content' }) },
      storage,
    );
    expect(result.variant).toBe('none');
  });

  it('matches tag conditions', async () => {
    await affordanceHandler.declare!(
      { affordance: 'tag-match', widget: 'tag-widget', interactor: 'entity-card', specificity: 15, conditions: JSON.stringify({ tags: ['stateful'] }) },
      storage,
    );
    const result = await affordanceHandler.match!(
      { affordance: 'match-7', interactor: 'entity-card', context: JSON.stringify({ tags: ['stateful', 'approvable'] }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    const tagWidget = matches.find((m: Record<string, unknown>) => m.widget === 'tag-widget');
    expect(tagWidget).toBeDefined();
  });

  it('excludes when required tags are not present', async () => {
    await affordanceHandler.declare!(
      { affordance: 'tag-miss', widget: 'tag-widget2', interactor: 'entity-row', specificity: 15, conditions: JSON.stringify({ tags: ['editable'] }) },
      storage,
    );
    const result = await affordanceHandler.match!(
      { affordance: 'match-8', interactor: 'entity-row', context: JSON.stringify({ tags: ['stateful'] }) },
      storage,
    );
    expect(result.variant).toBe('none');
  });

  it('returns none when no affordances exist for interactor', async () => {
    const result = await affordanceHandler.match!(
      { affordance: 'match-9', interactor: 'unknown-interactor', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('none');
  });

  it('matches platform condition', async () => {
    await affordanceHandler.declare!(
      { affordance: 'plat-aff', widget: 'mobile-widget', interactor: 'entity-detail', specificity: 15, conditions: JSON.stringify({ concept: 'Workflow', platform: 'mobile' }) },
      storage,
    );
    const result = await affordanceHandler.match!(
      { affordance: 'match-10', interactor: 'entity-detail', context: JSON.stringify({ concept: 'Workflow', platform: 'mobile' }) },
      storage,
    );
    expect(result.variant).toBe('ok');

    const resultBrowser = await affordanceHandler.match!(
      { affordance: 'match-11', interactor: 'entity-detail', context: JSON.stringify({ concept: 'Workflow', platform: 'browser' }) },
      storage,
    );
    // Platform mismatch should exclude
    expect(resultBrowser.variant).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------
describe('affordanceHandler.explain', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('explains a registered affordance', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'explain-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval', suite: 'governance' }),
        bind: JSON.stringify({ actor: 'approver' }),
        contractVersion: 1,
      },
      storage,
    );
    const result = await affordanceHandler.explain!(
      { affordance: 'explain-aff' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect((result.reason as string)).toContain('concept=Approval');
    expect((result.reason as string)).toContain('suite=governance');
    expect((result.reason as string)).toContain('bind:');
    expect((result.reason as string)).toContain('contract: @1');
  });

  it('returns notfound for missing affordance', async () => {
    const result = await affordanceHandler.explain!(
      { affordance: 'ghost' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('explains an affordance with no conditions', async () => {
    await affordanceHandler.declare!(
      { affordance: 'bare-aff', widget: 'w', interactor: 'i', specificity: 5, conditions: '{}' },
      storage,
    );
    const result = await affordanceHandler.explain!(
      { affordance: 'bare-aff' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect((result.reason as string)).toContain('conditions: none');
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------
describe('affordanceHandler.remove', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('removes an existing affordance', async () => {
    await affordanceHandler.declare!(
      { affordance: 'rm-aff', widget: 'w', interactor: 'i', specificity: 5, conditions: '{}' },
      storage,
    );
    const result = await affordanceHandler.remove!(
      { affordance: 'rm-aff' },
      storage,
    );
    expect(result.variant).toBe('ok');

    // Verify it was soft-deleted
    const record = await storage.get('affordance', 'rm-aff');
    expect(record!.__deleted).toBe(true);
  });

  it('returns notfound for missing affordance', async () => {
    const result = await affordanceHandler.remove!(
      { affordance: 'nonexistent' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });
});
