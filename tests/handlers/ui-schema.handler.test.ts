// ============================================================
// UISchema Handler Tests
//
// Tests for UI schema derivation from concept specs, override
// merging, schema retrieval, element extraction, entity element
// access, and resolution marking.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { uiSchemaHandler } from '../../handlers/ts/app/ui-schema.handler.js';

describe('UISchema Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // Helper: build a minimal concept spec JSON string
  function specJSON(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      name: 'Article',
      fields: [
        { name: 'title', type: 'String' },
        { name: 'body', type: 'Text' },
      ],
      actions: [{ name: 'publish' }, { name: 'archive' }],
      ...overrides,
    });
  }

  // ----------------------------------------------------------
  // inspect
  // ----------------------------------------------------------

  describe('inspect', () => {
    it('parses concept spec and returns ok with schema ID and element count', async () => {
      const result = await uiSchemaHandler.inspect({
        schema: 'my-schema',
        conceptSpec: specJSON(),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.schema).toBe('my-schema');
      expect(result.elementCount).toBe(2);
    });

    it('auto-generates a schema ID when schema input is empty', async () => {
      const result = await uiSchemaHandler.inspect({
        schema: '',
        conceptSpec: specJSON(),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(typeof result.schema).toBe('string');
      expect((result.schema as string).startsWith('S-')).toBe(true);
    });

    it('extracts string-only fields as element names', async () => {
      const spec = JSON.stringify({
        name: 'Simple',
        fields: ['alpha', 'beta', 'gamma'],
      });

      const result = await uiSchemaHandler.inspect({
        schema: 'str-fields',
        conceptSpec: spec,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.elementCount).toBe(3);

      // Verify stored elements
      const getResult = await uiSchemaHandler.getElements({ schema: 'str-fields' }, storage);
      const elements = JSON.parse(getResult.elements as string);
      expect(elements).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('extracts action names from action objects with name property', async () => {
      const spec = JSON.stringify({
        name: 'Widget',
        fields: [],
        actions: [{ name: 'create' }, { name: 'delete' }],
      });

      const result = await uiSchemaHandler.inspect({
        schema: 'action-test',
        conceptSpec: spec,
      }, storage);

      expect(result.variant).toBe('ok');

      // Verify entity element contains actions
      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'action-test' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);
      expect(entity.actions).toEqual(['create', 'delete']);
    });

    it('extracts string-only actions', async () => {
      const spec = JSON.stringify({
        name: 'Widget',
        fields: [],
        actions: ['submit', 'reset'],
      });

      await uiSchemaHandler.inspect({
        schema: 'str-actions',
        conceptSpec: spec,
      }, storage);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'str-actions' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);
      expect(entity.actions).toEqual(['submit', 'reset']);
    });

    it('builds an entity element with kind, concept, suite, tags, fields, actions', async () => {
      const spec = JSON.stringify({
        name: 'Note',
        suite: 'collaboration',
        annotations: {
          surface: { tags: ['editable', 'rich-text'] },
        },
        fields: [{ name: 'content', type: 'Text' }],
        actions: [{ name: 'edit' }],
      });

      await uiSchemaHandler.inspect({
        schema: 'entity-test',
        conceptSpec: spec,
      }, storage);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'entity-test' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);

      expect(entity.kind).toBe('entity');
      expect(entity.concept).toBe('Note');
      expect(entity.suite).toBe('collaboration');
      expect(entity.tags).toEqual(['editable', 'rich-text']);
      expect(entity.fields).toEqual([{ name: 'content', type: 'Text' }]);
      expect(entity.actions).toEqual(['edit']);
    });

    it('defaults suite to null and tags to empty when not in spec', async () => {
      const spec = JSON.stringify({ name: 'Plain', fields: [], actions: [] });

      await uiSchemaHandler.inspect({
        schema: 'defaults-test',
        conceptSpec: spec,
      }, storage);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'defaults-test' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);

      expect(entity.suite).toBeNull();
      expect(entity.tags).toEqual([]);
    });

    it('stores uiSchema with vertical layout', async () => {
      await uiSchemaHandler.inspect({
        schema: 'layout-test',
        conceptSpec: specJSON(),
      }, storage);

      const schemaResult = await uiSchemaHandler.getSchema({ schema: 'layout-test' }, storage);
      const uiSchema = JSON.parse(schemaResult.uiSchema as string);

      expect(uiSchema.layout).toBe('vertical');
      expect(uiSchema.concept).toBe('Article');
      expect(uiSchema.elements).toEqual(['title', 'body']);
      expect(uiSchema.generatedAt).toBeDefined();
    });

    it('returns parseError for invalid JSON in conceptSpec', async () => {
      const result = await uiSchemaHandler.inspect({
        schema: 'bad',
        conceptSpec: '{not valid json',
      }, storage);

      expect(result.variant).toBe('parseError');
      expect(result.message).toBe('Failed to parse concept spec as JSON');
    });

    it('uses schema ID as concept name fallback when name is absent', async () => {
      const spec = JSON.stringify({ fields: [] });

      await uiSchemaHandler.inspect({
        schema: 'fallback-name',
        conceptSpec: spec,
      }, storage);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'fallback-name' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);
      expect(entity.concept).toBe('fallback-name');

      const schemaResult = await uiSchemaHandler.getSchema({ schema: 'fallback-name' }, storage);
      const uiSchema = JSON.parse(schemaResult.uiSchema as string);
      expect(uiSchema.concept).toBe('fallback-name');
    });

    it('handles spec with no fields and no actions gracefully', async () => {
      const spec = JSON.stringify({ name: 'Empty' });

      const result = await uiSchemaHandler.inspect({
        schema: 'empty-concept',
        conceptSpec: spec,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.elementCount).toBe(0);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'empty-concept' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);
      expect(entity.fields).toEqual([]);
      expect(entity.actions).toEqual([]);
    });

    it('records field type as String for string-only fields in entity element', async () => {
      const spec = JSON.stringify({
        name: 'Typed',
        fields: ['alpha', { name: 'beta', type: 'Number' }],
      });

      await uiSchemaHandler.inspect({
        schema: 'typed-fields',
        conceptSpec: spec,
      }, storage);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'typed-fields' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);
      expect(entity.fields).toEqual([
        { name: 'alpha', type: 'String' },
        { name: 'beta', type: 'Number' },
      ]);
    });

    it('defaults field type to String when object field has no type', async () => {
      const spec = JSON.stringify({
        name: 'NoType',
        fields: [{ name: 'orphan' }],
      });

      await uiSchemaHandler.inspect({
        schema: 'no-type',
        conceptSpec: spec,
      }, storage);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'no-type' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);
      expect(entity.fields).toEqual([{ name: 'orphan', type: 'String' }]);
    });

    it('stores surface annotations in the entity element', async () => {
      const spec = JSON.stringify({
        name: 'Annotated',
        fields: [],
        annotations: {
          surface: { tags: ['inline'], display: 'card' },
        },
      });

      await uiSchemaHandler.inspect({
        schema: 'annotated',
        conceptSpec: spec,
      }, storage);

      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'annotated' }, storage);
      const entity = JSON.parse(entityResult.entityElement as string);
      expect(entity.annotations).toEqual({ tags: ['inline'], display: 'card' });
    });
  });

  // ----------------------------------------------------------
  // override
  // ----------------------------------------------------------

  describe('override', () => {
    it('merges overrides into existing schema and returns ok', async () => {
      await uiSchemaHandler.inspect({
        schema: 'ov-1',
        conceptSpec: specJSON(),
      }, storage);

      const result = await uiSchemaHandler.override({
        schema: 'ov-1',
        overrides: JSON.stringify({ layout: 'horizontal' }),
      }, storage);

      expect(result.variant).toBe('ok');

      // Verify the uiSchema now includes the override
      const schemaResult = await uiSchemaHandler.getSchema({ schema: 'ov-1' }, storage);
      const uiSchema = JSON.parse(schemaResult.uiSchema as string);
      expect(uiSchema.layout).toBe('horizontal');
    });

    it('accumulates multiple overrides', async () => {
      await uiSchemaHandler.inspect({
        schema: 'ov-2',
        conceptSpec: specJSON(),
      }, storage);

      await uiSchemaHandler.override({
        schema: 'ov-2',
        overrides: JSON.stringify({ theme: 'dark' }),
      }, storage);

      await uiSchemaHandler.override({
        schema: 'ov-2',
        overrides: JSON.stringify({ spacing: 'compact' }),
      }, storage);

      const schemaResult = await uiSchemaHandler.getSchema({ schema: 'ov-2' }, storage);
      const uiSchema = JSON.parse(schemaResult.uiSchema as string);
      expect(uiSchema.theme).toBe('dark');
      expect(uiSchema.spacing).toBe('compact');
    });

    it('returns notfound when overriding a non-existent schema', async () => {
      const result = await uiSchemaHandler.override({
        schema: 'ghost',
        overrides: JSON.stringify({ layout: 'grid' }),
      }, storage);

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('ghost');
    });

    it('returns invalid for malformed JSON overrides', async () => {
      await uiSchemaHandler.inspect({
        schema: 'ov-bad',
        conceptSpec: specJSON(),
      }, storage);

      const result = await uiSchemaHandler.override({
        schema: 'ov-bad',
        overrides: '{{broken',
      }, storage);

      expect(result.variant).toBe('invalid');
      expect(result.message).toBe('Overrides must be valid JSON');
    });

    it('later override keys overwrite earlier ones', async () => {
      await uiSchemaHandler.inspect({
        schema: 'ov-overwrite',
        conceptSpec: specJSON(),
      }, storage);

      await uiSchemaHandler.override({
        schema: 'ov-overwrite',
        overrides: JSON.stringify({ layout: 'tabs' }),
      }, storage);

      await uiSchemaHandler.override({
        schema: 'ov-overwrite',
        overrides: JSON.stringify({ layout: 'accordion' }),
      }, storage);

      const schemaResult = await uiSchemaHandler.getSchema({ schema: 'ov-overwrite' }, storage);
      const uiSchema = JSON.parse(schemaResult.uiSchema as string);
      expect(uiSchema.layout).toBe('accordion');
    });
  });

  // ----------------------------------------------------------
  // getSchema
  // ----------------------------------------------------------

  describe('getSchema', () => {
    it('returns the full uiSchema JSON for a known schema ID', async () => {
      await uiSchemaHandler.inspect({
        schema: 'gs-1',
        conceptSpec: specJSON(),
      }, storage);

      const result = await uiSchemaHandler.getSchema({ schema: 'gs-1' }, storage);
      expect(result.variant).toBe('ok');

      const uiSchema = JSON.parse(result.uiSchema as string);
      expect(uiSchema.concept).toBe('Article');
      expect(uiSchema.elements).toEqual(['title', 'body']);
      expect(uiSchema.layout).toBe('vertical');
    });

    it('returns notfound for a missing schema', async () => {
      const result = await uiSchemaHandler.getSchema({ schema: 'nonexistent' }, storage);

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('nonexistent');
    });
  });

  // ----------------------------------------------------------
  // getElements
  // ----------------------------------------------------------

  describe('getElements', () => {
    it('returns the elements list for a known schema', async () => {
      await uiSchemaHandler.inspect({
        schema: 'ge-1',
        conceptSpec: specJSON(),
      }, storage);

      const result = await uiSchemaHandler.getElements({ schema: 'ge-1' }, storage);
      expect(result.variant).toBe('ok');

      const elements = JSON.parse(result.elements as string);
      expect(elements).toEqual(['title', 'body']);
    });

    it('returns notfound for a missing schema', async () => {
      const result = await uiSchemaHandler.getElements({ schema: 'missing' }, storage);

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('missing');
    });

    it('returns resolved variant after markResolved has been called', async () => {
      await uiSchemaHandler.inspect({
        schema: 'ge-resolved',
        conceptSpec: specJSON(),
      }, storage);

      await uiSchemaHandler.markResolved({ schema: 'ge-resolved' }, storage);

      const result = await uiSchemaHandler.getElements({ schema: 'ge-resolved' }, storage);
      expect(result.variant).toBe('resolved');
      expect(result.message).toContain('entity level');
    });
  });

  // ----------------------------------------------------------
  // getEntityElement
  // ----------------------------------------------------------

  describe('getEntityElement', () => {
    it('returns the entity element for a known schema', async () => {
      await uiSchemaHandler.inspect({
        schema: 'gee-1',
        conceptSpec: specJSON({ name: 'Profile', suite: 'identity' }),
      }, storage);

      const result = await uiSchemaHandler.getEntityElement({ schema: 'gee-1' }, storage);
      expect(result.variant).toBe('ok');

      const entity = JSON.parse(result.entityElement as string);
      expect(entity.kind).toBe('entity');
      expect(entity.concept).toBe('Profile');
      expect(entity.suite).toBe('identity');
    });

    it('returns notfound for a missing schema', async () => {
      const result = await uiSchemaHandler.getEntityElement({ schema: 'absent' }, storage);

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('absent');
    });
  });

  // ----------------------------------------------------------
  // markResolved
  // ----------------------------------------------------------

  describe('markResolved', () => {
    it('sets resolved flag and returns ok', async () => {
      await uiSchemaHandler.inspect({
        schema: 'mr-1',
        conceptSpec: specJSON(),
      }, storage);

      const result = await uiSchemaHandler.markResolved({ schema: 'mr-1' }, storage);
      expect(result.variant).toBe('ok');
    });

    it('is idempotent -- calling markResolved twice returns ok both times', async () => {
      await uiSchemaHandler.inspect({
        schema: 'mr-idem',
        conceptSpec: specJSON(),
      }, storage);

      const first = await uiSchemaHandler.markResolved({ schema: 'mr-idem' }, storage);
      expect(first.variant).toBe('ok');

      const second = await uiSchemaHandler.markResolved({ schema: 'mr-idem' }, storage);
      expect(second.variant).toBe('ok');

      // getElements should still report resolved
      const elemResult = await uiSchemaHandler.getElements({ schema: 'mr-idem' }, storage);
      expect(elemResult.variant).toBe('resolved');
    });

    it('returns notfound for a missing schema', async () => {
      const result = await uiSchemaHandler.markResolved({ schema: 'does-not-exist' }, storage);

      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('does-not-exist');
    });
  });

  // ----------------------------------------------------------
  // Cross-action integration scenarios
  // ----------------------------------------------------------

  describe('cross-action integration', () => {
    it('inspect then override then getSchema reflects merged state', async () => {
      await uiSchemaHandler.inspect({
        schema: 'int-1',
        conceptSpec: specJSON(),
      }, storage);

      await uiSchemaHandler.override({
        schema: 'int-1',
        overrides: JSON.stringify({ layout: 'grid', columns: 2 }),
      }, storage);

      const schemaResult = await uiSchemaHandler.getSchema({ schema: 'int-1' }, storage);
      const uiSchema = JSON.parse(schemaResult.uiSchema as string);

      expect(uiSchema.layout).toBe('grid');
      expect(uiSchema.columns).toBe(2);
      // Original fields still present
      expect(uiSchema.concept).toBe('Article');
      expect(uiSchema.elements).toEqual(['title', 'body']);
    });

    it('markResolved does not affect getSchema or getEntityElement', async () => {
      await uiSchemaHandler.inspect({
        schema: 'int-2',
        conceptSpec: specJSON(),
      }, storage);

      await uiSchemaHandler.markResolved({ schema: 'int-2' }, storage);

      // getSchema still works
      const schemaResult = await uiSchemaHandler.getSchema({ schema: 'int-2' }, storage);
      expect(schemaResult.variant).toBe('ok');

      // getEntityElement still works
      const entityResult = await uiSchemaHandler.getEntityElement({ schema: 'int-2' }, storage);
      expect(entityResult.variant).toBe('ok');
    });
  });
});
