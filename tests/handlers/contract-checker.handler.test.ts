// ContractChecker Handler — Unit Tests
// Tests check, checkAll, checkSuite, and suggest actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { contractCheckerHandler } from '../../handlers/ts/app/contract-checker.handler.js';
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
// check
// ---------------------------------------------------------------------------
describe('contractCheckerHandler.check', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();

    // Register widget
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

    // Register concept
    await storage.put('concept', 'Approval', {
      concept: 'Approval',
      fields: JSON.stringify([
        { name: 'status', type: 'String' },
        { name: 'approver', type: 'String' },
        { name: 'reasoning', type: 'String' },
      ]),
      actions: JSON.stringify(['approve', 'reject', 'request_changes']),
    });

    // Register affordance with bind mapping
    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
      },
      storage,
    );
  });

  it('resolves all slots via bind and exact-name match', async () => {
    const result = await contractCheckerHandler.check!(
      { checker: 'c1', widget: 'approval-detail', concept: 'Approval' },
      storage,
    );
    expect(result.variant).toBe('ok');

    const resolved = JSON.parse(result.resolved as string);
    const unresolved = JSON.parse(result.unresolved as string);
    const mismatches = JSON.parse(result.mismatches as string);

    expect(resolved.length).toBe(3);
    expect(unresolved.length).toBe(0);
    expect(mismatches.length).toBe(0);

    // Check resolution strategies
    const statusSlot = resolved.find((r: Record<string, unknown>) => r.slot === 'status');
    expect(statusSlot.source).toBe('exact-name');

    const actorSlot = resolved.find((r: Record<string, unknown>) => r.slot === 'actor');
    expect(actorSlot.source).toBe('bind');
    expect(actorSlot.field).toBe('approver');

    const bodySlot = resolved.find((r: Record<string, unknown>) => r.slot === 'body');
    expect(bodySlot.source).toBe('bind');
    expect(bodySlot.field).toBe('reasoning');
  });

  it('stores check result in contractCheck relation', async () => {
    await contractCheckerHandler.check!(
      { checker: 'stored-check', widget: 'approval-detail', concept: 'Approval' },
      storage,
    );
    const record = await storage.get('contractCheck', 'stored-check');
    expect(record).not.toBeNull();
    expect(record!.widget).toBe('approval-detail');
    expect(record!.concept).toBe('Approval');
    expect(record!.status).toBe('ok');
  });

  it('reports unresolved slots', async () => {
    await storage.put('widget', 'needs-more', {
      widget: 'needs-more',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'status', type: 'String' },
          { name: 'reviewer', type: 'entity' }, // no match
          { name: 'notes', type: 'String' },    // no match
        ],
      }),
    });

    const result = await contractCheckerHandler.check!(
      { checker: 'c2', widget: 'needs-more', concept: 'Approval' },
      storage,
    );
    expect(result.variant).toBe('ok');

    const resolved = JSON.parse(result.resolved as string);
    const unresolved = JSON.parse(result.unresolved as string);
    expect(resolved.length).toBe(1); // status
    expect(unresolved).toContain('reviewer');
    expect(unresolved).toContain('notes');
  });

  it('returns ok with empty arrays when widget has no contract', async () => {
    await storage.put('widget', 'no-contract', {
      widget: 'no-contract',
    });

    const result = await contractCheckerHandler.check!(
      { checker: 'c3', widget: 'no-contract', concept: 'Approval' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(JSON.parse(result.resolved as string)).toEqual([]);
    expect(JSON.parse(result.unresolved as string)).toEqual([]);
  });

  it('returns notfound for unregistered widget', async () => {
    const result = await contractCheckerHandler.check!(
      { checker: 'c4', widget: 'ghost-widget', concept: 'Approval' },
      storage,
    );
    expect(result.variant).toBe('notfound');
    expect((result.message as string)).toContain('ghost-widget');
  });

  it('returns notfound for unregistered concept', async () => {
    const result = await contractCheckerHandler.check!(
      { checker: 'c5', widget: 'approval-detail', concept: 'GhostConcept' },
      storage,
    );
    expect(result.variant).toBe('notfound');
    expect((result.message as string)).toContain('GhostConcept');
  });

  it('uses provided contractVersion', async () => {
    await contractCheckerHandler.check!(
      { checker: 'c6', widget: 'approval-detail', concept: 'Approval', contractVersion: 2 },
      storage,
    );
    const record = await storage.get('contractCheck', 'c6');
    expect(record!.contractVersion).toBe(2);
  });

  it('defaults to contract version from requires block', async () => {
    await contractCheckerHandler.check!(
      { checker: 'c7', widget: 'approval-detail', concept: 'Approval' },
      storage,
    );
    const record = await storage.get('contractCheck', 'c7');
    expect(record!.contractVersion).toBe(1);
  });

  it('handles concept with no fields', async () => {
    await storage.put('concept', 'Empty', {
      concept: 'Empty',
      fields: JSON.stringify([]),
      actions: JSON.stringify([]),
    });

    const result = await contractCheckerHandler.check!(
      { checker: 'c8', widget: 'approval-detail', concept: 'Empty' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const unresolved = JSON.parse(result.unresolved as string);
    expect(unresolved.length).toBe(3); // all contract slots unresolved
  });
});

// ---------------------------------------------------------------------------
// checkAll
// ---------------------------------------------------------------------------
describe('contractCheckerHandler.checkAll', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();

    // Register widgets
    await storage.put('widget', 'approval-detail', {
      widget: 'approval-detail',
      requires: JSON.stringify({ version: 1, fields: [{ name: 'status', type: 'String' }] }),
    });
    await storage.put('widget', 'approval-card', {
      widget: 'approval-card',
      requires: JSON.stringify({ version: 1, fields: [{ name: 'title', type: 'String' }] }),
    });

    // Register concept
    await storage.put('concept', 'Approval', {
      concept: 'Approval',
      fields: JSON.stringify([{ name: 'status', type: 'String' }, { name: 'title', type: 'String' }]),
      actions: JSON.stringify([]),
    });

    // Register in widget registry
    await storage.put('widgetRegistry', 'approval-detail/entity-detail', {
      entry: 'approval-detail/entity-detail',
      widget: 'approval-detail',
      interactor: 'entity-detail',
      concept: 'Approval',
      specificity: 20,
    });
    await storage.put('widgetRegistry', 'approval-card/entity-card', {
      entry: 'approval-card/entity-card',
      widget: 'approval-card',
      interactor: 'entity-card',
      concept: 'Approval',
      specificity: 20,
    });
  });

  it('checks all widgets for a concept', async () => {
    const result = await contractCheckerHandler.checkAll!(
      { checker: 'ca-1', concept: 'Approval' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const results = JSON.parse(result.results as string);
    expect(results.length).toBe(2);
  });

  it('returns notfound when no widgets registered for concept', async () => {
    const result = await contractCheckerHandler.checkAll!(
      { checker: 'ca-2', concept: 'Unknown' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// checkSuite
// ---------------------------------------------------------------------------
describe('contractCheckerHandler.checkSuite', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();

    await storage.put('widget', 'gov-detail', {
      widget: 'gov-detail',
      requires: JSON.stringify({ version: 1, fields: [{ name: 'status', type: 'String' }] }),
    });
    await storage.put('concept', 'Approval', {
      concept: 'Approval',
      fields: JSON.stringify([{ name: 'status', type: 'String' }]),
      actions: JSON.stringify([]),
    });

    await storage.put('widgetRegistry', 'gov-detail/entity-detail', {
      entry: 'gov-detail/entity-detail',
      widget: 'gov-detail',
      interactor: 'entity-detail',
      concept: 'Approval',
      suite: 'governance',
      specificity: 20,
    });

    // Entry without concept (suite-level fallback)
    await storage.put('widgetRegistry', 'gov-card/entity-card', {
      entry: 'gov-card/entity-card',
      widget: 'gov-card',
      interactor: 'entity-card',
      concept: null,
      suite: 'governance',
      specificity: 12,
    });
  });

  it('checks all concept-widget pairs in a suite', async () => {
    const result = await contractCheckerHandler.checkSuite!(
      { checker: 'cs-1', suite: 'governance' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const results = JSON.parse(result.results as string);
    // Only entries with a concept are checked
    expect(results.length).toBe(1);
    expect(results[0].concept).toBe('Approval');
  });

  it('returns notfound for empty suite', async () => {
    const result = await contractCheckerHandler.checkSuite!(
      { checker: 'cs-2', suite: 'unknown-suite' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// suggest
// ---------------------------------------------------------------------------
describe('contractCheckerHandler.suggest', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();

    await storage.put('widget', 'needs-bind', {
      widget: 'needs-bind',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'actor', type: 'String' },
          { name: 'rating', type: 'Int' },
        ],
      }),
    });

    await storage.put('concept', 'Review', {
      concept: 'Review',
      fields: JSON.stringify([
        { name: 'reviewer', type: 'String' },
        { name: 'author', type: 'String' },
        { name: 'score', type: 'Int' },
        { name: 'comment', type: 'String' },
      ]),
      actions: JSON.stringify([]),
    });
  });

  it('suggests candidate fields for unresolved slots', async () => {
    const result = await contractCheckerHandler.suggest!(
      { checker: 'sg-1', widget: 'needs-bind', concept: 'Review' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const suggestions = JSON.parse(result.suggestions as string);
    expect(suggestions.length).toBe(2);

    // actor (String) should suggest reviewer, author, comment (all String-compatible)
    const actorSuggestion = suggestions.find((s: Record<string, unknown>) => s.slot === 'actor');
    expect(actorSuggestion).toBeDefined();
    expect(actorSuggestion.candidates.length).toBeGreaterThanOrEqual(2);

    // rating (Int) should suggest score (Int)
    const ratingSuggestion = suggestions.find((s: Record<string, unknown>) => s.slot === 'rating');
    expect(ratingSuggestion).toBeDefined();
    expect(ratingSuggestion.candidates.length).toBeGreaterThanOrEqual(1);
    expect(ratingSuggestion.candidates[0].field).toBe('score');
  });

  it('returns resolved when all slots are already resolved', async () => {
    await storage.put('widget', 'all-resolved', {
      widget: 'all-resolved',
      requires: JSON.stringify({
        version: 1,
        fields: [{ name: 'reviewer', type: 'String' }],
      }),
    });

    const result = await contractCheckerHandler.suggest!(
      { checker: 'sg-2', widget: 'all-resolved', concept: 'Review' },
      storage,
    );
    expect(result.variant).toBe('resolved');
  });

  it('returns notfound for missing widget', async () => {
    const result = await contractCheckerHandler.suggest!(
      { checker: 'sg-3', widget: 'ghost', concept: 'Review' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('returns notfound for missing concept', async () => {
    const result = await contractCheckerHandler.suggest!(
      { checker: 'sg-4', widget: 'needs-bind', concept: 'Ghost' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('type compatibility: String matches any concept field', async () => {
    await storage.put('widget', 'string-widget', {
      widget: 'string-widget',
      requires: JSON.stringify({ version: 1, fields: [{ name: 'data', type: 'String' }] }),
    });

    const result = await contractCheckerHandler.suggest!(
      { checker: 'sg-5', widget: 'string-widget', concept: 'Review' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const suggestions = JSON.parse(result.suggestions as string);
    const dataSuggestion = suggestions.find((s: Record<string, unknown>) => s.slot === 'data');
    // String is universal, should match all fields
    expect(dataSuggestion.candidates.length).toBe(4);
  });

  it('type compatibility: collection matches list and set types', async () => {
    await storage.put('widget', 'coll-widget', {
      widget: 'coll-widget',
      requires: JSON.stringify({ version: 1, fields: [{ name: 'items', type: 'collection' }] }),
    });
    await storage.put('concept', 'Container', {
      concept: 'Container',
      fields: JSON.stringify([
        { name: 'entries', type: 'list String' },
        { name: 'tags', type: 'set String' },
        { name: 'title', type: 'String' },
      ]),
      actions: JSON.stringify([]),
    });

    const result = await contractCheckerHandler.suggest!(
      { checker: 'sg-6', widget: 'coll-widget', concept: 'Container' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const suggestions = JSON.parse(result.suggestions as string);
    const itemsSuggestion = suggestions.find((s: Record<string, unknown>) => s.slot === 'items');
    // Should match entries (list) and tags (set), not title (String)
    expect(itemsSuggestion.candidates.length).toBe(2);
  });
});
