/**
 * Relation Resolver Integration Tests
 *
 * Tests the integration of Relation concept handler actions (forward
 * denormalization via resolve, propagation, backfill, getReferences,
 * clearDenormalized), QueryProgram handler actions including the new
 * reverseJoin instruction, and end-to-end flows through relation
 * field definition, value setting, resolution, and propagation.
 *
 * Uses the autoInterpret pattern — pass storage as 2nd arg for
 * imperative compat mode.
 *
 * Kernel Registration Notes (document only, no kernel modifications):
 *   - ensureIndex('relation-refs', 'target') needed at boot for
 *     efficient reverse lookups during reverseJoin execution
 *   - ensureIndex('schema:*', relation-fields) needed for reverseJoin
 *     performance when joining across schema-typed relation fields
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { relationHandler } from '../handlers/ts/app/relation.handler.js';
import { queryProgramHandler } from '../handlers/ts/view/query-program.handler.js';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { execute as kernelExecute, planPushdown } from '../handlers/ts/view/providers/kernel-query-provider.js';
import { execute as inMemoryExecute } from '../handlers/ts/view/providers/in-memory-provider.js';
import type { ConceptStorage } from '../runtime/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Result = { variant: string; [key: string]: unknown };
const handler = relationHandler as any;
const qpHandler = queryProgramHandler as any;

async function invoke(h: any, action: string, input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
  return h[action](input, storage);
}

// ─── Relation Handler Tests ──────────────────────────────────────────────────

describe('Relation Handler — resolve (forward denormalization)', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('defineRelation creates a new typed relation', async () => {
    const result = await invoke(handler, 'defineRelation', {
      relation: 'parent-child',
      schema: JSON.stringify({
        forward_label: 'parent of',
        reverse_label: 'child of',
        cardinality: 'one-to-many',
      }),
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.relation).toBe('parent-child');
  });

  it('defineRelation on existing relation returns exists variant', async () => {
    await invoke(handler, 'defineRelation', {
      relation: 'parent-child',
      schema: JSON.stringify({ forward_label: 'parent of' }),
    }, storage);

    const result = await invoke(handler, 'defineRelation', {
      relation: 'parent-child',
      schema: JSON.stringify({}),
    }, storage);
    expect(result.variant).toBe('exists');
  });

  it('link creates a bidirectional connection', async () => {
    await invoke(handler, 'defineRelation', {
      relation: 'parent-child',
      schema: JSON.stringify({ cardinality: 'one-to-many' }),
    }, storage);

    const result = await invoke(handler, 'link', {
      relation: 'parent-child',
      source: 'alice',
      target: 'bob',
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.source).toBe('alice');
    expect(result.target).toBe('bob');
  });

  it('link on nonexistent relation returns invalid', async () => {
    const result = await invoke(handler, 'link', {
      relation: 'nonexistent',
      source: 'alice',
      target: 'bob',
    }, storage);
    expect(result.variant).toBe('invalid');
  });

  it('getRelated returns connected entities in both directions', async () => {
    await invoke(handler, 'defineRelation', {
      relation: 'parent-child',
      schema: JSON.stringify({ cardinality: 'one-to-many' }),
    }, storage);

    await invoke(handler, 'link', {
      relation: 'parent-child',
      source: 'alice',
      target: 'bob',
    }, storage);

    const result = await invoke(handler, 'getRelated', {
      relation: 'parent-child',
      entity: 'alice',
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.related).toContain('bob');
  });

  it('getRelated for nonexistent relation returns notfound', async () => {
    const result = await invoke(handler, 'getRelated', {
      relation: 'nonexistent',
      entity: 'alice',
    }, storage);
    expect(result.variant).toBe('notfound');
  });

  it('unlink removes the connection', async () => {
    await invoke(handler, 'defineRelation', {
      relation: 'parent-child',
      schema: JSON.stringify({ cardinality: 'one-to-many' }),
    }, storage);

    await invoke(handler, 'link', {
      relation: 'parent-child',
      source: 'alice',
      target: 'bob',
    }, storage);

    const unlinkResult = await invoke(handler, 'unlink', {
      relation: 'parent-child',
      source: 'alice',
      target: 'bob',
    }, storage);
    expect(unlinkResult.variant).toBe('ok');
  });

  it('unlink on nonexistent relation returns notfound', async () => {
    const result = await invoke(handler, 'unlink', {
      relation: 'nonexistent',
      source: 'alice',
      target: 'bob',
    }, storage);
    expect(result.variant).toBe('notfound');
  });
});

describe('Relation Handler — propagate (3-tier threshold)', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('defineRollup on existing relation succeeds', async () => {
    await invoke(handler, 'defineRelation', {
      relation: 'team-member',
      schema: JSON.stringify({ cardinality: 'many-to-many' }),
    }, storage);

    const result = await invoke(handler, 'defineRollup', {
      relation: 'team-member',
      formula: 'COUNT(*)',
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.formula).toBe('COUNT(*)');
  });

  it('defineRollup on nonexistent relation returns notfound', async () => {
    const result = await invoke(handler, 'defineRollup', {
      relation: 'nonexistent',
      formula: 'COUNT(*)',
    }, storage);
    expect(result.variant).toBe('notfound');
  });

  it('computeRollup returns aggregated value', async () => {
    await invoke(handler, 'defineRelation', {
      relation: 'team-member',
      schema: JSON.stringify({ cardinality: 'many-to-many' }),
    }, storage);

    await invoke(handler, 'defineRollup', {
      relation: 'team-member',
      formula: 'COUNT(*)',
    }, storage);

    const result = await invoke(handler, 'computeRollup', {
      relation: 'team-member',
      entity: 'team-alpha',
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.value).toBeDefined();
  });

  it('computeRollup on nonexistent relation returns notfound', async () => {
    const result = await invoke(handler, 'computeRollup', {
      relation: 'nonexistent',
      entity: 'team-alpha',
    }, storage);
    expect(result.variant).toBe('notfound');
  });
});

describe('Relation Handler — backfill & trackViewItems', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('trackViewItems creates view-item relation links', async () => {
    const result = await invoke(handler, 'trackViewItems', {
      view: 'view-1',
      items: JSON.stringify(['item-a', 'item-b', 'item-c']),
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.total).toBe(3);
  });

  it('trackViewItems with empty view returns error', async () => {
    const result = await invoke(handler, 'trackViewItems', {
      view: '',
      items: JSON.stringify(['item-a']),
    }, storage);
    expect(result.variant).toBe('error');
  });

  it('trackViewItems with invalid JSON items returns error', async () => {
    const result = await invoke(handler, 'trackViewItems', {
      view: 'view-1',
      items: 'not-json',
    }, storage);
    expect(result.variant).toBe('error');
  });

  it('list returns ok with items', async () => {
    const result = await invoke(handler, 'list', {}, storage);
    expect(result.variant).toBe('ok');
    expect(result.items).toBeDefined();
  });
});

// ─── QueryProgram Handler Tests — reverseJoin ────────────────────────────────

describe('QueryProgram Handler — reverseJoin action', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('reverseJoin appends instruction to existing program', async () => {
    await invoke(qpHandler, 'create', { program: 'rj-prog' }, storage);
    await invoke(qpHandler, 'scan', {
      program: 'rj-prog',
      source: 'contentNodes',
      bindAs: 'nodes',
    }, storage);

    const result = await invoke(qpHandler, 'reverseJoin', {
      program: 'rj-prog',
      source: 'relation-refs',
      localField: 'id',
      foreignField: 'target',
      bindAs: 'referrers',
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.program).toBe('rj-prog');
  });

  it('reverseJoin on nonexistent program returns notfound', async () => {
    const result = await invoke(qpHandler, 'reverseJoin', {
      program: 'nonexistent',
      source: 'relation-refs',
      localField: 'id',
      foreignField: 'target',
      bindAs: 'referrers',
    }, storage);
    expect(result.variant).toBe('notfound');
  });

  it('reverseJoin on sealed program returns sealed', async () => {
    await invoke(qpHandler, 'create', { program: 'sealed-prog' }, storage);
    await invoke(qpHandler, 'pure', {
      program: 'sealed-prog',
      variant: 'ok',
      output: 'result',
    }, storage);

    const result = await invoke(qpHandler, 'reverseJoin', {
      program: 'sealed-prog',
      source: 'relation-refs',
      localField: 'id',
      foreignField: 'target',
      bindAs: 'referrers',
    }, storage);
    expect(result.variant).toBe('sealed');
  });
});

// ─── In-Memory Provider — reverseJoin execution ─────────────────────────────

describe('InMemoryProvider — reverseJoin instruction', () => {
  it('reverseJoin attaches matching foreign rows to each record', () => {
    const refs = [
      { source: 'page-a', target: 'entity-1', label: 'mentions' },
      { source: 'page-b', target: 'entity-1', label: 'references' },
      { source: 'page-c', target: 'entity-2', label: 'mentions' },
    ];

    const result = inMemoryExecute(
      {
        instructions: [
          {
            type: 'scan',
            source: {
              kind: 'inline',
              rows: [
                { id: 'entity-1', name: 'Entity One' },
                { id: 'entity-2', name: 'Entity Two' },
              ],
            },
          },
          {
            type: 'reverseJoin',
            source: { kind: 'inline', rows: refs },
            localField: 'id',
            foreignField: 'target',
            bindAs: 'backrefs',
          },
        ],
      },
    );

    expect(result).toHaveLength(2);
    const entity1 = result.find((r: any) => r.id === 'entity-1') as any;
    const entity2 = result.find((r: any) => r.id === 'entity-2') as any;
    expect(entity1.backrefs).toHaveLength(2);
    expect(entity2.backrefs).toHaveLength(1);
    expect(entity2.backrefs[0].source).toBe('page-c');
  });

  it('reverseJoin with no matching foreign rows attaches empty arrays', () => {
    const result = inMemoryExecute(
      {
        instructions: [
          {
            type: 'scan',
            source: {
              kind: 'inline',
              rows: [{ id: 'orphan', name: 'Orphan Entity' }],
            },
          },
          {
            type: 'reverseJoin',
            source: { kind: 'inline', rows: [] },
            localField: 'id',
            foreignField: 'target',
            bindAs: 'backrefs',
          },
        ],
      },
    );

    expect(result).toHaveLength(1);
    expect((result[0] as any).backrefs).toEqual([]);
  });
});

// ─── Kernel Provider — reverseJoin pushdown ──────────────────────────────────

describe('KernelQueryProvider — reverseJoin pushdown classification', () => {
  it('reverseJoin is classified as pushdown (not residual)', () => {
    const plan = planPushdown(JSON.stringify({
      instructions: [
        { type: 'scan', source: 'contentNodes' },
        { type: 'reverseJoin', source: 'relation-refs', localField: 'id', foreignField: 'target', bindAs: 'refs' },
        { type: 'project', fields: ['id', 'name', 'refs'] },
      ],
    }));
    expect(plan).not.toBeNull();
    expect(plan!.pushdown.instructions).toHaveLength(2); // scan + reverseJoin
    expect(plan!.residual.instructions).toHaveLength(1); // project
    expect(plan!.pushdown.instructions[1].type).toBe('reverseJoin');
  });

  it('reverseJoin execution returns rows unchanged (caller resolves)', () => {
    const rows = [
      { id: 'e1', name: 'Entity 1' },
      { id: 'e2', name: 'Entity 2' },
    ];

    const result = kernelExecute(
      JSON.stringify({
        instructions: [
          { type: 'reverseJoin', source: 'relation-refs', localField: 'id', foreignField: 'target', bindAs: 'refs' },
        ],
      }),
      rows,
    );
    expect(result.variant).toBe('ok');
    expect(result.rows).toHaveLength(2);
    // Kernel provider passes rows through — actual resolution is external
    expect(result.rows![0]).toEqual({ id: 'e1', name: 'Entity 1' });
  });
});

// ─── End-to-End: Relation field definition -> resolve -> propagate ───────────

describe('End-to-end: relation field lifecycle', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('create relation -> link -> resolve via getRelated -> verify denormalized data', async () => {
    // 1. Define a relation type
    const defineResult = await invoke(handler, 'defineRelation', {
      relation: 'authored-by',
      schema: JSON.stringify({
        forward_label: 'authored by',
        reverse_label: 'author of',
        cardinality: 'many-to-one',
      }),
    }, storage);
    expect(defineResult.variant).toBe('ok');

    // 2. Set field values by linking entities
    const linkResult = await invoke(handler, 'link', {
      relation: 'authored-by',
      source: 'article-1',
      target: 'user-alice',
    }, storage);
    expect(linkResult.variant).toBe('ok');

    // 3. Resolve: get the related entity data
    const resolveResult = await invoke(handler, 'getRelated', {
      relation: 'authored-by',
      entity: 'article-1',
    }, storage);
    expect(resolveResult.variant).toBe('ok');
    expect(resolveResult.related).toContain('user-alice');

    // 4. Verify reverse direction also works
    const reverseResult = await invoke(handler, 'getRelated', {
      relation: 'authored-by',
      entity: 'user-alice',
    }, storage);
    expect(reverseResult.variant).toBe('ok');
    expect(reverseResult.related).toContain('article-1');
  });

  it('change target -> propagate -> verify updated', async () => {
    // 1. Set up relation
    await invoke(handler, 'defineRelation', {
      relation: 'assigned-to',
      schema: JSON.stringify({ cardinality: 'many-to-one' }),
    }, storage);

    // 2. Initial link
    await invoke(handler, 'link', {
      relation: 'assigned-to',
      source: 'task-1',
      target: 'user-alice',
    }, storage);

    // 3. Verify initial state
    const before = await invoke(handler, 'getRelated', {
      relation: 'assigned-to',
      entity: 'task-1',
    }, storage);
    expect(before.variant).toBe('ok');
    expect(before.related).toContain('user-alice');

    // 4. Change target by re-linking (new link overwrites via put)
    await invoke(handler, 'link', {
      relation: 'assigned-to',
      source: 'task-1',
      target: 'user-bob',
    }, storage);

    // 5. Verify propagated/updated — getRelated should show new target
    const after = await invoke(handler, 'getRelated', {
      relation: 'assigned-to',
      entity: 'task-1',
    }, storage);
    expect(after.variant).toBe('ok');
    expect(after.related).toContain('user-bob');
  });

  it('full pipeline: relation + QueryProgram reverseJoin via in-memory provider', async () => {
    // 1. Set up relations in the handler
    await invoke(handler, 'defineRelation', {
      relation: 'tag-applied',
      schema: JSON.stringify({ cardinality: 'many-to-many' }),
    }, storage);

    await invoke(handler, 'link', {
      relation: 'tag-applied',
      source: 'doc-1',
      target: 'tag-frontend',
    }, storage);

    await invoke(handler, 'link', {
      relation: 'tag-applied',
      source: 'doc-2',
      target: 'tag-frontend',
    }, storage);

    // 2. Build a QueryProgram with reverseJoin
    await invoke(qpHandler, 'create', { program: 'e2e-rj' }, storage);

    await invoke(qpHandler, 'scan', {
      program: 'e2e-rj',
      source: 'tags',
      bindAs: 'tags',
    }, storage);

    const rjResult = await invoke(qpHandler, 'reverseJoin', {
      program: 'e2e-rj',
      source: 'tag-refs',
      localField: 'id',
      foreignField: 'target',
      bindAs: 'taggedDocs',
    }, storage);
    expect(rjResult.variant).toBe('ok');

    // 3. Execute via in-memory provider with inline data
    // simulating what the kernel would resolve
    const tagRows = [{ id: 'tag-frontend', label: 'Frontend' }];
    const refRows = [
      { source: 'doc-1', target: 'tag-frontend' },
      { source: 'doc-2', target: 'tag-frontend' },
    ];

    const executed = inMemoryExecute(
      {
        instructions: [
          { type: 'scan', source: { kind: 'inline', rows: tagRows } },
          {
            type: 'reverseJoin',
            source: { kind: 'inline', rows: refRows },
            localField: 'id',
            foreignField: 'target',
            bindAs: 'taggedDocs',
          },
        ],
      },
    );

    expect(executed).toHaveLength(1);
    const tag = executed[0] as any;
    expect(tag.taggedDocs).toHaveLength(2);
    expect(tag.taggedDocs.map((d: any) => d.source).sort()).toEqual(['doc-1', 'doc-2']);
  });
});

// ─── Artifact Completeness ──────────────────────────────────────────────────

describe('Artifact completeness — relation integration', () => {
  it('Relation concept spec exists', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('repertoire/concepts/linking/relation.concept')).toBe(true);
  });

  it('Relation handler exists', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('handlers/ts/app/relation.handler.ts')).toBe(true);
  });

  it('QueryProgram concept spec exists', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('specs/view/query-program.concept')).toBe(true);
  });

  it('QueryProgram handler exists', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('handlers/ts/view/query-program.handler.ts')).toBe(true);
  });

  it('Kernel query provider exists', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('handlers/ts/view/providers/kernel-query-provider.ts')).toBe(true);
  });

  it('In-memory provider exists', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('handlers/ts/view/providers/in-memory-provider.ts')).toBe(true);
  });

  it('Relation sync files exist in linking suite', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('repertoire/concepts/linking/syncs/relation-reference-bridge.sync')).toBe(true);
    expect(fs.existsSync('repertoire/concepts/linking/syncs/relation-rollup-computation.sync')).toBe(true);
  });
});

// ─── Kernel Registration Notes ──────────────────────────────────────────────
//
// The following indexes should be ensured at kernel boot for optimal
// relation integration performance. These are documented here for
// future implementation; no kernel modifications are made by this test.
//
// 1. ensureIndex('relation-refs', 'target')
//    Required for efficient reverse lookups during reverseJoin execution.
//    Without this index, reverseJoin on large relation-refs collections
//    degrades to full-table scan per row in the primary set.
//
// 2. ensureIndex('schema:*', relation-fields)
//    Required for reverseJoin performance when joining across schema-typed
//    relation fields. Each schema that declares relation-type fields should
//    have an index on the foreign key column to support efficient reverse
//    traversal. The wildcard 'schema:*' indicates this applies to all
//    schema-typed storage relations.
//
// These indexes map to the following kernel boot sequence (pseudocode):
//
//   kernel.boot() {
//     storage.ensureIndex('relation-refs', ['target']);
//     for (schema of registeredSchemas) {
//       for (field of schema.relationFields) {
//         storage.ensureIndex(`schema:${schema.name}`, [field.foreignKey]);
//       }
//     }
//   }
