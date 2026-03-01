// generated: webhookinbox.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { webhookInboxHandler } from "./webhookinbox.impl";

describe("WebhookInbox conformance", () => {

  it("register then receive matches by correlationKey + eventType", async () => {
    const storage = createInMemoryStorage();

    // Register a webhook listener
    const step1 = await webhookInboxHandler.register(
      { runRef: "run-1", stepRef: "step-1", eventType: "payment.completed", correlationKey: "order-123" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const hook = (step1 as any).hook;
    expect((step1 as any).runRef).toBe("run-1");

    // Receive an inbound event matching the correlation
    const step2 = await webhookInboxHandler.receive(
      { correlationKey: "order-123", eventType: "payment.completed", payload: '{"amount":100}' },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).hook).toBe(hook);
    expect((step2 as any).runRef).toBe("run-1");
    expect((step2 as any).stepRef).toBe("step-1");
    expect((step2 as any).payload).toBe('{"amount":100}');
  });

  it("receive with no matching hook returns noMatch", async () => {
    const storage = createInMemoryStorage();

    const step1 = await webhookInboxHandler.receive(
      { correlationKey: "unknown-key", eventType: "some.event", payload: "{}" },
      storage,
    );
    expect(step1.variant).toBe("noMatch");
    expect((step1 as any).correlationKey).toBe("unknown-key");
  });

  it("expire transitions waiting hook to expired", async () => {
    const storage = createInMemoryStorage();

    const step1 = await webhookInboxHandler.register(
      { runRef: "run-2", stepRef: "step-2", eventType: "approval.timeout", correlationKey: "req-456" },
      storage,
    );
    const hook = (step1 as any).hook;

    const step2 = await webhookInboxHandler.expire(
      { hook },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).runRef).toBe("run-2");

    // After expire, receive should not match
    const step3 = await webhookInboxHandler.receive(
      { correlationKey: "req-456", eventType: "approval.timeout", payload: "{}" },
      storage,
    );
    expect(step3.variant).toBe("noMatch");
  });

  it("ack transitions received hook to acknowledged", async () => {
    const storage = createInMemoryStorage();

    const step1 = await webhookInboxHandler.register(
      { runRef: "run-3", stepRef: "step-3", eventType: "kyc.done", correlationKey: "user-789" },
      storage,
    );
    const hook = (step1 as any).hook;

    await webhookInboxHandler.receive(
      { correlationKey: "user-789", eventType: "kyc.done", payload: '{"status":"ok"}' },
      storage,
    );

    const step3 = await webhookInboxHandler.ack(
      { hook },
      storage,
    );
    expect(step3.variant).toBe("ok");
  });

  it("ack on non-received hook returns notReceived", async () => {
    const storage = createInMemoryStorage();

    const step1 = await webhookInboxHandler.register(
      { runRef: "run-4", stepRef: "step-4", eventType: "event.x", correlationKey: "key-x" },
      storage,
    );
    const hook = (step1 as any).hook;

    // Hook is still waiting, not received
    const step2 = await webhookInboxHandler.ack(
      { hook },
      storage,
    );
    expect(step2.variant).toBe("notReceived");
  });

  it("expire on non-waiting hook returns notWaiting", async () => {
    const storage = createInMemoryStorage();

    const step1 = await webhookInboxHandler.register(
      { runRef: "run-5", stepRef: "step-5", eventType: "event.y", correlationKey: "key-y" },
      storage,
    );
    const hook = (step1 as any).hook;

    // Receive first, then try to expire
    await webhookInboxHandler.receive(
      { correlationKey: "key-y", eventType: "event.y", payload: "{}" },
      storage,
    );

    const step2 = await webhookInboxHandler.expire(
      { hook },
      storage,
    );
    expect(step2.variant).toBe("notWaiting");
  });

});
