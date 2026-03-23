// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Objective Concept Handler
// OKR / Balanced Scorecard objective tracking.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _objectiveHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.title || (typeof input.title === 'string' && (input.title as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }
    if (!input.description || (typeof input.description === 'string' && (input.description as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'description is required' }) as StorageProgram<Result>;
    }
    if (!input.owner || (typeof input.owner === 'string' && (input.owner as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'owner is required' }) as StorageProgram<Result>;
    }
    if (!input.metricRefs || (typeof input.metricRefs === 'string' && (input.metricRefs as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'metricRefs is required' }) as StorageProgram<Result>;
    }
    if (!input.targetDate || (typeof input.targetDate === 'string' && (input.targetDate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'targetDate is required' }) as StorageProgram<Result>;
    }
    const id = `objective-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'objective', id, {
      id, title: input.title, description: input.description,
      metricRefs: input.metricRefs ?? [],
      targetDate: input.targetDate, owner: input.owner,
      status: 'Active', progress: 0, createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { id, objective: id }) as StorageProgram<Result>;
  },

  updateProgress(input: Record<string, unknown>) {
    const { objective, currentValue } = input;
    let p = createProgram();
    p = get(p, 'objective', objective as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'objective', objective as string, { progress: currentValue, updatedAt: new Date().toISOString() });
        return complete(b2, 'ok', { objective, progress: currentValue });
      },
      (b) => complete(b, 'not_found', { objective }),
    );

    return p as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { objective } = input;
    let p = createProgram();
    p = get(p, 'objective', objective as string, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'ok', { objective }),
      (b) => complete(b, 'not_found', { objective }),
    );

    return p as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const { objective, reason } = input;
    let p = createProgram();
    p = get(p, 'objective', objective as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'objective', objective as string, { status: 'Cancelled', cancelReason: reason });
        return complete(b2, 'ok', { objective });
      },
      (b) => complete(b, 'not_found', { objective }),
    );

    return p as StorageProgram<Result>;
  },
};

export const objectiveHandler = autoInterpret(_objectiveHandler);
