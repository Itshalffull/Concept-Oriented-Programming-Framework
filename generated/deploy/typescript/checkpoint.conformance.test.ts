// generated: checkpoint.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { checkpointHandler } from "./checkpoint.impl";

describe("Checkpoint conformance", () => {

  it("capture then restore returns full state snapshot", async () => {
    const storage = createInMemoryStorage();

    const step1 = await checkpointHandler.capture(
      {
        runRef: "run-1",
        runState: '{"step":"payment","status":"active"}',
        variablesSnapshot: '{"amount":100,"currency":"USD"}',
        tokenSnapshot: '{"tokens":["t-1","t-2"]}',
        eventCursor: 42,
      },
      storage,
    );
    expect(step1.variant).toBe("ok");
    const checkpoint = (step1 as any).checkpoint;
    expect((step1 as any).timestamp).toBeTruthy();

    const step2 = await checkpointHandler.restore(
      { checkpoint },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).runState).toBe('{"step":"payment","status":"active"}');
    expect((step2 as any).variablesSnapshot).toBe('{"amount":100,"currency":"USD"}');
    expect((step2 as any).tokenSnapshot).toBe('{"tokens":["t-1","t-2"]}');
    expect((step2 as any).eventCursor).toBe(42);
  });

  it("restore on nonexistent checkpoint returns notFound", async () => {
    const storage = createInMemoryStorage();

    const step1 = await checkpointHandler.restore(
      { checkpoint: "ckpt-nonexistent" },
      storage,
    );
    expect(step1.variant).toBe("notFound");
  });

  it("findLatest returns the most recent checkpoint for a run", async () => {
    const storage = createInMemoryStorage();

    await checkpointHandler.capture(
      { runRef: "run-2", runState: "state-1", variablesSnapshot: "v1", tokenSnapshot: "t1", eventCursor: 1 },
      storage,
    );

    const cap2 = await checkpointHandler.capture(
      { runRef: "run-2", runState: "state-2", variablesSnapshot: "v2", tokenSnapshot: "t2", eventCursor: 5 },
      storage,
    );
    const latestCkpt = (cap2 as any).checkpoint;

    const step1 = await checkpointHandler.findLatest(
      { runRef: "run-2" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).checkpoint).toBe(latestCkpt);
  });

  it("findLatest on run with no checkpoints returns none", async () => {
    const storage = createInMemoryStorage();

    const step1 = await checkpointHandler.findLatest(
      { runRef: "run-no-checkpoints" },
      storage,
    );
    expect(step1.variant).toBe("none");
  });

  it("prune removes old checkpoints, keeping only keepCount most recent", async () => {
    const storage = createInMemoryStorage();

    // Create 4 checkpoints
    const cap1 = await checkpointHandler.capture(
      { runRef: "run-3", runState: "s1", variablesSnapshot: "v1", tokenSnapshot: "t1", eventCursor: 1 },
      storage,
    );
    await checkpointHandler.capture(
      { runRef: "run-3", runState: "s2", variablesSnapshot: "v2", tokenSnapshot: "t2", eventCursor: 2 },
      storage,
    );
    await checkpointHandler.capture(
      { runRef: "run-3", runState: "s3", variablesSnapshot: "v3", tokenSnapshot: "t3", eventCursor: 3 },
      storage,
    );
    const cap4 = await checkpointHandler.capture(
      { runRef: "run-3", runState: "s4", variablesSnapshot: "v4", tokenSnapshot: "t4", eventCursor: 4 },
      storage,
    );

    // Prune, keeping 2
    const step1 = await checkpointHandler.prune(
      { runRef: "run-3", keepCount: 2 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).pruned).toBe(2);

    // Oldest checkpoint should be gone
    const step2 = await checkpointHandler.restore(
      { checkpoint: (cap1 as any).checkpoint },
      storage,
    );
    expect(step2.variant).toBe("notFound");

    // Latest should still exist
    const step3 = await checkpointHandler.restore(
      { checkpoint: (cap4 as any).checkpoint },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).eventCursor).toBe(4);
  });

});
