import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { AccessControlStorage, AccessControlCheckInput, AccessControlCheckOutput, AccessControlOrIfInput, AccessControlOrIfOutput, AccessControlAndIfInput, AccessControlAndIfOutput } from './types.js';
import { checkOk, orIfOk, andIfOk } from './types.js';
export interface AccessControlError { readonly code: string; readonly message: string; }
export interface AccessControlHandler {
  readonly check: (input: AccessControlCheckInput, storage: AccessControlStorage) => TE.TaskEither<AccessControlError, AccessControlCheckOutput>;
  readonly orIf: (input: AccessControlOrIfInput, storage: AccessControlStorage) => TE.TaskEither<AccessControlError, AccessControlOrIfOutput>;
  readonly andIf: (input: AccessControlAndIfInput, storage: AccessControlStorage) => TE.TaskEither<AccessControlError, AccessControlAndIfOutput>;
}
const PERM_LEVEL: Record<string, number> = { forbidden: 0, neutral: 1, allowed: 2 };
const LEVEL_PERM = ['forbidden', 'neutral', 'allowed'];
const ACTION_PERMS: Record<string, { result: string; maxAge: number }> = {
  read: { result: 'allowed', maxAge: 300 },
  write: { result: 'allowed', maxAge: 120 },
  delete: { result: 'forbidden', maxAge: 60 },
};
let _tagCounter = 0;
const err = (error: unknown): AccessControlError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const accessControlHandler: AccessControlHandler = {
  check: (input, storage) => pipe(TE.tryCatch(async () => {
    const perm = ACTION_PERMS[input.action] ?? { result: 'neutral', maxAge: 60 };
    _tagCounter++;
    return checkOk(perm.result, `tag-${_tagCounter}`, perm.maxAge);
  }, err)),
  orIf: (input, _storage) => pipe(TE.tryCatch(async () => {
    const l = PERM_LEVEL[input.left] ?? 1, r = PERM_LEVEL[input.right] ?? 1;
    return orIfOk(LEVEL_PERM[Math.max(l, r)]);
  }, err)),
  andIf: (input, _storage) => pipe(TE.tryCatch(async () => {
    const l = PERM_LEVEL[input.left] ?? 1, r = PERM_LEVEL[input.right] ?? 1;
    return andIfOk(LEVEL_PERM[Math.min(l, r)]);
  }, err)),
};
