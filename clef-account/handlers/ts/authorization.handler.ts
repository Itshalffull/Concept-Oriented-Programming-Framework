import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read', 'write', 'delete', 'manage', 'publish'],
  user: ['read', 'write', 'publish'],
  viewer: ['read'],
};

export const authorizationHandler: ConceptHandler = {
  async grantRole(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const role = input.role as string;

    const existing = await storage.get('userRole', `${user}:${role}`);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('userRole', `${user}:${role}`, { user, role });

    // Ensure role permissions are registered
    if (DEFAULT_ROLE_PERMISSIONS[role]) {
      for (const perm of DEFAULT_ROLE_PERMISSIONS[role]) {
        await storage.put('rolePermission', `${role}:${perm}`, { role, permission: perm });
      }
    }

    return { variant: 'ok' };
  },

  async revokeRole(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const role = input.role as string;

    const existing = await storage.get('userRole', `${user}:${role}`);
    if (!existing) {
      return { variant: 'notfound' };
    }

    await storage.del('userRole', `${user}:${role}`);
    return { variant: 'ok' };
  },

  async checkPermission(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const permission = input.permission as string;

    const userRoles = await storage.find('userRole', { user });
    for (const ur of userRoles) {
      const role = ur.role as string;
      const rolePerm = await storage.get('rolePermission', `${role}:${permission}`);
      if (rolePerm) {
        return { variant: 'allowed' };
      }
    }

    return { variant: 'denied' };
  },

  async listRoles(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const userRoles = await storage.find('userRole', { user });
    const roles = userRoles.map((ur) => ur.role as string);
    return { variant: 'ok', roles: JSON.stringify(roles) };
  },
};
