// @clef-handler style=functional
// ProcessMetric Concept Implementation
// Aggregate and expose process-level performance metrics
// for dashboards, SLA monitoring, and process mining.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let _metricCounter = 0;
function nextMetricId(): string {
  _metricCounter += 1;
  return `pm-${Date.now()}-${_metricCounter}`;
}

const _processMetricHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { concept: 'ProcessMetric' }) as StorageProgram<Result>;
  },

  record(input: Record<string, unknown>) {
    const metricName = input.metric_name as string;
    const metricValue = input.metric_value as number;
    const dimensionsRaw = input.dimensions as string;

    if (!metricName || metricName.trim() === '') {
      return complete(createProgram(), 'error', { message: 'metric_name is required' }) as StorageProgram<Result>;
    }

    let dimensions: Array<{ key: string; value: string }> = [];
    if (dimensionsRaw) {
      try {
        dimensions = JSON.parse(dimensionsRaw);
      } catch {
        return complete(createProgram(), 'error', { message: 'dimensions must be valid JSON' }) as StorageProgram<Result>;
      }
    }

    const metricId = nextMetricId();
    const now = new Date().toISOString();

    const record = {
      metric: metricId,
      spec_ref: metricName,
      run_ref: null,
      metric_name: metricName,
      metric_value: metricValue,
      dimensions,
      recorded_at: now,
    };

    let p = createProgram();
    p = put(p, 'processMetric', metricId, record);
    return complete(p, 'ok', { metric: metricId }) as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>) {
    const metricName = input.metric_name as string;
    const from = input.from as string;
    const to = input.to as string;

    if (!metricName || metricName.trim() === '') {
      return complete(createProgram(), 'error', { message: 'metric_name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'processMetric', {}, 'allMetrics');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allMetrics as Array<Record<string, unknown>>) || [];
      const filtered = all.filter((m) => {
        if ((m.metric_name as string) !== metricName) return false;
        const recordedAt = m.recorded_at as string;
        if (from && recordedAt < from) return false;
        if (to && recordedAt > to) return false;
        return true;
      });
      return filtered;
    }, '_filtered');
    return completeFrom(p, 'ok', (bindings) => {
      const filtered = (bindings._filtered as Array<Record<string, unknown>>) || [];
      return {
        metrics: JSON.stringify(filtered),
        count: filtered.length,
      };
    }) as StorageProgram<Result>;
  },

  aggregate(input: Record<string, unknown>) {
    const metricName = input.metric_name as string;
    const aggregation = input.aggregation as string;
    const from = input.from as string;
    const to = input.to as string;

    if (!metricName || metricName.trim() === '') {
      return complete(createProgram(), 'error', { message: 'metric_name is required' }) as StorageProgram<Result>;
    }
    if (!aggregation || aggregation.trim() === '') {
      return complete(createProgram(), 'error', { message: 'aggregation is required' }) as StorageProgram<Result>;
    }

    const validAggregations = ['avg', 'sum', 'min', 'max', 'p50', 'p95', 'p99'];
    if (!validAggregations.includes(aggregation)) {
      return complete(createProgram(), 'error', {
        message: `aggregation must be one of: ${validAggregations.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'processMetric', {}, 'allMetrics');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allMetrics as Array<Record<string, unknown>>) || [];
      const filtered = all.filter((m) => {
        if ((m.metric_name as string) !== metricName) return false;
        const recordedAt = m.recorded_at as string;
        if (from && recordedAt < from) return false;
        if (to && recordedAt > to) return false;
        return true;
      });
      return filtered;
    }, '_filtered');

    p = mapBindings(p, (bindings) => {
      const filtered = (bindings._filtered as Array<Record<string, unknown>>) || [];
      if (filtered.length === 0) {
        return { value: 0, sample_count: 0 };
      }

      const values = filtered.map((m) => m.metric_value as number).sort((a, b) => a - b);
      const count = values.length;

      let value: number;
      switch (aggregation) {
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = values.reduce((a, b) => a + b, 0) / count;
          break;
        case 'min':
          value = values[0];
          break;
        case 'max':
          value = values[count - 1];
          break;
        case 'p50':
          value = percentile(values, 50);
          break;
        case 'p95':
          value = percentile(values, 95);
          break;
        case 'p99':
          value = percentile(values, 99);
          break;
        default:
          value = 0;
      }

      return { value, sample_count: count };
    }, '_result');

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings._result as { value: number; sample_count: number };
      return { value: result.value, sample_count: result.sample_count };
    }) as StorageProgram<Result>;
  },
};

function percentile(sortedValues: number[], pct: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const idx = (pct / 100) * (sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower];
  const frac = idx - lower;
  return sortedValues[lower] * (1 - frac) + sortedValues[upper] * frac;
}

export const processMetricHandler = autoInterpret(_processMetricHandler);
