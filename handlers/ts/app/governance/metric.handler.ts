// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Metric Concept Handler
// KPI tracking with threshold detection.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, merge, mergeFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _metricHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const id = `metric-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'metric', id, {
      id, name: input.name, unit: input.unit,
      aggregation: input.aggregation, value: null, history: [],
    });
    return complete(p, 'ok', { metric: id }) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const { metric, value, source } = input;
    let p = createProgram();
    p = get(p, 'metric', metric as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const history = (record.history as unknown[]) || [];
          const previousValue = record.value;
          const updatedHistory = [...history, { value, source, recordedAt: new Date().toISOString() }];
          // Check threshold
          if (record.threshold !== undefined) {
            const threshold = record.threshold as number;
            if ((previousValue as number) <= threshold && (value as number) > threshold) {
              return { updatedHistory, previousValue, thresholdCrossed: true, threshold };
            }
          }
          return { updatedHistory, previousValue, thresholdCrossed: false };
        }, 'computed');

        b = branch(b,
          (bindings) => !!(bindings.computed as Record<string, unknown>).thresholdCrossed,
          (b2) => {
            let b3 = mergeFrom(b2, 'metric', metric as string, (bindings) => {
              const computed = bindings.computed as Record<string, unknown>;
              return { value, history: computed.updatedHistory, updatedAt: new Date().toISOString() };
            });
            return completeFrom(b3, 'threshold_crossed', (bindings) => {
              const computed = bindings.computed as Record<string, unknown>;
              return { metric, threshold: computed.threshold, direction: 'breached' };
            });
          },
          (b2) => {
            let b3 = mergeFrom(b2, 'metric', metric as string, (bindings) => {
              const computed = bindings.computed as Record<string, unknown>;
              return { value, history: computed.updatedHistory, updatedAt: new Date().toISOString() };
            });
            return completeFrom(b3, 'updated', (bindings) => {
              const computed = bindings.computed as Record<string, unknown>;
              return { metric, previousValue: computed.previousValue };
            });
          },
        );

        return b;
      },
      (b) => complete(b, 'not_found', { metric }),
    );

    return p as StorageProgram<Result>;
  },

  setThreshold(input: Record<string, unknown>) {
    const { metric, threshold, alertOnBreach } = input;
    let p = createProgram();
    p = get(p, 'metric', metric as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = merge(b, 'metric', metric as string, { threshold, alertOnBreach });
        return complete(b2, 'ok', { metric });
      },
      (b) => complete(b, 'not_found', { metric }),
    );

    return p as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { metric } = input;
    let p = createProgram();
    p = get(p, 'metric', metric as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return branch(b,
          (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return record.threshold == null || (record.value as number) <= (record.threshold as number);
          },
          completeFrom(createProgram(), 'within_threshold', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { metric, value: record.value };
          }),
          completeFrom(createProgram(), 'threshold_crossed', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { metric, threshold: record.threshold, direction: 'breached' };
          }),
        );
      },
      (b) => complete(b, 'not_found', { metric }),
    );

    return p as StorageProgram<Result>;
  },
};

export const metricHandler = autoInterpret(_metricHandler);
