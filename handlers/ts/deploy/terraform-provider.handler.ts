// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// TerraformProvider Concept Implementation
// Terraform IaC provider. Generates HCL from deploy plans,
// previews changes, applies workspaces, and tears down resources.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'terraform';

const _handler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const plan = input.plan as string;

    const workspaceId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['main.tf', 'variables.tf', 'outputs.tf', 'providers.tf'];

    let p = createProgram();
    p = put(p, RELATION, workspaceId, {
      workspace: workspaceId,
      plan,
      status: 'generated',
      locked: false,
      lockId: '',
      lockedBy: '',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { workspace: workspaceId, files }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = get(p, RELATION, workspace, 'record');

    p = branch(p, 'record',
      (b) => {
        return branch(b,
          (bindings) => !!(bindings.record as Record<string, unknown>).locked,
          (b2) => completeFrom(b2, 'stateLocked', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return {
              workspace,
              lockId: record.lockId as string,
              lockedBy: record.lockedBy as string,
            };
          }),
          (b2) => complete(b2, 'ok', {
            workspace,
            toCreate: 0,
            toUpdate: 0,
            toDelete: 0,
          }),
        );
      },
      (b) => complete(b, 'backendInitRequired', { workspace }),
    );

    return p as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = get(p, RELATION, workspace, 'record');

    p = branch(p, 'record',
      (b) => {
        return branch(b,
          (bindings) => !!(bindings.record as Record<string, unknown>).locked,
          (b2) => completeFrom(b2, 'stateLocked', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return {
              workspace,
              lockId: record.lockId as string,
            };
          }),
          (b2) => {
            const b3 = putFrom(b2, RELATION, workspace, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return {
                ...record,
                status: 'applied',
                appliedAt: new Date().toISOString(),
              };
            });
            return complete(b3, 'ok', { workspace, created: [], updated: [] });
          },
        );
      },
      (b) => complete(b, 'stateLocked', { workspace, lockId: 'unknown' }),
    );

    return p as StorageProgram<Result>;
  },

  teardown(input: Record<string, unknown>) {
    const workspace = input.workspace as string;

    let p = createProgram();
    p = get(p, RELATION, workspace, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = del(b, RELATION, workspace);
        return complete(b2, 'ok', { workspace, destroyed: [workspace] });
      },
      (b) => complete(b, 'ok', { workspace, destroyed: [] }),
    );

    return p as StorageProgram<Result>;
  },
};

export const terraformProviderHandler = autoInterpret(_handler);
