import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { anatomyHandler } from "./anatomy.impl";

describe("Anatomy Concept - Behavioral Tests", () => {
  // ── define ────────────────────────────────────────────────────

  describe("define", () => {
    it("creates anatomy with component/parts/slots", async () => {
      const storage = createInMemoryStorage();
      const result = await anatomyHandler.define(
        {
          anatomy: "anat-btn",
          component: "button",
          parts: '["root","label"]',
          slots: '["icon","badge"]',
        },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).anatomy).toBe("anat-btn");
    });

    it("duplicate component returns duplicate variant", async () => {
      const storage = createInMemoryStorage();
      await anatomyHandler.define(
        {
          anatomy: "anat-btn-1",
          component: "button",
          parts: '["root"]',
          slots: "[]",
        },
        storage,
      );
      const dup = await anatomyHandler.define(
        {
          anatomy: "anat-btn-2",
          component: "button",
          parts: '["root","label"]',
          slots: "[]",
        },
        storage,
      );
      expect(dup.variant).toBe("duplicate");
    });

    it("two anatomies for different components succeed", async () => {
      const storage = createInMemoryStorage();
      const r1 = await anatomyHandler.define(
        { anatomy: "anat-btn", component: "button", parts: '["root"]', slots: "[]" },
        storage,
      );
      const r2 = await anatomyHandler.define(
        { anatomy: "anat-chk", component: "checkbox", parts: '["root","indicator"]', slots: "[]" },
        storage,
      );
      expect(r1.variant).toBe("ok");
      expect(r2.variant).toBe("ok");
    });
  });

  // ── getParts ──────────────────────────────────────────────────

  describe("getParts", () => {
    it("returns stored parts string verbatim", async () => {
      const storage = createInMemoryStorage();
      const partsStr = '["root","trigger","content","overlay"]';
      await anatomyHandler.define(
        { anatomy: "anat-dlg", component: "dialog", parts: partsStr, slots: "[]" },
        storage,
      );

      const result = await anatomyHandler.getParts({ anatomy: "anat-dlg" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).parts).toBe(partsStr);
    });

    it("nonexistent anatomy returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await anatomyHandler.getParts({ anatomy: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ── getSlots ──────────────────────────────────────────────────

  describe("getSlots", () => {
    it("returns stored slots string verbatim", async () => {
      const storage = createInMemoryStorage();
      const slotsStr = '["header","body","footer"]';
      await anatomyHandler.define(
        { anatomy: "anat-card", component: "card", parts: '["root"]', slots: slotsStr },
        storage,
      );

      const result = await anatomyHandler.getSlots({ anatomy: "anat-card" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).slots).toBe(slotsStr);
    });

    it("nonexistent anatomy returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await anatomyHandler.getSlots({ anatomy: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ── extend ────────────────────────────────────────────────────

  describe("extend", () => {
    it("adds new parts without duplicating existing ones", async () => {
      const storage = createInMemoryStorage();
      await anatomyHandler.define(
        { anatomy: "anat-btn", component: "button", parts: '["root","label"]', slots: "[]" },
        storage,
      );

      const ext = await anatomyHandler.extend(
        { anatomy: "anat-btn", additionalParts: '["icon","badge"]' },
        storage,
      );
      expect(ext.variant).toBe("ok");

      const get = await anatomyHandler.getParts({ anatomy: "anat-btn" }, storage);
      const parts = JSON.parse((get as any).parts);
      expect(parts).toEqual(["root", "label", "icon", "badge"]);
    });

    it("nonexistent anatomy returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await anatomyHandler.extend(
        { anatomy: "ghost", additionalParts: '["x"]' },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });

    it("adding parts that already exist doesn't duplicate them", async () => {
      const storage = createInMemoryStorage();
      await anatomyHandler.define(
        { anatomy: "anat-btn", component: "button", parts: '["root","label"]', slots: "[]" },
        storage,
      );

      await anatomyHandler.extend(
        { anatomy: "anat-btn", additionalParts: '["root","label","icon"]' },
        storage,
      );

      const get = await anatomyHandler.getParts({ anatomy: "anat-btn" }, storage);
      const parts = JSON.parse((get as any).parts);
      expect(parts).toEqual(["root", "label", "icon"]);
      // Exactly 3 items – root and label not duplicated
      expect(parts).toHaveLength(3);
    });

    it("invalid JSON additionalParts treated as empty array (no crash)", async () => {
      const storage = createInMemoryStorage();
      await anatomyHandler.define(
        { anatomy: "anat-btn", component: "button", parts: '["root"]', slots: "[]" },
        storage,
      );

      const result = await anatomyHandler.extend(
        { anatomy: "anat-btn", additionalParts: "<<<not-json>>>" },
        storage,
      );
      expect(result.variant).toBe("ok");

      // Parts should remain unchanged since bad JSON yields empty array
      const get = await anatomyHandler.getParts({ anatomy: "anat-btn" }, storage);
      const parts = JSON.parse((get as any).parts);
      expect(parts).toEqual(["root"]);
    });
  });

  // ── integration ───────────────────────────────────────────────

  describe("integration", () => {
    it("define -> extend with overlap -> getParts -> verify deduplication", async () => {
      const storage = createInMemoryStorage();

      // Define anatomy with ["root", "content"]
      await anatomyHandler.define(
        {
          anatomy: "anat-panel",
          component: "panel",
          parts: '["root","content"]',
          slots: '["main"]',
        },
        storage,
      );

      // Extend with ["header", "root", "footer"] – "root" already exists
      await anatomyHandler.extend(
        { anatomy: "anat-panel", additionalParts: '["header","root","footer"]' },
        storage,
      );

      // getParts should show ["root", "content", "header", "footer"]
      const result = await anatomyHandler.getParts({ anatomy: "anat-panel" }, storage);
      expect(result.variant).toBe("ok");
      const parts = JSON.parse((result as any).parts);
      expect(parts).toEqual(["root", "content", "header", "footer"]);
      expect(parts).toHaveLength(4);
    });
  });
});
