// Branch — handler.ts
// Named parallel lines of development with lifecycle management.
// Branches are mutable pointers over immutable DAG history -- advancing
// the head, protecting against direct writes, and tracking upstream.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  BranchStorage,
  BranchCreateInput,
  BranchCreateOutput,
  BranchAdvanceInput,
  BranchAdvanceOutput,
  BranchDeleteInput,
  BranchDeleteOutput,
  BranchProtectInput,
  BranchProtectOutput,
  BranchSetUpstreamInput,
  BranchSetUpstreamOutput,
  BranchDivergencePointInput,
  BranchDivergencePointOutput,
  BranchArchiveInput,
  BranchArchiveOutput,
} from './types.js';

import {
  createOk,
  createExists,
  createUnknownNode,
  advanceOk,
  advanceNotFound,
  advanceProtected,
  advanceUnknownNode,
  deleteOk,
  deleteNotFound,
  deleteProtected,
  protectOk,
  protectNotFound,
  setUpstreamOk,
  setUpstreamNotFound,
  divergencePointOk,
  divergencePointNoDivergence,
  divergencePointNotFound,
  archiveOk,
  archiveNotFound,
} from './types.js';

export interface BranchError {
  readonly code: string;
  readonly message: string;
}

export interface BranchHandler {
  readonly create: (
    input: BranchCreateInput,
    storage: BranchStorage,
  ) => TE.TaskEither<BranchError, BranchCreateOutput>;
  readonly advance: (
    input: BranchAdvanceInput,
    storage: BranchStorage,
  ) => TE.TaskEither<BranchError, BranchAdvanceOutput>;
  readonly delete: (
    input: BranchDeleteInput,
    storage: BranchStorage,
  ) => TE.TaskEither<BranchError, BranchDeleteOutput>;
  readonly protect: (
    input: BranchProtectInput,
    storage: BranchStorage,
  ) => TE.TaskEither<BranchError, BranchProtectOutput>;
  readonly setUpstream: (
    input: BranchSetUpstreamInput,
    storage: BranchStorage,
  ) => TE.TaskEither<BranchError, BranchSetUpstreamOutput>;
  readonly divergencePoint: (
    input: BranchDivergencePointInput,
    storage: BranchStorage,
  ) => TE.TaskEither<BranchError, BranchDivergencePointOutput>;
  readonly archive: (
    input: BranchArchiveInput,
    storage: BranchStorage,
  ) => TE.TaskEither<BranchError, BranchArchiveOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): BranchError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const asBool = (value: unknown): boolean =>
  value === true;

// Walk the DAG node history to collect ancestor chain for divergence detection.
// Returns an ordered list of node IDs from head back to root.
const collectAncestors = async (
  storage: BranchStorage,
  headNode: string,
): Promise<readonly string[]> => {
  const ancestors: string[] = [];
  let current = headNode;
  const visited = new Set<string>();

  while (current !== '' && !visited.has(current)) {
    visited.add(current);
    ancestors.push(current);
    const nodeRecord = await storage.get('dag_node', current);
    if (nodeRecord === null) break;
    current = asString(nodeRecord.parent);
  }

  return ancestors;
};

// --- Implementation ---

export const branchHandler: BranchHandler = {
  // Branch created with head pointing at fromNode.
  // Validates name uniqueness and node existence.
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('branch', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  // Verify the node exists in DAG history
                  const nodeRecord = await storage.get('dag_node', input.fromNode);
                  if (nodeRecord === null) {
                    return createUnknownNode(
                      `Node ${input.fromNode} not found in DAG history`,
                    );
                  }

                  const record: Record<string, unknown> = {
                    name: input.name,
                    head: input.fromNode,
                    protected: false,
                    upstream: null,
                    archived: false,
                    created: nowISO(),
                    updatedAt: nowISO(),
                    history: JSON.stringify([input.fromNode]),
                  };
                  await storage.put('branch', input.name, record);
                  return createOk(input.name);
                },
                storageError,
              ),
            () =>
              TE.right<BranchError, BranchCreateOutput>(
                createExists(`Branch "${input.name}" already exists`),
              ),
          ),
        ),
      ),
    ),

  // Branch head moved forward to newNode.
  // Validates branch existence, protection status, and node existence.
  advance: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('branch', input.branch),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<BranchError, BranchAdvanceOutput>(
              advanceNotFound(`Branch "${input.branch}" not found`),
            ),
            (branchRecord) => {
              if (asBool(branchRecord.protected)) {
                return TE.right<BranchError, BranchAdvanceOutput>(
                  advanceProtected(`Branch "${input.branch}" is protected`),
                );
              }

              return TE.tryCatch(
                async () => {
                  // Verify the new node exists
                  const nodeRecord = await storage.get('dag_node', input.newNode);
                  if (nodeRecord === null) {
                    return advanceUnknownNode(
                      `Node ${input.newNode} not found in DAG history`,
                    );
                  }

                  // Advance head and append to branch history
                  const history: readonly string[] = (() => {
                    try {
                      const raw = branchRecord.history;
                      return typeof raw === 'string'
                        ? JSON.parse(raw) as string[]
                        : Array.isArray(raw) ? raw as string[] : [];
                    } catch {
                      return [];
                    }
                  })();

                  const updated = {
                    ...branchRecord,
                    head: input.newNode,
                    history: JSON.stringify([...history, input.newNode]),
                    updatedAt: nowISO(),
                  };
                  await storage.put('branch', input.branch, updated);
                  return advanceOk();
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Deletes the branch. Validates existence and protection status.
  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('branch', input.branch),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<BranchError, BranchDeleteOutput>(
              deleteNotFound(`Branch "${input.branch}" not found`),
            ),
            (branchRecord) => {
              if (asBool(branchRecord.protected)) {
                return TE.right<BranchError, BranchDeleteOutput>(
                  deleteProtected(`Branch "${input.branch}" is protected and cannot be deleted`),
                );
              }

              return TE.tryCatch(
                async () => {
                  await storage.delete('branch', input.branch);
                  return deleteOk();
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Marks branch as protected, preventing direct advance and deletion.
  protect: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('branch', input.branch),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<BranchError, BranchProtectOutput>(
              protectNotFound(`Branch "${input.branch}" not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    protected: true,
                    updatedAt: nowISO(),
                  };
                  await storage.put('branch', input.branch, updated);
                  return protectOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Sets the upstream tracking branch for the given branch.
  // Validates both branches exist.
  setUpstream: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => Promise.all([
          storage.get('branch', input.branch),
          storage.get('branch', input.upstream),
        ]),
        storageError,
      ),
      TE.chain(([branchRecord, upstreamRecord]) => {
        if (branchRecord === null) {
          return TE.right<BranchError, BranchSetUpstreamOutput>(
            setUpstreamNotFound(`Branch "${input.branch}" not found`),
          );
        }
        if (upstreamRecord === null) {
          return TE.right<BranchError, BranchSetUpstreamOutput>(
            setUpstreamNotFound(`Upstream branch "${input.upstream}" not found`),
          );
        }

        return TE.tryCatch(
          async () => {
            const updated = {
              ...branchRecord,
              upstream: input.upstream,
              updatedAt: nowISO(),
            };
            await storage.put('branch', input.branch, updated);
            return setUpstreamOk();
          },
          storageError,
        );
      }),
    ),

  // Finds the DAG node where two branches diverged by walking
  // their ancestor chains and finding the first common node.
  divergencePoint: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => Promise.all([
          storage.get('branch', input.b1),
          storage.get('branch', input.b2),
        ]),
        storageError,
      ),
      TE.chain(([b1Record, b2Record]) => {
        if (b1Record === null) {
          return TE.right<BranchError, BranchDivergencePointOutput>(
            divergencePointNotFound(`Branch "${input.b1}" not found`),
          );
        }
        if (b2Record === null) {
          return TE.right<BranchError, BranchDivergencePointOutput>(
            divergencePointNotFound(`Branch "${input.b2}" not found`),
          );
        }

        return TE.tryCatch(
          async () => {
            const head1 = asString(b1Record.head);
            const head2 = asString(b2Record.head);

            // If heads point to the same node, no divergence
            if (head1 === head2) {
              return divergencePointNoDivergence(
                'Branches point to the same node',
              );
            }

            const ancestors1 = await collectAncestors(storage, head1);
            const ancestors2 = await collectAncestors(storage, head2);

            // Check if one is ancestor of the other (no divergence)
            if (ancestors1.includes(head2)) {
              return divergencePointNoDivergence(
                `${input.b2} is a direct ancestor of ${input.b1}`,
              );
            }
            if (ancestors2.includes(head1)) {
              return divergencePointNoDivergence(
                `${input.b1} is a direct ancestor of ${input.b2}`,
              );
            }

            // Find common ancestor
            const set1 = new Set(ancestors1);
            const commonNode = ancestors2.find((n) => set1.has(n));

            if (commonNode !== undefined) {
              return divergencePointOk(commonNode);
            }

            return divergencePointNoDivergence(
              'No common ancestor found between branches',
            );
          },
          storageError,
        );
      }),
    ),

  // Archives a branch. Remains queryable but excluded from active listings.
  archive: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('branch', input.branch),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<BranchError, BranchArchiveOutput>(
              archiveNotFound(`Branch "${input.branch}" not found`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    archived: true,
                    updatedAt: nowISO(),
                  };
                  await storage.put('branch', input.branch, updated);
                  return archiveOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
