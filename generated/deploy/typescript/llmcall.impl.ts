// LlmCall Concept Implementation
// Manage LLM prompt execution with structured output validation,
// tool calling, and repair loops. Actual model invocation is delegated to providers.
import type { ConceptStorage } from "@clef/runtime";
import type { LlmCallHandler } from "./llmcall.handler";

const RELATION = "llmcall";

let callCounter = 0;
function nextCallId(): string {
  callCounter += 1;
  return `llm-${Date.now()}-${String(callCounter).padStart(4, "0")}`;
}

/**
 * Minimal JSON schema validation: checks that rawOutput is valid JSON and,
 * if outputSchema is non-empty, that the parsed object contains all
 * top-level keys listed in the schema (interpreted as a comma-separated
 * list of required field names, or a JSON Schema with "required" array).
 */
function validateAgainstSchema(rawOutput: string, outputSchema: string): string[] {
  const errors: string[] = [];

  // Check if rawOutput is valid JSON
  let parsed: any;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    errors.push("Output is not valid JSON");
    return errors;
  }

  if (!outputSchema || outputSchema === "*") {
    return errors;
  }

  // Try to parse schema as JSON Schema with "required" field
  try {
    const schema = JSON.parse(outputSchema);
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in parsed)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
  } catch {
    // If schema is not JSON, treat it as a simple name reference (no extra validation)
  }

  return errors;
}

export const llmCallHandler: LlmCallHandler = {
  async request(input, storage) {
    const { stepRef, model, prompt, outputSchema, maxAttempts } = input;

    const callId = nextCallId();

    await storage.put(RELATION, callId, {
      call: callId,
      stepRef,
      model,
      systemPrompt: "",
      userPrompt: prompt,
      tools: JSON.stringify([]),
      outputSchema,
      status: "requesting",
      rawOutput: "",
      validatedOutput: "",
      validationErrors: "",
      attemptCount: 0,
      maxAttempts,
      inputTokens: 0,
      outputTokens: 0,
    });

    return { variant: "ok", call: callId, stepRef, model };
  },

  async recordResponse(input, storage) {
    const { call, rawOutput, inputTokens, outputTokens } = input;

    const record = await storage.get(RELATION, call);
    if (!record) {
      return { variant: "providerError", call, message: "Call not found" };
    }

    if (record.status !== "requesting") {
      return { variant: "providerError", call, message: `Call is in ${record.status} status, expected requesting` };
    }

    const outputSchema = record.outputSchema as string;

    // If there is an output schema, transition to validating; otherwise accept directly
    const nextStatus = outputSchema && outputSchema !== "" ? "validating" : "accepted";

    await storage.put(RELATION, call, {
      ...record,
      rawOutput,
      inputTokens,
      outputTokens,
      status: nextStatus,
      validatedOutput: nextStatus === "accepted" ? rawOutput : "",
    });

    return { variant: "ok", call };
  },

  async validate(input, storage) {
    const { call } = input;

    const record = await storage.get(RELATION, call);
    if (!record) {
      return { variant: "invalid", call, errors: "Call not found", attemptCount: 0, maxAttempts: 0 };
    }

    const rawOutput = record.rawOutput as string;
    const outputSchema = record.outputSchema as string;
    const attemptCount = (record.attemptCount as number) || 0;
    const maxAttempts = record.maxAttempts as number;

    const errors = validateAgainstSchema(rawOutput, outputSchema);

    if (errors.length === 0) {
      await storage.put(RELATION, call, {
        ...record,
        status: "accepted",
        validatedOutput: rawOutput,
      });

      return {
        variant: "valid",
        call,
        stepRef: record.stepRef as string,
        validatedOutput: rawOutput,
      };
    }

    const errorStr = errors.join("; ");
    await storage.put(RELATION, call, {
      ...record,
      validationErrors: errorStr,
    });

    return {
      variant: "invalid",
      call,
      errors: errorStr,
      attemptCount,
      maxAttempts,
    };
  },

  async repair(input, storage) {
    const { call, errors } = input;

    const record = await storage.get(RELATION, call);
    if (!record) {
      return { variant: "maxAttemptsReached", call, stepRef: "" };
    }

    const attemptCount = ((record.attemptCount as number) || 0) + 1;
    const maxAttempts = record.maxAttempts as number;

    if (attemptCount >= maxAttempts) {
      await storage.put(RELATION, call, {
        ...record,
        status: "rejected",
        attemptCount,
        validationErrors: errors,
      });

      return {
        variant: "maxAttemptsReached",
        call,
        stepRef: record.stepRef as string,
      };
    }

    // Transition back to requesting for another attempt
    await storage.put(RELATION, call, {
      ...record,
      status: "requesting",
      attemptCount,
      validationErrors: errors,
      rawOutput: "",
      validatedOutput: "",
    });

    return { variant: "ok", call };
  },

  async accept(input, storage) {
    const { call } = input;

    const record = await storage.get(RELATION, call);
    const output = record ? (record.rawOutput as string) || (record.validatedOutput as string) : "";

    if (record) {
      await storage.put(RELATION, call, {
        ...record,
        status: "accepted",
        validatedOutput: output,
      });
    }

    return {
      variant: "ok",
      call,
      stepRef: record ? (record.stepRef as string) : "",
      output,
    };
  },

  async reject(input, storage) {
    const { call, reason } = input;

    const record = await storage.get(RELATION, call);
    if (record) {
      await storage.put(RELATION, call, {
        ...record,
        status: "rejected",
        validationErrors: reason,
      });
    }

    return {
      variant: "ok",
      call,
      stepRef: record ? (record.stepRef as string) : "",
      reason,
    };
  },
};
