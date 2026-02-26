import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { swiftuiadapterHandler } from "./swiftuiadapter.impl";

describe("SwiftUIAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple props object and returns ok with adapter id", async () => {
      const storage = createInMemoryStorage();
      const result = await swiftuiadapterHandler.normalize(
        { adapter: "sui-1", props: JSON.stringify({ title: "Hello" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("sui-1");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.title).toBe("Hello");
    });

    it("returns the normalized result as a JSON string", async () => {
      const storage = createInMemoryStorage();
      const result = await swiftuiadapterHandler.normalize(
        { adapter: "sui-2", props: JSON.stringify({ onclick: "handler" }) },
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
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onclick: "handleTap" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onTapGesture", "handleTap");
        expect(normalized).not.toHaveProperty("onclick");
      });

      it("maps onClick (mixed case) to onTapGesture via lowercasing", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onClick: "handleTap" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onTapGesture", "handleTap");
      });

      it("maps ondblclick to onTapGesture:count:2", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ ondblclick: "handleDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onTapGesture:count:2", "handleDbl");
        expect(normalized).not.toHaveProperty("ondblclick");
      });

      it("maps onchange to onChange", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onchange: "handleChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onChange", "handleChange");
        expect(normalized).not.toHaveProperty("onchange");
      });

      it("maps onscroll to onScroll", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onscroll: "handleScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onScroll", "handleScroll");
      });

      it("maps onfocus to onFocusChange", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onfocus: "handleFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onFocusChange", "handleFocus");
      });

      it("maps onsubmit to onSubmit", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onsubmit: "handleSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onSubmit", "handleSubmit");
      });

      it("maps onmouseover to onHover", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onmouseover: "handleHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onHover", "handleHover");
      });

      it("maps onmouseenter to onHover", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ onmouseenter: "handleHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onHover", "handleHover");
      });

      it("maps ondrag to onDrag", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ ondrag: "handleDrag" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onDrag", "handleDrag");
      });

      it("maps ondrop to onDrop", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-ev", props: JSON.stringify({ ondrop: "handleDrop" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("onDrop", "handleDrop");
      });
    });

    // ---------------------------------------------------------------
    // class / className -> viewModifier
    // ---------------------------------------------------------------

    describe("class -> viewModifier mapping", () => {
      it("maps class to viewModifier", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-cls", props: JSON.stringify({ class: "container" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("viewModifier", "container");
        expect(normalized).not.toHaveProperty("class");
      });

      it("maps className to viewModifier", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-cls", props: JSON.stringify({ className: "box" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("viewModifier", "box");
        expect(normalized).not.toHaveProperty("className");
      });

      it("maps style to modifierStyle (inline modifier chain)", async () => {
        const storage = createInMemoryStorage();
        const inlineStyle = { color: "red", padding: 10 };
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-cls", props: JSON.stringify({ style: inlineStyle }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("modifierStyle");
        expect(normalized.modifierStyle).toEqual(inlineStyle);
        expect(normalized).not.toHaveProperty("style");
      });
    });

    // ---------------------------------------------------------------
    // ARIA attributes -> SwiftUI accessibility modifiers
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to accessibilityLabel", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-a11y", props: JSON.stringify({ "aria-label": "Close button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibilityLabel", "Close button");
      });

      it("maps aria-hidden to accessibilityHidden", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-a11y", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibilityHidden", "true");
      });

      it("maps aria-role to accessibilityAddTraits", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-a11y", props: JSON.stringify({ "aria-role": "button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibilityAddTraits", "button");
      });

      it("maps aria-valuenow to accessibilityValue", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-a11y", props: JSON.stringify({ "aria-valuenow": "50" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibilityValue", "50");
      });

      it("maps other aria-* attributes to accessibility:<key> prefix", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          {
            adapter: "sui-a11y",
            props: JSON.stringify({
              "aria-expanded": "true",
              "aria-describedby": "desc-1",
              "aria-live": "polite",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessibility:expanded", "true");
        expect(normalized).toHaveProperty("accessibility:describedby", "desc-1");
        expect(normalized).toHaveProperty("accessibility:live", "polite");
      });

      it("maps multiple supported aria-* attributes in a single call", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          {
            adapter: "sui-a11y",
            props: JSON.stringify({
              "aria-label": "Submit",
              "aria-hidden": "false",
              "aria-role": "link",
              "aria-valuenow": "75",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.accessibilityLabel).toBe("Submit");
        expect(normalized.accessibilityHidden).toBe("false");
        expect(normalized.accessibilityAddTraits).toBe("link");
        expect(normalized.accessibilityValue).toBe("75");
      });
    });

    // ---------------------------------------------------------------
    // data-* attributes -> environment keys
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to environment:testid", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-data", props: JSON.stringify({ "data-testid": "my-view" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("environment:testid", "my-view");
        expect(normalized).not.toHaveProperty("data-testid");
      });

      it("maps data-custom to environment:custom", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-data", props: JSON.stringify({ "data-custom": "value123" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("environment:custom", "value123");
      });

      it("maps multiple data-* attributes to environment: keys", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          {
            adapter: "sui-data",
            props: JSON.stringify({
              "data-testid": "btn",
              "data-index": "3",
              "data-variant": "primary",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["environment:testid"]).toBe("btn");
        expect(normalized["environment:index"]).toBe("3");
        expect(normalized["environment:variant"]).toBe("primary");
      });
    });

    // ---------------------------------------------------------------
    // Passthrough of unknown props
    // ---------------------------------------------------------------

    describe("passthrough of unknown props", () => {
      it("passes through unknown props as modifiers preserving key casing", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-pt", props: JSON.stringify({ foregroundColor: "blue", padding: 16 }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.foregroundColor).toBe("blue");
        expect(normalized.padding).toBe(16);
      });
    });

    // ---------------------------------------------------------------
    // Combined / complex props
    // ---------------------------------------------------------------

    describe("combined prop mapping", () => {
      it("correctly maps a mix of events, class, style, aria, data, and passthrough", async () => {
        const storage = createInMemoryStorage();
        const mixedProps = {
          onclick: "tapHandler",
          ondblclick: "dblHandler",
          class: "header-view",
          style: { padding: 10 },
          "aria-label": "Header",
          "aria-role": "header",
          "aria-valuenow": "100",
          "aria-live": "assertive",
          "data-testid": "hdr",
          customModifier: "keep",
        };
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-mix", props: JSON.stringify(mixedProps) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);

        expect(normalized.onTapGesture).toBe("tapHandler");
        expect(normalized["onTapGesture:count:2"]).toBe("dblHandler");
        expect(normalized.viewModifier).toBe("header-view");
        expect(normalized.modifierStyle).toEqual({ padding: 10 });
        expect(normalized.accessibilityLabel).toBe("Header");
        expect(normalized.accessibilityAddTraits).toBe("header");
        expect(normalized.accessibilityValue).toBe("100");
        expect(normalized["accessibility:live"]).toBe("assertive");
        expect(normalized["environment:testid"]).toBe("hdr");
        expect(normalized.customModifier).toBe("keep");
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error for empty props string", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-err", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for whitespace-only props string", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-err", props: "   " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-err", props: "not json {{" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error for undefined props", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-err", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for null props (falsy)", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-err", props: null as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for tab/newline whitespace-only props", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-err", props: "\t\n  " },
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
        await swiftuiadapterHandler.normalize(
          { adapter: "sui-store", props: JSON.stringify({ onclick: "tap" }) },
          storage,
        );

        const record = await storage.get("output", "sui-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("sui-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs.onTapGesture).toBe("tap");
      });

      it("overwrites previous storage on re-normalize with same adapter", async () => {
        const storage = createInMemoryStorage();
        await swiftuiadapterHandler.normalize(
          { adapter: "sui-ow", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await swiftuiadapterHandler.normalize(
          { adapter: "sui-ow", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "sui-ow");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs.onTapGesture).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await swiftuiadapterHandler.normalize(
          { adapter: "sui-nowrite", props: "" },
          storage,
        );

        const record = await storage.get("output", "sui-nowrite");
        expect(record).toBeNull();
      });

      it("stores result when all props produce environment keys", async () => {
        const storage = createInMemoryStorage();
        await swiftuiadapterHandler.normalize(
          {
            adapter: "sui-env",
            props: JSON.stringify({ "data-theme": "dark", "data-lang": "en" }),
          },
          storage,
        );

        const record = await storage.get("output", "sui-env");
        expect(record).not.toBeNull();
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["environment:theme"]).toBe("dark");
        expect(outputs["environment:lang"]).toBe("en");
      });
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------

    describe("edge cases", () => {
      it("handles empty object props", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-edge", props: JSON.stringify({}) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("handles props with null values", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-edge", props: JSON.stringify({ onclick: null }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.onTapGesture).toBeNull();
      });

      it("handles props with numeric values", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-edge", props: JSON.stringify({ "data-count": 42 }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["environment:count"]).toBe(42);
      });

      it("handles props with boolean values", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-edge", props: JSON.stringify({ "aria-hidden": true }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.accessibilityHidden).toBe(true);
      });

      it("preserves original key casing for passthrough props", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-edge", props: JSON.stringify({ myCustomModifier: "value" }) },
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
        const result = await swiftuiadapterHandler.normalize(
          { adapter: "sui-edge", props: JSON.stringify(manyProps) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(100);
      });

      it("both onclick and ondblclick can coexist in the same props", async () => {
        const storage = createInMemoryStorage();
        const result = await swiftuiadapterHandler.normalize(
          {
            adapter: "sui-edge",
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
    });
  });

  // ---------------------------------------------------------------
  // integration
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("normalize -> storage read-back -> re-normalize produces consistent results", async () => {
      const storage = createInMemoryStorage();

      // Step 1: normalize initial props
      const firstResult = await swiftuiadapterHandler.normalize(
        {
          adapter: "sui-integ",
          props: JSON.stringify({
            onclick: "handleTap",
            class: "main",
            "aria-label": "Main content",
            "aria-valuenow": "30",
            "data-testid": "main-view",
          }),
        },
        storage,
      );
      expect(firstResult.variant).toBe("ok");

      // Step 2: read back from storage
      const record = await storage.get("output", "sui-integ");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("sui-integ");

      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs.onTapGesture).toBe("handleTap");
      expect(storedOutputs.viewModifier).toBe("main");
      expect(storedOutputs.accessibilityLabel).toBe("Main content");
      expect(storedOutputs.accessibilityValue).toBe("30");
      expect(storedOutputs["environment:testid"]).toBe("main-view");

      // Step 3: re-normalize with updated props
      const secondResult = await swiftuiadapterHandler.normalize(
        {
          adapter: "sui-integ",
          props: JSON.stringify({
            onclick: "handleTap2",
            class: "updated",
            "aria-label": "Updated content",
            "aria-valuenow": "80",
            "data-testid": "updated-view",
          }),
        },
        storage,
      );
      expect(secondResult.variant).toBe("ok");

      // Step 4: verify storage was updated
      const updatedRecord = await storage.get("output", "sui-integ");
      const updatedOutputs = JSON.parse(updatedRecord!.outputs as string);
      expect(updatedOutputs.onTapGesture).toBe("handleTap2");
      expect(updatedOutputs.viewModifier).toBe("updated");
      expect(updatedOutputs.accessibilityLabel).toBe("Updated content");
      expect(updatedOutputs.accessibilityValue).toBe("80");
      expect(updatedOutputs["environment:testid"]).toBe("updated-view");
    });

    it("multiple adapters can coexist in storage", async () => {
      const storage = createInMemoryStorage();

      await swiftuiadapterHandler.normalize(
        { adapter: "adapter-a", props: JSON.stringify({ onclick: "a-tap" }) },
        storage,
      );
      await swiftuiadapterHandler.normalize(
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
      await swiftuiadapterHandler.normalize(
        { adapter: "sui-safe", props: JSON.stringify({ onclick: "first" }) },
        storage,
      );

      // Failed normalize with same adapter
      const errResult = await swiftuiadapterHandler.normalize(
        { adapter: "sui-safe", props: "" },
        storage,
      );
      expect(errResult.variant).toBe("error");

      // Original storage entry should still be intact
      const record = await storage.get("output", "sui-safe");
      expect(record).not.toBeNull();
      const outputs = JSON.parse(record!.outputs as string);
      expect(outputs.onTapGesture).toBe("first");
    });
  });
});
