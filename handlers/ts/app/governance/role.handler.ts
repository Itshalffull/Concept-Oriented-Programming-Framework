// Role Concept Handler
// Named capacities with permissions, assignment, and revocation.
import type { ConceptHandler } from '@clef/runtime';

export const roleHandler: ConceptHandler = {
  async create(input, storage) {
    const id = `role-${Date.now()}`;
    await storage.put('role', id, { id, name: input.name, permissions: input.permissions, polity: input.polity });
    return { variant: 'created', role: id };
  },

  async assign(input, storage) {
    const { role, member, assignedBy } = input;
    await storage.put('assignment', `${role}:${member}`, { role, member, assignedBy, assignedAt: new Date().toISOString() });
    return { variant: 'assigned', assignment: `${role}:${member}` };
  },

  async revoke(input, storage) {
    const { role, member } = input;
    const key = `${role}:${member}`;
    const record = await storage.get('assignment', key);
    if (!record) return { variant: 'not_assigned', role, member };
    await storage.del('assignment', key);
    return { variant: 'revoked', role, member };
  },

  async check(input, storage) {
    const { role, member } = input;
    const record = await storage.get('assignment', `${role}:${member}`);
    if (record) return { variant: 'has_role', role, member };
    return { variant: 'no_role', role, member };
  },

  async dissolve(input, storage) {
    const { role } = input;
    await storage.del('role', role as string);
    return { variant: 'dissolved', role };
  },
};
