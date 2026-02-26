import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { watchkitadapterHandler } from "./watchkitadapter.impl";

describe("WatchKitAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple props object and returns ok with adapter id", async () => {
      const storage = createInMemoryStorage();
      const result = await watchkitadapterHandler.normalize(
        { adapter: "wk-1", props: JSON.stringify({ title: "Hello" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("wk-1");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.title).toBe("Hello");
    });

    it("returns the normalized result as a JSON string", async () => {
      const storage = createInMemoryStorage();
      const result = await watchkitadapterHandler.normalize(
        { adapter: "wk-2", props: JSON.stringify({ onclick: "handler" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect(typeof (result as any).normalized).toBe("string");
      expect(() => JSON.parse((result as any).normalized)).not.toThrow();
    });

    // ---------------------------------------------------------------
    // Event handler mappings
    // ---------------------------------------------------------------

    describe("event handler mappings", () => {
      it("maps onclick to onTapGesture", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ev", props: JSON.stringify({ onclick: "handleTap" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onTapGesture", "handleTap");
        expect(normalized).not.toHaveProperty("onclick");
      });

      it("maps onClick (mixed case) to onTapGesture via lowercasing", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ev", props: JSON.stringify({ onClick: "handleTap" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onTapGesture", "handleTap");
      });

      it("maps ondblclick to onTapGesture:count:2", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ev", props: JSON.stringify({ ondblclick: "handleDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onTapGesture:count:2", "handleDbl");
        expect(normalized).not.toHaveProperty("ondblclick");
      });

      it("maps onchange to onChange", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ev", props: JSON.stringify({ onchange: "handleChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onChange", "handleChange");
        expect(normalized).not.toHaveProperty("onchange");
      });

      it("maps onscroll to digitalCrownRotation (WatchKit-specific)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ev", props: JSON.stringify({ onscroll: "handleScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("digitalCrownRotation", "handleScroll");
        expect(normalized).not.toHaveProperty("onscroll");
        expect(normalized).not.toHaveProperty("onScroll");
      });

      it("maps onfocus to onFocusChange", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ev", props: JSON.stringify({ onfocus: "handleFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onFocusChange", "handleFocus");
      });

      it("maps onsubmit to onSubmit", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ev", props: JSON.stringify({ onsubmit: "handleSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onSubmit", "handleSubmit");
      });
    });

    // ---------------------------------------------------------------
    // Ignored events (not applicable on watchOS)
    // ---------------------------------------------------------------

    describe("ignored events (no watchOS equivalent)", () => {
      it("ignores onmouseover (no pointer on watchOS)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ig", props: JSON.stringify({ onmouseover: "handleHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("onmouseover");
        expect(normalized).not.toHaveProperty("onHover");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores onmouseenter (no pointer on watchOS)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ig", props: JSON.stringify({ onmouseenter: "handleEnter" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("onmouseenter");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores onmouseleave (no pointer on watchOS)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ig", props: JSON.stringify({ onmouseleave: "handleLeave" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("onmouseleave");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores ondrag (not supported on watchOS)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ig", props: JSON.stringify({ ondrag: "handleDrag" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("ondrag");
        expect(normalized).not.toHaveProperty("onDrag");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores ondrop (not supported on watchOS)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-ig", props: JSON.stringify({ ondrop: "handleDrop" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("ondrop");
        expect(normalized).not.toHaveProperty("onDrop");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores all mouse/drag events while keeping valid events", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          {
            adapter: "wk-ig",
            props: JSON.stringify({
              onclick: "valid",
              onmouseover: "skip",
              onmouseenter: "skip",
              onmouseleave: "skip",
              ondrag: "skip",
              ondrop: "skip",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(1);
        expect(normalized.onTapGesture).toBe("valid");
      });
    });

    // ---------------------------------------------------------------
    // class / className -> viewModifier
    // ---------------------------------------------------------------

    describe("class -> viewModifier mapping", () => {
      it("maps class to viewModifier", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-cls", props: JSON.stringify({ class: "container" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("viewModifier", "container");
        expect(normalized).not.toHaveProperty("class");
      });

      it("maps className to viewModifier", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-cls", props: JSON.stringify({ className: "box" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("viewModifier", "box");
        expect(normalized).not.toHaveProperty("className");
      });

      it("maps style to modifierStyle (inline modifier chain)", async () => {
        const storage = createInMemoryStorage();
        const inlineStyle = { color: "green", fontSize: 12 };
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-cls", props: JSON.stringify({ style: inlineStyle }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("modifierStyle");
        expect(normalized.modifierStyle).toEqual(inlineStyle);
        expect(normalized).not.toHaveProperty("style");
      });
    });

    // ---------------------------------------------------------------
    // ARIA attributes -> watchOS accessibility
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to accessibilityLabel", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-a11y", props: JSON.stringify({ "aria-label": "Close" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibilityLabel", "Close");
      });

      it("maps aria-hidden to accessibilityHidden", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-a11y", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibilityHidden", "true");
      });

      it("maps aria-role to accessibilityAddTraits", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-a11y", props: JSON.stringify({ "aria-role": "button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibilityAddTraits", "button");
      });

      it("maps other aria-* attributes to accessibility:<key> prefix", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          {
            adapter: "wk-a11y",
            props: JSON.stringify({
              "aria-expanded": "true",
              "aria-describedby": "desc-1",
              "aria-valuenow": "50",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibility:expanded", "true");
        expect(normalized).toHaveProperty("accessibility:describedby", "desc-1");
        expect(normalized).toHaveProperty("accessibility:valuenow", "50");
      });

      it("WatchKit does NOT have special aria-valuenow mapping (unlike SwiftUI)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-a11y", props: JSON.stringify({ "aria-valuenow": "75" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        // WatchKit maps aria-valuenow to accessibility:valuenow (generic), not accessibilityValue
        expect(normalized).toHaveProperty("accessibility:valuenow", "75");
        expect(normalized).not.toHaveProperty("accessibilityValue");
      });

      it("maps multiple supported aria-* attributes in a single call", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          {
            adapter: "wk-a11y",
            props: JSON.stringify({
              "aria-label": "Submit",
              "aria-hidden": "false",
              "aria-role": "link",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.accessibilityLabel).toBe("Submit");
        expect(normalized.accessibilityHidden).toBe("false");
        expect(normalized.accessibilityAddTraits).toBe("link");
      });
    });

    // ---------------------------------------------------------------
    // data-* attributes -> environment keys
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to environment:testid", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-data", props: JSON.stringify({ "data-testid": "my-view" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("environment:testid", "my-view");
        expect(normalized).not.toHaveProperty("data-testid");
      });

      it("maps data-custom to environment:custom", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-data", props: JSON.stringify({ "data-custom": "value123" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("environment:custom", "value123");
      });

      it("maps multiple data-* attributes to environment: keys", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          {
            adapter: "wk-data",
            props: JSON.stringify({
              "data-testid": "btn",
              "data-index": "3",
              "data-variant": "compact",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["environment:testid"]).toBe("btn");
        expect(normalized["environment:index"]).toBe("3");
        expect(normalized["environment:variant"]).toBe("compact");
      });
    });

    // ---------------------------------------------------------------
    // Passthrough of unknown props
    // ---------------------------------------------------------------

    describe("passthrough of unknown props", () => {
      it("passes through unknown props as modifiers preserving key casing", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-pt", props: JSON.stringify({ foregroundColor: "blue", cornerRadius: 8 }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.foregroundColor).toBe("blue");
        expect(normalized.cornerRadius).toBe(8);
      });
    });

    // ---------------------------------------------------------------
    // Combined / complex props
    // ---------------------------------------------------------------

    describe("combined prop mapping", () => {
      it("correctly maps a mix of events, class, style, aria, data, ignored, and passthrough", async () => {
        const storage = createInMemoryStorage();
        const mixedProps = {
          onclick: "tapHandler",
          ondblclick: "dblHandler",
          onscroll: "crownHandler",
          onmouseover: "skipMe",
          ondrag: "skipMe",
          class: "watch-view",
          style: { padding: 4 },
          "aria-label": "Watch Header",
          "aria-role": "header",
          "aria-expanded": "true",
          "data-testid": "hdr",
          customModifier: "keep",
        };
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-mix", props: JSON.stringify(mixedProps) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);

        // Event mappings
        expect(normalized.onTapGesture).toBe("tapHandler");
        expect(normalized["onTapGesture:count:2"]).toBe("dblHandler");
        expect(normalized.digitalCrownRotation).toBe("crownHandler");
        // Ignored events
        expect(normalized).not.toHaveProperty("onmouseover");
        expect(normalized).not.toHaveProperty("onHover");
        expect(normalized).not.toHaveProperty("ondrag");
        expect(normalized).not.toHaveProperty("onDrag");
        // Class/style
        expect(normalized.viewModifier).toBe("watch-view");
        expect(normalized.modifierStyle).toEqual({ padding: 4 });
        // Accessibility
        expect(normalized.accessibilityLabel).toBe("Watch Header");
        expect(normalized.accessibilityAddTraits).toBe("header");
        expect(normalized["accessibility:expanded"]).toBe("true");
        // Data -> environment
        expect(normalized["environment:testid"]).toBe("hdr");
        // Passthrough
        expect(normalized.customModifier).toBe("keep");
      });
    });

    // ---------------------------------------------------------------
    // Comparison with SwiftUI adapter (WatchKit-specific differences)
    // ---------------------------------------------------------------

    describe("WatchKit-specific differences from SwiftUI", () => {
      it("maps onscroll to digitalCrownRotation (SwiftUI uses onScroll)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-diff", props: JSON.stringify({ onscroll: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("digitalCrownRotation", "handler");
        expect(normalized).not.toHaveProperty("onScroll");
      });

      it("ignores onmouseover (SwiftUI maps to onHover)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-diff", props: JSON.stringify({ onmouseover: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("onHover");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores ondrag (SwiftUI maps to onDrag)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-diff", props: JSON.stringify({ ondrag: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("onDrag");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores ondrop (SwiftUI maps to onDrop)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-diff", props: JSON.stringify({ ondrop: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("onDrop");
        expect(Object.keys(normalized)).toHaveLength(0);
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error for empty props string", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-err", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for whitespace-only props string", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-err", props: "   " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-err", props: "not json {{" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error for undefined props", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-err", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for null props (falsy)", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-err", props: null as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for tab/newline whitespace-only props", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-err", props: "\t\n  " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });
    });

    // ---------------------------------------------------------------
    // Storage side effects
    // ---------------------------------------------------------------

    describe("storage side effects", () => {
      it("writes normalized output to storage under the output relation", async () => {
        const storage = createInMemoryStorage();
        await watchkitadapterHandler.normalize(
          { adapter: "wk-store", props: JSON.stringify({ onclick: "tap" }) },
          storage,
        );

        const record = await storage.get("output", "wk-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("wk-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs.onTapGesture).toBe("tap");
      });

      it("overwrites previous storage on re-normalize with same adapter", async () => {
        const storage = createInMemoryStorage();
        await watchkitadapterHandler.normalize(
          { adapter: "wk-ow", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await watchkitadapterHandler.normalize(
          { adapter: "wk-ow", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "wk-ow");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs.onTapGesture).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await watchkitadapterHandler.normalize(
          { adapter: "wk-nowrite", props: "" },
          storage,
        );

        const record = await storage.get("output", "wk-nowrite");
        expect(record).toBeNull();
      });

      it("stores result when props contain only environment keys", async () => {
        const storage = createInMemoryStorage();
        await watchkitadapterHandler.normalize(
          {
            adapter: "wk-env",
            props: JSON.stringify({ "data-theme": "dark", "data-size": "compact" }),
          },
          storage,
        );

        const record = await storage.get("output", "wk-env");
        expect(record).not.toBeNull();
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["environment:theme"]).toBe("dark");
        expect(outputs["environment:size"]).toBe("compact");
      });

      it("stores empty result when all props are ignored", async () => {
        const storage = createInMemoryStorage();
        await watchkitadapterHandler.normalize(
          {
            adapter: "wk-allskip",
            props: JSON.stringify({
              onmouseover: "skip",
              onmouseenter: "skip",
              onmouseleave: "skip",
              ondrag: "skip",
              ondrop: "skip",
            }),
          },
          storage,
        );

        const record = await storage.get("output", "wk-allskip");
        expect(record).not.toBeNull();
        const outputs = JSON.parse(record!.outputs as string);
        expect(Object.keys(outputs)).toHaveLength(0);
      });
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------

    describe("edge cases", () => {
      it("handles empty object props", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-edge", props: JSON.stringify({}) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("handles props with null values", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-edge", props: JSON.stringify({ onclick: null }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.onTapGesture).toBeNull();
      });

      it("handles props with numeric values", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-edge", props: JSON.stringify({ "data-count": 42 }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["environment:count"]).toBe(42);
      });

      it("handles props with boolean values", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-edge", props: JSON.stringify({ "aria-hidden": true }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.accessibilityHidden).toBe(true);
      });

      it("preserves original key casing for passthrough props", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-edge", props: JSON.stringify({ myCustomModifier: "value" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("myCustomModifier", "value");
      });

      it("handles large number of props without error", async () => {
        const storage = createInMemoryStorage();
        const manyProps: Record<string, string> = {};
        for (let i = 0; i < 100; i++) {
          manyProps[`prop${i}`] = `value${i}`;
        }
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-edge", props: JSON.stringify(manyProps) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(100);
      });

      it("both onclick and ondblclick can coexist in the same props", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          {
            adapter: "wk-edge",
            props: JSON.stringify({
              onclick: "singleTap",
              ondblclick: "doubleTap",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.onTapGesture).toBe("singleTap");
        expect(normalized["onTapGesture:count:2"]).toBe("doubleTap");
      });

      it("digital crown rotation value can be numeric", async () => {
        const storage = createInMemoryStorage();
        const result = await watchkitadapterHandler.normalize(
          { adapter: "wk-edge", props: JSON.stringify({ onscroll: 0.5 }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.digitalCrownRotation).toBe(0.5);
      });
    });
  });

  // ---------------------------------------------------------------
  // integration
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("normalize -> storage read-back -> re-normalize produces consistent results", async () => {
      const storage = createInMemoryStorage();

      // Step 1: normalize initial props
      const firstResult = await watchkitadapterHandler.normalize(
        {
          adapter: "wk-integ",
          props: JSON.stringify({
            onclick: "handleTap",
            onscroll: "handleCrown",
            class: "main",
            "aria-label": "Main content",
            "data-testid": "main-view",
          }),
        },
        storage,
      );
      expect(firstResult.variant).toBe("ok");

      // Step 2: read back from storage
      const record = await storage.get("output", "wk-integ");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("wk-integ");

      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs.onTapGesture).toBe("handleTap");
      expect(storedOutputs.digitalCrownRotation).toBe("handleCrown");
      expect(storedOutputs.viewModifier).toBe("main");
      expect(storedOutputs.accessibilityLabel).toBe("Main content");
      expect(storedOutputs["environment:testid"]).toBe("main-view");

      // Step 3: re-normalize with updated props
      const secondResult = await watchkitadapterHandler.normalize(
        {
          adapter: "wk-integ",
          props: JSON.stringify({
            onclick: "handleTap2",
            onscroll: "handleCrown2",
            class: "updated",
            "aria-label": "Updated content",
            "data-testid": "updated-view",
          }),
        },
        storage,
      );
      expect(secondResult.variant).toBe("ok");

      // Step 4: verify storage was updated
      const updatedRecord = await storage.get("output", "wk-integ");
      const updatedOutputs = JSON.parse(updatedRecord!.outputs as string);
      expect(updatedOutputs.onTapGesture).toBe("handleTap2");
      expect(updatedOutputs.digitalCrownRotation).toBe("handleCrown2");
      expect(updatedOutputs.viewModifier).toBe("updated");
      expect(updatedOutputs.accessibilityLabel).toBe("Updated content");
      expect(updatedOutputs["environment:testid"]).toBe("updated-view");
    });

    it("multiple adapters can coexist in storage", async () => {
      const storage = createInMemoryStorage();

      await watchkitadapterHandler.normalize(
        { adapter: "adapter-a", props: JSON.stringify({ onclick: "a-tap" }) },
        storage,
      );
      await watchkitadapterHandler.normalize(
        { adapter: "adapter-b", props: JSON.stringify({ onclick: "b-tap" }) },
        storage,
      );

      const recordA = await storage.get("output", "adapter-a");
      const recordB = await storage.get("output", "adapter-b");
      expect(recordA).not.toBeNull();
      expect(recordB).not.toBeNull();

      const outputsA = JSON.parse(recordA!.outputs as string);
      const outputsB = JSON.parse(recordB!.outputs as string);
      expect(outputsA.onTapGesture).toBe("a-tap");
      expect(outputsB.onTapGesture).toBe("b-tap");
    });

    it("error normalize does not corrupt existing storage entry", async () => {
      const storage = createInMemoryStorage();

      // Successful normalize
      await watchkitadapterHandler.normalize(
        { adapter: "wk-safe", props: JSON.stringify({ onclick: "first" }) },
        storage,
      );

      // Failed normalize with same adapter
      const errResult = await watchkitadapterHandler.normalize(
        { adapter: "wk-safe", props: "" },
        storage,
      );
      expect(errResult.variant).toBe("error");

      // Original storage entry should still be intact
      const record = await storage.get("output", "wk-safe");
      expect(record).not.toBeNull();
      const outputs = JSON.parse(record!.outputs as string);
      expect(outputs.onTapGesture).toBe("first");
    });

    it("full watch scenario: tap + crown + accessibility + environment", async () => {
      const storage = createInMemoryStorage();

      const result = await watchkitadapterHandler.normalize(
        {
          adapter: "wk-full",
          props: JSON.stringify({
            onclick: "selectItem",
            ondblclick: "expandItem",
            onscroll: "scrollList",
            onfocus: "focusItem",
            onsubmit: "submitForm",
            onmouseover: "ignored",
            ondrag: "ignored",
            class: "watch-list-item",
            style: { height: 44 },
            "aria-label": "List item",
            "aria-hidden": "false",
            "aria-role": "listitem",
            "aria-expanded": "true",
            "data-testid": "item-1",
            "data-index": "0",
            customFlag: true,
          }),
        },
        storage,
      );
      expect(result.variant).toBe("ok");

      const normalized = JSON.parse((result as any).normalized);
      // Events
      expect(normalized.onTapGesture).toBe("selectItem");
      expect(normalized["onTapGesture:count:2"]).toBe("expandItem");
      expect(normalized.digitalCrownRotation).toBe("scrollList");
      expect(normalized.onFocusChange).toBe("focusItem");
      expect(normalized.onSubmit).toBe("submitForm");
      // Ignored
      expect(normalized).not.toHaveProperty("onHover");
      expect(normalized).not.toHaveProperty("onDrag");
      // Class/Style
      expect(normalized.viewModifier).toBe("watch-list-item");
      expect(normalized.modifierStyle).toEqual({ height: 44 });
      // Accessibility
      expect(normalized.accessibilityLabel).toBe("List item");
      expect(normalized.accessibilityHidden).toBe("false");
      expect(normalized.accessibilityAddTraits).toBe("listitem");
      expect(normalized["accessibility:expanded"]).toBe("true");
      // Environment
      expect(normalized["environment:testid"]).toBe("item-1");
      expect(normalized["environment:index"]).toBe("0");
      // Passthrough
      expect(normalized.customFlag).toBe(true);

      // Verify storage
      const record = await storage.get("output", "wk-full");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("wk-full");
    });
  });
});
