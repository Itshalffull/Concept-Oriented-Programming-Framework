// AccessControl Concept Implementation
// Evaluate three-valued access decisions (allowed/forbidden/neutral) with cacheable results.
// Policies are composable via logical OR and AND combinators.
import type { ConceptHandler } from '@copf/kernel';

export const accessControlHandler: ConceptHandler = {
  async check(input, storage) {
    const resource = input.resource as string;
    const action = input.action as string;
    const context = input.context as string;

    // Look up all applicable policies for this resource+action pair
    const policyKey = `${resource}:${action}`;
    const policyRecord = await storage.get('policy', policyKey);

    if (!policyRecord) {
      // No policy registered: neutral result with default cache
      return { variant: 'ok', result: 'neutral', tags: '', maxAge: 0 };
    }

    return {
      variant: 'ok',
      result: policyRecord.result as string,
      tags: policyRecord.tags as string,
      maxAge: policyRecord.maxAge as number,
    };
  },

  async orIf(input, _storage) {
    const left = input.left as string;
    const right = input.right as string;

    // Forbidden takes precedence over everything
    if (left === 'forbidden' || right === 'forbidden') {
      return { variant: 'ok', result: 'forbidden' };
    }

    // Allowed if either is allowed
    if (left === 'allowed' || right === 'allowed') {
      return { variant: 'ok', result: 'allowed' };
    }

    // Both must be neutral
    return { variant: 'ok', result: 'neutral' };
  },

  async andIf(input, _storage) {
    const left = input.left as string;
    const right = input.right as string;

    // Forbidden wins over everything
    if (left === 'forbidden' || right === 'forbidden') {
      return { variant: 'ok', result: 'forbidden' };
    }

    // Allowed only if both are allowed
    if (left === 'allowed' && right === 'allowed') {
      return { variant: 'ok', result: 'allowed' };
    }

    // Otherwise neutral (at least one is neutral, neither is forbidden)
    return { variant: 'ok', result: 'neutral' };
  },
};
