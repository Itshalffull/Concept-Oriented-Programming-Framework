import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { checkpointHandler } from "./checkpoint.impl";

describe("Checkpoint business logic", () => {
  it("capture then restore roundtrip returns same data", async () => {
    const storage = createInMemoryStorage();

    const captured = await checkpointHandler.capture(
      {
        runRef: "run-1",
        runState: '{"status":"running","step":"validate"}',
        variablesSnapshot: '{"counter":42}',
        tokenSnapshot: '[{"token":"ftk-1","position":"step-A"}]',
        eventCursor: 5,
      },
      storage,
    );
    expect(captured.variant).toBe("ok");
    const checkpoint = (captured as any).checkpoint;

    const restored = await checkpointHandler.restore({ checkpoint }, storage);
    expect(restored.variant).toBe("ok");
    expect((restored as any).runState).toBe('{"status":"running","step":"validate"}');
    expect((restored as any).variablesSnapshot).toBe('{"counter":42}');
    expect((restored as any).tokenSnapshot).toBe('[{"token":"ftk-1","position":"step-A"}]');
    expect((restored as any).eventCursor).toBe(5);
  });

  it("findLatest returns most recent checkpoint", async () => {
    const storage = createInMemoryStorage();

    const c1 = await checkpointHandler.capture(
      {
        runRef: "run-2",
        runState: '{"step":"first"}',
        variablesSnapshot: "{}",
        tokenSnapshot: "[]",
        eventCursor: 1,
      },
      storage,
    );
    const c2 = await checkpointHandler.capture(
      {
        runRef: "run-2",
        runState: '{"step":"second"}',
        variablesSnapshot: "{}",
        tokenSnapshot: "[]",
        eventCursor: 2,
      },
      storage,
    );
    const c3 = await checkpointHandler.capture(
      {
        runRef: "run-2",
        runState: '{"step":"third"}',
        variablesSnapshot: "{}",
        tokenSnapshot: "[]",
        eventCursor: 3,
      },
      storage,
    );

    const latest = await checkpointHandler.findLatest({ runRef: "run-2" }, storage);
    expect(latest.variant).toBe("ok");
    expect((latest as any).checkpoint).toBe((c3 as any).checkpoint);
  });

  it("prune keeps only specified count of most recent checkpoints", async () => {
    const storage = createInMemoryStorage();

    // Create 5 checkpoints
    const checkpoints: string[] = [];
    for (let i = 0; i < 5; i++) {
      const c = await checkpointHandler.capture(
        {
          runRef: "run-3",
          runState: `{"i":${i}}`,
          variablesSnapshot: "{}",
          tokenSnapshot: "[]",
          eventCursor: i,
        },
        storage,
      );
      checkpoints.push((c as any).checkpoint);
    }

    // Prune to keep 2
    const pruned = await checkpointHandler.prune(
      { runRef: "run-3", keepCount: 2 },
      storage,
    );
    expect(pruned.variant).toBe("ok");
    expect((pruned as any).pruned).toBe(3);

    // Old checkpoints should not be restorable
    const old = await checkpointHandler.restore(
      { checkpoint: checkpoints[0] },
      storage,
    );
    expect(old.variant).toBe("notFound");

    // Recent checkpoints should still work
    const recent = await checkpointHandler.restore(
      { checkpoint: checkpoints[4] },
      storage,
    );
    expect(recent.variant).toBe("ok");
    expect((recent as any).runState).toBe('{"i":4}');

    const secondRecent = await checkpointHandler.restore(
      { checkpoint: checkpoints[3] },
      storage,
    );
    expect(secondRecent.variant).toBe("ok");
  });

  it("multiple checkpoints for same run are independent", async () => {
    const storage = createInMemoryStorage();

    const c1 = await checkpointHandler.capture(
      {
        runRef: "run-4",
        runState: '{"version":1}',
        variablesSnapshot: '{"x":1}',
        tokenSnapshot: "[]",
        eventCursor: 10,
      },
      storage,
    );
    const c2 = await checkpointHandler.capture(
      {
        runRef: "run-4",
        runState: '{"version":2}',
        variablesSnapshot: '{"x":2}',
        tokenSnapshot: "[]",
        eventCursor: 20,
      },
      storage,
    );

    // Both should be independently restorable
    const r1 = await checkpointHandler.restore(
      { checkpoint: (c1 as any).checkpoint },
      storage,
    );
    const r2 = await checkpointHandler.restore(
      { checkpoint: (c2 as any).checkpoint },
      storage,
    );

    expect((r1 as any).runState).toBe('{"version":1}');
    expect((r2 as any).runState).toBe('{"version":2}');
    expect((r1 as any).eventCursor).toBe(10);
    expect((r2 as any).eventCursor).toBe(20);
  });

  it("restore nonexistent checkpoint returns notFound", async () => {
    const storage = createInMemoryStorage();
    const result = await checkpointHandler.restore(
      { checkpoint: "ckpt-nonexistent" },
      storage,
    );
    expect(result.variant).toBe("notFound");
  });

  it("findLatest with no checkpoints returns none", async () => {
    const storage = createInMemoryStorage();
    const result = await checkpointHandler.findLatest(
      { runRef: "run-empty" },
      storage,
    );
    expect(result.variant).toBe("none");
  });

  it("prune with keepCount larger than total prunes nothing", async () => {
    const storage = createInMemoryStorage();

    await checkpointHandler.capture(
      {
        runRef: "run-5",
        runState: '{"only":1}',
        variablesSnapshot: "{}",
        tokenSnapshot: "[]",
        eventCursor: 1,
      },
      storage,
    );

    const pruned = await checkpointHandler.prune(
      { runRef: "run-5", keepCount: 10 },
      storage,
    );
    expect((pruned as any).pruned).toBe(0);
  });

  it("captured checkpoint has a timestamp set", async () => {
    const storage = createInMemoryStorage();

    const before = new Date().toISOString();
    const captured = await checkpointHandler.capture(
      {
        runRef: "run-6",
        runState: "{}",
        variablesSnapshot: "{}",
        tokenSnapshot: "[]",
        eventCursor: 0,
      },
      storage,
    );
    const after = new Date().toISOString();

    expect((captured as any).timestamp).toBeDefined();
    expect((captured as any).timestamp >= before).toBe(true);
    expect((captured as any).timestamp <= after).toBe(true);
  });

  it("prune on run with no checkpoints returns 0 pruned", async () => {
    const storage = createInMemoryStorage();
    const result = await checkpointHandler.prune(
      { runRef: "run-no-checkpoints", keepCount: 5 },
      storage,
    );
    expect((result as any).pruned).toBe(0);
  });

  it("findLatest after prune returns the most recent kept checkpoint", async () => {
    const storage = createInMemoryStorage();

    for (let i = 0; i < 4; i++) {
      await checkpointHandler.capture(
        {
          runRef: "run-7",
          runState: `{"seq":${i}}`,
          variablesSnapshot: "{}",
          tokenSnapshot: "[]",
          eventCursor: i,
        },
        storage,
      );
    }

    await checkpointHandler.prune({ runRef: "run-7", keepCount: 1 }, storage);

    const latest = await checkpointHandler.findLatest({ runRef: "run-7" }, storage);
    expect(latest.variant).toBe("ok");

    const restored = await checkpointHandler.restore(
      { checkpoint: (latest as any).checkpoint },
      storage,
    );
    expect((restored as any).runState).toBe('{"seq":3}');
  });
});
