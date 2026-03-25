// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// GenerationProvenance Concept Implementation
//
// Tracks which generator produced which file, from what source spec,
// with what configuration. Enables provenance queries, staleness
// detection, and impact analysis for generator changes.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, putFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  record(input: Record<string, unknown>) {
    const outputFile = input.outputFile as string;
    if (!outputFile || outputFile.trim() === '') {
      return complete(createProgram(), 'error', { message: 'outputFile is required' }) as StorageProgram<Result>;
    }
    const generator = input.generator as string;
    const sourceSpec = input.sourceSpec as string;
    const sourceSpecKind = input.sourceSpecKind as string;
    const config = input.config as string;
    const contentHash = (input.contentHash as string) || '';

    const key = `provenance:${outputFile}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'generation-provenance', key, 'existing');

    return branch(p,
      'existing',
      (b) => {
        // Update existing record
        let b2 = putFrom(b, 'generation-provenance', key, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            id: existing.id as string,
            outputFile, generator, sourceSpec, sourceSpecKind,
            generatorConfig: config || '{}',
            generatedAt: now, contentHash, isStale: 'false',
          };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { existing: existing.id as string, provenance: existing.id as string, output: { provenance: existing.id as string } };
        }) as StorageProgram<Result>;
      },
      (b) => {
        // Create new record
        const id = crypto.randomUUID();
        let b2 = put(b, 'generation-provenance', key, {
          id, outputFile, generator, sourceSpec, sourceSpecKind,
          generatorConfig: config || '{}',
          generatedAt: now, contentHash, isStale: 'false',
        });
        return complete(b2, 'ok', { provenance: id, output: { provenance: id } }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  getByFile(input: Record<string, unknown>) {
    const outputFile = input.outputFile as string;
    const key = `provenance:${outputFile}`;

    let p = createProgram();
    p = get(p, 'generation-provenance', key, 'entry');

    return branch(p,
      (b) => !b.entry,
      (b) => complete(b, 'notGenerated', {}) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return {
          provenance: entry.id as string,
          contentHash: entry.contentHash as string,
          generator: entry.generator as string,
          sourceSpec: entry.sourceSpec as string,
        };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  findByGenerator(input: Record<string, unknown>) {
    const generator = input.generator as string;

    let p = createProgram();
    p = find(p, 'generation-provenance', { generator }, 'all');

    return branch(p,
      (b) => (b.all as unknown[]).length === 0,
      (b) => complete(b, 'notfound', { generator }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        const files = all.map(item => ({
          outputFile: item.outputFile,
          sourceSpec: item.sourceSpec,
          generatedAt: item.generatedAt,
        }));
        return { files: JSON.stringify(files) };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  findBySource(input: Record<string, unknown>) {
    const sourceSpec = input.sourceSpec as string;

    let p = createProgram();
    p = find(p, 'generation-provenance', { sourceSpec }, 'all');

    return branch(p,
      (b) => (b.all as unknown[]).length === 0,
      (b) => complete(b, 'notfound', { sourceSpec }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        const files = all.map(item => ({
          outputFile: item.outputFile,
          generator: item.generator,
          generatedAt: item.generatedAt,
        }));
        return { files: JSON.stringify(files) };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  generationChain(input: Record<string, unknown>) {
    const outputFile = input.outputFile as string;
    const key = `provenance:${outputFile}`;

    let p = createProgram();
    p = get(p, 'generation-provenance', key, 'entry');

    // For chain walking we need repeated gets. Since the chain is short (usually 1-3 levels)
    // and the source spec key is deterministic, we can pre-fetch all provenance records
    // and walk the chain in a pure mapBindings.
    return branch(p,
      (b) => !b.entry,
      (b) => complete(b, 'notGenerated', {}) as StorageProgram<Result>,
      (b) => {
        let b2 = find(b, 'generation-provenance', {}, 'allProvenance');
        return completeFrom(b2, 'ok', (bindings) => {
          const allProvenance = bindings.allProvenance as Record<string, unknown>[];
          const entry = bindings.entry as Record<string, unknown>;

          // Build lookup by outputFile for chain walking
          const byOutput = new Map<string, Record<string, unknown>>();
          for (const item of allProvenance) {
            byOutput.set(item.outputFile as string, item);
          }

          const chain: { step: number; input: string; generator: string; output: string }[] = [];
          let current: Record<string, unknown> | undefined = entry;
          const visited = new Set<string>();

          while (current && !visited.has(current.outputFile as string)) {
            visited.add(current.outputFile as string);
            chain.unshift({
              step: 0,
              input: current.sourceSpec as string,
              generator: current.generator as string,
              output: current.outputFile as string,
            });
            current = byOutput.get(current.sourceSpec as string);
          }

          chain.forEach((item, i) => { item.step = i; });

          return { chain: JSON.stringify(chain) };
        }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  staleFiles(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'generation-provenance', {}, 'all');

    return branch(p,
      (b) => (b.all as unknown[]).length === 0,
      (b) => complete(b, 'error', { message: 'no provenance records found' }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        const stale = all.filter(item => item.isStale === 'true');
        const files = stale.map(item => ({
          outputFile: item.outputFile,
          sourceSpec: item.sourceSpec,
          generator: item.generator,
          generatedAt: item.generatedAt,
          sourceModified: '',
        }));
        return { files: JSON.stringify(files) };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  impactOfGeneratorChange(input: Record<string, unknown>) {
    const generator = input.generator as string;

    let p = createProgram();
    p = find(p, 'generation-provenance', { generator }, 'all');

    return branch(p,
      (b) => (b.all as unknown[]).length === 0,
      (b) => complete(b, 'notfound', { generator }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        const affected = all.map(item => ({
          outputFile: item.outputFile,
          sourceSpec: item.sourceSpec,
        }));
        return { affected: JSON.stringify(affected) };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  isGenerated(input: Record<string, unknown>) {
    const file = input.file as string;
    const key = `provenance:${file}`;

    let p = createProgram();
    p = get(p, 'generation-provenance', key, 'entry');

    return branch(p,
      (b) => !b.entry,
      (b) => complete(b, 'handWritten', {}) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return {
          generator: entry.generator as string,
          sourceSpec: entry.sourceSpec as string,
        };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const generationProvenanceHandler = autoInterpret(_handler);
