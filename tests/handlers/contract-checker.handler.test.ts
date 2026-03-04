// ============================================================
// ContractChecker Handler Tests
//
// Validates widget contract checking against concept specs:
// field resolution (bind-first, exact-name), batch checking,
// suite-scoped checking, and type-compatible suggestions.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { contractCheckerHandler } from '../../handlers/ts/app/contract-checker.handler.js';

// ----------------------------------------------------------
// In-memory TestStorage
//
// The find() method returns ALL entries in the relation
// without filtering. Handlers do their own filtering internally.
// ----------------------------------------------------------

interface TestStorage {
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  del(relation: string, key: string): Promise<void>;
  find(relation: string, criteria?: unknown): Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
  const data = new Map<string, Map<string, Record<string, unknown>>>();

  function getRelation(name: string): Map<string, Record<string, unknown>> {
    let rel = data.get(name);
    if (!rel) {
      rel = new Map();
      data.set(name, rel);
    }
    return rel;
  }

  return {
    async get(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry } : null;
    },
    async put(relation, key, value) {
      const rel = getRelation(relation);
      rel.set(key, { ...value });
    },
    async del(relation, key) {
      const rel = getRelation(relation);
      rel.delete(key);
    },
    async find(relation, _criteria?) {
      const rel = getRelation(relation);
      return Array.from(rel.values()).map((e) => ({ ...e }));
    },
  };
}

// ----------------------------------------------------------
// Helper: seed common widget + concept data into storage
// ----------------------------------------------------------

async function seedArticleWidget(storage: TestStorage) {
  await storage.put('widget', 'ArticleCard', {
    name: 'ArticleCard',
    requires: JSON.stringify({
      version: 2,
      fields: [
        { name: 'title', type: 'String' },
        { name: 'body', type: 'String' },
        { name: 'author', type: 'String' },
      ],
    }),
  });
}

async function seedArticleConcept(storage: TestStorage) {
  await storage.put('concept', 'Article', {
    name: 'Article',
    fields: JSON.stringify([
      { name: 'title', type: 'String' },
      { name: 'body', type: 'String' },
      { name: 'createdAt', type: 'DateTime' },
    ]),
    actions: JSON.stringify(['create', 'update', 'delete']),
  });
}

// ----------------------------------------------------------
// Tests
// ----------------------------------------------------------

describe('ContractChecker Handler', () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = createTestStorage();
  });

  // ========================================================
  // check
  // ========================================================

  describe('check', () => {
    it('returns notfound when widget does not exist', async () => {
      const result = await contractCheckerHandler.check!(
        { checker: 'chk-1', widget: 'MissingWidget', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('MissingWidget');
    });

    it('returns ok with empty arrays when widget has no requires block', async () => {
      await storage.put('widget', 'EmptyWidget', { name: 'EmptyWidget' });

      const result = await contractCheckerHandler.check!(
        { checker: 'chk-2', widget: 'EmptyWidget', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      expect(result.checker).toBe('chk-2');
      expect(JSON.parse(result.resolved as string)).toEqual([]);
      expect(JSON.parse(result.unresolved as string)).toEqual([]);
      expect(JSON.parse(result.mismatches as string)).toEqual([]);
    });

    it('returns notfound when concept does not exist', async () => {
      await seedArticleWidget(storage);

      const result = await contractCheckerHandler.check!(
        { checker: 'chk-3', widget: 'ArticleCard', concept: 'MissingConcept' },
        storage as any,
      );

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('MissingConcept');
    });

    it('resolves slots by exact name match', async () => {
      await seedArticleWidget(storage);
      await seedArticleConcept(storage);

      const result = await contractCheckerHandler.check!(
        { checker: 'chk-4', widget: 'ArticleCard', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const resolved = JSON.parse(result.resolved as string);
      const unresolved = JSON.parse(result.unresolved as string);

      // title and body match by exact name
      const titleEntry = resolved.find((r: any) => r.slot === 'title');
      expect(titleEntry).toBeDefined();
      expect(titleEntry.source).toBe('exact-name');
      expect(titleEntry.field).toBe('title');

      const bodyEntry = resolved.find((r: any) => r.slot === 'body');
      expect(bodyEntry).toBeDefined();
      expect(bodyEntry.source).toBe('exact-name');

      // author has no match in concept
      expect(unresolved).toContain('author');
    });

    it('resolves slots via bind map before exact name match', async () => {
      await seedArticleWidget(storage);
      await seedArticleConcept(storage);

      // Add an affordance bind map that maps "title" to "body"
      await storage.put('affordance', 'entity-detail-ArticleCard', {
        widget: 'ArticleCard',
        bind: JSON.stringify({ title: 'body' }),
      });

      const result = await contractCheckerHandler.check!(
        { checker: 'chk-5', widget: 'ArticleCard', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const resolved = JSON.parse(result.resolved as string);

      // "title" slot should resolve via bind to "body" concept field
      const titleEntry = resolved.find((r: any) => r.slot === 'title');
      expect(titleEntry).toBeDefined();
      expect(titleEntry.source).toBe('bind');
      expect(titleEntry.field).toBe('body');

      // "body" slot still resolves by exact-name since no bind override
      const bodyEntry = resolved.find((r: any) => r.slot === 'body');
      expect(bodyEntry).toBeDefined();
      expect(bodyEntry.source).toBe('exact-name');
    });

    it('stores the contract check result in contractCheck relation', async () => {
      await seedArticleWidget(storage);
      await seedArticleConcept(storage);

      await contractCheckerHandler.check!(
        { checker: 'chk-6', widget: 'ArticleCard', concept: 'Article' },
        storage as any,
      );

      const stored = await storage.get('contractCheck', 'chk-6');
      expect(stored).not.toBeNull();
      expect(stored!.widget).toBe('ArticleCard');
      expect(stored!.concept).toBe('Article');
      // Has unresolved "author", so status should be error
      expect(stored!.status).toBe('error');
    });

    it('sets status ok when all slots are resolved', async () => {
      // Widget that only requires "title"
      await storage.put('widget', 'TitleOnly', {
        name: 'TitleOnly',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'title', type: 'String' }],
        }),
      });
      await seedArticleConcept(storage);

      await contractCheckerHandler.check!(
        { checker: 'chk-7', widget: 'TitleOnly', concept: 'Article' },
        storage as any,
      );

      const stored = await storage.get('contractCheck', 'chk-7');
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('ok');
    });

    it('uses contractVersion from input when provided', async () => {
      await storage.put('widget', 'TitleOnly', {
        name: 'TitleOnly',
        requires: JSON.stringify({
          version: 5,
          fields: [{ name: 'title', type: 'String' }],
        }),
      });
      await seedArticleConcept(storage);

      await contractCheckerHandler.check!(
        { checker: 'chk-8', widget: 'TitleOnly', concept: 'Article', contractVersion: 99 },
        storage as any,
      );

      const stored = await storage.get('contractCheck', 'chk-8');
      expect(stored!.contractVersion).toBe(99);
    });

    it('falls back to requires.version when contractVersion not provided', async () => {
      await storage.put('widget', 'TitleOnly', {
        name: 'TitleOnly',
        requires: JSON.stringify({
          version: 5,
          fields: [{ name: 'title', type: 'String' }],
        }),
      });
      await seedArticleConcept(storage);

      await contractCheckerHandler.check!(
        { checker: 'chk-9', widget: 'TitleOnly', concept: 'Article' },
        storage as any,
      );

      const stored = await storage.get('contractCheck', 'chk-9');
      expect(stored!.contractVersion).toBe(5);
    });

    it('falls back to 1 when neither contractVersion nor requires.version exists', async () => {
      await storage.put('widget', 'NoVersion', {
        name: 'NoVersion',
        requires: JSON.stringify({
          fields: [{ name: 'title', type: 'String' }],
        }),
      });
      await seedArticleConcept(storage);

      await contractCheckerHandler.check!(
        { checker: 'chk-10', widget: 'NoVersion', concept: 'Article' },
        storage as any,
      );

      const stored = await storage.get('contractCheck', 'chk-10');
      expect(stored!.contractVersion).toBe(1);
    });

    it('bind map only applies to the matching widget', async () => {
      await seedArticleWidget(storage);
      await seedArticleConcept(storage);

      // Affordance for a different widget
      await storage.put('affordance', 'entity-detail-OtherWidget', {
        widget: 'OtherWidget',
        bind: JSON.stringify({ title: 'body' }),
      });

      const result = await contractCheckerHandler.check!(
        { checker: 'chk-11', widget: 'ArticleCard', concept: 'Article' },
        storage as any,
      );

      const resolved = JSON.parse(result.resolved as string);
      const titleEntry = resolved.find((r: any) => r.slot === 'title');
      // Should NOT use the bind map from OtherWidget; should resolve by exact-name
      expect(titleEntry.source).toBe('exact-name');
    });
  });

  // ========================================================
  // checkAll
  // ========================================================

  describe('checkAll', () => {
    it('returns notfound when no widgets are registered', async () => {
      // Fresh storage has no widgetRegistry entries at all
      const result = await contractCheckerHandler.checkAll!(
        { checker: 'chk-all-1', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('Article');
    });

    it('checks all registered widgets against the concept', async () => {
      await seedArticleConcept(storage);

      // Register two widgets in widgetRegistry
      await storage.put('widgetRegistry', 'ArticleCard', {
        widget: 'ArticleCard',
        interactor: 'viewer',
        specificity: 1,
      });
      await storage.put('widgetRegistry', 'ArticleForm', {
        widget: 'ArticleForm',
        interactor: 'editor',
        specificity: 2,
      });

      // Seed actual widget records so check() can find them
      await storage.put('widget', 'ArticleCard', {
        name: 'ArticleCard',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'title', type: 'String' }],
        }),
      });
      await storage.put('widget', 'ArticleForm', {
        name: 'ArticleForm',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'title', type: 'String' }, { name: 'body', type: 'String' }],
        }),
      });

      const result = await contractCheckerHandler.checkAll!(
        { checker: 'batch', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const results = JSON.parse(result.results as string);
      expect(results).toHaveLength(2);

      // Each result includes widget name and interactor from registry
      const cardResult = results.find((r: any) => r.widget === 'ArticleCard');
      expect(cardResult).toBeDefined();
      expect(cardResult.interactor).toBe('viewer');
      expect(cardResult.specificity).toBe(1);

      const formResult = results.find((r: any) => r.widget === 'ArticleForm');
      expect(formResult).toBeDefined();
      expect(formResult.interactor).toBe('editor');
    });

    it('uses checker/widget naming convention for sub-checks', async () => {
      await seedArticleConcept(storage);

      await storage.put('widgetRegistry', 'CardWidget', {
        widget: 'CardWidget',
        interactor: 'viewer',
        specificity: 1,
      });
      await storage.put('widget', 'CardWidget', {
        name: 'CardWidget',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'title', type: 'String' }],
        }),
      });

      await contractCheckerHandler.checkAll!(
        { checker: 'batch-parent', concept: 'Article' },
        storage as any,
      );

      // The sub-check should have stored with key "batch-parent/CardWidget"
      const stored = await storage.get('contractCheck', 'batch-parent/CardWidget');
      expect(stored).not.toBeNull();
      expect(stored!.widget).toBe('CardWidget');
    });
  });

  // ========================================================
  // checkSuite
  // ========================================================

  describe('checkSuite', () => {
    it('returns notfound when no widgets are in the registry', async () => {
      // Fresh storage with empty widgetRegistry
      const result = await contractCheckerHandler.checkSuite!(
        { checker: 'suite-chk-1', suite: 'collaboration' },
        storage as any,
      );

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('collaboration');
    });

    it('only checks entries that have a concept field', async () => {
      // Entry with concept
      await storage.put('widgetRegistry', 'ArticleCard', {
        widget: 'ArticleCard',
        concept: 'Article',
      });
      // Entry without concept (should be skipped)
      await storage.put('widgetRegistry', 'OrphanWidget', {
        widget: 'OrphanWidget',
      });

      await seedArticleConcept(storage);
      await storage.put('widget', 'ArticleCard', {
        name: 'ArticleCard',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'title', type: 'String' }],
        }),
      });

      const result = await contractCheckerHandler.checkSuite!(
        { checker: 'suite-chk-2', suite: 'content' },
        storage as any,
      );

      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      // Only ArticleCard should appear (OrphanWidget lacks concept)
      expect(results).toHaveLength(1);
      expect(results[0].widget).toBe('ArticleCard');
      expect(results[0].concept).toBe('Article');
    });

    it('returns ok with empty results when all entries lack concept', async () => {
      // All entries lack a concept field
      await storage.put('widgetRegistry', 'NoConceptWidget', {
        widget: 'NoConceptWidget',
      });

      const result = await contractCheckerHandler.checkSuite!(
        { checker: 'suite-chk-3', suite: 'empty-suite' },
        storage as any,
      );

      // Entries exist but none have concept, so results array is empty
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results).toHaveLength(0);
    });
  });

  // ========================================================
  // suggest
  // ========================================================

  describe('suggest', () => {
    it('returns notfound when widget is missing', async () => {
      const result = await contractCheckerHandler.suggest!(
        { checker: 'sug-1', widget: 'MissingWidget', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('notfound');
    });

    it('returns resolved when all slots are already resolved', async () => {
      // Widget requires only "title", concept has "title"
      await storage.put('widget', 'TitleOnly', {
        name: 'TitleOnly',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'title', type: 'String' }],
        }),
      });
      await seedArticleConcept(storage);

      const result = await contractCheckerHandler.suggest!(
        { checker: 'sug-2', widget: 'TitleOnly', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('resolved');
      expect(result.message).toContain('no suggestions');
    });

    it('suggests type-compatible fields for unresolved String slots', async () => {
      // Widget requires "author" (String) which doesn't exist in the concept
      await seedArticleWidget(storage);
      await seedArticleConcept(storage);

      const result = await contractCheckerHandler.suggest!(
        { checker: 'sug-3', widget: 'ArticleCard', concept: 'Article' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const suggestions = JSON.parse(result.suggestions as string);
      // "author" slot is unresolved
      const authorSuggestion = suggestions.find((s: any) => s.slot === 'author');
      expect(authorSuggestion).toBeDefined();

      // isTypeCompatible('String', anything) is always true
      // So all concept fields are candidates
      expect(authorSuggestion.candidates.length).toBe(3);
    });

    it('suggests enum-compatible fields', async () => {
      await storage.put('widget', 'StatusWidget', {
        name: 'StatusWidget',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'status', type: 'enum' }],
        }),
      });
      await storage.put('concept', 'Task', {
        name: 'Task',
        fields: JSON.stringify([
          { name: 'priority', type: 'String' },
          { name: 'state', type: 'enum(open,closed)' },
          { name: 'count', type: 'Integer' },
        ]),
        actions: JSON.stringify([]),
      });

      const result = await contractCheckerHandler.suggest!(
        { checker: 'sug-4', widget: 'StatusWidget', concept: 'Task' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const suggestions = JSON.parse(result.suggestions as string);
      const statusSuggestion = suggestions.find((s: any) => s.slot === 'status');
      expect(statusSuggestion).toBeDefined();

      // enum is compatible with: String, and types containing "enum"
      // priority (String) -> yes; state (enum(open,closed)) -> yes; count (Integer) -> no
      const candidateNames = statusSuggestion.candidates.map((c: any) => c.field);
      expect(candidateNames).toContain('priority');
      expect(candidateNames).toContain('state');
      expect(candidateNames).not.toContain('count');
    });

    it('suggests entity-compatible fields', async () => {
      await storage.put('widget', 'RefWidget', {
        name: 'RefWidget',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'owner', type: 'entity' }],
        }),
      });
      await storage.put('concept', 'Project', {
        name: 'Project',
        fields: JSON.stringify([
          { name: 'creator', type: 'User->ID' },
          { name: 'name', type: 'String' },
          { name: 'count', type: 'Integer' },
        ]),
        actions: JSON.stringify([]),
      });

      const result = await contractCheckerHandler.suggest!(
        { checker: 'sug-5', widget: 'RefWidget', concept: 'Project' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const suggestions = JSON.parse(result.suggestions as string);
      const ownerSuggestion = suggestions.find((s: any) => s.slot === 'owner');
      expect(ownerSuggestion).toBeDefined();

      // entity is compatible with: types containing '->' and String
      // creator (User->ID) -> yes; name (String) -> yes; count (Integer) -> no
      const candidateNames = ownerSuggestion.candidates.map((c: any) => c.field);
      expect(candidateNames).toContain('creator');
      expect(candidateNames).toContain('name');
      expect(candidateNames).not.toContain('count');
    });

    it('suggests collection-compatible fields', async () => {
      await storage.put('widget', 'ListWidget', {
        name: 'ListWidget',
        requires: JSON.stringify({
          version: 1,
          fields: [{ name: 'items', type: 'collection' }],
        }),
      });
      await storage.put('concept', 'Container', {
        name: 'Container',
        fields: JSON.stringify([
          { name: 'entries', type: 'list<Item>' },
          { name: 'tags', type: 'set<String>' },
          { name: 'label', type: 'String' },
          { name: 'count', type: 'Integer' },
        ]),
        actions: JSON.stringify([]),
      });

      const result = await contractCheckerHandler.suggest!(
        { checker: 'sug-6', widget: 'ListWidget', concept: 'Container' },
        storage as any,
      );

      expect(result.variant).toBe('ok');

      const suggestions = JSON.parse(result.suggestions as string);
      const itemsSuggestion = suggestions.find((s: any) => s.slot === 'items');
      expect(itemsSuggestion).toBeDefined();

      // collection is compatible with: list*, set*
      // entries (list<Item>) -> yes; tags (set<String>) -> yes;
      // label (String) -> no; count (Integer) -> no
      const candidateNames = itemsSuggestion.candidates.map((c: any) => c.field);
      expect(candidateNames).toContain('entries');
      expect(candidateNames).toContain('tags');
      expect(candidateNames).not.toContain('label');
      expect(candidateNames).not.toContain('count');
    });
  });

  // ========================================================
  // Integration: check + suggest workflow
  // ========================================================

  describe('check then suggest workflow', () => {
    it('check identifies unresolved slots and suggest finds candidates', async () => {
      await seedArticleWidget(storage);
      await seedArticleConcept(storage);

      // Step 1: check identifies "author" as unresolved
      const checkResult = await contractCheckerHandler.check!(
        { checker: 'workflow-1', widget: 'ArticleCard', concept: 'Article' },
        storage as any,
      );
      expect(checkResult.variant).toBe('ok');
      const unresolved = JSON.parse(checkResult.unresolved as string);
      expect(unresolved).toContain('author');

      // Step 2: suggest finds compatible fields for "author"
      const suggestResult = await contractCheckerHandler.suggest!(
        { checker: 'workflow-1', widget: 'ArticleCard', concept: 'Article' },
        storage as any,
      );
      expect(suggestResult.variant).toBe('ok');
      const suggestions = JSON.parse(suggestResult.suggestions as string);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].slot).toBe('author');
    });
  });
});
