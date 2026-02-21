// TerraformProvider Concept Implementation
// Generate and apply Terraform HCL modules from COPF deploy plans. Owns
// Terraform state file management, lock handling, and workspace configuration.
import type { ConceptHandler } from '@copf/kernel';

export const terraformProviderHandler: ConceptHandler = {
  async generate(input, storage) {
    const plan = input.plan as string;

    const workspaceId = `tf-workspace-${plan}-${Date.now()}`;
    const files = [
      `terraform/${plan}/main.tf`,
      `terraform/${plan}/variables.tf`,
      `terraform/${plan}/outputs.tf`,
      `terraform/${plan}/providers.tf`,
    ];

    await storage.put('workspace', workspaceId, {
      stateBackend: 's3://terraform-state',
      lockTable: 'terraform-locks',
      workspace: `ws-${plan}`,
      lockId: null,
      serial: 0,
      lastAppliedAt: null,
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      workspace: workspaceId,
      files,
    };
  },

  async preview(input, storage) {
    const workspace = input.workspace as string;

    const record = await storage.get('workspace', workspace);
    if (!record) {
      return {
        variant: 'backendInitRequired',
        workspace,
      };
    }

    const lockId = record.lockId as string | null;
    if (lockId) {
      return {
        variant: 'stateLocked',
        workspace,
        lockId,
        lockedBy: 'another-process',
      };
    }

    return {
      variant: 'ok',
      workspace,
      toCreate: 4,
      toUpdate: 1,
      toDelete: 0,
    };
  },

  async apply(input, storage) {
    const workspace = input.workspace as string;

    const record = await storage.get('workspace', workspace);
    if (!record) {
      return {
        variant: 'stateLocked',
        workspace,
        lockId: 'unknown',
      };
    }

    const lockId = record.lockId as string | null;
    if (lockId) {
      return {
        variant: 'stateLocked',
        workspace,
        lockId,
      };
    }

    const serial = (record.serial as number) + 1;
    const created = ['aws_vpc.main', 'aws_subnet.primary', 'aws_ecs_cluster.app', 'aws_security_group.web'];
    const updated = ['aws_iam_role.exec'];

    await storage.put('workspace', workspace, {
      ...record,
      serial,
      lastAppliedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      workspace,
      created,
      updated,
    };
  },

  async teardown(input, storage) {
    const workspace = input.workspace as string;

    const record = await storage.get('workspace', workspace);
    const destroyed = [
      'aws_vpc.main', 'aws_subnet.primary', 'aws_ecs_cluster.app',
      'aws_security_group.web', 'aws_iam_role.exec',
    ];

    if (record) {
      await storage.put('workspace', workspace, {
        ...record,
        serial: (record.serial as number) + 1,
        lastAppliedAt: new Date().toISOString(),
      });
    }

    await storage.delete('workspace', workspace);

    return {
      variant: 'ok',
      workspace,
      destroyed,
    };
  },
};
