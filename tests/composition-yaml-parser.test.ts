import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  compositionYamlParserHandler,
  parseCompositionYaml,
  generateCompositionSync,
  resetCompositionYamlParserCounter,
} from '../handlers/ts/framework/composition-yaml-parser.handler.js';
import type { CompositionRule } from '../handlers/ts/framework/composition-yaml-parser.handler.js';

describe('CompositionYamlParser', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetCompositionYamlParserCounter();
  });

  describe('parseCompositionYaml (pure function)', () => {
    it('parses a valid composition with one rule', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable'], default: true },
        ],
      });

      expect(result.errors).toHaveLength(0);
      expect(result.compositions).toHaveLength(1);
      expect(result.compositions[0].when).toBe('Article');
      expect(result.compositions[0].apply).toEqual(['Commentable']);
      expect(result.compositions[0].default).toBe(true);
    });

    it('parses a composition with multiple apply targets', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable', 'HasTags', 'SEO'], default: true },
        ],
      });

      expect(result.errors).toHaveLength(0);
      expect(result.compositions[0].apply).toEqual(['Commentable', 'HasTags', 'SEO']);
    });

    it('parses a composition with optional condition', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['SEO'], default: false, condition: 'entity.published == true' },
        ],
      });

      expect(result.errors).toHaveLength(0);
      expect(result.compositions[0].condition).toBe('entity.published == true');
      expect(result.compositions[0].default).toBe(false);
    });

    it('parses multiple composition rules', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable'], default: true },
          { when: 'Article', apply: ['HasTags'], default: true },
          { when: 'Media', apply: ['HasTags'], default: false },
        ],
      });

      expect(result.errors).toHaveLength(0);
      expect(result.compositions).toHaveLength(3);
    });

    // Error cases

    it('rejects non-object input', () => {
      const result = parseCompositionYaml(null as unknown as Record<string, unknown>);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('YAML object');
    });

    it('rejects missing compositions key', () => {
      const result = parseCompositionYaml({});
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('compositions');
    });

    it('rejects non-array compositions', () => {
      const result = parseCompositionYaml({ compositions: 'not-an-array' });
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('compositions');
    });

    it('rejects rule without when field', () => {
      const result = parseCompositionYaml({
        compositions: [
          { apply: ['Commentable'], default: true },
        ],
      });
      expect(result.errors.some(e => e.message.includes('"when"'))).toBe(true);
    });

    it('rejects rule without apply field', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', default: true },
        ],
      });
      expect(result.errors.some(e => e.message.includes('"apply"'))).toBe(true);
    });

    it('rejects rule with empty apply array', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: [], default: true },
        ],
      });
      expect(result.errors.some(e => e.message.includes('"apply"'))).toBe(true);
    });

    it('rejects rule without default field', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable'] },
        ],
      });
      expect(result.errors.some(e => e.message.includes('"default"'))).toBe(true);
    });

    it('rejects non-boolean default', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable'], default: 'yes' },
        ],
      });
      expect(result.errors.some(e => e.message.includes('"default"'))).toBe(true);
    });

    it('rejects non-string apply entries', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: [42], default: true },
        ],
      });
      expect(result.errors.some(e => e.message.includes('apply[0]'))).toBe(true);
    });

    it('rejects non-object rule', () => {
      const result = parseCompositionYaml({
        compositions: ['not-an-object'],
      });
      expect(result.errors.some(e => e.message.includes('must be an object'))).toBe(true);
    });

    it('detects self-application', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Article'], default: true },
        ],
      });
      expect(result.errors.some(e => e.message.includes('cannot auto-apply itself'))).toBe(true);
    });

    it('detects circular compositions', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable'], default: true },
          { when: 'Commentable', apply: ['Article'], default: true },
        ],
      });
      expect(result.errors.some(e => e.message.includes('Circular composition'))).toBe(true);
    });

    it('allows non-circular multi-rule compositions', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable'], default: true },
          { when: 'Article', apply: ['HasTags'], default: true },
          { when: 'Media', apply: ['HasTags'], default: false },
        ],
      });
      // No circular errors expected
      expect(result.errors.filter(e => e.message.includes('Circular'))).toHaveLength(0);
    });
  });

  describe('generateCompositionSync', () => {
    it('generates sync content for a single-target rule', () => {
      const rule: CompositionRule = {
        when: 'Article',
        apply: ['Commentable'],
        default: true,
      };

      const content = generateCompositionSync(rule);
      expect(content).toContain('sync Composition_Article_Commentable [eager]');
      expect(content).toContain('schema: "Article"');
      expect(content).toContain('schema: "Commentable"');
      expect(content).toContain('when {');
      expect(content).toContain('then {');
    });

    it('generates sync content for a multi-target rule', () => {
      const rule: CompositionRule = {
        when: 'Article',
        apply: ['Commentable', 'SEO'],
        default: true,
      };

      const content = generateCompositionSync(rule);
      expect(content).toContain('Composition_Article_Commentable');
      expect(content).toContain('Composition_Article_SEO');
    });

    it('uses entity_id binding across when and then', () => {
      const rule: CompositionRule = {
        when: 'Media',
        apply: ['HasTags'],
        default: true,
      };

      const content = generateCompositionSync(rule);
      // Both when and then should reference the same ?id binding
      const lines = content.split('\n');
      const whenLine = lines.find(l => l.includes('Schema/applyTo') && l.includes('Media'));
      const thenLine = lines.find(l => l.includes('Schema/applyTo') && l.includes('HasTags'));
      expect(whenLine).toContain('entity_id: ?id');
      expect(thenLine).toContain('entity_id: ?id');
    });
  });

  describe('parse action (handler)', () => {
    it('parses valid composition.yaml and stores result', async () => {
      const result = await compositionYamlParserHandler.parse(
        {
          source: {
            compositions: [
              { when: 'Article', apply: ['Commentable'], default: true },
            ],
          },
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.id).toBe('composition-yaml-1');
      expect((result.compositions as unknown[]).length).toBe(1);

      // Verify stored
      const stored = await storage.get('parsed_compositions', 'composition-yaml-1');
      expect(stored).not.toBeNull();
    });

    it('increments counter for multiple parses', async () => {
      await compositionYamlParserHandler.parse(
        { source: { compositions: [{ when: 'A', apply: ['B'], default: true }] } },
        storage,
      );
      const result = await compositionYamlParserHandler.parse(
        { source: { compositions: [{ when: 'C', apply: ['D'], default: false }] } },
        storage,
      );

      expect(result.id).toBe('composition-yaml-2');
    });

    it('returns error for non-object source', async () => {
      const result = await compositionYamlParserHandler.parse(
        { source: 'not an object' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error for missing source', async () => {
      const result = await compositionYamlParserHandler.parse({}, storage);
      expect(result.variant).toBe('error');
    });

    it('returns error for composition with validation errors', async () => {
      const result = await compositionYamlParserHandler.parse(
        {
          source: {
            compositions: [
              { when: 'Article' }, // missing apply and default
            ],
          },
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect((result.errors as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe('validate action', () => {
    it('returns ok for valid composition', async () => {
      const result = await compositionYamlParserHandler.validate(
        {
          source: {
            compositions: [
              { when: 'Article', apply: ['Commentable'], default: true },
              { when: 'Media', apply: ['HasTags'], default: false },
            ],
          },
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.rule_count).toBe(2);
    });

    it('returns invalid for broken composition', async () => {
      const result = await compositionYamlParserHandler.validate(
        {
          source: {
            compositions: [
              { when: 'Article', apply: ['Article'], default: true }, // self-application
            ],
          },
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });

    it('returns error for non-object source', async () => {
      const result = await compositionYamlParserHandler.validate(
        { source: 42 },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  });

  describe('generateSyncs action', () => {
    it('generates sync files for default rules only', async () => {
      const result = await compositionYamlParserHandler.generateSyncs(
        {
          source: {
            compositions: [
              { when: 'Article', apply: ['Commentable', 'SEO'], default: true },
              { when: 'Media', apply: ['HasTags'], default: false },
            ],
          },
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      const syncFiles = result.sync_files as Array<{ name: string; content: string }>;
      // Only the default:true rule generates syncs, 2 targets = 2 files
      expect(syncFiles).toHaveLength(2);
      expect(syncFiles[0].name).toBe('Composition_Article_Commentable.sync');
      expect(syncFiles[1].name).toBe('Composition_Article_SEO.sync');
    });

    it('returns error for invalid composition', async () => {
      const result = await compositionYamlParserHandler.generateSyncs(
        {
          source: {
            compositions: [
              { when: 'Article' }, // invalid
            ],
          },
        },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error for non-object source', async () => {
      const result = await compositionYamlParserHandler.generateSyncs(
        { source: null },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('generates no files when no rules are default', async () => {
      const result = await compositionYamlParserHandler.generateSyncs(
        {
          source: {
            compositions: [
              { when: 'Article', apply: ['Commentable'], default: false },
            ],
          },
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect((result.sync_files as unknown[]).length).toBe(0);
    });
  });

  describe('spec verification: parses real clef-base composition.yaml formats', () => {
    it('parses comment composition format from Section 2.4.3', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['Commentable'], default: true },
          { when: 'Media', apply: ['Commentable'], default: false, condition: 'entity.comments_enabled' },
        ],
      });

      expect(result.errors).toHaveLength(0);
      expect(result.compositions).toHaveLength(2);
      expect(result.compositions[0].default).toBe(true);
      expect(result.compositions[1].default).toBe(false);
      expect(result.compositions[1].condition).toBe('entity.comments_enabled');
    });

    it('parses tag composition format from Section 2.4.3', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['HasTags'], default: true },
          { when: 'Media', apply: ['HasTags'], default: true },
          { when: 'Event', apply: ['HasTags'], default: true },
        ],
      });

      expect(result.errors).toHaveLength(0);
      expect(result.compositions).toHaveLength(3);
      expect(result.compositions.every(c => c.default === true)).toBe(true);
    });

    it('parses SEO + social mixin composition', () => {
      const result = parseCompositionYaml({
        compositions: [
          { when: 'Article', apply: ['SEO', 'Commentable', 'HasTags'], default: true },
        ],
      });

      expect(result.errors).toHaveLength(0);
      expect(result.compositions[0].apply).toEqual(['SEO', 'Commentable', 'HasTags']);
    });
  });
});
