// Group Concept Implementation
// Isolated content spaces with group-level role-based access control for multi-tenant collaboration.
import type { ConceptHandler } from '@clef/runtime';

export const groupHandler: ConceptHandler = {
  async createGroup(input, storage) {
    const group = input.group as string;
    const name = input.name as string;

    const existing = await storage.get('group', group);
    if (existing) {
      return { variant: 'exists', message: 'Group already exists' };
    }

    await storage.put('group', group, {
      group,
      name,
      members: JSON.stringify([]),
      content: JSON.stringify([]),
    });

    return { variant: 'ok' };
  },

  async addMember(input, storage) {
    const group = input.group as string;
    const user = input.user as string;
    const role = input.role as string;

    const existing = await storage.get('group', group);
    if (!existing) {
      return { variant: 'notfound', message: 'Group does not exist' };
    }

    const members: Array<{ user: string; role: string }> = JSON.parse(
      (existing.members as string) || '[]',
    );

    // Update role if member already exists, otherwise add new member
    const memberIndex = members.findIndex((m) => m.user === user);
    if (memberIndex >= 0) {
      members[memberIndex].role = role;
    } else {
      members.push({ user, role });
    }

    await storage.put('group', group, {
      ...existing,
      members: JSON.stringify(members),
    });

    return { variant: 'ok' };
  },

  async assignGroupRole(input, storage) {
    const group = input.group as string;
    const user = input.user as string;
    const role = input.role as string;

    const existing = await storage.get('group', group);
    if (!existing) {
      return { variant: 'notfound', message: 'Group does not exist' };
    }

    const members: Array<{ user: string; role: string }> = JSON.parse(
      (existing.members as string) || '[]',
    );

    const memberIndex = members.findIndex((m) => m.user === user);
    if (memberIndex < 0) {
      return { variant: 'notfound', message: 'Member does not exist in this group' };
    }

    members[memberIndex].role = role;

    await storage.put('group', group, {
      ...existing,
      members: JSON.stringify(members),
    });

    return { variant: 'ok' };
  },

  async addContent(input, storage) {
    const group = input.group as string;
    const content = input.content as string;

    const existing = await storage.get('group', group);
    if (!existing) {
      return { variant: 'notfound', message: 'Group does not exist' };
    }

    const contentList: string[] = JSON.parse(
      (existing.content as string) || '[]',
    );

    if (!contentList.includes(content)) {
      contentList.push(content);
    }

    await storage.put('group', group, {
      ...existing,
      content: JSON.stringify(contentList),
    });

    return { variant: 'ok' };
  },

  async checkGroupAccess(input, storage) {
    const group = input.group as string;
    const user = input.user as string;
    const permission = input.permission as string;

    const existing = await storage.get('group', group);
    if (!existing) {
      return { variant: 'notfound', message: 'Group does not exist' };
    }

    const members: Array<{ user: string; role: string }> = JSON.parse(
      (existing.members as string) || '[]',
    );

    const member = members.find((m) => m.user === user);
    if (!member) {
      return { variant: 'ok', granted: false };
    }

    // Role-based permission mapping
    const rolePermissions: Record<string, string[]> = {
      admin: ['read', 'write', 'delete', 'manage'],
      moderator: ['read', 'write', 'delete'],
      member: ['read', 'write'],
      viewer: ['read'],
    };

    const allowed = rolePermissions[member.role] || [];
    const granted = allowed.includes(permission);

    return { variant: 'ok', granted };
  },
};
