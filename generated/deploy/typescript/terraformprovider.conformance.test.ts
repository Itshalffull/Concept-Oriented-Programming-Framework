// generated: terraformprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { terraformproviderHandler } from "./terraformprovider.impl";

describe("TerraformProvider conformance", () => {

  it("invariant 1: after generate, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let w = "u-test-invariant-001";
    let f = "u-test-invariant-002";
    let c = "u-test-invariant-003";
    let u = "u-test-invariant-004";

    // --- AFTER clause ---
    // generate(plan: "dp-001") -> ok(workspace: w, files: f)
    const step1 = await terraformproviderHandler.generate(
      { plan: "dp-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    w = (step1 as any).workspace;
    f = (step1 as any).files;

    // --- THEN clause ---
    // apply(workspace: w) -> ok(workspace: w, created: c, updated: u)
    const step2 = await terraformproviderHandler.apply(
      { workspace: w },
      storage,
    );
    expect(step2.variant).toBe("ok");
    w = (step2 as any).workspace;
    c = (step2 as any).created;
    u = (step2 as any).updated;
  });

});
