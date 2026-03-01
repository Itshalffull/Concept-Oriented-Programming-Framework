import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processEventHandler } from "./processevent.impl";

describe("ProcessEvent business logic", () => {
  it("sequence numbers increment monotonically per run", async () => {
    const storage = createInMemoryStorage();

    const e1 = await processEventHandler.append(
      { run_ref: "run-1", event_type: "step_started", payload: '{"step":"init"}' },
      storage,
    );
    const e2 = await processEventHandler.append(
      { run_ref: "run-1", event_type: "step_completed", payload: '{"step":"init"}' },
      storage,
    );
    const e3 = await processEventHandler.append(
      { run_ref: "run-1", event_type: "step_started", payload: '{"step":"validate"}' },
      storage,
    );

    expect((e1 as any).sequence_num).toBe(1);
    expect((e2 as any).sequence_num).toBe(2);
    expect((e3 as any).sequence_num).toBe(3);
  });

  it("query with after_seq filters correctly", async () => {
    const storage = createInMemoryStorage();

    await processEventHandler.append(
      { run_ref: "run-2", event_type: "created", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "run-2", event_type: "started", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "run-2", event_type: "completed", payload: "{}" },
      storage,
    );

    // Query events after seq 1 (should get seq 2 and 3)
    const result = await processEventHandler.query(
      { run_ref: "run-2", after_seq: 1, limit: 100 },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).count).toBe(2);

    const events = JSON.parse((result as any).events);
    expect(events[0].sequence_num).toBe(2);
    expect(events[1].sequence_num).toBe(3);
  });

  it("queryByType filters by event type", async () => {
    const storage = createInMemoryStorage();

    await processEventHandler.append(
      { run_ref: "run-3", event_type: "step_started", payload: '{"step":"a"}' },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "run-3", event_type: "step_completed", payload: '{"step":"a"}' },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "run-3", event_type: "step_started", payload: '{"step":"b"}' },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "run-3", event_type: "error", payload: '{"msg":"oops"}' },
      storage,
    );

    const result = await processEventHandler.queryByType(
      { run_ref: "run-3", event_type: "step_started", limit: 100 },
      storage,
    );
    expect((result as any).count).toBe(2);
    const events = JSON.parse((result as any).events);
    expect(events.every((e: any) => e.event_type === "step_started")).toBe(true);
  });

  it("getCursor returns last sequence number", async () => {
    const storage = createInMemoryStorage();

    // Before any events
    let cursor = await processEventHandler.getCursor(
      { run_ref: "run-4" },
      storage,
    );
    expect((cursor as any).last_seq).toBe(0);

    await processEventHandler.append(
      { run_ref: "run-4", event_type: "a", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "run-4", event_type: "b", payload: "{}" },
      storage,
    );
    await processEventHandler.append(
      { run_ref: "run-4", event_type: "c", payload: "{}" },
      storage,
    );

    cursor = await processEventHandler.getCursor(
      { run_ref: "run-4" },
      storage,
    );
    expect((cursor as any).last_seq).toBe(3);
  });

  it("sequences are independent across different runs", async () => {
    const storage = createInMemoryStorage();

    const e1 = await processEventHandler.append(
      { run_ref: "run-A", event_type: "start", payload: "{}" },
      storage,
    );
    const e2 = await processEventHandler.append(
      { run_ref: "run-B", event_type: "start", payload: "{}" },
      storage,
    );

    // Both runs start at seq 1
    expect((e1 as any).sequence_num).toBe(1);
    expect((e2 as any).sequence_num).toBe(1);
  });

  it("query with limit restricts results", async () => {
    const storage = createInMemoryStorage();

    for (let i = 0; i < 10; i++) {
      await processEventHandler.append(
        { run_ref: "run-5", event_type: "tick", payload: `{"i":${i}}` },
        storage,
      );
    }

    const result = await processEventHandler.query(
      { run_ref: "run-5", after_seq: 0, limit: 3 },
      storage,
    );
    expect((result as any).count).toBe(3);
    const events = JSON.parse((result as any).events);
    expect(events.length).toBe(3);
  });

  it("query beyond last event returns empty", async () => {
    const storage = createInMemoryStorage();

    await processEventHandler.append(
      { run_ref: "run-6", event_type: "only", payload: "{}" },
      storage,
    );

    const result = await processEventHandler.query(
      { run_ref: "run-6", after_seq: 999, limit: 100 },
      storage,
    );
    expect((result as any).count).toBe(0);
    const events = JSON.parse((result as any).events);
    expect(events).toEqual([]);
  });

  it("append with various event_types stores correctly", async () => {
    const storage = createInMemoryStorage();

    const types = ["process_started", "step_entered", "variable_set", "token_emitted", "process_completed"];
    for (const t of types) {
      await processEventHandler.append(
        { run_ref: "run-7", event_type: t, payload: `{"type":"${t}"}` },
        storage,
      );
    }

    const result = await processEventHandler.query(
      { run_ref: "run-7", after_seq: 0, limit: 100 },
      storage,
    );
    const events = JSON.parse((result as any).events);
    expect(events.length).toBe(5);
    const eventTypes = events.map((e: any) => e.event_type);
    expect(eventTypes).toEqual(types);
  });

  it("query for run with no events returns empty", async () => {
    const storage = createInMemoryStorage();
    const result = await processEventHandler.query(
      { run_ref: "run-empty", after_seq: 0, limit: 100 },
      storage,
    );
    expect((result as any).count).toBe(0);
  });

  it("payload with step_ref and actor_ref metadata is stored", async () => {
    const storage = createInMemoryStorage();
    const payload = JSON.stringify({ step_ref: "step-42", actor_ref: "user-7", data: "test" });

    const appended = await processEventHandler.append(
      { run_ref: "run-8", event_type: "step_completed", payload },
      storage,
    );
    expect(appended.variant).toBe("ok");
  });
});
