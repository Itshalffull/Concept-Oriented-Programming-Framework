// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// GenerationProvenance Concept Implementation
//
// Tracks which generator produced which file, from what source spec,
// with what configuration. Enables provenance queries, staleness
// detection, and impact analysis for generator changes.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

export const generationProvenanceHandler: ConceptHandler = {

  async record(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const outputFile = input.outputFile as string;
    if (!outputFile || outputFile.trim() === '') {
      return { variant: 'error', message: 'outputFile is required' };
    }
    const generator = input.generator as string;
    const sourceSpec = input.sourceSpec as string;
    const sourceSpecKind = input.sourceSpecKind as string;
    const config = input.config as string;

    const key = `provenance:${outputFile}`;
    const existing = await storage.get('generation-provenance', key);
    const now = new Date().toISOString();

    if (existing) {
      await storage.put('generation-provenance', key, {
        id: existing.id as string,
        outputFile, generator, sourceSpec, sourceSpecKind,
        generatorConfig: config || '{}',
        generatedAt: now, contentHash: '', isStale: 'false',
      });
      return { variant: 'ok', existing: existing.id as string, provenance: existing.id as string, output: { provenance: existing.id as string } };
    }

    const id = crypto.randomUUID();
    await storage.put('generation-provenance', key, {
      id, outputFile, generator, sourceSpec, sourceSpecKind,
      generatorConfig: config || '{}',
      generatedAt: now, contentHash: '', isStale: 'false',
    });
    return { variant: 'ok', provenance: id, output: { provenance: id } };
  },

  async getByFile(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const outputFile = input.outputFile as string;
    const entry = await storage.get('generation-provenance', `provenance:${outputFile}`);
    if (!entry) return { variant: 'notGenerated' };
    return { variant: 'ok', provenance: entry.id as string };
  },

  async findByGenerator(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const generator = input.generator as string;
    const all = await storage.find('generation-provenance', { generator });
    if (all.length === 0) return { variant: 'notfound', generator };
    const files = all.map(item => ({
      outputFile: item.outputFile,
      sourceSpec: item.sourceSpec,
      generatedAt: item.generatedAt,
    }));
    return { variant: 'ok', files: JSON.stringify(files) };
  },

  async findBySource(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const sourceSpec = input.sourceSpec as string;
    const all = await storage.find('generation-provenance', { sourceSpec });
    if (all.length === 0) return { variant: 'notfound', sourceSpec };
    const files = all.map(item => ({
      outputFile: item.outputFile,
      generator: item.generator,
      generatedAt: item.generatedAt,
    }));
    return { variant: 'ok', files: JSON.stringify(files) };
  },

  async generationChain(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const outputFile = input.outputFile as string;
    const entry = await storage.get('generation-provenance', `provenance:${outputFile}`);
    if (!entry) return { variant: 'notGenerated' };

    // Walk the chain backwards from the final output to the original source
    const chain: { step: number; input: string; generator: string; output: string }[] = [];
    let current = entry;
    const visited = new Set<string>();

    while (current && !visited.has(current.outputFile as string)) {
      visited.add(current.outputFile as string);
      chain.unshift({
        step: 0,
        input: current.sourceSpec as string,
        generator: current.generator as string,
        output: current.outputFile as string,
      });
      // Look up provenance of the source
      const parent = await storage.get('generation-provenance', `provenance:${current.sourceSpec}`);
      current = parent as Record<string, unknown> | null;
    }

    // Re-number steps
    chain.forEach((item, i) => { item.step = i; });

    return { variant: 'ok', chain: JSON.stringify(chain) };
  },

  async staleFiles(_input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const all = await storage.find('generation-provenance', {});

    if (all.length === 0) return { variant: 'error', message: 'no provenance records found' };

    const stale = all.filter(item => item.isStale === 'true');
    const files = stale.map(item => ({
      outputFile: item.outputFile,
      sourceSpec: item.sourceSpec,
      generator: item.generator,
      generatedAt: item.generatedAt,
      sourceModified: '',
    }));

    return { variant: 'ok', files: JSON.stringify(files) };
  },

  async impactOfGeneratorChange(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const generator = input.generator as string;
    const all = await storage.find('generation-provenance', { generator });
    if (all.length === 0) return { variant: 'notfound', generator };
    const affected = all.map(item => ({
      outputFile: item.outputFile,
      sourceSpec: item.sourceSpec,
    }));
    return { variant: 'ok', affected: JSON.stringify(affected) };
  },

  async isGenerated(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const file = input.file as string;
    const entry = await storage.get('generation-provenance', `provenance:${file}`);
    if (!entry) return { variant: 'handWritten' };
    return {
      variant: 'ok',
      generator: entry.generator as string,
      sourceSpec: entry.sourceSpec as string,
    };
  },
};
