// generated: viewportprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { viewportproviderHandler } from "./viewportprovider.impl";

describe("ViewportProvider conformance", () => {

  it("invariant 1: initialize is idempotent and returns consistent pluginRef", async () => {
    const storage = createInMemoryStorage();

    const first = await viewportproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(first.variant).toBe("ok");
    expect((first as any).pluginRef).toBe("surface-provider:viewport");

    const second = await viewportproviderHandler.initialize(
      { config: {} },
      storage,
    );
    expect(second.variant).toBe("ok");
    expect((second as any).provider).toBe((first as any).provider);
    expect((second as any).pluginRef).toBe((first as any).pluginRef);
  });

  it("invariant 2: initialize with invalid config returns configError", async () => {
    const storage = createInMemoryStorage();

    const result = await viewportproviderHandler.initialize(
      { config: null as any },
      storage,
    );
    expect(result.variant).toBe("configError");
    expect((result as any).message).toBeTruthy();
  });

  it("invariant 3: after initialize, getBreakpoint returns a valid breakpoint for any width", async () => {
    const storage = createInMemoryStorage();

    await viewportproviderHandler.initialize({ config: {} }, storage);

    const result = await viewportproviderHandler.getBreakpoint(
      { width: 800 },
      storage,
    );
    expect(result.variant).toBe("ok");
    expect((result as any).breakpoint).toBeTruthy();
  });

});
