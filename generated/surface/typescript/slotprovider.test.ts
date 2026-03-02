import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { slotproviderHandler } from "./slotprovider.impl";

describe("SlotProvider Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // initialize
  // ──────────────────────────────────────────────

  describe("initialize", () => {
    it("initializes successfully with valid config", async () => {
      const storage = createInMemoryStorage();
      const result = await slotproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).provider).toBeTruthy();
      expect((result as any).pluginRef).toBe("surface-provider:slot");
    });

    it("returns configError when config is null", async () => {
      const storage = createInMemoryStorage();
      const result = await slotproviderHandler.initialize(
        { config: null as any },
        storage,
      );
      expect(result.variant).toBe("configError");
    });

    it("is idempotent: second call returns same provider", async () => {
      const storage = createInMemoryStorage();
      const first = await slotproviderHandler.initialize(
        { config: {} },
        storage,
      );
      const second = await slotproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect((first as any).provider).toBe((second as any).provider);
    });
  });

  // ──────────────────────────────────────────────
  // define
  // ──────────────────────────────────────────────

  describe("define", () => {
    it("creates a slot successfully", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      const result = await slotproviderHandler.define(
        { slotId: "s1", name: "header", accepts: ["text", "html"], required: false },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).slotId).toBe("s1");
    });

    it("returns duplicate when slot id already exists", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      await slotproviderHandler.define(
        { slotId: "s1", name: "header", accepts: ["text"], required: false },
        storage,
      );
      const result = await slotproviderHandler.define(
        { slotId: "s1", name: "footer", accepts: ["html"], required: true },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("s1");
    });
  });

  // ──────────────────────────────────────────────
  // fill
  // ──────────────────────────────────────────────

  describe("fill", () => {
    it("fills a slot with accepted content type", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      await slotproviderHandler.define(
        { slotId: "s1", name: "header", accepts: ["text", "html"], required: false },
        storage,
      );
      const result = await slotproviderHandler.fill(
        { slotId: "s1", contentId: "c1", contentType: "text", content: "Hello World" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).slotId).toBe("s1");
      expect((result as any).contentId).toBe("c1");
    });

    it("returns notfound when slot does not exist", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      const result = await slotproviderHandler.fill(
        { slotId: "ghost", contentId: "c1", contentType: "text", content: "data" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("returns rejected when content type is not accepted", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      await slotproviderHandler.define(
        { slotId: "s1", name: "header", accepts: ["text"], required: false },
        storage,
      );
      const result = await slotproviderHandler.fill(
        { slotId: "s1", contentId: "c1", contentType: "image", content: "binary" },
        storage,
      );
      expect(result.variant).toBe("rejected");
      expect((result as any).message).toContain("image");
    });

    it("accepts any content type when accepts array is empty", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      await slotproviderHandler.define(
        { slotId: "s1", name: "wildcard", accepts: [], required: false },
        storage,
      );
      const result = await slotproviderHandler.fill(
        { slotId: "s1", contentId: "c1", contentType: "anything", content: "data" },
        storage,
      );
      expect(result.variant).toBe("ok");
    });
  });

  // ──────────────────────────────────────────────
  // clear
  // ──────────────────────────────────────────────

  describe("clear", () => {
    it("clears the content from a filled slot", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      await slotproviderHandler.define(
        { slotId: "s1", name: "header", accepts: ["text"], required: false },
        storage,
      );
      await slotproviderHandler.fill(
        { slotId: "s1", contentId: "c1", contentType: "text", content: "Hello" },
        storage,
      );
      const result = await slotproviderHandler.clear(
        { slotId: "s1" },
        storage,
      );
      expect(result.variant).toBe("ok");
    });

    it("returns notfound for a nonexistent slot", async () => {
      const storage = createInMemoryStorage();
      const result = await slotproviderHandler.clear(
        { slotId: "ghost" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // getSlots
  // ──────────────────────────────────────────────

  describe("getSlots", () => {
    it("returns an empty list when no slots are defined", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      const result = await slotproviderHandler.getSlots({}, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).slots).toEqual([]);
    });

    it("lists all defined slots with their fill status", async () => {
      const storage = createInMemoryStorage();
      await slotproviderHandler.initialize({ config: {} }, storage);
      await slotproviderHandler.define(
        { slotId: "s1", name: "header", accepts: ["text"], required: true },
        storage,
      );
      await slotproviderHandler.define(
        { slotId: "s2", name: "footer", accepts: ["html"], required: false },
        storage,
      );
      await slotproviderHandler.fill(
        { slotId: "s1", contentId: "c1", contentType: "text", content: "Hi" },
        storage,
      );

      const result = await slotproviderHandler.getSlots({}, storage);
      expect(result.variant).toBe("ok");
      const slots = (result as any).slots as Array<{ slotId: string; filled: boolean }>;
      expect(slots.length).toBe(2);

      const s1 = slots.find((s) => s.slotId === "s1");
      expect(s1?.filled).toBe(true);

      const s2 = slots.find((s) => s.slotId === "s2");
      expect(s2?.filled).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // integration: full lifecycle
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("initialize -> define -> fill -> getSlots -> clear -> getSlots verifies lifecycle", async () => {
      const storage = createInMemoryStorage();

      const initResult = await slotproviderHandler.initialize(
        { config: {} },
        storage,
      );
      expect(initResult.variant).toBe("ok");

      await slotproviderHandler.define(
        { slotId: "main", name: "main-content", accepts: ["text", "component"], required: true },
        storage,
      );

      await slotproviderHandler.fill(
        { slotId: "main", contentId: "page1", contentType: "component", content: { type: "page" } },
        storage,
      );

      const filledSlots = await slotproviderHandler.getSlots({}, storage);
      const mainSlot = (filledSlots as any).slots.find((s: any) => s.slotId === "main");
      expect(mainSlot.filled).toBe(true);
      expect(mainSlot.contentType).toBe("component");

      await slotproviderHandler.clear({ slotId: "main" }, storage);

      const clearedSlots = await slotproviderHandler.getSlots({}, storage);
      const mainCleared = (clearedSlots as any).slots.find((s: any) => s.slotId === "main");
      expect(mainCleared.filled).toBe(false);
      expect(mainCleared.contentType).toBeNull();
    });
  });
});
