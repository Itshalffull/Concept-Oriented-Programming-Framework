import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { workItemHandler } from "./workitem.impl";

describe("WorkItem business logic", () => {
  it("create, claim, start, complete full lifecycle", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      {
        step_ref: "step-1",
        candidate_pool: JSON.stringify(["alice", "bob"]),
        form_schema: '{"type":"object"}',
        priority: 5,
      },
      storage,
    );
    expect(created.variant).toBe("ok");
    const item = (created as any).item;

    const claimed = await workItemHandler.claim(
      { item, assignee: "alice" },
      storage,
    );
    expect(claimed.variant).toBe("ok");
    expect((claimed as any).assignee).toBe("alice");

    const started = await workItemHandler.start({ item }, storage);
    expect(started.variant).toBe("ok");

    const completed = await workItemHandler.complete(
      { item, form_data: '{"approved":true}' },
      storage,
    );
    expect(completed.variant).toBe("ok");
    expect((completed as any).form_data).toBe('{"approved":true}');
    expect((completed as any).step_ref).toBe("step-1");
  });

  it("claim by non-candidate returns not_authorized", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-2",
        candidate_pool: JSON.stringify(["alice", "bob"]),
        form_schema: "{}",
        priority: 3,
      },
      storage,
    );
    const item = (created as any).item;

    const result = await workItemHandler.claim(
      { item, assignee: "charlie" },
      storage,
    );
    expect(result.variant).toBe("not_authorized");
    expect((result as any).assignee).toBe("charlie");
  });

  it("claim already-claimed item returns not_offered", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-3",
        candidate_pool: JSON.stringify(["alice", "bob"]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const item = (created as any).item;

    await workItemHandler.claim({ item, assignee: "alice" }, storage);

    const result = await workItemHandler.claim(
      { item, assignee: "bob" },
      storage,
    );
    expect(result.variant).toBe("not_offered");
  });

  it("release returns item to offered status", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-4",
        candidate_pool: JSON.stringify(["alice"]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const item = (created as any).item;

    await workItemHandler.claim({ item, assignee: "alice" }, storage);
    const released = await workItemHandler.release({ item }, storage);
    expect(released.variant).toBe("ok");

    // Can now be claimed again
    const reclaimed = await workItemHandler.claim(
      { item, assignee: "alice" },
      storage,
    );
    expect(reclaimed.variant).toBe("ok");
  });

  it("delegate changes assignee", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-5",
        candidate_pool: JSON.stringify(["alice", "bob", "charlie"]),
        form_schema: "{}",
        priority: 2,
      },
      storage,
    );
    const item = (created as any).item;

    await workItemHandler.claim({ item, assignee: "alice" }, storage);

    const delegated = await workItemHandler.delegate(
      { item, new_assignee: "bob" },
      storage,
    );
    expect(delegated.variant).toBe("ok");
    expect((delegated as any).new_assignee).toBe("bob");
  });

  it("reject from active state succeeds", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-6",
        candidate_pool: JSON.stringify(["alice"]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const item = (created as any).item;

    await workItemHandler.claim({ item, assignee: "alice" }, storage);
    await workItemHandler.start({ item }, storage);

    const rejected = await workItemHandler.reject(
      { item, reason: "data is incomplete" },
      storage,
    );
    expect(rejected.variant).toBe("ok");
    expect((rejected as any).reason).toBe("data is incomplete");
  });

  it("reject from claimed state also succeeds", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-6b",
        candidate_pool: JSON.stringify(["alice"]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const item = (created as any).item;

    await workItemHandler.claim({ item, assignee: "alice" }, storage);

    const rejected = await workItemHandler.reject(
      { item, reason: "wrong task" },
      storage,
    );
    expect(rejected.variant).toBe("ok");
  });

  it("start non-claimed item rejects", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-7",
        candidate_pool: JSON.stringify([]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const item = (created as any).item;

    // Item is in "offered" status, not claimed
    const result = await workItemHandler.start({ item }, storage);
    expect(result.variant).toBe("not_claimed");
  });

  it("complete non-active item rejects", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-8",
        candidate_pool: JSON.stringify(["alice"]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const item = (created as any).item;

    // Item is "offered", not "active"
    const result = await workItemHandler.complete(
      { item, form_data: "{}" },
      storage,
    );
    expect(result.variant).toBe("not_active");
  });

  it("multiple work items for same step operate independently", async () => {
    const storage = createInMemoryStorage();

    const w1 = await workItemHandler.create(
      {
        step_ref: "step-shared",
        candidate_pool: JSON.stringify(["alice"]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const w2 = await workItemHandler.create(
      {
        step_ref: "step-shared",
        candidate_pool: JSON.stringify(["bob"]),
        form_schema: "{}",
        priority: 2,
      },
      storage,
    );

    const item1 = (w1 as any).item;
    const item2 = (w2 as any).item;
    expect(item1).not.toBe(item2);

    // Claim and complete item1, item2 should still be offered
    await workItemHandler.claim({ item: item1, assignee: "alice" }, storage);
    await workItemHandler.start({ item: item1 }, storage);
    await workItemHandler.complete({ item: item1, form_data: '"done"' }, storage);

    // Item2 should still be claimable
    const claimed = await workItemHandler.claim({ item: item2, assignee: "bob" }, storage);
    expect(claimed.variant).toBe("ok");
  });

  it("empty candidate pool allows anyone to claim", async () => {
    const storage = createInMemoryStorage();
    const created = await workItemHandler.create(
      {
        step_ref: "step-open",
        candidate_pool: JSON.stringify([]),
        form_schema: "{}",
        priority: 1,
      },
      storage,
    );
    const item = (created as any).item;

    const claimed = await workItemHandler.claim(
      { item, assignee: "random-user" },
      storage,
    );
    expect(claimed.variant).toBe("ok");
  });
});
