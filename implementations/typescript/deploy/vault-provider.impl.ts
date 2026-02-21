// VaultProvider Concept Implementation
// HashiCorp Vault provider for the Secret coordination concept. Fetches
// secrets, manages lease renewals, and handles secret rotation.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'vault';

export const vaultProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const path = input.path as string;

    if (!path || path.trim() === '') {
      return { variant: 'pathNotFound', path: '' };
    }

    const leaseId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const leaseDuration = 3600;
    const value = `vault-secret-${path}`;

    await storage.put(RELATION, leaseId, {
      leaseId,
      path,
      value,
      leaseDuration,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + leaseDuration * 1000).toISOString(),
    });

    return { variant: 'ok', value, leaseId, leaseDuration };
  },

  async renewLease(input, storage) {
    const leaseId = input.leaseId as string;

    const record = await storage.get(RELATION, leaseId);
    if (!record) {
      return { variant: 'leaseExpired', leaseId };
    }

    const newDuration = 3600;
    await storage.put(RELATION, leaseId, {
      ...record,
      leaseDuration: newDuration,
      expiresAt: new Date(Date.now() + newDuration * 1000).toISOString(),
    });

    return { variant: 'ok', leaseId, newDuration };
  },

  async rotate(input, storage) {
    const path = input.path as string;

    // Find existing leases for this path and invalidate them
    const matches = await storage.find(RELATION, { path });
    for (const rec of matches) {
      await storage.del(RELATION, rec.leaseId as string);
    }

    const newVersion = Date.now();
    return { variant: 'ok', newVersion };
  },
};
