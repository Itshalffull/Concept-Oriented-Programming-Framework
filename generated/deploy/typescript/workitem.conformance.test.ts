// generated: workitem.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { workItemHandler } from "./workitem.impl";

const candidatePool = JSON.stringify(["alice", "bob"]);

describe("WorkItem conformance", () => {

  it("invariant: create, claim, start, complete full lifecycle", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "review", candidate_pool: candidatePool, form_schema: "ReviewForm", priority: 1 },
      storage,
    );
    expect(created.variant).toBe("ok");
    const item = (created as any).item;
    expect((created as any).step_ref).toBe("review");

    const claimed = await workItemHandler.claim(
      { item, assignee: "alice" },
      storage,
    );
    expect(claimed.variant).toBe("ok");
    expect((claimed as any).assignee).toBe("alice");

    const started = await workItemHandler.start({ item }, storage);
    expect(started.variant).toBe("ok");

    const formData = '{"approved":true,"comments":"looks good"}';
    const completed = await workItemHandler.complete(
      { item, form_data: formData },
      storage,
    );
    expect(completed.variant).toBe("ok");
    expect((completed as any).step_ref).toBe("review");
    expect((completed as any).form_data).toBe(formData);
  });

  it("claim rejects non-offered item", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;
    await workItemHandler.claim({ item, assignee: "alice" }, storage);

    const result = await workItemHandler.claim({ item, assignee: "bob" }, storage);
    expect(result.variant).toBe("not_offered");
  });

  it("claim rejects unauthorized assignee", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;

    const result = await workItemHandler.claim({ item, assignee: "charlie" }, storage);
    expect(result.variant).toBe("not_authorized");
  });

  it("start rejects non-claimed item", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;

    const result = await workItemHandler.start({ item }, storage);
    expect(result.variant).toBe("not_claimed");
  });

  it("complete rejects non-active item", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;

    const result = await workItemHandler.complete({ item, form_data: "{}" }, storage);
    expect(result.variant).toBe("not_active");
  });

  it("reject transitions active or claimed to rejected", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;
    await workItemHandler.claim({ item, assignee: "alice" }, storage);
    await workItemHandler.start({ item }, storage);

    const rejected = await workItemHandler.reject(
      { item, reason: "incomplete data" },
      storage,
    );
    expect(rejected.variant).toBe("ok");
    expect((rejected as any).reason).toBe("incomplete data");
  });

  it("delegate transfers item to a new assignee", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
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

  it("delegate rejects non-claimed item", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;

    const result = await workItemHandler.delegate(
      { item, new_assignee: "bob" },
      storage,
    );
    expect(result.variant).toBe("not_claimed");
  });

  it("release returns item to offered status", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;
    await workItemHandler.claim({ item, assignee: "alice" }, storage);

    const released = await workItemHandler.release({ item }, storage);
    expect(released.variant).toBe("ok");

    // Should be claimable again
    const reclaimed = await workItemHandler.claim({ item, assignee: "bob" }, storage);
    expect(reclaimed.variant).toBe("ok");
    expect((reclaimed as any).assignee).toBe("bob");
  });

  it("release rejects non-claimed item", async () => {
    const storage = createInMemoryStorage();

    const created = await workItemHandler.create(
      { step_ref: "task", candidate_pool: candidatePool, form_schema: "Form", priority: 1 },
      storage,
    );
    const item = (created as any).item;

    const result = await workItemHandler.release({ item }, storage);
    expect(result.variant).toBe("not_claimed");
  });
});
