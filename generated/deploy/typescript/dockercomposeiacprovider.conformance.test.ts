// generated: dockercomposeiacprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { dockercomposeiacproviderHandler } from "./dockercomposeiacprovider.impl";

describe("DockerComposeIacProvider conformance", () => {

  it("invariant 1: after generate, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const cf = "u-test-invariant-001";
    const f = "u-test-invariant-002";
    const c = "u-test-invariant-003";
    const u = "u-test-invariant-004";

    // --- AFTER clause ---
    // generate(plan: "dp-001") -> ok(composeFile: cf, files: f)
    const step1 = await dockercomposeiacproviderHandler.generate(
      { plan: "dp-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).composeFile).toBe(cf);
    expect((step1 as any).files).toBe(f);

    // --- THEN clause ---
    // apply(composeFile: cf) -> ok(composeFile: cf, created: c, updated: u)
    const step2 = await dockercomposeiacproviderHandler.apply(
      { composeFile: cf },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).composeFile).toBe(cf);
    expect((step2 as any).created).toBe(c);
    expect((step2 as any).updated).toBe(u);
  });

});
