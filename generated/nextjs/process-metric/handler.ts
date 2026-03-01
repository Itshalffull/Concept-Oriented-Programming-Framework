// ProcessMetric — Records, queries, and aggregates time-series process metrics with dimensional filtering.
// Supports avg, sum, min, max aggregations over configurable time ranges.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProcessMetricStorage,
  ProcessMetricRecordInput,
  ProcessMetricRecordOutput,
  ProcessMetricQueryInput,
  ProcessMetricQueryOutput,
  ProcessMetricAggregateInput,
  ProcessMetricAggregateOutput,
} from './types.js';

import {
  recordOk,
  queryOk,
  aggregateOk,
  aggregateNoData,
} from './types.js';

export interface ProcessMetricError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ProcessMetricError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Filter metrics by time range and optional process_ref
const filterByTimeRange = (
  records: readonly Record<string, unknown>[],
  name: string,
  startTime: string,
  endTime: string,
  processRef?: string,
): readonly Record<string, unknown>[] => {
  return records.filter((r) => {
    if (String(r['name']) !== name) return false;
    const ts = String(r['timestamp'] ?? '');
    if (ts < startTime || ts > endTime) return false;
    if (processRef && String(r['process_ref'] ?? '') !== processRef) return false;
    return true;
  });
};

export interface ProcessMetricHandler {
  readonly record: (
    input: ProcessMetricRecordInput,
    storage: ProcessMetricStorage,
  ) => TE.TaskEither<ProcessMetricError, ProcessMetricRecordOutput>;
  readonly query: (
    input: ProcessMetricQueryInput,
    storage: ProcessMetricStorage,
  ) => TE.TaskEither<ProcessMetricError, ProcessMetricQueryOutput>;
  readonly aggregate: (
    input: ProcessMetricAggregateInput,
    storage: ProcessMetricStorage,
  ) => TE.TaskEither<ProcessMetricError, ProcessMetricAggregateOutput>;
}

// --- Implementation ---

export const processMetricHandler: ProcessMetricHandler = {
  record: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.put('process_metric', input.metric_id, {
            metric_id: input.metric_id,
            name: input.name,
            value: input.value,
            timestamp: input.timestamp,
            dimensions: input.dimensions ?? null,
            process_ref: input.process_ref ?? null,
            createdAt: new Date().toISOString(),
          });
          return recordOk(input.metric_id);
        },
        toStorageError,
      ),
    ),

  query: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allRecords = await storage.find('process_metric');
          const filtered = filterByTimeRange(
            allRecords,
            input.name,
            input.start_time,
            input.end_time,
            input.process_ref,
          );
          const metrics = filtered.map((r) => ({
            metric_id: String(r['metric_id']),
            name: String(r['name']),
            value: Number(r['value']),
            timestamp: String(r['timestamp']),
            dimensions: r['dimensions'] ? String(r['dimensions']) : null,
            process_ref: r['process_ref'] ? String(r['process_ref']) : null,
          }));
          return queryOk(JSON.stringify(metrics), metrics.length);
        },
        toStorageError,
      ),
    ),

  aggregate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allRecords = await storage.find('process_metric');
          const filtered = filterByTimeRange(
            allRecords,
            input.name,
            input.start_time,
            input.end_time,
            input.process_ref,
          );
          if (filtered.length === 0) {
            return aggregateNoData(
              input.name,
              `No metrics found for '${input.name}' in the specified time range`,
            );
          }
          const values = filtered.map((r) => Number(r['value']));
          let result: number;
          switch (input.operation) {
            case 'avg':
              result = values.reduce((sum, v) => sum + v, 0) / values.length;
              break;
            case 'sum':
              result = values.reduce((sum, v) => sum + v, 0);
              break;
            case 'min':
              result = Math.min(...values);
              break;
            case 'max':
              result = Math.max(...values);
              break;
            default:
              result = 0;
          }
          return aggregateOk(input.name, input.operation, result, values.length);
        },
        toStorageError,
      ),
    ),
};
