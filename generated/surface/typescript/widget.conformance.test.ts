// generated: widget.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { widgetHandler } from "./widget.impl";

describe("Widget conformance", () => {

  it("invariant 1: after register, get behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const p = "u-test-invariant-001";

    // --- AFTER clause ---
    // register(component: p, name: "button", machineSpec: "{ \"initial\": \"idle\" }", anatomy: "{ \"parts\": [\"root\"] }", a11ySpec: "{ \"role\": \"button\" }") -> ok(component: p)
    const step1 = await widgetHandler.register(
      { component: p, name: "button", machineSpec: "{ \"initial\": \"idle\" }", anatomy: "{ \"parts\": [\"root\"] }", a11ySpec: "{ \"role\": \"button\" }" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).component).toBe(p);

    // --- THEN clause ---
    // get(component: p) -> ok(component: p, machineSpec: "{ \"initial\": \"idle\" }", anatomy: "{ \"parts\": [\"root\"] }", a11ySpec: "{ \"role\": \"button\" }")
    const step2 = await widgetHandler.get(
      { component: p },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).component).toBe(p);
    expect((step2 as any).machineSpec).toBe("{ \"initial\": \"idle\" }");
    expect((step2 as any).anatomy).toBe("{ \"parts\": [\"root\"] }");
    expect((step2 as any).a11ySpec).toBe("{ \"role\": \"button\" }");
  });

});
