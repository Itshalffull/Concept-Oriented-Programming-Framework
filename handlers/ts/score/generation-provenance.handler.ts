// GenerationProvenance Concept Implementation
//
// Tracks which generator produced which file, from what source spec,
// with what configuration. Enables provenance queries, staleness
// detection, and impact analysis for generator changes.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const generationProvenanceHandler: ConceptHandler = {

  async record(input, storage) {
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

  async getByFile(input, storage) {
    const outputFile = input.outputFile as string;

    const entry = await storage.get('generation-provenance', `provenance:${outputFile}`);
    if (!entry) {
      return { variant: 'notGenerated' };
    }

    return { variant: 'ok', provenance: entry.id };
  },

  async findByGenerator(input, storage) {
    const generator = input.generator as string;
    const all = await storage.find('generation-provenance', { generator });

    const files = all.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
      generatedAt: p.generatedAt,
    }));

    return { variant: 'ok', files: JSON.stringify(files) };
  },

  async findBySource(input, storage) {
    const sourceSpec = input.sourceSpec as string;
    const all = await storage.find('generation-provenance', { sourceSpec });

    const files = all.map(p => ({
      outputFile: p.outputFile,
      generator: p.generator,
      generatedAt: p.generatedAt,
    }));

    return { variant: 'ok', files: JSON.stringify(files) };
  },

  async generationChain(input, storage) {
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

  async staleFiles(_input, storage) {
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

  async impactOfGeneratorChange(input, storage) {
    const generator = input.generator as string;
    const all = await storage.find('generation-provenance', { generator });

    const affected = all.map(p => ({
      outputFile: p.outputFile,
      sourceSpec: p.sourceSpec,
    }));

    return { variant: 'ok', affected: JSON.stringify(affected) };
  },

  async isGenerated(input, storage) {
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
