import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { flowTokenHandler } from "./flowtoken.impl";

describe("FlowToken business logic", () => {
  it("parallel branching: multiple tokens at different positions", async () => {
    const storage = createInMemoryStorage();

    const t1 = await flowTokenHandler.emit(
      { run_ref: "run-1", position: "step-A", branch_id: "branch-1" },
      storage,
    );
    const t2 = await flowTokenHandler.emit(
      { run_ref: "run-1", position: "step-B", branch_id: "branch-2" },
      storage,
    );
    const t3 = await flowTokenHandler.emit(
      { run_ref: "run-1", position: "step-C", branch_id: "branch-3" },
      storage,
    );

    expect(t1.variant).toBe("ok");
    expect(t2.variant).toBe("ok");
    expect(t3.variant).toBe("ok");

    // All three should be active
    const active = await flowTokenHandler.listActive({ run_ref: "run-1" }, storage);
    const tokens = JSON.parse((active as any).tokens);
    expect(tokens.length).toBe(3);
    expect(tokens.map((t: any) => t.position).sort()).toEqual(["step-A", "step-B", "step-C"]);
  });

  it("consume reduces active count", async () => {
    const storage = createInMemoryStorage();

    const t1 = await flowTokenHandler.emit(
      { run_ref: "run-2", position: "gate", branch_id: "b1" },
      storage,
    );
    await flowTokenHandler.emit(
      { run_ref: "run-2", position: "gate", branch_id: "b2" },
      storage,
    );

    // Two active at position "gate"
    let count = await flowTokenHandler.countActive(
      { run_ref: "run-2", position: "gate" },
      storage,
    );
    expect((count as any).count).toBe(2);

    // Consume one
    await flowTokenHandler.consume({ token: (t1 as any).token }, storage);

    count = await flowTokenHandler.countActive(
      { run_ref: "run-2", position: "gate" },
      storage,
    );
    expect((count as any).count).toBe(1);
  });

  it("kill transitions token to dead and it becomes not consumable", async () => {
    const storage = createInMemoryStorage();

    const emitted = await flowTokenHandler.emit(
      { run_ref: "run-3", position: "start", branch_id: "main" },
      storage,
    );
    const token = (emitted as any).token;

    const killed = await flowTokenHandler.kill({ token }, storage);
    expect(killed.variant).toBe("ok");

    // Cannot consume a dead token
    const consumeResult = await flowTokenHandler.consume({ token }, storage);
    expect(consumeResult.variant).toBe("not_active");

    // Cannot kill again
    const killAgain = await flowTokenHandler.kill({ token }, storage);
    expect(killAgain.variant).toBe("not_active");
  });

  it("count_active after multiple emits and consumes", async () => {
    const storage = createInMemoryStorage();

    // Emit 3 tokens at "join"
    const tokens = [];
    for (let i = 0; i < 3; i++) {
      const result = await flowTokenHandler.emit(
        { run_ref: "run-4", position: "join", branch_id: `b${i}` },
        storage,
      );
      tokens.push((result as any).token);
    }

    let count = await flowTokenHandler.countActive(
      { run_ref: "run-4", position: "join" },
      storage,
    );
    expect((count as any).count).toBe(3);

    // Consume two
    await flowTokenHandler.consume({ token: tokens[0] }, storage);
    await flowTokenHandler.consume({ token: tokens[1] }, storage);

    count = await flowTokenHandler.countActive(
      { run_ref: "run-4", position: "join" },
      storage,
    );
    expect((count as any).count).toBe(1);
  });

  it("listActive returns only active tokens, not consumed or dead", async () => {
    const storage = createInMemoryStorage();

    const t1 = await flowTokenHandler.emit(
      { run_ref: "run-5", position: "A", branch_id: "b1" },
      storage,
    );
    const t2 = await flowTokenHandler.emit(
      { run_ref: "run-5", position: "B", branch_id: "b2" },
      storage,
    );
    const t3 = await flowTokenHandler.emit(
      { run_ref: "run-5", position: "C", branch_id: "b3" },
      storage,
    );

    await flowTokenHandler.consume({ token: (t1 as any).token }, storage);
    await flowTokenHandler.kill({ token: (t2 as any).token }, storage);

    const active = await flowTokenHandler.listActive({ run_ref: "run-5" }, storage);
    const tokens = JSON.parse((active as any).tokens);
    expect(tokens.length).toBe(1);
    expect(tokens[0].token).toBe((t3 as any).token);
    expect(tokens[0].position).toBe("C");
  });

  it("emit, consume, then kill same token: kill returns not_active", async () => {
    const storage = createInMemoryStorage();

    const emitted = await flowTokenHandler.emit(
      { run_ref: "run-6", position: "step-X", branch_id: "main" },
      storage,
    );
    const token = (emitted as any).token;

    await flowTokenHandler.consume({ token }, storage);
    const killResult = await flowTokenHandler.kill({ token }, storage);
    expect(killResult.variant).toBe("not_active");
  });

  it("multiple tokens at same position for join scenario", async () => {
    const storage = createInMemoryStorage();

    // Simulate 4 parallel branches arriving at a join point
    for (let i = 0; i < 4; i++) {
      await flowTokenHandler.emit(
        { run_ref: "run-7", position: "join-point", branch_id: `parallel-${i}` },
        storage,
      );
    }

    const count = await flowTokenHandler.countActive(
      { run_ref: "run-7", position: "join-point" },
      storage,
    );
    expect((count as any).count).toBe(4);
  });

  it("countActive for nonexistent run returns 0", async () => {
    const storage = createInMemoryStorage();
    const count = await flowTokenHandler.countActive(
      { run_ref: "run-nonexistent", position: "anywhere" },
      storage,
    );
    expect((count as any).count).toBe(0);
  });

  it("listActive for run with no tokens returns empty array", async () => {
    const storage = createInMemoryStorage();
    const active = await flowTokenHandler.listActive(
      { run_ref: "run-empty" },
      storage,
    );
    const tokens = JSON.parse((active as any).tokens);
    expect(tokens).toEqual([]);
  });
});
