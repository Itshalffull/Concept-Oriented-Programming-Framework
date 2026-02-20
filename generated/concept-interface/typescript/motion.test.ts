import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { motionHandler } from "./motion.impl";

describe("Motion Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // defineDuration
  // ──────────────────────────────────────────────

  describe("defineDuration", () => {
    it("stores a valid duration (200ms) and returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineDuration(
        { motion: "d1", name: "normal", ms: 200 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).motion).toBe("d1");

      const record = await storage.get("motion", "d1");
      expect(record).toBeDefined();
      expect(record!.value).toBe("200");
      expect(record!.reducedMotion).toBe("false");
    });

    it("stores zero duration and marks reducedMotion='true'", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineDuration(
        { motion: "d2", name: "instant", ms: 0 },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("motion", "d2");
      expect(record).toBeDefined();
      expect(record!.value).toBe("0");
      expect(record!.reducedMotion).toBe("true");
    });

    it("returns invalid for negative duration", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineDuration(
        { motion: "d3", name: "bad", ms: -100 },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("-100");
    });

    it("stores a large duration (5000ms) with reducedMotion='false'", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineDuration(
        { motion: "d4", name: "slow", ms: 5000 },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("motion", "d4");
      expect(record).toBeDefined();
      expect(record!.value).toBe("5000");
      expect(record!.reducedMotion).toBe("false");
    });
  });

  // ──────────────────────────────────────────────
  // defineEasing
  // ──────────────────────────────────────────────

  describe("defineEasing", () => {
    it("stores a valid easing value and returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineEasing(
        { motion: "e1", name: "ease-out", value: "ease-out" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).motion).toBe("e1");

      const record = await storage.get("motion", "e1");
      expect(record).toBeDefined();
      expect(record!.value).toBe("ease-out");
      expect(record!.kind).toBe("easing");
    });

    it("returns invalid for an empty string", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineEasing(
        { motion: "e2", name: "empty", value: "" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("empty");
    });

    it("returns invalid for a whitespace-only string", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineEasing(
        { motion: "e3", name: "spaces", value: "   " },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("accepts a CSS cubic-bezier value", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineEasing(
        { motion: "e4", name: "custom-curve", value: "cubic-bezier(0.4, 0, 0.2, 1)" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("motion", "e4");
      expect(record).toBeDefined();
      expect(record!.value).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    });
  });

  // ──────────────────────────────────────────────
  // defineTransition
  // ──────────────────────────────────────────────

  describe("defineTransition", () => {
    it("stores a valid transition config and returns ok", async () => {
      const storage = createInMemoryStorage();
      const config = JSON.stringify({
        property: "opacity",
        durationMs: 200,
        easingValue: "ease-out",
      });
      const result = await motionHandler.defineTransition(
        { motion: "tr1", name: "fade", config },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).motion).toBe("tr1");

      const record = await storage.get("motion", "tr1");
      expect(record).toBeDefined();
      expect(record!.kind).toBe("transition");
    });

    it("returns invalid for non-JSON config", async () => {
      const storage = createInMemoryStorage();
      const result = await motionHandler.defineTransition(
        { motion: "tr2", name: "broken", config: "not valid json" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("Invalid config JSON");
    });

    it("succeeds when config references an existing duration by name", async () => {
      const storage = createInMemoryStorage();
      // First define a duration named "normal"
      await motionHandler.defineDuration(
        { motion: "d1", name: "normal", ms: 200 },
        storage,
      );

      const config = JSON.stringify({
        duration: "normal",
        property: "transform",
      });
      const result = await motionHandler.defineTransition(
        { motion: "tr3", name: "slide", config },
        storage,
      );
      expect(result.variant).toBe("ok");
    });

    it("returns invalid when config references a nonexistent duration by name", async () => {
      const storage = createInMemoryStorage();
      const config = JSON.stringify({
        duration: "nonexistent",
        property: "opacity",
      });
      const result = await motionHandler.defineTransition(
        { motion: "tr4", name: "ghost-ref", config },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("nonexistent");
    });

    it("succeeds when config has no duration field (no validation needed)", async () => {
      const storage = createInMemoryStorage();
      const config = JSON.stringify({
        property: "color",
        easingValue: "linear",
      });
      const result = await motionHandler.defineTransition(
        { motion: "tr5", name: "color-change", config },
        storage,
      );
      expect(result.variant).toBe("ok");
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("defineDuration -> defineEasing -> defineTransition referencing duration -> all ok", async () => {
      const storage = createInMemoryStorage();

      // Step 1: define duration "normal" at 200ms
      const durationResult = await motionHandler.defineDuration(
        { motion: "dur-normal", name: "normal", ms: 200 },
        storage,
      );
      expect(durationResult.variant).toBe("ok");

      // Step 2: define easing "ease-out"
      const easingResult = await motionHandler.defineEasing(
        { motion: "ease-out", name: "ease-out", value: "cubic-bezier(0, 0, 0.2, 1)" },
        storage,
      );
      expect(easingResult.variant).toBe("ok");

      // Step 3: define transition referencing "normal" duration
      const transConfig = JSON.stringify({
        duration: "normal",
        easing: "ease-out",
        property: "all",
      });
      const transResult = await motionHandler.defineTransition(
        { motion: "tr-default", name: "default-transition", config: transConfig },
        storage,
      );
      expect(transResult.variant).toBe("ok");

      // Verify all entries are stored
      const durRecord = await storage.get("motion", "dur-normal");
      expect(durRecord).toBeDefined();
      expect(durRecord!.kind).toBe("duration");

      const easeRecord = await storage.get("motion", "ease-out");
      expect(easeRecord).toBeDefined();
      expect(easeRecord!.kind).toBe("easing");

      const transRecord = await storage.get("motion", "tr-default");
      expect(transRecord).toBeDefined();
      expect(transRecord!.kind).toBe("transition");
    });
  });
});
