// @clef-handler style=functional
// Proposal Concept Implementation
// Formalizes a request for collective decision and tracks it through a governance lifecycle.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `proposal-${++idCounter}`;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ['Pending', 'Cancelled'],
  Pending: ['Sponsored', 'Active', 'Cancelled'],
  Sponsored: ['Active', 'Cancelled'],
  Active: ['Passed', 'Failed', 'Cancelled'],
  Passed: ['Queued', 'Executed'],
  Failed: [],
  Queued: ['Executed', 'Cancelled'],
  Executed: [],
  Cancelled: [],
};

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Proposal' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const proposer = input.proposer as string;
    const title = input.title as string;
    const description = input.description as string;
    const actions = input.actions as string[];

    if (!proposer || proposer.trim() === '') {
      return complete(createProgram(), 'error', { message: 'proposer is required' }) as StorageProgram<Result>;
    }
    if (!title || title.trim() === '') {
      return complete(createProgram(), 'invalid', { reason: 'title is required' }) as StorageProgram<Result>;
    }
    if (!actions || actions.length === 0) {
      return complete(createProgram(), 'invalid', { reason: 'at least one action is required' }) as StorageProgram<Result>;
    }

    const id = (input.proposal as string | undefined) ?? nextId();
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, 'proposal', id, {
      id,
      proposer,
      title,
      description,
      actions,
      status: 'Pending',
      sponsor: null,
      createdAt: now,
      updatedAt: now,
      metadata: null,
    });
    return complete(p, 'ok', { proposal: id }) as StorageProgram<Result>;
  },

  sponsor(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;
    const sponsorId = input.sponsorId as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'error', { message: 'Proposal not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'proposal', proposalId, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          return { ...rec, status: 'Sponsored', sponsor: sponsorId, updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { proposal: proposalId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'error', { message: 'Proposal not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'proposal', proposalId, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          return { ...rec, status: 'Active', updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { proposal: proposalId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  advance(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;
    const newStatus = input.newStatus as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'error', { message: 'Proposal not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'proposal', proposalId, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          return { ...rec, status: newStatus, updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { proposal: proposalId, status: newStatus }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;
    const canceller = input.canceller as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'not_found', { message: 'Proposal not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'proposal', proposalId, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          // Proposer can cancel their own proposal
          if (rec.proposer !== canceller) {
            return { ...rec, _unauthorised: true };
          }
          return { ...rec, status: 'Cancelled', updatedAt: new Date().toISOString() };
        });
        b2 = mapBindings(b2, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          return rec.proposer !== canceller;
        }, '_isUnauthorised');
        return branch(
          b2,
          (b) => !!b._isUnauthorised,
          complete(createProgram(), 'unauthorized', { canceller }),
          complete(createProgram(), 'ok', { proposal: proposalId }),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;
    const resolvedConflictsRaw = input.resolvedConflicts as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let resolvedConflicts: string[] = [];
    try {
      resolvedConflicts = JSON.parse(resolvedConflictsRaw || '[]') as string[];
    } catch {
      return complete(createProgram(), 'error', { message: 'resolvedConflicts must be a valid JSON array' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'proposal', proposalId, 'proposalRecord');
    // Read the epoch counter to stamp on merge
    p = get(p, 'policyEpoch', '__epoch', 'epochRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'not_found', { message: 'Proposal not found' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          return rec.status === 'Merged';
        }, '_alreadyMerged');
        b2 = mapBindings(b2, (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          const conflicts: string[] = (rec.conflictsWith as string[]) || [];
          const unresolved = conflicts.filter((c: string) => !resolvedConflicts.includes(c));
          return unresolved;
        }, '_unresolvedConflicts');

        return branch(
          b2,
          (b) => !!b._alreadyMerged,
          complete(createProgram(), 'already_merged', { message: 'Proposal has already been merged' }),
          (() => {
            let b3 = createProgram();
            return branch(
              b3,
              (b) => {
                const unresolved = b._unresolvedConflicts as string[];
                return unresolved && unresolved.length > 0;
              },
              completeFrom(createProgram(), 'conflict', (b) => ({
                conflictsWith: JSON.stringify(b._unresolvedConflicts as string[]),
              })),
              (() => {
                // Perform the merge: stamp epoch and mergedAt
                let b4 = createProgram();
                b4 = putFrom(b4, 'proposal', proposalId, (b) => {
                  const rec = b.proposalRecord as Record<string, unknown>;
                  const epochRec = (b.epochRecord as Record<string, unknown>) || { epoch: 0 };
                  const currentEpoch = ((epochRec.epoch as number) || 0);
                  const mergedEpoch = currentEpoch + 1;
                  return {
                    ...rec,
                    status: 'Merged',
                    mergedAt: new Date().toISOString(),
                    policyEpoch: mergedEpoch,
                    updatedAt: new Date().toISOString(),
                  };
                });
                return completeFrom(b4, 'ok', (b) => {
                  const epochRec = (b.epochRecord as Record<string, unknown>) || { epoch: 0 };
                  const currentEpoch = ((epochRec.epoch as number) || 0);
                  return { proposal: proposalId, policyEpoch: currentEpoch + 1 };
                }) as StorageProgram<Result>;
              })(),
            ) as StorageProgram<Result>;
          })(),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  detectConflicts(input: Record<string, unknown>) {
    const proposalId = input.proposal as string;

    if (!proposalId) {
      return complete(createProgram(), 'error', { message: 'proposal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'proposal', proposalId, 'proposalRecord');

    return branch(
      p,
      (b) => !b.proposalRecord,
      complete(createProgram(), 'not_found', { message: 'Proposal not found' }),
      (() => {
        let b2 = createProgram();
        return completeFrom(b2, 'ok', (b) => {
          const rec = b.proposalRecord as Record<string, unknown>;
          const conflicts: string[] = (rec.conflictsWith as string[]) || [];
          return { conflicts: JSON.stringify(conflicts) };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const proposalHandler = autoInterpret(_handler);
