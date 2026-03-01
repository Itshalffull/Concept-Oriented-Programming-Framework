// ProcessMetric Concept Implementation
// Aggregate and expose process-level performance metrics
// for dashboards, SLA monitoring, and process mining.
import type { ConceptStorage } from "@clef/runtime";
import type { ProcessMetricHandler } from "./processmetric.handler";

const RELATION = "processmetric";
const INDEX_RELATION = "processmetric_index";

let metricCounter = 0;
function nextMetricId(): string {
  metricCounter += 1;
  return `pm-${Date.now()}-${String(metricCounter).padStart(4, "0")}`;
}

export const processMetricHandler: ProcessMetricHandler = {
  async record(input, storage) {
    const { metricName, metricValue, dimensions } = input;

    const metricId = nextMetricId();
    const now = new Date().toISOString();

    await storage.put(RELATION, metricId, {
      metric: metricId,
      metricName,
      metricValue,
      dimensions,
      recordedAt: now,
    });

    // Maintain a per-metricName index for fast query/aggregate
    const index = await storage.get(INDEX_RELATION, metricName);
    const ids: string[] = index ? JSON.parse(index.metricIds as string) : [];
    ids.push(metricId);

    await storage.put(INDEX_RELATION, metricName, {
      metricName,
      metricIds: JSON.stringify(ids),
    });

    return { variant: "ok", metric: metricId };
  },

  async query(input, storage) {
    const { metricName, from, to } = input;

    const fromDate = new Date(from).getTime();
    const toDate = new Date(to).getTime();

    const index = await storage.get(INDEX_RELATION, metricName);
    if (!index) {
      return { variant: "ok", metrics: JSON.stringify([]), count: 0 };
    }

    const ids: string[] = JSON.parse(index.metricIds as string);
    const results: Array<{ metric: string; metricName: string; metricValue: number; dimensions: string; recordedAt: string }> = [];

    for (const id of ids) {
      const record = await storage.get(RELATION, id);
      if (!record) continue;

      const recordedAt = new Date(record.recordedAt as string).getTime();
      if (recordedAt >= fromDate && recordedAt <= toDate) {
        results.push({
          metric: record.metric as string,
          metricName: record.metricName as string,
          metricValue: record.metricValue as number,
          dimensions: record.dimensions as string,
          recordedAt: record.recordedAt as string,
        });
      }
    }

    return {
      variant: "ok",
      metrics: JSON.stringify(results),
      count: results.length,
    };
  },

  async aggregate(input, storage) {
    const { metricName, aggregation, from, to } = input;

    const fromDate = new Date(from).getTime();
    const toDate = new Date(to).getTime();

    const index = await storage.get(INDEX_RELATION, metricName);
    if (!index) {
      return { variant: "ok", value: 0, sampleCount: 0 };
    }

    const ids: string[] = JSON.parse(index.metricIds as string);
    const values: number[] = [];

    for (const id of ids) {
      const record = await storage.get(RELATION, id);
      if (!record) continue;

      const recordedAt = new Date(record.recordedAt as string).getTime();
      if (recordedAt >= fromDate && recordedAt <= toDate) {
        values.push(record.metricValue as number);
      }
    }

    if (values.length === 0) {
      return { variant: "ok", value: 0, sampleCount: 0 };
    }

    let result: number;

    switch (aggregation) {
      case "avg":
        result = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case "sum":
        result = values.reduce((a, b) => a + b, 0);
        break;
      case "min":
        result = Math.min(...values);
        break;
      case "max":
        result = Math.max(...values);
        break;
      case "p50":
      case "p95":
      case "p99": {
        const sorted = [...values].sort((a, b) => a - b);
        const percentile = aggregation === "p50" ? 0.5 : aggregation === "p95" ? 0.95 : 0.99;
        const idx = Math.ceil(sorted.length * percentile) - 1;
        result = sorted[Math.max(0, idx)];
        break;
      }
      default:
        result = values.reduce((a, b) => a + b, 0) / values.length;
    }

    return {
      variant: "ok",
      value: Math.round(result * 1000) / 1000,
      sampleCount: values.length,
    };
  },
};
