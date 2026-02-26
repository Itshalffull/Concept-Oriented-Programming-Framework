import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { layoutHandler } from "./layout.impl";

describe("Layout Concept", () => {
  // ---------------------------------------------------------------
  // create
  // ---------------------------------------------------------------

  describe("create", () => {
    it("stack kind defaults direction to vertical", async () => {
      const storage = createInMemoryStorage();
      const result = await layoutHandler.create(
        { layout: "l-1", name: "Main Stack", kind: "stack" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("layout", "l-1");
      expect(record!.direction).toBe("vertical");
    });

    it("grid kind defaults direction to horizontal", async () => {
      const storage = createInMemoryStorage();
      const result = await layoutHandler.create(
        { layout: "l-grid", name: "Grid Layout", kind: "grid" },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("layout", "l-grid");
      expect(record!.direction).toBe("horizontal");
    });

    it("returns invalid for an unsupported kind", async () => {
      const storage = createInMemoryStorage();
      const result = await layoutHandler.create(
        { layout: "l-bad", name: "Bad", kind: "masonry" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("masonry");
    });

    it("accepts all 7 valid layout kinds", async () => {
      const validKinds = ["stack", "grid", "split", "overlay", "flow", "sidebar", "center"];
      const storage = createInMemoryStorage();

      for (const kind of validKinds) {
        const result = await layoutHandler.create(
          { layout: `l-${kind}`, name: `${kind} layout`, kind },
          storage,
        );
        expect(result.variant).toBe("ok");
        expect((result as any).layout).toBe(`l-${kind}`);
      }
    });
  });

  // ---------------------------------------------------------------
  // configure
  // ---------------------------------------------------------------

  describe("configure", () => {
    it("merges direction, gap, columns, rows, and areas fields", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create(
        { layout: "l-1", name: "Stack", kind: "stack" },
        storage,
      );

      const result = await layoutHandler.configure(
        {
          layout: "l-1",
          config: JSON.stringify({
            direction: "horizontal",
            gap: "16px",
            columns: "1fr 2fr",
            rows: "auto",
            areas: '"header header" "sidebar main"',
          }),
        },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("layout", "l-1");
      expect(record!.direction).toBe("horizontal");
      expect(record!.gap).toBe("16px");
      expect(record!.columns).toBe("1fr 2fr");
      expect(record!.rows).toBe("auto");
      expect(record!.areas).toBe('"header header" "sidebar main"');
    });

    it("ignores non-whitelisted fields in config JSON", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create(
        { layout: "l-1", name: "Stack", kind: "stack" },
        storage,
      );

      await layoutHandler.configure(
        {
          layout: "l-1",
          config: JSON.stringify({
            direction: "horizontal",
            backgroundColor: "red",
            zIndex: 99,
          }),
        },
        storage,
      );

      const record = await storage.get("layout", "l-1");
      expect(record!.direction).toBe("horizontal");
      expect(record!.backgroundColor).toBeUndefined();
      expect(record!.zIndex).toBeUndefined();
    });

    it("returns notfound for a nonexistent layout", async () => {
      const storage = createInMemoryStorage();
      const result = await layoutHandler.configure(
        { layout: "l-missing", config: '{"direction":"vertical"}' },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("l-missing");
    });

    it("treats invalid JSON as empty config without crashing", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create(
        { layout: "l-1", name: "Stack", kind: "stack" },
        storage,
      );

      // Should not throw
      const result = await layoutHandler.configure(
        { layout: "l-1", config: "not-valid-json{{{" },
        storage,
      );
      expect(result.variant).toBe("ok");

      // Original direction should remain unchanged
      const record = await storage.get("layout", "l-1");
      expect(record!.direction).toBe("vertical");
    });
  });

  // ---------------------------------------------------------------
  // nest
  // ---------------------------------------------------------------

  describe("nest", () => {
    it("nests a child under a parent, sets child.parent and parent.children", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "parent", name: "Parent", kind: "stack" }, storage);
      await layoutHandler.create({ layout: "child", name: "Child", kind: "grid" }, storage);

      const result = await layoutHandler.nest(
        { parent: "parent", child: "child" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).parent).toBe("parent");

      const parentRecord = await storage.get("layout", "parent");
      const children = JSON.parse(parentRecord!.children as string);
      expect(children).toContain("child");

      const childRecord = await storage.get("layout", "child");
      expect(childRecord!.parent).toBe("parent");
    });

    it("detects self-cycle: A under itself returns cycle", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "a", name: "A", kind: "stack" }, storage);

      const result = await layoutHandler.nest(
        { parent: "a", child: "a" },
        storage,
      );
      expect(result.variant).toBe("cycle");
    });

    it("detects direct cycle: A->B, then B->A returns cycle", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "a", name: "A", kind: "stack" }, storage);
      await layoutHandler.create({ layout: "b", name: "B", kind: "grid" }, storage);

      await layoutHandler.nest({ parent: "a", child: "b" }, storage);

      const result = await layoutHandler.nest(
        { parent: "b", child: "a" },
        storage,
      );
      expect(result.variant).toBe("cycle");
    });

    it("detects transitive cycle: A->B->C, then C->A returns cycle", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "a", name: "A", kind: "stack" }, storage);
      await layoutHandler.create({ layout: "b", name: "B", kind: "grid" }, storage);
      await layoutHandler.create({ layout: "c", name: "C", kind: "flow" }, storage);

      await layoutHandler.nest({ parent: "a", child: "b" }, storage);
      await layoutHandler.nest({ parent: "b", child: "c" }, storage);

      const result = await layoutHandler.nest(
        { parent: "c", child: "a" },
        storage,
      );
      expect(result.variant).toBe("cycle");
    });

    it("returns cycle when parent does not exist", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "child", name: "Child", kind: "stack" }, storage);

      const result = await layoutHandler.nest(
        { parent: "nonexistent", child: "child" },
        storage,
      );
      expect(result.variant).toBe("cycle");
      expect((result as any).message).toContain("nonexistent");
    });

    it("returns cycle when child does not exist", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "parent", name: "Parent", kind: "stack" }, storage);

      const result = await layoutHandler.nest(
        { parent: "parent", child: "nonexistent" },
        storage,
      );
      expect(result.variant).toBe("cycle");
      expect((result as any).message).toContain("nonexistent");
    });

    it("does not duplicate a child when nested twice under the same parent", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "parent", name: "Parent", kind: "stack" }, storage);
      await layoutHandler.create({ layout: "child", name: "Child", kind: "grid" }, storage);

      await layoutHandler.nest({ parent: "parent", child: "child" }, storage);
      await layoutHandler.nest({ parent: "parent", child: "child" }, storage);

      const record = await storage.get("layout", "parent");
      const children = JSON.parse(record!.children as string);
      const occurrences = children.filter((c: string) => c === "child");
      expect(occurrences).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------
  // setResponsive
  // ---------------------------------------------------------------

  describe("setResponsive", () => {
    it("stores breakpoint overrides JSON on the layout", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "l-1", name: "Stack", kind: "stack" }, storage);

      const breakpoints = JSON.stringify({
        sm: { direction: "vertical", gap: "8px" },
        lg: { direction: "horizontal", gap: "24px" },
      });

      const result = await layoutHandler.setResponsive(
        { layout: "l-1", breakpoints },
        storage,
      );
      expect(result.variant).toBe("ok");

      const record = await storage.get("layout", "l-1");
      expect(record!.responsive).toBe(breakpoints);
    });

    it("returns notfound for a nonexistent layout", async () => {
      const storage = createInMemoryStorage();
      const result = await layoutHandler.setResponsive(
        { layout: "l-missing", breakpoints: "{}" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("l-missing");
    });
  });

  // ---------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------

  describe("remove", () => {
    it("deletes a layout so subsequent operations return notfound", async () => {
      const storage = createInMemoryStorage();
      await layoutHandler.create({ layout: "l-1", name: "Stack", kind: "stack" }, storage);

      const result = await layoutHandler.remove({ layout: "l-1" }, storage);
      expect(result.variant).toBe("ok");

      // Subsequent configure should fail
      const configResult = await layoutHandler.configure(
        { layout: "l-1", config: '{"gap":"8px"}' },
        storage,
      );
      expect(configResult.variant).toBe("notfound");

      // Subsequent remove should fail
      const removeAgain = await layoutHandler.remove({ layout: "l-1" }, storage);
      expect(removeAgain.variant).toBe("notfound");
    });

    it("returns notfound for a nonexistent layout", async () => {
      const storage = createInMemoryStorage();
      const result = await layoutHandler.remove({ layout: "l-missing" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ---------------------------------------------------------------
  // integration
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("create stack -> configure -> nest grid child -> setResponsive -> remove", async () => {
      const storage = createInMemoryStorage();

      // Step 1: create a stack layout
      const createResult = await layoutHandler.create(
        { layout: "l-main", name: "Main Layout", kind: "stack" },
        storage,
      );
      expect(createResult.variant).toBe("ok");

      let record = await storage.get("layout", "l-main");
      expect(record!.kind).toBe("stack");
      expect(record!.direction).toBe("vertical");

      // Step 2: configure with horizontal direction and gap
      const configResult = await layoutHandler.configure(
        {
          layout: "l-main",
          config: JSON.stringify({ direction: "horizontal", gap: "16px" }),
        },
        storage,
      );
      expect(configResult.variant).toBe("ok");

      record = await storage.get("layout", "l-main");
      expect(record!.direction).toBe("horizontal");
      expect(record!.gap).toBe("16px");

      // Step 3: create a grid child and nest it
      await layoutHandler.create(
        { layout: "l-child", name: "Child Grid", kind: "grid" },
        storage,
      );

      const nestResult = await layoutHandler.nest(
        { parent: "l-main", child: "l-child" },
        storage,
      );
      expect(nestResult.variant).toBe("ok");

      record = await storage.get("layout", "l-main");
      const children = JSON.parse(record!.children as string);
      expect(children).toContain("l-child");

      const childRecord = await storage.get("layout", "l-child");
      expect(childRecord!.parent).toBe("l-main");

      // Step 4: set responsive breakpoints
      const responsiveConfig = JSON.stringify({
        sm: { direction: "vertical", gap: "8px" },
        lg: { direction: "horizontal", gap: "24px" },
      });
      const respResult = await layoutHandler.setResponsive(
        { layout: "l-main", breakpoints: responsiveConfig },
        storage,
      );
      expect(respResult.variant).toBe("ok");

      record = await storage.get("layout", "l-main");
      expect(record!.responsive).toBe(responsiveConfig);

      // Step 5: remove the parent layout
      const removeResult = await layoutHandler.remove({ layout: "l-main" }, storage);
      expect(removeResult.variant).toBe("ok");

      // Verify it is gone
      const gone = await storage.get("layout", "l-main");
      expect(gone).toBeNull();
    });
  });
});
