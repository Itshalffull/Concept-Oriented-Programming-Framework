// generated: mediaasset.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { mediaassetHandler } from "./mediaasset.impl";

describe("MediaAsset conformance", () => {

  it("invariant 1: after createMedia, extractMetadata, getMedia behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const a = "u-test-invariant-001";
    const s = "u-test-invariant-002";
    const f = "u-test-invariant-003";
    const m = "u-test-invariant-004";

    // --- AFTER clause ---
    // createMedia(asset: a, source: s, file: f) -> ok(asset: a)
    const step1 = await mediaassetHandler.createMedia(
      { asset: a, source: s, file: f },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).asset).toBe(a);

    // --- THEN clause ---
    // extractMetadata(asset: a) -> ok(metadata: m)
    const step2 = await mediaassetHandler.extractMetadata(
      { asset: a },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).metadata).toBe(m);
    // getMedia(asset: a) -> ok(asset: a, metadata: m, thumbnail: _)
    const step3 = await mediaassetHandler.getMedia(
      { asset: a },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).asset).toBe(a);
    expect((step3 as any).metadata).toBe(m);
    expect((step3 as any).thumbnail).toBeDefined();
  });

});
