// Permission Concept Handler
// (who, where, what) grant model with optional conditions.
import type { ConceptHandler } from '@clef/runtime';

export const permissionHandler: ConceptHandler = {
  async grant(input, storage) {
    const { who, where, what, condition, grantedBy } = input;
    const key = `${who}:${where}:${what}`;
    const existing = await storage.get('grant', key);
    if (existing) return { variant: 'already_granted', permission: key };
    await storage.put('grant', key, { who, where, what, condition, grantedBy, grantedAt: new Date().toISOString(), granted: true });
    return { variant: 'granted', permission: key };
  },

  async revoke(input, storage) {
    const { permission } = input;
    const record = await storage.get('grant', permission as string);
    if (!record) return { variant: 'not_found', permission };
    await storage.del('grant', permission as string);
    return { variant: 'revoked', permission };
  },

  async check(input, storage) {
    const { who, where, what } = input;
    const key = `${who}:${where}:${what}`;
    const record = await storage.get('grant', key);
    if (record) return { variant: 'allowed', permission: key };
    return { variant: 'denied', who, where, what };
  },
};
