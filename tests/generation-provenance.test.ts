// ============================================================
// GenerationProvenance Handler Tests
//
// Tests for provenance recording, file lookup, generator/source
// queries, generation chain traversal, staleness detection,
// generator impact analysis, and generated vs hand-written
// classification.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { generationProvenanceHandler } from '../handlers/ts/score/generation-provenance.handler.js';

describe('GenerationProvenance Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('record', () => {
    it('records new provenance', async () => {
      const result = await generationProvenanceHandler.record(
        {
          outputFile: 'handlers/ts/todo.handler.ts',
          generator: 'HandlerScaffoldGen',
          sourceSpec: 'specs/app/todo.concept',
          sourceSpecKind: 'concept',
          config: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.provenance).toBeDefined();
    });

    it('returns updated for existing file provenance', async () => {
      await generationProvenanceHandler.record(
        {
          outputFile: 'handlers/ts/todo.handler.ts',
          generator: 'HandlerScaffoldGen',
          sourceSpec: 'specs/app/todo.concept',
          sourceSpecKind: 'concept',
          config: '{}',
        },
        storage,
      );
      const result = await generationProvenanceHandler.record(
        {
          outputFile: 'handlers/ts/todo.handler.ts',
          generator: 'HandlerScaffoldGen',
          sourceSpec: 'specs/app/todo.concept',
          sourceSpecKind: 'concept',
          config: '{"updated": true}',
        },
        storage,
      );
      expect(result.variant).toBe('updated');
    });
  });

  describe('getByFile', () => {
    it('retrieves provenance for a generated file', async () => {
      const reg = await generationProvenanceHandler.record(
        {
          outputFile: 'handlers/ts/todo.handler.ts',
          generator: 'HandlerScaffoldGen',
          sourceSpec: 'specs/app/todo.concept',
          sourceSpecKind: 'concept',
          config: '{}',
        },
        storage,
      );
      const result = await generationProvenanceHandler.getByFile(
        { outputFile: 'handlers/ts/todo.handler.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.provenance).toBeDefined();
    });

    it('returns notGenerated for unknown file', async () => {
      const result = await generationProvenanceHandler.getByFile(
        { outputFile: 'unknown.ts' },
        storage,
      );
      expect(result.variant).toBe('notGenerated');
    });
  });

  describe('findByGenerator', () => {
    it('returns all files from a generator', async () => {
      await generationProvenanceHandler.record(
        { outputFile: 'a.ts', generator: 'HandlerScaffoldGen', sourceSpec: 'a.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      await generationProvenanceHandler.record(
        { outputFile: 'b.ts', generator: 'HandlerScaffoldGen', sourceSpec: 'b.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      await generationProvenanceHandler.record(
        { outputFile: 'c.css', generator: 'ThemeGen', sourceSpec: 'c.theme', sourceSpecKind: 'theme', config: '{}' },
        storage,
      );
      const result = await generationProvenanceHandler.findByGenerator(
        { generator: 'HandlerScaffoldGen' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const files = JSON.parse(result.files as string);
      expect(files).toHaveLength(2);
    });
  });

  describe('findBySource', () => {
    it('returns all files generated from a source spec', async () => {
      await generationProvenanceHandler.record(
        { outputFile: 'handler.ts', generator: 'HandlerGen', sourceSpec: 'todo.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      await generationProvenanceHandler.record(
        { outputFile: 'test.ts', generator: 'TestGen', sourceSpec: 'todo.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      const result = await generationProvenanceHandler.findBySource(
        { sourceSpec: 'todo.concept' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const files = JSON.parse(result.files as string);
      expect(files).toHaveLength(2);
    });
  });

  describe('generationChain', () => {
    it('traces single-step chain', async () => {
      await generationProvenanceHandler.record(
        { outputFile: 'handler.ts', generator: 'HandlerGen', sourceSpec: 'todo.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      const result = await generationProvenanceHandler.generationChain(
        { outputFile: 'handler.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const chain = JSON.parse(result.chain as string);
      expect(chain).toHaveLength(1);
      expect(chain[0].input).toBe('todo.concept');
      expect(chain[0].output).toBe('handler.ts');
    });

    it('traces multi-step chain', async () => {
      // spec -> intermediate -> final
      await generationProvenanceHandler.record(
        { outputFile: 'intermediate.ts', generator: 'GenA', sourceSpec: 'spec.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      await generationProvenanceHandler.record(
        { outputFile: 'final.ts', generator: 'GenB', sourceSpec: 'intermediate.ts', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      const result = await generationProvenanceHandler.generationChain(
        { outputFile: 'final.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const chain = JSON.parse(result.chain as string);
      expect(chain).toHaveLength(2);
      expect(chain[0].input).toBe('spec.concept');
      expect(chain[1].input).toBe('intermediate.ts');
    });

    it('returns notGenerated for unknown file', async () => {
      const result = await generationProvenanceHandler.generationChain(
        { outputFile: 'unknown.ts' },
        storage,
      );
      expect(result.variant).toBe('notGenerated');
    });
  });

  describe('staleFiles', () => {
    it('returns allFresh when no files are stale', async () => {
      await generationProvenanceHandler.record(
        { outputFile: 'a.ts', generator: 'Gen', sourceSpec: 'a.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      const result = await generationProvenanceHandler.staleFiles({}, storage);
      expect(result.variant).toBe('allFresh');
    });

    it('returns stale files when marked', async () => {
      await generationProvenanceHandler.record(
        { outputFile: 'a.ts', generator: 'Gen', sourceSpec: 'a.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      // Manually mark as stale
      const entry = await storage.get('generation-provenance', 'provenance:a.ts');
      await storage.put('generation-provenance', 'provenance:a.ts', { ...entry!, isStale: 'true' });

      const result = await generationProvenanceHandler.staleFiles({}, storage);
      expect(result.variant).toBe('ok');
      const files = JSON.parse(result.files as string);
      expect(files).toHaveLength(1);
    });
  });

  describe('impactOfGeneratorChange', () => {
    it('returns all files affected by a generator change', async () => {
      await generationProvenanceHandler.record(
        { outputFile: 'a.ts', generator: 'HandlerGen', sourceSpec: 'a.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      await generationProvenanceHandler.record(
        { outputFile: 'b.ts', generator: 'HandlerGen', sourceSpec: 'b.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      const result = await generationProvenanceHandler.impactOfGeneratorChange(
        { generator: 'HandlerGen' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const affected = JSON.parse(result.affected as string);
      expect(affected).toHaveLength(2);
    });
  });

  describe('isGenerated', () => {
    it('identifies a generated file', async () => {
      await generationProvenanceHandler.record(
        { outputFile: 'handler.ts', generator: 'HandlerGen', sourceSpec: 'todo.concept', sourceSpecKind: 'concept', config: '{}' },
        storage,
      );
      const result = await generationProvenanceHandler.isGenerated(
        { file: 'handler.ts' },
        storage,
      );
      expect(result.variant).toBe('generated');
      expect(result.generator).toBe('HandlerGen');
      expect(result.sourceSpec).toBe('todo.concept');
    });

    it('identifies a hand-written file', async () => {
      const result = await generationProvenanceHandler.isGenerated(
        { file: 'manual.ts' },
        storage,
      );
      expect(result.variant).toBe('handWritten');
    });
  });
});
