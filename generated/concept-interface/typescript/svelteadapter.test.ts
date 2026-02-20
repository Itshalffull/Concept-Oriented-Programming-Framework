import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { svelteadapterHandler } from "./svelteadapter.impl";

describe("SvelteAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("returns ok with the adapter id and normalized props", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("sv-1");
      expect((result as any).normalized).toBeDefined();
    });

    // ---------------------------------------------------------------
    // Event mappings – on:event format
    // ---------------------------------------------------------------

    it("maps onclick to on:click", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:click", "fn");
      expect(normalized).not.toHaveProperty("onclick");
    });

    it("maps onchange to on:change", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onchange: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:change", "fn");
      expect(normalized).not.toHaveProperty("onchange");
    });

    it("maps onsubmit to on:submit", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onsubmit: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:submit", "fn");
    });

    it("maps oninput to on:input", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ oninput: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:input", "fn");
    });

    it("maps onblur to on:blur", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onblur: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:blur", "fn");
    });

    it("maps onfocus to on:focus", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onfocus: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:focus", "fn");
    });

    it("maps onkeydown to on:keydown", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onkeydown: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:keydown", "fn");
    });

    it("maps onkeyup to on:keyup", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onkeyup: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:keyup", "fn");
    });

    it("maps onmouseover to on:mouseover", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onmouseover: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:mouseover", "fn");
    });

    it("maps ondblclick to on:dblclick", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ ondblclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:dblclick", "fn");
    });

    it("maps onscroll to on:scroll", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onscroll: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:scroll", "fn");
    });

    it("does not re-prefix keys that already start with on:", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ "on:click": "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:click", "fn");
      expect(normalized).not.toHaveProperty("on:on:click");
    });

    // ---------------------------------------------------------------
    // Attribute mappings – class stays as class
    // ---------------------------------------------------------------

    it("keeps class as class (does NOT map to className)", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ class: "btn primary" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("class", "btn primary");
      expect(normalized).not.toHaveProperty("className");
    });

    it("maps for to htmlFor", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ for: "email-input" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("htmlFor", "email-input");
      expect(normalized).not.toHaveProperty("for");
    });

    it("maps tabindex to tabIndex", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ tabindex: "0" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("tabIndex", "0");
      expect(normalized).not.toHaveProperty("tabindex");
    });

    it("passes through attributes not in the attr map unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ readonly: true, maxlength: 100 }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      // Svelte only maps for and tabindex; others pass through
      expect(normalized).toHaveProperty("readonly", true);
      expect(normalized).toHaveProperty("maxlength", 100);
    });

    // ---------------------------------------------------------------
    // aria-* and data-* pass through unchanged
    // ---------------------------------------------------------------

    it("preserves aria-label unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ "aria-label": "Close" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("aria-label", "Close");
    });

    it("preserves data-testid unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ "data-testid": "submit-btn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("data-testid", "submit-btn");
    });

    it("preserves multiple aria-* and data-* attributes", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-hidden": "true",
        "aria-role": "button",
        "data-id": "123",
        "data-value": "abc",
      };
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify(props) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["aria-hidden"]).toBe("true");
      expect(normalized["aria-role"]).toBe("button");
      expect(normalized["data-id"]).toBe("123");
      expect(normalized["data-value"]).toBe("abc");
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
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["on:click"]).toBe("handleClick");
      expect(normalized.class).toBe("active");
      expect(normalized.htmlFor).toBe("username");
      expect(normalized.tabIndex).toBe("1");
      expect(normalized["aria-label"]).toBe("User");
      expect(normalized["data-testid"]).toBe("user-field");
    });

    // ---------------------------------------------------------------
    // Unknown props pass through
    // ---------------------------------------------------------------

    it("passes through unknown props unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ id: "myId", name: "myName", style: "color:red" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.id).toBe("myId");
      expect(normalized.name).toBe("myName");
      expect(normalized.style).toBe("color:red");
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    it("returns error for empty string props", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: "" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for whitespace-only string props", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: "   \n\t  " },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for invalid JSON", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: "{{broken json}}" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("Invalid JSON");
    });

    it("returns error for undefined props", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: undefined as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    it("returns error for null props", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: null as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------

    it("handles empty object props", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({}) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("handles props with null values", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onclick: null }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("on:click", null);
    });

    it("two-character on key is not treated as event handler", async () => {
      const storage = createInMemoryStorage();
      const result = await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ on: "value" }) },
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

      await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify(props) },
        storage,
      );

      const record = await storage.get("output", "sv-1");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("sv-1");

      const stored = JSON.parse(record!.outputs as string);
      expect(stored["on:click"]).toBe("go");
      expect(stored.class).toBe("active");
      expect(stored["aria-label"]).toBe("Go");
    });

    it("normalizing twice with same adapter overwrites storage", async () => {
      const storage = createInMemoryStorage();

      await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onclick: "first" }) },
        storage,
      );

      await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ onclick: "second" }) },
        storage,
      );

      const record = await storage.get("output", "sv-1");
      const stored = JSON.parse(record!.outputs as string);
      expect(stored["on:click"]).toBe("second");
    });

    it("normalizing with different adapters stores separately", async () => {
      const storage = createInMemoryStorage();

      await svelteadapterHandler.normalize(
        { adapter: "sv-1", props: JSON.stringify({ class: "a" }) },
        storage,
      );

      await svelteadapterHandler.normalize(
        { adapter: "sv-2", props: JSON.stringify({ class: "b" }) },
        storage,
      );

      const r1 = await storage.get("output", "sv-1");
      const r2 = await storage.get("output", "sv-2");
      expect(JSON.parse(r1!.outputs as string).class).toBe("a");
      expect(JSON.parse(r2!.outputs as string).class).toBe("b");
    });

    it("error paths do not write to storage", async () => {
      const storage = createInMemoryStorage();

      await svelteadapterHandler.normalize(
        { adapter: "sv-err", props: "" },
        storage,
      );

      const record = await storage.get("output", "sv-err");
      expect(record).toBeNull();
    });
  });
});
