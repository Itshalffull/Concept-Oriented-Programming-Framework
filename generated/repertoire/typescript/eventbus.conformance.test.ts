// generated: eventbus.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { eventbusHandler } from "./eventbus.impl";

describe("EventBus conformance", () => {

  it("invariant 1: after registerEventType, subscribe, dispatch behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const sid = "u-test-invariant-001";
    const e = "u-test-invariant-002";
    const r = "u-test-invariant-003";

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
    expect((step2 as any).subscriptionId).toBe(sid);
    // dispatch(event: e, data: "{\"user\":\"alice\"}") -> ok(results: r)
    const step3 = await eventbusHandler.dispatch(
      { event: e, data: "{\"user\":\"alice\"}" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).results).toBe(r);
  });

});
