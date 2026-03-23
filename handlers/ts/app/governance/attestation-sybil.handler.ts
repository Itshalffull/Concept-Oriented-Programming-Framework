// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// AttestationSybil Sybil Resistance Provider
// Credential-based sybil check: verifies candidate holds a valid attestation matching schema/attester/expiry.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _attestationSybilHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    if (!input.requiredSchema || (typeof input.requiredSchema === 'string' && (input.requiredSchema as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'requiredSchema is required' }) as StorageProgram<Result>;
    }
    const id = `att-sybil-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'att_sybil', id, {
      id,
      requiredSchema: input.requiredSchema,
      requiredAttester: input.requiredAttester ?? null,
    });

    p = put(p, 'plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'AttestationSybil',
      instanceId: id,
    });

    return complete(p, 'ok', { config: id }) as StorageProgram<Result>;
  },

  submitAttestation(input: Record<string, unknown>) {
    if (!input.candidate || (typeof input.candidate === 'string' && (input.candidate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'candidate is required' }) as StorageProgram<Result>;
    }
    const { config, candidate, attestationRef, schema, attester, expiresAt } = input;
    const key = `${config}:${candidate}`;
    let p = createProgram();
    p = put(p, 'att_sybil_credential', key, {
      config,
      candidate,
      attestationRef,
      schema,
      attester,
      expiresAt: expiresAt ?? null,
      submittedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { candidate, attestationRef }) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    if (!input.config || (typeof input.config === 'string' && (input.config as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }
    const { config, candidate } = input;
    let p = createProgram();
    p = get(p, 'att_sybil', config as string, 'cfg');

    return branch(p, 'cfg',
      (thenP) => {
        const key = `${config}:${candidate}`;
        thenP = get(thenP, 'att_sybil_credential', key, 'credential');

        return branch(thenP, 'credential',
          (credP) => {
            return completeFrom(credP, 'verified', (bindings) => {
              const cfg = bindings.cfg as Record<string, unknown>;
              const credential = bindings.credential as Record<string, unknown>;

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
            });
          },
          (noCred) => complete(noCred, 'no_attestation', { candidate }),
        );
      },
      (elseP) => complete(elseP, 'not_found', { config }),
    ) as StorageProgram<Result>;
  },
};

export const attestationSybilHandler = autoInterpret(_attestationSybilHandler);
