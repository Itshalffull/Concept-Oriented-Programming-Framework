// generated: processevent.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processEventHandler } from "./processevent.impl";

describe("ProcessEvent conformance", () => {

  it("invariant: append two events, query returns both with correct count", async () => {
    const storage = createInMemoryStorage();

    const e1 = await processEventHandler.append(
      { run_ref: "r1", event_type: "step.completed", payload: '{"step_ref":"s1"}' },
      storage,
    );
    expect(e1.variant).toBe("ok");
    expect(e1.sequence_num).toBe(1);

    const e2 = await processEventHandler.append(
      { run_ref: "r1", event_type: "step.started", payload: '{"step_ref":"s2"}' },
      storage,
    );
    expect(e2.variant).toBe("ok");
    expect(e2.sequence_num).toBe(2);

    const queried = await processEventHandler.query(
      { run_ref: "r1", after_seq: 0, limit: 10 },
      storage,
    );
    expect(queried.variant).toBe("ok");
    expect(queried.count).toBe(2);

    const events = JSON.parse(queried.events);
    expect(events[0].sequence_num).toBe(1);
    expect(events[1].sequence_num).toBe(2);
  });

  it("sequence numbers are monotonically increasing per run", async () => {
    const storage = createInMemoryStorage();

    const e1 = await processEventHandler.append(
      { run_ref: "r1", event_type: "run.started", payload: "{}" },
      storage,
    );
    const e2 = await processEventHandler.append(
      { run_ref: "r1", event_type: "step.started", payload: "{}" },
      storage,
    );
    const e3 = await processEventHandler.append(
      { run_ref: "r1", event_type: "step.completed", payload: "{}" },
      storage,
    );

    expect(e1.sequence_num).toBe(1);
    expect(e2.sequence_num).toBe(2);
    expect(e3.sequence_num).toBe(3);
  });

  it("query with after_seq filters events correctly", async () => {
    const storage = createInMemoryStorage();

    await processEventHandler.append(
      { run_ref: "r1", event_type: "run.started", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "r1", event_type: "step.started", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "r1", event_type: "step.completed", payload: "{}" },
      storage,
    );

    const queried = await processEventHandler.query(
      { run_ref: "r1", after_seq: 1, limit: 10 },
      storage,
    );
    expect(queried.count).toBe(2);
    const events = JSON.parse(queried.events);
    expect(events[0].sequence_num).toBe(2);
  });

  it("query respects limit parameter", async () => {
    const storage = createInMemoryStorage();

    await processEventHandler.append(
      { run_ref: "r1", event_type: "a", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "r1", event_type: "b", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "r1", event_type: "c", payload: "{}" },
      storage,
    );

    const queried = await processEventHandler.query(
      { run_ref: "r1", after_seq: 0, limit: 2 },
      storage,
    );
    expect(queried.count).toBe(2);
  });

  it("queryByType filters by event type", async () => {
    const storage = createInMemoryStorage();

    await processEventHandler.append(
      { run_ref: "r1", event_type: "step.started", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "r1", event_type: "step.completed", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "r1", event_type: "step.started", payload: "{}" },
      storage,
    );

    const queried = await processEventHandler.queryByType(
      { run_ref: "r1", event_type: "step.started", limit: 10 },
      storage,
    );
    expect(queried.count).toBe(2);
  });

  it("getCursor returns latest sequence number", async () => {
    const storage = createInMemoryStorage();

    const cursor0 = await processEventHandler.getCursor({ run_ref: "r1" }, storage);
    expect(cursor0.last_seq).toBe(0);

    await processEventHandler.append(
      { run_ref: "r1", event_type: "run.started", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "r1", event_type: "step.started", payload: "{}" },
      storage,
    );

    const cursor2 = await processEventHandler.getCursor({ run_ref: "r1" }, storage);
    expect(cursor2.last_seq).toBe(2);
  });

  it("different runs have independent sequence numbers", async () => {
    const storage = createInMemoryStorage();

    const e1 = await processEventHandler.append(
      { run_ref: "r1", event_type: "run.started", payload: "{}" },
      storage,
    );
    const e2 = await processEventHandler.append(
      { run_ref: "r2", event_type: "run.started", payload: "{}" },
      storage,
    );

    expect(e1.sequence_num).toBe(1);
    expect(e2.sequence_num).toBe(1);
  });

  it("query returns empty for run with no events", async () => {
    const storage = createInMemoryStorage();

    const queried = await processEventHandler.query(
      { run_ref: "r999", after_seq: 0, limit: 10 },
      storage,
    );
    expect(queried.count).toBe(0);
    expect(JSON.parse(queried.events)).toEqual([]);
  });
});
