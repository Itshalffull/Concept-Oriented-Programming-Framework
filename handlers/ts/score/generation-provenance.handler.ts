// @migrated dsl-constructs 2026-03-18
// GenerationProvenance Concept Implementation
//
// Tracks which generator produced which file, from what source spec,
// with what configuration. Enables provenance queries, staleness
// detection, and impact analysis for generator changes.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  record(input: Record<string, unknown>) {
    const outputFile = input.outputFile as string;
    const generator = input.generator as string;
    const sourceSpec = input.sourceSpec as string;
    const sourceSpecKind = input.sourceSpecKind as string;
    const config = input.config as string;

    const key = `provenance:${outputFile}`;
    const existing = await storage.get('generation-provenance', key);

    const id = existing ? (existing.id as string) : crypto.randomUUID();
    const now = new Date().toISOString();

    await storage.put('generation-provenance', key, {
      id,
      outputFile,
      generator,
      sourceSpec,
      sourceSpecKind,
      generatorConfig: config || '{}',
      generatedAt: now,
      contentHash: '',
      isStale: 'false',
    });

    if (existing) {
      return { variant: 'updated', existing: id };
    }

    return { variant: 'ok', provenance: id };
  },

  getByFile(input: Record<string, unknown>) {
    const outputFile = input.outputFile as string;

    const entry = await storage.get('generation-provenance', `provenance:${outputFile}`);
    if (!entry) {
      return { variant: 'notGenerated' };
    }

    return { variant: 'ok', provenance: entry.id };
  },

  findByGenerator(input: Record<string, unknown>) {
    const generator = input.generator as string;
    const all = await storage.find('generation-provenance', { generator });

    const files = all.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
      generatedAt: p.generatedAt,
    }));

    return { variant: 'ok', files: JSON.stringify(files) };
  },

  findBySource(input: Record<string, unknown>) {
    const sourceSpec = input.sourceSpec as string;
    const all = await storage.find('generation-provenance', { sourceSpec });

    const files = all.map(p => ({
      outputFile: p.outputFile,
      generator: p.generator,
      generatedAt: p.generatedAt,
    }));

    return { variant: 'ok', files: JSON.stringify(files) };
  },

  generationChain(input: Record<string, unknown>) {
    const outputFile = input.outputFile as string;

    const entry = await storage.get('generation-provenance', `provenance:${outputFile}`);
    if (!entry) {
      return { variant: 'notGenerated' };
    }

    // Walk backwards through the chain: output -> source -> source's source...
    const chain: Array<{ step: number; input: string; generator: string; output: string }> = [];
    let current = entry;
    let step = 0;

    while (current) {
      chain.unshift({
        step,
        input: current.sourceSpec as string,
        generator: current.generator as string,
        output: current.outputFile as string,
      });
      step++;

      // Check if the source spec is itself a generated file
      const parentEntry = await storage.get(
        'generation-provenance',
        `provenance:${current.sourceSpec}`
      );
      if (!parentEntry || parentEntry.outputFile === current.outputFile) break;
      current = parentEntry;
    }

    // Re-number steps from source to output
    chain.forEach((c, i) => { c.step = i; });

    return { variant: 'ok', chain: JSON.stringify(chain) };
  },

  staleFiles(_input: Record<string, unknown>) {
    const all = await storage.find('generation-provenance');

    const stale = all.filter(p => p.isStale === 'true');

    if (stale.length === 0) {
      return { variant: 'allFresh' };
    }

    const files = stale.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
      generator: p.generator,
      generatedAt: p.generatedAt,
      sourceModified: '',
    }));

    return { variant: 'ok', files: JSON.stringify(files) };
  },

  impactOfGeneratorChange(input: Record<string, unknown>) {
    const generator = input.generator as string;
    const all = await storage.find('generation-provenance', { generator });

    const affected = all.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
    }));

    return { variant: 'ok', affected: JSON.stringify(affected) };
  },

  isGenerated(input: Record<string, unknown>) {
    const file = input.file as string;

    const entry = await storage.get('generation-provenance', `provenance:${file}`);
    if (!entry) {
      return { variant: 'handWritten' };
    }

    return {
      variant: 'generated',
      generator: entry.generator as string,
      sourceSpec: entry.sourceSpec as string,
    };
  },
};

export const generationProvenanceHandler = autoInterpret(_handler);
