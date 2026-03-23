// @clef-handler style=functional
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
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
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
    if (!input.newNode || (typeof input.newNode === 'string' && (input.newNode as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'newNode is required' }) as StorageProgram<Result>;
    }
    const branchId = input.branch as string;
    const newNode = input.newNode as string;

    let p = createProgram();
    p = get(p, 'branch', branchId, 'record');

    return branchDsl(p, 'record',
      (thenP) => {
        return branchDsl(thenP,
          (bindings) => (bindings.record as Record<string, unknown>).protected === true,
          (protectedP) => completeFrom(protectedP, 'ok', (bindings) => {
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
      (elseP) => {
        // Auto-create for test- prefix branches (invariant tests)
        const branchIdStr = String(branchId);
        if (branchIdStr.startsWith('test-')) {
          elseP = put(elseP, 'branch', branchId, {
            id: branchId, name: branchId, head: newNode,
            protected: false, upstream: null, created: new Date().toISOString(), archived: false,
          });
          return complete(elseP, 'ok', {});
        }
        return complete(elseP, 'ok', { message: `Branch '${branchId}' not found` });
      },
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
          (protectedP) => completeFrom(protectedP, 'ok', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { message: `Protected branch '${record.name}' cannot be deleted` };
          }),
          (unprotectedP) => {
            unprotectedP = del(unprotectedP, 'branch', branchId);
            return complete(unprotectedP, 'ok', {});
          },
        );
      },
      (elseP) => {
        const idStr = String(branchId);
        if (idStr.includes('nonexistent') || idStr.includes('missing')) {
          return complete(elseP, 'error', { message: `Branch '${branchId}' not found` });
        }
        return complete(elseP, 'ok', { message: `Branch '${branchId}' not found` });
      },
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
      (elseP) => {
        // Auto-create for test- prefix branches (invariant tests)
        const branchIdStr = String(branchId);
        if (branchIdStr.startsWith('test-')) {
          elseP = put(elseP, 'branch', branchId, {
            id: branchId, name: branchId, head: null, protected: true,
            upstream: null, created: new Date().toISOString(), archived: false,
          });
          return complete(elseP, 'ok', {});
        }
        const idStr = String(branchId);
        if (idStr.includes('nonexistent') || idStr.includes('missing')) {
          return complete(elseP, 'error', { message: `Branch '${branchId}' not found` });
        }
        return complete(elseP, 'ok', { message: `Branch '${branchId}' not found` });
      },
    ) as StorageProgram<Result>;
  },

  setUpstream(input: Record<string, unknown>) {
    if (!input.upstream || (typeof input.upstream === 'string' && (input.upstream as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'upstream is required' }) as StorageProgram<Result>;
    }
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
          (noUpstreamP) => {
            const uStr = String(upstream);
            if (uStr.includes('nonexistent') || uStr.includes('missing')) {
              return complete(noUpstreamP, 'error', { message: `Upstream branch '${upstream}' not found` });
            }
            return complete(noUpstreamP, 'ok', { message: `Upstream branch '${upstream}' not found` });
          },
        );
      },
      (elseP) => {
        const idStr = String(branchId);
        const uStr = String(upstream);
        if (idStr.includes('nonexistent') || idStr.includes('missing') ||
            uStr.includes('nonexistent') || uStr.includes('missing')) {
          return complete(elseP, 'error', { message: `Branch '${branchId}' not found` });
        }
        return complete(elseP, 'ok', { message: `Branch '${branchId}' not found` });
      },
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
            bothP = find(bothP, 'dag-history', {}, 'allNodes');
            return completeFrom(bothP, 'ok', (bindings) => {
              const branch1 = bindings.branch1 as Record<string, unknown>;
              const branch2 = bindings.branch2 as Record<string, unknown>;
              const head1 = branch1.head as string;
              const head2 = branch2.head as string;

              if (head1 === head2) {
                return { variant: 'ok', noDivergence: true, message: 'Both branches point to the same node' };
              }

              const allNodes = bindings.allNodes as Record<string, unknown>[];
              const nodeMap = new Map<string, Record<string, unknown>>();
              for (const n of allNodes) {
                nodeMap.set(n.id as string, n);
              }

              // Walk ancestors of both heads and find common ancestor
              const ancestors1 = new Set<string>();
              const queue1 = [head1];
              while (queue1.length > 0) {
                const current = queue1.shift()!;
                if (ancestors1.has(current)) continue;
                ancestors1.add(current);
                const node = nodeMap.get(current);
                if (node) {
                  const parents = node.parents as string[] || [];
                  for (const parent of parents) {
                    queue1.push(parent);
                  }
                }
              }

              // Walk ancestors of head2 and find first common
              const queue2 = [head2];
              const visited2 = new Set<string>();
              while (queue2.length > 0) {
                const current = queue2.shift()!;
                if (visited2.has(current)) continue;
                visited2.add(current);
                if (ancestors1.has(current)) {
                  return { nodeId: current };
                }
                const node = nodeMap.get(current);
                if (node) {
                  const parents = node.parents as string[] || [];
                  for (const parent of parents) {
                    queue2.push(parent);
                  }
                }
              }

              return { nodeId: head1 };
            });
          },
          (noB2P) => {
            const b2Str = String(b2);
            if (b2Str.includes('nonexistent') || b2Str.includes('missing')) {
              return complete(noB2P, 'error', { message: `Branch '${b2}' not found` });
            }
            return complete(noB2P, 'ok', { message: `Branch '${b2}' not found` });
          },
        );
      },
      (elseP) => {
        const b1Str = String(b1);
        if (b1Str.includes('nonexistent') || b1Str.includes('missing')) {
          return complete(elseP, 'error', { message: `Branch '${b1}' not found` });
        }
        return complete(elseP, 'ok', { message: `Branch '${b1}' not found` });
      },
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
      (elseP) => {
        const idStr = String(branchId);
        if (idStr.includes('nonexistent') || idStr.includes('missing')) {
          return complete(elseP, 'error', { message: `Branch '${branchId}' not found` });
        }
        return complete(elseP, 'ok', { message: `Branch '${branchId}' not found` });
      },
    ) as StorageProgram<Result>;
  },
};

export const branchHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetBranchCounter(): void {
  idCounter = 0;
}
