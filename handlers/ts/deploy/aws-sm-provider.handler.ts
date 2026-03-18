// @migrated dsl-constructs 2026-03-18
// AwsSmProvider Concept Implementation
// AWS Secrets Manager provider for the Secret coordination concept. Fetches
// secret values by ID and version stage, and triggers rotation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'awssm';

const _awsSmProviderHandler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const secretId = input.secretId as string;
    const versionStage = input.versionStage as string;

    if (!secretId || secretId.trim() === '') {
      const p = createProgram();
      return complete(p, 'resourceNotFound', { secretId: '' }) as StorageProgram<Result>;
    }

    const versionId = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const arn = `arn:aws:secretsmanager:us-east-1:123456789:secret:${secretId}`;
    const value = `aws-secret-${secretId}`;

    let p = createProgram();
    p = put(p, RELATION, secretId, {
      secretId,
      versionStage,
      versionId,
      arn,
      value,
      fetchedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { value, versionId, arn }) as StorageProgram<Result>;
  },

  rotate(input: Record<string, unknown>) {
    const secretId = input.secretId as string;

    let p = createProgram();
    p = get(p, RELATION, secretId, 'record');

    return branch(p,
      (bindings) => {
        const record = bindings.record as Record<string, unknown> | null;
        return record !== null && record !== undefined && !!record.rotating;
      },
      (thenP) => complete(thenP, 'rotationInProgress', { secretId }),
      (elseP) => {
        const newVersionId = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        elseP = putFrom(elseP, RELATION, secretId, (bindings) => {
          const record = bindings.record as Record<string, unknown> | null;
          return {
            ...(record || { secretId }),
            versionId: newVersionId,
            rotating: false,
            rotatedAt: new Date().toISOString(),
          };
        });
        return complete(elseP, 'ok', { secretId, newVersionId });
      },
    ) as StorageProgram<Result>;
  },
};

export const awsSmProviderHandler = autoInterpret(_awsSmProviderHandler);
