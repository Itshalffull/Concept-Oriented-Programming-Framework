// generated: viewport.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { viewportHandler } from "./viewport.impl";

describe("Viewport conformance", () => {

  it("invariant 1: after observe, getBreakpoint behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";

    // --- AFTER clause ---
    // observe(viewport: v, width: 1024, height: 768) -> ok(viewport: v, breakpoint: "lg", orientation: "landscape")
    const step1 = await viewportHandler.observe(
      { viewport: v, width: 1024, height: 768 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).viewport).toBe(v);
    expect((step1 as any).breakpoint).toBe("lg");
    expect((step1 as any).orientation).toBe("landscape");

    // --- THEN clause ---
    // getBreakpoint(viewport: v) -> ok(viewport: v, breakpoint: "lg", width: 1024, height: 768)
    const step2 = await viewportHandler.getBreakpoint(
      { viewport: v },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).viewport).toBe(v);
    expect((step2 as any).breakpoint).toBe("lg");
    expect((step2 as any).width).toBe(1024);
    expect((step2 as any).height).toBe(768);
  });

});
