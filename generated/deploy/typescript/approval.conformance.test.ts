// generated: approval.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { approvalHandler } from "./approval.impl";

const roles = JSON.stringify(["boss", "director"]);

describe("Approval conformance", () => {

  it("invariant: request then approve with one_of policy transitions to approved", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "mgr_approve", policy_kind: "one_of", required_count: 1, roles },
      storage,
    );
    expect(requested.variant).toBe("ok");
    const approval = (requested as any).approval;
    expect((requested as any).step_ref).toBe("mgr_approve");

    const approved = await approvalHandler.approve(
      { approval, actor: "boss", comment: "looks good" },
      storage,
    );
    expect(approved.variant).toBe("ok");
    expect((approved as any).step_ref).toBe("mgr_approve");
  });

  it("all_of policy requires all approvals before resolving", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "review", policy_kind: "all_of", required_count: 2, roles },
      storage,
    );
    const approval = (requested as any).approval;

    const first = await approvalHandler.approve(
      { approval, actor: "boss", comment: "ok" },
      storage,
    );
    expect(first.variant).toBe("pending");
    expect((first as any).decisions_so_far).toBe(1);
    expect((first as any).required).toBe(2);

    const second = await approvalHandler.approve(
      { approval, actor: "director", comment: "approved" },
      storage,
    );
    expect(second.variant).toBe("ok");
  });

  it("n_of_m policy resolves when required count is met", async () => {
    const storage = createInMemoryStorage();
    const threeRoles = JSON.stringify(["a", "b", "c"]);

    const requested = await approvalHandler.request(
      { step_ref: "deploy", policy_kind: "n_of_m", required_count: 2, roles: threeRoles },
      storage,
    );
    const approval = (requested as any).approval;

    await approvalHandler.approve(
      { approval, actor: "a", comment: "yes" },
      storage,
    );

    const second = await approvalHandler.approve(
      { approval, actor: "b", comment: "yes" },
      storage,
    );
    expect(second.variant).toBe("ok");
  });

  it("deny transitions to denied", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "release", policy_kind: "one_of", required_count: 1, roles },
      storage,
    );
    const approval = (requested as any).approval;

    const denied = await approvalHandler.deny(
      { approval, actor: "boss", reason: "not ready" },
      storage,
    );
    expect(denied.variant).toBe("ok");
    expect((denied as any).reason).toBe("not ready");

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("denied");
  });

  it("approve rejects already-resolved approval", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "gate", policy_kind: "one_of", required_count: 1, roles },
      storage,
    );
    const approval = (requested as any).approval;
    await approvalHandler.approve(
      { approval, actor: "boss", comment: "ok" },
      storage,
    );

    const result = await approvalHandler.approve(
      { approval, actor: "director", comment: "also ok" },
      storage,
    );
    expect(result.variant).toBe("already_resolved");
  });

  it("approve rejects unauthorized actor", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "gate", policy_kind: "one_of", required_count: 1, roles },
      storage,
    );
    const approval = (requested as any).approval;

    const result = await approvalHandler.approve(
      { approval, actor: "intern", comment: "i approve" },
      storage,
    );
    expect(result.variant).toBe("not_authorized");
  });

  it("requestChanges transitions to changes_requested", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "review", policy_kind: "one_of", required_count: 1, roles },
      storage,
    );
    const approval = (requested as any).approval;

    const changes = await approvalHandler.requestChanges(
      { approval, actor: "boss", feedback: "needs more detail" },
      storage,
    );
    expect(changes.variant).toBe("ok");
    expect((changes as any).feedback).toBe("needs more detail");

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("changes_requested");
  });

  it("timeout transitions to timed_out", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "gate", policy_kind: "one_of", required_count: 1, roles },
      storage,
    );
    const approval = (requested as any).approval;

    const timedOut = await approvalHandler.timeout({ approval }, storage);
    expect(timedOut.variant).toBe("ok");

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("timed_out");
  });

  it("timeout rejects already-resolved approval", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "gate", policy_kind: "one_of", required_count: 1, roles },
      storage,
    );
    const approval = (requested as any).approval;
    await approvalHandler.deny(
      { approval, actor: "boss", reason: "no" },
      storage,
    );

    const result = await approvalHandler.timeout({ approval }, storage);
    expect(result.variant).toBe("already_resolved");
  });

  it("getStatus returns not_found for nonexistent approval", async () => {
    const storage = createInMemoryStorage();
    const result = await approvalHandler.getStatus({ approval: "nonexistent" }, storage);
    expect(result.variant).toBe("not_found");
  });

  it("getStatus includes all recorded decisions", async () => {
    const storage = createInMemoryStorage();

    const requested = await approvalHandler.request(
      { step_ref: "gate", policy_kind: "all_of", required_count: 2, roles },
      storage,
    );
    const approval = (requested as any).approval;

    await approvalHandler.approve(
      { approval, actor: "boss", comment: "ok" },
      storage,
    );

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("pending");
    const decisions = JSON.parse((status as any).decisions);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].actor).toBe("boss");
    expect(decisions[0].decision).toBe("approve");
  });
});
