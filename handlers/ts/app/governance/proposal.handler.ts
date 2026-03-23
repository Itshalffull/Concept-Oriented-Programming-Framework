// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Proposal Concept Handler
// Formal request for collective decision with Draft->Active->Passed/Failed lifecycle.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _proposalHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.title || (typeof input.title === 'string' && (input.title as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }
    if (!input.actions || (typeof input.actions === 'string' && (input.actions as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'actions is required' }) as StorageProgram<Result>;
    }
    const id = `proposal-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'proposal', id, {
      id, proposer: input.proposer, title: input.title, description: input.description,
      actions: input.actions, status: 'Draft', createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { proposal: id }) as StorageProgram<Result>;
  },

  sponsor(input: Record<string, unknown>) {
    const { proposal, sponsor } = input;
    let p = createProgram();
    p = get(p, 'proposal', proposal as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'proposal', proposal as string, { status: 'Sponsored', sponsor });
        return complete(b2, 'ok', { proposal });
      },
      (b) => complete(b, 'not_found', { proposal }),
    );

    return p as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const { proposal } = input;
    let p = createProgram();
    p = get(p, 'proposal', proposal as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'proposal', proposal as string, { status: 'Active', activatedAt: new Date().toISOString() });
        return complete(b2, 'ok', { proposal });
      },
      (b) => complete(b, 'not_found', { proposal }),
    );

    return p as StorageProgram<Result>;
  },

  advance(input: Record<string, unknown>) {
    const { proposal, newStatus } = input;
    let p = createProgram();
    p = get(p, 'proposal', proposal as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'proposal', proposal as string, { status: newStatus, advancedAt: new Date().toISOString() });
        return complete(b2, 'ok', { proposal, status: newStatus });
      },
      (b) => complete(b, 'not_found', { proposal }),
    );

    return p as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const { proposal, reason } = input;
    let p = createProgram();
    p = get(p, 'proposal', proposal as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'proposal', proposal as string, { status: 'Cancelled', cancelReason: reason });
        return complete(b2, 'cancelled', { proposal });
      },
      (b) => complete(b, 'not_found', { proposal }),
    );

    return p as StorageProgram<Result>;
  },
};

export const proposalHandler = autoInterpret(_proposalHandler);
