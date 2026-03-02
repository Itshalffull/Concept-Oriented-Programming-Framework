// generated: designtokenprovider.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { designtokenproviderHandler } from "./designtokenprovider.impl";

describe("DesignTokenProvider conformance", () => {

  it("invariant 1: initialize is idempotent and returns consistent pluginRef", async () => {
    const storage = createInMemoryStorage();

    const first = await designtokenproviderHandler.initialize(
      { config: { defaultTheme: "light" } },
      storage,
    );
    expect(first.variant).toBe("ok");
    expect((first as any).pluginRef).toBe("surface-provider:design-token");

    const second = await designtokenproviderHandler.initialize(
      { config: { defaultTheme: "light" } },
      storage,
    );
    expect(second.variant).toBe("ok");
    expect((second as any).provider).toBe((first as any).provider);
    expect((second as any).pluginRef).toBe((first as any).pluginRef);
  });

  it("invariant 2: initialize with invalid config returns configError", async () => {
    const storage = createInMemoryStorage();

    const result = await designtokenproviderHandler.initialize(
      { config: null as any },
      storage,
    );
    expect(result.variant).toBe("configError");
    expect((result as any).message).toBeTruthy();
  });

  it("invariant 3: export returns unsupported for unknown format", async () => {
    const storage = createInMemoryStorage();

    await designtokenproviderHandler.initialize(
      { config: {} },
      storage,
    );

    const result = await designtokenproviderHandler.export(
      { format: "yaml" },
      storage,
    );
    expect(result.variant).toBe("unsupported");
    expect((result as any).message).toContain("yaml");
  });

});
