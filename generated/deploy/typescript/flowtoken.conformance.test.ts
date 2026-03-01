// generated: flowtoken.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { flowTokenHandler } from "./flowtoken.impl";

describe("FlowToken conformance", () => {

  it("invariant: emit then consume, then countActive returns 0", async () => {
    const storage = createInMemoryStorage();

    const emitted = await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_a", branch_id: "b1" },
      storage,
    );
    expect(emitted.variant).toBe("ok");
    const token = emitted.token;
    expect(emitted.run_ref).toBe("r1");
    expect(emitted.position).toBe("step_a");

    const consumed = await flowTokenHandler.consume({ token }, storage);
    expect(consumed.variant).toBe("ok");
    expect((consumed as any).run_ref).toBe("r1");
    expect((consumed as any).position).toBe("step_a");

    const count = await flowTokenHandler.countActive(
      { run_ref: "r1", position: "step_a" },
      storage,
    );
    expect(count.variant).toBe("ok");
    expect(count.count).toBe(0);
  });

  it("multiple active tokens at different positions represent parallelism", async () => {
    const storage = createInMemoryStorage();

    await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_a", branch_id: "b1" },
      storage,
    );
    await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_b", branch_id: "b2" },
      storage,
    );

    const countA = await flowTokenHandler.countActive(
      { run_ref: "r1", position: "step_a" },
      storage,
    );
    expect(countA.count).toBe(1);

    const countB = await flowTokenHandler.countActive(
      { run_ref: "r1", position: "step_b" },
      storage,
    );
    expect(countB.count).toBe(1);
  });

  it("listActive returns all active tokens for a run", async () => {
    const storage = createInMemoryStorage();

    await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_a", branch_id: "b1" },
      storage,
    );
    const emitted2 = await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_b", branch_id: "b2" },
      storage,
    );

    // Consume one
    await flowTokenHandler.consume({ token: emitted2.token }, storage);

    const listed = await flowTokenHandler.listActive({ run_ref: "r1" }, storage);
    expect(listed.variant).toBe("ok");
    const tokens = JSON.parse(listed.tokens);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].position).toBe("step_a");
  });

  it("kill transitions active to dead", async () => {
    const storage = createInMemoryStorage();

    const emitted = await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_a", branch_id: "b1" },
      storage,
    );

    const killed = await flowTokenHandler.kill({ token: emitted.token }, storage);
    expect(killed.variant).toBe("ok");

    const count = await flowTokenHandler.countActive(
      { run_ref: "r1", position: "step_a" },
      storage,
    );
    expect(count.count).toBe(0);
  });

  it("consume rejects non-active token", async () => {
    const storage = createInMemoryStorage();

    const emitted = await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_a", branch_id: "b1" },
      storage,
    );
    await flowTokenHandler.consume({ token: emitted.token }, storage);

    const result = await flowTokenHandler.consume({ token: emitted.token }, storage);
    expect(result.variant).toBe("not_active");
  });

  it("kill rejects non-active token", async () => {
    const storage = createInMemoryStorage();

    const emitted = await flowTokenHandler.emit(
      { run_ref: "r1", position: "step_a", branch_id: "b1" },
      storage,
    );
    await flowTokenHandler.kill({ token: emitted.token }, storage);

    const result = await flowTokenHandler.kill({ token: emitted.token }, storage);
    expect(result.variant).toBe("not_active");
  });

  it("countActive returns 0 when no tokens exist at position", async () => {
    const storage = createInMemoryStorage();

    const count = await flowTokenHandler.countActive(
      { run_ref: "r1", position: "step_x" },
      storage,
    );
    expect(count.variant).toBe("ok");
    expect(count.count).toBe(0);
  });
});
