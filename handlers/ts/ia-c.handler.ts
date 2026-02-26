// ============================================================
// IaC Handler
//
// Coordinate infrastructure-as-code generation and application
// across IaC providers. Owns the resource inventory tracking
// what cloud resources exist for this app, drift detection
// state, and cost tracking. DeployPlan talks to IaC and never
// to providers directly.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `ia-c-${++idCounter}`;
}

export const iaCHandler: ConceptHandler = {
  async emit(input: Record<string, unknown>, storage: ConceptStorage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    // Check if the provider is supported
    const supportedProviders = ['terraform', 'pulumi', 'cloudformation', 'docker-compose'];
    if (!supportedProviders.includes(provider)) {
      return {
        variant: 'unsupportedResource',
        resource: plan,
        provider,
      };
    }

    // Generate IaC output reference and file count based on provider
    let fileCount: number;
    let output: string;

    if (provider === 'terraform') {
      fileCount = 3; // main.tf, variables.tf, outputs.tf
      output = `terraform/${plan}`;
    } else if (provider === 'pulumi') {
      fileCount = 3; // Pulumi.yaml, index.ts, package.json
      output = `pulumi/${plan}`;
    } else if (provider === 'cloudformation') {
      fileCount = 1; // template.yaml
      output = `cloudformation/${plan}`;
    } else {
      fileCount = 2; // docker-compose.yaml, .env
      output = `docker-compose/${plan}`;
    }

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('ia-c', id, {
      id,
      resourceId: `${provider}-${plan}`,
      provider,
      resourceType: 'iac-output',
      concept: plan,
      createdAt: now,
      lastSyncedAt: now,
      driftDetected: false,
      estimatedMonthlyCost: null,
      plan,
      output,
      fileCount,
    });

    return { variant: 'ok', output, fileCount };
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    // Look up existing resources for this plan
    const existing = await storage.find('ia-c', { plan, provider });

    if (existing.length === 0) {
      // No existing state -- everything would be created
      return {
        variant: 'ok',
        toCreate: [`${provider}-resource-1`],
        toUpdate: [],
        toDelete: [],
        estimatedMonthlyCost: 0.0,
      };
    }

    // If state exists, report no changes (idempotent preview)
    return {
      variant: 'ok',
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      estimatedMonthlyCost: (existing[0].estimatedMonthlyCost as number) || 0.0,
    };
  },

  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    // Look up existing IaC resources
    const existing = await storage.find('ia-c', { plan, provider });
    const now = new Date().toISOString();

    if (existing.length === 0) {
      // First apply: create resources
      const id = nextId();
      const resourceId = `${provider}-${plan}-applied`;

      await storage.put('ia-c', id, {
        id,
        resourceId,
        provider,
        resourceType: 'applied-resource',
        concept: plan,
        createdAt: now,
        lastSyncedAt: now,
        driftDetected: false,
        estimatedMonthlyCost: null,
        plan,
      });

      return {
        variant: 'ok',
        created: [resourceId],
        updated: [],
        deleted: [],
      };
    }

    // Update existing resources
    for (const record of existing) {
      await storage.put('ia-c', record.id as string, {
        ...record,
        lastSyncedAt: now,
        driftDetected: false,
      });
    }

    return {
      variant: 'ok',
      created: [],
      updated: existing.map(r => r.resourceId as string),
      deleted: [],
    };
  },

  async detectDrift(input: Record<string, unknown>, storage: ConceptStorage) {
    const provider = input.provider as string;

    const resources = await storage.find('ia-c', { provider });

    if (resources.length === 0) {
      return { variant: 'noDrift' };
    }

    const drifted: string[] = [];
    const clean: string[] = [];

    for (const resource of resources) {
      if (resource.driftDetected === true) {
        drifted.push(resource.resourceId as string);
      } else {
        clean.push(resource.resourceId as string);
      }
    }

    if (drifted.length === 0) {
      return { variant: 'noDrift' };
    }

    return { variant: 'ok', drifted, clean };
  },

  async teardown(input: Record<string, unknown>, storage: ConceptStorage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const resources = await storage.find('ia-c', { plan, provider });

    if (resources.length === 0) {
      return { variant: 'ok', destroyed: [] };
    }

    const destroyed: string[] = [];
    const stuck: string[] = [];

    for (const resource of resources) {
      const resourceId = resource.resourceId as string;
      try {
        await storage.del('ia-c', resource.id as string);
        destroyed.push(resourceId);
      } catch {
        stuck.push(resourceId);
      }
    }

    if (stuck.length > 0) {
      return { variant: 'partial', destroyed, stuck };
    }

    return { variant: 'ok', destroyed };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetIaCCounter(): void {
  idCounter = 0;
}
