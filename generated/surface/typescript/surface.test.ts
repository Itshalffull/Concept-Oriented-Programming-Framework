import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { surfaceHandler } from "./surface.impl";

describe("Surface Concept", () => {
  // ---------------------------------------------------------------
  // create
  // ---------------------------------------------------------------

  describe("create", () => {
    it("browser-dom returns ok with interactive capabilities", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.create(
        { surface: "s-1", kind: "browser-dom", mountPoint: "#app" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).surface).toBe("s-1");

      const record = await storage.get("surface", "s-1");
      const caps = JSON.parse(record!.capabilities as string);
      expect(caps).toEqual(["interactive", "mouse", "keyboard", "touch", "resize", "animation"]);
    });

    it("terminal returns ok with text-oriented capabilities", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.create(
        { surface: "s-term", kind: "terminal", mountPoint: null },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("surface", "s-term");
      const caps = JSON.parse(record!.capabilities as string);
      expect(caps).toEqual(["interactive", "keyboard", "resize", "text-only"]);
    });

    it("ssr returns ok with static and streaming capabilities", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.create(
        { surface: "s-ssr", kind: "ssr", mountPoint: null },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("surface", "s-ssr");
      const caps = JSON.parse(record!.capabilities as string);
      expect(caps).toEqual(["static", "streaming"]);
    });

    it("static-html returns ok with static-only capability", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.create(
        { surface: "s-html", kind: "static-html", mountPoint: null },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("surface", "s-html");
      const caps = JSON.parse(record!.capabilities as string);
      expect(caps).toEqual(["static"]);
    });

    it("react-native returns ok with touch/gesture capabilities", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.create(
        { surface: "s-rn", kind: "react-native", mountPoint: null },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("surface", "s-rn");
      const caps = JSON.parse(record!.capabilities as string);
      expect(caps).toEqual(["interactive", "touch", "gesture", "resize", "animation"]);
    });

    it("webview returns ok with web-like capabilities without animation", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.create(
        { surface: "s-wv", kind: "webview", mountPoint: null },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("surface", "s-wv");
      const caps = JSON.parse(record!.capabilities as string);
      expect(caps).toEqual(["interactive", "mouse", "keyboard", "touch", "resize"]);
    });

    it("returns unsupported for an invalid surface kind", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.create(
        { surface: "s-bad", kind: "canvas-3d", mountPoint: null },
        storage,
      );
      expect(result.variant).toBe("unsupported");
      expect((result as any).message).toContain("canvas-3d");
    });
  });

  // ---------------------------------------------------------------
  // attach
  // ---------------------------------------------------------------

  describe("attach", () => {
    it("attaches a renderer and sets status to attached", async () => {
      const storage = createInMemoryStorage();
      await surfaceHandler.create(
        { surface: "s-1", kind: "browser-dom", mountPoint: "#app" },
        storage,
      );

      const result = await surfaceHandler.attach(
        { surface: "s-1", renderer: "r-react" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).surface).toBe("s-1");

      const record = await storage.get("surface", "s-1");
      expect(record!.renderer).toBe("r-react");
      expect(record!.status).toBe("attached");
    });

    it("returns incompatible for a nonexistent surface", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.attach(
        { surface: "s-missing", renderer: "r-react" },
        storage,
      );
      expect(result.variant).toBe("incompatible");
      expect((result as any).message).toContain("s-missing");
    });
  });

  // ---------------------------------------------------------------
  // resize
  // ---------------------------------------------------------------

  describe("resize", () => {
    it("updates width and height on an existing surface", async () => {
      const storage = createInMemoryStorage();
      await surfaceHandler.create(
        { surface: "s-1", kind: "browser-dom", mountPoint: "#app" },
        storage,
      );

      const result = await surfaceHandler.resize(
        { surface: "s-1", width: 1920, height: 1080 },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("surface", "s-1");
      expect(record!.width).toBe(1920);
      expect(record!.height).toBe(1080);
    });

    it("returns notfound for a nonexistent surface", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.resize(
        { surface: "s-missing", width: 800, height: 600 },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("s-missing");
    });
  });

  // ---------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------

  describe("destroy", () => {
    it("removes a surface so subsequent operations fail", async () => {
      const storage = createInMemoryStorage();
      await surfaceHandler.create(
        { surface: "s-1", kind: "terminal", mountPoint: null },
        storage,
      );

      const result = await surfaceHandler.destroy({ surface: "s-1" }, storage);
      expect(result.variant).toBe("ok");

      // Subsequent attach should fail
      const attachResult = await surfaceHandler.attach(
        { surface: "s-1", renderer: "r-1" },
        storage,
      );
      expect(attachResult.variant).toBe("incompatible");

      // Subsequent resize should fail
      const resizeResult = await surfaceHandler.resize(
        { surface: "s-1", width: 100, height: 100 },
        storage,
      );
      expect(resizeResult.variant).toBe("notfound");

      // Subsequent destroy should fail
      const destroyAgain = await surfaceHandler.destroy({ surface: "s-1" }, storage);
      expect(destroyAgain.variant).toBe("notfound");
    });

    it("returns notfound for a nonexistent surface", async () => {
      const storage = createInMemoryStorage();
      const result = await surfaceHandler.destroy({ surface: "s-missing" }, storage);
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("s-missing");
    });
  });

  // ---------------------------------------------------------------
  // integration
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("create browser-dom -> attach renderer -> resize to 1920x1080 -> destroy", async () => {
      const storage = createInMemoryStorage();

      // Step 1: create
      const createResult = await surfaceHandler.create(
        { surface: "s-main", kind: "browser-dom", mountPoint: "#root" },
        storage,
      );
      expect(createResult.variant).toBe("ok");

      let record = await storage.get("surface", "s-main");
      expect(record!.status).toBe("created");
      expect(record!.width).toBe(0);
      expect(record!.height).toBe(0);

      // Step 2: attach
      const attachResult = await surfaceHandler.attach(
        { surface: "s-main", renderer: "r-react" },
        storage,
      );
      expect(attachResult.variant).toBe("ok");

      record = await storage.get("surface", "s-main");
      expect(record!.status).toBe("attached");
      expect(record!.renderer).toBe("r-react");

      // Step 3: resize
      const resizeResult = await surfaceHandler.resize(
        { surface: "s-main", width: 1920, height: 1080 },
        storage,
      );
      expect(resizeResult.variant).toBe("ok");

      record = await storage.get("surface", "s-main");
      expect(record!.width).toBe(1920);
      expect(record!.height).toBe(1080);

      // Step 4: destroy
      const destroyResult = await surfaceHandler.destroy(
        { surface: "s-main" },
        storage,
      );
      expect(destroyResult.variant).toBe("ok");

      // Verify removed
      const gone = await storage.get("surface", "s-main");
      expect(gone).toBeNull();
    });
  });
});
