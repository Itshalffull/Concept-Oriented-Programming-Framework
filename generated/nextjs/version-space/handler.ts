// VersionSpace — Parallel, recursively composable overlays of entity state.
// Copy-on-write overrides, membership, merge/proposal workflows, and base reality promotion.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VersionSpaceStorage,
  VersionSpaceForkInput,
  VersionSpaceForkOutput,
  VersionSpaceEnterInput,
  VersionSpaceEnterOutput,
  VersionSpaceLeaveInput,
  VersionSpaceLeaveOutput,
  VersionSpaceWriteInput,
  VersionSpaceWriteOutput,
  VersionSpaceCreateInSpaceInput,
  VersionSpaceCreateInSpaceOutput,
  VersionSpaceDeleteInSpaceInput,
  VersionSpaceDeleteInSpaceOutput,
  VersionSpaceResolveInput,
  VersionSpaceResolveOutput,
  VersionSpaceProposeInput,
  VersionSpaceProposeOutput,
  VersionSpaceMergeInput,
  VersionSpaceMergeOutput,
  VersionSpaceSyncSpacesInput,
  VersionSpaceSyncSpacesOutput,
  VersionSpaceCherryPickInput,
  VersionSpaceCherryPickOutput,
  VersionSpacePromoteToBaseInput,
  VersionSpacePromoteToBaseOutput,
  VersionSpaceRebaseInput,
  VersionSpaceRebaseOutput,
  VersionSpaceDiffInput,
  VersionSpaceDiffOutput,
  VersionSpaceArchiveInput,
  VersionSpaceArchiveOutput,
  VersionSpaceExecuteInSpaceInput,
  VersionSpaceExecuteInSpaceOutput,
} from './types.js';

import {
  forkOk,
  forkParentNotFound,
  enterOk,
  enterAccessDenied,
  enterArchived,
  leaveOk,
  writeOk,
  writeReadOnly,
  createInSpaceOk,
  deleteInSpaceOk,
  resolveOk,
  resolveNotFound,
  proposeOk,
  proposeAlreadyProposed,
  mergeOk,
  mergeConflicts,
  syncSpacesOk,
  syncSpacesIncompatibleScope,
  cherryPickOk,
  cherryPickNotOverridden,
  cherryPickConflict,
  promoteToBaseOk,
  promoteToBaseHasChildren,
  promoteToBaseAccessDenied,
  rebaseOk,
  diffOk,
  archiveOk,
  executeInSpaceOk,
  executeInSpaceSpaceNotFound,
} from './types.js';

export interface VersionSpaceError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): VersionSpaceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
const nextId = (prefix: string): string => `${prefix}-${++idCounter}`;

export interface VersionSpaceHandler {
  readonly fork: (
    input: VersionSpaceForkInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceForkOutput>;
  readonly enter: (
    input: VersionSpaceEnterInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceEnterOutput>;
  readonly leave: (
    input: VersionSpaceLeaveInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceLeaveOutput>;
  readonly write: (
    input: VersionSpaceWriteInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceWriteOutput>;
  readonly createInSpace: (
    input: VersionSpaceCreateInSpaceInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceCreateInSpaceOutput>;
  readonly deleteInSpace: (
    input: VersionSpaceDeleteInSpaceInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceDeleteInSpaceOutput>;
  readonly resolve: (
    input: VersionSpaceResolveInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceResolveOutput>;
  readonly propose: (
    input: VersionSpaceProposeInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceProposeOutput>;
  readonly merge: (
    input: VersionSpaceMergeInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceMergeOutput>;
  readonly syncSpaces: (
    input: VersionSpaceSyncSpacesInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceSyncSpacesOutput>;
  readonly cherryPick: (
    input: VersionSpaceCherryPickInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceCherryPickOutput>;
  readonly promoteToBase: (
    input: VersionSpacePromoteToBaseInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpacePromoteToBaseOutput>;
  readonly rebase: (
    input: VersionSpaceRebaseInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceRebaseOutput>;
  readonly diff: (
    input: VersionSpaceDiffInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceDiffOutput>;
  readonly archive: (
    input: VersionSpaceArchiveInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceArchiveOutput>;
  readonly executeInSpace: (
    input: VersionSpaceExecuteInSpaceInput,
    storage: VersionSpaceStorage,
  ) => TE.TaskEither<VersionSpaceError, VersionSpaceExecuteInSpaceOutput>;
}

// --- Implementation ---

export const versionSpaceHandler: VersionSpaceHandler = {
  fork: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Validate parent exists if specified
          if (input.parent) {
            const parentRecord = await storage.get('spaces', input.parent);
            if (!parentRecord || parentRecord['status'] === 'archived') {
              return forkParentNotFound(input.parent);
            }
          }

          const id = nextId('vs');
          const now = new Date().toISOString();

          await storage.put('spaces', id, {
            id,
            name: input.name,
            parent: input.parent ?? null,
            root_scope: input.scope ?? null,
            visibility: input.visibility,
            status: 'active',
            created_by: input.user ?? 'system',
            created_at: now,
            fork_point: null,
            children: JSON.stringify([]),
          });

          // Add as child of parent if nested
          if (input.parent) {
            const parentRecord = await storage.get('spaces', input.parent);
            if (parentRecord) {
              const children: string[] = parentRecord['children']
                ? JSON.parse(String(parentRecord['children']))
                : [];
              children.push(id);
              await storage.put('spaces', input.parent, {
                ...parentRecord,
                children: JSON.stringify(children),
              });
            }
          }

          // Add creator as owner member
          const memberId = nextId('member');
          await storage.put('members', memberId, {
            id: memberId,
            member_space: id,
            member_user: input.user ?? 'system',
            member_role: 'owner',
          });

          return forkOk(id);
        },
        toStorageError,
      ),
    ),

  enter: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('spaces', input.space),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(enterAccessDenied(input.user)),
            (existing) => {
              if (existing['status'] === 'archived') {
                return TE.right(enterArchived(input.space));
              }
              // Check membership for private/shared spaces
              if (existing['visibility'] === 'private' || existing['visibility'] === 'shared') {
                return pipe(
                  TE.tryCatch(
                    () => storage.find('members', { member_space: input.space }),
                    toStorageError,
                  ),
                  TE.chain((members) => {
                    const isMember = members.some((m) => m['member_user'] === input.user);
                    if (!isMember) {
                      return TE.right(enterAccessDenied(input.user));
                    }
                    return TE.right(enterOk());
                  }),
                );
              }
              return TE.right(enterOk());
            },
          ),
        ),
      ),
    ),

  leave: (_input, _storage) =>
    TE.right(leaveOk()),

  write: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('spaces', input.space),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(writeReadOnly(input.space, '')),
            (_spaceRecord) =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.find('override_entries', {
                      override_space: input.space,
                      override_entity_id: input.entity_id,
                    }),
                  toStorageError,
                ),
                TE.chain((existingOverrides) => {
                  const now = new Date().toISOString();
                  if (existingOverrides.length > 0) {
                    const existing = existingOverrides[0];
                    return pipe(
                      TE.tryCatch(
                        async () => {
                          await storage.put('override_entries', String(existing['id']), {
                            ...existing,
                            override_fields: input.fields,
                            override_at: now,
                          });
                          return writeOk(String(existing['id']));
                        },
                        toStorageError,
                      ),
                    );
                  }
                  const overrideId = nextId('override');
                  return pipe(
                    TE.tryCatch(
                      async () => {
                        await storage.put('override_entries', overrideId, {
                          id: overrideId,
                          override_space: input.space,
                          override_entity_id: input.entity_id,
                          override_fields: input.fields,
                          override_operation: 'modify',
                          override_at: now,
                        });
                        return writeOk(overrideId);
                      },
                      toStorageError,
                    ),
                  );
                }),
              ),
          ),
        ),
      ),
    ),

  createInSpace: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const entity_id = nextId('entity');
          const overrideId = nextId('override');
          const now = new Date().toISOString();

          await storage.put('override_entries', overrideId, {
            id: overrideId,
            override_space: input.space,
            override_entity_id: entity_id,
            override_fields: input.fields,
            override_operation: 'create',
            override_at: now,
          });

          return createInSpaceOk(overrideId, entity_id);
        },
        toStorageError,
      ),
    ),

  deleteInSpace: (input, storage) =>
    pipe(
      TE.tryCatch(
        () =>
          storage.find('override_entries', {
            override_space: input.space,
            override_entity_id: input.entity_id,
          }),
        toStorageError,
      ),
      TE.chain((existingOverrides) => {
        const now = new Date().toISOString();
        if (existingOverrides.length > 0) {
          const existing = existingOverrides[0];
          return TE.tryCatch(
            async () => {
              await storage.put('override_entries', String(existing['id']), {
                ...existing,
                override_fields: '',
                override_operation: 'delete',
                override_at: now,
              });
              return deleteInSpaceOk(String(existing['id']));
            },
            toStorageError,
          );
        }
        const overrideId = nextId('override');
        return TE.tryCatch(
          async () => {
            await storage.put('override_entries', overrideId, {
              id: overrideId,
              override_space: input.space,
              override_entity_id: input.entity_id,
              override_fields: '',
              override_operation: 'delete',
              override_at: now,
            });
            return deleteInSpaceOk(overrideId);
          },
          toStorageError,
        );
      }),
    ),

  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Walk the ancestry chain: space -> parent -> ... -> base
          let currentSpace: string | null = input.space;
          const overrideChain: Array<{ fields: string; source: string }> = [];

          while (currentSpace) {
            const overrides = await storage.find('override_entries', {
              override_space: currentSpace,
              override_entity_id: input.entity_id,
            });

            if (overrides.length > 0) {
              const override = overrides[0];
              if (override['override_operation'] === 'delete') {
                return resolveNotFound(input.entity_id);
              }
              overrideChain.push({
                fields: String(override['override_fields']),
                source: currentSpace,
              });
            }

            // Walk to parent
            const spaceRecord = await storage.get('spaces', currentSpace);
            currentSpace = spaceRecord ? (spaceRecord['parent'] as string | null) : null;
          }

          if (overrideChain.length === 0) {
            return resolveOk('{}', 'base');
          }

          const merged = overrideChain[0];
          return resolveOk(merged.fields, merged.source);
        },
        toStorageError,
      ),
    ),

  propose: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('spaces', input.space),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(proposeAlreadyProposed(input.space)),
            (existing) => {
              if (existing['status'] === 'proposed') {
                return TE.right(proposeAlreadyProposed(input.space));
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('spaces', input.space, {
                    ...existing,
                    status: 'proposed',
                  });
                  return proposeOk();
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  merge: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('spaces', input.space),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(mergeConflicts('Space not found')),
            (existing) =>
              pipe(
                TE.tryCatch(
                  () => storage.find('override_entries', { override_space: input.space }),
                  toStorageError,
                ),
                TE.chain((overrides) =>
                  TE.tryCatch(
                    async () => {
                      await storage.put('spaces', input.space, {
                        ...existing,
                        status: 'merged',
                      });
                      return mergeOk(overrides.length, 0);
                    },
                    toStorageError,
                  ),
                ),
              ),
          ),
        ),
      ),
    ),

  syncSpaces: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const recordA = await storage.get('spaces', input.space_a);
          const recordB = await storage.get('spaces', input.space_b);
          return { recordA, recordB };
        },
        toStorageError,
      ),
      TE.chain(({ recordA, recordB }) => {
        if (!recordA || !recordB) {
          return TE.right(syncSpacesIncompatibleScope(input.space_a, input.space_b));
        }
        if (
          recordA['root_scope'] &&
          recordB['root_scope'] &&
          recordA['root_scope'] !== recordB['root_scope']
        ) {
          return TE.right(syncSpacesIncompatibleScope(input.space_a, input.space_b));
        }
        return TE.right(syncSpacesOk(0, 0, 0));
      }),
    ),

  cherryPick: (input, storage) =>
    pipe(
      TE.tryCatch(
        () =>
          storage.find('override_entries', {
            override_space: input.source,
            override_entity_id: input.entity_id,
          }),
        toStorageError,
      ),
      TE.chain((sourceOverrides) => {
        if (sourceOverrides.length === 0) {
          return TE.right(cherryPickNotOverridden(input.source, input.entity_id));
        }
        return pipe(
          TE.tryCatch(
            () =>
              storage.find('override_entries', {
                override_space: input.target,
                override_entity_id: input.entity_id,
              }),
            toStorageError,
          ),
          TE.chain((targetOverrides) => {
            if (targetOverrides.length > 0) {
              return TE.right(
                cherryPickConflict(
                  String(targetOverrides[0]['override_fields']),
                  String(sourceOverrides[0]['override_fields']),
                ),
              );
            }
            const overrideId = nextId('override');
            const sourceOverride = sourceOverrides[0];
            return TE.tryCatch(
              async () => {
                await storage.put('override_entries', overrideId, {
                  id: overrideId,
                  override_space: input.target,
                  override_entity_id: input.entity_id,
                  override_fields: sourceOverride['override_fields'],
                  override_operation: sourceOverride['override_operation'],
                  override_at: new Date().toISOString(),
                });
                return cherryPickOk();
              },
              toStorageError,
            );
          }),
        );
      }),
    ),

  promoteToBase: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('spaces', input.space),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(promoteToBaseAccessDenied()),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const childrenRaw = existing['children']
                    ? JSON.parse(String(existing['children']))
                    : [];
                  const activeChildren: string[] = [];
                  for (const childId of childrenRaw) {
                    const child = await storage.get('spaces', childId);
                    if (child && child['status'] !== 'archived' && child['status'] !== 'merged') {
                      activeChildren.push(childId);
                    }
                  }

                  if (activeChildren.length > 0) {
                    return promoteToBaseHasChildren(activeChildren);
                  }

                  // Snapshot old base
                  const snapshotId = nextId('snapshot');
                  const now = new Date().toISOString();
                  await storage.put('snapshots', snapshotId, {
                    id: snapshotId,
                    snapshot_content_hash: 'base-' + now,
                    snapshot_promoted_from: input.space,
                    snapshot_timestamp: now,
                    snapshot_label: `Base before promotion of ${String(existing['name'])}`,
                  });

                  // Archive the promoted space
                  await storage.put('spaces', input.space, {
                    ...existing,
                    status: 'archived',
                  });

                  return promoteToBaseOk(snapshotId);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  rebase: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('override_entries', { override_space: input.space }),
        toStorageError,
      ),
      TE.map((overrides) => rebaseOk(0, overrides.length)),
    ),

  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('override_entries', { override_space: input.space }),
        toStorageError,
      ),
      TE.map((overrides) => {
        const changes = overrides.map((o) => ({
          entity_id: o['override_entity_id'],
          operation: o['override_operation'],
          fields: o['override_fields'],
        }));
        return diffOk(JSON.stringify(changes));
      }),
    ),

  archive: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('spaces', input.space),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(archiveOk()),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('spaces', input.space, {
                    ...existing,
                    status: 'archived',
                  });
                  return archiveOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  executeInSpace: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('spaces', input.space),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(executeInSpaceSpaceNotFound(input.space)),
            (existing) => {
              if (existing['status'] === 'archived') {
                return TE.right(executeInSpaceSpaceNotFound(input.space));
              }
              return TE.right(
                executeInSpaceOk(
                  JSON.stringify({
                    space: input.space,
                    action: input.action,
                    params: input.params,
                  }),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
