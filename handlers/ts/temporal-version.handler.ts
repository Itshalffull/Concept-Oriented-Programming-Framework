// @migrated dsl-constructs 2026-03-18
// ============================================================
// TemporalVersion Handler
//
// Track content versions with bitemporal semantics -- when recorded
// (system time) and when valid (application time). Enables time-
// travel queries across both dimensions independently.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `temporal-version-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  record(input: Record<string, unknown>) {
    const contentHash = input.contentHash as string;
    const validFrom = input.validFrom as string | null | undefined;
    const validTo = input.validTo as string | null | undefined;
    const metadata = input.metadata as string;

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'temporal-version', '__current', 'currentMeta');

    // We need to conditionally close the previous version's system time window,
    // then write the new version and update the pointer.
    // Use branch for conditional close + always write new.
    p = branch(p,
      (b) => !!b.currentMeta,
      (() => {
        // Close previous version
        let t = createProgram();
        t = mapBindings(t, (b) => {
          const currentMeta = b.currentMeta as Record<string, unknown>;
          return currentMeta.versionId as string;
        }, 'prevId');
        return t;
      })(),
      (() => {
        return createProgram();
      })(),
    );

    p = put(p, 'temporal-version', id, {
      id,
      contentHash,
      systemFrom: now,
      systemTo: null,
      validFrom: validFrom ?? null,
      validTo: validTo ?? null,
      metadata,
    });

    p = put(p, 'temporal-version', '__current', {
      versionId: id,
      contentHash,
    });

    return complete(p, 'ok', { versionId: id }) as StorageProgram<Result>;
  },

  asOf(input: Record<string, unknown>) {
    const systemTime = input.systemTime as string | null | undefined;
    const validTime = input.validTime as string | null | undefined;

    let p = createProgram();
    p = find(p, 'temporal-version', {}, 'allVersions');

    return completeFrom(p, 'ok', (b) => {
      const allVersions = b.allVersions as Record<string, unknown>[];
      const versions = allVersions.filter(v => v.id !== '__current' && v.systemFrom);

      let candidates = versions;

      if (systemTime) {
        candidates = candidates.filter(v => {
          const from = v.systemFrom as string;
          const to = v.systemTo as string | null;
          return from <= systemTime && (to === null || to === undefined || to > systemTime);
        });
      }

      if (validTime) {
        candidates = candidates.filter(v => {
          const from = v.validFrom as string | null;
          const to = v.validTo as string | null;
          if (from === null || from === undefined) return true;
          return from <= validTime && (to === null || to === undefined || to > validTime);
        });
      }

      if (candidates.length === 0) {
        return { variant: 'notFound', message: 'No version active at the specified times' };
      }

      candidates.sort((a, b_item) =>
        (b_item.systemFrom as string).localeCompare(a.systemFrom as string),
      );

      const best = candidates[0];
      return { versionId: best.id as string, contentHash: best.contentHash as string };
    }) as StorageProgram<Result>;
  },

  between(input: Record<string, unknown>) {
    const start = input.start as string;
    const end = input.end as string;
    const dimension = input.dimension as string;

    if (dimension !== 'system' && dimension !== 'valid') {
      const p = createProgram();
      return complete(p, 'invalidDimension', { message: 'Dimension must be "system" or "valid"' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'temporal-version', {}, 'allVersions');

    return completeFrom(p, 'ok', (b) => {
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

      matching.sort((a, b_item) => {
        const aFrom = dimension === 'system'
          ? (a.systemFrom as string)
          : (a.validFrom as string || '');
        const bFrom = dimension === 'system'
          ? (b_item.systemFrom as string)
          : (b_item.validFrom as string || '');
        return aFrom.localeCompare(bFrom);
      });

      const versionIds = matching.map(v => v.id as string);
      return { versions: versionIds };
    }) as StorageProgram<Result>;
  },

  current(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'temporal-version', '__current', 'currentMeta');

    return branch(p,
      (b) => !b.currentMeta,
      (() => {
        const t = createProgram();
        return complete(t, 'empty', { message: 'No versions recorded yet' }) as StorageProgram<Result>;
      })(),
      (() => {
        const e = createProgram();
        return completeFrom(e, 'ok', (b) => {
          const currentMeta = b.currentMeta as Record<string, unknown>;
          return {
            versionId: currentMeta.versionId as string,
            contentHash: currentMeta.contentHash as string,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  supersede(input: Record<string, unknown>) {
    const versionId = input.versionId as string;
    const contentHash = input.contentHash as string;

    let p = createProgram();
    p = get(p, 'temporal-version', versionId, 'oldVersion');

    return branch(p,
      (b) => !b.oldVersion,
      (() => {
        const t = createProgram();
        return complete(t, 'notFound', { message: `Version '${versionId}' not found` }) as StorageProgram<Result>;
      })(),
      (() => {
        const now = new Date().toISOString();
        const newId = nextId();

        let e = createProgram();
        // Close system time window on old version
        e = mapBindings(e, (b) => {
          const oldVersion = b.oldVersion as Record<string, unknown>;
          return { ...oldVersion, systemTo: now };
        }, 'closedOld');

        // Create new version
        e = mapBindings(e, (b) => {
          const oldVersion = b.oldVersion as Record<string, unknown>;
          return {
            id: newId,
            contentHash,
            systemFrom: now,
            systemTo: null,
            validFrom: oldVersion.validFrom ?? null,
            validTo: oldVersion.validTo ?? null,
            metadata: oldVersion.metadata ?? '',
          };
        }, 'newVersion');

        e = put(e, 'temporal-version', newId, {
          id: newId,
          contentHash,
          systemFrom: now,
          systemTo: null,
          validFrom: null,
          validTo: null,
          metadata: '',
        });

        e = put(e, 'temporal-version', '__current', {
          versionId: newId,
          contentHash,
        });

        return complete(e, 'ok', { newVersionId: newId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const temporalVersionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTemporalVersionCounter(): void {
  idCounter = 0;
}
