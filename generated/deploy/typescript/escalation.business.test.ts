import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { escalationHandler } from "./escalation.impl";

describe("Escalation business logic", () => {
  it("escalate, accept, resolve full lifecycle", async () => {
    const storage = createInMemoryStorage();

    const created = await escalationHandler.escalate(
      {
        source_ref: "task-42",
        run_ref: "run-1",
        trigger_type: "timeout",
        level: 1,
        reason: "SLA breach",
      },
      storage,
    );
    expect(created.variant).toBe("ok");
    const escalation = (created as any).escalation;

    const accepted = await escalationHandler.accept(
      { escalation, acceptor: "manager-1" },
      storage,
    );
    expect(accepted.variant).toBe("ok");

    const resolved = await escalationHandler.resolve(
      { escalation, resolution: "Handled manually" },
      storage,
    );
    expect(resolved.variant).toBe("ok");
    expect((resolved as any).source_ref).toBe("task-42");
    expect((resolved as any).resolution).toBe("Handled manually");
  });

  it("resolve before accept returns not_accepted", async () => {
    const storage = createInMemoryStorage();

    const created = await escalationHandler.escalate(
      {
        source_ref: "task-43",
        run_ref: "run-2",
        trigger_type: "error",
        level: 1,
        reason: "unhandled exception",
      },
      storage,
    );
    const escalation = (created as any).escalation;

    // Try to resolve without accepting first
    const result = await escalationHandler.resolve(
      { escalation, resolution: "won't work" },
      storage,
    );
    expect(result.variant).toBe("not_accepted");
  });

  it("reEscalate increases level", async () => {
    const storage = createInMemoryStorage();

    const created = await escalationHandler.escalate(
      {
        source_ref: "task-44",
        run_ref: "run-3",
        trigger_type: "policy",
        level: 1,
        reason: "needs attention",
      },
      storage,
    );
    const escalation = (created as any).escalation;

    const reescalated = await escalationHandler.reEscalate(
      { escalation, new_level: 2, reason: "still unresolved" },
      storage,
    );
    expect(reescalated.variant).toBe("ok");
  });

  it("accept non-escalated returns not_escalated", async () => {
    const storage = createInMemoryStorage();

    // Try to accept a nonexistent escalation
    const result = await escalationHandler.accept(
      { escalation: "esc-nonexistent", acceptor: "anyone" },
      storage,
    );
    expect(result.variant).toBe("not_escalated");
  });

  it("reEscalate after accept resets to escalated state", async () => {
    const storage = createInMemoryStorage();

    const created = await escalationHandler.escalate(
      {
        source_ref: "task-45",
        run_ref: "run-4",
        trigger_type: "manual",
        level: 1,
        reason: "initial issue",
      },
      storage,
    );
    const escalation = (created as any).escalation;

    // Accept
    await escalationHandler.accept({ escalation, acceptor: "agent-1" }, storage);

    // Re-escalate from accepted state
    const reescalated = await escalationHandler.reEscalate(
      { escalation, new_level: 3, reason: "agent cannot handle" },
      storage,
    );
    expect(reescalated.variant).toBe("ok");

    // Should now be in escalated state again, accept should work
    const accepted = await escalationHandler.accept(
      { escalation, acceptor: "senior-agent" },
      storage,
    );
    expect(accepted.variant).toBe("ok");
  });

  it("different trigger types are stored correctly", async () => {
    const storage = createInMemoryStorage();

    const triggers = ["timeout", "error", "policy", "manual", "threshold"];
    for (const triggerType of triggers) {
      const result = await escalationHandler.escalate(
        {
          source_ref: `task-${triggerType}`,
          run_ref: "run-5",
          trigger_type: triggerType,
          level: 1,
          reason: `triggered by ${triggerType}`,
        },
        storage,
      );
      expect(result.variant).toBe("ok");
    }
  });

  it("multiple escalations for same source are independent", async () => {
    const storage = createInMemoryStorage();

    const e1 = await escalationHandler.escalate(
      {
        source_ref: "shared-source",
        run_ref: "run-6",
        trigger_type: "timeout",
        level: 1,
        reason: "first escalation",
      },
      storage,
    );
    const e2 = await escalationHandler.escalate(
      {
        source_ref: "shared-source",
        run_ref: "run-6",
        trigger_type: "error",
        level: 2,
        reason: "second escalation",
      },
      storage,
    );

    const esc1 = (e1 as any).escalation;
    const esc2 = (e2 as any).escalation;
    expect(esc1).not.toBe(esc2);

    // Accept and resolve first, second should still be escalated
    await escalationHandler.accept({ escalation: esc1, acceptor: "handler-1" }, storage);
    await escalationHandler.resolve({ escalation: esc1, resolution: "fixed" }, storage);

    // Second should still need accepting
    const acceptResult = await escalationHandler.accept(
      { escalation: esc2, acceptor: "handler-2" },
      storage,
    );
    expect(acceptResult.variant).toBe("ok");
  });

  it("accept after resolve returns not_escalated since status is resolved", async () => {
    const storage = createInMemoryStorage();

    const created = await escalationHandler.escalate(
      {
        source_ref: "task-re",
        run_ref: "run-7",
        trigger_type: "manual",
        level: 1,
        reason: "test",
      },
      storage,
    );
    const escalation = (created as any).escalation;

    await escalationHandler.accept({ escalation, acceptor: "agent" }, storage);
    await escalationHandler.resolve({ escalation, resolution: "done" }, storage);

    // Try to accept again - status is "resolved", not "escalated"
    const result = await escalationHandler.accept(
      { escalation, acceptor: "agent-2" },
      storage,
    );
    expect(result.variant).toBe("not_escalated");
  });
});
