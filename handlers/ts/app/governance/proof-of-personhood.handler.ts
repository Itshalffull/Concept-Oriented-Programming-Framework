// ProofOfPersonhood Sybil Resistance Provider
// Verification lifecycle with status tracking, expiry, and revocation.
import type { ConceptHandler } from '@clef/runtime';

export const proofOfPersonhoodHandler: ConceptHandler = {
  async requestVerification(input, storage) {
    const id = `pop-${Date.now()}`;
    const expiresAt = input.expiryDays
      ? new Date(Date.now() + (input.expiryDays as number) * 86400000).toISOString()
      : null;

    await storage.put('pop', id, {
      id,
      candidate: input.candidate,
      method: input.method,
      status: 'Pending',
      expiresAt,
      requestedAt: new Date().toISOString(),
    });

    await storage.put('plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'ProofOfPersonhood',
      instanceId: id,
    });

    return { variant: 'verification_requested', verification: id };
  },

  async confirmVerification(input, storage) {
    const { verification } = input;
    const record = await storage.get('pop', verification as string);
    if (!record) return { variant: 'not_found', verification };
    if (record.status === 'Verified') return { variant: 'already_verified', verification };

    await storage.put('pop', verification as string, {
      ...record,
      status: 'Verified',
      confirmedAt: new Date().toISOString(),
    });
    return { variant: 'verified', verification, candidate: record.candidate };
  },

  async rejectVerification(input, storage) {
    const { verification, reason } = input;
    const record = await storage.get('pop', verification as string);
    if (!record) return { variant: 'not_found', verification };

    await storage.put('pop', verification as string, {
      ...record,
      status: 'Rejected',
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
    });
    return { variant: 'rejected', verification, reason };
  },

  async checkStatus(input, storage) {
    const { verification } = input;
    const record = await storage.get('pop', verification as string);
    if (!record) return { variant: 'not_found', verification };

    // Check for expiry
    if (record.expiresAt && record.status === 'Verified') {
      if (new Date() > new Date(record.expiresAt as string)) {
        await storage.put('pop', verification as string, { ...record, status: 'Expired' });
        return { variant: 'expired', verification, candidate: record.candidate };
      }
    }

    return { variant: record.status as string, verification, candidate: record.candidate };
  },
};
