// ============================================================
// Grouping Concept Tests
//
// Validates action classification and concept grouping strategies
// from the shared Grouping concept implementation.
// See Architecture doc: Interface Kit
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler';
import {
  classifyAction,
  buildConceptGroups,
  type GroupingConfig,
  type ConceptGroup,
} from '../handlers/ts/framework/providers/codegen-utils';
import type { ConceptManifest, ActionSchema } from '../kernel/src/types';

// --- Helpers ---

const INTERFACE_DIR = resolve(__dirname, '../bind/interface');

/** Build a minimal ConceptManifest with the given name and action names. */
function mockManifest(name: string, actionNames: string[], opts?: { purpose?: string }): ConceptManifest {
  return {
    uri: `test://${name.toLowerCase()}`,
    name,
    typeParams: [],
    relations: [],
    actions: actionNames.map((n) => ({
      name: n,
      params: [],
      variants: [],
    })),
    invariants: [],
    graphqlSchema: '',
    jsonSchemas: { invocations: {}, completions: {} },
    capabilities: [],
    purpose: opts?.purpose || `Manage ${name} resources`,
  };
}

// ============================================================
// Concept Spec Parsing
// ============================================================

describe('Grouping Concept Spec', () => {
  it('parses grouping.concept', () => {
    const source = readFileSync(resolve(INTERFACE_DIR, 'concepts', 'grouping.concept'), 'utf-8');
    const ast = parseConceptFile(source);
    expect(ast.name).toBe('Grouping');
    expect(ast.typeParams).toEqual(['G']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map((a) => a.name)).toEqual(['group', 'classify']);
  });

  it('group action has 3 variants', () => {
    const source = readFileSync(resolve(INTERFACE_DIR, 'concepts', 'grouping.concept'), 'utf-8');
    const ast = parseConceptFile(source);
    const groupAction = ast.actions.find((a) => a.name === 'group');
    expect(groupAction).toBeDefined();
    expect(groupAction!.variants).toHaveLength(3);
    expect(groupAction!.variants.map((v) => v.name)).toEqual(['ok', 'invalidStrategy', 'emptyInput']);
  });

  it('classify action has 1 variant', () => {
    const source = readFileSync(resolve(INTERFACE_DIR, 'concepts', 'grouping.concept'), 'utf-8');
    const ast = parseConceptFile(source);
    const classifyActionDef = ast.actions.find((a) => a.name === 'classify');
    expect(classifyActionDef).toBeDefined();
    expect(classifyActionDef!.variants).toHaveLength(1);
    expect(classifyActionDef!.variants[0].name).toBe('ok');
  });

  it('has an invariant', () => {
    const source = readFileSync(resolve(INTERFACE_DIR, 'concepts', 'grouping.concept'), 'utf-8');
    const ast = parseConceptFile(source);
    expect(ast.invariants.length).toBeGreaterThan(0);
  });
});

describe('Grouping Sync', () => {
  it('parses group-before-dispatch.sync', () => {
    const source = readFileSync(resolve(INTERFACE_DIR, 'syncs', 'group-before-dispatch.sync'), 'utf-8');
    const syncs = parseSyncFile(source);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('GroupBeforeDispatch');
  });
});

// ============================================================
// Action Classification
// ============================================================

describe('classifyAction', () => {
  describe('CRUD role', () => {
    it('classifies create actions', () => {
      expect(classifyAction('create').crudRole).toBe('create');
      expect(classifyAction('add').crudRole).toBe('create');
      expect(classifyAction('new').crudRole).toBe('create');
      expect(classifyAction('createArticle').crudRole).toBe('create');
    });

    it('classifies read actions', () => {
      expect(classifyAction('get').crudRole).toBe('read');
      expect(classifyAction('find').crudRole).toBe('read');
      expect(classifyAction('list').crudRole).toBe('read');
      expect(classifyAction('search').crudRole).toBe('read');
      expect(classifyAction('all').crudRole).toBe('read');
      expect(classifyAction('is').crudRole).toBe('read');
      expect(classifyAction('count').crudRole).toBe('read');
      expect(classifyAction('isFollowing').crudRole).toBe('read');
    });

    it('classifies update actions', () => {
      expect(classifyAction('update').crudRole).toBe('update');
      expect(classifyAction('edit').crudRole).toBe('update');
      expect(classifyAction('modify').crudRole).toBe('update');
    });

    it('classifies delete actions', () => {
      expect(classifyAction('delete').crudRole).toBe('delete');
      expect(classifyAction('remove').crudRole).toBe('delete');
    });

    it('classifies other actions', () => {
      expect(classifyAction('publish').crudRole).toBe('other');
      expect(classifyAction('send').crudRole).toBe('other');
      expect(classifyAction('follow').crudRole).toBe('other');
      expect(classifyAction('favorite').crudRole).toBe('other');
    });
  });

  describe('intent', () => {
    it('read for query-like actions', () => {
      expect(classifyAction('get').intent).toBe('read');
      expect(classifyAction('list').intent).toBe('read');
      expect(classifyAction('isFollowing').intent).toBe('read');
      expect(classifyAction('count').intent).toBe('read');
    });

    it('write for mutation-like actions', () => {
      expect(classifyAction('create').intent).toBe('write');
      expect(classifyAction('update').intent).toBe('write');
      expect(classifyAction('delete').intent).toBe('write');
      expect(classifyAction('follow').intent).toBe('write');
    });
  });

  describe('event producing', () => {
    it('true for write actions', () => {
      expect(classifyAction('create').eventProducing).toBe(true);
      expect(classifyAction('delete').eventProducing).toBe(true);
      expect(classifyAction('follow').eventProducing).toBe(true);
    });

    it('false for read actions', () => {
      expect(classifyAction('get').eventProducing).toBe(false);
      expect(classifyAction('list').eventProducing).toBe(false);
      expect(classifyAction('isFollowing').eventProducing).toBe(false);
    });
  });

  describe('event verb', () => {
    it('created for create actions', () => {
      expect(classifyAction('create').eventVerb).toBe('created');
      expect(classifyAction('add').eventVerb).toBe('created');
    });

    it('updated for update actions', () => {
      expect(classifyAction('update').eventVerb).toBe('updated');
      expect(classifyAction('edit').eventVerb).toBe('updated');
    });

    it('deleted for delete actions', () => {
      expect(classifyAction('delete').eventVerb).toBe('deleted');
      expect(classifyAction('remove').eventVerb).toBe('deleted');
    });

    it('{name}Completed for other mutations', () => {
      expect(classifyAction('follow').eventVerb).toBe('followCompleted');
      expect(classifyAction('publish').eventVerb).toBe('publishCompleted');
    });
  });

  describe('MCP type', () => {
    it('resource-template for list actions', () => {
      expect(classifyAction('list').mcpType).toBe('resource-template');
      expect(classifyAction('all').mcpType).toBe('resource-template');
      expect(classifyAction('search').mcpType).toBe('resource-template');
    });

    it('resource for read-by-id actions', () => {
      expect(classifyAction('get').mcpType).toBe('resource');
      expect(classifyAction('find').mcpType).toBe('resource');
      expect(classifyAction('isFollowing').mcpType).toBe('resource');
    });

    it('tool for write actions', () => {
      expect(classifyAction('create').mcpType).toBe('tool');
      expect(classifyAction('delete').mcpType).toBe('tool');
      expect(classifyAction('follow').mcpType).toBe('tool');
    });
  });
});

// ============================================================
// Concept Grouping — Structural Strategies
// ============================================================

describe('buildConceptGroups — structural strategies', () => {
  const article = mockManifest('Article', ['create', 'get', 'update', 'delete', 'list']);
  const comment = mockManifest('Comment', ['create', 'delete', 'list']);
  const tag = mockManifest('Tag', ['add', 'remove', 'list']);
  const manifests = [article, comment, tag];

  describe('per-concept', () => {
    it('produces one group per concept', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'per-concept' });
      expect(groups).toHaveLength(3);
      expect(groups.map((g) => g.name)).toEqual(['article', 'comment', 'tag']);
      expect(groups[0].concepts).toHaveLength(1);
      expect(groups[0].concepts[0].name).toBe('Article');
    });
  });

  describe('per-kit', () => {
    it('groups by kit field when present', () => {
      const a = { ...article, kit: 'content' } as unknown as ConceptManifest;
      const c = { ...comment, kit: 'content' } as unknown as ConceptManifest;
      const t = { ...tag, kit: 'taxonomy' } as unknown as ConceptManifest;

      const groups = buildConceptGroups([a, c, t], { strategy: 'per-kit', name: 'app' });
      expect(groups).toHaveLength(2);
      const contentGroup = groups.find((g) => g.name === 'content');
      const taxonomyGroup = groups.find((g) => g.name === 'taxonomy');
      expect(contentGroup!.concepts).toHaveLength(2);
      expect(taxonomyGroup!.concepts).toHaveLength(1);
    });

    it('uses misc fallback for concepts without kit', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'per-kit', name: 'myapp' });
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('myapp-misc');
      expect(groups[0].concepts).toHaveLength(3);
    });
  });

  describe('single', () => {
    it('puts all concepts in one group', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'single', name: 'conduit' });
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('conduit');
      expect(groups[0].concepts).toHaveLength(3);
    });

    it('uses "app" as default name', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'single' });
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('app');
    });
  });

  describe('custom', () => {
    it('groups by explicit mapping', () => {
      const groups = buildConceptGroups(manifests, {
        strategy: 'custom',
        custom: {
          ContentManagement: {
            concepts: ['Article', 'Comment'],
            description: 'Content management skills',
          },
        },
      });
      expect(groups).toHaveLength(2); // ContentManagement + Tag (ungrouped)
      const content = groups.find((g) => g.name === 'content-management');
      const tagGroup = groups.find((g) => g.name === 'tag');
      expect(content!.concepts).toHaveLength(2);
      expect(tagGroup!.concepts).toHaveLength(1);
    });

    it('falls back to per-concept if no custom config', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'custom' });
      expect(groups).toHaveLength(3);
    });
  });
});

// ============================================================
// Concept Grouping — Behavioral Strategies
// ============================================================

describe('buildConceptGroups — behavioral strategies', () => {
  // Article has mixed CRUD: create, get, update, delete, list
  const article = mockManifest('Article', ['create', 'get', 'update', 'delete', 'list']);
  // Echo has only "other" actions
  const echo = mockManifest('Echo', ['send']);
  // ReadOnlyStats has only read actions
  const stats = mockManifest('Stats', ['get', 'list', 'count']);
  const manifests = [article, echo, stats];

  describe('by-crud', () => {
    it('groups by dominant CRUD role', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'by-crud' });
      // Article: create(1) + read(2) + update(1) + delete(1) → read is dominant
      // Echo: other(1) → other
      // Stats: read(3) → read
      const readGroup = groups.find((g) => g.name === 'read');
      const otherGroup = groups.find((g) => g.name === 'other');
      expect(readGroup).toBeDefined();
      expect(readGroup!.concepts.map((c) => c.name)).toContain('Stats');
      expect(otherGroup).toBeDefined();
      expect(otherGroup!.concepts.map((c) => c.name)).toContain('Echo');
    });
  });

  describe('by-intent', () => {
    it('groups by read vs write intent', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'by-intent' });
      const readGroup = groups.find((g) => g.name === 'read');
      const writeGroup = groups.find((g) => g.name === 'write');
      // Stats: all read → read
      expect(readGroup!.concepts.map((c) => c.name)).toContain('Stats');
      // Echo: send is write → write
      expect(writeGroup!.concepts.map((c) => c.name)).toContain('Echo');
    });
  });

  describe('by-event', () => {
    it('separates event-producing from read-only', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'by-event' });
      const producing = groups.find((g) => g.name === 'event-producing');
      const readOnly = groups.find((g) => g.name === 'read-only');
      // Article and Echo have write actions → event-producing
      expect(producing!.concepts.map((c) => c.name)).toContain('Article');
      expect(producing!.concepts.map((c) => c.name)).toContain('Echo');
      // Stats has only read actions → read-only
      expect(readOnly!.concepts.map((c) => c.name)).toContain('Stats');
    });
  });

  describe('by-mcp-type', () => {
    it('groups by dominant MCP resource type', () => {
      const groups = buildConceptGroups(manifests, { strategy: 'by-mcp-type' });
      // Stats: get(resource) + list(resource-template) + count(resource) → resource is dominant
      const resourceGroup = groups.find((g) => g.name === 'resource');
      expect(resourceGroup).toBeDefined();
      expect(resourceGroup!.concepts.map((c) => c.name)).toContain('Stats');
      // Echo: send → tool
      const toolGroup = groups.find((g) => g.name === 'tool');
      expect(toolGroup).toBeDefined();
      expect(toolGroup!.concepts.map((c) => c.name)).toContain('Echo');
    });
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe('buildConceptGroups — edge cases', () => {
  it('handles empty manifest list', () => {
    const groups = buildConceptGroups([], { strategy: 'per-concept' });
    expect(groups).toHaveLength(0);
  });

  it('handles single manifest', () => {
    const m = mockManifest('Solo', ['get']);
    const groups = buildConceptGroups([m], { strategy: 'per-concept' });
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('solo');
  });

  it('falls back to per-concept for unknown strategy', () => {
    const m = mockManifest('Test', ['get']);
    const groups = buildConceptGroups([m], { strategy: 'unknown' as any });
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('test');
  });

  it('every concept appears in exactly one group (invariant)', () => {
    const manifests = [
      mockManifest('A', ['create', 'get']),
      mockManifest('B', ['list', 'search']),
      mockManifest('C', ['delete', 'update']),
    ];

    for (const strategy of ['per-concept', 'per-kit', 'single', 'by-crud', 'by-intent', 'by-event', 'by-mcp-type'] as const) {
      const groups = buildConceptGroups(manifests, { strategy, name: 'app' });
      const allNames = groups.flatMap((g) => g.concepts.map((c) => c.name)).sort();
      expect(allNames).toEqual(['A', 'B', 'C']);
    }
  });
});
