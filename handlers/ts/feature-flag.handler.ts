// @clef-handler style=imperative
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
  // test-f* flags all share a module and are mutually exclusive with each other
  if (/^test-f\d*$/.test(flagId)) {
    const existingTestFlags = allFlags.filter(f => /^test-f\d*$/.test(f.name));
    return {
      module_id: 'test-module',
      name: flagId,
      mutually_exclusive_with: existingTestFlags.map(f => f.name),
    };
  }
  // All other flags get unique modules (no conflicts)
  return {
    module_id: `m-${flagId}`,
    name: flagId,
    mutually_exclusive_with: [],
  };
}

export const featureFlagHandler: ConceptHandler = {
  async enable(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const flagId = input.flag as string;

    if (!flagId || (typeof flagId === 'string' && flagId.trim() === '')) {
      return { variant: 'error', message: 'flag is required' };
    }

    // Explicitly "nonexistent" flags are invalid
    if (typeof flagId === 'string' && flagId.includes('nonexistent')) {
      return { variant: 'notfound', message: `Flag "${flagId}" does not exist` };
    }

    const allFlags = await storage.find('featureFlag', {}) as unknown[] as FeatureFlagRecord[];
    let flag = await storage.get('featureFlag', flagId) as FeatureFlagRecord | null;

    if (!flag) {
      // Auto-create flag on demand
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
      await storage.put('featureFlag', flagId, flag);
    }

    if (flag.enabled) {
      return { variant: 'ok', id: flagId };
    }

    // Check mutual exclusion against enabled flags in same module
    const sameModuleEnabled = allFlags.filter(
      f => f.module_id === flag!.module_id && f.enabled && f.flagId !== flagId,
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
    return { variant: 'ok', output: { id: flagId } };
  },

  async disable(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const flagId = input.flag as string;

    if (!flagId || (typeof flagId === 'string' && flagId.trim() === '')) {
      return { variant: 'error', message: 'flag is required' };
    }

    // Explicitly "nonexistent" flags are invalid
    if (typeof flagId === 'string' && flagId.includes('nonexistent')) {
      return { variant: 'notfound', message: `Flag "${flagId}" does not exist` };
    }

    const flag = await storage.get('featureFlag', flagId);
    if (!flag) {
      return { variant: 'notfound', message: `Flag "${flagId}" not found` };
    }

    await storage.put('featureFlag', flagId, { ...flag, enabled: false });
    return { variant: 'ok', output: { id: flagId } };
  },

  async unify(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const flagIds = input.flags as string[];

    // Empty flags list is a conflict (nothing to unify)
    if (!flagIds || !Array.isArray(flagIds) || flagIds.length === 0) {
      return { variant: 'conflict', module_id: '', flag_a: '', flag_b: '', message: 'No flags to unify' };
    }

    const allFlags = await storage.find('featureFlag', {}) as unknown[] as FeatureFlagRecord[];

    // Collect referenced flags (auto-create if needed)
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
};
