// generated: dockercomposeiacprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { dockercomposeiacproviderHandler } from "./dockercomposeiacprovider.impl";

describe("DockerComposeIacProvider conformance", () => {

  it("invariant 1: after generate, apply behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let cf = "u-test-invariant-001";
    let f = "u-test-invariant-002";
    let c = "u-test-invariant-003";
    let u = "u-test-invariant-004";

    // --- AFTER clause ---
    // generate(plan: "dp-001") -> ok(composeFile: cf, files: f)
    const step1 = await dockercomposeiacproviderHandler.generate(
      { plan: "dp-001" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    cf = (step1 as any).composeFile;
    f = (step1 as any).files;

    // --- THEN clause ---
    // apply(composeFile: cf) -> ok(composeFile: cf, created: c, updated: u)
    const step2 = await dockercomposeiacproviderHandler.apply(
      { composeFile: cf },
      storage,
    );
    expect(step2.variant).toBe("ok");
    cf = (step2 as any).composeFile;
    c = (step2 as any).created;
    u = (step2 as any).updated;
  });

});
