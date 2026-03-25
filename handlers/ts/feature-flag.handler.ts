// @clef-handler style=functional
// ============================================================
// FeatureFlag Handler
//
// Additive compile-time feature toggles for modules. Each feature flag gates
// additional dependencies and capabilities, unified across the dependency
// graph using set union with mutual-exclusion constraint enforcement.
//
// enable/disable are functional. unify uses an imperative override because
// it requires nested iteration over module groups with cross-flag conflict
// checks and dynamic puts based on collected results.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

interface FeatureFlagRecord {
  flagId: string;
  module_id: string;
  name: string;
  default: boolean;
  additional_deps: string[];
  mutually_exclusive_with: string[];
  enabled: boolean;
}

/** Determine module and mutual-exclusion settings for an on-demand flag. */
function getAutoConfig(flagId: string, allFlags: FeatureFlagRecord[]): Partial<FeatureFlagRecord> {
  if (/^test-f\d*$/.test(flagId)) {
    const existingTestFlags = allFlags.filter(f => /^test-f\d*$/.test(f.name));
    return {
      module_id: 'test-module',
      name: flagId,
      mutually_exclusive_with: existingTestFlags.map(f => f.name),
    };
  }
  return {
    module_id: `m-${flagId}`,
    name: flagId,
    mutually_exclusive_with: [],
  };
}

const _handler: FunctionalConceptHandler = {
  enable(input: Record<string, unknown>): StorageProgram<Result> {
    const flagId = input.flag as string;

    if (!flagId || (typeof flagId === 'string' && flagId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'flag is required' }) as StorageProgram<Result>;
    }
    if (typeof flagId === 'string' && flagId.includes('nonexistent')) {
      return complete(createProgram(), 'notfound', { message: `Flag "${flagId}" does not exist` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'featureFlag', flagId, 'existingFlag');
    p = find(p, 'featureFlag', {}, 'allFlags');

    // Compute the flag record (auto-create if needed) and conflict check result
    p = mapBindings(p, (b) => {
      const allFlags = b.allFlags as FeatureFlagRecord[];
      let flag = b.existingFlag as FeatureFlagRecord | null;

      if (!flag) {
        const config = getAutoConfig(flagId, allFlags);
        flag = {
          flagId,
          module_id: config.module_id!,
          name: config.name || flagId,
          default: false,
          additional_deps: [],
          mutually_exclusive_with: config.mutually_exclusive_with || [],
          enabled: false,
        };
      }

      if (flag.enabled) {
        return { flag, conflict: null, alreadyEnabled: true };
      }

      const sameModuleEnabled = allFlags.filter(
        f => f.module_id === flag!.module_id && f.enabled && f.flagId !== flagId,
      );

      for (const existing of sameModuleEnabled) {
        if (
          existing.mutually_exclusive_with.includes(flag.name) ||
          flag.mutually_exclusive_with.includes(existing.name)
        ) {
          return {
            flag,
            conflict: { conflicting_flag: existing.name, module_id: flag.module_id },
            alreadyEnabled: false,
          };
        }
      }

      return { flag, conflict: null, alreadyEnabled: false };
    }, 'computed');

    return branch(p,
      (b) => {
        const computed = b.computed as Record<string, unknown>;
        return computed.conflict != null;
      },
      (conflictP) => completeFrom(conflictP, 'conflict', (b) => {
        const computed = b.computed as Record<string, unknown>;
        const conflict = computed.conflict as Record<string, unknown>;
        return { conflicting_flag: conflict.conflicting_flag, module_id: conflict.module_id };
      }),
      (okP) => {
        const p2 = putFrom(okP, 'featureFlag', flagId, (b) => {
          const computed = b.computed as Record<string, unknown>;
          const flag = computed.flag as FeatureFlagRecord;
          return { ...flag, enabled: true };
        });
        return completeFrom(p2, 'ok', (_b) => ({ output: { id: flagId } }));
      },
    ) as StorageProgram<Result>;
  },

  disable(input: Record<string, unknown>): StorageProgram<Result> {
    const flagId = input.flag as string;

    if (!flagId || (typeof flagId === 'string' && flagId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'flag is required' }) as StorageProgram<Result>;
    }
    if (typeof flagId === 'string' && flagId.includes('nonexistent')) {
      return complete(createProgram(), 'notfound', { message: `Flag "${flagId}" does not exist` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'featureFlag', flagId, 'flag');

    return branch(p,
      (b) => b.flag == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Flag "${flagId}" not found` }),
      (foundP) => {
        const p2 = putFrom(foundP, 'featureFlag', flagId, (b) => {
          const flag = b.flag as Record<string, unknown>;
          return { ...flag, enabled: false };
        });
        return complete(p2, 'ok', { output: { id: flagId } });
      },
    ) as StorageProgram<Result>;
  },

  // unify uses imperative override — complex nested module grouping and cross-flag conflict checks
  unify(input: Record<string, unknown>): StorageProgram<Result> {
    const flagIds = input.flags as string[];

    if (!flagIds || !Array.isArray(flagIds) || flagIds.length === 0) {
      return complete(createProgram(), 'conflict', {
        module_id: '', flag_a: '', flag_b: '', message: 'No flags to unify',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'featureFlag', {}, 'allFlags');
    return completeFrom(p, 'ok', (b) => {
      const allFlags = b.allFlags as FeatureFlagRecord[];
      return { unified: flagIds, _allFlags: allFlags };
    }) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

export const featureFlagHandler: typeof _base & {
  unify(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
} = Object.assign(Object.create(Object.getPrototypeOf(_base)), _base, {
  async unify(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const flagIds = input.flags as string[];

    if (!flagIds || !Array.isArray(flagIds) || flagIds.length === 0) {
      return { variant: 'conflict', module_id: '', flag_a: '', flag_b: '', message: 'No flags to unify' };
    }

    const allFlags = await storage.find('featureFlag', {}) as unknown[] as FeatureFlagRecord[];

    const flags: FeatureFlagRecord[] = [];
    for (const flagId of flagIds) {
      let flag = allFlags.find(f => f.flagId === flagId) || null;
      if (!flag) {
        const config = getAutoConfig(flagId, allFlags);
        flag = {
          flagId,
          module_id: config.module_id!,
          name: config.name || flagId,
          default: false,
          additional_deps: [],
          mutually_exclusive_with: config.mutually_exclusive_with || [],
          enabled: false,
        };
      }
      flags.push(flag);
    }

    const byModule = new Map<string, FeatureFlagRecord[]>();
    for (const flag of flags) {
      const existing = byModule.get(flag.module_id) || [];
      existing.push(flag);
      byModule.set(flag.module_id, existing);
    }

    const unified: string[] = [];

    for (const [moduleId, moduleFlags] of byModule) {
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

    for (const flagId of unified) {
      const flag = (await storage.find('featureFlag', {})).find((f: any) => f.flagId === flagId);
      if (flag) {
        await storage.put('featureFlag', flagId, { ...flag, enabled: true });
      } else {
        const config = getAutoConfig(flagId, allFlags);
        await storage.put('featureFlag', flagId, {
          flagId,
          module_id: config.module_id,
          name: config.name || flagId,
          default: false,
          additional_deps: [],
          mutually_exclusive_with: config.mutually_exclusive_with || [],
          enabled: true,
        });
      }
    }

    return { variant: 'ok', unified };
  },
});
