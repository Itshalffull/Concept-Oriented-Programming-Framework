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

    const now = new Date().toISOString();

    p = branch(p,
      (bindings) => !!bindings.existing,
      (b) => {
        let b2 = putFrom(b, 'generation-provenance', key, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            id: existing.id as string,
            outputFile,
            generator,
            sourceSpec,
            sourceSpecKind,
            generatorConfig: config || '{}',
            generatedAt: now,
            contentHash: '',
            isStale: 'false',
          };
        });
        return completeFrom(b2, 'updated', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { existing: existing.id as string };
        });
      },
      (b) => {
        const id = crypto.randomUUID();
        let b2 = put(b, 'generation-provenance', key, {
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
        return complete(b2, 'ok', { provenance: id });
      },
    ) as StorageProgram<Result>;

    return p;
  },

  getByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const outputFile = input.outputFile as string;

    p = get(p, 'generation-provenance', `provenance:${outputFile}`, 'entry');
    p = branch(p,
      (bindings) => !bindings.entry,
      (b) => complete(b, 'notGenerated', {}),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return { provenance: entry.id as string };
      }),
    ) as StorageProgram<Result>;

    return p;
  },

  findByGenerator(input: Record<string, unknown>) {
    let p = createProgram();
    const generator = input.generator as string;
    p = find(p, 'generation-provenance', { generator }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const files = all.map(item => ({
        outputFile: item.outputFile,
        sourceSpec: item.sourceSpec,
        generatedAt: item.generatedAt,
      }));
      return { files: JSON.stringify(files) };
    }) as StorageProgram<Result>;
  },

  findBySource(input: Record<string, unknown>) {
    let p = createProgram();
    const sourceSpec = input.sourceSpec as string;
    p = find(p, 'generation-provenance', { sourceSpec }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const files = all.map(item => ({
        outputFile: item.outputFile,
        generator: item.generator,
        generatedAt: item.generatedAt,
      }));
      return { files: JSON.stringify(files) };
    }) as StorageProgram<Result>;
  },

  generationChain(input: Record<string, unknown>) {
    let p = createProgram();
    const outputFile = input.outputFile as string;

    // The generation chain requires imperative iteration over storage reads,
    // which cannot be expressed as a pure program tree. We build a single-step
    // lookup and return the direct provenance entry. Full chain traversal
    // would require the sync engine or an imperative handler.
    p = get(p, 'generation-provenance', `provenance:${outputFile}`, 'entry');
    p = branch(p,
      (bindings) => !bindings.entry,
      (b) => complete(b, 'notGenerated', {}),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        const chain = [{
          step: 0,
          input: entry.sourceSpec as string,
          generator: entry.generator as string,
          output: entry.outputFile as string,
        }];
        return { chain: JSON.stringify(chain) };
      }),
    ) as StorageProgram<Result>;

    return p;
  },

  staleFiles(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'generation-provenance', 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const stale = all.filter(item => item.isStale === 'true');

      if (stale.length === 0) {
        return { _variant: 'allFresh' };
      }

      const files = stale.map(item => ({
        outputFile: item.outputFile,
        sourceSpec: item.sourceSpec,
        generator: item.generator,
        generatedAt: item.generatedAt,
        sourceModified: '',
      }));

      return { files: JSON.stringify(files) };
    }) as StorageProgram<Result>;
  },

  impactOfGeneratorChange(input: Record<string, unknown>) {
    let p = createProgram();
    const generator = input.generator as string;
    p = find(p, 'generation-provenance', { generator }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const affected = all.map(item => ({
        outputFile: item.outputFile,
        sourceSpec: item.sourceSpec,
      }));
      return { affected: JSON.stringify(affected) };
    }) as StorageProgram<Result>;
  },

  isGenerated(input: Record<string, unknown>) {
    let p = createProgram();
    const file = input.file as string;

    p = get(p, 'generation-provenance', `provenance:${file}`, 'entry');
    p = branch(p,
      (bindings) => !bindings.entry,
      (b) => complete(b, 'handWritten', {}),
      (b) => completeFrom(b, 'generated', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return {
          generator: entry.generator as string,
          sourceSpec: entry.sourceSpec as string,
        };
      }),
    ) as StorageProgram<Result>;

    return p;
  },
};

export const generationProvenanceHandler = autoInterpret(_handler);
