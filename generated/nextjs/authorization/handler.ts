// Authorization — handler.ts
// Real fp-ts domain logic for role-based access control with permission inheritance.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AuthorizationStorage,
  AuthorizationGrantPermissionInput,
  AuthorizationGrantPermissionOutput,
  AuthorizationRevokePermissionInput,
  AuthorizationRevokePermissionOutput,
  AuthorizationAssignRoleInput,
  AuthorizationAssignRoleOutput,
  AuthorizationCheckPermissionInput,
  AuthorizationCheckPermissionOutput,
} from './types.js';

import {
  grantPermissionOk,
  grantPermissionNotfound,
  revokePermissionOk,
  revokePermissionNotfound,
  assignRoleOk,
  assignRoleNotfound,
  checkPermissionOk,
} from './types.js';

export interface AuthorizationError {
  readonly code: string;
  readonly message: string;
}

export interface AuthorizationHandler {
  readonly grantPermission: (
    input: AuthorizationGrantPermissionInput,
    storage: AuthorizationStorage,
  ) => TE.TaskEither<AuthorizationError, AuthorizationGrantPermissionOutput>;
  readonly revokePermission: (
    input: AuthorizationRevokePermissionInput,
    storage: AuthorizationStorage,
  ) => TE.TaskEither<AuthorizationError, AuthorizationRevokePermissionOutput>;
  readonly assignRole: (
    input: AuthorizationAssignRoleInput,
    storage: AuthorizationStorage,
  ) => TE.TaskEither<AuthorizationError, AuthorizationAssignRoleOutput>;
  readonly checkPermission: (
    input: AuthorizationCheckPermissionInput,
    storage: AuthorizationStorage,
  ) => TE.TaskEither<AuthorizationError, AuthorizationCheckPermissionOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): AuthorizationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a JSON-encoded string set, defaulting to empty array on failure. */
const parseStringSet = (raw: unknown): readonly string[] => {
  if (Array.isArray(raw)) return raw as readonly string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** Serialize a string set to JSON for storage. */
const serializeStringSet = (set: readonly string[]): string =>
  JSON.stringify([...new Set(set)]);

// --- Implementation ---

export const authorizationHandler: AuthorizationHandler = {
  /**
   * Grant a permission to a role. Creates the role record if it does not
   * exist and appends the permission to its permission set. Idempotent if
   * the permission is already present.
   */
  grantPermission: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('roles', input.role),
        storageError,
      ),
      TE.chain((record) => {
        const existing = O.fromNullable(record);
        return pipe(
          existing,
          O.fold(
            // Role does not exist yet — create it with the initial permission
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('roles', input.role, {
                    role: input.role,
                    permissions: serializeStringSet([input.permission]),
                    createdAt: Date.now(),
                  });
                  return grantPermissionOk(input.role, input.permission);
                },
                storageError,
              ),
            // Role exists — append the permission (set-deduplicated)
            (roleRecord) => {
              const currentPermissions = parseStringSet(roleRecord.permissions);
              const updatedPermissions = [...new Set([...currentPermissions, input.permission])];
              return TE.tryCatch(
                async () => {
                  await storage.put('roles', input.role, {
                    ...roleRecord,
                    permissions: serializeStringSet(updatedPermissions),
                    updatedAt: Date.now(),
                  });
                  return grantPermissionOk(input.role, input.permission);
                },
                storageError,
              );
            },
          ),
        );
      }),
    ),

  /**
   * Revoke a permission from a role. Returns notfound if the role does not
   * exist or the permission is not currently granted.
   */
  revokePermission: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('roles', input.role),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<AuthorizationError, AuthorizationRevokePermissionOutput>(
              revokePermissionNotfound(`Role '${input.role}' does not exist`),
            ),
            (roleRecord) => {
              const currentPermissions = parseStringSet(roleRecord.permissions);
              if (!currentPermissions.includes(input.permission)) {
                return TE.right<AuthorizationError, AuthorizationRevokePermissionOutput>(
                  revokePermissionNotfound(
                    `Permission '${input.permission}' not found on role '${input.role}'`,
                  ),
                );
              }
              const updatedPermissions = currentPermissions.filter((p) => p !== input.permission);
              return TE.tryCatch(
                async () => {
                  await storage.put('roles', input.role, {
                    ...roleRecord,
                    permissions: serializeStringSet(updatedPermissions),
                    updatedAt: Date.now(),
                  });
                  return revokePermissionOk(input.role, input.permission);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Assign a role to a user. The role must already exist. The user's role set
   * is deduplicated so assigning the same role twice is a no-op success.
   */
  assignRole: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('roles', input.role),
        storageError,
      ),
      TE.chain((roleRecord) =>
        pipe(
          O.fromNullable(roleRecord),
          O.fold(
            () => TE.right<AuthorizationError, AuthorizationAssignRoleOutput>(
              assignRoleNotfound(`Role '${input.role}' does not exist`),
            ),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.get('userRoles', input.user),
                  storageError,
                ),
                TE.chain((userRecord) => {
                  const currentRoles = pipe(
                    O.fromNullable(userRecord),
                    O.fold(
                      () => [] as readonly string[],
                      (rec) => parseStringSet(rec.roles),
                    ),
                  );
                  const updatedRoles = [...new Set([...currentRoles, input.role])];
                  return TE.tryCatch(
                    async () => {
                      await storage.put('userRoles', input.user, {
                        user: input.user,
                        roles: serializeStringSet(updatedRoles),
                        updatedAt: Date.now(),
                      });
                      return assignRoleOk(input.user, input.role);
                    },
                    storageError,
                  );
                }),
              ),
          ),
        ),
      ),
    ),

  /**
   * Check whether a user holds the specified permission through any of their
   * assigned roles. Resolves transitively: user -> roles -> permissions.
   */
  checkPermission: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('userRoles', input.user),
        storageError,
      ),
      TE.chain((userRecord) => {
        const userRoles = pipe(
          O.fromNullable(userRecord),
          O.fold(
            () => [] as readonly string[],
            (rec) => parseStringSet(rec.roles),
          ),
        );

        if (userRoles.length === 0) {
          return TE.right<AuthorizationError, AuthorizationCheckPermissionOutput>(
            checkPermissionOk(false),
          );
        }

        // Load each role and check if any has the requested permission
        return TE.tryCatch(
          async () => {
            for (const roleName of userRoles) {
              const roleRecord = await storage.get('roles', roleName);
              if (roleRecord) {
                const permissions = parseStringSet(roleRecord.permissions);
                if (permissions.includes(input.permission)) {
                  return checkPermissionOk(true);
                }
              }
            }
            return checkPermissionOk(false);
          },
          storageError,
        );
      }),
    ),
};
