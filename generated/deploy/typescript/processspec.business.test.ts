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

describe("ProcessSpec business logic", () => {
  it("create with duplicate step keys returns invalid with descriptive message", async () => {
    const storage = createInMemoryStorage();
    const dupSteps = JSON.stringify([
      { key: "stepA", step_type: "automation", config: "{}" },
      { key: "stepB", step_type: "human", config: "{}" },
      { key: "stepA", step_type: "automation", config: "{}" },
    ]);
    const result = await processSpecHandler.create(
      { name: "dup-test", steps: dupSteps, edges: "[]" },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("Duplicate step key: stepA");
  });

  it("create with edges referencing nonexistent from_step returns invalid", async () => {
    const storage = createInMemoryStorage();
    const steps = JSON.stringify([
      { key: "alpha", step_type: "automation", config: "{}" },
    ]);
    const edges = JSON.stringify([
      { from_step: "ghost", to_step: "alpha", on_variant: "ok" },
    ]);
    const result = await processSpecHandler.create(
      { name: "bad-edge", steps, edges },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("unknown from_step: ghost");
  });

  it("create with edges referencing nonexistent to_step returns invalid", async () => {
    const storage = createInMemoryStorage();
    const steps = JSON.stringify([
      { key: "alpha", step_type: "automation", config: "{}" },
    ]);
    const edges = JSON.stringify([
      { from_step: "alpha", to_step: "phantom", on_variant: "ok" },
    ]);
    const result = await processSpecHandler.create(
      { name: "bad-edge", steps, edges },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("unknown to_step: phantom");
  });

  it("create then publish then deprecate then update should fail with not_draft", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "lifecycle", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;

    await processSpecHandler.publish({ spec }, storage);
    await processSpecHandler.deprecate({ spec }, storage);

    const updateResult = await processSpecHandler.update(
      { spec, steps: validSteps, edges: validEdges },
      storage,
    );
    expect(updateResult.variant).toBe("not_draft");
  });

  it("publish on already-active spec returns already_active", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "flow", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;
    await processSpecHandler.publish({ spec }, storage);

    const secondPublish = await processSpecHandler.publish({ spec }, storage);
    expect(secondPublish.variant).toBe("already_active");
    expect((secondPublish as any).spec).toBe(spec);
  });

  it("version increments on re-publish from deprecated state", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "versioned", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;

    // Publish (version stays 1) -> deprecate -> re-publish (version becomes 2)
    const pub1 = await processSpecHandler.publish({ spec }, storage);
    expect((pub1 as any).version).toBe(1);

    await processSpecHandler.deprecate({ spec }, storage);

    const pub2 = await processSpecHandler.publish({ spec }, storage);
    expect(pub2.variant).toBe("ok");
    expect((pub2 as any).version).toBe(2);

    // Deprecate again -> re-publish (version becomes 3)
    await processSpecHandler.deprecate({ spec }, storage);
    const pub3 = await processSpecHandler.publish({ spec }, storage);
    expect((pub3 as any).version).toBe(3);
  });

  it("get with nonexistent spec returns not_found", async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecHandler.get(
      { spec: "pspec-999999" },
      storage,
    );
    expect(result.variant).toBe("not_found");
    expect((result as any).spec).toBe("pspec-999999");
  });

  it("update with empty steps array returns invalid", async () => {
    const storage = createInMemoryStorage();
    const created = await processSpecHandler.create(
      { name: "will-update", steps: validSteps, edges: validEdges },
      storage,
    );
    const spec = (created as any).spec;

    const result = await processSpecHandler.update(
      { spec, steps: "[]", edges: "[]" },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("At least one step");
  });

  it("full lifecycle: create, update, publish, deprecate with version tracking", async () => {
    const storage = createInMemoryStorage();

    // Create
    const created = await processSpecHandler.create(
      { name: "full-lifecycle", steps: validSteps, edges: validEdges },
      storage,
    );
    expect(created.variant).toBe("ok");
    const spec = (created as any).spec;

    // Verify initial state
    let got = await processSpecHandler.get({ spec }, storage);
    expect((got as any).status).toBe("draft");
    expect((got as any).version).toBe(1);

    // Update in draft - version increments to 2
    const updatedSteps = JSON.stringify([
      { key: "init", step_type: "automation", config: "{}" },
      { key: "validate", step_type: "automation", config: "{}" },
      { key: "approve", step_type: "human", config: "{}" },
    ]);
    const updatedEdges = JSON.stringify([
      { from_step: "init", to_step: "validate", on_variant: "ok" },
      { from_step: "validate", to_step: "approve", on_variant: "ok" },
    ]);
    const updated = await processSpecHandler.update(
      { spec, steps: updatedSteps, edges: updatedEdges },
      storage,
    );
    expect(updated.variant).toBe("ok");
    expect((updated as any).version).toBe(2);

    // Publish
    const published = await processSpecHandler.publish({ spec }, storage);
    expect(published.variant).toBe("ok");
    expect((published as any).version).toBe(2);

    // Verify active state preserves updated steps/edges
    got = await processSpecHandler.get({ spec }, storage);
    expect((got as any).status).toBe("active");
    expect((got as any).steps).toBe(updatedSteps);
    expect((got as any).edges).toBe(updatedEdges);

    // Deprecate
    const deprecated = await processSpecHandler.deprecate({ spec }, storage);
    expect(deprecated.variant).toBe("ok");

    got = await processSpecHandler.get({ spec }, storage);
    expect((got as any).status).toBe("deprecated");
  });

  it("create with invalid steps JSON returns invalid", async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecHandler.create(
      { name: "bad-json", steps: "not-json", edges: "[]" },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("Invalid steps JSON");
  });

  it("create with invalid edges JSON returns invalid", async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecHandler.create(
      { name: "bad-json", steps: validSteps, edges: "not-json" },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("Invalid edges JSON");
  });

  it("publish on nonexistent spec returns not_found", async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecHandler.publish(
      { spec: "pspec-does-not-exist" },
      storage,
    );
    expect(result.variant).toBe("not_found");
  });

  it("create with step missing key returns invalid", async () => {
    const storage = createInMemoryStorage();
    const stepsNoKey = JSON.stringify([
      { step_type: "automation", config: "{}" },
    ]);
    const result = await processSpecHandler.create(
      { name: "no-key", steps: stepsNoKey, edges: "[]" },
      storage,
    );
    expect(result.variant).toBe("invalid");
    expect((result as any).message).toContain("key");
  });
});
