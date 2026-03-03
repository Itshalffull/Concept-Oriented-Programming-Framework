// Guard Concept Handler
// Pre/post execution safety checks (Zodiac Guard pattern).
import type { ConceptHandler } from '@clef/runtime';

export const guardHandler: ConceptHandler = {
  async register(input, storage) {
    const id = `guard-${Date.now()}`;
    await storage.put('guard', id, {
      id, name: input.name, targetAction: input.targetAction,
      checkType: input.checkType, condition: input.condition,
      enabled: true, registeredAt: new Date().toISOString(),
    });
    return { variant: 'registered', guard: id };
  },

  async checkPre(input, storage) {
    const { guard, context } = input;
    const record = await storage.get('guard', guard as string);
    if (!record || !record.enabled) return { variant: 'guard_disabled', guard };
    // Stub: real impl evaluates condition against context
    return { variant: 'allowed', guard };
  },

  async checkPost(input, storage) {
    const { guard, context, result } = input;
    const record = await storage.get('guard', guard as string);
    if (!record || !record.enabled) return { variant: 'guard_disabled', guard };
    return { variant: 'passed', guard };
  },

  async enable(input, storage) {
    const { guard } = input;
    const record = await storage.get('guard', guard as string);
    if (!record) return { variant: 'not_found', guard };
    await storage.put('guard', guard as string, { ...record, enabled: true });
    return { variant: 'enabled', guard };
  },

  async disable(input, storage) {
    const { guard } = input;
    const record = await storage.get('guard', guard as string);
    if (!record) return { variant: 'not_found', guard };
    await storage.put('guard', guard as string, { ...record, enabled: false });
    return { variant: 'disabled', guard };
  },
};
