// generated: eventbus.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { eventbusHandler } from "./eventbus.impl";

describe("EventBus conformance", () => {

  it("invariant 1: after registerEventType, subscribe, dispatch behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let sid = "u-test-invariant-001";
    let e = "u-test-invariant-002";
    let r = "u-test-invariant-003";

    // --- AFTER clause ---
    // registerEventType(name: "user.login", schema: "{}") -> ok()
    const step1 = await eventbusHandler.registerEventType(
      { name: "user.login", schema: "{}" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // subscribe(event: "user.login", handler: "logHandler", priority: 10) -> ok(subscriptionId: sid)
    const step2 = await eventbusHandler.subscribe(
      { event: "user.login", handler: "logHandler", priority: 10 },
      storage,
    );
    expect(step2.variant).toBe("ok");
    sid = (step2 as any).subscriptionId;
    // dispatch(event: e, data: "{\"user\":\"alice\"}") -> ok(results: r)
    const step3 = await eventbusHandler.dispatch(
      { event: e, data: "{\"user\":\"alice\"}" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    r = (step3 as any).results;
  });

});
