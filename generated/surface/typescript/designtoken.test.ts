import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { designtokenHandler } from "./designtoken.impl";

describe("DesignToken Concept – Behavioral Tests", () => {
  // ──────────────────────────────────────────────
  // define
  // ──────────────────────────────────────────────

  describe("define", () => {
    it("creates a token successfully and returns ok with the token id", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenHandler.define(
        { token: "t1", name: "blue-500", value: "#3b82f6", type: "color", tier: "primitive" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).token).toBe("t1");
    });

    it("returns duplicate variant when a token with the same name already exists", async () => {
      const storage = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "t1", name: "blue-500", value: "#3b82f6", type: "color", tier: "primitive" },
        storage,
      );
      const result = await designtokenHandler.define(
        { token: "t2", name: "blue-500", value: "#2563eb", type: "color", tier: "primitive" },
        storage,
      );
      expect(result.variant).toBe("duplicate");
      expect((result as any).message).toContain("blue-500");
    });
  });

  // ──────────────────────────────────────────────
  // alias
  // ──────────────────────────────────────────────

  describe("alias", () => {
    it("creates an alias to an existing token and returns ok", async () => {
      const storage = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "t1", name: "blue-500", value: "#3b82f6", type: "color", tier: "primitive" },
        storage,
      );
      const result = await designtokenHandler.alias(
        { token: "a1", name: "primary", reference: "t1", tier: "semantic" },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).token).toBe("a1");
    });

    it("returns notfound when the referenced token does not exist", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenHandler.alias(
        { token: "a1", name: "primary", reference: "nonexistent", tier: "semantic" },
        storage,
      );
      expect(result.variant).toBe("notfound");
      expect((result as any).message).toContain("nonexistent");
    });

    it("detects a cycle when A references B and then B tries to reference A", async () => {
      const storage = createInMemoryStorage();
      // Create concrete token C
      await designtokenHandler.define(
        { token: "c", name: "concrete", value: "#000", type: "color", tier: "primitive" },
        storage,
      );
      // A -> C (valid)
      await designtokenHandler.alias(
        { token: "a", name: "alias-a", reference: "c", tier: "semantic" },
        storage,
      );
      // B -> A (valid chain: B -> A -> C)
      await designtokenHandler.alias(
        { token: "b", name: "alias-b", reference: "a", tier: "semantic" },
        storage,
      );
      // Now try to make A -> B which would create A -> B -> A cycle
      // We need to redefine A to reference B. But alias creates a new entry, so
      // let's use a fresh scenario: A -> B exists, now try B -> A
      const storage2 = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "base", name: "base", value: "#fff", type: "color", tier: "primitive" },
        storage2,
      );
      await designtokenHandler.alias(
        { token: "a2", name: "alias-a2", reference: "base", tier: "semantic" },
        storage2,
      );
      await designtokenHandler.alias(
        { token: "b2", name: "alias-b2", reference: "a2", tier: "semantic" },
        storage2,
      );
      // Now attempt alias c2 -> b2, where c2's id collides in the chain. Actually
      // let's directly test: create A alias to B, then B alias to A.
      const storage3 = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "x", name: "x-concrete", value: "10px", type: "size", tier: "primitive" },
        storage3,
      );
      // A -> X (ok)
      await designtokenHandler.alias(
        { token: "a3", name: "a3-alias", reference: "x", tier: "semantic" },
        storage3,
      );
      // B -> A3 (ok, chain: B -> A3 -> X)
      const cycleResult = await designtokenHandler.alias(
        { token: "x", name: "x-alias", reference: "a3", tier: "semantic" },
        storage3,
      );
      // x is in visited set because x is the token being created and x already
      // appears in the chain a3 -> x. So the cycle detector catches it.
      expect(cycleResult.variant).toBe("cycle");
    });

    it("detects self-reference as a cycle", async () => {
      const storage = createInMemoryStorage();
      // A token that exists and tries to alias to itself
      await designtokenHandler.define(
        { token: "self", name: "self-token", value: "#000", type: "color", tier: "primitive" },
        storage,
      );
      const result = await designtokenHandler.alias(
        { token: "self", name: "self-alias", reference: "self", tier: "semantic" },
        storage,
      );
      expect(result.variant).toBe("cycle");
    });
  });

  // ──────────────────────────────────────────────
  // resolve
  // ──────────────────────────────────────────────

  describe("resolve", () => {
    it("resolves a concrete token to its own value directly", async () => {
      const storage = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "t1", name: "red-500", value: "#ef4444", type: "color", tier: "primitive" },
        storage,
      );
      const result = await designtokenHandler.resolve({ token: "t1" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).resolvedValue).toBe("#ef4444");
    });

    it("walks an alias chain to the concrete value (A -> B -> C)", async () => {
      const storage = createInMemoryStorage();
      // C is concrete
      await designtokenHandler.define(
        { token: "c", name: "green-500", value: "#22c55e", type: "color", tier: "primitive" },
        storage,
      );
      // B -> C
      await designtokenHandler.alias(
        { token: "b", name: "success", reference: "c", tier: "semantic" },
        storage,
      );
      // A -> B
      await designtokenHandler.alias(
        { token: "a", name: "positive-feedback", reference: "b", tier: "component" },
        storage,
      );

      const result = await designtokenHandler.resolve({ token: "a" }, storage);
      expect(result.variant).toBe("ok");
      expect((result as any).resolvedValue).toBe("#22c55e");
    });

    it("returns broken when the reference chain has a missing link", async () => {
      const storage = createInMemoryStorage();
      // Create A -> B, but B references a token that doesn't exist
      await designtokenHandler.define(
        { token: "b", name: "intermediate", value: "unused", type: "color", tier: "primitive" },
        storage,
      );
      await designtokenHandler.alias(
        { token: "a", name: "top-alias", reference: "b", tier: "semantic" },
        storage,
      );

      // Manually break the chain by removing B and putting an alias that references missing token
      // Re-create: B as alias to "missing"
      const storage2 = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "real", name: "real-token", value: "#000", type: "color", tier: "primitive" },
        storage2,
      );
      await designtokenHandler.alias(
        { token: "mid", name: "mid-alias", reference: "real", tier: "semantic" },
        storage2,
      );
      await designtokenHandler.alias(
        { token: "top", name: "top-alias", reference: "mid", tier: "component" },
        storage2,
      );
      // Now remove 'real' so the chain is broken
      await designtokenHandler.remove({ token: "real" }, storage2);

      const result = await designtokenHandler.resolve({ token: "top" }, storage2);
      expect(result.variant).toBe("broken");
      expect((result as any).brokenAt).toBe("real");
    });

    it("returns notfound for a nonexistent token", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenHandler.resolve({ token: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────

  describe("update", () => {
    it("modifies token value and subsequent resolve reflects the new value", async () => {
      const storage = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "t1", name: "spacing-md", value: "16px", type: "size", tier: "primitive" },
        storage,
      );
      const updateResult = await designtokenHandler.update(
        { token: "t1", value: "20px" },
        storage,
      );
      expect(updateResult.variant).toBe("ok");

      const resolveResult = await designtokenHandler.resolve({ token: "t1" }, storage);
      expect((resolveResult as any).resolvedValue).toBe("20px");
    });

    it("returns notfound for a nonexistent token", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenHandler.update(
        { token: "ghost", value: "42px" },
        storage,
      );
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────

  describe("remove", () => {
    it("deletes a token so subsequent resolve returns notfound", async () => {
      const storage = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "t1", name: "border-sm", value: "1px", type: "size", tier: "primitive" },
        storage,
      );
      const removeResult = await designtokenHandler.remove({ token: "t1" }, storage);
      expect(removeResult.variant).toBe("ok");

      const resolveResult = await designtokenHandler.resolve({ token: "t1" }, storage);
      expect(resolveResult.variant).toBe("notfound");
    });

    it("returns notfound for a nonexistent token", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenHandler.remove({ token: "ghost" }, storage);
      expect(result.variant).toBe("notfound");
    });
  });

  // ──────────────────────────────────────────────
  // export
  // ──────────────────────────────────────────────

  describe("export", () => {
    it("exports all tokens as a JSON object", async () => {
      const storage = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "t1", name: "color.primary", value: "#3b82f6", type: "color", tier: "primitive" },
        storage,
      );
      await designtokenHandler.define(
        { token: "t2", name: "spacing.sm", value: "8px", type: "size", tier: "primitive" },
        storage,
      );

      const result = await designtokenHandler.export({ format: "json" }, storage);
      expect(result.variant).toBe("ok");

      const parsed = JSON.parse((result as any).output);
      expect(parsed["color.primary"]).toBeDefined();
      expect(parsed["color.primary"].value).toBe("#3b82f6");
      expect(parsed["spacing.sm"]).toBeDefined();
      expect(parsed["spacing.sm"].value).toBe("8px");
    });

    it("exports all tokens as CSS custom properties", async () => {
      const storage = createInMemoryStorage();
      await designtokenHandler.define(
        { token: "t1", name: "color.primary", value: "#3b82f6", type: "color", tier: "primitive" },
        storage,
      );

      const result = await designtokenHandler.export({ format: "css" }, storage);
      expect(result.variant).toBe("ok");

      const output = (result as any).output as string;
      expect(output).toContain(":root {");
      expect(output).toContain("--color-primary: #3b82f6;");
      expect(output).toContain("}");
    });

    it("returns unsupported for an unrecognized format", async () => {
      const storage = createInMemoryStorage();
      const result = await designtokenHandler.export({ format: "yaml" }, storage);
      expect(result.variant).toBe("unsupported");
      expect((result as any).message).toContain("yaml");
    });
  });

  // ──────────────────────────────────────────────
  // integration: full lifecycle
  // ──────────────────────────────────────────────

  describe("integration", () => {
    it("define -> alias -> resolve alias -> update original -> resolve alias again -> value propagated", async () => {
      const storage = createInMemoryStorage();

      // Step 1: define a concrete token
      const defineResult = await designtokenHandler.define(
        { token: "base", name: "blue-600", value: "#2563eb", type: "color", tier: "primitive" },
        storage,
      );
      expect(defineResult.variant).toBe("ok");

      // Step 2: create an alias to it
      const aliasResult = await designtokenHandler.alias(
        { token: "semantic", name: "brand-primary", reference: "base", tier: "semantic" },
        storage,
      );
      expect(aliasResult.variant).toBe("ok");

      // Step 3: resolve the alias — should get the base value
      const resolve1 = await designtokenHandler.resolve({ token: "semantic" }, storage);
      expect(resolve1.variant).toBe("ok");
      expect((resolve1 as any).resolvedValue).toBe("#2563eb");

      // Step 4: update the original token's value
      const updateResult = await designtokenHandler.update(
        { token: "base", value: "#1d4ed8" },
        storage,
      );
      expect(updateResult.variant).toBe("ok");

      // Step 5: resolve the alias again — should reflect the updated value
      const resolve2 = await designtokenHandler.resolve({ token: "semantic" }, storage);
      expect(resolve2.variant).toBe("ok");
      expect((resolve2 as any).resolvedValue).toBe("#1d4ed8");
    });
  });
});
