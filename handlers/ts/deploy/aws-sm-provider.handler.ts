// AwsSmProvider Concept Implementation
// AWS Secrets Manager provider for the Secret coordination concept. Fetches
// secret values by ID and version stage, and triggers rotation.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'awssm';

export const awsSmProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const secretId = input.secretId as string;
    const versionStage = input.versionStage as string;

    if (!secretId || secretId.trim() === '') {
      return { variant: 'resourceNotFound', secretId: '' };
    }

    const versionId = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const arn = `arn:aws:secretsmanager:us-east-1:123456789:secret:${secretId}`;
    const value = `aws-secret-${secretId}`;

    await storage.put(RELATION, secretId, {
      secretId,
      versionStage,
      versionId,
      arn,
      value,
      fetchedAt: new Date().toISOString(),
    });

    return { variant: 'ok', value, versionId, arn };
  },

  async rotate(input, storage) {
    const secretId = input.secretId as string;

    const record = await storage.get(RELATION, secretId);
    if (record && record.rotating) {
      return { variant: 'rotationInProgress', secretId };
    }

    const newVersionId = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await storage.put(RELATION, secretId, {
      ...(record || { secretId }),
      versionId: newVersionId,
      rotating: false,
      rotatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', secretId, newVersionId };
  },
};
