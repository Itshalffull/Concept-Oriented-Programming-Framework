import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { machineHandler } from "./machine.impl";

/** Reusable FSM context with idle -> loading -> complete transitions */
const fsmContext = JSON.stringify({
  initial: "idle",
  states: {
    idle: { on: { START: "loading" } },
    loading: { on: { DONE: "complete" } },
    complete: { on: {} },
  },
});

describe("Machine Concept - Behavioral Tests", () => {
  // ── spawn ─────────────────────────────────────────────────────

  describe("spawn", () => {
    it("creates machine with initial state from context.initial", async () => {
      const storage = createInMemoryStorage();
      const result = await machineHandler.spawn(
        { machine: "m1", component: "btn", context: '{"initial":"ready"}' },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).machine).toBe("m1");

      // Verify persisted state
      const record = await storage.get("machine", "m1");
      expect((record as any).current).toBe("ready");
      expect((record as any).status).toBe("running");
    });

    it("defaults to 'idle' when context has no initial field", async () => {
      const storage = createInMemoryStorage();
      await machineHandler.spawn(
        { machine: "m1", component: "btn", context: '{"states":{}}' },
        storage,
      );
      const record = await storage.get("machine", "m1");
      expect((record as any).current).toBe("idle");
    });

    it("invalid JSON context returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await machineHandler.spawn(
        { machine: "m1", component: "btn", context: "<<<not-json>>>" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ── send ──────────────────────────────────────────────────────

  describe("send", () => {
    it("transitions state based on context.states[current].on[event] map", async () => {
      const storage = createInMemoryStorage();
      await machineHandler.spawn(
        { machine: "m1", component: "btn", context: fsmContext },
        storage,
      );

      const result = await machineHandler.send(
        { machine: "m1", event: "START" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).state).toBe("loading");
    });

    it("event with no matching transition keeps current state", async () => {
      const storage = createInMemoryStorage();
      await machineHandler.spawn(
        { machine: "m1", component: "btn", context: fsmContext },
        storage,
      );

      const result = await machineHandler.send(
        { machine: "m1", event: "UNKNOWN_EVENT" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).state).toBe("idle");
    });

    it("nonexistent machine returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await machineHandler.send(
        { machine: "ghost", event: "START" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("non-running machine returns invalid", async () => {
      const storage = createInMemoryStorage();
      // Spawn then destroy, then manually re-create with stopped status
      await machineHandler.spawn(
        { machine: "m1", component: "btn", context: fsmContext },
        storage,
      );
      // Manually patch status to 'stopped' to simulate a non-running machine
      const record = await storage.get("machine", "m1");
      await storage.put("machine", "m1", { ...record!, status: "stopped" });

      const result = await machineHandler.send(
        { machine: "m1", event: "START" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });
  });

  // ── connect ───────────────────────────────────────────────────

  describe("connect", () => {
    it("returns props JSON with state, status, component", async () => {
      const storage = createInMemoryStorage();
      await machineHandler.spawn(
        { machine: "m1", component: "btn-comp", context: fsmContext },
        storage,
      );

      const result = await machineHandler.connect({ machine: "m1" }, storage);
      expect(result.variant).toBe("ok");

      const props = JSON.parse((result as any).props);
      expect(props.state).toBe("idle");
      expect(props.status).toBe("running");
      expect(props.component).toBe("btn-comp");
    });

    it("nonexistent machine returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await machineHandler.connect({ machine: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ── destroy ───────────────────────────────────────────────────

  describe("destroy", () => {
    it("removes machine, subsequent send returns notfound", async () => {
      const storage = createInMemoryStorage();
      await machineHandler.spawn(
        { machine: "m1", component: "btn", context: fsmContext },
        storage,
      );

      const del = await machineHandler.destroy({ machine: "m1" }, storage);
      expect(del.variant).toBe("ok");

      const send = await machineHandler.send(
        { machine: "m1", event: "START" },
        storage,
      );
      expect(send.variant).toBe("notfound");
    });

    it("nonexistent machine returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await machineHandler.destroy({ machine: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ── integration ───────────────────────────────────────────────

  describe("integration", () => {
    it("full FSM lifecycle: spawn -> START -> DONE -> connect -> verify props", async () => {
      const storage = createInMemoryStorage();

      // Spawn
      const spawn = await machineHandler.spawn(
        { machine: "m1", component: "dialog", context: fsmContext },
        storage,
      );
      expect(spawn.variant).toBe("ok");

      // Send START: idle -> loading
      const s1 = await machineHandler.send(
        { machine: "m1", event: "START" },
        storage,
      );
      expect(s1.variant).toBe("ok");
      expect((s1 as any).state).toBe("loading");

      // Send DONE: loading -> complete
      const s2 = await machineHandler.send(
        { machine: "m1", event: "DONE" },
        storage,
      );
      expect(s2.variant).toBe("ok");
      expect((s2 as any).state).toBe("complete");

      // Connect – verify final props
      const conn = await machineHandler.connect({ machine: "m1" }, storage);
      expect(conn.variant).toBe("ok");
      const props = JSON.parse((conn as any).props);
      expect(props.state).toBe("complete");
      expect(props.status).toBe("running");
      expect(props.component).toBe("dialog");
    });

    it("spawn -> send unrecognized event -> state unchanged", async () => {
      const storage = createInMemoryStorage();
      await machineHandler.spawn(
        { machine: "m1", component: "btn", context: fsmContext },
        storage,
      );

      // Send an event that has no transition from 'idle'
      const result = await machineHandler.send(
        { machine: "m1", event: "RESET" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).state).toBe("idle");

      // Double-check via connect
      const conn = await machineHandler.connect({ machine: "m1" }, storage);
      const props = JSON.parse((conn as any).props);
      expect(props.state).toBe("idle");
    });
  });
});
