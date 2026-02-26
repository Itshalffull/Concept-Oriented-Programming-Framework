// Secret Concept Implementation
// Coordination concept for secret management. Resolves secrets through
// provider backends, caches results, and tracks rotation/audit history.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'secret';

export const secretHandler: ConceptHandler = {
  async resolve(input, storage) {
    const name = input.name as string;
    const provider = input.provider as string;

    // Check cache first
    const cached = await storage.find(RELATION, { name, provider });
    if (cached.length > 0) {
      const rec = cached[0];
      return {
        variant: 'ok',
        secret: rec.secret as string,
        version: rec.version as string,
      };
    }

    const secretId = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const version = `v${Date.now()}`;

    await storage.put(RELATION, secretId, {
      secret: secretId,
      name,
      provider,
      version,
      resolvedAt: new Date().toISOString(),
      audit: JSON.stringify([{ action: 'resolve', timestamp: new Date().toISOString() }]),
    });

    return { variant: 'ok', secret: secretId, version };
  },

  async exists(input, storage) {
    const name = input.name as string;
    const provider = input.provider as string;

    const matches = await storage.find(RELATION, { name, provider });
    return { variant: 'ok', name, exists: matches.length > 0 };
  },

  async rotate(input, storage) {
    const name = input.name as string;
    const provider = input.provider as string;

    const matches = await storage.find(RELATION, { name, provider });
    if (matches.length === 0) {
      // Resolve first, then rotate
      const secretId = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newVersion = `v${Date.now()}`;

      await storage.put(RELATION, secretId, {
        secret: secretId,
        name,
        provider,
        version: newVersion,
        resolvedAt: new Date().toISOString(),
        audit: JSON.stringify([{ action: 'rotate', timestamp: new Date().toISOString() }]),
      });

      return { variant: 'ok', secret: secretId, newVersion };
    }

    const record = matches[0];
    const newVersion = `v${Date.now()}`;
    const audit: Array<{ action: string; timestamp: string }> = JSON.parse(record.audit as string || '[]');
    audit.push({ action: 'rotate', timestamp: new Date().toISOString() });

    await storage.put(RELATION, record.secret as string, {
      ...record,
      version: newVersion,
      resolvedAt: new Date().toISOString(),
      audit: JSON.stringify(audit),
    });

    return { variant: 'ok', secret: record.secret as string, newVersion };
  },

  async invalidateCache(input, storage) {
    const name = input.name as string;

    const matches = await storage.find(RELATION, { name });
    for (const rec of matches) {
      await storage.del(RELATION, rec.secret as string);
    }

    const secretId = matches.length > 0 ? (matches[0].secret as string) : name;
    return { variant: 'ok', secret: secretId };
  },
};
