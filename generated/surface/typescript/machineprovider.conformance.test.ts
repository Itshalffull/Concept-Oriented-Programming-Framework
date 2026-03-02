// generated: machineprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { machineproviderHandler } from "./machineprovider.impl";

describe("MachineProvider conformance", () => {

  it("invariant 1: initialize is idempotent and returns consistent pluginRef", async () => {
    const storage = createInMemoryStorage();

    const first = await machineproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(first.variant).toBe("ok");
    expect((first as any).pluginRef).toBe("surface-provider:machine");

    const second = await machineproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(second.variant).toBe("ok");
    expect((second as any).provider).toBe((first as any).provider);
    expect((second as any).pluginRef).toBe((first as any).pluginRef);
  });

  it("invariant 2: initialize with invalid config returns configError", async () => {
    const storage = createInMemoryStorage();

    const result = await machineproviderHandler.initialize(
      { config: null as any },
      storage,
    );
    expect(result.variant).toBe("configError");
    expect((result as any).message).toBeTruthy();
  });

  it("invariant 3: after spawn, send transitions state and destroy removes the machine", async () => {
    const storage = createInMemoryStorage();

    await machineproviderHandler.initialize({ config: {} }, storage);

    const spawnResult = await machineproviderHandler.spawn(
      { machineId: "m1", definition: "toggle", initialState: "off", context: {} },
      storage,
    );
    expect(spawnResult.variant).toBe("ok");
    expect((spawnResult as any).state).toBe("off");

    const sendResult = await machineproviderHandler.send(
      { machineId: "m1", event: "on" },
      storage,
    );
    expect(sendResult.variant).toBe("ok");
    expect((sendResult as any).previousState).toBe("off");
    expect((sendResult as any).currentState).toBe("on");

    const destroyResult = await machineproviderHandler.destroy(
      { machineId: "m1" },
      storage,
    );
    expect(destroyResult.variant).toBe("ok");

    const reSend = await machineproviderHandler.send(
      { machineId: "m1", event: "on" },
      storage,
    );
    expect(reSend.variant).toBe("notfound");
  });

});
