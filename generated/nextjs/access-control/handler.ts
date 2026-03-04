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
const err = (error: unknown): AccessControlError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const accessControlHandler: AccessControlHandler = {
  check: (input, storage) => pipe(TE.tryCatch(async () => {
    let policies = await storage.find('policies');
    if (policies.length === 0) {
      await storage.put('policies', 'default-read', { resource: 'document:*', action: 'read', result: 'allowed', tag: 'default', maxAge: 300 });
      await storage.put('policies', 'default-deny', { resource: 'document:*', action: '*', result: 'forbidden', tag: 'default', maxAge: 60 });
      policies = await storage.find('policies');
    }
    let result = 'neutral';
    let tag = 'none';
    let maxAge = 60;
    for (const p of policies) {
      const pResource = p.resource as string;
      const pAction = p.action as string;
      const resourceMatch = pResource === '*' || pResource === input.resource ||
        (pResource.endsWith(':*') && input.resource.startsWith(pResource.slice(0, -1)));
      if (resourceMatch && (pAction === '*' || pAction === input.action)) {
        result = p.result as string;
        tag = (p.tag as string) ?? tag;
        maxAge = (p.maxAge as number) ?? maxAge;
        break;
      }
    }
    return checkOk(result, tag, maxAge);
  }, err)),
  orIf: (input, _storage) => pipe(TE.tryCatch(async () => {
    if (input.left === 'forbidden' || input.right === 'forbidden') return orIfOk('forbidden');
    if (input.left === 'allowed' || input.right === 'allowed') return orIfOk('allowed');
    return orIfOk('neutral');
  }, err)),
  andIf: (input, _storage) => pipe(TE.tryCatch(async () => {
    if (input.left === 'forbidden' || input.right === 'forbidden') return andIfOk('forbidden');
    if (input.left === 'neutral' || input.right === 'neutral') return andIfOk('neutral');
    return andIfOk('allowed');
  }, err)),
};
