// Entity Pipeline — Conformance Tests
// Validates concept-level widget mapping: entity interactor classification,
// concept-level affordance matching, contract resolution, multi-concept
// binding, field-level fallback, and contract diagnostics.

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared in-memory storage
// ---------------------------------------------------------------------------
type StorageMap = Map<string, Map<string, Record<string, unknown>>>;

interface TestStorage {
  get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  delete: (relation: string, key: string) => Promise<boolean>;
  find: (relation: string, prefix?: string) => Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
  const store: StorageMap = new Map();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    // Handlers do their own filtering after find(), so return all entries.
    // The prefix parameter is ignored — handlers pass it as a hint but
    // the in-memory store doesn't need it.
    find: async (relation, _prefix?) => {
      const map = store.get(relation);
      if (!map) return [...(map?.values() ?? [])];
      return [...map.values()];
    },
  };
}

// ---------------------------------------------------------------------------
// Handler imports (relative to worktree)
// ---------------------------------------------------------------------------
// These tests validate the handler logic directly without fp-ts wrappers,
// since the handlers are plain async functions returning variant objects.

import { interactorHandler } from '../handlers/ts/app/interactor.handler.js';
import { affordanceHandler } from '../handlers/ts/app/affordance.handler.js';
import { widgetResolverHandler } from '../handlers/ts/app/widget-resolver.handler.js';
import { contractCheckerHandler } from '../handlers/ts/app/contract-checker.handler.js';
import { widgetRegistryHandler } from '../handlers/ts/app/widget-registry.handler.js';
import { uiSchemaHandler } from '../handlers/ts/app/ui-schema.handler.js';

// ---------------------------------------------------------------------------
// 1. Entity Interactor Classification
// ---------------------------------------------------------------------------
describe('Entity Interactor Classification', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('defines an entity-category interactor', async () => {
    const result = await interactorHandler.define!(
      {
        interactor: 'entity-interactor',
        name: 'entity-detail',
        category: 'entity',
        properties: JSON.stringify({ concept: null, suite: null }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
  });

  it('classifies entity element with detail view', async () => {
    // Define entity interactor so storage.find returns it
    await interactorHandler.define!(
      {
        interactor: 'entity-detail-def',
        name: 'entity-detail',
        category: 'entity',
        properties: JSON.stringify({ concept: null }),
      },
      storage,
    );

    const result = await interactorHandler.classify!(
      {
        interactor: 'test-entity-classify',
        fieldType: 'entity',
        constraints: JSON.stringify({ view: 'detail', concept: 'Approval' }),
        intent: null,
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    // classify returns 'interactor' field (not 'interactorType')
    expect(result.interactor).toBe('entity-detail-def');
    expect(result.concept).toBe('Approval');
  });

  it('classifies entity element with list view as entity-card', async () => {
    await interactorHandler.define!(
      {
        interactor: 'entity-card-def',
        name: 'entity-card',
        category: 'entity',
        properties: JSON.stringify({ concept: null }),
      },
      storage,
    );

    const result = await interactorHandler.classify!(
      {
        interactor: 'test-card-classify',
        fieldType: 'entity',
        constraints: JSON.stringify({ view: 'list', concept: 'Approval' }),
        intent: null,
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.interactor).toBe('entity-card-def');
  });

  it('rejects invalid category in define', async () => {
    const result = await interactorHandler.define!(
      {
        interactor: 'bad-category',
        name: 'bad',
        category: 'nonexistent-category',
        properties: '{}',
      },
      storage,
    );

    // Handler returns 'duplicate' variant for invalid category
    expect(result.variant).toBe('duplicate');
    expect((result.message as string)).toContain('Invalid category');
  });
});

// ---------------------------------------------------------------------------
// 2. Concept-Level Affordance Matching
// ---------------------------------------------------------------------------
describe('Concept-Level Affordance Matching', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('declares an affordance with concept condition', async () => {
    const result = await affordanceHandler.declare!(
      {
        affordance: 'approval-entity-detail',
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
  });

  it('matches affordance by concept condition', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'approval-entity-detail',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver' }),
        contractVersion: 1,
      },
      storage,
    );

    const result = await affordanceHandler.match!(
      {
        affordance: 'match-test',
        interactor: 'entity-detail',
        context: JSON.stringify({ concept: 'Approval' }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].widget).toBe('approval-detail');
  });

  it('matches affordance by suite condition', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'governance-fallback',
        widget: 'governance-entity-card',
        interactor: 'entity-card',
        specificity: 12,
        conditions: JSON.stringify({ suite: 'governance' }),
      },
      storage,
    );

    const result = await affordanceHandler.match!(
      {
        affordance: 'suite-match-test',
        interactor: 'entity-card',
        context: JSON.stringify({ suite: 'governance' }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const matches = JSON.parse(result.matches as string);
    expect(matches[0].widget).toBe('governance-entity-card');
  });

  it('does not match when concept does not match', async () => {
    await affordanceHandler.declare!(
      {
        affordance: 'approval-only',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
      },
      storage,
    );

    const result = await affordanceHandler.match!(
      {
        affordance: 'mismatch-test',
        interactor: 'entity-detail',
        context: JSON.stringify({ concept: 'Workflow' }),
      },
      storage,
    );

    // Should get no matches or none variant
    if (result.variant === 'ok') {
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(0);
    } else {
      expect(result.variant).toBe('none');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Widget Contract Resolution
// ---------------------------------------------------------------------------
describe('Widget Contract Resolution', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();

    // Register a widget with a requires contract
    await storage.put('widget', 'approval-detail', {
      widget: 'approval-detail',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'status', type: 'String' },
          { name: 'actor', type: 'entity' },
          { name: 'body', type: 'String' },
        ],
        actions: [
          { name: 'approve' },
          { name: 'reject' },
        ],
      }),
    });

    // Register a concept
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
    await storage.put('affordance', 'approval-entity-detail', {
      affordance: 'approval-entity-detail',
      widget: 'approval-detail',
      interactor: 'entity-detail',
      specificity: 20,
      conditions: JSON.stringify({ concept: 'Approval' }),
      bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
    });
  });

  it('resolves entity widget with contract validation', async () => {
    // Register the affordance via handler for proper find() support
    await affordanceHandler.declare!(
      {
        affordance: 'approval-entity-detail',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
        contractVersion: 1,
      },
      storage,
    );

    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'test-resolver',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
            { name: 'reasoning', type: 'String' },
          ],
          actions: ['approve', 'reject', 'request_changes'],
        }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.widget).toBe('approval-detail');

    // Verify binding map was created
    if (result.bindingMap) {
      const bindingMap = JSON.parse(result.bindingMap as string);
      expect(bindingMap.actor).toBe('approver');
      expect(bindingMap.body).toBe('reasoning');
      expect(bindingMap.status).toBe('status');
    }
  });

  it('disqualifies widget when contract cannot be satisfied', async () => {
    // Widget requires fields that concept doesn't have
    await storage.put('widget', 'workflow-editor', {
      widget: 'workflow-editor',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'nodes', type: 'list Object' },
          { name: 'edges', type: 'list Object' },
        ],
      }),
    });

    await affordanceHandler.declare!(
      {
        affordance: 'workflow-entity-editor',
        widget: 'workflow-editor',
        interactor: 'entity-editor',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
      },
      storage,
    );

    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'disqualify-test',
        element: 'entity-editor',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
          ],
          actions: ['approve', 'reject'],
        }),
      },
      storage,
    );

    // Widget should be disqualified, resulting in 'none'
    expect(result.variant).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// 4. ContractChecker Static Validation
// ---------------------------------------------------------------------------
describe('ContractChecker', () => {
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
        actions: [
          { name: 'approve' },
          { name: 'reject' },
        ],
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

    // Register affordance with bind
    await affordanceHandler.declare!(
      {
        affordance: 'approval-entity-detail',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver', body: 'reasoning' }),
      },
      storage,
    );
  });

  it('checks a widget contract against a concept spec', async () => {
    const result = await contractCheckerHandler.check!(
      {
        checker: 'test-check',
        widget: 'approval-detail',
        concept: 'Approval',
      },
      storage,
    );

    expect(result.variant).toBe('ok');

    const resolved = JSON.parse(result.resolved as string);
    const unresolved = JSON.parse(result.unresolved as string);

    // status resolves by exact name, actor and body by bind mapping
    expect(resolved.length).toBeGreaterThanOrEqual(2);
    expect(unresolved.length).toBe(0);
  });

  it('reports unresolved slots when bind mapping is missing', async () => {
    // Register widget with a slot that has no match
    await storage.put('widget', 'custom-widget', {
      widget: 'custom-widget',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'status', type: 'String' },
          { name: 'reviewer', type: 'entity' },
          { name: 'notes', type: 'String' },
        ],
      }),
    });

    const result = await contractCheckerHandler.check!(
      {
        checker: 'gap-check',
        widget: 'custom-widget',
        concept: 'Approval',
      },
      storage,
    );

    expect(result.variant).toBe('ok');

    const unresolved = JSON.parse(result.unresolved as string);
    // 'reviewer' and 'notes' have no exact match and no bind mapping
    expect(unresolved).toContain('reviewer');
    expect(unresolved).toContain('notes');
  });

  it('suggests candidate fields for unresolved slots', async () => {
    await storage.put('widget', 'needs-suggestions', {
      widget: 'needs-suggestions',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'actor', type: 'String' },
        ],
      }),
    });

    const result = await contractCheckerHandler.suggest!(
      {
        checker: 'suggest-test',
        widget: 'needs-suggestions',
        concept: 'Approval',
      },
      storage,
    );

    expect(result.variant).toBe('ok');

    const suggestions = JSON.parse(result.suggestions as string);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].slot).toBe('actor');
    // Should suggest String-type concept fields
    expect(suggestions[0].candidates.length).toBeGreaterThan(0);
  });

  it('returns notfound for unregistered widget', async () => {
    const result = await contractCheckerHandler.check!(
      {
        checker: 'missing-check',
        widget: 'nonexistent-widget',
        concept: 'Approval',
      },
      storage,
    );

    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// 5. WidgetRegistry
// ---------------------------------------------------------------------------
describe('WidgetRegistry', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('registers an entity-level affordance entry', async () => {
    const result = await widgetRegistryHandler.register!(
      {
        entry: 'approval-detail/entity-detail',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        concept: 'Approval',
        suite: 'governance',
        tags: '["stateful", "approvable"]',
        specificity: 20,
        contractVersion: 1,
        contractSlots: '["status", "actor", "body"]',
        contractActions: '["approve", "reject"]',
        secondaryRoles: '["comments", "history"]',
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.entry).toBe('approval-detail/entity-detail');
  });

  it('queries entries by concept', async () => {
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
      storage,
    );

    await widgetRegistryHandler.register!(
      {
        entry: 'governance-card/entity-card',
        widget: 'governance-entity-card',
        interactor: 'entity-card',
        concept: null,
        suite: 'governance',
        tags: '[]',
        specificity: 12,
        contractVersion: 1,
        contractSlots: '[]',
        contractActions: '[]',
        secondaryRoles: '[]',
      },
      storage,
    );

    const result = await widgetRegistryHandler.query!(
      { concept: 'Approval', suite: null, interactor: null },
      storage,
    );

    expect(result.variant).toBe('ok');
    const entries = JSON.parse(result.entries as string);
    expect(entries.length).toBe(1);
    expect(entries[0].widget).toBe('approval-detail');
  });

  it('rejects duplicate registration', async () => {
    await widgetRegistryHandler.register!(
      {
        entry: 'dup-test',
        widget: 'w',
        interactor: 'entity-detail',
        concept: 'Approval',
        suite: null,
        tags: '[]',
        specificity: 10,
        contractVersion: 1,
        contractSlots: '[]',
        contractActions: '[]',
        secondaryRoles: '[]',
      },
      storage,
    );

    const result = await widgetRegistryHandler.register!(
      {
        entry: 'dup-test',
        widget: 'w',
        interactor: 'entity-detail',
        concept: 'Approval',
        suite: null,
        tags: '[]',
        specificity: 10,
        contractVersion: 1,
        contractSlots: '[]',
        contractActions: '[]',
        secondaryRoles: '[]',
      },
      storage,
    );

    expect(result.variant).toBe('duplicate');
  });

  it('removes an entry', async () => {
    await widgetRegistryHandler.register!(
      {
        entry: 'remove-me',
        widget: 'w',
        interactor: 'entity-detail',
        concept: 'X',
        suite: null,
        tags: '[]',
        specificity: 10,
        contractVersion: 1,
        contractSlots: '[]',
        contractActions: '[]',
        secondaryRoles: '[]',
      },
      storage,
    );

    const result = await widgetRegistryHandler.remove!(
      { entry: 'remove-me' },
      storage,
    );

    expect(result.variant).toBe('ok');
  });

  it('returns notfound for removing nonexistent entry', async () => {
    const result = await widgetRegistryHandler.remove!(
      { entry: 'does-not-exist' },
      storage,
    );

    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// 6. UISchema Entity Element Emission
// ---------------------------------------------------------------------------
describe('UISchema Entity Element Emission', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('emits entity element from concept with surface annotations', async () => {
    // Register a concept spec that includes surface annotations
    await storage.put('concept', 'Approval', {
      name: 'Approval',
      suite: 'governance',
      fields: JSON.stringify([
        { name: 'status', type: 'String' },
        { name: 'approver', type: 'String' },
      ]),
      actions: JSON.stringify(['approve', 'reject']),
      annotations: JSON.stringify({
        surface: { preferredView: 'entity-detail', tags: ['stateful'] },
      }),
    });

    const result = await uiSchemaHandler.inspect!(
      {
        schema: 'test-entity-schema',
        conceptSpec: JSON.stringify({
          name: 'Approval',
          suite: 'governance',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
          ],
          actions: ['approve', 'reject'],
          annotations: {
            surface: { preferredView: 'entity-detail', tags: ['stateful'] },
          },
        }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
  });

  it('retrieves entity element after inspection', async () => {
    await uiSchemaHandler.inspect!(
      {
        schema: 'entity-elem-test',
        conceptSpec: JSON.stringify({
          name: 'Approval',
          suite: 'governance',
          fields: [
            { name: 'status', type: 'String' },
          ],
          actions: ['approve'],
          annotations: {
            surface: { preferredView: 'entity-detail' },
          },
        }),
      },
      storage,
    );

    const result = await uiSchemaHandler.getEntityElement!(
      { schema: 'entity-elem-test' },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.entityElement).toBeDefined();
  });

  it('marks schema as resolved to bypass field pipeline', async () => {
    await uiSchemaHandler.inspect!(
      {
        schema: 'resolve-test',
        conceptSpec: JSON.stringify({
          name: 'Approval',
          fields: [{ name: 'status', type: 'String' }],
          actions: [],
        }),
      },
      storage,
    );

    const markResult = await uiSchemaHandler.markResolved!(
      { schema: 'resolve-test' },
      storage,
    );

    expect(markResult.variant).toBe('ok');

    // After marking resolved, getElements should indicate resolved state
    const elemResult = await uiSchemaHandler.getElements!(
      { schema: 'resolve-test' },
      storage,
    );

    expect(elemResult.variant).toBe('resolved');
  });
});

// ---------------------------------------------------------------------------
// 7. Field-Level Fallback
// ---------------------------------------------------------------------------
describe('Field-Level Fallback', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  it('falls through to field pipeline when no entity widget matches', async () => {
    // No entity affordances registered — resolve should return 'none'
    const result = await widgetResolverHandler.resolve!(
      {
        resolver: 'fallback-test',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'UnknownConcept',
          fields: [{ name: 'title', type: 'String' }],
          actions: [],
        }),
      },
      storage,
    );

    // No matching entity widget → field-level pipeline should run instead
    expect(result.variant).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// 8. WidgetResolver Explain with Contract Diagnostics
// ---------------------------------------------------------------------------
describe('WidgetResolver Explain', () => {
  let storage: TestStorage;

  beforeEach(async () => {
    storage = createTestStorage();

    // Set up resolver with weights
    await storage.put('resolver', 'explain-resolver', {
      resolver: 'explain-resolver',
      overrides: '{}',
      defaultContext: '{}',
      scoringWeights: JSON.stringify({
        specificity: 0.4,
        conditionMatch: 0.3,
        popularity: 0.2,
        recency: 0.1,
      }),
    });
  });

  it('explains resolution with contract validation details', async () => {
    // First run a resolution to populate diagnostics
    await storage.put('widget', 'approval-detail', {
      widget: 'approval-detail',
      requires: JSON.stringify({
        version: 1,
        fields: [
          { name: 'status', type: 'String' },
          { name: 'actor', type: 'entity' },
        ],
      }),
    });

    await affordanceHandler.declare!(
      {
        affordance: 'approval-aff',
        widget: 'approval-detail',
        interactor: 'entity-detail',
        specificity: 20,
        conditions: JSON.stringify({ concept: 'Approval' }),
        bind: JSON.stringify({ actor: 'approver' }),
      },
      storage,
    );

    // Run resolve to generate diagnostics
    await widgetResolverHandler.resolve!(
      {
        resolver: 'explain-resolver',
        element: 'entity-detail',
        context: JSON.stringify({
          concept: 'Approval',
          fields: [
            { name: 'status', type: 'String' },
            { name: 'approver', type: 'String' },
          ],
          actions: ['approve', 'reject'],
        }),
      },
      storage,
    );

    // Now explain the resolution
    const result = await widgetResolverHandler.explain!(
      {
        resolver: 'explain-resolver',
        element: 'entity-detail',
        context: JSON.stringify({ concept: 'Approval' }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.explanation).toBeDefined();

    const explanation = JSON.parse(result.explanation as string);
    expect(explanation.element).toBe('entity-detail');
    expect(explanation.steps.length).toBeGreaterThan(0);
  });
});
