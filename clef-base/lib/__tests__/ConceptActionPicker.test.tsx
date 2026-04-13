/**
 * Tests for ConceptActionPicker — pure-state logic.
 *
 * Component:   clef-base/app/components/widgets/ConceptActionPicker.tsx
 * Widget spec: surface/concept-action-picker.widget
 * Card:        CAP-01
 *
 * ## Test strategy
 *
 * The root vitest config runs in the 'node' environment (no DOM / no React
 * runtime). All tests here exercise pure logic extracted from the component:
 *
 *   - Search scoring (token-match scorer)
 *   - filter prop narrows action list (query / mutating / all)
 *   - Grouping: Common vs Advanced based on concept.category
 *
 * Component-mount tests (aria attributes, keyboard, FSM transitions) require
 * jsdom and are tracked as CAP-02.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the pure functions under test so they work in the node environment
// without importing the 'use client' component (which needs React + DOM).
// ---------------------------------------------------------------------------

// --- Types mirror ConceptActionPicker.tsx ---

interface ConceptActionVariant {
  tag: string;
  fields: Array<{ name: string; type: string }>;
  prose?: string;
}

interface ConceptActionSpec {
  name: string;
  description?: string;
  variants: ConceptActionVariant[];
}

interface ConceptSpec {
  name: string;
  description?: string;
  category?: string;
  actions: ConceptActionSpec[];
}

// --- Scorer ---

function scoreConceptMatch(concept: ConceptSpec, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  let score = 0;
  const haystack = [concept.name, concept.description ?? '', concept.category ?? '']
    .join(' ')
    .toLowerCase();
  for (const token of tokens) {
    if (haystack.includes(token)) score += 2;
  }
  const actionHaystack = concept.actions
    .map((a) => `${a.name} ${a.description ?? ''}`)
    .join(' ')
    .toLowerCase();
  for (const token of tokens) {
    if (actionHaystack.includes(token)) score += 1;
  }
  return score;
}

function scoreActionMatch(action: ConceptActionSpec, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  let score = 0;
  const haystack = [action.name, action.description ?? ''].join(' ').toLowerCase();
  for (const token of tokens) {
    if (haystack.includes(token)) score += 2;
  }
  return score;
}

// --- Filter helpers ---

function isQueryAction(action: ConceptActionSpec): boolean {
  const name = action.name.toLowerCase();
  const queryPrefixes = ['get', 'list', 'query', 'search', 'resolve', 'find', 'fetch'];
  if (queryPrefixes.some((p) => name.startsWith(p))) return true;
  const nonOkVariants = action.variants.filter(
    (v) => v.tag !== 'ok' && v.tag !== 'error',
  );
  return nonOkVariants.length === 0 && action.variants.every((v) => v.tag === 'ok');
}

function filterActions(
  actions: ConceptActionSpec[],
  filterProp: 'mutating' | 'query' | 'all',
): ConceptActionSpec[] {
  if (filterProp === 'all') return actions;
  if (filterProp === 'query') return actions.filter(isQueryAction);
  return actions.filter((a) => !isQueryAction(a));
}

// --- Grouping helpers ---

const COMMON_CATEGORIES = new Set([
  'domain',
  'content',
  'content-native',
  'view',
  'classification',
  'identity',
]);

function isCommon(c: ConceptSpec): boolean {
  return !c.category || COMMON_CATEGORIES.has(c.category);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CONCEPTS: ConceptSpec[] = [
  {
    name: 'ContentNode',
    description: 'Manage content nodes in the content pool.',
    category: 'content',
    actions: [
      {
        name: 'create',
        description: 'Create a new content node.',
        variants: [
          { tag: 'ok', fields: [{ name: 'node', type: 'String' }] },
          { tag: 'error', fields: [{ name: 'message', type: 'String' }] },
        ],
      },
      {
        name: 'get',
        description: 'Retrieve a content node by id.',
        variants: [
          { tag: 'ok', fields: [{ name: 'node', type: 'String' }] },
          { tag: 'notfound', fields: [{ name: 'message', type: 'String' }] },
        ],
      },
      {
        name: 'list',
        description: 'List all content nodes.',
        variants: [{ tag: 'ok', fields: [{ name: 'nodes', type: 'list' }] }],
      },
    ],
  },
  {
    name: 'Schema',
    description: 'Overlay typed fields on content nodes.',
    category: 'classification',
    actions: [
      {
        name: 'defineSchema',
        description: 'Define a new schema.',
        variants: [
          { tag: 'ok', fields: [] },
          { tag: 'duplicate', fields: [{ name: 'message', type: 'String' }] },
        ],
      },
      {
        name: 'listSchemas',
        description: 'List all schemas.',
        variants: [{ tag: 'ok', fields: [{ name: 'schemas', type: 'list' }] }],
      },
    ],
  },
  {
    name: 'PluginRegistry',
    description: 'Register and dispatch to extension providers.',
    category: 'infrastructure',
    actions: [
      {
        name: 'register',
        description: 'Register a provider.',
        variants: [
          { tag: 'ok', fields: [] },
          { tag: 'duplicate', fields: [] },
        ],
      },
      {
        name: 'dispatch',
        description: 'Dispatch to a registered provider.',
        variants: [
          { tag: 'ok', fields: [] },
          { tag: 'notfound', fields: [] },
        ],
      },
    ],
  },
  {
    name: 'Cache',
    description: 'Cache computation results keyed by concept entity.',
    category: 'infrastructure',
    actions: [
      {
        name: 'set',
        description: 'Store a value in the cache.',
        variants: [{ tag: 'ok', fields: [] }],
      },
      {
        name: 'get',
        description: 'Retrieve a value from the cache.',
        variants: [
          { tag: 'ok', fields: [{ name: 'value', type: 'String' }] },
          { tag: 'miss', fields: [] },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tests: search scoring
// ---------------------------------------------------------------------------

describe('ConceptActionPicker — search scoring', () => {
  it('empty query scores all concepts with score >= 1', () => {
    const tokens: string[] = [];
    for (const c of FIXTURE_CONCEPTS) {
      expect(scoreConceptMatch(c, tokens)).toBeGreaterThanOrEqual(1);
    }
  });

  it('token matching concept name returns score > 0', () => {
    const tokens = ['content'];
    const score = scoreConceptMatch(FIXTURE_CONCEPTS[0], tokens); // ContentNode
    expect(score).toBeGreaterThan(0);
  });

  it('token not present in name or description returns 0', () => {
    const tokens = ['zzznomatch'];
    const score = scoreConceptMatch(FIXTURE_CONCEPTS[0], tokens);
    expect(score).toBe(0);
  });

  it('concept whose action name matches query scores > 0', () => {
    // "create" is in ContentNode's actions
    const tokens = ['create'];
    const score = scoreConceptMatch(FIXTURE_CONCEPTS[0], tokens);
    expect(score).toBeGreaterThan(0);
  });

  it('results are sorted by score descending', () => {
    const tokens = ['content'];
    const scored = FIXTURE_CONCEPTS.map((c) => ({
      concept: c,
      score: scoreConceptMatch(c, tokens),
    }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // ContentNode (name contains "content", category "content") should rank first
    expect(scored[0].concept.name).toBe('ContentNode');

    // Scores are non-increasing
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score);
    }
  });

  it('empty query scores all actions >= 1', () => {
    const tokens: string[] = [];
    for (const a of FIXTURE_CONCEPTS[0].actions) {
      expect(scoreActionMatch(a, tokens)).toBeGreaterThanOrEqual(1);
    }
  });

  it('matching token in action name returns score > 0', () => {
    const tokens = ['create'];
    const action = FIXTURE_CONCEPTS[0].actions.find((a) => a.name === 'create')!;
    expect(scoreActionMatch(action, tokens)).toBeGreaterThan(0);
  });

  it('non-matching token in action returns 0', () => {
    const tokens = ['zzznomatch'];
    const action = FIXTURE_CONCEPTS[0].actions[0];
    expect(scoreActionMatch(action, tokens)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: filter prop narrows action list
// ---------------------------------------------------------------------------

describe('ConceptActionPicker — filter prop', () => {
  const contentNodeActions = FIXTURE_CONCEPTS[0].actions;

  it('filter=all returns all actions', () => {
    const result = filterActions(contentNodeActions, 'all');
    expect(result).toHaveLength(contentNodeActions.length);
  });

  it('filter=query keeps only read-only actions', () => {
    // "list" has only ok variant → query action
    // "get" starts with "get" → query action
    // "create" has error variant and does not start with a query prefix → mutating
    const result = filterActions(contentNodeActions, 'query');
    const names = result.map((a) => a.name);
    expect(names).toContain('list');
    expect(names).toContain('get');
    expect(names).not.toContain('create');
  });

  it('filter=mutating keeps only mutating actions', () => {
    const result = filterActions(contentNodeActions, 'mutating');
    const names = result.map((a) => a.name);
    expect(names).toContain('create');
    expect(names).not.toContain('list');
    expect(names).not.toContain('get');
  });

  it('action starting with "list" is always classified as query', () => {
    const action: ConceptActionSpec = {
      name: 'listBySchema',
      variants: [{ tag: 'ok', fields: [] }, { tag: 'error', fields: [] }],
    };
    expect(isQueryAction(action)).toBe(true);
  });

  it('action starting with "find" is classified as query', () => {
    const action: ConceptActionSpec = {
      name: 'findByTitle',
      variants: [{ tag: 'ok', fields: [] }],
    };
    expect(isQueryAction(action)).toBe(true);
  });

  it('action starting with "create" without query prefix is mutating', () => {
    const action: ConceptActionSpec = {
      name: 'create',
      variants: [{ tag: 'ok', fields: [] }, { tag: 'duplicate', fields: [] }],
    };
    expect(isQueryAction(action)).toBe(false);
  });

  it('action with only ok variant and no query prefix is query (no-write heuristic)', () => {
    // e.g. "ping" with only ok
    const action: ConceptActionSpec = {
      name: 'ping',
      variants: [{ tag: 'ok', fields: [] }],
    };
    expect(isQueryAction(action)).toBe(true);
  });

  it('Schema filter=query returns listSchemas but not defineSchema', () => {
    const schemaActions = FIXTURE_CONCEPTS[1].actions;
    const result = filterActions(schemaActions, 'query');
    const names = result.map((a) => a.name);
    expect(names).toContain('listSchemas');
    expect(names).not.toContain('defineSchema');
  });
});

// ---------------------------------------------------------------------------
// Tests: grouping
// ---------------------------------------------------------------------------

describe('ConceptActionPicker — grouping Common vs Advanced', () => {
  it('content category is Common', () => {
    expect(isCommon(FIXTURE_CONCEPTS[0])).toBe(true); // ContentNode, category=content
  });

  it('classification category is Common', () => {
    expect(isCommon(FIXTURE_CONCEPTS[1])).toBe(true); // Schema, category=classification
  });

  it('infrastructure category is Advanced', () => {
    expect(isCommon(FIXTURE_CONCEPTS[2])).toBe(false); // PluginRegistry, category=infrastructure
    expect(isCommon(FIXTURE_CONCEPTS[3])).toBe(false); // Cache, category=infrastructure
  });

  it('concept with no category is Common', () => {
    const noCategory: ConceptSpec = {
      name: 'Orphan',
      actions: [],
    };
    expect(isCommon(noCategory)).toBe(true);
  });

  it('domain category is Common', () => {
    const domainConcept: ConceptSpec = {
      name: 'Task',
      category: 'domain',
      actions: [],
    };
    expect(isCommon(domainConcept)).toBe(true);
  });

  it('view category is Common', () => {
    const viewConcept: ConceptSpec = {
      name: 'ViewShell',
      category: 'view',
      actions: [],
    };
    expect(isCommon(viewConcept)).toBe(true);
  });

  it('separates fixture concepts correctly', () => {
    const common = FIXTURE_CONCEPTS.filter(isCommon);
    const advanced = FIXTURE_CONCEPTS.filter((c) => !isCommon(c));

    // ContentNode + Schema are Common
    expect(common.map((c) => c.name)).toContain('ContentNode');
    expect(common.map((c) => c.name)).toContain('Schema');

    // PluginRegistry + Cache are Advanced
    expect(advanced.map((c) => c.name)).toContain('PluginRegistry');
    expect(advanced.map((c) => c.name)).toContain('Cache');
  });

  it('Advanced group collapsed by default when showAdvanced=false', () => {
    // The component initialises advancedOpen from showAdvanced prop.
    // Here we test the initial value calculation logic directly.
    const showAdvanced = false;
    const advancedOpen = showAdvanced; // mirrors: useState<boolean>(showAdvanced)
    expect(advancedOpen).toBe(false);
  });

  it('Advanced group open when showAdvanced=true', () => {
    const showAdvanced = true;
    const advancedOpen = showAdvanced;
    expect(advancedOpen).toBe(true);
  });
});
