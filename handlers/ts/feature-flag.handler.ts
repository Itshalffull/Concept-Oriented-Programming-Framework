// FeatureFlag Concept Implementation
// Additive compile-time feature toggles for modules. Each feature flag gates
// additional dependencies and capabilities, unified across the dependency
// graph using set union with mutual-exclusion constraint enforcement.
import type { ConceptHandler } from '@clef/runtime';

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
  async enable(input, storage) {
    const flagId = input.flag as string;

    const flag = await storage.get('featureFlag', flagId);
    if (!flag) {
      return { variant: 'notfound' };
    }

    const record = flag as unknown as FeatureFlagRecord;

    // Already enabled is a no-op success
    if (record.enabled) {
      return { variant: 'ok' };
    }

    // Check mutual exclusion constraints
    if (record.mutually_exclusive_with && record.mutually_exclusive_with.length > 0) {
      const allFlags = await storage.find('featureFlag');
      for (const other of allFlags) {
        const otherRecord = other as unknown as FeatureFlagRecord;
        if (
          otherRecord.module_id === record.module_id &&
          otherRecord.enabled &&
          record.mutually_exclusive_with.includes(otherRecord.name)
        ) {
          return { variant: 'conflict', conflicting_flag: otherRecord.name };
        }
      }
    }

    await storage.put('featureFlag', flagId, {
      ...flag,
      enabled: true,
    });

    return { variant: 'ok' };
  },

  async disable(input, storage) {
    const flagId = input.flag as string;

    const flag = await storage.get('featureFlag', flagId);
    if (!flag) {
      return { variant: 'notfound' };
    }

    await storage.put('featureFlag', flagId, {
      ...flag,
      enabled: false,
    });

    return { variant: 'ok' };
  },

  async unify(input, storage) {
    const flagIds = input.flags as string[];

    // Collect all referenced flags
    const flags: FeatureFlagRecord[] = [];
    for (const flagId of flagIds) {
      const flag = await storage.get('featureFlag', flagId);
      if (flag) {
        flags.push(flag as unknown as FeatureFlagRecord);
      }
    }

    // Group flags by module_id for mutual exclusion checking
    const byModule = new Map<string, FeatureFlagRecord[]>();
    for (const flag of flags) {
      const existing = byModule.get(flag.module_id) || [];
      existing.push(flag);
      byModule.set(flag.module_id, existing);
    }

    // Set union: enable all referenced flags, but check mutual exclusion
    const unified: string[] = [];

    for (const [moduleId, moduleFlags] of byModule) {
      // Collect the names of all flags being enabled for this module
      const enabledNames = moduleFlags.map((f) => f.name);

      // Check mutual exclusion: for each pair of flags being enabled,
      // verify they are not mutually exclusive
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

      // Also check against already-enabled flags for this module that are not in the unification set
      const allFlags = await storage.find('featureFlag');
      const existingEnabled = allFlags.filter(
        (f) =>
          (f as unknown as FeatureFlagRecord).module_id === moduleId &&
          (f as unknown as FeatureFlagRecord).enabled &&
          !flagIds.includes((f as unknown as FeatureFlagRecord).flagId),
      );

      for (const existing of existingEnabled) {
        const existingRecord = existing as unknown as FeatureFlagRecord;
        for (const newFlag of moduleFlags) {
          if (
            existingRecord.mutually_exclusive_with.includes(newFlag.name) ||
            newFlag.mutually_exclusive_with.includes(existingRecord.name)
          ) {
            return {
              variant: 'conflict',
              module_id: moduleId,
              flag_a: existingRecord.name,
              flag_b: newFlag.name,
            };
          }
        }
      }

      // Enable all flags in the unification set for this module
      for (const flag of moduleFlags) {
        await storage.put('featureFlag', flag.flagId, {
          ...(flag as unknown as Record<string, unknown>),
          enabled: true,
        });
        unified.push(flag.flagId);
      }
    }

    return { variant: 'ok', unified };
  },
};
