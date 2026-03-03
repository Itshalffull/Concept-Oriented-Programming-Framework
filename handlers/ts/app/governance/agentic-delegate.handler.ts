// AgenticDelegate Concept Handler
// Register and constrain AI agents participating in governance.
import type { ConceptHandler } from '@clef/runtime';

export const agenticDelegateHandler: ConceptHandler = {
  async register(input, storage) {
    const id = `delegate-${Date.now()}`;
    await storage.put('delegate', id, {
      id, name: input.name, principal: input.principal,
      autonomyLevel: input.autonomyLevel, allowedActions: input.allowedActions,
      registeredAt: new Date().toISOString(), active: true,
    });
    return { variant: 'registered', delegate: id };
  },

  async assumeRole(input, storage) {
    const { delegate, role } = input;
    const record = await storage.get('delegate', delegate as string);
    if (!record) return { variant: 'not_found', delegate };
    await storage.put('delegate', delegate as string, { ...record, currentRole: role });
    return { variant: 'role_assumed', delegate, role };
  },

  async releaseRole(input, storage) {
    const { delegate } = input;
    const record = await storage.get('delegate', delegate as string);
    if (!record) return { variant: 'not_found', delegate };
    await storage.put('delegate', delegate as string, { ...record, currentRole: null });
    return { variant: 'role_released', delegate };
  },

  async proposeAction(input, storage) {
    const { delegate, action, rationale } = input;
    const record = await storage.get('delegate', delegate as string);
    if (!record) return { variant: 'not_found', delegate };
    const allowed = (record.allowedActions as string[]).includes(action as string);
    if (!allowed) return { variant: 'action_denied', delegate, action };
    return { variant: 'proposed', delegate, action };
  },

  async escalate(input, storage) {
    const { delegate, action, reason } = input;
    return { variant: 'escalated', delegate, action, reason };
  },

  async updateAutonomy(input, storage) {
    const { delegate, autonomyLevel } = input;
    const record = await storage.get('delegate', delegate as string);
    if (!record) return { variant: 'not_found', delegate };
    await storage.put('delegate', delegate as string, { ...record, autonomyLevel });
    return { variant: 'updated', delegate };
  },
};
