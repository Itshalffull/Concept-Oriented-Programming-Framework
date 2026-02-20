import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { uischemaHandler } from "./uischema.impl";

/**
 * A minimal but valid concept spec string for testing.
 * Matches the parser's expected patterns:
 *   concept Name [T] { state { field: T -> Type } actions { action name(...) { ... } } }
 */
const VALID_CONCEPT_SPEC = `
concept UserProfile [T] {
  state {
    username: T -> String
    age: T -> Int
    active: T -> Bool
  }
  actions {
    action update(username: String, age: Int) {
      -> ok(message: String)
    }
    action deactivate() {
      -> ok(message: String)
    }
  }
}
`;

const MINIMAL_CONCEPT_SPEC = `
concept Counter [T] {
  state {
    count: T -> Int
  }
  actions {
    action increment() {
      -> ok(count: Int)
    }
  }
}
`;

describe("UISchema Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // inspect
  // ──────────────────────────────────────────────

  describe("inspect", () => {
    it("parses a valid concept spec and generates a UI schema with VerticalLayout", async () => {
      const storage = createInMemoryStorage();
      const result = await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: VALID_CONCEPT_SPEC },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).schema).toBe("s1");

      // Verify the stored UI schema has a VerticalLayout
      const entry = await storage.get("schema", "s1");
      const uiSchema = JSON.parse(entry!.uiSchema as string);
      expect(uiSchema.type).toBe("VerticalLayout");
      expect(uiSchema.concept).toBe("UserProfile");
    });

    it("generates controls with correct component mapping (String->text-input, Int->number-input, Bool->checkbox)", async () => {
      const storage = createInMemoryStorage();
      await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: VALID_CONCEPT_SPEC },
        storage,
      );

      const entry = await storage.get("schema", "s1");
      const elements = JSON.parse(entry!.elements as string) as any[];

      // Filter to control elements only
      const controls = elements.filter((e: any) => e.type === "control");

      // Find each field
      const usernameCtrl = controls.find((c: any) => c.scope.includes("username"));
      expect(usernameCtrl).toBeDefined();
      expect(usernameCtrl.component).toBe("text-input");

      const ageCtrl = controls.find((c: any) => c.scope.includes("age"));
      expect(ageCtrl).toBeDefined();
      expect(ageCtrl.component).toBe("number-input");

      const activeCtrl = controls.find((c: any) => c.scope.includes("active"));
      expect(activeCtrl).toBeDefined();
      expect(activeCtrl.component).toBe("checkbox");
    });

    it("generates action buttons from the actions block", async () => {
      const storage = createInMemoryStorage();
      await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: VALID_CONCEPT_SPEC },
        storage,
      );

      const entry = await storage.get("schema", "s1");
      const elements = JSON.parse(entry!.elements as string) as any[];

      // Filter to action elements
      const actions = elements.filter((e: any) => e.type === "action");
      expect(actions.length).toBe(2);

      const updateAction = actions.find((a: any) => a.action === "update");
      expect(updateAction).toBeDefined();
      expect(updateAction.label).toBe("Update");
      expect(updateAction.params.length).toBe(2);

      const deactivateAction = actions.find((a: any) => a.action === "deactivate");
      expect(deactivateAction).toBeDefined();
    });

    it("returns parseError for an invalid concept spec (missing 'concept' keyword)", async () => {
      const storage = createInMemoryStorage();
      const result = await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: "this is not a valid spec at all" },
        storage,
      );
      expect(result.variant).toBe("parseError");
      expect((result as any).message).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // override
  // ──────────────────────────────────────────────

  describe("override", () => {
    it("merges JSON overrides into the stored schema", async () => {
      const storage = createInMemoryStorage();
      await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: MINIMAL_CONCEPT_SPEC },
        storage,
      );

      const result = await uischemaHandler.override(
        { schema: "s1", overrides: JSON.stringify({ theme: "dark", density: "compact" }) },
        storage,
      );
      expect(result.variant).toBe("ok");

      // Verify overrides are applied to the uiSchema
      const entry = await storage.get("schema", "s1");
      const uiSchema = JSON.parse(entry!.uiSchema as string);
      expect(uiSchema.theme).toBe("dark");
      expect(uiSchema.density).toBe("compact");
      // Original properties should still be present
      expect(uiSchema.type).toBe("VerticalLayout");
    });

    it("returns invalid for non-JSON overrides", async () => {
      const storage = createInMemoryStorage();
      await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: MINIMAL_CONCEPT_SPEC },
        storage,
      );

      const result = await uischemaHandler.override(
        { schema: "s1", overrides: "not valid json {{{" },
        storage,
      );
      expect(result.variant).toBe("invalid");
    });

    it("returns notfound for a nonexistent schema", async () => {
      const storage = createInMemoryStorage();
      const result = await uischemaHandler.override(
        { schema: "ghost", overrides: JSON.stringify({ theme: "dark" }) },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // getSchema
  // ──────────────────────────────────────────────

  describe("getSchema", () => {
    it("returns the stored UI schema JSON", async () => {
      const storage = createInMemoryStorage();
      await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: MINIMAL_CONCEPT_SPEC },
        storage,
      );

      const result = await uischemaHandler.getSchema({ schema: "s1" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).schema).toBe("s1");

      const uiSchema = JSON.parse((result as any).uiSchema);
      expect(uiSchema.type).toBe("VerticalLayout");
      expect(uiSchema.concept).toBe("Counter");
    });

    it("returns notfound for a nonexistent schema", async () => {
      const storage = createInMemoryStorage();
      const result = await uischemaHandler.getSchema({ schema: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // getElements
  // ──────────────────────────────────────────────

  describe("getElements", () => {
    it("returns the stored elements array", async () => {
      const storage = createInMemoryStorage();
      await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: MINIMAL_CONCEPT_SPEC },
        storage,
      );

      const result = await uischemaHandler.getElements({ schema: "s1" }, storage);
      expect(result.variant).toBe("ok");

      const elements = JSON.parse((result as any).elements);
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBeGreaterThan(0);

      // Should contain at least the count control and increment action
      const controlEl = elements.find((e: any) => e.type === "control");
      expect(controlEl).toBeDefined();
      const actionEl = elements.find((e: any) => e.type === "action");
      expect(actionEl).toBeDefined();
    });

    it("returns notfound for a nonexistent schema", async () => {
      const storage = createInMemoryStorage();
      const result = await uischemaHandler.getElements({ schema: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // integration
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("inspect -> override with theme -> getSchema -> verify override is applied", async () => {
      const storage = createInMemoryStorage();

      // Step 1: inspect a concept spec
      const inspectResult = await uischemaHandler.inspect(
        { schema: "s1", conceptSpec: MINIMAL_CONCEPT_SPEC },
        storage,
      );
      expect(inspectResult.variant).toBe("ok");

      // Step 2: override with a theme
      const overrideResult = await uischemaHandler.override(
        { schema: "s1", overrides: JSON.stringify({ theme: "dark" }) },
        storage,
      );
      expect(overrideResult.variant).toBe("ok");

      // Step 3: getSchema and verify the override is present
      const schemaResult = await uischemaHandler.getSchema({ schema: "s1" }, storage);
      expect(schemaResult.variant).toBe("ok");

      const uiSchema = JSON.parse((schemaResult as any).uiSchema);
      expect(uiSchema.theme).toBe("dark");
      // Original layout type preserved
      expect(uiSchema.type).toBe("VerticalLayout");
      expect(uiSchema.concept).toBe("Counter");
    });
  });
});
