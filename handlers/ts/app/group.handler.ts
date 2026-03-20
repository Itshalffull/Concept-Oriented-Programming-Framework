// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Group Concept Implementation
// Isolated content spaces with group-level role-based access control for multi-tenant collaboration.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _groupHandler: FunctionalConceptHandler = {
  createGroup(input: Record<string, unknown>) {
    const group = input.group as string;
    const name = input.name as string;

    let p = createProgram();
    p = spGet(p, 'group', group, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'Group already exists' }),
      (b) => {
        let b2 = put(b, 'group', group, {
          group,
          name,
          members: JSON.stringify([]),
          content: JSON.stringify([]),
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addMember(input: Record<string, unknown>) {
    const group = input.group as string;
    const user = input.user as string;
    const role = input.role as string;

    let p = createProgram();
    p = spGet(p, 'group', group, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'group', group, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const members = JSON.parse((existing.members as string) || '[]') as Array<{ user: string; role: string }>;
          if (!members.some(m => m.user === user)) members.push({ user, role });
          return { ...existing, members: JSON.stringify(members) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Group does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  assignGroupRole(input: Record<string, unknown>) {
    const group = input.group as string;
    const user = input.user as string;
    const role = input.role as string;

    let p = createProgram();
    p = spGet(p, 'group', group, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'group', group, {});
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Group does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addContent(input: Record<string, unknown>) {
    const group = input.group as string;
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'group', group, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'group', group, {});
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Group does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  checkGroupAccess(input: Record<string, unknown>) {
    const group = input.group as string;
    const user = input.user as string;
    const permission = input.permission as string;

    let p = createProgram();
    p = spGet(p, 'group', group, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const members = JSON.parse((existing.members as string) || '[]') as Array<{ user: string; role: string }>;
          const isMember = members.some(m => m.user === user);
          return { granted: isMember };
        }),
      (b) => complete(b, 'notfound', { message: 'Group does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const groupHandler = autoInterpret(_groupHandler);

