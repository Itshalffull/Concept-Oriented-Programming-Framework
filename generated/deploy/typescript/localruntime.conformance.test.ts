// generated: localruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { localruntimeHandler } from "./localruntime.impl";

describe("LocalRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const p = "u-test-invariant-001";
    const pid = "u-test-invariant-002";
    const ep = "u-test-invariant-003";
    const newPid = "u-test-invariant-004";

    // --- AFTER clause ---
    // provision(concept: "User", command: "node server.js", port: 3000) -> ok(process: p, pid: pid, endpoint: ep)
    const step1 = await localruntimeHandler.provision(
      { concept: "User", command: "node server.js", port: 3000 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).process).toBe(p);
    expect((step1 as any).pid).toBe(pid);
    expect((step1 as any).endpoint).toBe(ep);

    // --- THEN clause ---
    // deploy(process: p, command: "node server.js") -> ok(process: p, pid: newPid)
    const step2 = await localruntimeHandler.deploy(
      { process: p, command: "node server.js" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).process).toBe(p);
    expect((step2 as any).pid).toBe(newPid);
  });

});
