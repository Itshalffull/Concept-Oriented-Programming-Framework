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
    let p = createProgram();
    const outputFile = input.outputFile as string;
    const generator = input.generator as string;
    const sourceSpec = input.sourceSpec as string;
    const sourceSpecKind = input.sourceSpecKind as string;
    const config = input.config as string;

    const key = `provenance:${outputFile}`;
    p = get(p, 'generation-provenance', key, 'existing');

    const id = existing ? (existing.id as string) : crypto.randomUUID();
    const now = new Date().toISOString();

    p = put(p, 'generation-provenance', key, {
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
      return complete(p, 'updated', { existing: id }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { provenance: id }) as StorageProgram<Result>;
  },

  getByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const outputFile = input.outputFile as string;

    p = get(p, 'generation-provenance', `provenance:${outputFile}`, 'entry');
    if (!entry) {
      return complete(p, 'notGenerated', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { provenance: entry.id }) as StorageProgram<Result>;
  },

  findByGenerator(input: Record<string, unknown>) {
    let p = createProgram();
    const generator = input.generator as string;
    p = find(p, 'generation-provenance', { generator }, 'all');

    const files = all.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
      generatedAt: p.generatedAt,
    }));

    return complete(p, 'ok', { files: JSON.stringify(files) }) as StorageProgram<Result>;
  },

  findBySource(input: Record<string, unknown>) {
    let p = createProgram();
    const sourceSpec = input.sourceSpec as string;
    p = find(p, 'generation-provenance', { sourceSpec }, 'all');

    const files = all.map(p => ({
      outputFile: p.outputFile,
      generator: p.generator,
      generatedAt: p.generatedAt,
    }));

    return complete(p, 'ok', { files: JSON.stringify(files) }) as StorageProgram<Result>;
  },

  generationChain(input: Record<string, unknown>) {
    let p = createProgram();
    const outputFile = input.outputFile as string;

    p = get(p, 'generation-provenance', `provenance:${outputFile}`, 'entry');
    if (!entry) {
      return complete(p, 'notGenerated', {}) as StorageProgram<Result>;
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
      p = get(p, 
        'generation-provenance',
        `provenance:${current.sourceSpec}`
      , 'parentEntry');
      if (!parentEntry || parentEntry.outputFile === current.outputFile) break;
      current = parentEntry;
    }

    // Re-number steps from source to output
    chain.forEach((c, i) => { c.step = i; });

    return complete(p, 'ok', { chain: JSON.stringify(chain) }) as StorageProgram<Result>;
  },

  staleFiles(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'generation-provenance', 'all');

    const stale = all.filter(p => p.isStale === 'true');

    if (stale.length === 0) {
      return complete(p, 'allFresh', {}) as StorageProgram<Result>;
    }

    const files = stale.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
      generator: p.generator,
      generatedAt: p.generatedAt,
      sourceModified: '',
    }));

    return complete(p, 'ok', { files: JSON.stringify(files) }) as StorageProgram<Result>;
  },

  impactOfGeneratorChange(input: Record<string, unknown>) {
    const generator = input.generator as string;
    p = find(p, 'generation-provenance', { generator }, 'all');

    const affected = all.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
    }));

    return complete(p, 'ok', { affected: JSON.stringify(affected) }) as StorageProgram<Result>;
  },

  isGenerated(input: Record<string, unknown>) {
    let p = createProgram();
    const file = input.file as string;

    p = get(p, 'generation-provenance', `provenance:${file}`, 'entry');
    if (!entry) {
      return complete(p, 'handWritten', {}) as StorageProgram<Result>;
    }

    return complete(p, 'generated', {
      generator: entry.generator as string,
      sourceSpec: entry.sourceSpec as string,
    }) as StorageProgram<Result>;
  },
};

export const generationProvenanceHandler = autoInterpret(_handler);
