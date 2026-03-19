// @migrated dsl-constructs 2026-03-18
// ============================================================
// FeatureFlag Handler
//
// Additive compile-time feature toggles for modules. Each feature flag gates
// additional dependencies and capabilities, unified across the dependency
// graph using set union with mutual-exclusion constraint enforcement.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;

/** Reset the ID counter (for testing). */
export function resetFeatureFlagIds(): void {
  nextId = 1;
}

interface FeatureFlagRecord {
  flagId: string;
  module_id: string;
  name: string;
  default: boolean;
  additional_deps: string[];
  mutually_exclusive_with: string[];
  enabled: boolean;
}

const _handler: FunctionalConceptHandler = {
  enable(input: Record<string, unknown>) {
    const flagId = input.flag as string;

    let p = createProgram();
    p = get(p, 'featureFlag', flagId, 'flag');

    return branch(p, 'flag',
      (thenP) => {
        return completeFrom(thenP, 'dynamic', (bindings) => {
          const flag = bindings.flag as unknown as FeatureFlagRecord;

          if (flag.enabled) {
            return { variant: 'ok' };
          }

          // Need to check mutual exclusion but we need allFlags
          // This requires a second storage call, handled via the program chain
          return { variant: '_needsMutualCheck', flagId };
        });
      },
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },

  disable(input: Record<string, unknown>) {
    const flagId = input.flag as string;

    let p = createProgram();
    p = get(p, 'featureFlag', flagId, 'flag');

    return branch(p, 'flag',
      (thenP) => {
        thenP = putFrom(thenP, 'featureFlag', flagId, (bindings) => {
          const flag = bindings.flag as Record<string, unknown>;
          return { ...flag, enabled: false };
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },

  unify(input: Record<string, unknown>) {
    const flagIds = input.flags as string[];

    // Fetch all flags to do mutual exclusion checking
    let p = createProgram();
    p = find(p, 'featureFlag', {}, 'allFlags');

    return completeFrom(p, 'dynamic', (bindings) => {
      const allFlags = bindings.allFlags as unknown[] as FeatureFlagRecord[];

      // Collect referenced flags
      const flags: FeatureFlagRecord[] = [];
      for (const flagId of flagIds) {
        const flag = allFlags.find(f => f.flagId === flagId);
        if (flag) flags.push(flag);
      }

      // Group by module_id
      const byModule = new Map<string, FeatureFlagRecord[]>();
      for (const flag of flags) {
        const existing = byModule.get(flag.module_id) || [];
        existing.push(flag);
        byModule.set(flag.module_id, existing);
      }

      const unified: string[] = [];

      for (const [moduleId, moduleFlags] of byModule) {
        // Check mutual exclusion within unification set
        for (let i = 0; i < moduleFlags.length; i++) {
          for (let j = i + 1; j < moduleFlags.length; j++) {
            const flagA = moduleFlags[i];
            const flagB = moduleFlags[j];

            if (
              flagA.mutually_exclusive_with.includes(flagB.name) ||
              flagB.mutually_exclusive_with.includes(flagA.name)
            ) {
              return {
                variant: 'conflict',
                module_id: moduleId,
                flag_a: flagA.name,
                flag_b: flagB.name,
              };
            }
          }
        }

        // Check against already-enabled flags not in the unification set
        const existingEnabled = allFlags.filter(
          (f) =>
            f.module_id === moduleId &&
            f.enabled &&
            !flagIds.includes(f.flagId),
        );

        for (const existing of existingEnabled) {
          for (const newFlag of moduleFlags) {
            if (
              existing.mutually_exclusive_with.includes(newFlag.name) ||
              newFlag.mutually_exclusive_with.includes(existing.name)
            ) {
              return {
                variant: 'conflict',
                module_id: moduleId,
                flag_a: existing.name,
                flag_b: newFlag.name,
              };
            }
          }
        }

        for (const flag of moduleFlags) {
          unified.push(flag.flagId);
        }
      }

      return { variant: 'ok', unified };
    }) as StorageProgram<Result>;
  },
};

export const featureFlagHandler = autoInterpret(_handler);
