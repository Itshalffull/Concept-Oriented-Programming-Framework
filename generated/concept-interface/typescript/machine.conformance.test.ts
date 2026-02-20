// generated: machine.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { machineHandler } from "./machine.impl";

describe("Machine conformance", () => {

  it("invariant 1: after spawn, connect behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const m = "u-test-invariant-001";

    // --- AFTER clause ---
    // spawn(machine: m, component: "dialog", context: "{ \"open\": false }") -> ok(machine: m)
    const step1 = await machineHandler.spawn(
      { machine: m, component: "dialog", context: "{ \"open\": false }" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).machine).toBe(m);

    // --- THEN clause ---
    // connect(machine: m) -> ok(machine: m, props: _)
    const step2 = await machineHandler.connect(
      { machine: m },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).machine).toBe(m);
    expect((step2 as any).props).toBeDefined();
  });

});
