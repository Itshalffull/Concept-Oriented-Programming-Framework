// AttestationSybil Sybil Resistance Provider
// Credential-based sybil check: verifies candidate holds a valid attestation matching schema/attester/expiry.
import type { ConceptHandler } from '@clef/runtime';

export const attestationSybilHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `att-sybil-${Date.now()}`;
    await storage.put('att_sybil', id, {
      id,
      requiredSchema: input.requiredSchema,
      requiredAttester: input.requiredAttester ?? null,
    });

    await storage.put('plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'AttestationSybil',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async submitAttestation(input, storage) {
    const { config, candidate, attestationRef, schema, attester, expiresAt } = input;
    const key = `${config}:${candidate}`;
    await storage.put('att_sybil_credential', key, {
      config,
      candidate,
      attestationRef,
      schema,
      attester,
      expiresAt: expiresAt ?? null,
      submittedAt: new Date().toISOString(),
    });
    return { variant: 'submitted', candidate, attestationRef };
  },

  async verify(input, storage) {
    const { config, candidate } = input;
    const cfg = await storage.get('att_sybil', config as string);
    if (!cfg) return { variant: 'not_found', config };

    const key = `${config}:${candidate}`;
    const credential = await storage.get('att_sybil_credential', key);
    if (!credential) return { variant: 'no_attestation', candidate };

    // Check schema match
    if (cfg.requiredSchema && credential.schema !== cfg.requiredSchema) {
      return { variant: 'schema_mismatch', candidate, expected: cfg.requiredSchema, actual: credential.schema };
    }

    // Check attester match
    if (cfg.requiredAttester && credential.attester !== cfg.requiredAttester) {
      return { variant: 'attester_mismatch', candidate, expected: cfg.requiredAttester, actual: credential.attester };
    }

    // Check expiry
    if (credential.expiresAt && new Date() > new Date(credential.expiresAt as string)) {
      return { variant: 'expired', candidate, expiresAt: credential.expiresAt };
    }

    return { variant: 'verified', candidate, attestationRef: credential.attestationRef };
  },
};
