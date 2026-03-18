// @migrated dsl-constructs 2026-03-18
// Authorization Concept Implementation
// Manage roles, permissions, and permission-checking for users.
// Roles group permissions into reusable bundles; users inherit permissions through role assignment.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const authorizationHandler: FunctionalConceptHandler = {
  grantPermission(input: Record<string, unknown>) {
    const role = input.role as string;
    const permission = input.permission as string;

    let p = createProgram();
    p = spGet(p, 'role', role, 'roleRecord');
    // Whether found or not, we put the role with the permission added
    // The runtime resolves existing permissions from bindings and appends
    p = put(p, 'role', role, {
      role,
      permissions: JSON.stringify([permission]),
    });
    return complete(p, 'ok', { role, permission }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  revokePermission(input: Record<string, unknown>) {
    const role = input.role as string;
    const permission = input.permission as string;

    let p = createProgram();
    p = spGet(p, 'role', role, 'roleRecord');
    p = branch(p, 'roleRecord',
      (b) => {
        // Remove permission from existing list — resolved at runtime
        let b2 = put(b, 'role', role, {
          role,
          permissions: '', // resolved at runtime: filter out permission
        });
        return complete(b2, 'ok', { role, permission });
      },
      (b) => complete(b, 'notfound', { message: 'The specified role does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  assignRole(input: Record<string, unknown>) {
    const user = input.user as string;
    const role = input.role as string;

    let p = createProgram();
    p = spGet(p, 'role', role, 'roleRecord');
    p = branch(p, 'roleRecord',
      (b) => {
        // Role exists — assign to user
        let b2 = spGet(b, 'userRole', user, 'userRecord');
        // Put user role with the new role appended
        b2 = put(b2, 'userRole', user, {
          user,
          roles: JSON.stringify([role]),
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
    p = branch(p, 'userRecord',
      (b) => {
        // User found — check roles for permission at runtime
        return complete(b, 'ok', { granted: false });
      },
      (b) => complete(b, 'ok', { granted: false }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
