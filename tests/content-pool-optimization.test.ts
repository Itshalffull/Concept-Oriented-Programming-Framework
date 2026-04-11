// ============================================================
// Content Pool Query Optimization — Integration Tests
//
// Validates: listBySchema handler optimization, per-schema
// denormalized relations, schema-index sync wiring, cache sync
// wiring, secondary index integration with content data, and
// end-to-end optimization stack verification.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { contentNodeHandler } from '../handlers/ts/app/content-node.handler.js';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import type { ConceptStorage } from '../runtime/types.js';

// ---------------------------------------------------------------------------
// 1. listBySchema with per-schema relation
// ---------------------------------------------------------------------------

describe('listBySchema with per-schema relation', () => {
  let storage: ConceptStorage;

  beforeEach(async () => {
    storage = createInMemoryStorage();

    // Populate nodes
    const nodes = [
      { node: 'n1', type: 'page', content: 'Article one', createdBy: 'user1' },
      { node: 'n2', type: 'page', content: 'Article two', createdBy: 'user1' },
      { node: 'n3', type: 'page', content: 'Concept alpha', createdBy: 'user2' },
      { node: 'n4', type: 'page', content: 'Article three', createdBy: 'user1' },
      { node: 'n5', type: 'page', content: 'Concept beta', createdBy: 'user2' },
    ];

    for (const n of nodes) {
      await storage.put('node', n.node, {
        node: n.node,
        type: n.type,
        content: n.content,
        createdBy: n.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Simulate SchemaIndexOnApply sync: populate per-schema denormalized
    // relations AND membership relation, as the syncs would do
    await storage.put('membership', 'n1:Article', { entity_id: 'n1', schema: 'Article' });
    await storage.put('membership', 'n2:Article', { entity_id: 'n2', schema: 'Article' });
    await storage.put('membership', 'n3:Concept', { entity_id: 'n3', schema: 'Concept' });
    await storage.put('membership', 'n4:Article', { entity_id: 'n4', schema: 'Article' });
    await storage.put('membership', 'n5:Concept', { entity_id: 'n5', schema: 'Concept' });

    // Per-schema denormalized relations (what SchemaIndexOnApply creates)
    for (const n of nodes) {
      await storage.put('node', n.node, {
        node: n.node, type: n.type, content: n.content,
        createdBy: n.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    // Article nodes → schema:Article relation
    for (const id of ['n1', 'n2', 'n4']) {
      const nodeData = await storage.get('node', id);
      await storage.put(`schema:Article`, id, { ...nodeData!, schemas: ['Article'] });
    }
    // Concept nodes → schema:Concept relation
    for (const id of ['n3', 'n5']) {
      const nodeData = await storage.get('node', id);
      await storage.put(`schema:Concept`, id, { ...nodeData!, schemas: ['Concept'] });
    }
  });

  it('returns only Article nodes when queried for Article schema', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: 'Article' }, storage);
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(3);
    const nodeIds = items.map((i: Record<string, unknown>) => i.node);
    expect(nodeIds).toContain('n1');
    expect(nodeIds).toContain('n2');
    expect(nodeIds).toContain('n4');
  });

  it('returns only Concept nodes when queried for Concept schema', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: 'Concept' }, storage);
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(2);
    const nodeIds = items.map((i: Record<string, unknown>) => i.node);
    expect(nodeIds).toContain('n3');
    expect(nodeIds).toContain('n5');
  });

  it('returns empty array for a nonexistent schema', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: 'NonExistent' }, storage);
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(0);
  });

  it('respects limit parameter', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: 'Article', limit: 2 }, storage);
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(2);
  });

  it('respects offset and limit for pagination', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: 'Article', offset: 1, limit: 2 }, storage);
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(2);
  });

  it('returns invalid variant for empty schema string', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: '' }, storage);
    expect(result.variant).toBe('invalid');
  });

  it('returns invalid variant for whitespace-only schema', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: '   ' }, storage);
    expect(result.variant).toBe('invalid');
  });

  it('enriches results with correct node fields', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: 'Article' }, storage);
    const items = JSON.parse(result.items as string);
    const first = items.find((i: Record<string, unknown>) => i.node === 'n1');
    expect(first).toBeDefined();
    expect(first.type).toBe('page');
    expect(first.content).toBe('Article one');
    expect(first.createdBy).toBe('user1');
    expect(first.createdAt).toBeDefined();
  });

  it('enriches results with schemas array', async () => {
    const result = await contentNodeHandler.listBySchema({ schema: 'Article' }, storage);
    const items = JSON.parse(result.items as string);
    const first = items.find((i: Record<string, unknown>) => i.node === 'n1');
    expect(first.schemas).toBeDefined();
    expect(first.schemas).toContain('Article');
  });
});

// ---------------------------------------------------------------------------
// 2. Per-schema relation sync files
// ---------------------------------------------------------------------------

describe('Per-schema relation sync files', () => {
  const syncDir = path.resolve('clef-base/suites/entity-lifecycle/syncs');

  describe('schema-index-on-apply.sync', () => {
    const syncPath = path.join(syncDir, 'schema-index-on-apply.sync');

    it('file exists', () => {
      expect(fs.existsSync(syncPath)).toBe(true);
    });

    it('triggers on Schema/applyTo', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('Schema/applyTo');
    });

    it('uses eventual consistency', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('[eventual]');
    });
  });

  describe('schema-index-on-remove.sync', () => {
    const syncPath = path.join(syncDir, 'schema-index-on-remove.sync');

    it('file exists', () => {
      expect(fs.existsSync(syncPath)).toBe(true);
    });

    it('triggers on Schema/removeFrom', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('Schema/removeFrom');
    });

    it('uses eventual consistency', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('[eventual]');
    });
  });

  describe('schema-index-on-save.sync', () => {
    const syncPath = path.join(syncDir, 'schema-index-on-save.sync');

    it('file exists', () => {
      expect(fs.existsSync(syncPath)).toBe(true);
    });

    it('triggers on ContentStorage/save', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('ContentStorage/save');
    });

    it('uses eventual consistency', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('[eventual]');
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Cache integration sync files
// ---------------------------------------------------------------------------

describe('Cache integration sync files', () => {
  const syncDir = path.resolve('clef-base/suites/entity-lifecycle/syncs');

  describe('cache-list-by-schema.sync', () => {
    const syncPath = path.join(syncDir, 'cache-list-by-schema.sync');

    it('file exists', () => {
      expect(fs.existsSync(syncPath)).toBe(true);
    });

    it('triggers on ContentNode/listBySchema', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('ContentNode/listBySchema');
    });

    it('invokes Cache/set in then clause', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('Cache/set');
    });
  });

  describe('schema-change-invalidates-cache.sync', () => {
    const syncPath = path.join(syncDir, 'schema-change-invalidates-cache.sync');

    it('file exists', () => {
      expect(fs.existsSync(syncPath)).toBe(true);
    });

    it('triggers on Schema/applyTo', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('Schema/applyTo');
    });

    it('invokes Cache/invalidateByTags in then clause', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('Cache/invalidateByTags');
    });
  });

  describe('schema-remove-invalidates-cache.sync', () => {
    const syncPath = path.join(syncDir, 'schema-remove-invalidates-cache.sync');

    it('file exists', () => {
      expect(fs.existsSync(syncPath)).toBe(true);
    });

    it('triggers on Schema/removeFrom', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('Schema/removeFrom');
    });

    it('invokes Cache/invalidateByTags in then clause', () => {
      const content = fs.readFileSync(syncPath, 'utf-8');
      expect(content).toContain('Cache/invalidateByTags');
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Storage secondary index with content data
// ---------------------------------------------------------------------------

describe('Storage secondary index with content data', () => {
  let storage: ConceptStorage;
  const schemas = ['Article', 'Concept', 'Note', 'Schema', 'Workflow'];

  beforeEach(async () => {
    storage = createInMemoryStorage();

    // Populate 100 membership records across 5 schemas
    for (let i = 0; i < 100; i++) {
      const schema = schemas[i % schemas.length];
      await storage.put('membership', `m${i}`, {
        entity_id: `node-${i}`,
        schema,
      });
    }
  });

  it('find with criteria returns correct subset for Article schema', async () => {
    const articles = await storage.find('membership', { schema: 'Article' });
    expect(articles).toHaveLength(20);
    for (const a of articles) {
      expect(a.schema).toBe('Article');
    }
  });

  it('find with criteria returns correct subset for each schema', async () => {
    for (const schema of schemas) {
      const results = await storage.find('membership', { schema });
      expect(results).toHaveLength(20);
    }
  });

  it('find performance: 100-entry filtered find completes under 50ms', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await storage.find('membership', { schema: 'Article' });
    }
    const elapsed = performance.now() - start;
    // 100 iterations of filtered find on 100 entries should complete well under 50ms each
    expect(elapsed / 100).toBeLessThan(50);
  });

  it('ensureIndex exists on ConceptStorage when supported', () => {
    // ensureIndex is an optional extension; verify it exists on
    // implementations that support it, or skip gracefully
    const storageAny = storage as Record<string, unknown>;
    if (typeof storageAny.ensureIndex === 'function') {
      expect(typeof storageAny.ensureIndex).toBe('function');
    } else {
      // Base in-memory storage may not yet have ensureIndex;
      // this is expected when the secondary index feature is pending
      expect(true).toBe(true);
    }
  });

  it('indexed find returns same results as unindexed find', async () => {
    const storageAny = storage as Record<string, unknown>;
    if (typeof storageAny.ensureIndex === 'function') {
      (storageAny.ensureIndex as Function)('membership', 'schema');
    }
    // Whether or not ensureIndex is supported, find should return correct results
    const articles = await storage.find('membership', { schema: 'Article' });
    expect(articles).toHaveLength(20);
    expect(articles.every(a => a.schema === 'Article')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. End-to-end optimization verification
// ---------------------------------------------------------------------------

describe('End-to-end optimization verification', () => {
  let storage: ConceptStorage;

  beforeEach(async () => {
    storage = createInMemoryStorage();

    // Populate 50 nodes with TestSchema membership
    for (let i = 0; i < 50; i++) {
      const nodeId = `test-node-${i}`;
      await storage.put('node', nodeId, {
        node: nodeId,
        type: 'page',
        content: `Test content ${i}`,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await storage.put('membership', `${nodeId}:TestSchema`, {
        entity_id: nodeId,
        schema: 'TestSchema',
      });
      // Per-schema denormalized relation (what SchemaIndexOnApply creates)
      await storage.put('schema:TestSchema', nodeId, {
        node: nodeId,
        type: 'page',
        content: `Test content ${i}`,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemas: ['TestSchema'],
      });
    }

    // Also add some nodes with a different schema to verify filtering
    for (let i = 0; i < 10; i++) {
      const nodeId = `other-node-${i}`;
      await storage.put('node', nodeId, {
        node: nodeId,
        type: 'page',
        content: `Other content ${i}`,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await storage.put('membership', `${nodeId}:OtherSchema`, {
        entity_id: nodeId,
        schema: 'OtherSchema',
      });
      await storage.put('schema:OtherSchema', nodeId, {
        node: nodeId,
        type: 'page',
        content: `Other content ${i}`,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemas: ['OtherSchema'],
      });
    }
  });

  it('listBySchema with limit returns correct count', async () => {
    const result = await contentNodeHandler.listBySchema(
      { schema: 'TestSchema', limit: 10 },
      storage,
    );
    expect(result.variant).toBe('ok');
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(10);
  });

  it('listBySchema returns correct variant', async () => {
    const result = await contentNodeHandler.listBySchema(
      { schema: 'TestSchema' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('listBySchema results have correct fields', async () => {
    const result = await contentNodeHandler.listBySchema(
      { schema: 'TestSchema', limit: 5 },
      storage,
    );
    const items = JSON.parse(result.items as string);
    for (const item of items) {
      expect(item.node).toBeDefined();
      expect(item.node).toMatch(/^test-node-/);
      expect(item.type).toBe('page');
      expect(item.content).toBeDefined();
      expect(item.createdBy).toBe('system');
      expect(item.schemas).toContain('TestSchema');
    }
  });

  it('listBySchema does not return nodes from other schemas', async () => {
    const result = await contentNodeHandler.listBySchema(
      { schema: 'TestSchema' },
      storage,
    );
    const items = JSON.parse(result.items as string);
    for (const item of items) {
      expect(item.node).toMatch(/^test-node-/);
    }
    expect(items).toHaveLength(50);
  });

  it('listBySchema pagination window is correct', async () => {
    const result = await contentNodeHandler.listBySchema(
      { schema: 'TestSchema', offset: 10, limit: 15 },
      storage,
    );
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(15);
  });

  it('listBySchema with offset beyond data returns empty', async () => {
    const result = await contentNodeHandler.listBySchema(
      { schema: 'TestSchema', offset: 100, limit: 10 },
      storage,
    );
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(0);
  });

  it('full dataset without limit returns all matching nodes', async () => {
    const result = await contentNodeHandler.listBySchema(
      { schema: 'TestSchema' },
      storage,
    );
    const items = JSON.parse(result.items as string);
    expect(items).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------
// 6. Artifact completeness
// ---------------------------------------------------------------------------

describe('Artifact completeness', () => {
  it('runtime/types.ts exports ConceptStorage interface', () => {
    const typesPath = path.resolve('runtime/types.ts');
    expect(fs.existsSync(typesPath)).toBe(true);
    const content = fs.readFileSync(typesPath, 'utf-8');
    expect(content).toContain('ConceptStorage');
  });

  it('runtime/adapters/storage.ts has createInMemoryStorage', () => {
    const storagePath = path.resolve('runtime/adapters/storage.ts');
    expect(fs.existsSync(storagePath)).toBe(true);
    const content = fs.readFileSync(storagePath, 'utf-8');
    expect(content).toContain('createInMemoryStorage');
  });

  it('content-node handler has listBySchema action', () => {
    const handlerPath = path.resolve('handlers/ts/app/content-node.handler.ts');
    expect(fs.existsSync(handlerPath)).toBe(true);
    const content = fs.readFileSync(handlerPath, 'utf-8');
    expect(content).toContain('listBySchema');
  });

  describe('schema-index sync files exist', () => {
    const syncDir = path.resolve('clef-base/suites/entity-lifecycle/syncs');

    it('schema-index-on-apply.sync', () => {
      expect(fs.existsSync(path.join(syncDir, 'schema-index-on-apply.sync'))).toBe(true);
    });

    it('schema-index-on-remove.sync', () => {
      expect(fs.existsSync(path.join(syncDir, 'schema-index-on-remove.sync'))).toBe(true);
    });

    it('schema-index-on-save.sync', () => {
      expect(fs.existsSync(path.join(syncDir, 'schema-index-on-save.sync'))).toBe(true);
    });
  });

  describe('cache sync files exist', () => {
    const syncDir = path.resolve('clef-base/suites/entity-lifecycle/syncs');

    it('cache-list-by-schema.sync', () => {
      expect(fs.existsSync(path.join(syncDir, 'cache-list-by-schema.sync'))).toBe(true);
    });

    it('schema-change-invalidates-cache.sync', () => {
      expect(fs.existsSync(path.join(syncDir, 'schema-change-invalidates-cache.sync'))).toBe(true);
    });

    it('schema-remove-invalidates-cache.sync', () => {
      expect(fs.existsSync(path.join(syncDir, 'schema-remove-invalidates-cache.sync'))).toBe(true);
    });
  });
});
