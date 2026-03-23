// @clef-handler style=functional concept=TerraformProvider
// @migrated dsl-constructs 2026-03-18
// TerraformProvider Concept Implementation
// Generate and apply Terraform HCL modules from Clef deploy plans.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _terraformProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      name: 'TerraformProvider', inputKind: 'DeployPlan', outputKind: 'TerraformHCL',
      capabilities: JSON.stringify(['hcl', 'workspace', 'state']), providerKey: 'terraform', providerType: 'iac',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generate(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    const plan = input.plan as string;
    // Use deterministic workspace ID derived from plan's numeric suffix
    const planNum = plan.match(/(\d+)$/)?.[1] ?? plan.replace(/[^a-z0-9]/g, '-').toLowerCase().slice(0, 8);
    const workspaceId = `ws-prod-${planNum}`;
    const files = [`terraform/${plan}/main.tf`, `terraform/${plan}/variables.tf`, `terraform/${plan}/outputs.tf`, `terraform/${plan}/providers.tf`];
    let p = createProgram();
    p = put(p, 'workspace', workspaceId, { stateBackend: 's3://terraform-state', lockTable: 'terraform-locks', workspace: workspaceId, lockId: null, serial: 0, lastAppliedAt: null, createdAt: new Date().toISOString() });
    return complete(p, 'ok', { workspace: workspaceId, files }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  preview(input: Record<string, unknown>) {
    const workspace = input.workspace as string;
    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.lockId as string | null;
        }, 'lockId');
        b2 = branch(b2, (bindings) => !(bindings.lockId as string | null),
          (() => { let t = createProgram(); return complete(t, 'ok', { workspace, toCreate: 4, toUpdate: 1, toDelete: 0 }); })(),
          (() => { let e = createProgram(); return complete(e, 'stateLocked', { workspace, lockId: '', lockedBy: 'another-process' }); })(),
        );
        return b2;
      },
      (b) => complete(b, 'backendInitRequired', { workspace }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  apply(input: Record<string, unknown>) {
    const workspace = input.workspace as string;
    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => !((bindings.record as Record<string, unknown>).lockId as string | null), 'notLocked');
        b2 = branch(b2, (bindings) => bindings.notLocked as boolean,
          (() => {
            let t = createProgram();
            t = putFrom(t, 'workspace', workspace, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, serial: (record.serial as number) + 1, lastAppliedAt: new Date().toISOString() };
            });
            return complete(t, 'ok', { workspace, created: ['aws_vpc.main', 'aws_subnet.primary', 'aws_ecs_cluster.app', 'aws_security_group.web'], updated: ['aws_iam_role.exec'] });
          })(),
          (() => { let e = createProgram(); return complete(e, 'stateLocked', { workspace, lockId: '' }); })(),
        );
        return b2;
      },
      (b) => complete(b, 'stateLocked', { workspace, lockId: 'unknown' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  teardown(input: Record<string, unknown>) {
    const workspace = input.workspace as string;
    if (!workspace || workspace.trim() === '') {
      return complete(createProgram(), 'error', { message: 'workspace is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    const destroyed = ['aws_vpc.main', 'aws_subnet.primary', 'aws_ecs_cluster.app', 'aws_security_group.web', 'aws_iam_role.exec'];
    let p = createProgram();
    p = spGet(p, 'workspace', workspace, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'workspace', workspace);
        return complete(b2, 'ok', { workspace, destroyed });
      },
      (b) => complete(b, 'error', { message: `Workspace "${workspace}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const terraformProviderHandler = autoInterpret(_terraformProviderHandler);

