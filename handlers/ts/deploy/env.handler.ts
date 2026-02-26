// Env Concept Implementation
// Environment management for deployment targets. Resolves environment
// configurations, handles promotion pipelines, and computes diffs.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'env';

export const envHandler: ConceptHandler = {
  async resolve(input, storage) {
    const environment = input.environment as string;

    if (!environment || environment.trim() === '') {
      return { variant: 'missingBase', environment };
    }

    const envId = `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resolved = JSON.stringify({
      name: environment,
      region: 'us-east-1',
      tier: environment === 'production' ? 'production' : 'preview',
    });

    await storage.put(RELATION, envId, {
      environment: envId,
      name: environment,
      resolved,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', environment: envId, resolved };
  },

  async promote(input, storage) {
    const fromEnv = input.fromEnv as string;
    const toEnv = input.toEnv as string;
    const suiteName = input.suiteName as string;

    const fromRecord = await storage.get(RELATION, fromEnv);
    if (!fromRecord) {
      return { variant: 'notValidated', fromEnv, suiteName };
    }

    const version = `${suiteName}@${Date.now()}`;

    const toId = toEnv || `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put(RELATION, toId, {
      environment: toId,
      name: toEnv,
      resolved: fromRecord.resolved,
      promotedFrom: fromEnv,
      promotedVersion: version,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', toEnv: toId, version };
  },

  async diff(input, storage) {
    const envA = input.envA as string;
    const envB = input.envB as string;

    const recordA = await storage.get(RELATION, envA);
    const recordB = await storage.get(RELATION, envB);

    const differences: string[] = [];
    if (recordA && recordB) {
      const resolvedA = recordA.resolved as string;
      const resolvedB = recordB.resolved as string;
      if (resolvedA !== resolvedB) {
        differences.push(`config differs between ${envA} and ${envB}`);
      }
    } else {
      if (!recordA) differences.push(`${envA} not found`);
      if (!recordB) differences.push(`${envB} not found`);
    }

    return { variant: 'ok', differences };
  },
};
