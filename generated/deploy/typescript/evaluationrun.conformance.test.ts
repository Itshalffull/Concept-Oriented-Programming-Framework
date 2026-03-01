// generated: evaluationrun.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { evaluationRunHandler } from "./evaluationrun.impl";

describe("EvaluationRun conformance", () => {

  it("runEval, logMetric, pass flow", async () => {
    const storage = createInMemoryStorage();

    // Start evaluation
    const step1 = await evaluationRunHandler.runEval(
      { stepRef: "step-draft", evaluatorType: "schema", input: '{"subject":"Hello","body":"World"}', threshold: 0.8 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const evalId = (step1 as any).eval;
    expect((step1 as any).stepRef).toBe("step-draft");
    expect((step1 as any).evaluatorType).toBe("schema");

    // Log a metric
    const step2 = await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "schema_match", metricValue: 1.0 },
      storage,
    );
    expect(step2.variant).toBe("ok");

    // Pass the evaluation
    const step3 = await evaluationRunHandler.pass(
      { eval: evalId, score: 0.95, feedback: "All fields present and valid" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).stepRef).toBe("step-draft");

    // Verify via getResult
    const step4 = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect(step4.variant).toBe("ok");
    expect((step4 as any).status).toBe("passed");
    expect((step4 as any).score).toBe(0.95);
    expect((step4 as any).feedback).toBe("All fields present and valid");
  });

  it("runEval then fail flow", async () => {
    const storage = createInMemoryStorage();

    const step1 = await evaluationRunHandler.runEval(
      { stepRef: "step-review", evaluatorType: "rubric", input: '{"text":"poor quality"}', threshold: 0.7 },
      storage,
    );
    const evalId = (step1 as any).eval;

    const step2 = await evaluationRunHandler.fail(
      { eval: evalId, score: 0.3, feedback: "Output does not meet quality rubric" },
      storage,
    );
    expect(step2.variant).toBe("failed");
    expect((step2 as any).feedback).toBe("Output does not meet quality rubric");
    expect((step2 as any).stepRef).toBe("step-review");

    // getResult confirms failed
    const step3 = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect((step3 as any).status).toBe("failed");
    expect((step3 as any).score).toBe(0.3);
  });

  it("getResult on nonexistent eval returns notFound", async () => {
    const storage = createInMemoryStorage();

    const step1 = await evaluationRunHandler.getResult(
      { eval: "eval-nonexistent" },
      storage,
    );
    expect(step1.variant).toBe("notFound");
  });

  it("logMetric accumulates multiple metrics", async () => {
    const storage = createInMemoryStorage();

    const step1 = await evaluationRunHandler.runEval(
      { stepRef: "step-m", evaluatorType: "llm_judge", input: '{"text":"test"}', threshold: 0.5 },
      storage,
    );
    const evalId = (step1 as any).eval;

    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "relevance", metricValue: 0.8 },
      storage,
    );
    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "coherence", metricValue: 0.9 },
      storage,
    );
    await evaluationRunHandler.logMetric(
      { eval: evalId, metricName: "fluency", metricValue: 0.85 },
      storage,
    );

    // Pass with aggregate score
    await evaluationRunHandler.pass(
      { eval: evalId, score: 0.85, feedback: "Good overall quality" },
      storage,
    );

    const step2 = await evaluationRunHandler.getResult(
      { eval: evalId },
      storage,
    );
    expect((step2 as any).status).toBe("passed");
    expect((step2 as any).score).toBe(0.85);
  });

});
