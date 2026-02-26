// IaC Concept Implementation
// Coordination concept for infrastructure-as-code. Generates provider-specific
// configuration, previews changes, applies updates, detects drift, and tears down.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'iac';

export const iacHandler: ConceptHandler = {
  async emit(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const outputId = `iac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = [`${provider}/main.tf`, `${provider}/variables.tf`];

    // Store concept state only — file output is routed through Emitter via syncs
    await storage.put(RELATION, outputId, {
      output: outputId,
      plan,
      provider,
      fileCount: files.length,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', output: outputId, fileCount: files.length };
  },

  async preview(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    return {
      variant: 'ok',
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      estimatedMonthlyCost: 0,
    };
  },

  async apply(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const applyId = `apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await storage.put(RELATION, applyId, {
      apply: applyId,
      plan,
      provider,
      status: 'applied',
      created: JSON.stringify([]),
      updated: JSON.stringify([]),
      deleted: JSON.stringify([]),
      appliedAt: new Date().toISOString(),
    });

    return { variant: 'ok', created: [], updated: [], deleted: [] };
  },

  async detectDrift(input, storage) {
    const provider = input.provider as string;

    // In a real implementation, this would compare state against actual infra
    return { variant: 'noDrift' };
  },

  async teardown(input, storage) {
    const plan = input.plan as string;
    const provider = input.provider as string;

    const matches = await storage.find(RELATION, { plan, provider });
    const destroyed: string[] = [];
    for (const rec of matches) {
      await storage.del(RELATION, rec.output as string || rec.apply as string);
      destroyed.push(rec.output as string || rec.apply as string);
    }

    return { variant: 'ok', destroyed };
  },
};
