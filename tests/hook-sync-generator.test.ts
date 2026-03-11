import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  hookSyncGeneratorHandler,
  generateHookSync,
  generateAllHookSyncs,
  resetHookSyncGeneratorCounter,
} from '../handlers/ts/framework/hook-sync-generator.handler.js';
import type { SchemaDef } from '../handlers/ts/framework/schema-yaml-parser.handler.js';

describe('HookSyncGenerator', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetHookSyncGeneratorCounter();
  });

  describe('generateHookSync (pure function)', () => {
    it('generates on_save hook sync with schema filter (Section 2.1.3)', () => {
      const result = generateHookSync('Media', 'on_save', 'MediaAsset/processIfNeeded');
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.name).toBe('Media_onSave');
        expect(result.schemaName).toBe('Media');
        expect(result.hookType).toBe('on_save');
        expect(result.content).toContain('sync Media_onSave [eventual]');
        expect(result.content).toContain('ContentStorage/save: [ id: ?id ] => [ ok: _ ]');
        expect(result.content).toContain('Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]');
        expect(result.content).toContain('filter("Media" in ?schemas)');
        expect(result.content).toContain('MediaAsset/processIfNeeded: [ entity_id: ?id ]');
      }
    });

    it('generates on_apply hook sync with schema param (Section 2.1.3)', () => {
      const result = generateHookSync('Media', 'on_apply', 'MediaAsset/initializeAsset');
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.name).toBe('Media_onApply');
        expect(result.content).toContain('sync Media_onApply [eager]');
        expect(result.content).toContain('Schema/applyTo: [ entity_id: ?id; schema: "Media" ] => [ ok: _ ]');
        // on_apply should NOT have a where clause with schema filter
        expect(result.content).not.toContain('Schema/getSchemasFor');
        expect(result.content).not.toContain('filter');
        expect(result.content).toContain('MediaAsset/initializeAsset: [ entity_id: ?id ]');
      }
    });

    it('generates on_remove hook sync (Section 2.1.3)', () => {
      const result = generateHookSync('Media', 'on_remove', 'MediaAsset/cleanup');
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.name).toBe('Media_onRemove');
        expect(result.content).toContain('sync Media_onRemove [eventual]');
        expect(result.content).toContain('Schema/removeFrom: [ entity_id: ?id; schema: "Media" ] => [ ok: _ ]');
        expect(result.content).not.toContain('Schema/getSchemasFor');
        expect(result.content).toContain('MediaAsset/cleanup: [ entity_id: ?id ]');
      }
    });

    it('generates on_delete hook sync with schema filter', () => {
      const result = generateHookSync('Media', 'on_delete', 'MediaAsset/deleteExternalFiles');
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.name).toBe('Media_onDelete');
        expect(result.content).toContain('sync Media_onDelete [eventual]');
        expect(result.content).toContain('ContentStorage/delete: [ id: ?id ] => [ ok: _ ]');
        expect(result.content).toContain('Schema/getSchemasFor');
        expect(result.content).toContain('filter("Media" in ?schemas)');
        expect(result.content).toContain('MediaAsset/deleteExternalFiles: [ entity_id: ?id ]');
      }
    });

    it('includes comment header with schema and hook info', () => {
      const result = generateHookSync('View', 'on_save', 'View/invalidateCache');
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.content).toContain('Auto-generated hook sync from schema.yaml');
        expect(result.content).toContain('Schema: View');
        expect(result.content).toContain('Hook: on_save');
        expect(result.content).toContain('Action: View/invalidateCache');
      }
    });

    it('rejects unknown hook type', () => {
      const result = generateHookSync('Media', 'on_unknown', 'MediaAsset/doSomething');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Unknown hook type');
      }
    });

    it('rejects invalid action reference format', () => {
      const result = generateHookSync('Media', 'on_save', 'not-valid');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Concept/action format');
      }
    });
  });

  describe('generateAllHookSyncs', () => {
    it('generates syncs for all hooks on a schema', () => {
      const schemas: SchemaDef[] = [{
        name: 'Media',
        concept: 'MediaAsset',
        primary_set: 'assets',
        manifest: 'content',
        fields: {},
        hooks: {
          on_save: 'MediaAsset/processIfNeeded',
          on_apply: 'MediaAsset/initializeAsset',
          on_remove: 'MediaAsset/cleanup',
        },
      }];

      const result = generateAllHookSyncs(schemas);
      expect(result.errors).toHaveLength(0);
      expect(result.syncs).toHaveLength(3);
      expect(result.syncs.map(s => s.hookType)).toEqual(['on_save', 'on_apply', 'on_remove']);
    });

    it('generates syncs for multiple schemas', () => {
      const schemas: SchemaDef[] = [
        {
          name: 'Media',
          concept: 'MediaAsset',
          manifest: 'content',
          fields: {},
          hooks: { on_save: 'MediaAsset/processIfNeeded' },
        },
        {
          name: 'View',
          concept: 'View',
          manifest: 'content',
          fields: {},
          hooks: { on_save: 'View/invalidateCache' },
        },
      ];

      const result = generateAllHookSyncs(schemas);
      expect(result.errors).toHaveLength(0);
      expect(result.syncs).toHaveLength(2);
      expect(result.syncs[0].name).toBe('Media_onSave');
      expect(result.syncs[1].name).toBe('View_onSave');
    });

    it('skips schemas without hooks', () => {
      const schemas: SchemaDef[] = [
        {
          name: 'Article',
          manifest: 'content',
          fields: {},
        },
        {
          name: 'Media',
          concept: 'MediaAsset',
          manifest: 'content',
          fields: {},
          hooks: { on_save: 'MediaAsset/processIfNeeded' },
        },
      ];

      const result = generateAllHookSyncs(schemas);
      expect(result.errors).toHaveLength(0);
      expect(result.syncs).toHaveLength(1);
    });

    it('errors on hooks without associated concept', () => {
      const schemas: SchemaDef[] = [{
        name: 'Bad',
        manifest: 'content',
        fields: {},
        hooks: { on_save: 'SomeConcept/doSomething' },
      }];

      const result = generateAllHookSyncs(schemas);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('no associated concept');
    });

    it('returns empty for schemas with no hooks at all', () => {
      const schemas: SchemaDef[] = [{
        name: 'Plain',
        manifest: 'content',
        fields: {},
      }];

      const result = generateAllHookSyncs(schemas);
      expect(result.errors).toHaveLength(0);
      expect(result.syncs).toHaveLength(0);
    });
  });

  describe('generate action (handler)', () => {
    it('generates and stores hook syncs', async () => {
      const schemas: SchemaDef[] = [{
        name: 'Media',
        concept: 'MediaAsset',
        manifest: 'content',
        fields: {},
        hooks: {
          on_save: 'MediaAsset/processIfNeeded',
          on_apply: 'MediaAsset/initializeAsset',
        },
      }];

      const result = await hookSyncGeneratorHandler.generate({ schemas }, storage);
      expect(result.variant).toBe('ok');
      expect(result.id).toBe('hook-syncs-1');
      const syncFiles = result.sync_files as Array<{ name: string; content: string }>;
      expect(syncFiles).toHaveLength(2);
      expect(syncFiles[0].name).toBe('Media_onSave.sync');
      expect(syncFiles[1].name).toBe('Media_onApply.sync');

      // Verify stored
      const stored = await storage.get('generated_hook_syncs', 'hook-syncs-1');
      expect(stored).not.toBeNull();
    });

    it('returns error for non-array schemas', async () => {
      const result = await hookSyncGeneratorHandler.generate({ schemas: 'not-array' }, storage);
      expect(result.variant).toBe('error');
    });

    it('returns error for missing schemas', async () => {
      const result = await hookSyncGeneratorHandler.generate({}, storage);
      expect(result.variant).toBe('error');
    });

    it('returns error for schemas with invalid hooks', async () => {
      const schemas: SchemaDef[] = [{
        name: 'Bad',
        manifest: 'content',
        fields: {},
        hooks: { on_save: 'SomeConcept/doSomething' },
      }];

      const result = await hookSyncGeneratorHandler.generate({ schemas }, storage);
      expect(result.variant).toBe('error');
    });
  });

  describe('generateFromYaml action (handler)', () => {
    it('parses schema.yaml and generates hook syncs in one step', async () => {
      const result = await hookSyncGeneratorHandler.generateFromYaml(
        {
          source: {
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
                },
              },
            },
          },
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      const syncFiles = result.sync_files as Array<{ name: string; content: string }>;
      expect(syncFiles).toHaveLength(3);
      expect(syncFiles.map(f => f.name)).toEqual([
        'Media_onSave.sync',
        'Media_onApply.sync',
        'Media_onRemove.sync',
      ]);
    });

    it('returns error for invalid schema.yaml', async () => {
      const result = await hookSyncGeneratorHandler.generateFromYaml(
        { source: { schemas: { Bad: { fields: { x: { type: 'String' } } } } } },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error for non-object source', async () => {
      const result = await hookSyncGeneratorHandler.generateFromYaml(
        { source: 'not-object' },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  });

  describe('preview action (handler)', () => {
    it('previews hook syncs without storing', async () => {
      const result = await hookSyncGeneratorHandler.preview(
        {
          schema_name: 'DailyNote',
          concept: 'DailyNote',
          hooks: {
            on_save: 'DailyNote/refreshTemplate',
            on_apply: 'DailyNote/initializeForDate',
          },
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      const previews = result.previews as Array<{ name: string; content: string }>;
      expect(previews).toHaveLength(2);
      expect(previews[0].name).toBe('DailyNote_onSave');
      expect(previews[1].name).toBe('DailyNote_onApply');
    });

    it('returns error for missing schema_name', async () => {
      const result = await hookSyncGeneratorHandler.preview(
        { hooks: { on_save: 'X/y' }, concept: 'X' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error for missing hooks', async () => {
      const result = await hookSyncGeneratorHandler.preview(
        { schema_name: 'Test', concept: 'Test' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error for missing concept', async () => {
      const result = await hookSyncGeneratorHandler.preview(
        { schema_name: 'Test', hooks: { on_save: 'X/y' } },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  });

  describe('spec verification: generates hook syncs matching Section 2.1.3 format', () => {
    it('generates media hook syncs matching the spec example exactly', () => {
      // From Section 2.1.3: Media schema with three hooks
      const onSave = generateHookSync('Media', 'on_save', 'MediaAsset/processIfNeeded');
      const onApply = generateHookSync('Media', 'on_apply', 'MediaAsset/initializeAsset');
      const onRemove = generateHookSync('Media', 'on_remove', 'MediaAsset/cleanup');

      // Verify on_save matches spec pattern
      expect('error' in onSave).toBe(false);
      if (!('error' in onSave)) {
        expect(onSave.content).toContain('sync Media_onSave [eventual]');
        expect(onSave.content).toContain('ContentStorage/save: [ id: ?id ] => [ ok: _ ]');
        expect(onSave.content).toContain('filter("Media" in ?schemas)');
        expect(onSave.content).toContain('MediaAsset/processIfNeeded: [ entity_id: ?id ]');
      }

      // Verify on_apply matches spec pattern
      expect('error' in onApply).toBe(false);
      if (!('error' in onApply)) {
        expect(onApply.content).toContain('sync Media_onApply [eager]');
        expect(onApply.content).toContain('Schema/applyTo: [ entity_id: ?id; schema: "Media" ] => [ ok: _ ]');
        expect(onApply.content).toContain('MediaAsset/initializeAsset: [ entity_id: ?id ]');
      }

      // Verify on_remove matches spec pattern
      expect('error' in onRemove).toBe(false);
      if (!('error' in onRemove)) {
        expect(onRemove.content).toContain('sync Media_onRemove [eventual]');
        expect(onRemove.content).toContain('Schema/removeFrom: [ entity_id: ?id; schema: "Media" ] => [ ok: _ ]');
        expect(onRemove.content).toContain('MediaAsset/cleanup: [ entity_id: ?id ]');
      }
    });

    it('generates DailyNote hook syncs from Section 2.4.2', () => {
      const onSave = generateHookSync('DailyNote', 'on_save', 'DailyNote/refreshTemplate');
      const onApply = generateHookSync('DailyNote', 'on_apply', 'DailyNote/initializeForDate');

      expect('error' in onSave).toBe(false);
      expect('error' in onApply).toBe(false);
      if (!('error' in onSave)) {
        expect(onSave.content).toContain('DailyNote/refreshTemplate: [ entity_id: ?id ]');
      }
      if (!('error' in onApply)) {
        expect(onApply.content).toContain('DailyNote/initializeForDate: [ entity_id: ?id ]');
      }
    });

    it('on_save and on_delete use where clause with schema filter', () => {
      const save = generateHookSync('View', 'on_save', 'View/invalidateCache');
      const del = generateHookSync('View', 'on_delete', 'View/cleanupResources');

      for (const result of [save, del]) {
        expect('error' in result).toBe(false);
        if (!('error' in result)) {
          expect(result.content).toContain('where {');
          expect(result.content).toContain('Schema/getSchemasFor');
          expect(result.content).toContain('filter(');
        }
      }
    });

    it('on_apply and on_remove do NOT use where clause', () => {
      const apply = generateHookSync('View', 'on_apply', 'View/initialize');
      const remove = generateHookSync('View', 'on_remove', 'View/cleanup');

      for (const result of [apply, remove]) {
        expect('error' in result).toBe(false);
        if (!('error' in result)) {
          expect(result.content).not.toContain('where {');
          expect(result.content).not.toContain('Schema/getSchemasFor');
        }
      }
    });

    it('on_apply is eager, all others are eventual', () => {
      const save = generateHookSync('X', 'on_save', 'X/a');
      const apply = generateHookSync('X', 'on_apply', 'X/b');
      const remove = generateHookSync('X', 'on_remove', 'X/c');
      const del = generateHookSync('X', 'on_delete', 'X/d');

      if (!('error' in save)) expect(save.content).toContain('[eventual]');
      if (!('error' in apply)) expect(apply.content).toContain('[eager]');
      if (!('error' in remove)) expect(remove.content).toContain('[eventual]');
      if (!('error' in del)) expect(del.content).toContain('[eventual]');
    });
  });
});
