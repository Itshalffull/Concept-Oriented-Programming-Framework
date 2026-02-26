// generated: mediaasset.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { mediaassetHandler } from "./mediaasset.impl";

describe("MediaAsset conformance", () => {

  it("invariant 1: after createMedia, extractMetadata, getMedia behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let a = "u-test-invariant-001";
    let s = "u-test-invariant-002";
    let f = "u-test-invariant-003";
    let m = "u-test-invariant-004";

    // --- AFTER clause ---
    // createMedia(asset: a, source: s, file: f) -> ok(asset: a)
    const step1 = await mediaassetHandler.createMedia(
      { asset: a, source: s, file: f },
      storage,
    );
    expect(step1.variant).toBe("ok");
    a = (step1 as any).asset;

    // --- THEN clause ---
    // extractMetadata(asset: a) -> ok(metadata: m)
    const step2 = await mediaassetHandler.extractMetadata(
      { asset: a },
      storage,
    );
    expect(step2.variant).toBe("ok");
    m = (step2 as any).metadata;
    // getMedia(asset: a) -> ok(asset: a, metadata: m, thumbnail: _)
    const step3 = await mediaassetHandler.getMedia(
      { asset: a },
      storage,
    );
    expect(step3.variant).toBe("ok");
    a = (step3 as any).asset;
    expect((step3 as any).metadata).toBe(m);
    expect((step3 as any).thumbnail).toBeDefined();
  });

});
