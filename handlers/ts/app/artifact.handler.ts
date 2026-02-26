// Artifact Concept Implementation (Deploy Kit)
// Manage immutable, content-addressed build artifacts for concept deployments.
import type { ConceptHandler } from '@clef/kernel';
import { createHash } from 'crypto';

export const artifactHandler: ConceptHandler = {
  async build(input, storage) {
    const concept = input.concept as string;
    const spec = input.spec as string;
    const implementation = input.implementation as string;
    const deps = input.deps as string;

    const depsList: string[] = JSON.parse(deps);

    // Compute content hash from all inputs
    const hashInput = [concept, spec, implementation, ...depsList].join('|');
    const hash = createHash('sha256').update(hashInput).digest('hex');

    // Check if artifact with same hash already exists
    const existing = await storage.get('artifact', hash);
    if (existing) {
      return {
        variant: 'ok',
        artifact: hash,
        hash,
        sizeBytes: existing.sizeBytes as number,
      };
    }

    // Simulate compilation - compute artifact size from input lengths
    const sizeBytes = spec.length + implementation.length + depsList.join('').length;

    const builtAt = new Date().toISOString();
    const inputHashes = [
      { name: 'spec', hash: createHash('sha256').update(spec).digest('hex') },
      { name: 'implementation', hash: createHash('sha256').update(implementation).digest('hex') },
      ...depsList.map(d => ({
        name: d,
        hash: createHash('sha256').update(d).digest('hex'),
      })),
    ];

    const location = `artifacts/${concept}/${hash}`;

    await storage.put('artifact', hash, {
      hash,
      kitName: concept,
      kitVersion: '1.0.0',
      conceptName: concept,
      builtAt,
      inputs: JSON.stringify(inputHashes),
      location,
      sizeBytes,
    });

    return { variant: 'ok', artifact: hash, hash, sizeBytes };
  },

  async resolve(input, storage) {
    const hash = input.hash as string;

    const existing = await storage.get('artifact', hash);
    if (!existing) {
      return { variant: 'notfound', hash };
    }

    return {
      variant: 'ok',
      artifact: hash,
      location: existing.location as string,
    };
  },

  async gc(input, storage) {
    const olderThan = input.olderThan as string;
    const keepVersions = input.keepVersions as number;

    const allArtifacts = await storage.find('artifact');
    const cutoff = new Date(olderThan).getTime();

    // Group artifacts by concept
    const byConcept: Record<string, Array<{ key: string; builtAt: number; sizeBytes: number }>> = {};
    for (const artifact of allArtifacts) {
      const conceptName = artifact.conceptName as string;
      if (!byConcept[conceptName]) {
        byConcept[conceptName] = [];
      }
      byConcept[conceptName].push({
        key: artifact.hash as string,
        builtAt: new Date(artifact.builtAt as string).getTime(),
        sizeBytes: artifact.sizeBytes as number,
      });
    }

    let removed = 0;
    let freedBytes = 0;

    for (const conceptName of Object.keys(byConcept)) {
      const entries = byConcept[conceptName];
      // Sort by builtAt descending to keep most recent
      entries.sort((a, b) => b.builtAt - a.builtAt);

      for (let i = 0; i < entries.length; i++) {
        // Keep at least keepVersions recent artifacts per concept
        if (i < keepVersions) continue;
        if (entries[i].builtAt < cutoff) {
          await storage.delete('artifact', entries[i].key);
          removed++;
          freedBytes += entries[i].sizeBytes;
        }
      }
    }

    return { variant: 'ok', removed, freedBytes };
  },
};
