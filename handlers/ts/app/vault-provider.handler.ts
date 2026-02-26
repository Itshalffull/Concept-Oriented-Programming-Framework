// VaultProvider Concept Implementation
// Manage secret resolution from HashiCorp Vault. Owns Vault connection state,
// lease tracking, token renewal, and seal status monitoring.
import type { ConceptHandler } from '@clef/runtime';

export const vaultProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const path = input.path as string;

    // Check vault health state
    const healthRecord = await storage.get('connection', 'vault-health');
    if (healthRecord) {
      if (healthRecord.sealed === true) {
        return {
          variant: 'sealed',
          address: healthRecord.address as string,
        };
      }
      if (healthRecord.tokenExpired === true) {
        return {
          variant: 'tokenExpired',
          address: healthRecord.address as string,
        };
      }
    }

    // Check for existing secret
    const secretRecord = await storage.get('connection', path);
    if (!secretRecord) {
      // Simulate first access; create a new secret
      if (path.includes('nonexistent') || path.includes('missing')) {
        return {
          variant: 'pathNotFound',
          path,
        };
      }

      const leaseId = `lease-${Date.now()}`;
      const leaseDuration = 3600;
      const value = `vault-secret-for-${path.split('/').pop()}`;

      await storage.put('connection', path, {
        address: 'http://127.0.0.1:8200',
        authMethod: 'token',
        mountPath: 'secret',
        leaseId,
        leaseDuration,
        renewable: true,
        sealed: false,
        lastCheckedAt: new Date().toISOString(),
        value,
        currentVersion: 1,
      });

      return {
        variant: 'ok',
        value,
        leaseId,
        leaseDuration,
      };
    }

    return {
      variant: 'ok',
      value: secretRecord.value as string,
      leaseId: secretRecord.leaseId as string,
      leaseDuration: secretRecord.leaseDuration as number,
    };
  },

  async renewLease(input, storage) {
    const leaseId = input.leaseId as string;

    // Search for the connection record with this leaseId
    const allConnections = await storage.find('connection');
    let foundRecord = null;
    let foundKey = '';

    for (const record of allConnections) {
      if ((record.leaseId as string) === leaseId) {
        foundRecord = record;
        foundKey = record.address ? leaseId : '';
        break;
      }
    }

    if (!foundRecord) {
      return {
        variant: 'leaseExpired',
        leaseId,
      };
    }

    if (foundRecord.renewable !== true) {
      return {
        variant: 'leaseExpired',
        leaseId,
      };
    }

    const newDuration = foundRecord.leaseDuration as number;

    return {
      variant: 'ok',
      leaseId,
      newDuration,
    };
  },

  async rotate(input, storage) {
    const path = input.path as string;

    const record = await storage.get('connection', path);
    const currentVersion = record ? (record.currentVersion as number) : 0;
    const newVersion = currentVersion + 1;

    if (record) {
      await storage.put('connection', path, {
        ...record,
        currentVersion: newVersion,
        value: `vault-rotated-secret-v${newVersion}`,
        lastCheckedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      newVersion,
    };
  },
};
