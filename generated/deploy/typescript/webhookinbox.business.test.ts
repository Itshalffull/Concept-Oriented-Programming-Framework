import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { webhookInboxHandler } from "./webhookinbox.impl";

describe("WebhookInbox business logic", () => {
  it("register, receive, ack full lifecycle", async () => {
    const storage = createInMemoryStorage();

    const registered = await webhookInboxHandler.register(
      {
        runRef: "run-1",
        stepRef: "step-1",
        eventType: "payment.completed",
        correlationKey: "order-123",
      },
      storage,
    );
    expect(registered.variant).toBe("ok");
    const hook = (registered as any).hook;

    const received = await webhookInboxHandler.receive(
      {
        correlationKey: "order-123",
        eventType: "payment.completed",
        payload: '{"amount":99.99}',
      },
      storage,
    );
    expect(received.variant).toBe("ok");
    expect((received as any).hook).toBe(hook);
    expect((received as any).runRef).toBe("run-1");
    expect((received as any).stepRef).toBe("step-1");
    expect((received as any).payload).toBe('{"amount":99.99}');

    const acked = await webhookInboxHandler.ack({ hook }, storage);
    expect(acked.variant).toBe("ok");
  });

  it("receive with no matching hook returns noMatch", async () => {
    const storage = createInMemoryStorage();

    const result = await webhookInboxHandler.receive(
      {
        correlationKey: "nonexistent-key",
        eventType: "some.event",
        payload: "{}",
      },
      storage,
    );
    expect(result.variant).toBe("noMatch");
  });

  it("receive on expired hook returns noMatch", async () => {
    const storage = createInMemoryStorage();

    const registered = await webhookInboxHandler.register(
      {
        runRef: "run-2",
        stepRef: "step-2",
        eventType: "callback",
        correlationKey: "ref-expire",
      },
      storage,
    );
    const hook = (registered as any).hook;

    // Expire the hook
    await webhookInboxHandler.expire({ hook }, storage);

    // Try to receive - should not match
    const result = await webhookInboxHandler.receive(
      {
        correlationKey: "ref-expire",
        eventType: "callback",
        payload: '{"late":true}',
      },
      storage,
    );
    expect(result.variant).toBe("noMatch");
  });

  it("expire a waiting hook succeeds", async () => {
    const storage = createInMemoryStorage();

    const registered = await webhookInboxHandler.register(
      {
        runRef: "run-3",
        stepRef: "step-3",
        eventType: "timeout",
        correlationKey: "ref-timeout",
      },
      storage,
    );
    const hook = (registered as any).hook;

    const expired = await webhookInboxHandler.expire({ hook }, storage);
    expect(expired.variant).toBe("ok");
    expect((expired as any).runRef).toBe("run-3");
    expect((expired as any).stepRef).toBe("step-3");
  });

  it("ack non-received hook returns notReceived", async () => {
    const storage = createInMemoryStorage();

    const registered = await webhookInboxHandler.register(
      {
        runRef: "run-4",
        stepRef: "step-4",
        eventType: "event",
        correlationKey: "ref-no-receive",
      },
      storage,
    );
    const hook = (registered as any).hook;

    // Hook is still in "waiting" status, not "received"
    const result = await webhookInboxHandler.ack({ hook }, storage);
    expect(result.variant).toBe("notReceived");
  });

  it("multiple hooks with different correlation keys match independently", async () => {
    const storage = createInMemoryStorage();

    await webhookInboxHandler.register(
      {
        runRef: "run-5a",
        stepRef: "step-5a",
        eventType: "payment",
        correlationKey: "order-A",
      },
      storage,
    );
    await webhookInboxHandler.register(
      {
        runRef: "run-5b",
        stepRef: "step-5b",
        eventType: "payment",
        correlationKey: "order-B",
      },
      storage,
    );

    // Receive for order-B
    const received = await webhookInboxHandler.receive(
      {
        correlationKey: "order-B",
        eventType: "payment",
        payload: '{"order":"B"}',
      },
      storage,
    );
    expect(received.variant).toBe("ok");
    expect((received as any).runRef).toBe("run-5b");

    // Order-A should still be receivable
    const receivedA = await webhookInboxHandler.receive(
      {
        correlationKey: "order-A",
        eventType: "payment",
        payload: '{"order":"A"}',
      },
      storage,
    );
    expect(receivedA.variant).toBe("ok");
    expect((receivedA as any).runRef).toBe("run-5a");
  });

  it("receive matches correct hook by correlation_key and event_type combination", async () => {
    const storage = createInMemoryStorage();

    // Same correlation key, different event types
    await webhookInboxHandler.register(
      {
        runRef: "run-6a",
        stepRef: "step-6a",
        eventType: "payment.success",
        correlationKey: "txn-100",
      },
      storage,
    );
    await webhookInboxHandler.register(
      {
        runRef: "run-6b",
        stepRef: "step-6b",
        eventType: "payment.failure",
        correlationKey: "txn-100",
      },
      storage,
    );

    // Receive failure event
    const received = await webhookInboxHandler.receive(
      {
        correlationKey: "txn-100",
        eventType: "payment.failure",
        payload: '{"error":"declined"}',
      },
      storage,
    );
    expect(received.variant).toBe("ok");
    expect((received as any).runRef).toBe("run-6b");
    expect((received as any).stepRef).toBe("step-6b");
  });

  it("ack on nonexistent hook returns notReceived", async () => {
    const storage = createInMemoryStorage();
    const result = await webhookInboxHandler.ack({ hook: "wh-ghost" }, storage);
    expect(result.variant).toBe("notReceived");
  });

  it("expire on nonexistent hook returns notWaiting", async () => {
    const storage = createInMemoryStorage();
    const result = await webhookInboxHandler.expire({ hook: "wh-ghost" }, storage);
    expect(result.variant).toBe("notWaiting");
  });

  it("double receive on same correlation returns noMatch for second", async () => {
    const storage = createInMemoryStorage();

    await webhookInboxHandler.register(
      {
        runRef: "run-7",
        stepRef: "step-7",
        eventType: "webhook",
        correlationKey: "once-only",
      },
      storage,
    );

    const first = await webhookInboxHandler.receive(
      { correlationKey: "once-only", eventType: "webhook", payload: '{"n":1}' },
      storage,
    );
    expect(first.variant).toBe("ok");

    // Second receive for same correlation should not match
    const second = await webhookInboxHandler.receive(
      { correlationKey: "once-only", eventType: "webhook", payload: '{"n":2}' },
      storage,
    );
    expect(second.variant).toBe("noMatch");
  });
});
