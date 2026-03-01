// AccessControl — handler.ts
// Real fp-ts domain logic for three-valued access decisions with composable policy evaluation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  AccessControlStorage,
  AccessControlCheckInput,
  AccessControlCheckOutput,
  AccessControlOrIfInput,
  AccessControlOrIfOutput,
  AccessControlAndIfInput,
  AccessControlAndIfOutput,
} from './types.js';

import {
  checkOk,
  orIfOk,
  andIfOk,
} from './types.js';

export interface AccessControlError {
  readonly code: string;
  readonly message: string;
}

export interface AccessControlHandler {
  readonly check: (
    input: AccessControlCheckInput,
    storage: AccessControlStorage,
  ) => TE.TaskEither<AccessControlError, AccessControlCheckOutput>;
  readonly orIf: (
    input: AccessControlOrIfInput,
    storage: AccessControlStorage,
  ) => TE.TaskEither<AccessControlError, AccessControlOrIfOutput>;
  readonly andIf: (
    input: AccessControlAndIfInput,
    storage: AccessControlStorage,
  ) => TE.TaskEither<AccessControlError, AccessControlAndIfOutput>;
}

// --- Pure helpers ---

type AccessResult = 'allowed' | 'forbidden' | 'neutral';

const VALID_RESULTS: readonly string[] = ['allowed', 'forbidden', 'neutral'];

const normalizeResult = (value: string): AccessResult =>
  VALID_RESULTS.includes(value) ? (value as AccessResult) : 'neutral';

/**
 * Combine two access results with OR semantics.
 * - forbidden overrides everything
 * - allowed if either is allowed (and neither is forbidden)
 * - neutral only if both are neutral
 */
const combineOr = (left: AccessResult, right: AccessResult): AccessResult => {
  if (left === 'forbidden' || right === 'forbidden') return 'forbidden';
  if (left === 'allowed' || right === 'allowed') return 'allowed';
  return 'neutral';
};

/**
 * Combine two access results with AND semantics.
 * - forbidden overrides everything
 * - allowed only if both are allowed
 * - neutral if neither is forbidden and at least one is neutral
 */
const combineAnd = (left: AccessResult, right: AccessResult): AccessResult => {
  if (left === 'forbidden' || right === 'forbidden') return 'forbidden';
  if (left === 'allowed' && right === 'allowed') return 'allowed';
  return 'neutral';
};

const storageError = (error: unknown): AccessControlError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/**
 * Evaluate policies for a resource+action+context triple. Loads all matching
 * policies from storage, reduces them using OR semantics (forbidden wins),
 * and reports contributing policy tags and the minimum maxAge across matches.
 */
const evaluatePolicies = (
  policies: readonly Record<string, unknown>[],
  resource: string,
  action: string,
  context: string,
): { readonly result: AccessResult; readonly tags: readonly string[]; readonly maxAge: number } => {
  const matching = policies.filter((p) => {
    const pResource = p.resource as string | undefined;
    const pAction = p.action as string | undefined;
    // A policy matches if its resource/action pattern covers the request.
    // Wildcard '*' matches anything; exact match otherwise.
    const resourceMatch = !pResource || pResource === '*' || pResource === resource;
    const actionMatch = !pAction || pAction === '*' || pAction === action;
    return resourceMatch && actionMatch;
  });

  if (matching.length === 0) {
    return { result: 'neutral', tags: [], maxAge: 0 };
  }

  const results = matching.map((p) => ({
    result: normalizeResult((p.result as string) ?? 'neutral'),
    tag: (p.tag as string) ?? (p.id as string) ?? 'unknown',
    maxAge: typeof p.maxAge === 'number' ? p.maxAge : 300,
  }));

  const combinedResult = results.reduce<AccessResult>(
    (acc, cur) => combineOr(acc, cur.result),
    'neutral',
  );

  const tags = results.map((r) => r.tag);
  const maxAge = results.reduce(
    (min, cur) => Math.min(min, cur.maxAge),
    Number.MAX_SAFE_INTEGER,
  );

  return {
    result: combinedResult,
    tags,
    maxAge: maxAge === Number.MAX_SAFE_INTEGER ? 0 : maxAge,
  };
};

// --- Implementation ---

export const accessControlHandler: AccessControlHandler = {
  check: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('policies', { resource: input.resource }),
        storageError,
      ),
      TE.map((policies) => {
        const { result, tags, maxAge } = evaluatePolicies(
          policies,
          input.resource,
          input.action,
          input.context,
        );
        return checkOk(result, JSON.stringify(tags), maxAge);
      }),
    ),

  orIf: (input, _storage) =>
    pipe(
      TE.right<AccessControlError, AccessControlOrIfOutput>(
        orIfOk(combineOr(normalizeResult(input.left), normalizeResult(input.right))),
      ),
    ),

  andIf: (input, _storage) =>
    pipe(
      TE.right<AccessControlError, AccessControlAndIfOutput>(
        andIfOk(combineAnd(normalizeResult(input.left), normalizeResult(input.right))),
      ),
    ),
};
