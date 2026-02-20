import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { vanillaadapterHandler } from "./vanillaadapter.impl";

describe("VanillaAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("returns ok with the adapter id and normalized props", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("vn-1");
      expect((result as any).normalized).toBeDefined();
    });

    // ---------------------------------------------------------------
    // Event mappings – addEventListener:event format
    // ---------------------------------------------------------------

    it("maps onclick to addEventListener:click", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:click", "fn");
      expect(normalized).not.toHaveProperty("onclick");
    });

    it("maps onchange to addEventListener:change", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onchange: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:change", "fn");
      expect(normalized).not.toHaveProperty("onchange");
    });

    it("maps onsubmit to addEventListener:submit", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onsubmit: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:submit", "fn");
    });

    it("maps oninput to addEventListener:input", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ oninput: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:input", "fn");
    });

    it("maps onblur to addEventListener:blur", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onblur: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:blur", "fn");
    });

    it("maps onfocus to addEventListener:focus", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onfocus: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:focus", "fn");
    });

    it("maps onkeydown to addEventListener:keydown", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onkeydown: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:keydown", "fn");
    });

    it("maps onkeyup to addEventListener:keyup", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onkeyup: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:keyup", "fn");
    });

    it("maps onmouseover to addEventListener:mouseover", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onmouseover: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:mouseover", "fn");
    });

    it("maps ondblclick to addEventListener:dblclick", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ ondblclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:dblclick", "fn");
    });

    it("maps onscroll to addEventListener:scroll", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onscroll: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:scroll", "fn");
    });

    it("maps ondrag to addEventListener:drag", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ ondrag: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:drag", "fn");
    });

    it("maps ondrop to addEventListener:drop", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ ondrop: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:drop", "fn");
    });

    it("does not re-prefix keys that already start with on:", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ "on:click": "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      // on: prefix should pass through unchanged since it starts with 'on:'
      expect(normalized).toHaveProperty("on:click", "fn");
      expect(normalized).not.toHaveProperty("addEventListener:on:click");
    });

    // ---------------------------------------------------------------
    // Attribute mappings – class to classList:add
    // ---------------------------------------------------------------

    it("maps class to classList:add", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ class: "btn primary" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("classList:add", "btn primary");
      expect(normalized).not.toHaveProperty("class");
      expect(normalized).not.toHaveProperty("className");
    });

    // ---------------------------------------------------------------
    // Other attributes pass through as-is for setAttribute
    // ---------------------------------------------------------------

    it("passes through for unchanged (no remapping like React)", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ for: "email-input" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      // Vanilla only maps 'class' in VANILLA_ATTR_MAP, so 'for' passes through
      expect(normalized).toHaveProperty("for", "email-input");
    });

    it("passes through tabindex unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ tabindex: "0" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("tabindex", "0");
    });

    it("passes through readonly unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ readonly: true }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("readonly", true);
    });

    it("passes through id, name, style unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ id: "myId", name: "myName", style: "color:red" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.id).toBe("myId");
      expect(normalized.name).toBe("myName");
      expect(normalized.style).toBe("color:red");
    });

    // ---------------------------------------------------------------
    // aria-* and data-* pass through unchanged
    // ---------------------------------------------------------------

    it("preserves aria-label unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ "aria-label": "Close" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("aria-label", "Close");
    });

    it("preserves data-testid unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ "data-testid": "submit-btn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("data-testid", "submit-btn");
    });

    it("preserves multiple aria-* and data-* attributes", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-hidden": "true",
        "aria-describedby": "desc1",
        "data-id": "123",
        "data-custom": "val",
      };
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify(props) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["aria-hidden"]).toBe("true");
      expect(normalized["aria-describedby"]).toBe("desc1");
      expect(normalized["data-id"]).toBe("123");
      expect(normalized["data-custom"]).toBe("val");
    });

    // ---------------------------------------------------------------
    // Multiple props in one call
    // ---------------------------------------------------------------

    it("normalizes multiple props in a single call", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "handleClick",
        class: "active",
        for: "username",
        tabindex: "1",
        "aria-label": "User",
        "data-testid": "user-field",
      };
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["addEventListener:click"]).toBe("handleClick");
      expect(normalized["classList:add"]).toBe("active");
      expect(normalized.for).toBe("username");
      expect(normalized.tabindex).toBe("1");
      expect(normalized["aria-label"]).toBe("User");
      expect(normalized["data-testid"]).toBe("user-field");
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    it("returns error for empty string props", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: "" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for whitespace-only string props", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: "   \n\t  " },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for invalid JSON", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: "not-json-at-all" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("Invalid JSON");
    });

    it("returns error for truncated JSON", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: '{"onclick": "fn"' },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("Invalid JSON");
    });

    it("returns error for undefined props", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: undefined as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    it("returns error for null props", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: null as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------

    it("handles empty object props", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({}) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("handles props with null values", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onclick: null }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("addEventListener:click", null);
    });

    it("handles props with boolean values", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ readonly: true, disabled: false }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.readonly).toBe(true);
      expect(normalized.disabled).toBe(false);
    });

    it("handles props with numeric values", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ tabindex: 0, maxlength: 255 }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.tabindex).toBe(0);
      expect(normalized.maxlength).toBe(255);
    });

    it("two-character on key is not treated as event handler", async () => {
      const storage = createInMemoryStorage();
      const result = await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ on: "value" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on", "value");
    });
  });

  // ---------------------------------------------------------------
  // integration – normalize and verify storage
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("normalize writes to storage and can be read back", async () => {
      const storage = createInMemoryStorage();
      const props = { onclick: "go", class: "active", "aria-label": "Go" };

      await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify(props) },
        storage,
      );

      const record = await storage.get("output", "vn-1");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("vn-1");

      const stored = JSON.parse(record!.outputs as string);
      expect(stored["addEventListener:click"]).toBe("go");
      expect(stored["classList:add"]).toBe("active");
      expect(stored["aria-label"]).toBe("Go");
    });

    it("normalizing twice with same adapter overwrites storage", async () => {
      const storage = createInMemoryStorage();

      await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onclick: "first" }) },
        storage,
      );

      await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ onclick: "second" }) },
        storage,
      );

      const record = await storage.get("output", "vn-1");
      const stored = JSON.parse(record!.outputs as string);
      expect(stored["addEventListener:click"]).toBe("second");
    });

    it("normalizing with different adapters stores separately", async () => {
      const storage = createInMemoryStorage();

      await vanillaadapterHandler.normalize(
        { adapter: "vn-1", props: JSON.stringify({ class: "a" }) },
        storage,
      );

      await vanillaadapterHandler.normalize(
        { adapter: "vn-2", props: JSON.stringify({ class: "b" }) },
        storage,
      );

      const r1 = await storage.get("output", "vn-1");
      const r2 = await storage.get("output", "vn-2");
      expect(JSON.parse(r1!.outputs as string)["classList:add"]).toBe("a");
      expect(JSON.parse(r2!.outputs as string)["classList:add"]).toBe("b");
    });

    it("error paths do not write to storage", async () => {
      const storage = createInMemoryStorage();

      await vanillaadapterHandler.normalize(
        { adapter: "vn-err", props: "" },
        storage,
      );

      const record = await storage.get("output", "vn-err");
      expect(record).toBeNull();
    });
  });
});
