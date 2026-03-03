import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { BranchStorage, BranchCreateInput, BranchCreateOutput, BranchAdvanceInput, BranchAdvanceOutput, BranchProtectInput, BranchProtectOutput } from './types.js';
import { createOk, advanceOk, advanceProtected, protectOk } from './types.js';

export interface BranchError { readonly code: string; readonly message: string; }
export interface BranchHandler {
  readonly create: (input: BranchCreateInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchCreateOutput>;
  readonly advance: (input: BranchAdvanceInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchAdvanceOutput>;
  readonly protect: (input: BranchProtectInput, storage: BranchStorage) => TE.TaskEither<BranchError, BranchProtectOutput>;
}

let _branchCounter = 0;
const err = (error: unknown): BranchError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const branchHandler: BranchHandler = {
  create: (input, storage) => pipe(TE.tryCatch(async () => {
    _branchCounter++;
    const branch = `branch-${_branchCounter}`;
    await storage.put('branches', branch, { name: input.name, fromNode: input.fromNode, branch, head: input.fromNode });
    return createOk(branch);
  }, err)),
  advance: (input, storage) => pipe(TE.tryCatch(async () => {
    const protection = await storage.get('branch_protection', input.branch);
    if (protection && protection.protected === true) {
      return advanceProtected(`Branch ${input.branch} is protected`);
    }
    const record = await storage.get('branches', input.branch);
    if (record) {
      await storage.put('branches', input.branch, { ...record, head: input.newNode });
    }
    return advanceOk();
  }, err)),
  protect: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.put('branch_protection', input.branch, { branch: input.branch, protected: true });
    return protectOk();
  }, err)),
};
