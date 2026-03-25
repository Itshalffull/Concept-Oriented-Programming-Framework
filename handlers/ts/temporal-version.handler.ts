// @clef-handler style=functional
// ============================================================
// TemporalVersion Handler
//
// Track content versions with bitemporal semantics -- when recorded
// (system time) and when valid (application time). Enables time-
// travel queries across both dimensions independently.
//
// record/supersede use imperative overrides because they need
// to read, close, and write multiple records with dynamic IDs.
// asOf/between/current are functional.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `temporal-version-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  // record uses imperative override — needs to close prev version by dynamic ID
  record(input: Record<string, unknown>): StorageProgram<Result> {
    const contentHash = input.contentHash as string;
    if (!contentHash || (typeof contentHash === 'string' && contentHash.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'contentHash is required' }) as StorageProgram<Result>;
    }

    // Return a placeholder — imperative override handles actual logic
    let p = createProgram();
    p = get(p, 'temporal-version', '__current', 'currentMeta');
    return completeFrom(p, 'ok', (_b) => ({ versionId: 'pending' })) as StorageProgram<Result>;
  },

  asOf(input: Record<string, unknown>): StorageProgram<Result> {
    const systemTime = input.systemTime as string | null | undefined;
    const validTime = input.validTime as string | null | undefined;

    let p = createProgram();
    p = find(p, 'temporal-version', {}, 'allVersions');

    p = mapBindings(p, (b) => {
      const allVersions = b.allVersions as Record<string, unknown>[];
      const versions = allVersions.filter(v => v.id !== '__current' && v.systemFrom);

      let candidates = versions;
      if (systemTime) {
        const filtered = candidates.filter(v => {
          const from = v.systemFrom as string;
          const to = v.systemTo as string | null;
          return from <= systemTime && (to === null || to === undefined || to > systemTime);
        });
        if (filtered.length > 0) candidates = filtered;
      }
      if (validTime) {
        const filtered = candidates.filter(v => {
          const from = v.validFrom as string | null;
          const to = v.validTo as string | null;
          if (from === null || from === undefined) return true;
          return from <= validTime && (to === null || to === undefined || to > validTime);
        });
        if (filtered.length > 0) candidates = filtered;
      }

      if (candidates.length === 0) return null;

      candidates.sort((a, c) => (c.systemFrom as string).localeCompare(a.systemFrom as string));
      return candidates[0];
    }, 'best');

    return branch(p,
      (b) => b.best == null,
      (notFoundP) => complete(notFoundP, 'notFound', {
        message: 'No version active at the specified times',
      }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const best = b.best as Record<string, unknown>;
        return { versionId: best.id as string, contentHash: best.contentHash as string };
      }),
    ) as StorageProgram<Result>;
  },

  between(input: Record<string, unknown>): StorageProgram<Result> {
    const start = input.start as string;
    const end = input.end as string;
    const dimension = input.dimension as string;

    if (dimension !== 'system' && dimension !== 'valid') {
      return complete(createProgram(), 'invalidDimension', {
        message: 'Dimension must be "system" or "valid"',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'temporal-version', {}, 'allVersions');

    p = mapBindings(p, (b) => {
      const allVersions = b.allVersions as Record<string, unknown>[];
      const versions = allVersions.filter(v => v.id !== '__current' && v.systemFrom);

      const matching = versions.filter(v => {
        if (dimension === 'system') {
          const from = v.systemFrom as string;
          const to = v.systemTo as string | null;
          return from <= end && (to === null || to === undefined || to >= start);
        } else {
          const from = v.validFrom as string | null;
          const to = v.validTo as string | null;
          if (from === null || from === undefined) return true;
          return from <= end && (to === null || to === undefined || to >= start);
        }
      });

      matching.sort((a, c) => {
        const aFrom = dimension === 'system' ? (a.systemFrom as string) : (a.validFrom as string || '');
        const cFrom = dimension === 'system' ? (c.systemFrom as string) : (c.validFrom as string || '');
        return aFrom.localeCompare(cFrom);
      });

      return matching.map(v => v.id as string);
    }, 'versions');

    return completeFrom(p, 'ok', (b) => ({
      versions: b.versions as string[],
    })) as StorageProgram<Result>;
  },

  current(_input: Record<string, unknown>): StorageProgram<Result> {
    let p = createProgram();
    p = get(p, 'temporal-version', '__current', 'currentMeta');

    return branch(p,
      (b) => b.currentMeta == null,
      (emptyP) => complete(emptyP, 'empty', { message: 'No versions recorded yet' }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const meta = b.currentMeta as Record<string, unknown>;
        return {
          versionId: meta.versionId as string,
          contentHash: meta.contentHash as string,
        };
      }),
    ) as StorageProgram<Result>;
  },

  // supersede uses imperative override — closes old version + creates new by dynamic IDs
  supersede(input: Record<string, unknown>): StorageProgram<Result> {
    const versionId = input.versionId as string;
    let p = createProgram();
    p = get(p, 'temporal-version', versionId, 'oldVersion');
    return branch(p,
      (b) => b.oldVersion == null,
      (notFoundP) => complete(notFoundP, 'notFound', {
        message: `Version '${versionId}' not found`,
      }),
      (foundP) => completeFrom(foundP, 'ok', (_b) => ({ newVersionId: 'pending' })),
    ) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

export const temporalVersionHandler: typeof _base & {
  record(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  supersede(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
} = Object.assign(Object.create(Object.getPrototypeOf(_base)), _base, {
  async record(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const contentHash = input.contentHash as string;
    if (!contentHash || (typeof contentHash === 'string' && contentHash.trim() === '')) {
      return { variant: 'error', message: 'contentHash is required' };
    }
    const validFrom = input.validFrom as string | null | undefined;
    const validTo = input.validTo as string | null | undefined;
    const metadata = input.metadata as string;

    const id = nextId();
    const now = new Date().toISOString();

    const currentMeta = await storage.get('temporal-version', '__current');
    if (currentMeta) {
      const prevId = currentMeta.versionId as string;
      const prevRecord = await storage.get('temporal-version', prevId);
      if (prevRecord) {
        await storage.put('temporal-version', prevId, { ...prevRecord, systemTo: now });
      }
    }

    await storage.put('temporal-version', id, {
      id, contentHash, systemFrom: now, systemTo: null,
      validFrom: validFrom ?? null, validTo: validTo ?? null, metadata,
    });

    await storage.put('temporal-version', '__current', { versionId: id, contentHash });
    return { variant: 'ok', versionId: id, output: { versionId: id } };
  },

  async supersede(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const versionId = input.versionId as string;
    const contentHash = input.contentHash as string;

    const oldVersion = await storage.get('temporal-version', versionId);
    if (!oldVersion) return { variant: 'notFound', message: `Version '${versionId}' not found` };

    const now = new Date().toISOString();
    const newId = nextId();

    await storage.put('temporal-version', versionId, { ...oldVersion, systemTo: now });

    await storage.put('temporal-version', newId, {
      id: newId, contentHash, systemFrom: now, systemTo: null,
      validFrom: oldVersion.validFrom ?? null, validTo: oldVersion.validTo ?? null,
      metadata: oldVersion.metadata ?? '',
    });

    await storage.put('temporal-version', '__current', { versionId: newId, contentHash });
    return { variant: 'ok', newVersionId: newId };
  },
});

/** Reset the ID counter. Useful for testing. */
export function resetTemporalVersionCounter(): void {
  idCounter = 0;
}
