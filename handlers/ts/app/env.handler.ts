// Env Concept Implementation (Deploy Kit)
// Manage deployment environments with composable configuration.
import type { ConceptHandler } from '@clef/runtime';

export const envHandler: ConceptHandler = {
  async resolve(input, storage) {
    const environment = input.environment as string;

    const existing = await storage.get('environment', environment);
    if (!existing) {
      return { variant: 'missingBase', environment };
    }

    // Resolve base environment chain
    let resolved: Record<string, unknown> = {};
    const baseEnvId = existing.base as string | null;

    if (baseEnvId) {
      const baseEnv = await storage.get('environment', baseEnvId);
      if (!baseEnv) {
        return { variant: 'missingBase', environment };
      }
      // Start with base config
      const baseOverrides = baseEnv.overrides as string;
      try {
        resolved = JSON.parse(baseOverrides);
      } catch {
        resolved = {};
      }
    }

    // Apply current environment overrides
    const overrides = existing.overrides as string;
    let currentOverrides: Record<string, unknown> = {};
    try {
      currentOverrides = JSON.parse(overrides);
    } catch {
      currentOverrides = {};
    }

    // Merge: current overrides take precedence over base
    resolved = { ...resolved, ...currentOverrides };

    // Include kit versions and secret references
    resolved.kitVersions = existing.kitVersions ? JSON.parse(existing.kitVersions as string) : [];
    resolved.secrets = existing.secrets ? JSON.parse(existing.secrets as string) : [];

    return {
      variant: 'ok',
      environment,
      resolved: JSON.stringify(resolved),
    };
  },

  async promote(input, storage) {
    const fromEnv = input.fromEnv as string;
    const toEnv = input.toEnv as string;
    const suiteName = input.suiteName as string;

    const sourceEnv = await storage.get('environment', fromEnv);
    if (!sourceEnv) {
      return { variant: 'notValidated', fromEnv, suiteName };
    }

    const targetEnv = await storage.get('environment', toEnv);
    if (!targetEnv) {
      return { variant: 'versionMismatch', fromEnv, toEnv, details: 'Target environment not found' };
    }

    // Find the suite version in source environment
    const sourceKitVersions: Array<{ kit: string; version: string }> =
      sourceEnv.kitVersions ? JSON.parse(sourceEnv.kitVersions as string) : [];
    const kitEntry = sourceKitVersions.find(k => k.kit === suiteName);

    if (!kitEntry) {
      return { variant: 'notValidated', fromEnv, suiteName };
    }

    // Update target environment's kit versions
    const targetKitVersions: Array<{ kit: string; version: string }> =
      targetEnv.kitVersions ? JSON.parse(targetEnv.kitVersions as string) : [];
    const existingIndex = targetKitVersions.findIndex(k => k.kit === suiteName);

    if (existingIndex >= 0) {
      targetKitVersions[existingIndex].version = kitEntry.version;
    } else {
      targetKitVersions.push({ kit: suiteName, version: kitEntry.version });
    }

    const now = new Date().toISOString();

    await storage.put('environment', toEnv, {
      ...targetEnv,
      kitVersions: JSON.stringify(targetKitVersions),
      lastPromotedAt: now,
      promotedFrom: fromEnv,
      promotedBy: 'system',
    });

    return { variant: 'ok', toEnv, version: kitEntry.version };
  },

  async diff(input, storage) {
    const envA = input.envA as string;
    const envB = input.envB as string;

    const envARecord = await storage.get('environment', envA);
    const envBRecord = await storage.get('environment', envB);

    const configA: Record<string, unknown> = envARecord && envARecord.overrides
      ? JSON.parse(envARecord.overrides as string)
      : {};
    const configB: Record<string, unknown> = envBRecord && envBRecord.overrides
      ? JSON.parse(envBRecord.overrides as string)
      : {};

    const allKeys = new Set([...Object.keys(configA), ...Object.keys(configB)]);
    const differences: string[] = [];

    for (const key of allKeys) {
      const valA = JSON.stringify(configA[key]);
      const valB = JSON.stringify(configB[key]);
      if (valA !== valB) {
        if (!(key in configA)) {
          differences.push(`+${key}: ${valB} (only in ${envB})`);
        } else if (!(key in configB)) {
          differences.push(`-${key}: ${valA} (only in ${envA})`);
        } else {
          differences.push(`~${key}: ${valA} -> ${valB}`);
        }
      }
    }

    return { variant: 'ok', differences: JSON.stringify(differences) };
  },
};
