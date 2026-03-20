// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// GcpSmProvider Concept Implementation
// Google Cloud Secret Manager provider for the Secret coordination concept.
// Fetches secret versions and handles rotation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'gcpsm';

const _gcpSmProviderHandler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const secretId = input.secretId as string;
    const version = input.version as string;

    if (!secretId || secretId.trim() === '') {
      const p = createProgram();
      return complete(p, 'secretNotFound', { secretId: '', projectId: 'unknown' }) as StorageProgram<Result>;
    }

    const versionId = version === 'latest' ? `v${Date.now()}` : version;
    const projectId = 'gcp-project-1';
    const value = `gcp-secret-${secretId}`;

    let p = createProgram();
    p = put(p, RELATION, secretId, {
      secretId,
      version: versionId,
      projectId,
      value,
      accessedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { value, versionId, projectId }) as StorageProgram<Result>;
  },

  rotate(input: Record<string, unknown>) {
    const secretId = input.secretId as string;

    const newVersionId = `v${Date.now()}`;

    let p = createProgram();
    p = get(p, RELATION, secretId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, secretId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            version: newVersionId,
            rotatedAt: new Date().toISOString(),
          };
        });
        return complete(thenP, 'ok', { secretId, newVersionId });
      },
      (elseP) => complete(elseP, 'ok', { secretId, newVersionId }),
    ) as StorageProgram<Result>;
  },
};

export const gcpSmProviderHandler = autoInterpret(_gcpSmProviderHandler);
