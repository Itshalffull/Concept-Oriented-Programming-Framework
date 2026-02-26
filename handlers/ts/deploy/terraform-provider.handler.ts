// TerraformProvider Concept Implementation
// Terraform IaC provider. Generates HCL from deploy plans,
// previews changes, applies workspaces, and tears down resources.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'terraform';

export const terraformProviderHandler: ConceptHandler = {
  async generate(input, storage) {
    const plan = input.plan as string;

    const workspaceId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['main.tf', 'variables.tf', 'outputs.tf', 'providers.tf'];

    // Store concept state only — file output is routed through Emitter via syncs
    await storage.put(RELATION, workspaceId, {
      workspace: workspaceId,
      plan,
      status: 'generated',
      locked: false,
      lockId: '',
      lockedBy: '',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', workspace: workspaceId, files };
  },

  async preview(input, storage) {
    const workspace = input.workspace as string;

    const record = await storage.get(RELATION, workspace);
    if (!record) {
      return { variant: 'backendInitRequired', workspace };
    }

    if (record.locked) {
      return {
        variant: 'stateLocked',
        workspace,
        lockId: record.lockId as string,
        lockedBy: record.lockedBy as string,
      };
    }

    return {
      variant: 'ok',
      workspace,
      toCreate: 0,
      toUpdate: 0,
      toDelete: 0,
    };
  },

  async apply(input, storage) {
    const workspace = input.workspace as string;

    const record = await storage.get(RELATION, workspace);
    if (!record) {
      return { variant: 'stateLocked', workspace, lockId: 'unknown' };
    }

    if (record.locked) {
      return {
        variant: 'stateLocked',
        workspace,
        lockId: record.lockId as string,
      };
    }

    await storage.put(RELATION, workspace, {
      ...record,
      status: 'applied',
      appliedAt: new Date().toISOString(),
    });

    return { variant: 'ok', workspace, created: [], updated: [] };
  },

  async teardown(input, storage) {
    const workspace = input.workspace as string;

    const record = await storage.get(RELATION, workspace);
    if (!record) {
      return { variant: 'ok', workspace, destroyed: [] };
    }

    await storage.del(RELATION, workspace);
    return { variant: 'ok', workspace, destroyed: [workspace] };
  },
};
