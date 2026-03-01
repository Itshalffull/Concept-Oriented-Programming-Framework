import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processMetricHandler } from "./processmetric.impl";

describe("ProcessMetric business logic", () => {
  it("record then query returns recorded metrics within time range", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();

    await processMetricHandler.record(
      { metricName: "duration_ms", metricValue: 1500, dimensions: '{"step":"validate"}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "duration_ms", metricValue: 2300, dimensions: '{"step":"approve"}' },
      storage,
    );

    const after = new Date(Date.now() + 1000).toISOString();

    const result = await processMetricHandler.query(
      { metricName: "duration_ms", from: before, to: after },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).count).toBe(2);

    const metrics = JSON.parse((result as any).metrics);
    expect(metrics.length).toBe(2);
    expect(metrics[0].metricValue).toBe(1500);
    expect(metrics[1].metricValue).toBe(2300);
  });

  it("query with time range filtering excludes out-of-range records", async () => {
    const storage = createInMemoryStorage();

    await processMetricHandler.record(
      { metricName: "errors", metricValue: 1, dimensions: "{}" },
      storage,
    );

    // Query with a time range in the distant past
    const result = await processMetricHandler.query(
      {
        metricName: "errors",
        from: "2020-01-01T00:00:00.000Z",
        to: "2020-12-31T23:59:59.999Z",
      },
      storage,
    );
    expect((result as any).count).toBe(0);
  });

  it("aggregate avg computes average correctly", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();
    await processMetricHandler.record(
      { metricName: "latency", metricValue: 100, dimensions: "{}" },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "latency", metricValue: 200, dimensions: "{}" },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "latency", metricValue: 300, dimensions: "{}" },
      storage,
    );
    const after = new Date(Date.now() + 1000).toISOString();

    const result = await processMetricHandler.aggregate(
      { metricName: "latency", aggregation: "avg", from: before, to: after },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).value).toBe(200);
    expect((result as any).sampleCount).toBe(3);
  });

  it("aggregate sum computes total correctly", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();
    await processMetricHandler.record(
      { metricName: "token_count", metricValue: 150, dimensions: "{}" },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "token_count", metricValue: 250, dimensions: "{}" },
      storage,
    );
    const after = new Date(Date.now() + 1000).toISOString();

    const result = await processMetricHandler.aggregate(
      { metricName: "token_count", aggregation: "sum", from: before, to: after },
      storage,
    );
    expect((result as any).value).toBe(400);
    expect((result as any).sampleCount).toBe(2);
  });

  it("aggregate min and max return correct extremes", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();
    const values = [42, 7, 99, 13, 55];
    for (const v of values) {
      await processMetricHandler.record(
        { metricName: "score", metricValue: v, dimensions: "{}" },
        storage,
      );
    }
    const after = new Date(Date.now() + 1000).toISOString();

    const minResult = await processMetricHandler.aggregate(
      { metricName: "score", aggregation: "min", from: before, to: after },
      storage,
    );
    expect((minResult as any).value).toBe(7);

    const maxResult = await processMetricHandler.aggregate(
      { metricName: "score", aggregation: "max", from: before, to: after },
      storage,
    );
    expect((maxResult as any).value).toBe(99);
  });

  it("aggregate over empty data returns zero value and zero samples", async () => {
    const storage = createInMemoryStorage();

    const result = await processMetricHandler.aggregate(
      {
        metricName: "nonexistent",
        aggregation: "avg",
        from: "2020-01-01T00:00:00.000Z",
        to: "2030-01-01T00:00:00.000Z",
      },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).value).toBe(0);
    expect((result as any).sampleCount).toBe(0);
  });

  it("multiple metrics with same name but different dimensions", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();

    await processMetricHandler.record(
      { metricName: "throughput", metricValue: 100, dimensions: '{"region":"us-east"}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "throughput", metricValue: 200, dimensions: '{"region":"eu-west"}' },
      storage,
    );
    await processMetricHandler.record(
      { metricName: "throughput", metricValue: 150, dimensions: '{"region":"ap-south"}' },
      storage,
    );

    const after = new Date(Date.now() + 1000).toISOString();

    const result = await processMetricHandler.query(
      { metricName: "throughput", from: before, to: after },
      storage,
    );
    expect((result as any).count).toBe(3);

    const metrics = JSON.parse((result as any).metrics);
    const regions = metrics.map((m: any) => JSON.parse(m.dimensions).region);
    expect(regions.sort()).toEqual(["ap-south", "eu-west", "us-east"]);
  });

  it("query for nonexistent metric name returns empty results", async () => {
    const storage = createInMemoryStorage();

    const result = await processMetricHandler.query(
      {
        metricName: "does_not_exist",
        from: "2020-01-01T00:00:00.000Z",
        to: "2030-01-01T00:00:00.000Z",
      },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).count).toBe(0);
    const metrics = JSON.parse((result as any).metrics);
    expect(metrics).toEqual([]);
  });

  it("record with various dimension combinations", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();

    // No dimensions
    await processMetricHandler.record(
      { metricName: "count", metricValue: 1, dimensions: "{}" },
      storage,
    );

    // Single dimension
    await processMetricHandler.record(
      { metricName: "count", metricValue: 2, dimensions: '{"env":"prod"}' },
      storage,
    );

    // Multiple dimensions
    await processMetricHandler.record(
      {
        metricName: "count",
        metricValue: 3,
        dimensions: '{"env":"staging","region":"us","team":"platform"}',
      },
      storage,
    );

    const after = new Date(Date.now() + 1000).toISOString();

    const result = await processMetricHandler.query(
      { metricName: "count", from: before, to: after },
      storage,
    );
    expect((result as any).count).toBe(3);

    const agg = await processMetricHandler.aggregate(
      { metricName: "count", aggregation: "sum", from: before, to: after },
      storage,
    );
    expect((agg as any).value).toBe(6);
  });

  it("aggregate count returns sample count", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();
    for (let i = 0; i < 7; i++) {
      await processMetricHandler.record(
        { metricName: "events", metricValue: i * 10, dimensions: "{}" },
        storage,
      );
    }
    const after = new Date(Date.now() + 1000).toISOString();

    // Using any aggregation, sampleCount should reflect total records
    const result = await processMetricHandler.aggregate(
      { metricName: "events", aggregation: "avg", from: before, to: after },
      storage,
    );
    expect((result as any).sampleCount).toBe(7);
  });

  it("record returns unique metric IDs", async () => {
    const storage = createInMemoryStorage();

    const r1 = await processMetricHandler.record(
      { metricName: "test", metricValue: 1, dimensions: "{}" },
      storage,
    );
    const r2 = await processMetricHandler.record(
      { metricName: "test", metricValue: 2, dimensions: "{}" },
      storage,
    );

    expect((r1 as any).metric).not.toBe((r2 as any).metric);
  });
});
