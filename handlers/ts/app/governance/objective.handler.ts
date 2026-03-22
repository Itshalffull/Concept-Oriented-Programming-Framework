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
    const id = `objective-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'objective', id, {
      id, title: input.title, description: input.description,
      metricRefs: input.metricRefs ?? [],
      targetDate: input.targetDate, owner: input.owner,
      status: 'Active', progress: 0, createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { objective: id }) as StorageProgram<Result>;
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
      (b) => {
        return completeFrom(b, 'achieved', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const achieved = (record.progress as number) >= 100;
          if (achieved) {
            return { variant: 'achieved', objective };
          }
          return { variant: 'missed', objective, progress: record.progress };
        });
      },
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
        return complete(b2, 'cancelled', { objective });
      },
      (b) => complete(b, 'not_found', { objective }),
    );

    return p as StorageProgram<Result>;
  },
};

export const objectiveHandler = autoInterpret(_objectiveHandler);
