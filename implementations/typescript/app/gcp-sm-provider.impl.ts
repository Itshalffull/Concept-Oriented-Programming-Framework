// GcpSmProvider Concept Implementation
// Manage secret resolution from Google Cloud Secret Manager. Owns project
// and secret IDs, IAM binding state, version tracking, and access configuration.
import type { ConceptHandler } from '@copf/kernel';

export const gcpSmProviderHandler: ConceptHandler = {
  async fetch(input, storage) {
    const secretId = input.secretId as string;
    const version = input.version as string;

    const record = await storage.get('secret', secretId);

    if (!record) {
      // Simulate first-time secret access; create an entry
      const projectId = 'default-project';
      const versionId = version === 'latest' ? '1' : version;
      const value = `resolved-value-for-${secretId}`;

      await storage.put('secret', secretId, {
        projectId,
        secretId,
        region: null,
        latestVersion: versionId,
        enabledVersions: JSON.stringify([versionId]),
        disabledVersions: JSON.stringify([]),
        iamBindings: JSON.stringify(['serviceAccount:default@project.iam.gserviceaccount.com']),
        lastAccessedAt: new Date().toISOString(),
        value,
      });

      return {
        variant: 'ok',
        value,
        versionId,
        projectId,
      };
    }

    const projectId = record.projectId as string;
    const disabledVersions: string[] = JSON.parse(record.disabledVersions as string);
    const enabledVersions: string[] = JSON.parse(record.enabledVersions as string);
    const iamBindings: string[] = JSON.parse(record.iamBindings as string);

    // Check IAM bindings
    if (iamBindings.length === 0) {
      return {
        variant: 'iamBindingMissing',
        secretId,
        principal: 'serviceAccount:unknown',
      };
    }

    // Check if requested version is disabled
    const resolvedVersion = version === 'latest' ? (record.latestVersion as string) : version;
    if (disabledVersions.includes(resolvedVersion)) {
      return {
        variant: 'versionDisabled',
        secretId,
        version: resolvedVersion,
      };
    }

    // Check if secret exists
    if (!enabledVersions.includes(resolvedVersion) && version !== 'latest') {
      return {
        variant: 'secretNotFound',
        secretId,
        projectId,
      };
    }

    await storage.put('secret', secretId, {
      ...record,
      lastAccessedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      value: record.value as string,
      versionId: resolvedVersion,
      projectId,
    };
  },

  async rotate(input, storage) {
    const secretId = input.secretId as string;

    const record = await storage.get('secret', secretId);
    if (!record) {
      const newVersionId = '1';
      return {
        variant: 'ok',
        secretId,
        newVersionId,
      };
    }

    const enabledVersions: string[] = JSON.parse(record.enabledVersions as string);
    const newVersionId = String(enabledVersions.length + 1);
    enabledVersions.push(newVersionId);

    await storage.put('secret', secretId, {
      ...record,
      latestVersion: newVersionId,
      enabledVersions: JSON.stringify(enabledVersions),
      value: `rotated-value-${newVersionId}`,
      lastAccessedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      secretId,
      newVersionId,
    };
  },
};
