// @clef-handler style=functional
// Milestone Concept Implementation
// Track achievement of significant process goals declaratively,
// without prescribing which specific steps cause achievement.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _milestoneHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { concept: 'Milestone' }) as StorageProgram<Result>;
  },

  define(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const name = input.name as string;
    const conditionExpr = input.condition_expr as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!conditionExpr || conditionExpr.trim() === '') {
      return complete(createProgram(), 'error', { message: 'condition_expr is required' }) as StorageProgram<Result>;
    }

    const milestoneId = `ms-${runRef}-${name}`;

    let p = createProgram();
    p = spGet(p, 'milestone', milestoneId, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'error', { message: 'Milestone already exists' }),
      (b) => {
        const record = {
          milestone: milestoneId,
          run_ref: runRef,
          name,
          status: 'pending',
          condition_expr: conditionExpr,
          achieved_at: null,
        };
        let b2 = put(b, 'milestone', milestoneId, record);
        return complete(b2, 'ok', { milestone: milestoneId });
      },
    );
    return p as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const milestone = input.milestone as string;
    const context = input.context as string;

    if (!milestone || milestone.trim() === '') {
      return complete(createProgram(), 'error', { message: 'milestone is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'milestone', milestone, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Check if already achieved
        p = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status');
        return branch(p, '_status',
          // status is truthy (non-empty string) - check its value
          (b2) => {
            p = mapBindings(b2, (bindings) => {
              return (bindings._status as string) === 'achieved';
            }, '_alreadyAchieved');
            return branch(p, '_alreadyAchieved',
              // Already achieved - return ok with milestone
              (b3) => completeFrom(b3, 'ok', (bindings) => ({
                milestone: (bindings.existing as Record<string, unknown>).milestone as string,
              })),
              // Not yet achieved - evaluate condition
              (b3) => {
                // Attempt to evaluate the condition expression against context
                p = mapBindings(b3, (bindings) => {
                  const rec = bindings.existing as Record<string, unknown>;
                  const expr = rec.condition_expr as string;
                  try {
                    const ctx = context ? JSON.parse(context) : {};
                    // Simple expression evaluation: check if a context key matches
                    // Supports "key == value" style expressions
                    const match = expr.match(/^\s*(\w+)\s*==\s*(.+)\s*$/);
                    if (match) {
                      const [, key, val] = match;
                      const ctxVal = String(ctx[key] ?? '');
                      const expected = val.trim().replace(/^['"]|['"]$/g, '');
                      return ctxVal === expected;
                    }
                    // Supports "key >= number" comparisons
                    const cmpMatch = expr.match(/^\s*(\w+)\s*(>=|<=|>|<)\s*(\d+(?:\.\d+)?)\s*$/);
                    if (cmpMatch) {
                      const [, key, op, numStr] = cmpMatch;
                      const ctxVal = Number(ctx[key] ?? 0);
                      const num = Number(numStr);
                      switch (op) {
                        case '>=': return ctxVal >= num;
                        case '<=': return ctxVal <= num;
                        case '>': return ctxVal > num;
                        case '<': return ctxVal < num;
                      }
                    }
                    // Default: treat expression as a boolean context key
                    return !!ctx[expr];
                  } catch {
                    return false;
                  }
                }, '_conditionMet');
                return branch(p, '_conditionMet',
                  // Condition met - transition to achieved
                  (b4) => {
                    const now = new Date().toISOString();
                    let b5 = putFrom(b4, 'milestone', milestone, (bindings) => {
                      const rec = bindings.existing as Record<string, unknown>;
                      return { ...rec, status: 'achieved', achieved_at: now };
                    });
                    return completeFrom(b5, 'achieved', (bindings) => {
                      const rec = bindings.existing as Record<string, unknown>;
                      return {
                        milestone,
                        name: rec.name as string,
                        run_ref: rec.run_ref as string,
                      };
                    });
                  },
                  // Condition not met - remains pending
                  (b4) => complete(b4, 'ok', { milestone }),
                );
              },
            );
          },
          // status is falsy (shouldn't happen, but handle gracefully)
          (b2) => complete(b2, 'ok', { milestone }),
        );
      },
      (b) => complete(b, 'error', { message: 'Milestone not found' }),
    );
    return p as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const milestone = input.milestone as string;

    if (!milestone || milestone.trim() === '') {
      return complete(createProgram(), 'error', { message: 'milestone is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'milestone', milestone, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'milestone', milestone, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'pending', achieved_at: null };
        });
        return complete(b2, 'ok', { milestone });
      },
      (b) => complete(b, 'error', { message: 'Milestone not found' }),
    );
    return p as StorageProgram<Result>;
  },
};

export const milestoneHandler = autoInterpret(_milestoneHandler);
