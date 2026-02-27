// generated: telemetry.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { telemetryHandler } from "./telemetry.impl";

describe("Telemetry conformance", () => {

  it("invariant 1: after configure, deployMarker behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let t = "u-test-invariant-001";
    let m = "u-test-invariant-002";

    // --- AFTER clause ---
    // configure(concept: "User", endpoint: "http://otel:4317", samplingRate: 0.5) -> ok(config: t)
    const step1 = await telemetryHandler.configure(
      { concept: "User", endpoint: "http://otel:4317", samplingRate: 0.5 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    t = (step1 as any).config;

    // --- THEN clause ---
    // deployMarker(kit: "auth", version: "1.0.0", environment: "staging", status: "started") -> ok(marker: m)
    const step2 = await telemetryHandler.deployMarker(
      { kit: "auth", version: "1.0.0", environment: "staging", status: "started" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    m = (step2 as any).marker;
  });

});
