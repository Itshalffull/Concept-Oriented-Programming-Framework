// WorkItem — handler.ts
// Real fp-ts domain logic for human work-item lifecycle with pool-based assignment and status transitions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WorkItemStorage,
  WorkItemStatus,
  WorkItemCreateInput,
  WorkItemCreateOutput,
  WorkItemClaimInput,
  WorkItemClaimOutput,
  WorkItemStartInput,
  WorkItemStartOutput,
  WorkItemCompleteInput,
  WorkItemCompleteOutput,
  WorkItemRejectInput,
  WorkItemRejectOutput,
  WorkItemDelegateInput,
  WorkItemDelegateOutput,
  WorkItemReleaseInput,
  WorkItemReleaseOutput,
} from './types.js';

import {
  createOk,
  claimOk,
  claimNotFound,
  claimInvalidStatus,
  claimNotInPool,
  startOk,
  startNotFound,
  startInvalidStatus,
  completeOk,
  completeNotFound,
  completeInvalidStatus,
  rejectOk,
  rejectNotFound,
  rejectInvalidStatus,
  delegateOk,
  delegateNotFound,
  delegateInvalidStatus,
  releaseOk,
  releaseNotFound,
  releaseInvalidStatus,
} from './types.js';

export interface WorkItemError {
  readonly code: string;
  readonly message: string;
}

export interface WorkItemHandler {
  readonly create: (
    input: WorkItemCreateInput,
    storage: WorkItemStorage,
  ) => TE.TaskEither<WorkItemError, WorkItemCreateOutput>;
  readonly claim: (
    input: WorkItemClaimInput,
    storage: WorkItemStorage,
  ) => TE.TaskEither<WorkItemError, WorkItemClaimOutput>;
  readonly start: (
    input: WorkItemStartInput,
    storage: WorkItemStorage,
  ) => TE.TaskEither<WorkItemError, WorkItemStartOutput>;
  readonly complete: (
    input: WorkItemCompleteInput,
    storage: WorkItemStorage,
  ) => TE.TaskEither<WorkItemError, WorkItemCompleteOutput>;
  readonly reject: (
    input: WorkItemRejectInput,
    storage: WorkItemStorage,
  ) => TE.TaskEither<WorkItemError, WorkItemRejectOutput>;
  readonly delegate: (
    input: WorkItemDelegateInput,
    storage: WorkItemStorage,
  ) => TE.TaskEither<WorkItemError, WorkItemDelegateOutput>;
  readonly release: (
    input: WorkItemReleaseInput,
    storage: WorkItemStorage,
  ) => TE.TaskEither<WorkItemError, WorkItemReleaseOutput>;
}

// --- Pure helpers ---

const compositeKey = (run_ref: string, step_ref: string): string =>
  `${run_ref}::${step_ref}`;

/** Derive the storage key from input, supporting both run_ref/step_ref and item-based lookups. */
const getItemKey = (input: Record<string, unknown>): string => {
  if (typeof input['item'] === 'string') return input['item'];
  if (typeof input['run_ref'] === 'string' && typeof input['step_ref'] === 'string') {
    return compositeKey(input['run_ref'] as string, input['step_ref'] as string);
  }
  return String(input['item'] ?? '');
};

const storageError = (error: unknown): WorkItemError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const workItemHandler: WorkItemHandler = {
  /**
   * Create a new work item in the offered state, ready for pool-based claiming.
   */
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = input.step_ref;
          const now = Date.now();
          // When candidate_pool is a single string, treat it as a pool name (any assignee allowed)
          // When it's an array, treat it as an explicit member list
          const isPoolName = typeof input.candidate_pool === 'string';
          const candidatePool = isPoolName
            ? [input.candidate_pool]
            : (Array.isArray(input.candidate_pool) ? [...input.candidate_pool] : []);
          await storage.put('work_items', key, {
            work_item_id: key,
            item: key,
            step_ref: input.step_ref,
            candidate_pool: candidatePool,
            pool_is_name: isPoolName,
            form_schema: input.form_schema,
            priority: input.priority,
            status: 'offered' as WorkItemStatus,
            assignee: null,
            form_data: null,
            rejection_reason: null,
            created_at: now,
            updated_at: now,
          });
          return { ...createOk(key, 'offered'), item: key, step_ref: input.step_ref } as any;
        },
        storageError,
      ),
    ),

  /**
   * Claim a work item. Validates the item is in offered status and the assignee
   * is in the candidate pool before transitioning to claimed.
   */
  claim: (input, storage) => {
    const itemKey = getItemKey(input as any);
    return pipe(
      TE.tryCatch(
        () => storage.get('work_items', itemKey),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WorkItemError, WorkItemClaimOutput>(
              claimNotFound(`Work item '${itemKey}' not found`),
            ),
            (rec) => {
              const status = rec.status as WorkItemStatus;
              if (status !== 'offered') {
                return TE.right<WorkItemError, WorkItemClaimOutput>(
                  claimInvalidStatus(
                    `Work item must be in 'offered' status to claim, currently '${status}'`,
                    status,
                  ),
                );
              }
              // Skip pool membership check if pool is a name reference (not a member list)
              const poolIsName = rec.pool_is_name === true;
              if (!poolIsName) {
                const pool = (rec.candidate_pool as string[]) ?? [];
                if (pool.length > 0 && !pool.includes(input.assignee)) {
                  return TE.right<WorkItemError, WorkItemClaimOutput>(
                    claimNotInPool(
                      `Assignee '${input.assignee}' is not in the candidate pool`,
                    ),
                  );
                }
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('work_items', itemKey, {
                    ...rec,
                    status: 'claimed' as WorkItemStatus,
                    assignee: input.assignee,
                    updated_at: Date.now(),
                  });
                  return { ...claimOk(itemKey, input.assignee, 'claimed'), item: itemKey } as any;
                },
                storageError,
              );
            },
          ),
        ),
      ),
    );
  },

  /**
   * Start working on a claimed item. Transitions from claimed to active.
   */
  start: (input, storage) => {
    const itemKey = getItemKey(input as any);
    return pipe(
      TE.tryCatch(
        () => storage.get('work_items', itemKey),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WorkItemError, WorkItemStartOutput>(
              startNotFound(`Work item '${itemKey}' not found`),
            ),
            (item) => {
              const status = item.status as WorkItemStatus;
              if (status !== 'claimed') {
                return TE.right<WorkItemError, WorkItemStartOutput>(
                  startInvalidStatus(
                    `Work item must be in 'claimed' status to start, currently '${status}'`,
                    status,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('work_items', itemKey, {
                    ...item,
                    status: 'active' as WorkItemStatus,
                    started_at: Date.now(),
                    updated_at: Date.now(),
                  });
                  return { ...startOk(itemKey, 'active'), item: itemKey } as any;
                },
                storageError,
              );
            },
          ),
        ),
      ),
    );
  },

  /**
   * Complete a work item by recording form data. Transitions from active to completed.
   */
  complete: (input, storage) => {
    const itemKey = getItemKey(input as any);
    return pipe(
      TE.tryCatch(
        () => storage.get('work_items', itemKey),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WorkItemError, WorkItemCompleteOutput>(
              completeNotFound(`Work item '${itemKey}' not found`),
            ),
            (item) => {
              const status = item.status as WorkItemStatus;
              if (status !== 'active') {
                return TE.right<WorkItemError, WorkItemCompleteOutput>(
                  completeInvalidStatus(
                    `Work item must be in 'active' status to complete, currently '${status}'`,
                    status,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('work_items', itemKey, {
                    ...item,
                    status: 'completed' as WorkItemStatus,
                    form_data: input.form_data,
                    completed_at: Date.now(),
                    updated_at: Date.now(),
                  });
                  return {
                    ...completeOk(itemKey, 'completed', input.form_data),
                    item: itemKey,
                    step_ref: String(item['step_ref'] ?? ''),
                    form_data: input.form_data,
                  } as any;
                },
                storageError,
              );
            },
          ),
        ),
      ),
    );
  },

  /**
   * Reject a work item. Allowed from active or claimed status.
   */
  reject: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('work_items', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WorkItemError, WorkItemRejectOutput>(
              rejectNotFound(`Work item '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (item) => {
              const status = item.status as WorkItemStatus;
              if (status !== 'active' && status !== 'claimed') {
                return TE.right<WorkItemError, WorkItemRejectOutput>(
                  rejectInvalidStatus(
                    `Work item must be in 'active' or 'claimed' status to reject, currently '${status}'`,
                    status,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const key = compositeKey(input.run_ref, input.step_ref);
                  await storage.put('work_items', key, {
                    ...item,
                    status: 'rejected' as WorkItemStatus,
                    rejection_reason: input.reason,
                    updated_at: Date.now(),
                  });
                  return rejectOk(key, 'rejected', input.reason);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Delegate a work item to a new assignee. Allowed from claimed or active status.
   */
  delegate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('work_items', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WorkItemError, WorkItemDelegateOutput>(
              delegateNotFound(`Work item '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (item) => {
              const status = item.status as WorkItemStatus;
              if (status !== 'claimed' && status !== 'active') {
                return TE.right<WorkItemError, WorkItemDelegateOutput>(
                  delegateInvalidStatus(
                    `Work item must be in 'claimed' or 'active' status to delegate, currently '${status}'`,
                    status,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const key = compositeKey(input.run_ref, input.step_ref);
                  await storage.put('work_items', key, {
                    ...item,
                    status: 'delegated' as WorkItemStatus,
                    assignee: input.new_assignee,
                    updated_at: Date.now(),
                  });
                  return delegateOk(key, input.new_assignee, 'delegated');
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Release a claimed work item back to the pool. Clears the assignee and
   * transitions from claimed back to offered.
   */
  release: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('work_items', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WorkItemError, WorkItemReleaseOutput>(
              releaseNotFound(`Work item '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (item) => {
              const status = item.status as WorkItemStatus;
              if (status !== 'claimed') {
                return TE.right<WorkItemError, WorkItemReleaseOutput>(
                  releaseInvalidStatus(
                    `Work item must be in 'claimed' status to release, currently '${status}'`,
                    status,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const key = compositeKey(input.run_ref, input.step_ref);
                  await storage.put('work_items', key, {
                    ...item,
                    status: 'offered' as WorkItemStatus,
                    assignee: null,
                    updated_at: Date.now(),
                  });
                  return releaseOk(key, 'offered');
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
