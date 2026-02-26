// Authorization Concept Implementation
// Manage roles, permissions, and permission-checking for users.
// Roles group permissions into reusable bundles; users inherit permissions through role assignment.
import type { ConceptHandler } from '@clef/kernel';

export const authorizationHandler: ConceptHandler = {
  async grantPermission(input, storage) {
    const role = input.role as string;
    const permission = input.permission as string;

    // Ensure the role exists; create it if this is the first grant
    let roleRecord = await storage.get('role', role);
    if (!roleRecord) {
      // Auto-create the role on first permission grant
      roleRecord = { role, permissions: JSON.stringify([]) };
    }

    const permissions: string[] = JSON.parse(roleRecord.permissions as string);

    // Idempotent: if permission is already granted, still return ok
    if (!permissions.includes(permission)) {
      permissions.push(permission);
    }

    await storage.put('role', role, {
      role,
      permissions: JSON.stringify(permissions),
    });

    return { variant: 'ok', role, permission };
  },

  async revokePermission(input, storage) {
    const role = input.role as string;
    const permission = input.permission as string;

    const roleRecord = await storage.get('role', role);
    if (!roleRecord) {
      return { variant: 'notfound', message: 'The specified role does not exist' };
    }

    const permissions: string[] = JSON.parse(roleRecord.permissions as string);
    const index = permissions.indexOf(permission);
    if (index === -1) {
      return { variant: 'notfound', message: 'The specified permission does not exist on this role' };
    }

    permissions.splice(index, 1);

    await storage.put('role', role, {
      role,
      permissions: JSON.stringify(permissions),
    });

    return { variant: 'ok', role, permission };
  },

  async assignRole(input, storage) {
    const user = input.user as string;
    const role = input.role as string;

    // Verify the role exists
    const roleRecord = await storage.get('role', role);
    if (!roleRecord) {
      return { variant: 'notfound', message: 'The specified role does not exist' };
    }

    // Get or create the user's role set
    let userRecord = await storage.get('userRole', user);
    const roles: string[] = userRecord
      ? JSON.parse(userRecord.roles as string)
      : [];

    if (!roles.includes(role)) {
      roles.push(role);
    }

    await storage.put('userRole', user, {
      user,
      roles: JSON.stringify(roles),
    });

    return { variant: 'ok', user, role };
  },

  async checkPermission(input, storage) {
    const user = input.user as string;
    const permission = input.permission as string;

    // Get the user's assigned roles
    const userRecord = await storage.get('userRole', user);
    if (!userRecord) {
      return { variant: 'ok', granted: false };
    }

    const roles: string[] = JSON.parse(userRecord.roles as string);

    // Check each role for the requested permission
    for (const roleName of roles) {
      const roleRecord = await storage.get('role', roleName);
      if (roleRecord) {
        const permissions: string[] = JSON.parse(roleRecord.permissions as string);
        if (permissions.includes(permission)) {
          return { variant: 'ok', granted: true };
        }
      }
    }

    return { variant: 'ok', granted: false };
  },
};
