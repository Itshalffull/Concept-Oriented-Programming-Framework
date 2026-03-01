// EvaluationRun Concept Implementation
// Execute quality evaluations against step outputs and track metrics.
// Actual evaluation logic is delegated to evaluator providers.
import type { ConceptStorage } from "@clef/runtime";
import type { EvaluationRunHandler } from "./evaluationrun.handler";

const RELATION = "evaluationrun";

let evalCounter = 0;
function nextEvalId(): string {
  evalCounter += 1;
  return `eval-${Date.now()}-${String(evalCounter).padStart(4, "0")}`;
}

interface MetricEntry {
  name: string;
  value: number;
}

export const evaluationRunHandler: EvaluationRunHandler = {
  async runEval(input, storage) {
    const { stepRef, evaluatorType, input: evalInput, threshold } = input;

    const evalId = nextEvalId();

    await storage.put(RELATION, evalId, {
      eval: evalId,
      stepRef,
      evaluatorType,
      input: evalInput,
      threshold,
      status: "running",
      score: 0,
      metrics: JSON.stringify([]),
      feedback: "",
      evaluatedAt: "",
    });

    return { variant: "ok", eval: evalId, stepRef, evaluatorType };
  },

  async logMetric(input, storage) {
    const { eval: evalId, metricName, metricValue } = input;

    const record = await storage.get(RELATION, evalId);
    if (record) {
      const metrics: MetricEntry[] = JSON.parse(record.metrics as string);
      metrics.push({ name: metricName, value: metricValue });

      await storage.put(RELATION, evalId, {
        ...record,
        metrics: JSON.stringify(metrics),
      });
    }

    return { variant: "ok", eval: evalId };
  },

  async pass(input, storage) {
    const { eval: evalId, score, feedback } = input;

    const record = await storage.get(RELATION, evalId);
    const now = new Date().toISOString();

    if (record) {
      await storage.put(RELATION, evalId, {
        ...record,
        status: "passed",
        score,
        feedback,
        evaluatedAt: now,
      });
    }

    return {
      variant: "ok",
      eval: evalId,
      stepRef: record ? (record.stepRef as string) : "",
    };
  },

  async fail(input, storage) {
    const { eval: evalId, score, feedback } = input;

    const record = await storage.get(RELATION, evalId);
    const now = new Date().toISOString();

    if (record) {
      await storage.put(RELATION, evalId, {
        ...record,
        status: "failed",
        score,
        feedback,
        evaluatedAt: now,
      });
    }

    return {
      variant: "failed",
      eval: evalId,
      stepRef: record ? (record.stepRef as string) : "",
      feedback,
    };
  },

  async getResult(input, storage) {
    const { eval: evalId } = input;

    const record = await storage.get(RELATION, evalId);
    if (!record) {
      return { variant: "notFound", eval: evalId };
    }

    return {
      variant: "ok",
      eval: evalId,
      status: record.status as string,
      score: (record.score as number) || 0,
      feedback: (record.feedback as string) || "",
    };
  },
};
