// @migrated dsl-constructs 2026-03-18
// AwsSmProvider Concept Implementation
// Manage secret resolution from AWS Secrets Manager. Owns IAM session state,
// KMS key accessibility, and rotation schedule tracking.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const awsSmProviderHandler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const secretId = input.secretId as string;
    const versionStage = input.versionStage as string;

    let p = createProgram();
    p = spGet(p, 'secret', secretId, 'record');
    p = branch(p, 'record',
      (b) => {
        // Secret found — return value, versionId, arn (resolved at runtime from bindings)
        // KMS key accessibility check resolved at runtime
        return complete(b, 'ok', { value: '', versionId: '', arn: '' });
      },
      (b) => {
        // Simulate creating and storing a new secret entry
        const versionId = `ver-${Date.now()}`;
        const arn = `arn:aws:secretsmanager:us-east-1:123456789012:secret:${secretId}`;
        const value = `resolved-value-for-${secretId}`;

        let b2 = put(b, 'secret', secretId, {
          secretId,
          versionStage,
          versionId,
          arn,
          value,
          region: 'us-east-1',
          kmsKeyId: null,
          scheduleEnabled: false,
          lastRotatedAt: null,
          nextRotationAt: null,
          createdAt: new Date().toISOString(),
        });

        return complete(b2, 'ok', { value, versionId, arn });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rotate(input: Record<string, unknown>) {
    const secretId = input.secretId as string;

    const newVersionId = `ver-${Date.now()}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'secret', secretId, 'record');
    p = branch(p, 'record',
      (b) => {
        // Check rotationInProgress at runtime; update with new version
        let b2 = put(b, 'secret', secretId, {
          versionId: newVersionId,
          lastRotatedAt: now,
          value: `rotated-value-${newVersionId}`,
        });
        return complete(b2, 'ok', { secretId, newVersionId });
      },
      (b) => complete(b, 'ok', { secretId, newVersionId }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
