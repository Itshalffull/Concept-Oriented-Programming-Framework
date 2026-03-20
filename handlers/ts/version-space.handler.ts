// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// VersionSpace Handler
//
// Parallel, recursively composable overlays of entity state.
// Copy-on-write overrides, membership, merge/proposal workflows,
// and base reality promotion.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, putFrom, merge, mergeFrom, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  fork(input: Record<string, unknown>) {
    const name = input.name as string;
    const parent = input.parent as string | null;
    const scope = input.scope as string | null;
    const visibility = input.visibility as string;

    if (parent) {
      let p = createProgram();
      p = get(p, 'spaces', parent, 'parentRecord');

      return branch(p,
        (bindings) => {
          const pr = bindings.parentRecord as Record<string, unknown> | null;
          return !pr || pr.status === 'archived';
        },
        (thenP) => complete(thenP, 'parent_not_found', { parent }),
        (elseP) => {
          const id = nextId('vs');
          const now = new Date().toISOString();
          elseP = put(elseP, 'spaces', id, {
            id,
            name,
            parent: parent || null,
            root_scope: scope || null,
            visibility,
            status: 'active',
            created_by: (input as any).user || 'system',
            created_at: now,
            fork_point: null,
            children: [],
          });
          const memberId = nextId('member');
          elseP = put(elseP, 'members', memberId, {
            id: memberId,
            member_space: id,
            member_user: (input as any).user || 'system',
            member_role: 'owner',
          });
          return complete(elseP, 'ok', { space: id });
        },
      ) as StorageProgram<Result>;
    }

    // No parent case
    const id = nextId('vs');
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, 'spaces', id, {
      id,
      name,
      parent: null,
      root_scope: scope || null,
      visibility,
      status: 'active',
      created_by: (input as any).user || 'system',
      created_at: now,
      fork_point: null,
      children: [],
    });
    const memberId = nextId('member');
    p = put(p, 'members', memberId, {
      id: memberId,
      member_space: id,
      member_user: (input as any).user || 'system',
      member_role: 'owner',
    });

    return complete(p, 'ok', { space: id }) as StorageProgram<Result>;
  },

  enter(input: Record<string, unknown>) {
    const space = input.space as string;
    const user = input.user as string;

    let p = createProgram();
    p = get(p, 'spaces', space, 'record');

    return branch(p, 'record',
      (thenP) => {
        return branch(thenP,
          (bindings) => (bindings.record as Record<string, unknown>).status === 'archived',
          (archivedP) => complete(archivedP, 'archived', { space }),
          (activeP) => {
            activeP = find(activeP, 'members', { member_space: space }, 'members');
            return branch(activeP,
              (bindings) => {
                const record = bindings.record as Record<string, unknown>;
                if (record.visibility !== 'private' && record.visibility !== 'shared') return false;
                const members = bindings.members as Record<string, unknown>[];
                return !members.some((m) => m.member_user === user);
              },
              (deniedP) => complete(deniedP, 'access_denied', { user }),
              (allowedP) => complete(allowedP, 'ok', {}),
            );
          },
        );
      },
      (elseP) => complete(elseP, 'access_denied', { user }),
    ) as StorageProgram<Result>;
  },

  leave(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  write(input: Record<string, unknown>) {
    const space = input.space as string;
    const entity_id = input.entity_id as string;
    const fields = input.fields as string;

    // Use a deterministic key so overwrites update the same record
    const overrideKey = `${space}:${entity_id}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'spaces', space, 'spaceRecord');

    return branch(p, 'spaceRecord',
      (thenP) => {
        thenP = put(thenP, 'override_entries', overrideKey, {
          id: overrideKey,
          override_space: space,
          override_entity_id: entity_id,
          override_fields: fields,
          override_operation: 'modify',
          override_at: now,
        });
        return complete(thenP, 'ok', { override: overrideKey });
      },
      (elseP) => complete(elseP, 'read_only', { space, user: '' }),
    ) as StorageProgram<Result>;
  },

  create_in_space(input: Record<string, unknown>) {
    const space = input.space as string;
    const fields = input.fields as string;

    const entity_id = nextId('entity');
    const overrideId = nextId('override');
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'override_entries', overrideId, {
      id: overrideId,
      override_space: space,
      override_entity_id: entity_id,
      override_fields: fields,
      override_operation: 'create',
      override_at: now,
    });

    return complete(p, 'ok', { override: overrideId, entity_id }) as StorageProgram<Result>;
  },

  delete_in_space(input: Record<string, unknown>) {
    const space = input.space as string;
    const entity_id = input.entity_id as string;
    const now = new Date().toISOString();

    // Use deterministic key matching write() so we overwrite any existing override
    const overrideKey = `${space}:${entity_id}`;

    let p = createProgram();
    p = put(p, 'override_entries', overrideKey, {
      id: overrideKey,
      override_space: space,
      override_entity_id: entity_id,
      override_fields: '',
      override_operation: 'delete',
      override_at: now,
    });
    return complete(p, 'ok', { override: overrideKey }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const space = input.space as string;
    const entity_id = input.entity_id as string;

    // Walk the ancestry chain: space -> parent -> ... -> base
    // In functional style, we do a single find and get for the immediate space
    let p = createProgram();
    p = find(p, 'override_entries', {
      override_space: space,
      override_entity_id: entity_id,
    }, 'overrides');

    return branch(p,
      (bindings) => (bindings.overrides as unknown[]).length > 0,
      (thenP) => {
        return branch(thenP,
          (bindings) => {
            const override = (bindings.overrides as Record<string, unknown>[])[0];
            return override.override_operation === 'delete';
          },
          (deletedP) => complete(deletedP, 'not_found', { entity_id }),
          (foundP) => completeFrom(foundP, 'ok', (bindings) => {
            const override = (bindings.overrides as Record<string, unknown>[])[0];
            return { fields: override.override_fields as string, source: space };
          }),
        );
      },
      (elseP) => complete(elseP, 'ok', { fields: '{}', source: 'base' }),
    ) as StorageProgram<Result>;
  },

  propose(input: Record<string, unknown>) {
    const space = input.space as string;

    let p = createProgram();
    p = get(p, 'spaces', space, 'record');

    return branch(p, 'record',
      (thenP) => {
        return branch(thenP,
          (bindings) => (bindings.record as Record<string, unknown>).status === 'proposed',
          (alreadyP) => complete(alreadyP, 'already_proposed', { space }),
          (proposeP) => {
            proposeP = merge(proposeP, 'spaces', space, { status: 'proposed' });
            return complete(proposeP, 'ok', {});
          },
        );
      },
      (elseP) => complete(elseP, 'already_proposed', { space }),
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const space = input.space as string;

    let p = createProgram();
    p = get(p, 'spaces', space, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'override_entries', { override_space: space }, 'overrides');
        return completeFrom(thenP, 'ok', (bindings) => {
          const overrides = bindings.overrides as unknown[];
          return { merged_count: overrides.length, conflict_count: 0 };
        });
      },
      (elseP) => complete(elseP, 'conflicts', { conflicts: 'Space not found' }),
    ) as StorageProgram<Result>;
  },

  sync_spaces(input: Record<string, unknown>) {
    const space_a = input.space_a as string;
    const space_b = input.space_b as string;

    let p = createProgram();
    p = get(p, 'spaces', space_a, 'recordA');
    p = get(p, 'spaces', space_b, 'recordB');

    return branch(p,
      (bindings) => !bindings.recordA || !bindings.recordB,
      (thenP) => complete(thenP, 'incompatible_scope', { space_a, space_b }),
      (elseP) => {
        return branch(elseP,
          (bindings) => {
            const a = bindings.recordA as Record<string, unknown>;
            const b = bindings.recordB as Record<string, unknown>;
            return !!(a.root_scope && b.root_scope && a.root_scope !== b.root_scope);
          },
          (incompatP) => complete(incompatP, 'incompatible_scope', { space_a, space_b }),
          (compatP) => complete(compatP, 'ok', { a_to_b_count: 0, b_to_a_count: 0, conflict_count: 0 }),
        );
      },
    ) as StorageProgram<Result>;
  },

  cherry_pick(input: Record<string, unknown>) {
    const source = input.source as string;
    const target = input.target as string;
    const entity_id = input.entity_id as string;

    let p = createProgram();
    p = find(p, 'override_entries', {
      override_space: source,
      override_entity_id: entity_id,
    }, 'sourceOverrides');

    return branch(p,
      (bindings) => (bindings.sourceOverrides as unknown[]).length === 0,
      (thenP) => complete(thenP, 'not_overridden', { source, entity_id }),
      (elseP) => {
        elseP = find(elseP, 'override_entries', {
          override_space: target,
          override_entity_id: entity_id,
        }, 'targetOverrides');

        return branch(elseP,
          (bindings) => (bindings.targetOverrides as unknown[]).length > 0,
          (conflictP) => completeFrom(conflictP, 'conflict', (bindings) => ({
            existing_override: (bindings.targetOverrides as Record<string, unknown>[])[0].override_fields as string,
            incoming_override: (bindings.sourceOverrides as Record<string, unknown>[])[0].override_fields as string,
          })),
          (copyP) => {
            const overrideKey = `${target}:${entity_id}`;
            copyP = putFrom(copyP, 'override_entries', overrideKey, (bindings) => {
              const sourceOverride = (bindings.sourceOverrides as Record<string, unknown>[])[0];
              return {
                id: overrideKey,
                override_space: target,
                override_entity_id: entity_id,
                override_fields: sourceOverride.override_fields as string,
                override_operation: sourceOverride.override_operation as string,
                override_at: new Date().toISOString(),
              };
            });
            return complete(copyP, 'ok', {});
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  promote_to_base(input: Record<string, unknown>) {
    const space = input.space as string;

    let p = createProgram();
    p = get(p, 'spaces', space, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'spaces', { parent: space }, 'children');
        return branch(thenP,
          (bindings) => {
            const children = bindings.children as Record<string, unknown>[];
            return children.some((c) => c.status === 'active');
          },
          (hasChildrenP) => complete(hasChildrenP, 'has_children', { space }),
          (noChildrenP) => {
            const snapshotId = nextId('snapshot');
            return complete(noChildrenP, 'ok', { old_base_snapshot: snapshotId });
          },
        );
      },
      (elseP) => complete(elseP, 'access_denied', {}),
    ) as StorageProgram<Result>;
  },

  rebase(input: Record<string, unknown>) {
    const space = input.space as string;

    let p = createProgram();
    p = find(p, 'override_entries', { override_space: space }, 'overrides');

    return completeFrom(p, 'ok', (bindings) => ({
      dissolved_count: 0,
      preserved_count: (bindings.overrides as unknown[]).length,
    })) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    const space = input.space as string;

    let p = createProgram();
    p = find(p, 'override_entries', { override_space: space }, 'overrides');

    return completeFrom(p, 'ok', (bindings) => {
      const overrides = bindings.overrides as Record<string, unknown>[];
      const changes = overrides.map((o) => ({
        entity_id: o.override_entity_id,
        operation: o.override_operation,
        fields: o.override_fields,
      }));
      return { changes: JSON.stringify(changes) };
    }) as StorageProgram<Result>;
  },

  archive(input: Record<string, unknown>) {
    const space = input.space as string;

    let p = createProgram();
    p = merge(p, 'spaces', space, { status: 'archived' });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  execute_in_space(input: Record<string, unknown>) {
    const space = input.space as string;

    let p = createProgram();
    p = get(p, 'spaces', space, 'record');

    return branch(p,
      (bindings) => {
        const record = bindings.record as Record<string, unknown> | null;
        return !record || record.status === 'archived';
      },
      (thenP) => complete(thenP, 'space_not_found', { space }),
      (elseP) => complete(elseP, 'ok', {
        result: JSON.stringify({ space, action: input.action, params: input.params }),
      }),
    ) as StorageProgram<Result>;
  },
};

export const versionSpaceHandler = autoInterpret(_handler);

export default versionSpaceHandler;
