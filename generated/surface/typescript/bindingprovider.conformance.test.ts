// generated: bindingprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { bindingproviderHandler } from "./bindingprovider.impl";

describe("BindingProvider conformance", () => {

  it("invariant 1: initialize is idempotent and returns consistent pluginRef", async () => {
    const storage = createInMemoryStorage();

    const first = await bindingproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(first.variant).toBe("ok");
    expect((first as any).pluginRef).toBe("surface-provider:binding");

    const second = await bindingproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(second.variant).toBe("ok");
    expect((second as any).provider).toBe((first as any).provider);
    expect((second as any).pluginRef).toBe((first as any).pluginRef);
  });

  it("invariant 2: initialize with invalid config returns configError", async () => {
    const storage = createInMemoryStorage();

    const result = await bindingproviderHandler.initialize(
      { config: null as any },
      storage,
    );
    expect(result.variant).toBe("configError");
    expect((result as any).message).toBeTruthy();
  });

  it("invariant 3: after bind, unbind removes the binding and re-unbind returns notfound", async () => {
    const storage = createInMemoryStorage();

    await bindingproviderHandler.initialize({ config: {} }, storage);

    await bindingproviderHandler.bind(
      { bindingId: "b1", source: "model.name", target: "view.label", direction: "oneWay" },
      storage,
    );

    const unbindResult = await bindingproviderHandler.unbind(
      { bindingId: "b1" },
      storage,
    );
    expect(unbindResult.variant).toBe("ok");

    const reUnbind = await bindingproviderHandler.unbind(
      { bindingId: "b1" },
      storage,
    );
    expect(reUnbind.variant).toBe("notfound");
  });

});
