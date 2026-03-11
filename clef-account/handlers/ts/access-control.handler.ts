import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const accessControlHandler: ConceptHandler = {
  async check(input: Record<string, unknown>, storage: ConceptStorage) {
    const resource = input.resource as string;
    const action = input.action as string;

    const policy = await storage.get('policy', `${resource}:${action}`);
    if (!policy) {
      return { variant: 'neutral' };
    }

    if (policy.effect === 'allow') {
      return { variant: 'allowed' };
    }

    return { variant: 'forbidden', reason: 'Denied by policy' };
  },

  async addPolicy(input: Record<string, unknown>, storage: ConceptStorage) {
    const resource = input.resource as string;
    const action = input.action as string;
    const effect = input.effect as string;
    const conditions = input.conditions as string;

    const key = `${resource}:${action}`;
    const existing = await storage.get('policy', key);
    if (existing) {
      return { variant: 'conflict', message: `Policy for ${key} already exists` };
    }

    await storage.put('policy', key, { resource, action, effect, conditions });
    return { variant: 'ok', policy: key };
  },

  async removePolicy(input: Record<string, unknown>, storage: ConceptStorage) {
    const policy = input.policy as string;

    const existing = await storage.get('policy', policy);
    if (!existing) {
      return { variant: 'notfound' };
    }

    await storage.del('policy', policy);
    return { variant: 'ok' };
  },
};
