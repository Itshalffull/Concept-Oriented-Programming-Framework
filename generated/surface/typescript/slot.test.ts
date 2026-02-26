import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { slotHandler } from "./slot.impl";

describe("Slot Concept - Behavioral Tests", () => {
  // ── define ────────────────────────────────────────────────────

  describe("define", () => {
    it("creates slot with name and component", async () => {
      const storage = createInMemoryStorage();
      const result = await slotHandler.define(
        { slot: "s1", name: "header", component: "card" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).slot).toBe("s1");

      // Verify stored defaults
      const record = await storage.get("slot", "s1");
      expect((record as any).name).toBe("header");
      expect((record as any).component).toBe("card");
      expect((record as any).defaultContent).toBe("");
      expect((record as any).filled).toBe(false);
    });

    it("missing name returns invalid", async () => {
      const storage = createInMemoryStorage();
      const result = await slotHandler.define(
        { slot: "s1", name: "", component: "card" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("missing component returns invalid", async () => {
      const storage = createInMemoryStorage();
      const result = await slotHandler.define(
        { slot: "s1", name: "header", component: "" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });
  });

  // ── fill ──────────────────────────────────────────────────────

  describe("fill", () => {
    it("sets content and marks filled=true", async () => {
      const storage = createInMemoryStorage();
      await slotHandler.define(
        { slot: "s1", name: "header", component: "card" },
        storage,
      );

      const result = await slotHandler.fill(
        { slot: "s1", content: "<h1>Title</h1>" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("<h1>Title</h1>");
      expect((record as any).filled).toBe(true);
    });

    it("nonexistent slot returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await slotHandler.fill(
        { slot: "ghost", content: "x" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("empty string content still marks filled=true", async () => {
      const storage = createInMemoryStorage();
      await slotHandler.define(
        { slot: "s1", name: "header", component: "card" },
        storage,
      );

      await slotHandler.fill({ slot: "s1", content: "" }, storage);

      const record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("");
      expect((record as any).filled).toBe(true);
    });
  });

  // ── setDefault ────────────────────────────────────────────────

  describe("setDefault", () => {
    it("sets defaultContent without changing filled status", async () => {
      const storage = createInMemoryStorage();
      await slotHandler.define(
        { slot: "s1", name: "header", component: "card" },
        storage,
      );

      // filled starts as false
      const result = await slotHandler.setDefault(
        { slot: "s1", defaultContent: "Default Header" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("Default Header");
      expect((record as any).filled).toBe(false); // unchanged
    });

    it("nonexistent slot returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await slotHandler.setDefault(
        { slot: "ghost", defaultContent: "x" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ── clear ─────────────────────────────────────────────────────

  describe("clear", () => {
    it("resets defaultContent to empty and filled to false", async () => {
      const storage = createInMemoryStorage();
      await slotHandler.define(
        { slot: "s1", name: "header", component: "card" },
        storage,
      );
      await slotHandler.fill({ slot: "s1", content: "Filled!" }, storage);

      const clr = await slotHandler.clear({ slot: "s1" }, storage);
      expect(clr.variant).toBe("ok");

      const record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("");
      expect((record as any).filled).toBe(false);
    });

    it("nonexistent slot returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await slotHandler.clear({ slot: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ── integration ───────────────────────────────────────────────

  describe("integration", () => {
    it("define -> fill with 'Hello' -> clear -> verify empty and not filled", async () => {
      const storage = createInMemoryStorage();

      // Define
      const def = await slotHandler.define(
        { slot: "s1", name: "content", component: "panel" },
        storage,
      );
      expect(def.variant).toBe("ok");

      // Fill
      const fill = await slotHandler.fill(
        { slot: "s1", content: "Hello" },
        storage,
      );
      expect(fill.variant).toBe("ok");

      // Verify filled state
      let record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("Hello");
      expect((record as any).filled).toBe(true);

      // Clear
      const clr = await slotHandler.clear({ slot: "s1" }, storage);
      expect(clr.variant).toBe("ok");

      // Verify cleared state
      record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("");
      expect((record as any).filled).toBe(false);
    });

    it("define -> setDefault -> fill -> clear -> verify state transitions", async () => {
      const storage = createInMemoryStorage();

      // Step 1: Define
      await slotHandler.define(
        { slot: "s1", name: "footer", component: "card" },
        storage,
      );
      let record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("");
      expect((record as any).filled).toBe(false);

      // Step 2: setDefault – sets content but filled stays false
      await slotHandler.setDefault(
        { slot: "s1", defaultContent: "Copyright 2026" },
        storage,
      );
      record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("Copyright 2026");
      expect((record as any).filled).toBe(false);

      // Step 3: fill – overwrites content and sets filled=true
      await slotHandler.fill(
        { slot: "s1", content: "Custom Footer" },
        storage,
      );
      record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("Custom Footer");
      expect((record as any).filled).toBe(true);

      // Step 4: clear – resets everything
      await slotHandler.clear({ slot: "s1" }, storage);
      record = await storage.get("slot", "s1");
      expect((record as any).defaultContent).toBe("");
      expect((record as any).filled).toBe(false);
    });
  });
});
