// WebhookInbox Concept Implementation
// Receive and correlate inbound events from external systems to waiting
// process instances using correlation keys.
import type { ConceptStorage } from "@clef/runtime";
import type { WebhookInboxHandler } from "./webhookinbox.handler";

const RELATION = "webhookinbox";
const CORRELATION_RELATION = "webhookinbox_correlation";

let hookCounter = 0;
function nextHookId(): string {
  hookCounter += 1;
  return `wh-${Date.now()}-${String(hookCounter).padStart(4, "0")}`;
}

export const webhookInboxHandler: WebhookInboxHandler = {
  async register(input, storage) {
    const { runRef, stepRef, eventType, correlationKey } = input;

    const hookId = nextHookId();
    const now = new Date().toISOString();

    await storage.put(RELATION, hookId, {
      hook: hookId,
      runRef,
      stepRef,
      eventType,
      correlationKey,
      status: "waiting",
      payload: "",
      registeredAt: now,
      receivedAt: "",
    });

    // Store correlation index for fast lookup by key+eventType
    const correlationId = `${correlationKey}::${eventType}`;
    await storage.put(CORRELATION_RELATION, correlationId, {
      correlationId,
      hook: hookId,
      correlationKey,
      eventType,
    });

    return { variant: "ok", hook: hookId, runRef };
  },

  async receive(input, storage) {
    const { correlationKey, eventType, payload } = input;

    // Look up waiting hook by correlation key + event type
    const correlationId = `${correlationKey}::${eventType}`;
    const correlationRecord = await storage.get(CORRELATION_RELATION, correlationId);
    if (!correlationRecord) {
      return { variant: "noMatch", correlationKey };
    }

    const hookId = correlationRecord.hook as string;
    const record = await storage.get(RELATION, hookId);
    if (!record || record.status !== "waiting") {
      return { variant: "noMatch", correlationKey };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, hookId, {
      ...record,
      status: "received",
      payload,
      receivedAt: now,
    });

    // Remove correlation index so the same key+type cannot match again
    await storage.del(CORRELATION_RELATION, correlationId);

    return {
      variant: "ok",
      hook: hookId,
      runRef: record.runRef as string,
      stepRef: record.stepRef as string,
      payload,
    };
  },

  async expire(input, storage) {
    const { hook } = input;

    const record = await storage.get(RELATION, hook);
    if (!record) {
      return { variant: "notWaiting", hook };
    }

    if (record.status !== "waiting") {
      return { variant: "notWaiting", hook };
    }

    await storage.put(RELATION, hook, {
      ...record,
      status: "expired",
    });

    // Remove correlation index
    const correlationId = `${record.correlationKey}::${record.eventType}`;
    await storage.del(CORRELATION_RELATION, correlationId);

    return {
      variant: "ok",
      hook,
      runRef: record.runRef as string,
      stepRef: record.stepRef as string,
    };
  },

  async ack(input, storage) {
    const { hook } = input;

    const record = await storage.get(RELATION, hook);
    if (!record) {
      return { variant: "notReceived", hook };
    }

    if (record.status !== "received") {
      return { variant: "notReceived", hook };
    }

    await storage.put(RELATION, hook, {
      ...record,
      status: "acknowledged",
    });

    return { variant: "ok", hook };
  },
};
