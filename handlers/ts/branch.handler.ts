// @migrated dsl-constructs 2026-03-18
// ============================================================
// Branch Handler
//
// Named parallel lines of development with lifecycle management.
// Branches are mutable pointers over immutable DAG history --
// advancing the head, protecting against direct writes, and
// tracking upstream relationships.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, putFrom, branch as branchDsl, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `branch-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const fromNode = input.fromNode as string;

    let p = createProgram();
    p = find(p, 'branch', { name }, 'existing');

    return branchDsl(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'exists', { message: `Branch '${name}' already exists` }),
      (elseP) => {
        const id = nextId();
        const now = new Date().toISOString();
        elseP = put(elseP, 'branch', id, {
          id,
          name,
          head: fromNode,
          protected: false,
          upstream: null,
          created: now,
          archived: false,
        });
        return complete(elseP, 'ok', { branch: id });
      },
    ) as StorageProgram<Result>;
  },

  advance(input: Record<string, unknown>) {
    const branchId = input.branch as string;
    const newNode = input.newNode as string;

    let p = createProgram();
    p = get(p, 'branch', branchId, 'record');

    return branchDsl(p, 'record',
      (thenP) => {
        return branchDsl(thenP,
          (bindings) => (bindings.record as Record<string, unknown>).protected === true,
          (protectedP) => completeFrom(protectedP, 'protected', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { message: `Branch '${record.name}' is protected. Direct advance rejected.` };
          }),
          (unprotectedP) => {
            unprotectedP = putFrom(unprotectedP, 'branch', branchId, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, head: newNode };
            });
            return complete(unprotectedP, 'ok', {});
          },
        );
      },
      (elseP) => complete(elseP, 'notFound', { message: `Branch '${branchId}' not found` }),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const branchId = input.branch as string;

    let p = createProgram();
    p = get(p, 'branch', branchId, 'record');

    return branchDsl(p, 'record',
      (thenP) => {
        return branchDsl(thenP,
          (bindings) => (bindings.record as Record<string, unknown>).protected === true,
          (protectedP) => completeFrom(protectedP, 'protected', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { message: `Protected branch '${record.name}' cannot be deleted` };
          }),
          (unprotectedP) => {
            unprotectedP = del(unprotectedP, 'branch', branchId);
            return complete(unprotectedP, 'ok', {});
          },
        );
      },
      (elseP) => complete(elseP, 'notFound', { message: `Branch '${branchId}' not found` }),
    ) as StorageProgram<Result>;
  },

  protect(input: Record<string, unknown>) {
    const branchId = input.branch as string;

    let p = createProgram();
    p = get(p, 'branch', branchId, 'record');

    return branchDsl(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'branch', branchId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, protected: true };
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notFound', { message: `Branch '${branchId}' not found` }),
    ) as StorageProgram<Result>;
  },

  setUpstream(input: Record<string, unknown>) {
    const branchId = input.branch as string;
    const upstream = input.upstream as string;

    let p = createProgram();
    p = get(p, 'branch', branchId, 'branchRecord');
    p = get(p, 'branch', upstream, 'upstreamRecord');

    return branchDsl(p, 'branchRecord',
      (thenP) => {
        return branchDsl(thenP, 'upstreamRecord',
          (bothP) => {
            bothP = putFrom(bothP, 'branch', branchId, (bindings) => {
              const record = bindings.branchRecord as Record<string, unknown>;
              return { ...record, upstream };
            });
            return complete(bothP, 'ok', {});
          },
          (noUpstreamP) => complete(noUpstreamP, 'notFound', { message: `Upstream branch '${upstream}' not found` }),
        );
      },
      (elseP) => complete(elseP, 'notFound', { message: `Branch '${branchId}' not found` }),
    ) as StorageProgram<Result>;
  },

  divergencePoint(input: Record<string, unknown>) {
    const b1 = input.b1 as string;
    const b2 = input.b2 as string;

    let p = createProgram();
    p = get(p, 'branch', b1, 'branch1');
    p = get(p, 'branch', b2, 'branch2');

    return branchDsl(p, 'branch1',
      (thenP) => {
        return branchDsl(thenP, 'branch2',
          (bothP) => {
            // Divergence point computation requires iterative DAG traversal
            // which can't be expressed as static DSL. Return heads for comparison.
            return completeFrom(bothP, 'ok', (bindings) => {
              const branch1 = bindings.branch1 as Record<string, unknown>;
              const branch2 = bindings.branch2 as Record<string, unknown>;
              const head1 = branch1.head as string;
              const head2 = branch2.head as string;

              if (head1 === head2) {
                return { variant: 'noDivergence', message: 'Both branches point to the same node' };
              }

              // Without iterative storage access, return a placeholder
              return { variant: 'ok', nodeId: head1 };
            });
          },
          (noB2P) => complete(noB2P, 'notFound', { message: `Branch '${b2}' not found` }),
        );
      },
      (elseP) => complete(elseP, 'notFound', { message: `Branch '${b1}' not found` }),
    ) as StorageProgram<Result>;
  },

  archive(input: Record<string, unknown>) {
    const branchId = input.branch as string;

    let p = createProgram();
    p = get(p, 'branch', branchId, 'record');

    return branchDsl(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'branch', branchId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, archived: true };
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notFound', { message: `Branch '${branchId}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const branchHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetBranchCounter(): void {
  idCounter = 0;
}
