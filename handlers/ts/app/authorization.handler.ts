// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Authorization Concept Implementation
// Manage roles, permissions, and permission-checking for users.
// Roles group permissions into reusable bundles; users inherit permissions through role assignment.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom, find,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _authorizationHandler: FunctionalConceptHandler = {
  grantPermission(input: Record<string, unknown>) {
    if (!input.role || (typeof input.role === 'string' && (input.role as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }
    const role = input.role as string;
    const permission = input.permission as string;

    let p = createProgram();
    p = spGet(p, 'role', role, 'roleRecord');
    p = putFrom(p, 'role', role, (bindings) => {
      const existing = (bindings.roleRecord as Record<string, unknown>) || { role, permissions: '[]' };
      const permissions: string[] = JSON.parse((existing.permissions as string) || '[]');
      if (!permissions.includes(permission)) permissions.push(permission);
      return { ...existing, role, permissions: JSON.stringify(permissions) };
    });
    return complete(p, 'ok', { role, permission }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  revokePermission(input: Record<string, unknown>) {
    if (!input.role || (typeof input.role === 'string' && (input.role as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }
    const role = input.role as string;
    const permission = input.permission as string;

    let p = createProgram();
    p = spGet(p, 'role', role, 'roleRecord');
    p = branch(p, 'roleRecord',
      (b) => {
        let b2 = putFrom(b, 'role', role, (bindings) => {
          const existing = bindings.roleRecord as Record<string, unknown>;
          const permissions: string[] = JSON.parse((existing.permissions as string) || '[]');
          return { ...existing, permissions: JSON.stringify(permissions.filter(p => p !== permission)) };
        });
        return complete(b2, 'ok', { role, permission });
      },
      (b) => complete(b, 'notfound', { message: 'The specified role does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  assignRole(input: Record<string, unknown>) {
    if (!input.role || (typeof input.role === 'string' && (input.role as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }
    const user = input.user as string;
    const role = input.role as string;

    let p = createProgram();
    p = spGet(p, 'role', role, 'roleRecord');
    p = branch(p, 'roleRecord',
      (b) => {
        // Role exists — assign to user
        let b2 = spGet(b, 'userRole', user, 'userRecord');
        b2 = putFrom(b2, 'userRole', user, (bindings) => {
          const existing = (bindings.userRecord as Record<string, unknown>) || { user, roles: '[]' };
          const roles: string[] = JSON.parse((existing.roles as string) || '[]');
          if (!roles.includes(role)) roles.push(role);
          return { ...existing, user, roles: JSON.stringify(roles) };
        });
        return complete(b2, 'ok', { user, role });
      },
      (b) => complete(b, 'notfound', { message: 'The specified role does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  checkPermission(input: Record<string, unknown>) {
    const user = input.user as string;
    const permission = input.permission as string;

    let p = createProgram();
    p = spGet(p, 'userRole', user, 'userRecord');
    p = find(p, 'role', {}, 'allRoles');
    p = branch(p, 'userRecord',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const userRecord = bindings.userRecord as Record<string, unknown>;
          const userRoles: string[] = JSON.parse((userRecord.roles as string) || '[]');
          const allRoles = (bindings.allRoles as Array<Record<string, unknown>>) || [];
          for (const roleName of userRoles) {
            const roleRecord = allRoles.find(r => r.role === roleName);
            if (roleRecord) {
              const permissions: string[] = JSON.parse((roleRecord.permissions as string) || '[]');
              if (permissions.includes(permission)) return { granted: true };
            }
          }
          return { granted: false };
        });
      },
      (b) => complete(b, 'error', { granted: false, message: 'user has no roles' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const authorizationHandler = autoInterpret(_authorizationHandler);

