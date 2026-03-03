// Attestation Concept Handler
// Verifiable claims about participants' attributes, credentials, or identity.
import type { ConceptHandler } from '@clef/runtime';

export const attestationHandler: ConceptHandler = {
  async attest(input, storage) {
    const id = `attest-${Date.now()}`;
    await storage.put('attestation', id, {
      id, schema: input.schema, attester: input.attester,
      recipient: input.recipient, data: input.data,
      createdAt: new Date().toISOString(), expiry: input.expiry ?? null, revoked: false,
    });
    return { variant: 'created', attestation: id };
  },

  async revoke(input, storage) {
    const { attestation, revoker } = input;
    const record = await storage.get('attestation', attestation as string);
    if (!record) return { variant: 'not_found', attestation };
    if (record.attester !== revoker) return { variant: 'unauthorized', revoker };
    await storage.put('attestation', attestation as string, { ...record, revoked: true });
    return { variant: 'revoked', attestation };
  },

  async verify(input, storage) {
    const { attestation } = input;
    const record = await storage.get('attestation', attestation as string);
    if (!record) return { variant: 'not_found', attestation };
    if (record.revoked) return { variant: 'revoked_status', attestation };
    if (record.expiry && new Date(record.expiry as string) < new Date()) return { variant: 'expired', attestation };
    return { variant: 'valid', attestation };
  },
};
