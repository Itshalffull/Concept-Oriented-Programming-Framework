// generated: localruntime.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { localruntimeHandler } from "./localruntime.impl";

describe("LocalRuntime conformance", () => {

  it("invariant 1: after provision, deploy behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let p = "u-test-invariant-001";
    let pid = "u-test-invariant-002";
    let ep = "u-test-invariant-003";
    let newPid = "u-test-invariant-004";

    // --- AFTER clause ---
    // provision(concept: "User", command: "node server.js", port: 3000) -> ok(process: p, pid: pid, endpoint: ep)
    const step1 = await localruntimeHandler.provision(
      { concept: "User", command: "node server.js", port: 3000 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    p = (step1 as any).process;
    pid = (step1 as any).pid;
    ep = (step1 as any).endpoint;

    // --- THEN clause ---
    // deploy(process: p, command: "node server.js") -> ok(process: p, pid: newPid)
    const step2 = await localruntimeHandler.deploy(
      { process: p, command: "node server.js" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    p = (step2 as any).process;
    newPid = (step2 as any).pid;
  });

});
