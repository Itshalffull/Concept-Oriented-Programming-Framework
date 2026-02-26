import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { reactadapterHandler } from "./reactadapter.impl";

describe("ReactAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("returns ok with the adapter id and normalized props", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("ra-1");
      expect((result as any).normalized).toBeDefined();
    });

    // ---------------------------------------------------------------
    // Event mappings – camelCase
    // ---------------------------------------------------------------

    it("maps onclick to onClick", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onClick", "fn");
      expect(normalized).not.toHaveProperty("onclick");
    });

    it("maps onchange to onChange", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onchange: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onChange", "fn");
      expect(normalized).not.toHaveProperty("onchange");
    });

    it("maps onsubmit to onSubmit", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onsubmit: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onSubmit", "fn");
    });

    it("maps oninput to onInput", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ oninput: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onInput", "fn");
    });

    it("maps onblur to onBlur", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onblur: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onBlur", "fn");
    });

    it("maps onfocus to onFocus", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onfocus: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onFocus", "fn");
    });

    it("maps onkeydown to onKeyDown", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onkeydown: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onKeyDown", "fn");
    });

    it("maps onkeyup to onKeyUp", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onkeyup: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onKeyUp", "fn");
    });

    it("maps onkeypress to onKeyPress", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onkeypress: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onKeyPress", "fn");
    });

    it("maps onmousedown to onMouseDown", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onmousedown: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onMouseDown", "fn");
    });

    it("maps onmouseup to onMouseUp", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onmouseup: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onMouseUp", "fn");
    });

    it("maps onmouseover to onMouseOver", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onmouseover: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onMouseOver", "fn");
    });

    it("maps onmouseout to onMouseOut", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onmouseout: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onMouseOut", "fn");
    });

    it("maps onmouseenter to onMouseEnter", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onmouseenter: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onMouseEnter", "fn");
    });

    it("maps onmouseleave to onMouseLeave", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onmouseleave: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onMouseLeave", "fn");
    });

    it("maps ondblclick to onDoubleClick", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ ondblclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onDoubleClick", "fn");
    });

    it("maps onscroll to onScroll", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onscroll: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onScroll", "fn");
    });

    it("maps onwheel to onWheel", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onwheel: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onWheel", "fn");
    });

    it("maps ondrag to onDrag", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ ondrag: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onDrag", "fn");
    });

    it("maps ondrop to onDrop", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ ondrop: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onDrop", "fn");
    });

    it("maps ontouchstart to onTouchStart", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ ontouchstart: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onTouchStart", "fn");
    });

    it("maps ontouchend to onTouchEnd", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ ontouchend: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onTouchEnd", "fn");
    });

    it("maps ontouchmove to onTouchMove", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ ontouchmove: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onTouchMove", "fn");
    });

    // ---------------------------------------------------------------
    // Attribute mappings
    // ---------------------------------------------------------------

    it("maps class to className", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ class: "btn primary" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("className", "btn primary");
      expect(normalized).not.toHaveProperty("class");
    });

    it("maps for to htmlFor", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ for: "email-input" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("htmlFor", "email-input");
      expect(normalized).not.toHaveProperty("for");
    });

    it("maps tabindex to tabIndex", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ tabindex: "0" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("tabIndex", "0");
      expect(normalized).not.toHaveProperty("tabindex");
    });

    it("maps readonly to readOnly", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ readonly: true }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("readOnly", true);
    });

    it("maps maxlength to maxLength", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ maxlength: 100 }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("maxLength", 100);
    });

    it("maps cellpadding to cellPadding", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ cellpadding: "5" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("cellPadding", "5");
    });

    it("maps cellspacing to cellSpacing", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ cellspacing: "2" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("cellSpacing", "2");
    });

    it("maps colspan to colSpan", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ colspan: 3 }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("colSpan", 3);
    });

    it("maps rowspan to rowSpan", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ rowspan: 2 }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("rowSpan", 2);
    });

    it("maps enctype to encType", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ enctype: "multipart/form-data" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("encType", "multipart/form-data");
    });

    it("maps crossorigin to crossOrigin", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ crossorigin: "anonymous" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("crossOrigin", "anonymous");
    });

    it("maps autocomplete to autoComplete", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ autocomplete: "off" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("autoComplete", "off");
    });

    it("maps autofocus to autoFocus", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ autofocus: true }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("autoFocus", true);
    });

    it("maps formaction to formAction", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ formaction: "/submit" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("formAction", "/submit");
    });

    // ---------------------------------------------------------------
    // aria-* and data-* pass through unchanged
    // ---------------------------------------------------------------

    it("preserves aria-label unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ "aria-label": "Close" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("aria-label", "Close");
    });

    it("preserves data-testid unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ "data-testid": "submit-btn" }) },
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
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify(props) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["aria-hidden"]).toBe("true");
      expect(normalized["aria-role"]).toBe("button");
      expect(normalized["data-id"]).toBe("123");
      expect(normalized["data-value"]).toBe("abc");
    });

    it("normalizes a props object with only aria/data attributes", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-label": "info",
        "data-tooltip": "hover me",
      };
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["aria-label"]).toBe("info");
      expect(normalized["data-tooltip"]).toBe("hover me");
      expect(Object.keys(normalized)).toHaveLength(2);
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
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.onClick).toBe("handleClick");
      expect(normalized.className).toBe("active");
      expect(normalized.htmlFor).toBe("username");
      expect(normalized.tabIndex).toBe("1");
      expect(normalized["aria-label"]).toBe("User");
      expect(normalized["data-testid"]).toBe("user-field");
      // Ensure old keys are not present
      expect(normalized).not.toHaveProperty("onclick");
      expect(normalized).not.toHaveProperty("class");
      expect(normalized).not.toHaveProperty("for");
      expect(normalized).not.toHaveProperty("tabindex");
    });

    // ---------------------------------------------------------------
    // Unknown props pass through
    // ---------------------------------------------------------------

    it("passes through unknown props unchanged", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ id: "myId", name: "myName", style: "color:red" }) },
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
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: "" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for whitespace-only string props", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: "   \t\n  " },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for invalid JSON", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: "{not valid json!!}" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("Invalid JSON");
    });

    it("returns error for undefined props", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: undefined as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    it("returns error for null-like falsy props", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: null as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------

    it("handles empty object props (no keys to normalize)", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({}) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("handles props with null values", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onclick: null }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onClick", null);
    });

    it("handles props with boolean values", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ readonly: true, autofocus: false }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.readOnly).toBe(true);
      expect(normalized.autoFocus).toBe(false);
    });

    it("handles props with numeric values", async () => {
      const storage = createInMemoryStorage();
      const result = await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ tabindex: 0, maxlength: 255 }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.tabIndex).toBe(0);
      expect(normalized.maxLength).toBe(255);
    });
  });

  // ---------------------------------------------------------------
  // integration – normalize and verify storage
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("normalize writes to storage and can be read back", async () => {
      const storage = createInMemoryStorage();
      const props = { onclick: "go", class: "active", "aria-label": "Go" };

      await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify(props) },
        storage,
      );

      const record = await storage.get("output", "ra-1");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("ra-1");

      const stored = JSON.parse(record!.outputs as string);
      expect(stored.onClick).toBe("go");
      expect(stored.className).toBe("active");
      expect(stored["aria-label"]).toBe("Go");
    });

    it("normalizing twice with same adapter overwrites storage", async () => {
      const storage = createInMemoryStorage();

      await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onclick: "first" }) },
        storage,
      );

      await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ onclick: "second" }) },
        storage,
      );

      const record = await storage.get("output", "ra-1");
      const stored = JSON.parse(record!.outputs as string);
      expect(stored.onClick).toBe("second");
    });

    it("normalizing with different adapters stores separately", async () => {
      const storage = createInMemoryStorage();

      await reactadapterHandler.normalize(
        { adapter: "ra-1", props: JSON.stringify({ class: "a" }) },
        storage,
      );

      await reactadapterHandler.normalize(
        { adapter: "ra-2", props: JSON.stringify({ class: "b" }) },
        storage,
      );

      const r1 = await storage.get("output", "ra-1");
      const r2 = await storage.get("output", "ra-2");
      expect(JSON.parse(r1!.outputs as string).className).toBe("a");
      expect(JSON.parse(r2!.outputs as string).className).toBe("b");
    });

    it("error paths do not write to storage", async () => {
      const storage = createInMemoryStorage();

      await reactadapterHandler.normalize(
        { adapter: "ra-err", props: "" },
        storage,
      );

      const record = await storage.get("output", "ra-err");
      expect(record).toBeNull();
    });
  });
});
