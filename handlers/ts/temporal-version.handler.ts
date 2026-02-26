// ============================================================
// TemporalVersion Handler
//
// Track content versions with bitemporal semantics -- when recorded
// (system time) and when valid (application time). Enables time-
// travel queries across both dimensions independently.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `temporal-version-${++idCounter}`;
}

export const temporalVersionHandler: ConceptHandler = {
  async record(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentHash = input.contentHash as string;
    const validFrom = input.validFrom as string | null | undefined;
    const validTo = input.validTo as string | null | undefined;
    const metadata = input.metadata as string;

    const id = nextId();
    const now = new Date().toISOString();

    // Close the system time window on the previous current version
    const currentMeta = await storage.get('temporal-version', '__current');
    if (currentMeta) {
      const prevId = currentMeta.versionId as string;
      const prevRecord = await storage.get('temporal-version', prevId);
      if (prevRecord) {
        await storage.put('temporal-version', prevId, {
          ...prevRecord,
          systemTo: now,
        });
      }
    }

    await storage.put('temporal-version', id, {
      id,
      contentHash,
      systemFrom: now,
      systemTo: null,
      validFrom: validFrom ?? null,
      validTo: validTo ?? null,
      metadata,
    });

    // Update current pointer
    await storage.put('temporal-version', '__current', {
      versionId: id,
      contentHash,
    });

    return { variant: 'ok', versionId: id };
  },

  async asOf(input: Record<string, unknown>, storage: ConceptStorage) {
    const systemTime = input.systemTime as string | null | undefined;
    const validTime = input.validTime as string | null | undefined;

    const allVersions = await storage.find('temporal-version', {});
    // Filter out internal records
    const versions = allVersions.filter(v => v.id !== '__current' && v.systemFrom);

    let candidates = versions;

    // Filter by system time
    if (systemTime) {
      candidates = candidates.filter(v => {
        const from = v.systemFrom as string;
        const to = v.systemTo as string | null;
        return from <= systemTime && (to === null || to === undefined || to > systemTime);
      });
    }

    // Filter by valid time
    if (validTime) {
      candidates = candidates.filter(v => {
        const from = v.validFrom as string | null;
        const to = v.validTo as string | null;
        // If validFrom is not set, the version is always valid
        if (from === null || from === undefined) return true;
        return from <= validTime && (to === null || to === undefined || to > validTime);
      });
    }

    if (candidates.length === 0) {
      return { variant: 'notFound', message: 'No version active at the specified times' };
    }

    // Return the most recent matching version
    candidates.sort((a, b) =>
      (b.systemFrom as string).localeCompare(a.systemFrom as string),
    );

    const best = candidates[0];
    return { variant: 'ok', versionId: best.id as string, contentHash: best.contentHash as string };
  },

  async between(input: Record<string, unknown>, storage: ConceptStorage) {
    const start = input.start as string;
    const end = input.end as string;
    const dimension = input.dimension as string;

    if (dimension !== 'system' && dimension !== 'valid') {
      return { variant: 'invalidDimension', message: 'Dimension must be "system" or "valid"' };
    }

    const allVersions = await storage.find('temporal-version', {});
    const versions = allVersions.filter(v => v.id !== '__current' && v.systemFrom);

    const matching = versions.filter(v => {
      if (dimension === 'system') {
        const from = v.systemFrom as string;
        const to = v.systemTo as string | null;
        // Version overlaps with [start, end] range
        return from <= end && (to === null || to === undefined || to >= start);
      } else {
        const from = v.validFrom as string | null;
        const to = v.validTo as string | null;
        if (from === null || from === undefined) return true;
        return from <= end && (to === null || to === undefined || to >= start);
      }
    });

    // Sort chronologically
    matching.sort((a, b) => {
      const aFrom = dimension === 'system'
        ? (a.systemFrom as string)
        : (a.validFrom as string || '');
      const bFrom = dimension === 'system'
        ? (b.systemFrom as string)
        : (b.validFrom as string || '');
      return aFrom.localeCompare(bFrom);
    });

    const versionIds = matching.map(v => v.id as string);
    return { variant: 'ok', versions: versionIds };
  },

  async current(input: Record<string, unknown>, storage: ConceptStorage) {
    const currentMeta = await storage.get('temporal-version', '__current');
    if (!currentMeta) {
      return { variant: 'empty', message: 'No versions recorded yet' };
    }

    return {
      variant: 'ok',
      versionId: currentMeta.versionId as string,
      contentHash: currentMeta.contentHash as string,
    };
  },

  async supersede(input: Record<string, unknown>, storage: ConceptStorage) {
    const versionId = input.versionId as string;
    const contentHash = input.contentHash as string;

    const oldVersion = await storage.get('temporal-version', versionId);
    if (!oldVersion) {
      return { variant: 'notFound', message: `Version '${versionId}' not found` };
    }

    const now = new Date().toISOString();

    // Close system time window on old version
    await storage.put('temporal-version', versionId, {
      ...oldVersion,
      systemTo: now,
    });

    // Create new version
    const newId = nextId();
    await storage.put('temporal-version', newId, {
      id: newId,
      contentHash,
      systemFrom: now,
      systemTo: null,
      validFrom: oldVersion.validFrom ?? null,
      validTo: oldVersion.validTo ?? null,
      metadata: oldVersion.metadata ?? '',
    });

    // Update current pointer
    await storage.put('temporal-version', '__current', {
      versionId: newId,
      contentHash,
    });

    return { variant: 'ok', newVersionId: newId };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTemporalVersionCounter(): void {
  idCounter = 0;
}
