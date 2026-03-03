// CedarEvaluator Policy Provider
// Permit/forbid policies matching principal+action+resource; forbid overrides permit.
import type { ConceptHandler } from '@clef/runtime';

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

export const cedarEvaluatorHandler: ConceptHandler = {
  async loadPolicies(input, storage) {
    const id = `cedar-${Date.now()}`;
    const policies = typeof input.policies === 'string'
      ? JSON.parse(input.policies)
      : input.policies;

    await storage.put('cedar', id, {
      id,
      policies: JSON.stringify(policies),
      schema: input.schema ?? null,
    });

    await storage.put('plugin-registry', `policy-evaluator:${id}`, {
      id: `policy-evaluator:${id}`,
      pluginKind: 'policy-evaluator',
      provider: 'CedarEvaluator',
      instanceId: id,
    });

    return { variant: 'loaded', store: id };
  },

  async authorize(input, storage) {
    const { store, principal, action, resource, context } = input;
    const record = await storage.get('cedar', store as string);
    if (!record) return { variant: 'not_found', store };

    const policies = JSON.parse(record.policies as string) as CedarPolicy[];
    const p = principal as string;
    const a = action as string;
    const r = resource as string;

    let hasPermit = false;

    for (const policy of policies) {
      if (!matchesPolicy(policy, p, a, r)) continue;

      // Forbid overrides permit
      if (policy.effect === 'forbid') {
        return {
          variant: 'deny',
          store,
          reason: `Forbidden by policy: ${policy.principal ?? '*'}/${policy.action ?? '*'}/${policy.resource ?? '*'}`,
        };
      }

      if (policy.effect === 'permit') {
        hasPermit = true;
      }
    }

    if (hasPermit) {
      return { variant: 'allow', store };
    }

    // Default deny — no matching permit policy
    return { variant: 'deny', store, reason: 'No matching permit policy' };
  },

  async verify(input, storage) {
    const { store, property } = input;
    const record = await storage.get('cedar', store as string);
    if (!record) return { variant: 'not_found', store };

    const policies = JSON.parse(record.policies as string) as CedarPolicy[];

    // Verify structural properties
    if (property === 'no_conflicts') {
      // Check for conflicting permit/forbid on same principal+action+resource
      const signatures = new Map<string, string[]>();
      for (const p of policies) {
        const sig = `${p.principal ?? '*'}:${p.action ?? '*'}:${p.resource ?? '*'}`;
        if (!signatures.has(sig)) signatures.set(sig, []);
        signatures.get(sig)!.push(p.effect);
      }
      for (const [sig, effects] of signatures) {
        if (effects.includes('permit') && effects.includes('forbid')) {
          return { variant: 'conflict_found', store, property, conflictAt: sig };
        }
      }
    }

    return { variant: 'verified', store, property };
  },
};
