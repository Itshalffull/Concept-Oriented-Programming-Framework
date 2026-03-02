import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { machineproviderHandler } from "./machineprovider.impl";

describe("MachineProvider Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // initialize
  // ──────────────────────────────────────────────

  describe("initialize", () => {
    it("initializes successfully with valid config", async () => {
      const storage = createInMemoryStorage();
      const result = await machineproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).provider).toBeTruthy();
      expect((result as any).pluginRef).toBe("surface-provider:machine");
    });

    it("returns configError when config is null", async () => {
      const storage = createInMemoryStorage();
      const result = await machineproviderHandler.initialize(
        { config: null as any },
        storage,
      );
      expect(result.variant).toBe("configError");
    });

    it("is idempotent: second call returns same provider", async () => {
      const storage = createInMemoryStorage();
      const first = await machineproviderHandler.initialize(
        { config: {} },
        storage,
      );
      const second = await machineproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect((first as any).provider).toBe((second as any).provider);
    });
  });

  // ──────────────────────────────────────────────
  // spawn
  // ──────────────────────────────────────────────

  describe("spawn", () => {
    it("creates a machine with initial state", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      const result = await machineproviderHandler.spawn(
        { machineId: "m1", definition: "toggle", initialState: "off" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).machineId).toBe("m1");
      expect((result as any).state).toBe("off");
    });

    it("returns duplicate when machine id already exists", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "toggle", initialState: "off" },
        storage,
      );
      const result = await machineproviderHandler.spawn(
        { machineId: "m1", definition: "toggle", initialState: "off" },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("m1");
    });

    it("returns invalid when required fields are missing", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      const result = await machineproviderHandler.spawn(
        { machineId: "", definition: "toggle", initialState: "off" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("accepts optional context", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      const result = await machineproviderHandler.spawn(
        { machineId: "m1", definition: "counter", initialState: "idle", context: { count: 0 } },
        storage,
      );
      expect(result.variant).toBe("ok");
    });
  });

  // ──────────────────────────────────────────────
  // send
  // ──────────────────────────────────────────────

  describe("send", () => {
    it("transitions machine state on valid event", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "toggle", initialState: "off" },
        storage,
      );
      const result = await machineproviderHandler.send(
        { machineId: "m1", event: "on" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).previousState).toBe("off");
      expect((result as any).currentState).toBe("on");
    });

    it("returns notfound for a nonexistent machine", async () => {
      const storage = createInMemoryStorage();
      const result = await machineproviderHandler.send(
        { machineId: "ghost", event: "toggle" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("returns rejected for internal events starting with __", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "toggle", initialState: "off" },
        storage,
      );
      const result = await machineproviderHandler.send(
        { machineId: "m1", event: "__internal" },
        storage,
      );
      expect(result.variant).toBe("rejected");
    });

    it("merges payload into machine context", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "counter", initialState: "idle", context: { count: 0 } },
        storage,
      );
      const result = await machineproviderHandler.send(
        { machineId: "m1", event: "counting", payload: { count: 1 } },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).currentState).toBe("counting");
    });
  });

  // ──────────────────────────────────────────────
  // connect
  // ──────────────────────────────────────────────

  describe("connect", () => {
    it("creates a connection between two machines", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "producer", initialState: "idle" },
        storage,
      );
      await machineproviderHandler.spawn(
        { machineId: "m2", definition: "consumer", initialState: "waiting" },
        storage,
      );
      const result = await machineproviderHandler.connect(
        { sourceMachineId: "m1", targetMachineId: "m2", event: "dataReady" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).connectionId).toBeTruthy();
    });

    it("returns notfound when source machine does not exist", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m2", definition: "consumer", initialState: "waiting" },
        storage,
      );
      const result = await machineproviderHandler.connect(
        { sourceMachineId: "ghost", targetMachineId: "m2", event: "test" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("ghost");
    });

    it("returns notfound when target machine does not exist", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "producer", initialState: "idle" },
        storage,
      );
      const result = await machineproviderHandler.connect(
        { sourceMachineId: "m1", targetMachineId: "ghost", event: "test" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("ghost");
    });

    it("returns duplicate for an existing connection", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "producer", initialState: "idle" },
        storage,
      );
      await machineproviderHandler.spawn(
        { machineId: "m2", definition: "consumer", initialState: "waiting" },
        storage,
      );
      await machineproviderHandler.connect(
        { sourceMachineId: "m1", targetMachineId: "m2", event: "dataReady" },
        storage,
      );
      const result = await machineproviderHandler.connect(
        { sourceMachineId: "m1", targetMachineId: "m2", event: "dataReady" },
        storage,
      );
      expect(result.variant).toBe("duplicate");
    });
  });

  // ──────────────────────────────────────────────
  // destroy
  // ──────────────────────────────────────────────

  describe("destroy", () => {
    it("removes a machine and subsequent send returns notfound", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "toggle", initialState: "off" },
        storage,
      );
      const result = await machineproviderHandler.destroy(
        { machineId: "m1" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).machineId).toBe("m1");

      const sendResult = await machineproviderHandler.send(
        { machineId: "m1", event: "on" },
        storage,
      );
      expect(sendResult.variant).toBe("notfound");
    });

    it("returns notfound for a nonexistent machine", async () => {
      const storage = createInMemoryStorage();
      const result = await machineproviderHandler.destroy(
        { machineId: "ghost" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("cleans up connections when a machine is destroyed", async () => {
      const storage = createInMemoryStorage();
      await machineproviderHandler.initialize({ config: {} }, storage);
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "producer", initialState: "idle" },
        storage,
      );
      await machineproviderHandler.spawn(
        { machineId: "m2", definition: "consumer", initialState: "waiting" },
        storage,
      );
      await machineproviderHandler.connect(
        { sourceMachineId: "m1", targetMachineId: "m2", event: "dataReady" },
        storage,
      );

      // Destroy source machine
      await machineproviderHandler.destroy({ machineId: "m1" }, storage);

      // Re-create m1 and try to connect again — should succeed (old connection cleaned up)
      await machineproviderHandler.spawn(
        { machineId: "m1", definition: "producer", initialState: "idle" },
        storage,
      );
      const reconnect = await machineproviderHandler.connect(
        { sourceMachineId: "m1", targetMachineId: "m2", event: "dataReady" },
        storage,
      );
      expect(reconnect.variant).toBe("ok");
    });
  });

  // ──────────────────────────────────────────────
  // integration: full lifecycle
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("initialize -> spawn -> send -> connect -> destroy full lifecycle", async () => {
      const storage = createInMemoryStorage();

      const initResult = await machineproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(initResult.variant).toBe("ok");

      // Spawn two machines
      const spawn1 = await machineproviderHandler.spawn(
        { machineId: "auth", definition: "auth-flow", initialState: "unauthenticated" },
        storage,
      );
      expect(spawn1.variant).toBe("ok");

      const spawn2 = await machineproviderHandler.spawn(
        { machineId: "ui", definition: "ui-flow", initialState: "login-screen" },
        storage,
      );
      expect(spawn2.variant).toBe("ok");

      // Connect auth -> ui on "authenticated" event
      const connectResult = await machineproviderHandler.connect(
        { sourceMachineId: "auth", targetMachineId: "ui", event: "authenticated" },
        storage,
      );
      expect(connectResult.variant).toBe("ok");

      // Send event to auth machine
      const sendResult = await machineproviderHandler.send(
        { machineId: "auth", event: "authenticated", payload: { userId: "u-1" } },
        storage,
      );
      expect(sendResult.variant).toBe("ok");
      expect((sendResult as any).currentState).toBe("authenticated");

      // Destroy both machines
      const destroy1 = await machineproviderHandler.destroy(
        { machineId: "auth" },
        storage,
      );
      expect(destroy1.variant).toBe("ok");

      const destroy2 = await machineproviderHandler.destroy(
        { machineId: "ui" },
        storage,
      );
      expect(destroy2.variant).toBe("ok");
    });
  });
});
