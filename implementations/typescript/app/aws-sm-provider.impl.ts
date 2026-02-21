// AwsSmProvider Concept Implementation
// Manage secret resolution from AWS Secrets Manager. Owns IAM session state,
// KMS key accessibility, and rotation schedule tracking.
import type { ConceptHandler } from '@copf/kernel';

export const awsSmProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const secretId = input.secretId as string;
    const versionStage = input.versionStage as string;

    const record = await storage.get('secret', secretId);

    if (!record) {
      // Simulate creating and storing a new secret entry
      const versionId = `ver-${Date.now()}`;
      const arn = `arn:aws:secretsmanager:us-east-1:123456789012:secret:${secretId}`;
      const value = `resolved-value-for-${secretId}`;

      await storage.put('secret', secretId, {
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

      return {
        variant: 'ok',
        value,
        versionId,
        arn,
      };
    }

    const kmsKeyId = record.kmsKeyId as string | null;
    if (kmsKeyId && kmsKeyId.startsWith('inaccessible:')) {
      return {
        variant: 'kmsKeyInaccessible',
        secretId,
        kmsKeyId,
      };
    }

    return {
      variant: 'ok',
      value: record.value as string,
      versionId: record.versionId as string,
      arn: record.arn as string,
    };
  },

  async rotate(input, storage) {
    const secretId = input.secretId as string;

    const record = await storage.get('secret', secretId);

    if (record && record.rotationInProgress) {
      return {
        variant: 'rotationInProgress',
        secretId,
      };
    }

    const newVersionId = `ver-${Date.now()}`;
    const now = new Date().toISOString();

    if (record) {
      await storage.put('secret', secretId, {
        ...record,
        versionId: newVersionId,
        lastRotatedAt: now,
        value: `rotated-value-${newVersionId}`,
      });
    }

    return {
      variant: 'ok',
      secretId,
      newVersionId,
    };
  },
};
