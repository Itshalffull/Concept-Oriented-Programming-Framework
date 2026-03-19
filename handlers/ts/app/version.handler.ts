// Version Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const versionHandler: ConceptHandler = {
  async snapshot(input, storage) {
    const version = input.version as string;
    const entity = input.entity as string;
    const data = input.data as string;
    const author = input.author as string;
    const now = new Date().toISOString();

    await storage.put('version', version, {
      version,
      entity,
      snapshot: data,
      timestamp: now,
      author,
    });

    return { variant: 'ok', version };
  },

  async listVersions(input, storage) {
    const entity = input.entity as string;

    const results = await storage.find('version', { entity });
    const sorted = results.sort((a, b) =>
      (a.timestamp as string).localeCompare(b.timestamp as string),
    );

    // Return version labels as plain strings: "v1", "v2", etc.
    const versionLabels = sorted.map((_, i) => `v${i + 1}`);
    const versions = versionLabels.length === 1 ? versionLabels[0] : versionLabels.join(',');

    return { variant: 'ok', versions };
  },

  async rollback(input, storage) {
    const version = input.version as string;

    const existing = await storage.get('version', version);
    if (!existing) {
      return { variant: 'notfound', message: 'Version not found' };
    }

    return { variant: 'ok', data: existing.snapshot as string };
  },

  async diff(input, storage) {
    const versionA = input.versionA as string;
    const versionB = input.versionB as string;

    const a = await storage.get('version', versionA);
    const b = await storage.get('version', versionB);

    if (!a || !b) {
      return { variant: 'notfound', message: 'One or both versions do not exist' };
    }

    const changes = JSON.stringify({
      versionA: { version: versionA, snapshot: a.snapshot },
      versionB: { version: versionB, snapshot: b.snapshot },
      equal: a.snapshot === b.snapshot,
    });

    return { variant: 'ok', changes };
  },
};
