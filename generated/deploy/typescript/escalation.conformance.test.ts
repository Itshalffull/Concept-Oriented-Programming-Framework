// generated: escalation.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { escalationHandler } from "./escalation.impl";

describe("Escalation conformance", () => {

  it("full lifecycle: escalate, accept, resolve", async () => {
    const storage = createInMemoryStorage();

    const escalated = await escalationHandler.escalate(
      { source_ref: "step-001", run_ref: "r1", trigger_type: "timeout", reason: "SLA breach", level: 1 },
      storage,
    );
    expect(escalated.variant).toBe("ok");
    const escalation = (escalated as any).escalation;
    expect((escalated as any).source_ref).toBe("step-001");

    const accepted = await escalationHandler.accept(
      { escalation, acceptor: "manager" },
      storage,
    );
    expect(accepted.variant).toBe("ok");

    const resolved = await escalationHandler.resolve(
      { escalation, resolution: "Reassigned and completed" },
      storage,
    );
    expect(resolved.variant).toBe("ok");
    expect((resolved as any).source_ref).toBe("step-001");
    expect((resolved as any).resolution).toBe("Reassigned and completed");
  });

  it("accept rejects non-escalated status", async () => {
    const storage = createInMemoryStorage();

    const escalated = await escalationHandler.escalate(
      { source_ref: "step-001", run_ref: "r1", trigger_type: "manual", reason: "help needed", level: 1 },
      storage,
    );
    const escalation = (escalated as any).escalation;
    await escalationHandler.accept({ escalation, acceptor: "mgr" }, storage);

    // Try to accept again when status is "accepted"
    const result = await escalationHandler.accept(
      { escalation, acceptor: "other" },
      storage,
    );
    expect(result.variant).toBe("not_escalated");
  });

  it("resolve rejects non-accepted escalation", async () => {
    const storage = createInMemoryStorage();

    const escalated = await escalationHandler.escalate(
      { source_ref: "step-001", run_ref: "r1", trigger_type: "condition", reason: "threshold exceeded", level: 2 },
      storage,
    );
    const escalation = (escalated as any).escalation;

    // Try to resolve without accepting first
    const result = await escalationHandler.resolve(
      { escalation, resolution: "fixed" },
      storage,
    );
    expect(result.variant).toBe("not_accepted");
  });

  it("reEscalate raises the escalation level", async () => {
    const storage = createInMemoryStorage();

    const escalated = await escalationHandler.escalate(
      { source_ref: "step-001", run_ref: "r1", trigger_type: "retry_exhausted", reason: "retries failed", level: 1 },
      storage,
    );
    const escalation = (escalated as any).escalation;
    await escalationHandler.accept({ escalation, acceptor: "mgr" }, storage);

    const reEscalated = await escalationHandler.reEscalate(
      { escalation, new_level: 3, reason: "needs VP attention" },
      storage,
    );
    expect(reEscalated.variant).toBe("ok");

    // After re-escalation, should be back in escalated status and can be accepted again
    const accepted = await escalationHandler.accept(
      { escalation, acceptor: "vp" },
      storage,
    );
    expect(accepted.variant).toBe("ok");
  });

  it("reEscalate resets acceptor so it must be accepted again", async () => {
    const storage = createInMemoryStorage();

    const escalated = await escalationHandler.escalate(
      { source_ref: "wi-001", run_ref: "r1", trigger_type: "manual", reason: "stuck", level: 1 },
      storage,
    );
    const escalation = (escalated as any).escalation;
    await escalationHandler.accept({ escalation, acceptor: "mgr" }, storage);

    await escalationHandler.reEscalate(
      { escalation, new_level: 2, reason: "still stuck" },
      storage,
    );

    // Cannot resolve directly after re-escalation (must accept first)
    const result = await escalationHandler.resolve(
      { escalation, resolution: "attempted fix" },
      storage,
    );
    expect(result.variant).toBe("not_accepted");
  });

  it("multiple escalation trigger types are supported", async () => {
    const storage = createInMemoryStorage();

    const triggers = ["timeout", "condition", "manual", "retry_exhausted"];
    for (const trigger of triggers) {
      const result = await escalationHandler.escalate(
        { source_ref: `src-${trigger}`, run_ref: "r1", trigger_type: trigger, reason: `triggered by ${trigger}`, level: 1 },
        storage,
      );
      expect(result.variant).toBe("ok");
    }
  });

  it("resolve after accept returns source_ref and resolution", async () => {
    const storage = createInMemoryStorage();

    const escalated = await escalationHandler.escalate(
      { source_ref: "approval-timeout", run_ref: "r2", trigger_type: "timeout", reason: "approval expired", level: 2 },
      storage,
    );
    const escalation = (escalated as any).escalation;
    await escalationHandler.accept({ escalation, acceptor: "director" }, storage);

    const resolved = await escalationHandler.resolve(
      { escalation, resolution: "Auto-approved by director override" },
      storage,
    );
    expect(resolved.variant).toBe("ok");
    expect((resolved as any).source_ref).toBe("approval-timeout");
    expect((resolved as any).resolution).toBe("Auto-approved by director override");
  });
});
