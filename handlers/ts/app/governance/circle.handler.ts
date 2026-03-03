// Circle Concept Handler
// Nested governance groups with holacratic jurisdiction management.
import type { ConceptHandler } from '@clef/runtime';

export const circleHandler: ConceptHandler = {
  async create(input, storage) {
    const id = `circle-${Date.now()}`;
    await storage.put('circle', id, {
      id, name: input.name, domain: input.domain, purpose: input.purpose,
      parent: input.parent ?? null, members: [], createdAt: new Date().toISOString(),
    });
    return { variant: 'created', circle: id };
  },

  async assignMember(input, storage) {
    const { circle, member, role } = input;
    const record = await storage.get('circle', circle as string);
    if (!record) return { variant: 'not_found', circle };
    const members = (record.members as string[]);
    if (!members.includes(member as string)) members.push(member as string);
    await storage.put('circle', circle as string, { ...record, members });
    return { variant: 'member_assigned', circle, member };
  },

  async removeMember(input, storage) {
    const { circle, member } = input;
    const record = await storage.get('circle', circle as string);
    if (!record) return { variant: 'not_found', circle };
    const members = (record.members as string[]).filter(m => m !== member);
    await storage.put('circle', circle as string, { ...record, members });
    return { variant: 'member_removed', circle, member };
  },

  async setLinks(input, storage) {
    const { circle, leadLink, repLink } = input;
    const record = await storage.get('circle', circle as string);
    if (!record) return { variant: 'not_found', circle };
    await storage.put('circle', circle as string, { ...record, leadLink, repLink });
    return { variant: 'links_set', circle };
  },

  async dissolve(input, storage) {
    const { circle } = input;
    await storage.del('circle', circle as string);
    return { variant: 'dissolved', circle };
  },

  async checkJurisdiction(input, storage) {
    const { circle, action } = input;
    const record = await storage.get('circle', circle as string);
    if (!record) return { variant: 'not_found', circle };
    return { variant: 'within_jurisdiction', circle, action };
  },
};
