// generated: cloudflareruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { cloudflareruntimeHandler } from "./cloudflareruntime.impl";

describe("CloudflareRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const r = "u-test-invariant-001";
    const w = "u-test-invariant-002";
    const sn = "u-test-invariant-003";
    const ep = "u-test-invariant-004";

    // --- AFTER clause ---
    // provision(concept: "User", accountId: "abc123", routes: r) -> ok(worker: w, scriptName: sn, endpoint: ep)
    const step1 = await cloudflareruntimeHandler.provision(
      { concept: "User", accountId: "abc123", routes: r },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).worker).toBe(w);
    expect((step1 as any).scriptName).toBe(sn);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(worker: w, scriptContent: "export default { fetch() {} }") -> ok(worker: w, version: "1")
    const step2 = await cloudflareruntimeHandler.deploy(
      { worker: w, scriptContent: "export default { fetch() {} }" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).worker).toBe(w);
    expect((step2 as any).version).toBe("1");
  });

});
