import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  schemaYamlParserHandler,
  parseSchemaYaml,
  resetSchemaYamlParserCounter,
} from '../handlers/ts/framework/schema-yaml-parser.handler.js';

describe('SchemaYamlParser', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSchemaYamlParserCounter();
  });

  describe('parseSchemaYaml (pure function)', () => {
    it('parses a valid concept-mapped schema', () => {
      const result = parseSchemaYaml({
        schemas: {
          TaxonomyTerm: {
            concept: 'Taxonomy',
            primary_set: 'terms',
            manifest: 'content',
            fields: {
              name: { from: 'name' },
              description: { from: 'description' },
              vocabulary: { from: 'vocabulary' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas).toHaveLength(1);
      expect(result.schemas[0].name).toBe('TaxonomyTerm');
      expect(result.schemas[0].concept).toBe('Taxonomy');
      expect(result.schemas[0].primary_set).toBe('terms');
      expect(result.schemas[0].manifest).toBe('content');
      expect(Object.keys(result.schemas[0].fields)).toHaveLength(3);
      expect(result.schemas[0].fields.name.from).toBe('name');
    });

    it('parses a pure data-shape schema (no concept)', () => {
      const result = parseSchemaYaml({
        schemas: {
          Article: {
            manifest: 'content',
            fields: {
              title: { type: 'String' },
              body: { type: 'RichText' },
              publish_date: { type: 'DateTime' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas[0].concept).toBeUndefined();
      expect(result.schemas[0].fields.title.type).toBe('String');
    });

    it('parses a schema with hooks (Section 2.1.3)', () => {
      const result = parseSchemaYaml({
        schemas: {
          Media: {
            concept: 'MediaAsset',
            primary_set: 'assets',
            manifest: 'content',
            fields: {
              file_reference: { from: 'file_reference' },
            },
            hooks: {
              on_save: 'MediaAsset/processIfNeeded',
              on_apply: 'MediaAsset/initializeAsset',
              on_remove: 'MediaAsset/cleanup',
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas[0].hooks?.on_save).toBe('MediaAsset/processIfNeeded');
      expect(result.schemas[0].hooks?.on_apply).toBe('MediaAsset/initializeAsset');
      expect(result.schemas[0].hooks?.on_remove).toBe('MediaAsset/cleanup');
    });

    it('parses a schema with includes (Section 2.4.3)', () => {
      const result = parseSchemaYaml({
        schemas: {
          Media: {
            concept: 'MediaAsset',
            primary_set: 'assets',
            manifest: 'content',
            fields: {
              file_reference: { from: 'file_reference' },
            },
          },
          Image: {
            manifest: 'content',
            includes: ['Media'],
            fields: {
              width: { type: 'Int' },
              height: { type: 'Int' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas).toHaveLength(2);
      expect(result.schemas[1].includes).toEqual(['Media']);
    });

    it('parses a schema with constraints (Section 2.4.2)', () => {
      const result = parseSchemaYaml({
        schemas: {
          DailyNote: {
            concept: 'DailyNote',
            primary_set: 'notes',
            manifest: 'content',
            fields: {
              date: { from: 'date', type: 'Date' },
            },
            constraints: {
              unique: [['date']],
              max_per_user: null,
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas[0].constraints?.unique).toEqual([['date']]);
    });

    it('parses a schema with removal policy (Section 2.4.2)', () => {
      const result = parseSchemaYaml({
        schemas: {
          DailyNote: {
            manifest: 'content',
            fields: { date: { type: 'Date' } },
            removal: {
              policy: 'cascade',
              warn: true,
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas[0].removal?.policy).toBe('cascade');
      expect(result.schemas[0].removal?.warn).toBe(true);
    });

    it('parses a schema with field mutability (Section 2.4.1)', () => {
      const result = parseSchemaYaml({
        schemas: {
          View: {
            concept: 'View',
            primary_set: 'views',
            manifest: 'content',
            fields: {
              data_source: { from: 'data_source' },
              last_executed_at: { from: 'last_executed_at', mutability: 'readonly' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas[0].fields.last_executed_at.mutability).toBe('readonly');
    });

    it('parses multiple schemas in one file', () => {
      const result = parseSchemaYaml({
        schemas: {
          Workflow: {
            concept: 'Workflow',
            primary_set: 'workflows',
            manifest: 'config',
            fields: {
              name: { from: 'name' },
            },
          },
          WorkflowState: {
            concept: 'Workflow',
            primary_set: 'states',
            manifest: 'config',
            fields: {
              name: { from: 'state_name' },
              is_published: { from: 'state_is_published' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas).toHaveLength(2);
      expect(result.schemas[0].manifest).toBe('config');
      expect(result.schemas[1].manifest).toBe('config');
    });

    // Error cases

    it('rejects missing schemas key', () => {
      const result = parseSchemaYaml({});
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('schemas');
    });

    it('rejects invalid manifest value', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            manifest: 'invalid',
            fields: { x: { type: 'String' } },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('invalid manifest'))).toBe(true);
    });

    it('rejects missing manifest', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            fields: { x: { type: 'String' } },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('manifest'))).toBe(true);
    });

    it('rejects unknown field type', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            manifest: 'content',
            fields: { x: { type: 'NonExistentType' } },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('unknown type'))).toBe(true);
    });

    it('rejects hooks without concept', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            manifest: 'content',
            fields: { x: { type: 'String' } },
            hooks: {
              on_save: 'SomeConcept/doSomething',
            },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('hooks') && e.message.includes('no associated concept'))).toBe(true);
    });

    it('rejects invalid hook name', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            concept: 'SomeConcept',
            manifest: 'content',
            fields: { x: { from: 'x' } },
            hooks: {
              on_invalid: 'SomeConcept/doSomething',
            },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('Unknown hook'))).toBe(true);
    });

    it('rejects invalid hook action format', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            concept: 'SomeConcept',
            manifest: 'content',
            fields: { x: { from: 'x' } },
            hooks: {
              on_save: 'not-a-valid-action',
            },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('Concept/action'))).toBe(true);
    });

    it('rejects invalid removal policy', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            manifest: 'content',
            fields: { x: { type: 'String' } },
            removal: { policy: 'explode' },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('removal policy'))).toBe(true);
    });

    it('rejects invalid mutability', () => {
      const result = parseSchemaYaml({
        schemas: {
          Bad: {
            manifest: 'content',
            fields: { x: { type: 'String', mutability: 'writeable' } },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('mutability'))).toBe(true);
    });

    it('warns about includes referencing non-existent schemas', () => {
      const result = parseSchemaYaml({
        schemas: {
          Image: {
            manifest: 'content',
            includes: ['NonExistent'],
            fields: { width: { type: 'Int' } },
          },
        },
      });
      expect(result.errors.some(e => e.message.includes('NonExistent'))).toBe(true);
    });
  });

  describe('parse action (handler)', () => {
    it('parses valid schema.yaml and stores result', async () => {
      const result = await schemaYamlParserHandler.parse(
        {
          source: {
            schemas: {
              Article: {
                manifest: 'content',
                fields: {
                  title: { type: 'String' },
                  body: { type: 'RichText' },
                },
              },
            },
          },
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.id).toBe('schema-yaml-1');
      expect((result.schemas as unknown[]).length).toBe(1);

      // Verify stored
      const stored = await storage.get('parsed_schemas', 'schema-yaml-1');
      expect(stored).not.toBeNull();
    });

    it('returns error for invalid input', async () => {
      const result = await schemaYamlParserHandler.parse(
        { source: 'not an object' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error for schema.yaml with validation errors', async () => {
      const result = await schemaYamlParserHandler.parse(
        {
          source: {
            schemas: {
              Bad: { fields: { x: { type: 'String' } } },
            },
          },
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect((result.errors as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe('validate action', () => {
    it('returns ok for valid schema', async () => {
      const result = await schemaYamlParserHandler.validate(
        {
          source: {
            schemas: {
              Test: { manifest: 'content', fields: { x: { type: 'String' } } },
            },
          },
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.schema_count).toBe(1);
    });

    it('returns invalid for broken schema', async () => {
      const result = await schemaYamlParserHandler.validate(
        {
          source: {
            schemas: {
              Test: { fields: { x: { type: 'String' } } },
            },
          },
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });
  });

  describe('scaffold action', () => {
    it('generates a starter schema.yaml', async () => {
      const result = await schemaYamlParserHandler.scaffold(
        {
          concept_name: 'Taxonomy',
          fields: ['name', 'description', 'vocabulary'],
          manifest: 'content',
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      const scaffold = result.scaffold as Record<string, unknown>;
      expect(scaffold.schemas).toBeDefined();
      const schemas = scaffold.schemas as Record<string, unknown>;
      expect(schemas.Taxonomy).toBeDefined();
    });

    it('rejects missing concept_name', async () => {
      const result = await schemaYamlParserHandler.scaffold({}, storage);
      expect(result.variant).toBe('error');
    });
  });

  describe('spec verification: parses real clef-base schema.yaml formats', () => {
    it('parses taxonomy schema.yaml format from Section 3.1.1', () => {
      const result = parseSchemaYaml({
        schemas: {
          TaxonomyTerm: {
            concept: 'Taxonomy',
            primary_set: 'terms',
            manifest: 'content',
            fields: {
              name: { from: 'name' },
              description: { from: 'description' },
              vocabulary: { from: 'vocabulary' },
              parent: { from: 'parent' },
            },
          },
          Vocabulary: {
            concept: 'Taxonomy',
            primary_set: 'vocabularies',
            manifest: 'config',
            fields: {
              name: { from: 'vocab_name' },
              description: { from: 'vocab_description' },
              hierarchy_type: { from: 'hierarchy_type' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas).toHaveLength(2);
      expect(result.schemas[0].name).toBe('TaxonomyTerm');
      expect(result.schemas[0].manifest).toBe('content');
      expect(result.schemas[1].name).toBe('Vocabulary');
      expect(result.schemas[1].manifest).toBe('config');
    });

    it('parses media schema.yaml format from Section 2.1.3', () => {
      const result = parseSchemaYaml({
        schemas: {
          Media: {
            concept: 'MediaAsset',
            primary_set: 'assets',
            manifest: 'content',
            hooks: {
              on_save: 'MediaAsset/processIfNeeded',
              on_apply: 'MediaAsset/initializeAsset',
              on_remove: 'MediaAsset/cleanup',
            },
            fields: {
              file_reference: { from: 'file_reference' },
              mime_type: { from: 'mime_type' },
              alt_text: { from: 'alt_text' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas[0].hooks?.on_save).toBe('MediaAsset/processIfNeeded');
    });

    it('parses mixin schema format from Section 2.4.3', () => {
      const result = parseSchemaYaml({
        schemas: {
          Commentable: {
            manifest: 'content',
            fields: {
              comments_enabled: { type: 'Bool' },
              comment_order: { type: 'String' },
              comment_moderation: { type: 'String' },
            },
          },
          HasTags: {
            manifest: 'content',
            fields: {
              tags: { type: 'list Reference' },
            },
          },
          SEO: {
            manifest: 'content',
            fields: {
              meta_title: { type: 'String' },
              meta_description: { type: 'String' },
              canonical_url: { type: 'String' },
            },
          },
        },
      });

      expect(result.errors).toHaveLength(0);
      expect(result.schemas).toHaveLength(3);
      // Mixin schemas have no concept
      expect(result.schemas[0].concept).toBeUndefined();
      expect(result.schemas[1].concept).toBeUndefined();
      expect(result.schemas[2].concept).toBeUndefined();
    });
  });
});
