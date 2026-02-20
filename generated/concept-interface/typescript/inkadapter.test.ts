import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { inkadapterHandler } from "./inkadapter.impl";

describe("InkAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("returns ok with the adapter id and normalized props", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onclick: "handlePress" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("ink-1");
      expect((result as any).normalized).toBeDefined();
    });

    // ---------------------------------------------------------------
    // Event mappings – Ink-specific
    // ---------------------------------------------------------------

    it("maps onclick to onPress", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onPress", "fn");
      expect(normalized).not.toHaveProperty("onclick");
    });

    it("maps onkeydown to onKeyDown", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onkeydown: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onKeyDown", "fn");
      expect(normalized).not.toHaveProperty("onkeydown");
    });

    it("maps onkeyup to onKeyUp", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onkeyup: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onKeyUp", "fn");
      expect(normalized).not.toHaveProperty("onkeyup");
    });

    it("maps onfocus to onFocus", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onfocus: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onFocus", "fn");
      expect(normalized).not.toHaveProperty("onfocus");
    });

    it("maps onblur to onBlur", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onblur: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onBlur", "fn");
      expect(normalized).not.toHaveProperty("onblur");
    });

    // ---------------------------------------------------------------
    // Unknown event handlers are IGNORED
    // ---------------------------------------------------------------

    it("ignores onmouseover (unsupported in terminal)", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onmouseover: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("onmouseover");
      expect(normalized).not.toHaveProperty("onMouseOver");
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores onmousedown (unsupported in terminal)", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onmousedown: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("onmousedown");
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores onchange (unsupported in terminal)", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onchange: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("onchange");
      expect(normalized).not.toHaveProperty("onChange");
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores onsubmit (unsupported in terminal)", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onsubmit: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores ondblclick (unsupported in terminal)", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ ondblclick: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores onscroll (unsupported in terminal)", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onscroll: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores ontouchstart (unsupported in terminal)", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ ontouchstart: "fn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    // ---------------------------------------------------------------
    // class maps to style
    // ---------------------------------------------------------------

    it("maps class to style", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ class: "btn primary" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("style", "btn primary");
      expect(normalized).not.toHaveProperty("class");
      expect(normalized).not.toHaveProperty("className");
    });

    it("preserves style attribute as-is", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ style: "color: red" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("style", "color: red");
    });

    it("when both class and style are provided, style from class overwrites style attr (last key wins)", async () => {
      const storage = createInMemoryStorage();
      // Since JS object iteration order is insertion order, class comes before style
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ class: "cls-value", style: "style-value" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      // class maps to style first, then style overwrites it
      expect(normalized).toHaveProperty("style", "style-value");
    });

    // ---------------------------------------------------------------
    // aria-* attributes are IGNORED (not applicable to terminal)
    // ---------------------------------------------------------------

    it("ignores aria-label", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ "aria-label": "Close" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("aria-label");
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores aria-hidden", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ "aria-hidden": "true" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("aria-hidden");
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores aria-describedby", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ "aria-describedby": "desc" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("aria-describedby");
    });

    it("ignores multiple aria-* attributes simultaneously", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-label": "x",
        "aria-hidden": "true",
        "aria-role": "button",
      };
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    // ---------------------------------------------------------------
    // data-* attributes ARE preserved
    // ---------------------------------------------------------------

    it("preserves data-testid", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ "data-testid": "submit-btn" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("data-testid", "submit-btn");
    });

    it("preserves data-id", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ "data-id": "123" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("data-id", "123");
    });

    it("preserves multiple data-* attributes", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "data-foo": "a",
        "data-bar": "b",
        "data-baz": "c",
      };
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["data-foo"]).toBe("a");
      expect(normalized["data-bar"]).toBe("b");
      expect(normalized["data-baz"]).toBe("c");
    });

    // ---------------------------------------------------------------
    // DOM-only attributes are IGNORED
    // ---------------------------------------------------------------

    it("ignores href", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ href: "https://example.com" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("href");
    });

    it("ignores src", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ src: "/img.png" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("src");
    });

    it("ignores alt", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ alt: "An image" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("alt");
    });

    it("ignores for", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ for: "input-id" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("for");
      expect(normalized).not.toHaveProperty("htmlFor");
    });

    it("ignores tabindex", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ tabindex: "0" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("tabindex");
      expect(normalized).not.toHaveProperty("tabIndex");
    });

    it("ignores readonly", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ readonly: true }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("readonly");
    });

    it("ignores maxlength", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ maxlength: 100 }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("maxlength");
    });

    it("ignores action", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ action: "/submit" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("action");
    });

    it("ignores method", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ method: "POST" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("method");
    });

    it("ignores target", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ target: "_blank" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("target");
    });

    it("ignores rel", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ rel: "noopener" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("rel");
    });

    it("ignores type", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ type: "text" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).not.toHaveProperty("type");
    });

    it("ignores cellpadding, cellspacing, colspan, rowspan", async () => {
      const storage = createInMemoryStorage();
      const props = {
        cellpadding: "5",
        cellspacing: "2",
        colspan: 3,
        rowspan: 2,
      };
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("ignores enctype, crossorigin, autocomplete, autofocus, formaction", async () => {
      const storage = createInMemoryStorage();
      const props = {
        enctype: "multipart/form-data",
        crossorigin: "anonymous",
        autocomplete: "off",
        autofocus: true,
        formaction: "/submit",
      };
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    // ---------------------------------------------------------------
    // Mixed props – verify combined behavior
    // ---------------------------------------------------------------

    it("normalizes mixed props: keeps supported events, data-*, drops aria-*, DOM-only, unknown events", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "handlePress",
        onmouseover: "handleHover",
        class: "container",
        "aria-label": "Main",
        "data-testid": "box",
        href: "https://example.com",
        tabindex: "0",
        id: "main-box",
      };
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);

      // Kept
      expect(normalized.onPress).toBe("handlePress");
      expect(normalized.style).toBe("container");
      expect(normalized["data-testid"]).toBe("box");
      expect(normalized.id).toBe("main-box");

      // Dropped
      expect(normalized).not.toHaveProperty("onmouseover");
      expect(normalized).not.toHaveProperty("aria-label");
      expect(normalized).not.toHaveProperty("href");
      expect(normalized).not.toHaveProperty("tabindex");
      expect(normalized).not.toHaveProperty("class");
      expect(normalized).not.toHaveProperty("onclick");
    });

    // ---------------------------------------------------------------
    // Unknown non-event, non-DOM-only props pass through
    // ---------------------------------------------------------------

    it("passes through unknown non-event, non-DOM-only props", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ id: "myId", name: "myName", customProp: "value" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.id).toBe("myId");
      expect(normalized.name).toBe("myName");
      expect(normalized.customProp).toBe("value");
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    it("returns error for empty string props", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: "" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for whitespace-only string props", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: "   \n\t  " },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("empty");
    });

    it("returns error for invalid JSON", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: "{{broken json}}" },
        storage,
      );
      expect(result.variant).toBe("error");
      expect((result as any).message).toContain("Invalid JSON");
    });

    it("returns error for undefined props", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: undefined as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    it("returns error for null props", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: null as any },
        storage,
      );
      expect(result.variant).toBe("error");
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------

    it("handles empty object props", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({}) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("handles props with null values for supported events", async () => {
      const storage = createInMemoryStorage();
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onclick: null }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized).toHaveProperty("onPress", null);
    });

    it("all props are DOM-only results in empty normalized output", async () => {
      const storage = createInMemoryStorage();
      const props = {
        href: "link",
        src: "image",
        alt: "text",
        for: "id",
        tabindex: "0",
        readonly: true,
      };
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("all props are unsupported events results in empty normalized output", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onmouseover: "fn",
        onmouseout: "fn",
        onmouseenter: "fn",
        onmouseleave: "fn",
        ondblclick: "fn",
        onscroll: "fn",
      };
      const result = await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // integration – normalize and verify storage
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("normalize writes to storage and can be read back", async () => {
      const storage = createInMemoryStorage();
      const props = { onclick: "go", class: "active", "data-testid": "Go" };

      await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify(props) },
        storage,
      );

      const record = await storage.get("output", "ink-1");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("ink-1");

      const stored = JSON.parse(record!.outputs as string);
      expect(stored.onPress).toBe("go");
      expect(stored.style).toBe("active");
      expect(stored["data-testid"]).toBe("Go");
      // aria-* would not be present
    });

    it("normalizing twice with same adapter overwrites storage", async () => {
      const storage = createInMemoryStorage();

      await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onclick: "first" }) },
        storage,
      );

      await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ onclick: "second" }) },
        storage,
      );

      const record = await storage.get("output", "ink-1");
      const stored = JSON.parse(record!.outputs as string);
      expect(stored.onPress).toBe("second");
    });

    it("normalizing with different adapters stores separately", async () => {
      const storage = createInMemoryStorage();

      await inkadapterHandler.normalize(
        { adapter: "ink-1", props: JSON.stringify({ "data-id": "a" }) },
        storage,
      );

      await inkadapterHandler.normalize(
        { adapter: "ink-2", props: JSON.stringify({ "data-id": "b" }) },
        storage,
      );

      const r1 = await storage.get("output", "ink-1");
      const r2 = await storage.get("output", "ink-2");
      expect(JSON.parse(r1!.outputs as string)["data-id"]).toBe("a");
      expect(JSON.parse(r2!.outputs as string)["data-id"]).toBe("b");
    });

    it("error paths do not write to storage", async () => {
      const storage = createInMemoryStorage();

      await inkadapterHandler.normalize(
        { adapter: "ink-err", props: "" },
        storage,
      );

      const record = await storage.get("output", "ink-err");
      expect(record).toBeNull();
    });

    it("storage output with all-dropped props still stores an empty object", async () => {
      const storage = createInMemoryStorage();

      await inkadapterHandler.normalize(
        { adapter: "ink-empty", props: JSON.stringify({ href: "link", "aria-label": "x", onmouseover: "fn" }) },
        storage,
      );

      const record = await storage.get("output", "ink-empty");
      expect(record).not.toBeNull();
      const stored = JSON.parse(record!.outputs as string);
      expect(Object.keys(stored)).toHaveLength(0);
    });
  });
});
