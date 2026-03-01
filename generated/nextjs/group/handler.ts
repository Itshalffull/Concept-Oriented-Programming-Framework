// Group — handler.ts
// Entity grouping: create named groups, manage membership, assign roles,
// associate content, and check permission-based access within groups.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GroupStorage,
  GroupCreateGroupInput,
  GroupCreateGroupOutput,
  GroupAddMemberInput,
  GroupAddMemberOutput,
  GroupAssignGroupRoleInput,
  GroupAssignGroupRoleOutput,
  GroupAddContentInput,
  GroupAddContentOutput,
  GroupCheckGroupAccessInput,
  GroupCheckGroupAccessOutput,
} from './types.js';

import {
  createGroupOk,
  createGroupExists,
  addMemberOk,
  addMemberNotfound,
  assignGroupRoleOk,
  assignGroupRoleNotfound,
  addContentOk,
  addContentNotfound,
  checkGroupAccessOk,
  checkGroupAccessNotfound,
} from './types.js';

export interface GroupError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): GroupError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface GroupHandler {
  readonly createGroup: (
    input: GroupCreateGroupInput,
    storage: GroupStorage,
  ) => TE.TaskEither<GroupError, GroupCreateGroupOutput>;
  readonly addMember: (
    input: GroupAddMemberInput,
    storage: GroupStorage,
  ) => TE.TaskEither<GroupError, GroupAddMemberOutput>;
  readonly assignGroupRole: (
    input: GroupAssignGroupRoleInput,
    storage: GroupStorage,
  ) => TE.TaskEither<GroupError, GroupAssignGroupRoleOutput>;
  readonly addContent: (
    input: GroupAddContentInput,
    storage: GroupStorage,
  ) => TE.TaskEither<GroupError, GroupAddContentOutput>;
  readonly checkGroupAccess: (
    input: GroupCheckGroupAccessInput,
    storage: GroupStorage,
  ) => TE.TaskEither<GroupError, GroupCheckGroupAccessOutput>;
}

// --- Implementation ---

export const groupHandler: GroupHandler = {
  // Create a new group; reject if a group with the same id already exists
  createGroup: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('group', input.group),
        toError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('group', input.group, {
                    group: input.group,
                    name: input.name,
                    members: [],
                    content: [],
                    createdAt: new Date().toISOString(),
                  });
                  return createGroupOk();
                },
                toError,
              ),
            () => TE.right(createGroupExists(`Group '${input.group}' already exists`)),
          ),
        ),
      ),
    ),

  // Add a user as a member with a given role; group must exist
  addMember: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('group', input.group),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(addMemberNotfound(`Group '${input.group}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const members = (found.members as readonly Record<string, unknown>[]) ?? [];
                  const updated = [...members, { user: input.user, role: input.role }];
                  await storage.put('group', input.group, { ...found, members: updated });
                  return addMemberOk();
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Reassign a member's role within the group
  assignGroupRole: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('group', input.group),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(assignGroupRoleNotfound(`Group '${input.group}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const members = (found.members as readonly Record<string, unknown>[]) ?? [];
                  const updated = members.map((m) =>
                    m.user === input.user ? { ...m, role: input.role } : m,
                  );
                  await storage.put('group', input.group, { ...found, members: updated });
                  return assignGroupRoleOk();
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Associate content with a group
  addContent: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('group', input.group),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(addContentNotfound(`Group '${input.group}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const content = (found.content as readonly string[]) ?? [];
                  await storage.put('group', input.group, {
                    ...found,
                    content: [...content, input.content],
                  });
                  return addContentOk();
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Check whether a user has a specific permission in the group based on their role
  checkGroupAccess: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('group', input.group),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(checkGroupAccessNotfound(`Group '${input.group}' not found`)),
            (found) => {
              const members = (found.members as readonly Record<string, unknown>[]) ?? [];
              const member = members.find((m) => m.user === input.user);
              // Admin role grants all permissions; member role grants read
              const granted = pipe(
                O.fromNullable(member),
                O.fold(
                  () => false,
                  (m) => {
                    const role = m.role as string;
                    if (role === 'admin' || role === 'owner') return true;
                    if (role === 'member' && input.permission === 'read') return true;
                    return false;
                  },
                ),
              );
              return TE.right(checkGroupAccessOk(granted));
            },
          ),
        ),
      ),
    ),
};
