import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  contentNodePoolProviderHandler,
  buildSchemaMappings,
  routeSave,
  routeLoad,
  resolveSetQuery,
  resetContentNodePoolProviderCounter,
} from '../handlers/ts/framework/content-node-pool-provider.handler.js';
import type { SchemaDef } from '../handlers/ts/framework/schema-yaml-parser.handler.js';
import type { SchemaMapping } from '../handlers/ts/framework/content-node-pool-provider.handler.js';

describe('ContentNodePoolProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetContentNodePoolProviderCounter();
  });

  // Helper: create a typical taxonomy schema def
  function taxonomySchemas(): SchemaDef[] {
    return [
      {
        name: 'TaxonomyTerm',
        concept: 'Taxonomy',
        primary_set: 'terms',
        manifest: 'content',
        fields: {
          name: { name: 'name', from: 'name' },
          description: { name: 'description', from: 'description' },
          vocabulary: { name: 'vocabulary', from: 'vocabulary' },
          parent: { name: 'parent', from: 'parent' },
        },
      },
      {
        name: 'Vocabulary',
        concept: 'Taxonomy',
        primary_set: 'vocabularies',
        manifest: 'config',
        fields: {
          name: { name: 'name', from: 'vocab_name' },
          description: { name: 'description', from: 'vocab_description' },
          hierarchy_type: { name: 'hierarchy_type', from: 'hierarchy_type' },
        },
      },
    ];
  }

  describe('buildSchemaMappings (pure function)', () => {
    it('builds mappings for concept-mapped schemas', () => {
      const mappings = buildSchemaMappings(taxonomySchemas());

      expect(mappings).toHaveLength(2);
      expect(mappings[0].schemaName).toBe('TaxonomyTerm');
      expect(mappings[0].concept).toBe('Taxonomy');
      expect(mappings[0].primarySet).toBe('terms');
      expect(mappings[0].manifest).toBe('content');
      expect(mappings[0].mappedFields).toHaveLength(4);
    });

    it('identifies mapped field pairs correctly', () => {
      const mappings = buildSchemaMappings(taxonomySchemas());
      const termMapping = mappings[0];

      const nameField = termMapping.mappedFields.find(f => f.conceptField === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.schemaField).toBe('name');
      expect(nameField!.mutability).toBe('editable');
    });

    it('identifies unmapped fields from concept state', () => {
      const allConceptFields = ['name', 'description', 'vocabulary', 'parent', 'hierarchy_cache', 'ordering_index'];
      const mappings = buildSchemaMappings(taxonomySchemas(), allConceptFields);

      expect(mappings[0].unmappedFields).toContain('hierarchy_cache');
      expect(mappings[0].unmappedFields).toContain('ordering_index');
      expect(mappings[0].unmappedFields).not.toContain('name');
    });

    it('skips schemas without an associated concept', () => {
      const schemas: SchemaDef[] = [
        {
          name: 'Commentable',
          manifest: 'content',
          fields: {
            comments_enabled: { name: 'comments_enabled', type: 'Bool' },
          },
        },
      ];

      const mappings = buildSchemaMappings(schemas);
      expect(mappings).toHaveLength(0);
    });

    it('handles schemas with mixed mapped and unmapped fields', () => {
      const schemas: SchemaDef[] = [{
        name: 'View',
        concept: 'View',
        primary_set: 'views',
        manifest: 'content',
        fields: {
          data_source: { name: 'data_source', from: 'data_source' },
          filters: { name: 'filters', from: 'filters' },
          last_executed_at: { name: 'last_executed_at', from: 'last_executed_at', mutability: 'readonly' },
        },
      }];

      const allFields = ['data_source', 'filters', 'last_executed_at', 'cached_results'];
      const mappings = buildSchemaMappings(schemas, allFields);

      expect(mappings[0].mappedFields).toHaveLength(3);
      expect(mappings[0].unmappedFields).toEqual(['cached_results']);

      const readonlyField = mappings[0].mappedFields.find(f => f.conceptField === 'last_executed_at');
      expect(readonlyField!.mutability).toBe('readonly');
    });
  });

  describe('routeSave (pure function)', () => {
    it('routes mapped fields to ContentNode Properties', () => {
      const mapping: SchemaMapping = {
        schemaName: 'TaxonomyTerm',
        concept: 'Taxonomy',
        primarySet: 'terms',
        manifest: 'content',
        mappedFields: [
          { schemaName: 'TaxonomyTerm', conceptField: 'name', schemaField: 'name', mutability: 'editable' },
          { schemaName: 'TaxonomyTerm', conceptField: 'description', schemaField: 'description', mutability: 'editable' },
        ],
        unmappedFields: ['hierarchy_cache'],
      };

      const result = routeSave('entity-1', {
        name: 'Science',
        description: 'Scientific topics',
        hierarchy_cache: { depth: 0 },
      }, mapping);

      expect(result.contentNodeProperties).toEqual({
        name: 'Science',
        description: 'Scientific topics',
      });
      expect(result.conceptLocalData).toEqual({
        hierarchy_cache: { depth: 0 },
      });
      expect(result.schemaToApply).toBe('TaxonomyTerm');
    });

    it('skips system-mutability fields on save', () => {
      const mapping: SchemaMapping = {
        schemaName: 'View',
        concept: 'View',
        primarySet: 'views',
        manifest: 'content',
        mappedFields: [
          { schemaName: 'View', conceptField: 'data_source', schemaField: 'data_source', mutability: 'editable' },
          { schemaName: 'View', conceptField: 'created_at', schemaField: 'created_at', mutability: 'system' },
        ],
        unmappedFields: [],
      };

      const result = routeSave('entity-2', {
        data_source: 'articles',
        created_at: '2025-01-01',
      }, mapping);

      expect(result.contentNodeProperties).toEqual({ data_source: 'articles' });
      // system field not in Properties
      expect(result.contentNodeProperties).not.toHaveProperty('created_at');
    });

    it('excludes id from routing', () => {
      const mapping: SchemaMapping = {
        schemaName: 'Test',
        concept: 'Test',
        primarySet: 'items',
        manifest: 'content',
        mappedFields: [
          { schemaName: 'Test', conceptField: 'title', schemaField: 'title', mutability: 'editable' },
        ],
        unmappedFields: [],
      };

      const result = routeSave('entity-3', { id: 'entity-3', title: 'Hello' }, mapping);
      expect(result.contentNodeProperties).toEqual({ title: 'Hello' });
      expect(result.conceptLocalData).toEqual({});
    });
  });

  describe('routeLoad (pure function)', () => {
    it('merges ContentNode Properties with concept-local data', () => {
      const mapping: SchemaMapping = {
        schemaName: 'TaxonomyTerm',
        concept: 'Taxonomy',
        primarySet: 'terms',
        manifest: 'content',
        mappedFields: [
          { schemaName: 'TaxonomyTerm', conceptField: 'name', schemaField: 'name', mutability: 'editable' },
          { schemaName: 'TaxonomyTerm', conceptField: 'vocabulary', schemaField: 'vocabulary', mutability: 'editable' },
        ],
        unmappedFields: ['hierarchy_cache'],
      };

      const result = routeLoad(
        { name: 'Science', vocabulary: 'topics' },
        { hierarchy_cache: { depth: 0, children: [] } },
        mapping,
      );

      expect(result).toEqual({
        name: 'Science',
        vocabulary: 'topics',
        hierarchy_cache: { depth: 0, children: [] },
      });
    });

    it('maps schema field names back to concept field names', () => {
      const mapping: SchemaMapping = {
        schemaName: 'Vocabulary',
        concept: 'Taxonomy',
        primarySet: 'vocabularies',
        manifest: 'config',
        mappedFields: [
          { schemaName: 'Vocabulary', conceptField: 'vocab_name', schemaField: 'name', mutability: 'editable' },
          { schemaName: 'Vocabulary', conceptField: 'vocab_description', schemaField: 'description', mutability: 'editable' },
        ],
        unmappedFields: [],
      };

      const result = routeLoad(
        { name: 'Tags', description: 'Tag vocabulary' },
        {},
        mapping,
      );

      // Properties are under schema field names, but concept sees concept field names
      expect(result.vocab_name).toBe('Tags');
      expect(result.vocab_description).toBe('Tag vocabulary');
    });
  });

  describe('resolveSetQuery (pure function)', () => {
    it('resolves a set name to a Schema membership query', () => {
      const mappings = buildSchemaMappings(taxonomySchemas());
      const result = resolveSetQuery('terms', mappings);

      expect(result).not.toBeNull();
      expect(result!.schemaName).toBe('TaxonomyTerm');
      expect(result!.concept).toBe('Taxonomy');
    });

    it('returns null for unknown set names', () => {
      const mappings = buildSchemaMappings(taxonomySchemas());
      const result = resolveSetQuery('nonexistent', mappings);
      expect(result).toBeNull();
    });

    it('resolves config set names', () => {
      const mappings = buildSchemaMappings(taxonomySchemas());
      const result = resolveSetQuery('vocabularies', mappings);

      expect(result).not.toBeNull();
      expect(result!.schemaName).toBe('Vocabulary');
    });
  });

  describe('configure action (handler)', () => {
    it('configures pool provider from schema defs', async () => {
      const result = await contentNodePoolProviderHandler.configure(
        { schemas: taxonomySchemas() },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.id).toBe('pool-config-1');
      const config = result.config as { schemaMappings: SchemaMapping[]; conceptName: string };
      expect(config.conceptName).toBe('Taxonomy');
      expect(config.schemaMappings).toHaveLength(2);

      // Verify stored
      const stored = await storage.get('pool_configs', 'pool-config-1');
      expect(stored).not.toBeNull();
    });

    it('returns error for non-array schemas', async () => {
      const result = await contentNodePoolProviderHandler.configure(
        { schemas: 'bad' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error when no concept-mapped schemas found', async () => {
      const result = await contentNodePoolProviderHandler.configure(
        { schemas: [{ name: 'Pure', manifest: 'content', fields: {} }] },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('includes unmapped fields when concept_state_fields provided', async () => {
      const result = await contentNodePoolProviderHandler.configure(
        {
          schemas: taxonomySchemas(),
          concept_state_fields: ['name', 'description', 'vocabulary', 'parent', 'hierarchy_cache'],
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      const config = result.config as { schemaMappings: SchemaMapping[] };
      expect(config.schemaMappings[0].unmappedFields).toContain('hierarchy_cache');
    });
  });

  describe('routeSave action (handler)', () => {
    it('routes save data through the pool provider', async () => {
      // First configure
      const configResult = await contentNodePoolProviderHandler.configure(
        { schemas: taxonomySchemas() },
        storage,
      );
      const config = configResult.config;

      const result = await contentNodePoolProviderHandler.routeSave(
        {
          entity_id: 'term-1',
          data: { name: 'Science', description: 'Science terms', hierarchy_cache: {} },
          schema_name: 'TaxonomyTerm',
          config,
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.content_node_properties).toEqual({
        name: 'Science',
        description: 'Science terms',
      });
      expect(result.concept_local_data).toEqual({ hierarchy_cache: {} });
      expect(result.schema_to_apply).toBe('TaxonomyTerm');
    });

    it('returns error for unknown schema', async () => {
      const configResult = await contentNodePoolProviderHandler.configure(
        { schemas: taxonomySchemas() },
        storage,
      );

      const result = await contentNodePoolProviderHandler.routeSave(
        {
          entity_id: 'x',
          data: {},
          schema_name: 'Unknown',
          config: configResult.config,
        },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  });

  describe('routeLoad action (handler)', () => {
    it('merges properties and local data on load', async () => {
      const configResult = await contentNodePoolProviderHandler.configure(
        { schemas: taxonomySchemas() },
        storage,
      );

      const result = await contentNodePoolProviderHandler.routeLoad(
        {
          content_node_properties: { name: 'Art', description: 'Art terms' },
          concept_local_data: { hierarchy_cache: { depth: 1 } },
          schema_name: 'TaxonomyTerm',
          config: configResult.config,
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe('Art');
      expect(data.hierarchy_cache).toEqual({ depth: 1 });
    });
  });

  describe('resolveSet action (handler)', () => {
    it('resolves set to schema membership', async () => {
      const configResult = await contentNodePoolProviderHandler.configure(
        { schemas: taxonomySchemas() },
        storage,
      );

      const result = await contentNodePoolProviderHandler.resolveSet(
        { set_name: 'terms', config: configResult.config },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.schema_name).toBe('TaxonomyTerm');
    });

    it('returns notfound for unknown set', async () => {
      const configResult = await contentNodePoolProviderHandler.configure(
        { schemas: taxonomySchemas() },
        storage,
      );

      const result = await contentNodePoolProviderHandler.resolveSet(
        { set_name: 'nonexistent', config: configResult.config },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('describe action (handler)', () => {
    it('returns field routing summary', async () => {
      const configResult = await contentNodePoolProviderHandler.configure(
        {
          schemas: taxonomySchemas(),
          concept_state_fields: ['name', 'description', 'vocabulary', 'parent', 'hierarchy_cache'],
        },
        storage,
      );

      const result = await contentNodePoolProviderHandler.describe(
        { config: configResult.config },
        storage,
      );

      expect(result.variant).toBe('ok');
      const schemas = result.schemas as Array<{ schema: string; mappedFieldCount: number; unmappedFieldCount: number }>;
      expect(schemas).toHaveLength(2);
      expect(schemas[0].mappedFieldCount).toBe(4);
      expect(schemas[0].unmappedFieldCount).toBe(1);
    });
  });

  describe('spec verification: routes data per Section 13.1', () => {
    it('taxonomy term save: mapped fields → Properties, unmapped → local', () => {
      const mappings = buildSchemaMappings(taxonomySchemas(), [
        'name', 'description', 'vocabulary', 'parent', 'hierarchy_cache', 'ordering_index',
      ]);
      const termMapping = mappings[0];

      const routed = routeSave('term-1', {
        name: 'Biology',
        description: 'Biology terms',
        vocabulary: 'science-vocab',
        parent: null,
        hierarchy_cache: { depth: 0, children: ['term-2'] },
        ordering_index: 42,
      }, termMapping);

      // Mapped → ContentNode Properties
      expect(routed.contentNodeProperties).toEqual({
        name: 'Biology',
        description: 'Biology terms',
        vocabulary: 'science-vocab',
        parent: null,
      });

      // Unmapped → concept-local
      expect(routed.conceptLocalData).toEqual({
        hierarchy_cache: { depth: 0, children: ['term-2'] },
        ordering_index: 42,
      });

      expect(routed.schemaToApply).toBe('TaxonomyTerm');
    });

    it('round-trip: save then load preserves all data', () => {
      const mappings = buildSchemaMappings(taxonomySchemas());
      const termMapping = mappings[0];

      const originalData = {
        name: 'Physics',
        description: 'Physics topics',
        vocabulary: 'science',
        parent: 'term-0',
        hierarchy_cache: { depth: 1 },
      };

      // Save
      const saved = routeSave('term-5', originalData, termMapping);

      // Load (reconstitute from the two storage locations)
      const loaded = routeLoad(
        saved.contentNodeProperties,
        saved.conceptLocalData,
        termMapping,
      );

      expect(loaded.name).toBe('Physics');
      expect(loaded.description).toBe('Physics topics');
      expect(loaded.vocabulary).toBe('science');
      expect(loaded.parent).toBe('term-0');
      expect(loaded.hierarchy_cache).toEqual({ depth: 1 });
    });

    it('set membership resolves to Schema membership per Section 13.1', () => {
      const mappings = buildSchemaMappings(taxonomySchemas());

      // "terms" set → all ContentNodes with Schema "TaxonomyTerm"
      const terms = resolveSetQuery('terms', mappings);
      expect(terms).toEqual({ schemaName: 'TaxonomyTerm', concept: 'Taxonomy' });

      // "vocabularies" set → all ContentNodes with Schema "Vocabulary"
      const vocabs = resolveSetQuery('vocabularies', mappings);
      expect(vocabs).toEqual({ schemaName: 'Vocabulary', concept: 'Taxonomy' });
    });
  });
});
