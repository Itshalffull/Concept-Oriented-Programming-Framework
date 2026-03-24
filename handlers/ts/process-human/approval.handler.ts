// @clef-handler style=functional
// ============================================================
// Approval Handler
//
// Gates process progression on explicit multi-party authorization
// decisions with configurable approval policies (one-of, all-of,
// n-of-m). See process-human suite.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `apr-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {

  register() {
    return complete(createProgram(), 'ok', { name: 'Approval' });
  },

  // action request(step_ref: String, policy_kind: String, required_count: Int, roles: Bytes)
  //   -> ok(approval: A, step_ref: String)
  request(input: Record<string, unknown>) {
    const stepRef = input.step_ref as string;
    const policyKind = input.policy_kind as string;
    const requiredCount = input.required_count as number;
    const rolesRaw = input.roles as string;

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' });
    }

    const id = nextId();
    const now = new Date().toISOString();

    let parsedRoles: string[] = [];
    try {
      parsedRoles = JSON.parse(rolesRaw) as string[];
    } catch {
      parsedRoles = [rolesRaw];
    }

    let p = createProgram();
    p = put(p, 'approval', id, {
      id,
      step_ref: stepRef,
      status: 'pending',
      policy: {
        kind: policyKind || 'one_of',
        required_count: requiredCount ?? 1,
        roles: parsedRoles,
      },
      decisions: [],
      requested_at: now,
      resolved_at: null,
    });
    return complete(p, 'ok', { approval: id, step_ref: stepRef });
  },

  // action approve(approval: A, actor: String, comment: String)
  //   -> ok(approval: A, step_ref: String)                         — threshold met, approved
  //   -> ok(approval: A)                                           — no longer pending
  //   -> ok(actor: String)                                         — actor not authorized
  //   -> pending(approval: A, decisions_so_far: Int, required: Int) — recorded but threshold not met
  approve(input: Record<string, unknown>) {
    const approvalId = input.approval as string;
    const actor = input.actor as string;
    const comment = input.comment as string;

    if (!actor || actor.trim() === '') {
      return complete(createProgram(), 'error', { message: 'actor is required' });
    }

    let p = createProgram();
    p = get(p, 'approval', approvalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Approval not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'approval', approvalId, 'existing');
        // Check if still pending
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'pending';
          },
          // No longer pending
          completeFrom(createProgram(), 'ok', () => ({ approval: approvalId })),
          (() => {
            // Check actor authorization
            let c = createProgram();
            c = get(c, 'approval', approvalId, 'existing');
            return branch(c,
              (bindings) => {
                const rec = bindings.existing as Record<string, unknown>;
                const policy = rec.policy as Record<string, unknown>;
                const roles = policy.roles as string[];
                return roles.length > 0 && !roles.includes(actor);
              },
              // Actor not authorized
              completeFrom(createProgram(), 'ok', () => ({ actor })),
              (() => {
                // Record the decision and check threshold
                let d = createProgram();
                d = get(d, 'approval', approvalId, 'existing');
                d = mapBindings(d, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const decisions = (rec.decisions as unknown[]) || [];
                  const policy = rec.policy as Record<string, unknown>;
                  const newDecision = {
                    actor,
                    decision: 'approve',
                    comment: comment || null,
                    decided_at: new Date().toISOString(),
                  };
                  const updatedDecisions = [...decisions, newDecision];
                  const approveCount = updatedDecisions.filter(
                    (d: unknown) => (d as Record<string, unknown>).decision === 'approve'
                  ).length;
                  const required = policy.required_count as number;
                  const thresholdMet = approveCount >= required;
                  return { updatedDecisions, approveCount, required, thresholdMet };
                }, '_computed');

                d = putFrom(d, 'approval', approvalId, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const computed = bindings._computed as Record<string, unknown>;
                  const thresholdMet = computed.thresholdMet as boolean;
                  return {
                    ...rec,
                    decisions: computed.updatedDecisions,
                    status: thresholdMet ? 'approved' : 'pending',
                    resolved_at: thresholdMet ? new Date().toISOString() : null,
                  };
                });

                return completeFrom(d, 'ok', (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const computed = bindings._computed as Record<string, unknown>;
                  const thresholdMet = computed.thresholdMet as boolean;
                  if (thresholdMet) {
                    return {
                      approval: approvalId,
                      step_ref: rec.step_ref as string,
                    };
                  }
                  return {
                    _variant: 'pending',
                    approval: approvalId,
                    decisions_so_far: computed.approveCount as number,
                    required: computed.required as number,
                  };
                });
              })(),
            );
          })(),
        );
      })(),
    );
  },

  // action deny(approval: A, actor: String, reason: String)
  //   -> ok(approval: A, step_ref: String, reason: String) — denied
  //   -> ok(approval: A)                                   — no longer pending
  //   -> ok(actor: String)                                 — actor not authorized
  deny(input: Record<string, unknown>) {
    const approvalId = input.approval as string;
    const actor = input.actor as string;
    const reason = input.reason as string;

    if (!actor || actor.trim() === '') {
      return complete(createProgram(), 'error', { message: 'actor is required' });
    }

    let p = createProgram();
    p = get(p, 'approval', approvalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Approval not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'approval', approvalId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'pending';
          },
          completeFrom(createProgram(), 'ok', () => ({ approval: approvalId })),
          (() => {
            // Check actor authorization
            let c = createProgram();
            c = get(c, 'approval', approvalId, 'existing');
            return branch(c,
              (bindings) => {
                const rec = bindings.existing as Record<string, unknown>;
                const policy = rec.policy as Record<string, unknown>;
                const roles = policy.roles as string[];
                return roles.length > 0 && !roles.includes(actor);
              },
              completeFrom(createProgram(), 'ok', () => ({ actor })),
              (() => {
                let d = createProgram();
                d = get(d, 'approval', approvalId, 'existing');
                const now = new Date().toISOString();
                d = putFrom(d, 'approval', approvalId, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const decisions = (rec.decisions as unknown[]) || [];
                  const newDecision = {
                    actor,
                    decision: 'deny',
                    comment: reason || null,
                    decided_at: now,
                  };
                  return {
                    ...rec,
                    decisions: [...decisions, newDecision],
                    status: 'denied',
                    resolved_at: now,
                  };
                });
                return completeFrom(d, 'ok', (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  return {
                    approval: approvalId,
                    step_ref: rec.step_ref as string,
                    reason,
                  };
                });
              })(),
            );
          })(),
        );
      })(),
    );
  },

  // action request_changes(approval: A, actor: String, feedback: String)
  //   -> ok(approval: A, step_ref: String, feedback: String) — changes requested
  //   -> ok(approval: A)                                     — no longer pending
  request_changes(input: Record<string, unknown>) {
    const approvalId = input.approval as string;
    const actor = input.actor as string;
    const feedback = input.feedback as string;

    let p = createProgram();
    p = get(p, 'approval', approvalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Approval not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'approval', approvalId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'pending';
          },
          completeFrom(createProgram(), 'ok', () => ({ approval: approvalId })),
          (() => {
            let c = createProgram();
            c = get(c, 'approval', approvalId, 'existing');
            const now = new Date().toISOString();
            c = putFrom(c, 'approval', approvalId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              const decisions = (rec.decisions as unknown[]) || [];
              const newDecision = {
                actor,
                decision: 'request_changes',
                comment: feedback || null,
                decided_at: now,
              };
              return {
                ...rec,
                decisions: [...decisions, newDecision],
                status: 'changes_requested',
                resolved_at: now,
              };
            });
            return completeFrom(c, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                approval: approvalId,
                step_ref: rec.step_ref as string,
                feedback,
              };
            });
          })(),
        );
      })(),
    );
  },

  // action timeout(approval: A)
  //   -> ok(approval: A, step_ref: String) — timed out
  //   -> ok(approval: A)                   — no longer pending
  timeout(input: Record<string, unknown>) {
    const approvalId = input.approval as string;

    let p = createProgram();
    p = get(p, 'approval', approvalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { message: 'Approval not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'approval', approvalId, 'existing');
        return branch(b,
          (bindings) => {
            const rec = bindings.existing as Record<string, unknown>;
            return rec.status !== 'pending';
          },
          completeFrom(createProgram(), 'ok', () => ({ approval: approvalId })),
          (() => {
            let c = createProgram();
            c = get(c, 'approval', approvalId, 'existing');
            const now = new Date().toISOString();
            c = putFrom(c, 'approval', approvalId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                ...rec,
                status: 'timed_out',
                resolved_at: now,
              };
            });
            return completeFrom(c, 'ok', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                approval: approvalId,
                step_ref: rec.step_ref as string,
              };
            });
          })(),
        );
      })(),
    );
  },

  // action get_status(approval: A)
  //   -> ok(approval: A, status: String, decisions: Bytes)
  //   -> not_found(approval: A)
  get_status(input: Record<string, unknown>) {
    const approvalId = input.approval as string;

    let p = createProgram();
    p = get(p, 'approval', approvalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { approval: approvalId }),
      (() => {
        let b = createProgram();
        b = get(b, 'approval', approvalId, 'existing');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            approval: approvalId,
            status: rec.status as string,
            decisions: JSON.stringify(rec.decisions),
          };
        });
      })(),
    );
  },
};

export const approvalHandler = autoInterpret(_handler);
