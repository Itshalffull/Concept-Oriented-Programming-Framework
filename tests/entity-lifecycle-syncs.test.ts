/**
 * Entity-lifecycle syncs verification tests.
 * Verifies all 7 entity-lifecycle syncs match the Clef Base spec §2.1.2.
 * Tests sync file structure, trigger patterns, where clauses, and then effects.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

const LIFECYCLE_SUITE_DIR = path.resolve('clef-base/suites/entity-lifecycle');
const SYNCS_DIR = path.join(LIFECYCLE_SUITE_DIR, 'syncs');

// Helper to read a sync file
function readSync(name: string): string {
  return fs.readFileSync(path.join(SYNCS_DIR, name), 'utf-8');
}

// Helper to read suite.yaml
function readSuiteYaml(): any {
  return parseYaml(fs.readFileSync(path.join(LIFECYCLE_SUITE_DIR, 'suite.yaml'), 'utf-8'));
}

describe('Entity-lifecycle syncs suite (§2.1.2)', () => {

  describe('Suite manifest', () => {
    let suite: any;
    beforeAll(() => { suite = readSuiteYaml(); });

    it('has zero concepts (syncs-only suite)', () => {
      expect(suite.concepts).toEqual({});
    });

    it('declares name "entity-lifecycle"', () => {
      expect(suite.suite.name).toBe('entity-lifecycle');
    });

    it('lists exactly 7 recommended syncs', () => {
      expect(suite.syncs.recommended).toHaveLength(7);
    });

    it('uses ContentStorage from foundation suite', () => {
      const foundationUse = suite.uses.find((u: any) => u.suite === 'foundation');
      expect(foundationUse).toBeDefined();
      expect(foundationUse.concepts.some((c: any) => c.name === 'ContentStorage')).toBe(true);
    });

    it('uses Schema from classification suite', () => {
      const classificationUse = suite.uses.find((u: any) => u.suite === 'classification');
      expect(classificationUse).toBeDefined();
      expect(classificationUse.concepts.some((c: any) => c.name === 'Schema')).toBe(true);
    });
  });

  describe('SaveInvalidatesCache sync', () => {
    let content: string;
    beforeAll(() => { content = readSync('save-invalidates-cache.sync'); });

    it('is eventual mode per spec', () => {
      expect(content).toContain('SaveInvalidatesCache [eventual]');
    });

    it('triggers on ContentStorage/save', () => {
      expect(content).toContain('ContentStorage/save');
    });

    it('queries Schema/getSchemasFor in where clause', () => {
      expect(content).toContain('Schema/getSchemasFor');
    });

    it('calls Cache/invalidateByTags with schemas', () => {
      expect(content).toContain('Cache/invalidateByTags');
      expect(content).toContain('?schemas');
    });
  });

  describe('SaveIndexesSearch sync', () => {
    let content: string;
    beforeAll(() => { content = readSync('save-indexes-search.sync'); });

    it('is eventual mode per spec', () => {
      expect(content).toContain('SaveIndexesSearch [eventual]');
    });

    it('triggers on ContentStorage/save', () => {
      expect(content).toContain('ContentStorage/save');
    });

    it('queries Schema/getSchemasFor in where clause', () => {
      expect(content).toContain('Schema/getSchemasFor');
    });

    it('enqueues to search_indexing queue with schema context', () => {
      expect(content).toContain('Queue/enqueue');
      expect(content).toContain('search_indexing');
      expect(content).toContain('?schemas');
    });
  });

  describe('SaveGeneratesAlias sync', () => {
    let content: string;
    beforeAll(() => { content = readSync('save-generates-alias.sync'); });

    it('is eventual mode per spec', () => {
      expect(content).toContain('SaveGeneratesAlias [eventual]');
    });

    it('triggers on ContentStorage/save', () => {
      expect(content).toContain('ContentStorage/save');
    });

    it('queries Schema/getSchemasFor', () => {
      expect(content).toContain('Schema/getSchemasFor');
    });

    it('filters by Pathauto pattern per schema', () => {
      expect(content).toContain('Pathauto:');
      expect(content).toContain('filter(?schema in ?schemas)');
    });

    it('calls Pathauto/generateAlias with schema and entity_id', () => {
      expect(content).toContain('Pathauto/generateAlias');
      expect(content).toContain('?schema');
      expect(content).toContain('?id');
    });
  });

  describe('SaveTracksProvenance sync', () => {
    let content: string;
    beforeAll(() => { content = readSync('save-tracks-provenance.sync'); });

    it('is eventual mode per spec', () => {
      expect(content).toContain('SaveTracksProvenance [eventual]');
    });

    it('triggers on ContentStorage/save', () => {
      expect(content).toContain('ContentStorage/save');
    });

    it('queries Schema/getSchemasFor in where clause', () => {
      expect(content).toContain('Schema/getSchemasFor');
    });

    it('calls Provenance/record with schemas and activity', () => {
      expect(content).toContain('Provenance/record');
      expect(content).toContain('?schemas');
      expect(content).toContain('"save"');
    });
  });

  describe('SaveReindexesBacklinks sync', () => {
    let content: string;
    beforeAll(() => { content = readSync('save-reindexes-backlinks.sync'); });

    it('is eventual mode per spec', () => {
      expect(content).toContain('SaveReindexesBacklinks [eventual]');
    });

    it('triggers on ContentStorage/save', () => {
      expect(content).toContain('ContentStorage/save');
    });

    it('calls Backlink/reindex with source_id', () => {
      expect(content).toContain('Backlink/reindex');
      expect(content).toContain('source_id: ?id');
    });
  });

  describe('DeleteCascades sync', () => {
    let content: string;
    beforeAll(() => { content = readSync('delete-cascades.sync'); });

    it('is eager mode per spec (cascade must complete before delete returns)', () => {
      expect(content).toContain('DeleteCascades [eager]');
    });

    it('triggers on ContentStorage/delete', () => {
      expect(content).toContain('ContentStorage/delete');
    });

    it('queries Schema/getSchemasFor for cache invalidation', () => {
      expect(content).toContain('Schema/getSchemasFor');
    });

    it('cascades to all 7 cleanup targets per spec', () => {
      expect(content).toContain('Comment/deleteByHost');
      expect(content).toContain('Reference/removeAllByTarget');
      expect(content).toContain('FileManagement/removeUsage');
      expect(content).toContain('Backlink/removeAllRefs');
      expect(content).toContain('Pathauto/deleteAlias');
      expect(content).toContain('Cache/invalidateByTags');
      expect(content).toContain('SearchIndex/remove');
    });
  });

  describe('DateFieldsReferenceDailyNotes sync', () => {
    let content: string;
    beforeAll(() => { content = readSync('date-fields-reference-daily-notes.sync'); });

    it('is eventual mode per spec', () => {
      expect(content).toContain('DateFieldsReferenceDailyNotes [eventual]');
    });

    it('triggers on ContentStorage/save', () => {
      expect(content).toContain('ContentStorage/save');
    });

    it('queries Property for DateTime fields in where clause', () => {
      expect(content).toContain('Property:');
      expect(content).toContain('field_type: "DateTime"');
      expect(content).toContain('field_name: ?field_name');
      expect(content).toContain('value: ?date_value');
    });

    it('calls DailyNote/getOrCreateForDate', () => {
      expect(content).toContain('DailyNote/getOrCreateForDate');
    });

    it('creates Reference/addRef with field name as label', () => {
      expect(content).toContain('Reference/addRef');
      expect(content).toContain('label: ?field_name');
    });
  });

  describe('Sync count verification', () => {
    it('has exactly 7 sync files in the syncs directory', () => {
      const files = fs.readdirSync(SYNCS_DIR).filter(f => f.endsWith('.sync'));
      expect(files).toHaveLength(7);
    });

    it('6 syncs fire on save, 1 on delete', () => {
      const files = fs.readdirSync(SYNCS_DIR).filter(f => f.endsWith('.sync'));
      let saveCount = 0;
      let deleteCount = 0;
      for (const f of files) {
        const content = fs.readFileSync(path.join(SYNCS_DIR, f), 'utf-8');
        if (content.includes('ContentStorage/save')) saveCount++;
        if (content.includes('ContentStorage/delete')) deleteCount++;
      }
      expect(saveCount).toBe(6);
      expect(deleteCount).toBe(1);
    });

    it('only DeleteCascades is eager, all others are eventual', () => {
      const files = fs.readdirSync(SYNCS_DIR).filter(f => f.endsWith('.sync'));
      for (const f of files) {
        const content = fs.readFileSync(path.join(SYNCS_DIR, f), 'utf-8');
        if (f === 'delete-cascades.sync') {
          expect(content).toContain('[eager]');
        } else {
          expect(content).toContain('[eventual]');
        }
      }
    });
  });
});
