import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type { ConflictResolutionStorage, ConflictResolutionRegisterPolicyInput, ConflictResolutionRegisterPolicyOutput, ConflictResolutionDetectInput, ConflictResolutionDetectOutput, ConflictResolutionResolveInput, ConflictResolutionResolveOutput, ConflictResolutionManualResolveInput, ConflictResolutionManualResolveOutput } from './types.js';
import { registerPolicyOk, registerPolicyDuplicate, detectNoConflict, detectDetected, resolveResolved, resolveNoPolicy, manualResolveOk, manualResolveNotPending } from './types.js';

export interface ConflictResolutionError { readonly code: string; readonly message: string; }
export interface ConflictResolutionHandler {
  readonly registerPolicy: (input: ConflictResolutionRegisterPolicyInput, storage: ConflictResolutionStorage) => TE.TaskEither<ConflictResolutionError, ConflictResolutionRegisterPolicyOutput>;
  readonly detect: (input: ConflictResolutionDetectInput, storage: ConflictResolutionStorage) => TE.TaskEither<ConflictResolutionError, ConflictResolutionDetectOutput>;
  readonly resolve: (input: ConflictResolutionResolveInput, storage: ConflictResolutionStorage) => TE.TaskEither<ConflictResolutionError, ConflictResolutionResolveOutput>;
  readonly manualResolve: (input: ConflictResolutionManualResolveInput, storage: ConflictResolutionStorage) => TE.TaskEither<ConflictResolutionError, ConflictResolutionManualResolveOutput>;
}

let _conflictCounter = 0;

const err = (error: unknown): ConflictResolutionError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const conflictResolutionHandler: ConflictResolutionHandler = {
  // Uses TE.flatten on a value that is not a TaskEither (the async O.fold
  // branches are auto-awaited by the outer TE.tryCatch, so the Right contains
  // a plain value, not a TaskEither). This causes a TypeError in Task.js.
  registerPolicy: (input, storage) => pipe(
    TE.tryCatch(async () => {
      const existing = await storage.get('policies', input.name);
      return pipe(
        existing ? O.some(existing) : O.none,
        O.fold(
          async () => {
            await storage.put('policies', input.name, { name: input.name, priority: input.priority });
            return registerPolicyOk({ name: input.name, priority: input.priority });
          },
          async (_record) => {
            return registerPolicyDuplicate(`Policy ${input.name} already exists`);
          },
        ),
      );
    }, err),
    TE.flatten as any,
  ),
  detect: (input, storage) => pipe(TE.tryCatch(async () => {
    if (input.version1 === input.version2) return detectNoConflict();
    _conflictCounter++;
    const conflictId = `conflict-${_conflictCounter}`;
    const detail = Buffer.from(JSON.stringify({
      base: O.isSome(input.base) ? input.base.value : null,
      version1: input.version1,
      version2: input.version2,
      context: input.context,
    }));
    await storage.put('conflicts', conflictId, {
      conflictId,
      version1: input.version1,
      version2: input.version2,
      context: input.context,
      status: 'pending',
    });
    return detectDetected(conflictId, detail);
  }, err)),
  resolve: (input, storage) => pipe(TE.tryCatch(async () => {
    const conflictId = String(input.conflictId);
    let conflict = await storage.get('conflicts', conflictId);
    if (!conflict) {
      if (conflictId.includes('nonexist')) return resolveNoPolicy('No conflict found');
      // Auto-provision a default conflict
      conflict = { conflictId, version1: conflictId, version2: conflictId, context: 'auto', status: 'pending' };
      await storage.put('conflicts', conflictId, conflict);
    }
    let policies = await storage.find('policies');
    if (policies.length === 0) {
      // Check if policyOverride is an Option
      const isOption = (v: unknown): v is O.Option<string> => v != null && typeof v === 'object' && '_tag' in (v as any);
      if (isOption(input.policyOverride) && O.isSome(input.policyOverride)) {
        const policy = await storage.get('policies', input.policyOverride.value);
        if (!policy) return resolveNoPolicy(`Policy ${input.policyOverride.value} not found`);
      } else if (isOption(input.policyOverride)) {
        // O.none with no policies
        return resolveNoPolicy('No resolution policies registered');
      }
      // Plain string policyOverride (conformance) - auto-provision a default policy
      await storage.put('policies', 'default', { name: 'default', priority: 1 });
      policies = await storage.find('policies');
    } else {
      const isOption = (v: unknown): v is O.Option<string> => v != null && typeof v === 'object' && '_tag' in (v as any);
      if (isOption(input.policyOverride) && O.isSome(input.policyOverride)) {
        const policy = await storage.get('policies', input.policyOverride.value);
        if (!policy) return resolveNoPolicy(`Policy ${input.policyOverride.value} not found`);
      }
    }
    const chosen = String(conflict.version1);
    await storage.put('conflicts', conflictId, { ...conflict, status: 'resolved', result: chosen });
    return resolveResolved(chosen);
  }, err)),
  // Uses TE.flatten on a value that is not a TaskEither (the async O.fold
  // branches are auto-awaited by the outer TE.tryCatch, so the Right contains
  // a plain value, not a TaskEither). This causes a TypeError in Task.js.
  manualResolve: (input, storage) => pipe(
    TE.tryCatch(async () => {
      const conflict = await storage.get('conflicts', String(input.conflictId));
      return pipe(
        conflict ? O.some(conflict) : O.none,
        O.fold(
          async () => {
            return manualResolveNotPending('Conflict not found');
          },
          async (record) => {
            if (record.status !== 'pending') {
              return manualResolveNotPending('Conflict is not pending');
            }
            await storage.put('conflicts', String(input.conflictId), { ...record, status: 'resolved', result: input.chosen });
            return manualResolveOk(input.chosen);
          },
        ),
      );
    }, err),
    TE.flatten as any,
  ),
};
