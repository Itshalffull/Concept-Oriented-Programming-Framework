import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { evaluationRunHandler } from "./evaluationrun.impl";

describe("EvaluationRun business logic", () => {
  it("runEval, logMetric, pass full lifecycle", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-1",
        evaluatorType: "quality",
        input: '{"output":"The answer is 42"}',
        threshold: 0.8,
      },
      storage,
    );
    expect(started.variant).toBe("ok");
    const evalId = (started as any).eval;

    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "accuracy", metricValue: 0.95 },
      storage,
    );
    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "relevance", metricValue: 0.88 },
      storage,
    );

    const passed = await evaluationRunHandler.pass(
      { eval: evalId, score: 0.91, feedback: "High quality output" },
      storage,
    );
    expect(passed.variant).toBe("ok");
    expect((passed as any).stepRef).toBe("step-1");
  });

  it("runEval then fail lifecycle", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-2",
        evaluatorType: "safety",
        input: '{"output":"harmful content"}',
        threshold: 0.9,
      },
      storage,
    );
    const evalId = (started as any).eval;

    const failed = await evaluationRunHandler.fail(
      { eval: evalId, score: 0.2, feedback: "Contains harmful content" },
      storage,
    );
    expect(failed.variant).toBe("failed");
    expect((failed as any).feedback).toBe("Contains harmful content");
    expect((failed as any).stepRef).toBe("step-2");
  });

  it("logMetric records metric on the evaluation", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-3",
        evaluatorType: "relevance",
        input: '{"query":"test"}',
        threshold: 0.7,
      },
      storage,
    );
    const evalId = (started as any).eval;

    const logged = await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "precision", metricValue: 0.85 },
      storage,
    );
    expect(logged.variant).toBe("ok");
  });

  it("pass records score and feedback", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-4",
        evaluatorType: "factuality",
        input: '{"claim":"test"}',
        threshold: 0.5,
      },
      storage,
    );
    const evalId = (started as any).eval;

    await evaluationRunHandler.pass(
      { eval: evalId, score: 0.92, feedback: "Factually accurate" },
      storage,
    );

    const result = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).status).toBe("passed");
    expect((result as any).score).toBe(0.92);
    expect((result as any).feedback).toBe("Factually accurate");
  });

  it("fail records score and feedback", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-5",
        evaluatorType: "coherence",
        input: '{"text":"gibberish"}',
        threshold: 0.7,
      },
      storage,
    );
    const evalId = (started as any).eval;

    await evaluationRunHandler.fail(
      { eval: evalId, score: 0.15, feedback: "Incoherent output" },
      storage,
    );

    const result = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).status).toBe("failed");
    expect((result as any).score).toBe(0.15);
    expect((result as any).feedback).toBe("Incoherent output");
  });

  it("getResult returns accumulated metrics", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-6",
        evaluatorType: "comprehensive",
        input: '{"data":"test"}',
        threshold: 0.6,
      },
      storage,
    );
    const evalId = (started as any).eval;

    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "accuracy", metricValue: 0.9 },
      storage,
    );
    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "completeness", metricValue: 0.8 },
      storage,
    );
    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "latency_ms", metricValue: 150 },
      storage,
    );

    const result = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).status).toBe("running");
  });

  it("multiple metrics per evaluation are tracked", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-7",
        evaluatorType: "multi-metric",
        input: "{}",
        threshold: 0.5,
      },
      storage,
    );
    const evalId = (started as any).eval;

    const metrics = [
      { name: "precision", value: 0.95 },
      { name: "recall", value: 0.87 },
      { name: "f1", value: 0.91 },
      { name: "latency", value: 200 },
      { name: "token_count", value: 500 },
    ];

    for (const m of metrics) {
      const result = await evaluationRunHandler.logMetric(
        { eval: evalId, metricName: m.name, metricValue: m.value },
        storage,
      );
      expect(result.variant).toBe("ok");
    }
  });

  it("getResult on nonexistent evaluation returns notFound", async () => {
    const storage = createInMemoryStorage();

    const result = await evaluationRunHandler.getResult(
      { eval: "eval-nonexistent" },
      storage,
    );
    expect(result.variant).toBe("notFound");
  });

  it("runEval returns evaluatorType and stepRef", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-specific",
        evaluatorType: "custom-eval",
        input: '{"custom":true}',
        threshold: 0.75,
      },
      storage,
    );
    expect(started.variant).toBe("ok");
    expect((started as any).stepRef).toBe("step-specific");
    expect((started as any).evaluatorType).toBe("custom-eval");
  });

  it("getResult before pass/fail shows running status with zero score", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-9",
        evaluatorType: "test",
        input: "{}",
        threshold: 0.5,
      },
      storage,
    );
    const evalId = (started as any).eval;

    const result = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).status).toBe("running");
    expect((result as any).score).toBe(0);
    expect((result as any).feedback).toBe("");
  });

  it("pass then getResult shows final state", async () => {
    const storage = createInMemoryStorage();

    const started = await evaluationRunHandler.runEval(
      {
        stepRef: "step-10",
        evaluatorType: "final",
        input: "{}",
        threshold: 0.5,
      },
      storage,
    );
    const evalId = (started as any).eval;

    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "quality", metricValue: 0.99 },
      storage,
    );
    await evaluationRunHandler.pass(
      { eval: evalId, score: 0.99, feedback: "Excellent" },
      storage,
    );

    const result = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect((result as any).status).toBe("passed");
    expect((result as any).score).toBe(0.99);
    expect((result as any).feedback).toBe("Excellent");
  });
});
