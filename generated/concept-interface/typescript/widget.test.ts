import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { widgetHandler } from "./widget.impl";

describe("Widget Concept - Behavioral Tests", () => {
  // ── register ──────────────────────────────────────────────────

  describe("register", () => {
    it("creates widget successfully with name/machineSpec/anatomy/a11ySpec", async () => {
      const storage = createInMemoryStorage();
      const result = await widgetHandler.register(
        {
          component: "btn-001",
          name: "Button",
          machineSpec: '{"initial":"idle"}',
          anatomy: '{"parts":["root","label"]}',
          a11ySpec: '{"role":"button"}',
        },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).component).toBe("btn-001");
    });

    it("duplicate name returns duplicate variant", async () => {
      const storage = createInMemoryStorage();
      await widgetHandler.register(
        {
          component: "btn-001",
          name: "Button",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );
      const dup = await widgetHandler.register(
        {
          component: "btn-002",
          name: "Button",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );
      expect(dup.variant).toBe("duplicate");
    });

    it("two different components with different names succeeds", async () => {
      const storage = createInMemoryStorage();
      const r1 = await widgetHandler.register(
        {
          component: "btn-001",
          name: "Button",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );
      const r2 = await widgetHandler.register(
        {
          component: "chk-001",
          name: "Checkbox",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );
      expect(r1.variant).toBe("ok");
      expect(r2.variant).toBe("ok");
    });
  });

  // ── configure ─────────────────────────────────────────────────

  describe("configure", () => {
    it("stores defaultConfig string on widget", async () => {
      const storage = createInMemoryStorage();
      await widgetHandler.register(
        {
          component: "btn-001",
          name: "Button",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );

      const cfg = await widgetHandler.configure(
        { component: "btn-001", config: '{"size":"lg"}' },
        storage,
      );
      expect(cfg.variant).toBe("ok");

      // Verify the config was persisted via a fresh get (storage level)
      const record = await storage.get("widget", "btn-001");
      expect((record as any).defaultConfig).toBe('{"size":"lg"}');
    });

    it("nonexistent widget returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await widgetHandler.configure(
        { component: "ghost", config: "{}" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ── get ───────────────────────────────────────────────────────

  describe("get", () => {
    it("returns machineSpec, anatomy, a11ySpec exactly as stored", async () => {
      const storage = createInMemoryStorage();
      const machineSpec = '{"initial":"idle","states":{}}';
      const anatomy = '{"parts":["root","trigger","content"]}';
      const a11ySpec = '{"role":"dialog","aria-modal":true}';

      await widgetHandler.register(
        {
          component: "dlg-001",
          name: "Dialog",
          machineSpec,
          anatomy,
          a11ySpec,
        },
        storage,
      );

      const result = await widgetHandler.get({ component: "dlg-001" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).machineSpec).toBe(machineSpec);
      expect((result as any).anatomy).toBe(anatomy);
      expect((result as any).a11ySpec).toBe(a11ySpec);
    });

    it("nonexistent widget returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await widgetHandler.get({ component: "nope" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ── list ──────────────────────────────────────────────────────

  describe("list", () => {
    it("returns all components when no category filter", async () => {
      const storage = createInMemoryStorage();
      await widgetHandler.register(
        {
          component: "btn-001",
          name: "Button",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );
      await widgetHandler.register(
        {
          component: "chk-001",
          name: "Checkbox",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );

      const result = await widgetHandler.list({ category: null }, storage);
      expect(result.variant).toBe("ok");
      const components = JSON.parse((result as any).components);
      expect(components).toHaveLength(2);
      expect(components).toContain("btn-001");
      expect(components).toContain("chk-001");
    });

    it("filters by category when provided", async () => {
      const storage = createInMemoryStorage();

      // Register two widgets, then manually set category on one via storage
      await widgetHandler.register(
        {
          component: "btn-001",
          name: "Button",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );
      // Patch category directly in storage
      const record = await storage.get("widget", "btn-001");
      await storage.put("widget", "btn-001", { ...record!, category: "input" });

      await widgetHandler.register(
        {
          component: "dlg-001",
          name: "Dialog",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );

      const result = await widgetHandler.list({ category: "input" }, storage);
      expect(result.variant).toBe("ok");
      const components = JSON.parse((result as any).components);
      expect(components).toHaveLength(1);
      expect(components).toContain("btn-001");
    });

    it("returns empty array when no widgets exist", async () => {
      const storage = createInMemoryStorage();
      const result = await widgetHandler.list({ category: null }, storage);
      expect(result.variant).toBe("ok");
      const components = JSON.parse((result as any).components);
      expect(components).toHaveLength(0);
    });
  });

  // ── unregister ────────────────────────────────────────────────

  describe("unregister", () => {
    it("removes widget, subsequent get returns notfound", async () => {
      const storage = createInMemoryStorage();
      await widgetHandler.register(
        {
          component: "btn-001",
          name: "Button",
          machineSpec: "{}",
          anatomy: "{}",
          a11ySpec: "{}",
        },
        storage,
      );

      const unreg = await widgetHandler.unregister({ component: "btn-001" }, storage);
      expect(unreg.variant).toBe("ok");

      const get = await widgetHandler.get({ component: "btn-001" }, storage);
      expect(get.variant).toBe("notfound");
    });

    it("nonexistent widget returns notfound", async () => {
      const storage = createInMemoryStorage();
      const result = await widgetHandler.unregister({ component: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ── integration ───────────────────────────────────────────────

  describe("integration", () => {
    it("register 3 widgets -> list all -> unregister one -> list all -> verify count decreased", async () => {
      const storage = createInMemoryStorage();

      // Register 3 widgets
      await widgetHandler.register(
        { component: "w1", name: "Widget1", machineSpec: "{}", anatomy: "{}", a11ySpec: "{}" },
        storage,
      );
      await widgetHandler.register(
        { component: "w2", name: "Widget2", machineSpec: "{}", anatomy: "{}", a11ySpec: "{}" },
        storage,
      );
      await widgetHandler.register(
        { component: "w3", name: "Widget3", machineSpec: "{}", anatomy: "{}", a11ySpec: "{}" },
        storage,
      );

      // List all – expect 3
      const listBefore = await widgetHandler.list({ category: null }, storage);
      expect(listBefore.variant).toBe("ok");
      const before = JSON.parse((listBefore as any).components);
      expect(before).toHaveLength(3);

      // Unregister w2
      const unreg = await widgetHandler.unregister({ component: "w2" }, storage);
      expect(unreg.variant).toBe("ok");

      // List all – expect 2
      const listAfter = await widgetHandler.list({ category: null }, storage);
      expect(listAfter.variant).toBe("ok");
      const after = JSON.parse((listAfter as any).components);
      expect(after).toHaveLength(2);
      expect(after).toContain("w1");
      expect(after).toContain("w3");
      expect(after).not.toContain("w2");
    });
  });
});
