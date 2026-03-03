// Delegation Concept Handler
// Transitive decision power transfer with cycle detection.
import type { ConceptHandler } from '@clef/runtime';

export const delegationHandler: ConceptHandler = {
  async delegate(input, storage) {
    const { from, to, scope, expiresAt } = input;
    // Simple cycle detection: check if 'to' already delegates to 'from'
    const reverse = await storage.get('delegation', `${to}:${from}`);
    if (reverse) return { variant: 'cycle_detected', from, to };
    const id = `deleg-${Date.now()}`;
    await storage.put('delegation', `${from}:${to}`, { id, from, to, scope, expiresAt: expiresAt ?? null, createdAt: new Date().toISOString() });
    return { variant: 'delegated', edge: id };
  },

  async undelegate(input, storage) {
    const { from, to } = input;
    const record = await storage.get('delegation', `${from}:${to}`);
    if (!record) return { variant: 'not_found', from, to };
    await storage.del('delegation', `${from}:${to}`);
    return { variant: 'undelegated', from, to };
  },

  async getEffectiveWeight(input, storage) {
    const { participant } = input;
    // Stub: return base weight of 1 (real impl would traverse delegation graph)
    return { variant: 'weight', participant, effectiveWeight: 1.0, delegators: [] };
  },
};
