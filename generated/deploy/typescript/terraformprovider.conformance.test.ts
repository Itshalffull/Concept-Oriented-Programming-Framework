// generated: terraformprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { terraformproviderHandler } from "./terraformprovider.impl";

describe("TerraformProvider conformance", () => {

  it("invariant 1: after generate, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const w = "u-test-invariant-001";
    const f = "u-test-invariant-002";
    const c = "u-test-invariant-003";
    const u = "u-test-invariant-004";

    // --- AFTER clause ---
    // generate(plan: "dp-001") -> ok(workspace: w, files: f)
    const step1 = await terraformproviderHandler.generate(
      { plan: "dp-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).workspace).toBe(w);
    expect((step1 as any).files).toBe(f);

    // --- THEN clause ---
    // apply(workspace: w) -> ok(workspace: w, created: c, updated: u)
    const step2 = await terraformproviderHandler.apply(
      { workspace: w },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).workspace).toBe(w);
    expect((step2 as any).created).toBe(c);
    expect((step2 as any).updated).toBe(u);
  });

});
