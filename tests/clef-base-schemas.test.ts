/**
 * Clef Base schema definitions verification tests.
 * Verifies schema.yaml and composition.yaml files match spec §2.1.1, §2.4.3.
 * Tests schema structure, field mappings, hooks, and compositions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

const SCHEMAS_DIR = path.resolve('clef-base/schemas');

function readSchema(name: string): any {
  return parseYaml(fs.readFileSync(path.join(SCHEMAS_DIR, name), 'utf-8'));
}

describe('Clef Base schema definitions (§2.1.1)', () => {

  describe('Schema file inventory', () => {
    it('has content.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'content.schema.yaml'))).toBe(true);
    });

    it('has media.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'media.schema.yaml'))).toBe(true);
    });

    it('has taxonomy.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'taxonomy.schema.yaml'))).toBe(true);
    });

    it('has daily-note.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'daily-note.schema.yaml'))).toBe(true);
    });

    it('has canvas.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'canvas.schema.yaml'))).toBe(true);
    });

    it('has workflow.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'workflow.schema.yaml'))).toBe(true);
    });

    it('has view.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'view.schema.yaml'))).toBe(true);
    });

    it('has automation.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'automation.schema.yaml'))).toBe(true);
    });

    it('has mixins.schema.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'mixins.schema.yaml'))).toBe(true);
    });
  });

  describe('Content schema (content.schema.yaml)', () => {
    let schema: any;
    beforeAll(() => { schema = readSchema('content.schema.yaml'); });

    it('defines Article schema with content manifest', () => {
      expect(schema.schemas.Article).toBeDefined();
      expect(schema.schemas.Article.manifest).toBe('content');
    });

    it('Article has required fields: title, body', () => {
      expect(schema.schemas.Article.fields.title).toBeDefined();
      expect(schema.schemas.Article.fields.body).toBeDefined();
    });

    it('defines Page schema with content manifest', () => {
      expect(schema.schemas.Page).toBeDefined();
      expect(schema.schemas.Page.manifest).toBe('content');
    });

    it('defines Role schema with config manifest', () => {
      expect(schema.schemas.Role).toBeDefined();
      expect(schema.schemas.Role.manifest).toBe('config');
    });
  });

  describe('Media schema (media.schema.yaml)', () => {
    let schema: any;
    beforeAll(() => { schema = readSchema('media.schema.yaml'); });

    it('defines Media schema mapped to MediaAsset concept', () => {
      expect(schema.schemas.Media).toBeDefined();
      expect(schema.schemas.Media.concept).toBe('MediaAsset');
    });

    it('Media schema declares primary_set and manifest per §2.1.1', () => {
      expect(schema.schemas.Media.primary_set).toBe('assets');
      expect(schema.schemas.Media.manifest).toBe('content');
    });

    it('Media schema has hooks per §2.1.3', () => {
      expect(schema.schemas.Media.hooks).toBeDefined();
      expect(schema.schemas.Media.hooks.on_apply).toBe('MediaAsset/initializeAsset');
      expect(schema.schemas.Media.hooks.on_save).toBe('MediaAsset/processIfNeeded');
    });

    it('Media schema maps fields with from: declarations', () => {
      expect(schema.schemas.Media.fields.file_reference.from).toBe('file_reference');
      expect(schema.schemas.Media.fields.mime_type.from).toBe('mime_type');
      expect(schema.schemas.Media.fields.alt_text.from).toBe('alt_text');
    });

    it('defines File schema mapped to FileManagement concept', () => {
      expect(schema.schemas.File).toBeDefined();
      expect(schema.schemas.File.concept).toBe('FileManagement');
      expect(schema.schemas.File.primary_set).toBe('files');
    });

    it('defines Image schema with includes: [Media]', () => {
      expect(schema.schemas.Image).toBeDefined();
      expect(schema.schemas.Image.includes).toContain('Media');
    });
  });

  describe('Composition files (§2.4.3)', () => {
    it('has comment.composition.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'comment.composition.yaml'))).toBe(true);
    });

    it('has taxonomy.composition.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'taxonomy.composition.yaml'))).toBe(true);
    });

    it('has media.composition.yaml', () => {
      expect(fs.existsSync(path.join(SCHEMAS_DIR, 'media.composition.yaml'))).toBe(true);
    });
  });

  describe('Layout composition files (§5.10.4)', () => {
    const LAYOUTS_DIR = path.resolve('clef-base/layouts');

    it('has merge-resolution-panel.uischema', () => {
      expect(fs.existsSync(path.join(LAYOUTS_DIR, 'merge-resolution-panel.uischema'))).toBe(true);
    });

    it('has version-comparison-panel.uischema', () => {
      expect(fs.existsSync(path.join(LAYOUTS_DIR, 'version-comparison-panel.uischema'))).toBe(true);
    });

    it('merge-resolution-panel uses diff-view interactor', () => {
      const content = fs.readFileSync(path.join(LAYOUTS_DIR, 'merge-resolution-panel.uischema'), 'utf-8');
      expect(content).toContain('interactor: diff-view');
      expect(content).toContain('interactor: single-choice');
      expect(content).toContain('interactor: action-primary');
      expect(content).toContain('interactor: action-secondary');
    });

    it('merge-resolution-panel has three-way diff with strategy picker', () => {
      const content = fs.readFileSync(path.join(LAYOUTS_DIR, 'merge-resolution-panel.uischema'), 'utf-8');
      expect(content).toContain('wayCount: 3');
      expect(content).toContain('source_wins');
      expect(content).toContain('three_way_merge');
      expect(content).toContain('llm_merge');
    });

    it('version-comparison-panel has side-by-side entity views', () => {
      const content = fs.readFileSync(path.join(LAYOUTS_DIR, 'version-comparison-panel.uischema'), 'utf-8');
      expect(content).toContain('source-entity');
      expect(content).toContain('target-entity');
      expect(content).toContain('source_version_context');
      expect(content).toContain('target_version_context');
    });

    it('version-comparison-panel has swap button', () => {
      const content = fs.readFileSync(path.join(LAYOUTS_DIR, 'version-comparison-panel.uischema'), 'utf-8');
      expect(content).toContain('swap-button');
      expect(content).toContain('swap-horizontal');
    });
  });
});
