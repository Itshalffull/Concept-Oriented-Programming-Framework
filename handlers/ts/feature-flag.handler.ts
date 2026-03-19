// @migrated dsl-constructs 2026-03-18
// ============================================================
// FeatureFlag Handler
//
// Additive compile-time feature toggles for modules. Each feature flag gates
// additional dependencies and capabilities, unified across the dependency
// graph using set union with mutual-exclusion constraint enforcement.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

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

export const featureFlagHandler: ConceptHandler = {
  async enable(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const flagId = input.flag as string;

    const flag = await storage.get('featureFlag', flagId) as FeatureFlagRecord | null;
    if (!flag) {
      return { variant: 'notfound' };
    }

    if (flag.enabled) {
      return { variant: 'ok' };
    }

    // Check mutual exclusion against all flags in the same module
    const allFlags = await storage.find('featureFlag', {}) as unknown[] as FeatureFlagRecord[];
    const sameModuleEnabled = allFlags.filter(
      f => f.module_id === flag.module_id && f.enabled && f.flagId !== flagId,
    );

    for (const existing of sameModuleEnabled) {
      if (
        existing.mutually_exclusive_with.includes(flag.name) ||
        flag.mutually_exclusive_with.includes(existing.name)
      ) {
        return { variant: 'conflict', conflicting_flag: existing.name, module_id: flag.module_id };
      }
    }

    await storage.put('featureFlag', flagId, { ...flag, enabled: true });
    return { variant: 'ok' };
  },

  async disable(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const flagId = input.flag as string;

    const flag = await storage.get('featureFlag', flagId);
    if (!flag) {
      return { variant: 'notfound' };
    }

    await storage.put('featureFlag', flagId, { ...flag, enabled: false });
    return { variant: 'ok' };
  },

  async unify(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const flagIds = input.flags as string[];

    const allFlags = await storage.find('featureFlag', {}) as unknown[] as FeatureFlagRecord[];

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

    // Enable all unified flags
    for (const flagId of unified) {
      const flag = allFlags.find(f => f.flagId === flagId);
      if (flag) {
        await storage.put('featureFlag', flagId, { ...flag, enabled: true });
      }
    }

    return { variant: 'ok', unified };
  },
};
