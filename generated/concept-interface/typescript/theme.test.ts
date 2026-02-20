import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { themeHandler } from "./theme.impl";

describe("Theme Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────

  describe("create", () => {
    it("creates a theme with name and overrides, returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await themeHandler.create(
        { theme: "t1", name: "light", overrides: '{"bg": "white", "fg": "black"}' },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).theme).toBe("t1");
    });

    it("returns duplicate when a theme with the same name already exists", async () => {
      const storage = createInMemoryStorage();
      await themeHandler.create(
        { theme: "t1", name: "light", overrides: '{"bg": "white"}' },
        storage,
      );
      const result = await themeHandler.create(
        { theme: "t2", name: "light", overrides: '{"bg": "ivory"}' },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("light");
    });
  });

  // ──────────────────────────────────────────────
  // extend
  // ──────────────────────────────────────────────

  describe("extend", () => {
    it("extends a base theme with new overrides", async () => {
      const storage = createInMemoryStorage();
      await themeHandler.create(
        { theme: "base", name: "light", overrides: '{"bg": "white"}' },
        storage,
      );
      const result = await themeHandler.extend(
        { theme: "child", base: "base", overrides: '{"fg": "black"}' },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).theme).toBe("child");
    });

    it("returns notfound when the base theme does not exist", async () => {
      const storage = createInMemoryStorage();
      const result = await themeHandler.extend(
        { theme: "child", base: "nonexistent", overrides: '{"fg": "black"}' },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("nonexistent");
    });
  });

  // ──────────────────────────────────────────────
  // activate
  // ──────────────────────────────────────────────

  describe("activate", () => {
    it("sets active=true with a priority number", async () => {
      const storage = createInMemoryStorage();
      await themeHandler.create(
        { theme: "t1", name: "dark", overrides: '{"bg": "black"}' },
        storage,
      );
      const result = await themeHandler.activate(
        { theme: "t1", priority: 10 },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).theme).toBe("t1");

      // Verify the stored record has active=true and the correct priority
      const record = await storage.get("theme", "t1");
      expect(record).toBeDefined();
      expect(record!.active).toBe(true);
      expect(record!.priority).toBe(10);
    });

    it("returns notfound for a nonexistent theme", async () => {
      const storage = createInMemoryStorage();
      const result = await themeHandler.activate(
        { theme: "ghost", priority: 1 },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // deactivate
  // ──────────────────────────────────────────────

  describe("deactivate", () => {
    it("sets active=false on a previously active theme", async () => {
      const storage = createInMemoryStorage();
      await themeHandler.create(
        { theme: "t1", name: "dark", overrides: '{"bg": "black"}' },
        storage,
      );
      await themeHandler.activate({ theme: "t1", priority: 5 }, storage);

      const result = await themeHandler.deactivate({ theme: "t1" }, storage);
      expect(result.variant).toBe("ok");

      // Verify the stored record has active=false
      const record = await storage.get("theme", "t1");
      expect(record).toBeDefined();
      expect(record!.active).toBe(false);
    });

    it("returns notfound for a nonexistent theme", async () => {
      const storage = createInMemoryStorage();
      const result = await themeHandler.deactivate({ theme: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // resolve
  // ──────────────────────────────────────────────

  describe("resolve", () => {
    it("resolves a single theme (no base) and returns its own overrides", async () => {
      const storage = createInMemoryStorage();
      await themeHandler.create(
        { theme: "t1", name: "flat", overrides: '{"bg": "white", "fg": "black"}' },
        storage,
      );
      const result = await themeHandler.resolve({ theme: "t1" }, storage);
      expect(result.variant).toBe("ok");

      const tokens = JSON.parse((result as any).tokens);
      expect(tokens.bg).toBe("white");
      expect(tokens.fg).toBe("black");
    });

    it("merges base chain overrides root-to-leaf (leaf overrides win)", async () => {
      const storage = createInMemoryStorage();
      // Root theme
      await themeHandler.create(
        { theme: "root", name: "root", overrides: '{"bg": "white", "fg": "black"}' },
        storage,
      );
      // Child extends root, overriding bg
      await themeHandler.extend(
        { theme: "child", base: "root", overrides: '{"bg": "gray"}' },
        storage,
      );

      const result = await themeHandler.resolve({ theme: "child" }, storage);
      expect(result.variant).toBe("ok");

      const tokens = JSON.parse((result as any).tokens);
      expect(tokens.bg).toBe("gray"); // overridden by child
      expect(tokens.fg).toBe("black"); // inherited from root
    });

    it("resolves a 3-level chain (A->B->C) with correct merge order", async () => {
      const storage = createInMemoryStorage();
      // A is the root
      await themeHandler.create(
        { theme: "A", name: "level-a", overrides: '{"x": "a", "y": "a", "z": "a"}' },
        storage,
      );
      // B extends A
      await themeHandler.extend(
        { theme: "B", base: "A", overrides: '{"y": "b", "z": "b"}' },
        storage,
      );
      // C extends B
      await themeHandler.extend(
        { theme: "C", base: "B", overrides: '{"z": "c"}' },
        storage,
      );

      const result = await themeHandler.resolve({ theme: "C" }, storage);
      expect(result.variant).toBe("ok");

      const tokens = JSON.parse((result as any).tokens);
      expect(tokens.x).toBe("a"); // from root A
      expect(tokens.y).toBe("b"); // overridden by B
      expect(tokens.z).toBe("c"); // overridden by C (leaf wins)
    });

    it("returns notfound for a nonexistent theme", async () => {
      const storage = createInMemoryStorage();
      const result = await themeHandler.resolve({ theme: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });

    it("handles cycles in base chain without infinite looping", async () => {
      const storage = createInMemoryStorage();
      // Create two themes that form a cycle: A -> B -> A
      await themeHandler.create(
        { theme: "A", name: "cycle-a", overrides: '{"x": "a"}' },
        storage,
      );
      await themeHandler.create(
        { theme: "B", name: "cycle-b", overrides: '{"y": "b"}' },
        storage,
      );
      // Manually set up cycle: A.base = B, B.base = A
      await themeHandler.extend(
        { theme: "A2", base: "B", overrides: '{"x": "a2"}' },
        storage,
      );
      // Make B point to A2 (now B -> A2's base is B -> cycle)
      // Instead, directly manipulate storage to create cycle
      await storage.put("theme", "cycleA", {
        theme: "cycleA",
        name: "ca",
        base: "cycleB",
        overrides: '{"x": 1}',
        active: false,
        priority: 0,
      });
      await storage.put("theme", "cycleB", {
        theme: "cycleB",
        name: "cb",
        base: "cycleA",
        overrides: '{"y": 2}',
        active: false,
        priority: 0,
      });

      // Should not hang — cycle detection breaks out
      const result = await themeHandler.resolve({ theme: "cycleA" }, storage);
      expect(result.variant).toBe("ok");
      // The visited-set guard breaks the cycle, so we get partial overrides
      const tokens = JSON.parse((result as any).tokens);
      expect(tokens).toBeDefined();
    });

    it("skips unparseable overrides gracefully", async () => {
      const storage = createInMemoryStorage();
      await storage.put("theme", "broken", {
        theme: "broken",
        name: "broken-theme",
        base: "",
        overrides: "NOT VALID JSON {{{",
        active: false,
        priority: 0,
      });

      const result = await themeHandler.resolve({ theme: "broken" }, storage);
      expect(result.variant).toBe("ok");
      // Unparseable overrides are skipped, so tokens should be empty
      const tokens = JSON.parse((result as any).tokens);
      expect(tokens).toEqual({});
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("create light -> extend dark from light -> resolve dark -> verify merged tokens", async () => {
      const storage = createInMemoryStorage();

      // Step 1: create "light" theme with bg: white
      const createResult = await themeHandler.create(
        { theme: "light", name: "light", overrides: '{"bg": "white"}' },
        storage,
      );
      expect(createResult.variant).toBe("ok");

      // Step 2: extend "dark" from "light" with bg overridden and fg added
      const extendResult = await themeHandler.extend(
        { theme: "dark", base: "light", overrides: '{"bg": "black", "fg": "white"}' },
        storage,
      );
      expect(extendResult.variant).toBe("ok");

      // Step 3: resolve "dark" — bg should be overridden, fg should be added
      const resolveResult = await themeHandler.resolve({ theme: "dark" }, storage);
      expect(resolveResult.variant).toBe("ok");

      const tokens = JSON.parse((resolveResult as any).tokens);
      expect(tokens.bg).toBe("black"); // overridden by dark
      expect(tokens.fg).toBe("white"); // added by dark
    });
  });
});
