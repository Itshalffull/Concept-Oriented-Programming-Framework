// ConnectorCall Concept Implementation
// Track outbound calls to external systems with idempotency keys and status lifecycle.
import type { ConceptStorage } from "@clef/runtime";
import type { ConnectorCallHandler } from "./connectorcall.handler";

const RELATION = "connectorcall";
const IDEMPOTENCY_RELATION = "connectorcall_idempotency";

let callCounter = 0;
function nextCallId(): string {
  callCounter += 1;
  return `cc-${Date.now()}-${String(callCounter).padStart(4, "0")}`;
}

export const connectorCallHandler: ConnectorCallHandler = {
  async invoke(input, storage) {
    const { stepRef, connectorType, operation, input: callInput, idempotencyKey } = input;

    // Check idempotency: if a call with this key already exists, return duplicate
    const existing = await storage.find(IDEMPOTENCY_RELATION, { idempotencyKey });
    if (existing.length > 0) {
      return { variant: "duplicate", idempotencyKey };
    }

    const callId = nextCallId();
    const now = new Date().toISOString();

    await storage.put(RELATION, callId, {
      call: callId,
      stepRef,
      connectorType,
      operation,
      input: callInput,
      output: "",
      status: "invoking",
      idempotencyKey,
      error: "",
      invokedAt: now,
      completedAt: "",
    });

    // Store idempotency index
    await storage.put(IDEMPOTENCY_RELATION, idempotencyKey, {
      idempotencyKey,
      call: callId,
    });

    return { variant: "ok", call: callId, stepRef };
  },

  async markSuccess(input, storage) {
    const { call, output } = input;

    const record = await storage.get(RELATION, call);
    if (!record) {
      return { variant: "notInvoking", call };
    }

    if (record.status !== "invoking") {
      return { variant: "notInvoking", call };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, call, {
      ...record,
      status: "succeeded",
      output,
      completedAt: now,
    });

    return {
      variant: "ok",
      call,
      stepRef: record.stepRef as string,
      output,
    };
  },

  async markFailure(input, storage) {
    const { call, error } = input;

    const record = await storage.get(RELATION, call);
    if (!record) {
      return { variant: "notInvoking", call };
    }

    if (record.status !== "invoking") {
      return { variant: "notInvoking", call };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, call, {
      ...record,
      status: "failed",
      error,
      completedAt: now,
    });

    return {
      variant: "error",
      call,
      stepRef: record.stepRef as string,
      message: error,
    };
  },

  async getResult(input, storage) {
    const { call } = input;

    const record = await storage.get(RELATION, call);
    if (!record) {
      return { variant: "notFound", call };
    }

    return {
      variant: "ok",
      call,
      status: record.status as string,
      output: (record.output as string) || "",
    };
  },
};
