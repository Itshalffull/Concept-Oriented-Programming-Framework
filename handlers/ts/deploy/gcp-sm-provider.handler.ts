// GcpSmProvider Concept Implementation
// Google Cloud Secret Manager provider for the Secret coordination concept.
// Fetches secret versions and handles rotation.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'gcpsm';

export const gcpSmProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const secretId = input.secretId as string;
    const version = input.version as string;

    if (!secretId || secretId.trim() === '') {
      return { variant: 'secretNotFound', secretId: '', projectId: 'unknown' };
    }

    const versionId = version === 'latest' ? `v${Date.now()}` : version;
    const projectId = 'gcp-project-1';
    const value = `gcp-secret-${secretId}`;

    await storage.put(RELATION, secretId, {
      secretId,
      version: versionId,
      projectId,
      value,
      accessedAt: new Date().toISOString(),
    });

    return { variant: 'ok', value, versionId, projectId };
  },

  async rotate(input, storage) {
    const secretId = input.secretId as string;

    const newVersionId = `v${Date.now()}`;

    const record = await storage.get(RELATION, secretId);
    if (record) {
      await storage.put(RELATION, secretId, {
        ...record,
        version: newVersionId,
        rotatedAt: new Date().toISOString(),
      });
    }

    return { variant: 'ok', secretId, newVersionId };
  },
};
