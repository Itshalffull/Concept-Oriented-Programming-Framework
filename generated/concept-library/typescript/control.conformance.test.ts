// generated: control.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { controlHandler } from "./control.impl";

describe("Control conformance", () => {

  it("invariant 1: after create, setValue, getValue behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const k = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(control: k, type: "slider", binding: "volume") -> ok()
    const step1 = await controlHandler.create(
      { control: k, type: "slider", binding: "volume" },
      storage,
    );
    expect(step1.variant).toBe("ok");

    // --- THEN clause ---
    // setValue(control: k, value: "75") -> ok()
    const step2 = await controlHandler.setValue(
      { control: k, value: "75" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    // getValue(control: k) -> ok(value: "75")
    const step3 = await controlHandler.getValue(
      { control: k },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).value).toBe("75");
  });

});
