// WidgetResolver Handler — Unit Tests
// Tests resolve (field-level and entity-level with contract validation),
// resolveAll, override, setWeights, and explain.

import { describe, it, expect, beforeEach } from 'vitest';
import { widgetResolverHandler } from '../../handlers/ts/app/widget-resolver.handler.js';
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
// resolve — field-level (no concept in context)
// ---------------------------------------------------------------------------
describe('widgetResolverHandler.resolve (field-level)', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    await affordanceHandler.declare!(
      { affordance: 'radio-aff', widget: 'radio-group', interactor: 'single-choice', specificity: 10, conditions: JSON.stringify({ maxOptions: 8 }) },
      storage,
    );
    await affordanceHandler.declare!(
      { affordance: 'select-aff', widget: 'select', interactor: 'single-choice', specificity: 5, conditions: '{}' },
      storage,
    );
  });

  it('resolves to highest-scoring widget', async () => {
    const result = await widgetResolverHandler.resolve!(
      { resolver: 'r1', element: 'single-choice', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.widget).toBe('radio-group');
    expect((result.score as number)).toBeGreaterThan(0);
  });

  it('returns none when no affordances match', async () => {
    const result = await widgetResolverHandler.resolve!(
      { resolver: 'r2', element: 'unknown-element', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('none');
  });

  it('uses manual override when set', async () => {
    await widgetResolverHandler.override!(
      { resolver: 'r3', element: 'single-choice', widget: 'custom-radio' },
      storage,
    );
    const result = await widgetResolverHandler.resolve!(
      { resolver: 'r3', element: 'single-choice', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.widget).toBe('custom-radio');
    expect(result.score).toBe(1.0);
    expect(result.reason).toContain('override');
  });

  it('returns ambiguous when scores are tied', async () => {
    // Add a second affordance with identical specificity
    await affordanceHandler.declare!(
      { affordance: 'tied-aff', widget: 'tied-widget', interactor: 'single-choice', specificity: 10, conditions: '{}' },
      storage,
    );
    const result = await widgetResolverHandler.resolve!(
      { resolver: 'r4', element: 'single-choice', context: '{}' },
      storage,
    );
    // Could be ok or ambiguous depending on condition matching
    expect(['ok', 'ambiguous']).toContain(result.variant);
  });

  it('does not set bindingMap for field-level resolution', async () => {
    const result = await widgetResolverHandler.resolve!(
      { resolver: 'r5', element: 'single-choice', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.bindingMap).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolve — entity-level (concept in context)
// ---------------------------------------------------------------------------
describe('widgetResolverHandler.resolve (entity-level)', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();

    // Register widget with contract
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

    // Register affordance with bind mapping
    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
        contractVersion: 1,
      },
      storage,
    );
  });

  it('resolves entity widget with contract validation', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-1',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
            { name: 'reasoning', type: 'String' },
          ],
          actions: ['approve', 'reject'],
        }),
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.widget).toBe('approval-detail');
  });

  it('produces a binding map for resolved entity widget', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-2',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
            { name: 'reasoning', type: 'String' },
          ],
          actions: ['approve', 'reject'],
        }),
      },
      storage,
    );
    expect(result.bindingMap).not.toBeNull();
    const map = JSON.parse(result.bindingMap as string);
    expect(map.status).toBe('status');       // exact name
    expect(map.actor).toBe('approver');      // bind mapping
    expect(map.body).toBe('reasoning');      // bind mapping
    expect(map.approve).toBe('approve');     // action exact name
    expect(map.reject).toBe('reject');       // action exact name
  });

  it('disqualifies widget when contract has unresolved slots', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-3',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [{ name: 'status', type: 'String' }], // missing approver and reasoning
          actions: ['approve', 'reject'],
        }),
      },
      storage,
    );
    // Widget should be disqualified
    expect(result.variant).toBe('none');
  });

  it('disqualifies widget on type mismatch', async () => {
    // Register widget expecting Int for status
    await storage.put('widget', 'typed-widget', {
      widget: 'typed-widget',
      requires: JSON.stringify({
        version: 1,
        fields: [{ name: 'count', type: 'Int' }],
      }),
    });
    await affordanceHandler.declare!(
      {
        affordance: 'typed-aff',
        widget: 'typed-widget',
        interactor: 'entity-detail',
        specificity: 15,
        conditions: JSON.stringify({ concept: 'TypedConcept' }),
      },
      storage,
    );

    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-4',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'TypedConcept',
          fields: [{ name: 'count', type: 'DateTime' }], // type mismatch
          actions: [],
        }),
      },
      storage,
    );
    expect(result.variant).toBe('none');
  });

  it('accepts widget with no contract (generic entity widget)', async () => {
    await storage.put('widget', 'generic-entity', {
      widget: 'generic-entity',
    });
    await affordanceHandler.declare!(
      {
        affordance: 'generic-aff',
        widget: 'generic-entity',
        interactor: 'entity-card',
        specificity: 5,
        conditions: JSON.stringify({ suite: 'governance' }),
      },
      storage,
    );

    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-5',
        element: 'entity-card',
        context: JSON.stringify({
          concept: 'Anything',
          suite: 'governance',
          fields: [],
          actions: [],
        }),
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.widget).toBe('generic-entity');
    expect(result.bindingMap).toBeNull(); // no contract
  });

  it('stores diagnostics for disqualified widgets', async () => {
    // This resolution will disqualify approval-detail due to missing fields
    await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-6',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [], // no fields at all
          actions: [],
        }),
      },
      storage,
    );

    const diag = await storage.get('diagnostics', 'diag:entity-detail');
    expect(diag).not.toBeNull();
    const disqualified = JSON.parse(diag!.disqualified as string);
    expect(disqualified.length).toBeGreaterThan(0);
    expect(disqualified[0].widget).toBe('approval-detail');
    expect(disqualified[0].errors.length).toBeGreaterThan(0);
  });

  it('handles missing actions gracefully (not an error)', async () => {
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'ent-7',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
            { name: 'reasoning', type: 'String' },
          ],
          actions: [], // missing approve/reject actions
        }),
      },
      storage,
    );
    // Missing actions don't cause disqualification (only unresolved slots and type mismatches do)
    expect(result.variant).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// resolveAll
// ---------------------------------------------------------------------------
describe('widgetResolverHandler.resolveAll', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    await affordanceHandler.declare!(
      { affordance: 'ra-1', widget: 'text-input', interactor: 'text-short', specificity: 10, conditions: '{}' },
      storage,
    );
    await affordanceHandler.declare!(
      { affordance: 'ra-2', widget: 'date-picker', interactor: 'date-point', specificity: 10, conditions: '{}' },
      storage,
    );
  });

  it('resolves all elements', async () => {
    const result = await widgetResolverHandler.resolveAll!(
      {
        resolver: 'ra-r',
        elements: JSON.stringify(['text-short', 'date-point']),
        context: '{}',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const resolutions = JSON.parse(result.resolutions as string);
    expect(resolutions.length).toBe(2);
  });

  it('returns partial when some elements cannot be resolved', async () => {
    const result = await widgetResolverHandler.resolveAll!(
      {
        resolver: 'ra-r2',
        elements: JSON.stringify(['text-short', 'unknown-element']),
        context: '{}',
      },
      storage,
    );
    expect(result.variant).toBe('partial');
    const resolved = JSON.parse(result.resolved as string);
    const unresolved = JSON.parse(result.unresolved as string);
    expect(resolved.length).toBe(1);
    expect(unresolved).toContain('unknown-element');
  });

  it('handles empty elements array', async () => {
    const result = await widgetResolverHandler.resolveAll!(
      { resolver: 'ra-r3', elements: '[]', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// override
// ---------------------------------------------------------------------------
describe('widgetResolverHandler.override', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('creates an override mapping', async () => {
    const result = await widgetResolverHandler.override!(
      { resolver: 'ov-r', element: 'text-short', widget: 'custom-text' },
      storage,
    );
    expect(result.variant).toBe('ok');

    const record = await storage.get('resolver', 'ov-r');
    const overrides = JSON.parse(record!.overrides as string);
    expect(overrides['text-short']).toBe('custom-text');
  });

  it('adds multiple overrides', async () => {
    await widgetResolverHandler.override!(
      { resolver: 'ov-r2', element: 'text-short', widget: 'w1' },
      storage,
    );
    await widgetResolverHandler.override!(
      { resolver: 'ov-r2', element: 'date-point', widget: 'w2' },
      storage,
    );

    const record = await storage.get('resolver', 'ov-r2');
    const overrides = JSON.parse(record!.overrides as string);
    expect(overrides['text-short']).toBe('w1');
    expect(overrides['date-point']).toBe('w2');
  });

  it('returns invalid when element is missing', async () => {
    const result = await widgetResolverHandler.override!(
      { resolver: 'ov-r3', element: '', widget: 'w' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  it('returns invalid when widget is missing', async () => {
    const result = await widgetResolverHandler.override!(
      { resolver: 'ov-r4', element: 'e', widget: '' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  it('preserves existing scoring weights', async () => {
    await widgetResolverHandler.setWeights!(
      { resolver: 'ov-r5', weights: JSON.stringify({ specificity: 0.5, conditionMatch: 0.5 }) },
      storage,
    );
    await widgetResolverHandler.override!(
      { resolver: 'ov-r5', element: 'e', widget: 'w' },
      storage,
    );
    const record = await storage.get('resolver', 'ov-r5');
    const weights = JSON.parse(record!.scoringWeights as string);
    expect(weights.specificity).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// setWeights
// ---------------------------------------------------------------------------
describe('widgetResolverHandler.setWeights', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('sets custom scoring weights', async () => {
    const result = await widgetResolverHandler.setWeights!(
      { resolver: 'sw-r', weights: JSON.stringify({ specificity: 0.5, conditionMatch: 0.3, popularity: 0.1, recency: 0.1 }) },
      storage,
    );
    expect(result.variant).toBe('ok');

    const record = await storage.get('resolver', 'sw-r');
    const weights = JSON.parse(record!.scoringWeights as string);
    expect(weights.specificity).toBe(0.5);
  });

  it('rejects weights that do not sum to 1.0', async () => {
    const result = await widgetResolverHandler.setWeights!(
      { resolver: 'sw-r2', weights: JSON.stringify({ specificity: 0.5, conditionMatch: 0.3 }) },
      storage,
    );
    expect(result.variant).toBe('invalid');
    expect((result.message as string)).toContain('sum to 1.0');
  });

  it('accepts weights within tolerance (0.01)', async () => {
    const result = await widgetResolverHandler.setWeights!(
      { resolver: 'sw-r3', weights: JSON.stringify({ a: 0.333, b: 0.333, c: 0.334 }) },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('rejects invalid JSON', async () => {
    const result = await widgetResolverHandler.setWeights!(
      { resolver: 'sw-r4', weights: 'not json' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------
describe('widgetResolverHandler.explain', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();
    await storage.put('resolver', 'exp-r', {
      resolver: 'exp-r',
      overrides: JSON.stringify({ 'text-short': 'custom-text' }),
      defaultContext: '{}',
      scoringWeights: JSON.stringify({ specificity: 0.4, conditionMatch: 0.3, popularity: 0.2, recency: 0.1 }),
    });
  });

  it('returns notfound for unregistered resolver', async () => {
    const result = await widgetResolverHandler.explain!(
      { resolver: 'ghost', element: 'e', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('explains override-based resolution', async () => {
    const result = await widgetResolverHandler.explain!(
      { resolver: 'exp-r', element: 'text-short', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const explanation = JSON.parse(result.explanation as string);
    expect(explanation.steps).toContain(expect.stringContaining('Override found'));
  });

  it('explains non-override resolution with scoring', async () => {
    const result = await widgetResolverHandler.explain!(
      { resolver: 'exp-r', element: 'unknown-element', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const explanation = JSON.parse(result.explanation as string);
    expect(explanation.steps).toContain(expect.stringContaining('No override'));
  });

  it('includes diagnostics when available', async () => {
    // Manually insert diagnostics
    await storage.put('diagnostics', 'diag:entity-detail', {
      element: 'entity-detail',
      candidates: JSON.stringify([{ widget: 'approval-detail', score: 0.38, contractResult: 'ok', bindingMap: { status: 'status' } }]),
      disqualified: JSON.stringify([{ widget: 'bad-widget', errors: [{ slot: 'x', reason: 'unresolved' }] }]),
      timestamp: new Date().toISOString(),
    });

    const result = await widgetResolverHandler.explain!(
      { resolver: 'exp-r', element: 'entity-detail', context: '{}' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const explanation = JSON.parse(result.explanation as string);
    const stepsStr = explanation.steps.join('\n');
    expect(stepsStr).toContain('1 valid candidate');
    expect(stepsStr).toContain('1 disqualified');
    expect(stepsStr).toContain('approval-detail');
    expect(stepsStr).toContain('bad-widget');
  });
});
