// @migrated dsl-constructs 2026-03-18
// CedarEvaluator Policy Provider
// Permit/forbid policies matching principal+action+resource; forbid overrides permit.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

interface CedarPolicy {
  effect: 'permit' | 'forbid';
  principal?: string;
  action?: string;
  resource?: string;
  conditions?: Record<string, unknown>;
}

function matchesPolicy(policy: CedarPolicy, principal: string, action: string, resource: string): boolean {
  if (policy.principal && policy.principal !== principal && policy.principal !== '*') return false;
  if (policy.action && policy.action !== action && policy.action !== '*') return false;
  if (policy.resource && policy.resource !== resource && policy.resource !== '*') return false;
  return true;
}

function evaluatePolicies(policies: CedarPolicy[], principal: string, action: string, resource: string): { effect: 'allow' | 'deny'; reason?: string } {
  let hasPermit = false;

  for (const policy of policies) {
    if (!matchesPolicy(policy, principal, action, resource)) continue;

    if (policy.effect === 'forbid') {
      return {
        effect: 'deny',
        reason: `Forbidden by policy: ${policy.principal ?? '*'}/${policy.action ?? '*'}/${policy.resource ?? '*'}`,
      };
    }

    if (policy.effect === 'permit') {
      hasPermit = true;
    }
  }

  if (hasPermit) return { effect: 'allow' };
  return { effect: 'deny', reason: 'No matching permit policy' };
}

type Result = { variant: string; [key: string]: unknown };

const _cedarEvaluatorHandler: FunctionalConceptHandler = {
  loadPolicies(input: Record<string, unknown>) {
    const id = `cedar-${Date.now()}`;
    const policies = typeof input.policies === 'string'
      ? JSON.parse(input.policies)
      : input.policies;

    let p = createProgram();
    p = put(p, 'cedar', id, {
      id,
      policies: JSON.stringify(policies),
      schema: input.schema ?? null,
    });

    p = put(p, 'plugin-registry', `policy-evaluator:${id}`, {
      id: `policy-evaluator:${id}`,
      pluginKind: 'policy-evaluator',
      provider: 'CedarEvaluator',
      instanceId: id,
    });

    return complete(p, 'loaded', { store: id }) as StorageProgram<Result>;
  },

  authorize(input: Record<string, unknown>) {
    const { store, principal, action, resource, context } = input;
    let p = createProgram();
    p = get(p, 'cedar', store as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'authorize_result', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const policies = JSON.parse(record.policies as string) as CedarPolicy[];
          const result = evaluatePolicies(policies, principal as string, action as string, resource as string);

          if (result.effect === 'allow') {
            return { variant: 'allow', store };
          }
          return { variant: 'deny', store, reason: result.reason };
        });
      },
      (elseP) => complete(elseP, 'not_found', { store }),
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const { store, property } = input;
    let p = createProgram();
    p = get(p, 'cedar', store as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'verified', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const policies = JSON.parse(record.policies as string) as CedarPolicy[];

          // Verify structural properties
          if (property === 'no_conflicts') {
            const signatures = new Map<string, string[]>();
            for (const pol of policies) {
              const sig = `${pol.principal ?? '*'}:${pol.action ?? '*'}:${pol.resource ?? '*'}`;
              if (!signatures.has(sig)) signatures.set(sig, []);
              signatures.get(sig)!.push(pol.effect);
            }
            for (const [sig, effects] of signatures) {
              if (effects.includes('permit') && effects.includes('forbid')) {
                return { variant: 'conflict_found', store, property, conflictAt: sig };
              }
            }
          }

          return { variant: 'verified', store, property };
        });
      },
      (elseP) => complete(elseP, 'not_found', { store }),
    ) as StorageProgram<Result>;
  },
};

export const cedarEvaluatorHandler = autoInterpret(_cedarEvaluatorHandler);
