// Secret Concept Implementation (Deploy Kit)
// Coordinate secret resolution across vault and secret manager providers.
import type { ConceptHandler } from '@clef/kernel';
import { createHash, randomBytes } from 'crypto';

export const secretHandler: ConceptHandler = {
  async resolve(input, storage) {
    const name = input.name as string;
    const provider = input.provider as string;

    const secretKey = `${provider}:${name}`;
    const existing = await storage.get('secret', secretKey);

    if (!existing) {
      return { variant: 'notFound', name, provider };
    }

    // Check if expired
    const expiresAt = existing.expiresAt as string | null;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return { variant: 'expired', name, expiresAt };
    }

    const now = new Date().toISOString();

    // Record access in audit log
    const audit: Array<{ accessedAt: string; accessedBy: string }> =
      existing.audit ? JSON.parse(existing.audit as string) : [];
    audit.push({ accessedAt: now, accessedBy: 'system' });

    await storage.put('secret', secretKey, {
      ...existing,
      cachedAt: now,
      audit: JSON.stringify(audit),
    });

    return {
      variant: 'ok',
      secret: secretKey,
      version: existing.version as string,
    };
  },

  async exists(input, storage) {
    const name = input.name as string;
    const provider = input.provider as string;

    const secretKey = `${provider}:${name}`;
    const existing = await storage.get('secret', secretKey);

    return { variant: 'ok', name, exists: !!existing };
  },

  async rotate(input, storage) {
    const name = input.name as string;
    const provider = input.provider as string;

    const secretKey = `${provider}:${name}`;
    const existing = await storage.get('secret', secretKey);

    if (!existing) {
      return { variant: 'rotationUnsupported', name, provider };
    }

    // Generate new version
    const newVersion = `v${Date.now()}`;
    const now = new Date().toISOString();

    // Generate a new encrypted value representation
    const newValueHash = createHash('sha256')
      .update(randomBytes(32))
      .digest('hex');

    await storage.put('secret', secretKey, {
      ...existing,
      version: newVersion,
      cachedAt: null,
      valueHash: newValueHash,
      rotatedAt: now,
    });

    return { variant: 'ok', secret: secretKey, newVersion };
  },

  async invalidateCache(input, storage) {
    const name = input.name as string;

    // Find all secrets matching this name across providers
    const allSecrets = await storage.find('secret');
    let found = false;
    let matchedKey = '';

    for (const secret of allSecrets) {
      const secretName = secret.name as string;
      if (secretName === name) {
        found = true;
        matchedKey = `${secret.provider as string}:${name}`;
        await storage.put('secret', matchedKey, {
          ...secret,
          cachedAt: null,
        });
      }
    }

    if (!found) {
      // Still return ok - cache invalidation is idempotent
      return { variant: 'ok', secret: name };
    }

    return { variant: 'ok', secret: matchedKey };
  },
};
