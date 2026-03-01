import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { approvalHandler } from "./approval.impl";

describe("Approval business logic", () => {
  it("one_of policy resolves with single approval", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-1",
        policy_kind: "one_of",
        required_count: 1,
        roles: JSON.stringify(["manager", "director"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    const result = await approvalHandler.approve(
      { approval, actor: "manager", comment: "looks good" },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).step_ref).toBe("step-1");

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("approved");
  });

  it("all_of with only partial approvals stays pending", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-2",
        policy_kind: "all_of",
        required_count: 3,
        roles: JSON.stringify(["alice", "bob", "charlie"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    // First approval - not enough
    const r1 = await approvalHandler.approve(
      { approval, actor: "alice", comment: "ok" },
      storage,
    );
    expect(r1.variant).toBe("pending");
    expect((r1 as any).decisions_so_far).toBe(1);
    expect((r1 as any).required).toBe(3);

    // Second approval - still not enough
    const r2 = await approvalHandler.approve(
      { approval, actor: "bob", comment: "ok" },
      storage,
    );
    expect(r2.variant).toBe("pending");
    expect((r2 as any).decisions_so_far).toBe(2);

    // Third approval - threshold met
    const r3 = await approvalHandler.approve(
      { approval, actor: "charlie", comment: "ok" },
      storage,
    );
    expect(r3.variant).toBe("ok");
  });

  it("n_of_m with exact threshold resolves", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-3",
        policy_kind: "n_of_m",
        required_count: 2,
        roles: JSON.stringify(["a", "b", "c", "d"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    await approvalHandler.approve({ approval, actor: "a", comment: "yes" }, storage);
    const r2 = await approvalHandler.approve(
      { approval, actor: "b", comment: "yes" },
      storage,
    );
    expect(r2.variant).toBe("ok");
  });

  it("deny after partial approvals resolves to denied", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-4",
        policy_kind: "all_of",
        required_count: 3,
        roles: JSON.stringify(["alice", "bob", "charlie"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    // One approve
    await approvalHandler.approve({ approval, actor: "alice", comment: "fine" }, storage);

    // Then deny
    const denied = await approvalHandler.deny(
      { approval, actor: "bob", reason: "not ready" },
      storage,
    );
    expect(denied.variant).toBe("ok");

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("denied");
  });

  it("requestChanges resolves to changes_requested status", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-5",
        policy_kind: "one_of",
        required_count: 1,
        roles: JSON.stringify(["reviewer"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    const result = await approvalHandler.requestChanges(
      { approval, actor: "reviewer", feedback: "fix the formatting" },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).feedback).toBe("fix the formatting");

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("changes_requested");
  });

  it("timeout while pending transitions to timed_out", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-6",
        policy_kind: "one_of",
        required_count: 1,
        roles: JSON.stringify([]),
      },
      storage,
    );
    const approval = (req as any).approval;

    const result = await approvalHandler.timeout({ approval }, storage);
    expect(result.variant).toBe("ok");

    const status = await approvalHandler.getStatus({ approval }, storage);
    expect((status as any).status).toBe("timed_out");
  });

  it("approve after timeout returns already_resolved", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-7",
        policy_kind: "one_of",
        required_count: 1,
        roles: JSON.stringify([]),
      },
      storage,
    );
    const approval = (req as any).approval;

    await approvalHandler.timeout({ approval }, storage);

    const result = await approvalHandler.approve(
      { approval, actor: "late-approver", comment: "too late" },
      storage,
    );
    expect(result.variant).toBe("already_resolved");
  });

  it("deny by unauthorized actor returns not_authorized", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-8",
        policy_kind: "one_of",
        required_count: 1,
        roles: JSON.stringify(["manager"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    const result = await approvalHandler.deny(
      { approval, actor: "intern", reason: "no" },
      storage,
    );
    expect(result.variant).toBe("not_authorized");
  });

  it("multiple decisions tracked in getStatus", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-9",
        policy_kind: "all_of",
        required_count: 3,
        roles: JSON.stringify(["a", "b", "c"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    await approvalHandler.approve({ approval, actor: "a", comment: "ok" }, storage);
    await approvalHandler.approve({ approval, actor: "b", comment: "fine" }, storage);
    await approvalHandler.approve({ approval, actor: "c", comment: "done" }, storage);

    const status = await approvalHandler.getStatus({ approval }, storage);
    const decisions = JSON.parse((status as any).decisions);
    expect(decisions.length).toBe(3);
    expect(decisions[0].actor).toBe("a");
    expect(decisions[0].decision).toBe("approve");
    expect(decisions[1].actor).toBe("b");
    expect(decisions[2].actor).toBe("c");
  });

  it("double-approve by same actor is recorded but uses same threshold logic", async () => {
    const storage = createInMemoryStorage();

    const req = await approvalHandler.request(
      {
        step_ref: "step-10",
        policy_kind: "n_of_m",
        required_count: 2,
        roles: JSON.stringify(["voter"]),
      },
      storage,
    );
    const approval = (req as any).approval;

    // Same actor approves twice
    await approvalHandler.approve({ approval, actor: "voter", comment: "first" }, storage);
    const r2 = await approvalHandler.approve(
      { approval, actor: "voter", comment: "second" },
      storage,
    );
    // Two approve decisions exist, threshold of 2 is met
    expect(r2.variant).toBe("ok");
  });

  it("getStatus on nonexistent approval returns not_found", async () => {
    const storage = createInMemoryStorage();
    const result = await approvalHandler.getStatus(
      { approval: "appr-nonexistent" },
      storage,
    );
    expect(result.variant).toBe("not_found");
  });
});
