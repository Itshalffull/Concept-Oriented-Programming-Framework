// generated: processspec.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processSpecHandler } from "./processspec.impl";

const validSteps = JSON.stringify([
  { key: "start", step_type: "automation", config: "{}" },
  { key: "review", step_type: "human", config: "{}" },
]);

const validEdges = JSON.stringify([
  { from_step: "start", to_step: "review", on_variant: "ok" },
]);

describe("ProcessSpec conformance", () => {

  it("invariant: after create, get returns the spec in draft status with version 1", async () => {
    const storage = createInMemoryStorage();

    const created = await processSpecHandler.create(
      { name: "onboard", steps: validSteps, edges: validEdges },
      storage,
    );
    expect(created.variant).toBe("ok");
    const spec = (created as any).spec;

    const got = await processSpecHandler.get({ spec }, storage);
    expect(got.variant).toBe("ok");
    expect((got as any).name).toBe("onboard");
    expect((got as any).version).toBe(1);
    expect((got as any).status).toBe("draft");
    expect((got as any).steps).toBe(validSteps);
    expect((got as any).edges).toBe(validEdges);
  });

  it("create rejects empty steps", async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecHandler.create(
      { name: "bad", steps: "[]", edges: "[]" },
      storage,
    );
    expect(result.variant).toBe("invalid");
  });

  it("create rejects duplicate step keys", async () => {
    const storage = createInMemoryStorage();
    const dupSteps = JSON.stringify([
      { key: "a", step_type: "automation", config: "{}" },
      { key: "a", step_type: "human", config: "{}" },
    ]);
    const result = await processSpecHandler.create(
      { name: "bad", steps: dupSteps, edges: "[]" },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("Duplicate");
  });

  it("create rejects edges referencing unknown steps", async () => {
    const storage = createInMemoryStorage();
    const badEdges = JSON.stringify([
      { from_step: "start", to_step: "nonexistent", on_variant: "ok" },
    ]);
    const result = await processSpecHandler.create(
      { name: "bad", steps: validSteps, edges: badEdges },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("unknown");
  });

  it("publish transitions draft to active", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "flow", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;

    const published = await processSpecHandler.publish({ spec }, storage);
    expect(published.variant).toBe("ok");
    expect((published as any).version).toBe(1);

    const got = await processSpecHandler.get({ spec }, storage);
    expect((got as any).status).toBe("active");
  });

  it("publish rejects already-active spec", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "flow", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;
    await processSpecHandler.publish({ spec }, storage);

    const result = await processSpecHandler.publish({ spec }, storage);
    expect(result.variant).toBe("already_active");
  });

  it("deprecate transitions active to deprecated", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "flow", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;
    await processSpecHandler.publish({ spec }, storage);

    const deprecated = await processSpecHandler.deprecate({ spec }, storage);
    expect(deprecated.variant).toBe("ok");

    const got = await processSpecHandler.get({ spec }, storage);
    expect((got as any).status).toBe("deprecated");
  });

  it("update only allowed in draft status", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "flow", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;
    await processSpecHandler.publish({ spec }, storage);

    const result = await processSpecHandler.update(
      { spec, steps: validSteps, edges: validEdges },
      storage,
    );
    expect(result.variant).toBe("not_draft");
  });

  it("update increments version in draft status", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "flow", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;

    const updated = await processSpecHandler.update(
      { spec, steps: validSteps, edges: validEdges },
      storage,
    );
    expect(updated.variant).toBe("ok");
    expect((updated as any).version).toBe(2);
  });

  it("get returns not_found for nonexistent spec", async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecHandler.get({ spec: "nonexistent" }, storage);
    expect(result.variant).toBe("not_found");
  });

  it("deprecate then re-publish increments version", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "flow", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;
    await processSpecHandler.publish({ spec }, storage);
    await processSpecHandler.deprecate({ spec }, storage);

    const republished = await processSpecHandler.publish({ spec }, storage);
    expect(republished.variant).toBe("ok");
    expect((republished as any).version).toBe(2);
  });
});
