// generated: cloudflareruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { cloudflareruntimeHandler } from "./cloudflareruntime.impl";

describe("CloudflareRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let r = "u-test-invariant-001";
    let w = "u-test-invariant-002";
    let sn = "u-test-invariant-003";
    let ep = "u-test-invariant-004";

    // --- AFTER clause ---
    // provision(concept: "User", accountId: "abc123", routes: r) -> ok(worker: w, scriptName: sn, endpoint: ep)
    const step1 = await cloudflareruntimeHandler.provision(
      { concept: "User", accountId: "abc123", routes: r },
      storage,
    );
    expect(step1.variant).toBe("ok");
    w = (step1 as any).worker;
    sn = (step1 as any).scriptName;
    ep = (step1 as any).endpoint;

    // --- THEN clause ---
    // deploy(worker: w, scriptContent: "export default { fetch() {} }") -> ok(worker: w, version: "1")
    const step2 = await cloudflareruntimeHandler.deploy(
      { worker: w, scriptContent: "export default { fetch() {} }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    w = (step2 as any).worker;
    expect((step2 as any).version).toBe("1");
  });

});
