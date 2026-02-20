import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { nativescriptadapterHandler } from "./nativescriptadapter.impl";

describe("NativeScriptAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple props object and returns ok with adapter id", async () => {
      const storage = createInMemoryStorage();
      const result = await nativescriptadapterHandler.normalize(
        { adapter: "ns-1", props: JSON.stringify({ text: "Hello" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("ns-1");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized.text).toBe("Hello");
    });

    it("returns the normalized result as a JSON string", async () => {
      const storage = createInMemoryStorage();
      const result = await nativescriptadapterHandler.normalize(
        { adapter: "ns-2", props: JSON.stringify({ onclick: "handler" }) },
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
      it("maps onclick to tap", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onclick: "handleTap" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("tap", "handleTap");
        expect(normalized).not.toHaveProperty("onclick");
      });

      it("maps onClick (mixed case) to tap via lowercasing", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onClick: "handleTap" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("tap", "handleTap");
      });

      it("maps ondblclick to doubleTap", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ ondblclick: "handleDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("doubleTap", "handleDbl");
        expect(normalized).not.toHaveProperty("ondblclick");
      });

      it("maps onchange to propertyChange", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onchange: "handleChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("propertyChange", "handleChange");
        expect(normalized).not.toHaveProperty("onchange");
      });

      it("maps onscroll to scroll", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onscroll: "handleScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("scroll", "handleScroll");
      });

      it("maps onfocus to focus", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onfocus: "handleFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("focus", "handleFocus");
      });

      it("maps onblur to blur", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onblur: "handleBlur" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("blur", "handleBlur");
      });

      it("maps onkeydown to keyDown", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onkeydown: "handleKeyDown" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("keyDown", "handleKeyDown");
      });

      it("maps onkeyup to keyUp", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onkeyup: "handleKeyUp" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("keyUp", "handleKeyUp");
      });

      it("maps onload to loaded", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onload: "handleLoad" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("loaded", "handleLoad");
      });

      it("maps onunload to unloaded", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onunload: "handleUnload" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("unloaded", "handleUnload");
      });

      it("maps onsubmit to returnPress", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-ev", props: JSON.stringify({ onsubmit: "handleSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("returnPress", "handleSubmit");
      });
    });

    // ---------------------------------------------------------------
    // class / className -> cssClass
    // ---------------------------------------------------------------

    describe("class -> cssClass mapping", () => {
      it("maps class to cssClass", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-cls", props: JSON.stringify({ class: "container" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("cssClass", "container");
        expect(normalized).not.toHaveProperty("class");
      });

      it("maps className to cssClass", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-cls", props: JSON.stringify({ className: "box" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("cssClass", "box");
        expect(normalized).not.toHaveProperty("className");
      });

      it("passes through style directly (NativeScript supports inline CSS)", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-cls", props: JSON.stringify({ style: "color: red;" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.style).toBe("color: red;");
      });
    });

    // ---------------------------------------------------------------
    // ARIA attributes -> NativeScript accessibility
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to automationText", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-a11y", props: JSON.stringify({ "aria-label": "Close button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("automationText", "Close button");
      });

      it("maps aria-hidden=true to visibility=collapse", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-a11y", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("visibility", "collapse");
      });

      it("maps aria-hidden=false to visibility=visible", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-a11y", props: JSON.stringify({ "aria-hidden": "false" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("visibility", "visible");
      });

      it("maps aria-hidden with non-'true' string value to visibility=visible", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-a11y", props: JSON.stringify({ "aria-hidden": "yes" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("visibility", "visible");
      });

      it("maps other aria-* attributes to accessible:<key> prefix", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          {
            adapter: "ns-a11y",
            props: JSON.stringify({
              "aria-role": "button",
              "aria-expanded": "true",
              "aria-describedby": "desc-1",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("accessible:role", "button");
        expect(normalized).toHaveProperty("accessible:expanded", "true");
        expect(normalized).toHaveProperty("accessible:describedby", "desc-1");
      });

      it("maps aria-label and other aria-* in the same call", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          {
            adapter: "ns-a11y",
            props: JSON.stringify({
              "aria-label": "Submit",
              "aria-role": "link",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.automationText).toBe("Submit");
        expect(normalized["accessible:role"]).toBe("link");
      });
    });

    // ---------------------------------------------------------------
    // data-* attributes -> custom props with prefix stripped
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to testid (prefix stripped)", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-data", props: JSON.stringify({ "data-testid": "my-button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("testid", "my-button");
        expect(normalized).not.toHaveProperty("data-testid");
      });

      it("strips data- prefix from multiple data attributes", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          {
            adapter: "ns-data",
            props: JSON.stringify({
              "data-index": "5",
              "data-variant": "secondary",
              "data-active": "true",
            }),
          },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.index).toBe("5");
        expect(normalized.variant).toBe("secondary");
        expect(normalized.active).toBe("true");
      });
    });

    // ---------------------------------------------------------------
    // Passthrough of unknown props
    // ---------------------------------------------------------------

    describe("passthrough of unknown props", () => {
      it("passes through unknown props as-is preserving key casing", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-pt", props: JSON.stringify({ rows: "auto, *", columns: "*, *" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.rows).toBe("auto, *");
        expect(normalized.columns).toBe("*, *");
      });
    });

    // ---------------------------------------------------------------
    // Combined / complex props
    // ---------------------------------------------------------------

    describe("combined prop mapping", () => {
      it("correctly maps a mix of events, class, aria, data, and passthrough", async () => {
        const storage = createInMemoryStorage();
        const mixedProps = {
          onclick: "tapHandler",
          class: "page-header",
          "aria-label": "Header",
          "aria-hidden": "true",
          "aria-role": "header",
          "data-testid": "hdr",
          customProp: "keep",
        };
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-mix", props: JSON.stringify(mixedProps) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);

        expect(normalized.tap).toBe("tapHandler");
        expect(normalized.cssClass).toBe("page-header");
        expect(normalized.automationText).toBe("Header");
        expect(normalized.visibility).toBe("collapse");
        expect(normalized["accessible:role"]).toBe("header");
        expect(normalized.testid).toBe("hdr");
        expect(normalized.customProp).toBe("keep");
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error for empty props string", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-err", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for whitespace-only props string", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-err", props: "   " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-err", props: "{{broken" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error for undefined props", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-err", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for null props (falsy)", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-err", props: null as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for tab/newline whitespace-only props", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-err", props: "\t\n " },
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
        await nativescriptadapterHandler.normalize(
          { adapter: "ns-store", props: JSON.stringify({ onclick: "tap" }) },
          storage,
        );

        const record = await storage.get("output", "ns-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("ns-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs.tap).toBe("tap");
      });

      it("overwrites previous storage on re-normalize with same adapter", async () => {
        const storage = createInMemoryStorage();
        await nativescriptadapterHandler.normalize(
          { adapter: "ns-ow", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await nativescriptadapterHandler.normalize(
          { adapter: "ns-ow", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "ns-ow");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs.tap).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await nativescriptadapterHandler.normalize(
          { adapter: "ns-nowrite", props: "" },
          storage,
        );

        const record = await storage.get("output", "ns-nowrite");
        expect(record).toBeNull();
      });

      it("stores empty object when all props are passthrough-only with no special mapping", async () => {
        const storage = createInMemoryStorage();
        await nativescriptadapterHandler.normalize(
          { adapter: "ns-pass", props: JSON.stringify({ customProp: "val" }) },
          storage,
        );

        const record = await storage.get("output", "ns-pass");
        expect(record).not.toBeNull();
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs.customProp).toBe("val");
      });
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------

    describe("edge cases", () => {
      it("handles empty object props", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-edge", props: JSON.stringify({}) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("handles props with null values", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-edge", props: JSON.stringify({ onclick: null }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.tap).toBeNull();
      });

      it("handles props with numeric values", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-edge", props: JSON.stringify({ "data-count": 42 }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.count).toBe(42);
      });

      it("handles props with boolean values", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-edge", props: JSON.stringify({ editable: false }) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized.editable).toBe(false);
      });

      it("preserves original key casing for passthrough props", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-edge", props: JSON.stringify({ myCustomProp: "value" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).toHaveProperty("myCustomProp", "value");
      });

      it("handles large number of props without error", async () => {
        const storage = createInMemoryStorage();
        const manyProps: Record<string, string> = {};
        for (let i = 0; i < 100; i++) {
          manyProps[`prop${i}`] = `value${i}`;
        }
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-edge", props: JSON.stringify(manyProps) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(100);
      });

      it("NativeScript does not ignore DOM-specific attrs (unlike ReactNative) — they pass through", async () => {
        const storage = createInMemoryStorage();
        const result = await nativescriptadapterHandler.normalize(
          { adapter: "ns-edge", props: JSON.stringify({ href: "/page", tabindex: "0" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        // NativeScript impl has no DOM_SPECIFIC filter set, so these pass through
        expect(normalized.href).toBe("/page");
        expect(normalized.tabindex).toBe("0");
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
      const firstResult = await nativescriptadapterHandler.normalize(
        {
          adapter: "ns-integ",
          props: JSON.stringify({
            onclick: "handleTap",
            class: "main",
            "aria-label": "Main content",
            "aria-hidden": "true",
            "data-testid": "main-view",
          }),
        },
        storage,
      );
      expect(firstResult.variant).toBe("ok");

      // Step 2: read back from storage
      const record = await storage.get("output", "ns-integ");
      expect(record).not.toBeNull();
      expect(record!.adapter).toBe("ns-integ");

      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs.tap).toBe("handleTap");
      expect(storedOutputs.cssClass).toBe("main");
      expect(storedOutputs.automationText).toBe("Main content");
      expect(storedOutputs.visibility).toBe("collapse");
      expect(storedOutputs.testid).toBe("main-view");

      // Step 3: re-normalize with updated props
      const secondResult = await nativescriptadapterHandler.normalize(
        {
          adapter: "ns-integ",
          props: JSON.stringify({
            onclick: "handleTap2",
            class: "updated",
            "aria-label": "Updated content",
            "aria-hidden": "false",
            "data-testid": "updated-view",
          }),
        },
        storage,
      );
      expect(secondResult.variant).toBe("ok");

      // Step 4: verify storage was updated
      const updatedRecord = await storage.get("output", "ns-integ");
      const updatedOutputs = JSON.parse(updatedRecord!.outputs as string);
      expect(updatedOutputs.tap).toBe("handleTap2");
      expect(updatedOutputs.cssClass).toBe("updated");
      expect(updatedOutputs.automationText).toBe("Updated content");
      expect(updatedOutputs.visibility).toBe("visible");
      expect(updatedOutputs.testid).toBe("updated-view");
    });

    it("multiple adapters can coexist in storage", async () => {
      const storage = createInMemoryStorage();

      await nativescriptadapterHandler.normalize(
        { adapter: "adapter-a", props: JSON.stringify({ onclick: "a-handler" }) },
        storage,
      );
      await nativescriptadapterHandler.normalize(
        { adapter: "adapter-b", props: JSON.stringify({ onclick: "b-handler" }) },
        storage,
      );

      const recordA = await storage.get("output", "adapter-a");
      const recordB = await storage.get("output", "adapter-b");
      expect(recordA).not.toBeNull();
      expect(recordB).not.toBeNull();

      const outputsA = JSON.parse(recordA!.outputs as string);
      const outputsB = JSON.parse(recordB!.outputs as string);
      expect(outputsA.tap).toBe("a-handler");
      expect(outputsB.tap).toBe("b-handler");
    });

    it("error normalize does not corrupt existing storage entry", async () => {
      const storage = createInMemoryStorage();

      // Successful normalize
      await nativescriptadapterHandler.normalize(
        { adapter: "ns-safe", props: JSON.stringify({ onclick: "first" }) },
        storage,
      );

      // Failed normalize with same adapter
      const errResult = await nativescriptadapterHandler.normalize(
        { adapter: "ns-safe", props: "" },
        storage,
      );
      expect(errResult.variant).toBe("error");

      // Original storage entry should still be intact
      const record = await storage.get("output", "ns-safe");
      expect(record).not.toBeNull();
      const outputs = JSON.parse(record!.outputs as string);
      expect(outputs.tap).toBe("first");
    });
  });
});
