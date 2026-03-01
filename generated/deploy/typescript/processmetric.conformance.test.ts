// generated: processmetric.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processMetricHandler } from "./processmetric.impl";

describe("ProcessMetric conformance", () => {

  it("record creates a metric data point, query returns it in time range", async () => {
    const storage = createInMemoryStorage();

    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString();
    const to = new Date(now.getTime() + 60000).toISOString();

    const step1 = await processMetricHandler.record(
      { metricName: "step.duration_ms", metricValue: 250, dimensions: '{"step":"payment","run":"run-1"}' },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).metric).toBeTruthy();

    const step2 = await processMetricHandler.query(
      { metricName: "step.duration_ms", from, to },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).count).toBe(1);
    const metrics = JSON.parse((step2 as any).metrics);
    expect(metrics[0].metricValue).toBe(250);
  });

  it("query returns empty for non-matching time range", async () => {
    const storage = createInMemoryStorage();

    await processMetricHandler.record(
      { metricName: "run.duration_ms", metricValue: 5000, dimensions: '{}' },
      storage,
    );

    // Query a past range that excludes the recorded metric
    const step2 = await processMetricHandler.query(
      { metricName: "run.duration_ms", from: "2020-01-01T00:00:00Z", to: "2020-01-02T00:00:00Z" },
      storage,
    );
    expect((step2 as any).count).toBe(0);
  });

  it("aggregate avg computes average of metric values", async () => {
    const storage = createInMemoryStorage();

    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString();
    const to = new Date(now.getTime() + 60000).toISOString();

    await processMetricHandler.record(
      { metricName: "step.retry_count", metricValue: 1, dimensions: '{}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "step.retry_count", metricValue: 3, dimensions: '{}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "step.retry_count", metricValue: 5, dimensions: '{}' },
      storage,
    );

    const step1 = await processMetricHandler.aggregate(
      { metricName: "step.retry_count", aggregation: "avg", from, to },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).value).toBe(3);
    expect((step1 as any).sampleCount).toBe(3);
  });

  it("aggregate sum computes total", async () => {
    const storage = createInMemoryStorage();

    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString();
    const to = new Date(now.getTime() + 60000).toISOString();

    await processMetricHandler.record(
      { metricName: "step.cost_cents", metricValue: 10, dimensions: '{}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "step.cost_cents", metricValue: 20, dimensions: '{}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "step.cost_cents", metricValue: 30, dimensions: '{}' },
      storage,
    );

    const step1 = await processMetricHandler.aggregate(
      { metricName: "step.cost_cents", aggregation: "sum", from, to },
      storage,
    );
    expect((step1 as any).value).toBe(60);
    expect((step1 as any).sampleCount).toBe(3);
  });

  it("aggregate min and max", async () => {
    const storage = createInMemoryStorage();

    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString();
    const to = new Date(now.getTime() + 60000).toISOString();

    await processMetricHandler.record(
      { metricName: "latency_ms", metricValue: 100, dimensions: '{}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "latency_ms", metricValue: 500, dimensions: '{}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "latency_ms", metricValue: 200, dimensions: '{}' },
      storage,
    );

    const minResult = await processMetricHandler.aggregate(
      { metricName: "latency_ms", aggregation: "min", from, to },
      storage,
    );
    expect((minResult as any).value).toBe(100);

    const maxResult = await processMetricHandler.aggregate(
      { metricName: "latency_ms", aggregation: "max", from, to },
      storage,
    );
    expect((maxResult as any).value).toBe(500);
  });

  it("aggregate percentiles (p50, p95, p99)", async () => {
    const storage = createInMemoryStorage();

    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString();
    const to = new Date(now.getTime() + 60000).toISOString();

    // Record 10 values: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    for (let i = 1; i <= 10; i++) {
      await processMetricHandler.record(
        { metricName: "response_time", metricValue: i * 10, dimensions: '{}' },
        storage,
      );
    }

    const p50 = await processMetricHandler.aggregate(
      { metricName: "response_time", aggregation: "p50", from, to },
      storage,
    );
    expect((p50 as any).sampleCount).toBe(10);
    expect((p50 as any).value).toBe(50);

    const p95 = await processMetricHandler.aggregate(
      { metricName: "response_time", aggregation: "p95", from, to },
      storage,
    );
    expect((p95 as any).value).toBeGreaterThanOrEqual(90);

    const p99 = await processMetricHandler.aggregate(
      { metricName: "response_time", aggregation: "p99", from, to },
      storage,
    );
    expect((p99 as any).value).toBe(100);
  });

  it("aggregate on empty data returns zero", async () => {
    const storage = createInMemoryStorage();

    const step1 = await processMetricHandler.aggregate(
      { metricName: "nonexistent", aggregation: "avg", from: "2020-01-01T00:00:00Z", to: "2030-01-01T00:00:00Z" },
      storage,
    );
    expect((step1 as any).value).toBe(0);
    expect((step1 as any).sampleCount).toBe(0);
  });

});
