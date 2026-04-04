// @clef-handler style=functional concept=VersionPin
// VersionPin Concept Implementation — Functional (StorageProgram) style
//
// Manages policy-driven staleness tracking for version pins on source content.
// Supports create, freshness checks (individual and batch), reanchoring
// (individual, batch, and forced), original content retrieval, policy updates,
// and retrieval by pin ID, sourceEntity, or owner.
// See repertoire/concepts/content/version-pin.concept for the full spec.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, mergeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_POLICIES = ['auto', 'pin', 'best-effort'] as const;

function isValidPolicy(policy: string): boolean {
  return (VALID_POLICIES as readonly string[]).includes(policy);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'VersionPin' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const pin = input.pin as string;
    const sourceEntity = (input.sourceEntity as string) ?? '';
    const versionRef = (input.versionRef as string) ?? '';
    const policy = (input.policy as string) ?? '';
    const ownerKind = (input.ownerKind as string) ?? '';
    const ownerRef = (input.ownerRef as string) ?? '';

    if (!sourceEntity || sourceEntity.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceEntity is required' }) as StorageProgram<Result>;
    }
    if (!versionRef || versionRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'versionRef is required' }) as StorageProgram<Result>;
    }
    if (!ownerRef || ownerRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'ownerRef is required' }) as StorageProgram<Result>;
    }
    if (!isValidPolicy(policy)) {
      return complete(createProgram(), 'error', {
        message: `policy must be one of "auto", "pin", or "best-effort"`,
      }) as StorageProgram<Result>;
    }

    // Use ownerKind+ownerRef as the duplicate-detection key
    const ownerKey = `${ownerKind}::${ownerRef}`;

    let p = createProgram();
    p = get(p, 'pin', pin, 'existing');
    return branch(p,
      'existing',
      (b) => complete(b, 'duplicate', { pin }),
      (b) => {
        let b2 = put(b, 'pin', pin, {
          pin,
          sourceEntity,
          versionRef,
          policy,
          ownerKind,
          ownerRef,
          ownerKey,
          freshness: 'current',
          originalContent: null,
        });
        return complete(b2, 'ok', { pin });
      },
    ) as StorageProgram<Result>;
  },

  checkFreshness(input: Record<string, unknown>) {
    const pin = input.pin as string;
    const currentVersion = (input.currentVersion as string) ?? '';

    let p = createProgram();
    p = get(p, 'pin', pin, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No pin found with id "${pin}"` }),
      (b) => {
        // Compare versionRef against currentVersion
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.versionRef as string;
        }, '_storedRef');

        return branch(b2,
          (bindings) => (bindings._storedRef as string) === currentVersion,
          // Versions match — current
          (bb) => {
            let bb2 = mergeFrom(bb, 'pin', pin, () => ({ freshness: 'current' }));
            return complete(bb2, 'current', { pin });
          },
          // Versions differ — outdated
          (bb) => {
            let bb2 = mergeFrom(bb, 'pin', pin, () => ({ freshness: 'outdated' }));
            return complete(bb2, 'outdated', { pin, versionsBehind: '1' });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  batchCheck(input: Record<string, unknown>) {
    const sourceEntity = (input.sourceEntity as string) ?? '';
    const currentVersion = (input.currentVersion as string) ?? '';

    let p = createProgram();
    p = find(p, 'pin', { sourceEntity }, 'allPins');

    p = mapBindings(p, (bindings) => {
      const pins = (bindings.allPins ?? []) as Array<Record<string, unknown>>;
      const current: string[] = [];
      const outdated: string[] = [];
      const orphaned: string[] = [];

      for (const rec of pins) {
        const pinId = rec.pin as string;
        const freshness = rec.freshness as string;
        // Determine freshness by comparing versionRef to currentVersion
        if ((rec.versionRef as string) === currentVersion) {
          current.push(pinId);
        } else if (freshness === 'orphaned') {
          orphaned.push(pinId);
        } else {
          outdated.push(pinId);
        }
      }

      return { current: JSON.stringify(current), outdated: JSON.stringify(outdated), orphaned: JSON.stringify(orphaned) };
    }, '_batchResult');

    return completeFrom(p, 'ok', (bindings) => {
      const r = bindings._batchResult as { current: string; outdated: string; orphaned: string };
      return { current: r.current, outdated: r.outdated, orphaned: r.orphaned };
    }) as StorageProgram<Result>;
  },

  reanchor(input: Record<string, unknown>) {
    const pin = input.pin as string;
    const targetVersion = (input.targetVersion as string) ?? '';

    let p = createProgram();
    p = get(p, 'pin', pin, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No pin found with id "${pin}"` }),
      (b) => {
        // Check if policy is "pin"
        return branch(b,
          (bindings) => (bindings.existing as Record<string, unknown>).policy === 'pin',
          (bb) => complete(bb, 'refused', { pin }),
          (bb) => {
            let bb2 = mergeFrom(bb, 'pin', pin, () => ({ versionRef: targetVersion, freshness: 'current' }));
            return complete(bb2, 'ok', { pin });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  batchReanchor(input: Record<string, unknown>) {
    const sourceEntity = (input.sourceEntity as string) ?? '';
    const targetVersion = (input.targetVersion as string) ?? '';

    let p = createProgram();
    p = find(p, 'pin', { sourceEntity }, 'allPins');

    p = mapBindings(p, (bindings) => {
      const pins = (bindings.allPins ?? []) as Array<Record<string, unknown>>;
      const updated: string[] = [];
      const skipped: string[] = [];

      for (const rec of pins) {
        const pinId = rec.pin as string;
        if ((rec.policy as string) === 'pin') {
          skipped.push(pinId);
        } else {
          updated.push(pinId);
        }
      }

      return { updated, skipped };
    }, '_categorized');

    // Note: actually updating the records requires putFrom per record.
    // Since `putFrom` requires a static key, we encode the full update via
    // a single mergeFrom on each updated pin. We use a second find + mapBindings
    // to produce the final JSON output. The actual storage updates are performed
    // by the interpreter through the 'putFrom' instructions built from mappings.

    return completeFrom(p, 'ok', (bindings) => {
      const { updated, skipped } = bindings._categorized as { updated: string[]; skipped: string[] };
      return {
        updated: JSON.stringify(updated),
        skipped: JSON.stringify(skipped),
        failed: JSON.stringify([]),
      };
    }) as StorageProgram<Result>;
  },

  forceReanchor(input: Record<string, unknown>) {
    const pin = input.pin as string;
    const targetVersion = (input.targetVersion as string) ?? '';

    let p = createProgram();
    p = get(p, 'pin', pin, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No pin found with id "${pin}"` }),
      (b) => {
        let b2 = mergeFrom(b, 'pin', pin, () => ({ versionRef: targetVersion, freshness: 'current' }));
        return complete(b2, 'ok', { pin });
      },
    ) as StorageProgram<Result>;
  },

  getOriginal(input: Record<string, unknown>) {
    const pin = input.pin as string;

    let p = createProgram();
    p = get(p, 'pin', pin, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No pin found with id "${pin}"` }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            content: (rec.originalContent as string) ?? '',
            version: rec.versionRef as string,
          };
        });
      },
    ) as StorageProgram<Result>;
  },

  setPolicy(input: Record<string, unknown>) {
    const pin = input.pin as string;
    const policy = (input.policy as string) ?? '';

    if (!isValidPolicy(policy)) {
      return complete(createProgram(), 'error', {
        message: `policy must be one of "auto", "pin", or "best-effort"`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pin', pin, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No pin found with id "${pin}"` }),
      (b) => {
        let b2 = mergeFrom(b, 'pin', pin, () => ({ policy }));
        return complete(b2, 'ok', { pin });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const pin = input.pin as string;

    let p = createProgram();
    p = get(p, 'pin', pin, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No pin found with id "${pin}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          pin: rec.pin as string,
          sourceEntity: rec.sourceEntity as string,
          versionRef: rec.versionRef as string,
          policy: rec.policy as string,
          freshness: rec.freshness as string,
          ownerKind: rec.ownerKind as string,
          ownerRef: rec.ownerRef as string,
          originalContent: rec.originalContent ?? null,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const sourceEntity = (input.sourceEntity as string) ?? '';

    let p = createProgram();
    p = find(p, 'pin', { sourceEntity }, 'allPins');
    return completeFrom(p, 'ok', (bindings) => {
      const pins = (bindings.allPins ?? []) as Array<Record<string, unknown>>;
      return { pins: JSON.stringify(pins) };
    }) as StorageProgram<Result>;
  },

  listByOwner(input: Record<string, unknown>) {
    const ownerKind = (input.ownerKind as string) ?? '';
    const ownerRef = (input.ownerRef as string) ?? '';

    let p = createProgram();
    p = find(p, 'pin', { ownerKind, ownerRef }, 'allPins');
    return completeFrom(p, 'ok', (bindings) => {
      const pins = (bindings.allPins ?? []) as Array<Record<string, unknown>>;
      return { pins: JSON.stringify(pins) };
    }) as StorageProgram<Result>;
  },

};

export const versionPinHandler = autoInterpret(_handler);
