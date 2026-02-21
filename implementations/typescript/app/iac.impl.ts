// IaC Concept Implementation (Deploy Kit)
// Coordinate infrastructure-as-code generation and application across IaC providers.
import type { ConceptHandler } from '@copf/kernel';

export const iacHandler: ConceptHandler = {
  async emit(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const supportedProviders = ['pulumi', 'terraform', 'cdk', 'cloudformation'];
    if (!supportedProviders.includes(provider)) {
      return { variant: 'unsupportedResource', resource: 'unknown', provider };
    }

    const outputRef = `iac-${provider}-${Date.now()}`;
    const fileCount = 3;
    const createdAt = new Date().toISOString();

    await storage.put('resource', outputRef, {
      resourceId: outputRef,
      provider,
      resourceType: 'iac-output',
      concept: plan,
      createdAt,
      lastSyncedAt: createdAt,
      driftDetected: false,
      estimatedMonthlyCost: null,
      output: outputRef,
      fileCount,
    });

    return { variant: 'ok', output: outputRef, fileCount };
  },

  async preview(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    // Retrieve current resources for this provider
    const allResources = await storage.find('resource');
    const providerResources = allResources.filter(r => r.provider === provider);

    // Simulate a preview: existing resources would be updated, new ones created
    const toCreate: string[] = [];
    const toUpdate: string[] = [];
    const toDelete: string[] = [];

    for (const resource of providerResources) {
      if (resource.resourceType === 'iac-output') continue;
      toUpdate.push(resource.resourceId as string);
    }

    // Simulated cost estimation
    const estimatedMonthlyCost = (toCreate.length + toUpdate.length) * 25.0;

    return {
      variant: 'ok',
      toCreate: JSON.stringify(toCreate),
      toUpdate: JSON.stringify(toUpdate),
      toDelete: JSON.stringify(toDelete),
      estimatedMonthlyCost,
    };
  },

  async apply(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const applyId = `apply-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const created: string[] = [];
    const updated: string[] = [];
    const deleted: string[] = [];

    // Simulate resource creation
    const resourceId = `${provider}-${plan}-${Date.now()}`;
    await storage.put('resource', resourceId, {
      resourceId,
      provider,
      resourceType: 'managed',
      concept: plan,
      createdAt,
      lastSyncedAt: createdAt,
      driftDetected: false,
      estimatedMonthlyCost: null,
    });
    created.push(resourceId);

    return {
      variant: 'ok',
      created: JSON.stringify(created),
      updated: JSON.stringify(updated),
      deleted: JSON.stringify(deleted),
    };
  },

  async detectDrift(input, storage) {
    const provider = input.provider as string;

    const allResources = await storage.find('resource');
    const providerResources = allResources.filter(
      r => r.provider === provider && r.resourceType === 'managed',
    );

    const drifted: string[] = [];
    const clean: string[] = [];
    const now = new Date().toISOString();

    for (const resource of providerResources) {
      if (resource.driftDetected) {
        drifted.push(resource.resourceId as string);
      } else {
        clean.push(resource.resourceId as string);
      }
      // Update last synced time
      await storage.put('resource', resource.resourceId as string, {
        ...resource,
        lastSyncedAt: now,
      });
    }

    if (drifted.length === 0) {
      return { variant: 'noDrift' };
    }

    return {
      variant: 'ok',
      drifted: JSON.stringify(drifted),
      clean: JSON.stringify(clean),
    };
  },

  async teardown(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const allResources = await storage.find('resource');
    const targetResources = allResources.filter(
      r => r.provider === provider && r.concept === plan,
    );

    const destroyed: string[] = [];

    for (const resource of targetResources) {
      const resourceId = resource.resourceId as string;
      await storage.delete('resource', resourceId);
      destroyed.push(resourceId);
    }

    return { variant: 'ok', destroyed: JSON.stringify(destroyed) };
  },
};
