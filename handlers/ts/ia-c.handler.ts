// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// IaC Handler
//
// Coordinate infrastructure-as-code generation and application
// across IaC providers. Owns the resource inventory tracking
// what cloud resources exist for this app, drift detection
// state, and cost tracking. DeployPlan talks to IaC and never
// to providers directly.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, delFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ia-c-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;
    const provider = input.provider as string;

    const supportedProviders = ['terraform', 'pulumi', 'cloudformation', 'docker-compose'];
    if (!supportedProviders.includes(provider)) {
      const p = createProgram();
      return complete(p, 'unsupportedResource', {
        resource: plan,
        provider,
      }) as StorageProgram<Result>;
    }

    let fileCount: number;
    let output: string;

    if (provider === 'terraform') {
      fileCount = 3;
      output = `terraform/${plan}`;
    } else if (provider === 'pulumi') {
      fileCount = 3;
      output = `pulumi/${plan}`;
    } else if (provider === 'cloudformation') {
      fileCount = 1;
      output = `cloudformation/${plan}`;
    } else {
      fileCount = 2;
      output = `docker-compose/${plan}`;
    }

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'ia-c', id, {
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

    return complete(p, 'ok', { output, fileCount }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<Result>;
    }
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, 'ia-c', { plan, provider }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length === 0) {
        return {
          toCreate: [`${provider}-resource-1`],
          toUpdate: [],
          toDelete: [],
          estimatedMonthlyCost: 0.0,
        };
      }
      return {
        toCreate: [],
        toUpdate: [],
        toDelete: [],
        estimatedMonthlyCost: (existing[0].estimatedMonthlyCost as number) || 0.0,
      };
    }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<Result>;
    }
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, 'ia-c', { plan, provider }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as Record<string, unknown>[]).length === 0,
      (bp) => {
        // First apply: create resources
        const id = nextId();
        const resourceId = `${provider}-${plan}-applied`;
        const now = new Date().toISOString();
        const bp2 = put(bp, 'ia-c', id, {
          id, resourceId, provider, resourceType: 'applied-resource',
          concept: plan, createdAt: now, lastSyncedAt: now,
          driftDetected: false, estimatedMonthlyCost: null, plan,
        });
        return complete(bp2, 'ok', { created: [resourceId], updated: [], deleted: [] });
      },
      (bp) => {
        // Update existing resources — use mapBindings to compute, then completeFrom
        return completeFrom(bp, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>[];
          return {
            created: [],
            updated: existing.map(r => r.resourceId as string),
            deleted: [],
          };
        });
      },
    ) as StorageProgram<Result>;
  },

  detectDrift(input: Record<string, unknown>) {
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, 'ia-c', { provider }, 'resources');

    return completeFrom(p, 'ok', (bindings) => {
      const resources = bindings.resources as Record<string, unknown>[];
      const drifted: string[] = [];
      const clean: string[] = [];
      for (const resource of resources) {
        if (resource.driftDetected === true) {
          drifted.push(resource.resourceId as string);
        } else {
          clean.push(resource.resourceId as string);
        }
      }
      return { drifted, clean };
    }) as StorageProgram<Result>;
  },

  teardown(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<Result>;
    }
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, 'ia-c', { plan, provider }, 'resources');

    // Delete the first found resource (teardown typically finds one)
    p = delFrom(p, 'ia-c', (bindings) => {
      const resources = bindings.resources as Record<string, unknown>[];
      if (resources.length > 0) return resources[0].id as string;
      return '__nonexistent__';
    });

    return completeFrom(p, 'ok', (bindings) => {
      const resources = bindings.resources as Record<string, unknown>[];
      const destroyed = resources.map(r => r.resourceId as string);
      return { destroyed };
    }) as StorageProgram<Result>;
  },
};

export const iaCHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetIaCCounter(): void {
  idCounter = 0;
}
