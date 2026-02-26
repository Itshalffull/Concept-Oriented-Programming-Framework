import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { elementHandler } from "./element.impl";

describe("Element Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────

  describe("create", () => {
    it("creates an element with a valid kind and returns ok", async () => {
      const storage = createInMemoryStorage();
      const result = await elementHandler.create(
        { element: "e1", kind: "input-text", label: "Username", dataType: "String" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).element).toBe("e1");
    });

    it("returns invalid for an unrecognized kind", async () => {
      const storage = createInMemoryStorage();
      const result = await elementHandler.create(
        { element: "e1", kind: "fancy-widget", label: "Fancy", dataType: "String" },
        storage,
      );
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("fancy-widget");
    });

    it("accepts all 17 valid kinds (representative sample)", async () => {
      const storage = createInMemoryStorage();
      const sampleKinds = [
        "input-text",
        "input-number",
        "input-date",
        "input-bool",
        "selection-single",
        "selection-multi",
        "trigger",
        "navigation",
        "output-text",
        "output-number",
        "output-date",
        "output-bool",
        "group",
        "container",
        "rich-text",
        "file-upload",
        "media-display",
      ];

      for (let i = 0; i < sampleKinds.length; i++) {
        const result = await elementHandler.create(
          { element: `e-${i}`, kind: sampleKinds[i], label: `Label ${i}`, dataType: "String" },
          storage,
        );
        expect(result.variant).toBe("ok");
      }
    });
  });

  // ──────────────────────────────────────────────
  // nest
  // ──────────────────────────────────────────────

  describe("nest", () => {
    it("nests a child under a group element", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "grp", kind: "group", label: "Form Group", dataType: "None" },
        storage,
      );
      await elementHandler.create(
        { element: "inp", kind: "input-text", label: "Name", dataType: "String" },
        storage,
      );

      const result = await elementHandler.nest({ parent: "grp", child: "inp" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).parent).toBe("grp");
    });

    it("nests a child under a container element", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "ctr", kind: "container", label: "Main Container", dataType: "None" },
        storage,
      );
      await elementHandler.create(
        { element: "btn", kind: "trigger", label: "Submit", dataType: "None" },
        storage,
      );

      const result = await elementHandler.nest({ parent: "ctr", child: "btn" }, storage);
      expect(result.variant).toBe("ok");
    });

    it("returns invalid when nesting under a non-container kind (input-text)", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "inp", kind: "input-text", label: "Name", dataType: "String" },
        storage,
      );
      await elementHandler.create(
        { element: "child", kind: "trigger", label: "Go", dataType: "None" },
        storage,
      );

      const result = await elementHandler.nest({ parent: "inp", child: "child" }, storage);
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("cannot contain children");
    });

    it("returns invalid when the parent element does not exist", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "child", kind: "trigger", label: "Go", dataType: "None" },
        storage,
      );

      const result = await elementHandler.nest({ parent: "ghost", child: "child" }, storage);
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("ghost");
    });

    it("returns invalid when the child element does not exist", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "grp", kind: "group", label: "Group", dataType: "None" },
        storage,
      );

      const result = await elementHandler.nest({ parent: "grp", child: "ghost" }, storage);
      expect(result.variant).toBe("invalid");
      expect((result as any).message).toContain("ghost");
    });

    it("does not duplicate a child when nested twice under the same parent", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "grp", kind: "group", label: "Group", dataType: "None" },
        storage,
      );
      await elementHandler.create(
        { element: "inp", kind: "input-text", label: "Field", dataType: "String" },
        storage,
      );

      await elementHandler.nest({ parent: "grp", child: "inp" }, storage);
      await elementHandler.nest({ parent: "grp", child: "inp" }, storage);

      // Verify children array has exactly one entry
      const parentEntry = await storage.get("element", "grp");
      const children = JSON.parse(parentEntry!.children as string);
      expect(children).toEqual(["inp"]);
      expect(children.length).toBe(1);
    });
  });

  // ──────────────────────────────────────────────
  // setConstraints
  // ──────────────────────────────────────────────

  describe("setConstraints", () => {
    it("updates constraints on an existing element", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "e1", kind: "input-text", label: "Email", dataType: "String" },
        storage,
      );

      const constraints = JSON.stringify({ maxLength: 255, pattern: "^.+@.+\\..+$" });
      const result = await elementHandler.setConstraints(
        { element: "e1", constraints },
        storage,
      );
      expect(result.variant).toBe("ok");

      // Verify constraints were stored
      const entry = await storage.get("element", "e1");
      expect(entry!.constraints).toBe(constraints);
    });

    it("returns notfound for a nonexistent element", async () => {
      const storage = createInMemoryStorage();
      const result = await elementHandler.setConstraints(
        { element: "ghost", constraints: "{}" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────

  describe("remove", () => {
    it("deletes an element so subsequent operations return notfound", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "e1", kind: "trigger", label: "Delete Me", dataType: "None" },
        storage,
      );

      const removeResult = await elementHandler.remove({ element: "e1" }, storage);
      expect(removeResult.variant).toBe("ok");

      const constraintResult = await elementHandler.setConstraints(
        { element: "e1", constraints: "{}" },
        storage,
      );
      expect(constraintResult.variant).toBe("notfound");
    });

    it("removes the element from its parent's children list", async () => {
      const storage = createInMemoryStorage();
      await elementHandler.create(
        { element: "grp", kind: "group", label: "Group", dataType: "None" },
        storage,
      );
      await elementHandler.create(
        { element: "c1", kind: "input-text", label: "Child 1", dataType: "String" },
        storage,
      );
      await elementHandler.create(
        { element: "c2", kind: "input-text", label: "Child 2", dataType: "String" },
        storage,
      );

      await elementHandler.nest({ parent: "grp", child: "c1" }, storage);
      await elementHandler.nest({ parent: "grp", child: "c2" }, storage);

      // Remove c1
      await elementHandler.remove({ element: "c1" }, storage);

      // Verify parent's children list no longer includes c1
      const parentEntry = await storage.get("element", "grp");
      const children = JSON.parse(parentEntry!.children as string);
      expect(children).toEqual(["c2"]);
    });

    it("returns notfound for a nonexistent element", async () => {
      const storage = createInMemoryStorage();
      const result = await elementHandler.remove({ element: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("create container -> create 3 inputs -> nest all -> remove middle -> verify 2 children", async () => {
      const storage = createInMemoryStorage();

      // Create container
      const containerResult = await elementHandler.create(
        { element: "form", kind: "container", label: "Registration Form", dataType: "None" },
        storage,
      );
      expect(containerResult.variant).toBe("ok");

      // Create 3 input elements
      await elementHandler.create(
        { element: "name-input", kind: "input-text", label: "Name", dataType: "String" },
        storage,
      );
      await elementHandler.create(
        { element: "email-input", kind: "input-text", label: "Email", dataType: "String" },
        storage,
      );
      await elementHandler.create(
        { element: "age-input", kind: "input-number", label: "Age", dataType: "Int" },
        storage,
      );

      // Nest all three under the container
      await elementHandler.nest({ parent: "form", child: "name-input" }, storage);
      await elementHandler.nest({ parent: "form", child: "email-input" }, storage);
      await elementHandler.nest({ parent: "form", child: "age-input" }, storage);

      // Verify all 3 are nested
      let parentEntry = await storage.get("element", "form");
      let children = JSON.parse(parentEntry!.children as string);
      expect(children.length).toBe(3);

      // Remove the middle element
      const removeResult = await elementHandler.remove({ element: "email-input" }, storage);
      expect(removeResult.variant).toBe("ok");

      // Verify the container now has 2 children
      parentEntry = await storage.get("element", "form");
      children = JSON.parse(parentEntry!.children as string);
      expect(children.length).toBe(2);
      expect(children).toEqual(["name-input", "age-input"]);
    });
  });
});
