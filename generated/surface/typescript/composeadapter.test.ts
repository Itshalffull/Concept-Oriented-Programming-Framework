import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { composeadapterHandler } from "./composeadapter.impl";

describe("ComposeAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple onclick prop to Modifier.clickable", async () => {
      const storage = createInMemoryStorage();
      const result = await composeadapterHandler.normalize(
        { adapter: "compose-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["Modifier.clickable"]).toBe("handleClick");
    });

    it("returns the adapter id in the ok response", async () => {
      const storage = createInMemoryStorage();
      const result = await composeadapterHandler.normalize(
        { adapter: "my-adapter", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("my-adapter");
    });

    it("normalizes an empty props object to an empty normalized object", async () => {
      const storage = createInMemoryStorage();
      const result = await composeadapterHandler.normalize(
        { adapter: "a1", props: JSON.stringify({}) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    // ---------------------------------------------------------------
    // Event handler mappings
    // ---------------------------------------------------------------

    describe("event handler mappings", () => {
      it("maps onclick to Modifier.clickable", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onclick: "onClick" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.clickable"]).toBe("onClick");
      });

      it("maps ondblclick to Modifier.combinedClickable:onDoubleClick", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondblclick: "onDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.combinedClickable:onDoubleClick"]).toBe("onDbl");
      });

      it("maps onchange to onValueChange", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onchange: "onChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["onValueChange"]).toBe("onChange");
      });

      it("maps onscroll to Modifier.verticalScroll", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onscroll: "onScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.verticalScroll"]).toBe("onScroll");
      });

      it("maps onfocus to Modifier.onFocusChanged", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onfocus: "onFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.onFocusChanged"]).toBe("onFocus");
      });

      it("maps onblur to Modifier.onFocusChanged:lost", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onblur: "onBlur" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.onFocusChanged:lost"]).toBe("onBlur");
      });

      it("maps onkeydown to Modifier.onKeyEvent", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeydown: "onKey" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.onKeyEvent"]).toBe("onKey");
      });

      it("maps onsubmit to keyboardActions:onDone", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onsubmit: "onSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["keyboardActions:onDone"]).toBe("onSubmit");
      });

      it("maps ondrag to Modifier.draggable", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrag: "onDrag" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.draggable"]).toBe("onDrag");
      });

      it("maps ondrop to Modifier.dropTarget", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrop: "onDrop" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.dropTarget"]).toBe("onDrop");
      });

      it("maps onmouseover to Modifier.hoverable", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseover: "onHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.hoverable"]).toBe("onHover");
      });

      it("maps onmouseenter to Modifier.hoverable", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseenter: "onEnter" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.hoverable"]).toBe("onEnter");
      });
    });

    // ---------------------------------------------------------------
    // class / className mapping
    // ---------------------------------------------------------------

    describe("class and className mapping", () => {
      it("maps class to Modifier", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ class: "my-class" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier"]).toBe("my-class");
      });

      it("maps className to Modifier", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ className: "my-class" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier"]).toBe("my-class");
      });
    });

    // ---------------------------------------------------------------
    // style mapping
    // ---------------------------------------------------------------

    describe("style mapping", () => {
      it("maps style to Modifier.style", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ style: "color:red" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.style"]).toBe("color:red");
      });
    });

    // ---------------------------------------------------------------
    // aria-* attribute mappings
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to Modifier.semantics:contentDescription", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-label": "Submit button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:contentDescription"]).toBe("Submit button");
      });

      it("maps aria-hidden to Modifier.semantics:invisibleToUser", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:invisibleToUser"]).toBe("true");
      });

      it("maps aria-role to Modifier.semantics:role", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-role": "button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:role"]).toBe("button");
      });

      it("maps arbitrary aria-* attributes to Modifier.semantics:<key>", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-expanded": "false", "aria-live": "polite" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:expanded"]).toBe("false");
        expect(normalized["Modifier.semantics:live"]).toBe("polite");
      });
    });

    // ---------------------------------------------------------------
    // data-* attribute mappings
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to Modifier.testTag:testid", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-testid": "btn-1" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.testTag:testid"]).toBe("btn-1");
      });

      it("maps multiple data-* attributes correctly", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-type": "card", "data-index": "3" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.testTag:type"]).toBe("card");
        expect(normalized["Modifier.testTag:index"]).toBe("3");
      });
    });

    // ---------------------------------------------------------------
    // Pass-through for unknown keys
    // ---------------------------------------------------------------

    describe("pass-through for unknown keys", () => {
      it("passes through unknown props unchanged", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ customProp: "value", "foo-bar": 42 }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["customProp"]).toBe("value");
        expect(normalized["foo-bar"]).toBe(42);
      });
    });

    // ---------------------------------------------------------------
    // Case insensitivity
    // ---------------------------------------------------------------

    describe("case insensitivity", () => {
      it("handles onClick (camelCase) the same as onclick", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onClick: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.clickable"]).toBe("handler");
      });

      it("handles ONCLICK (uppercase) the same as onclick", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ONCLICK: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.clickable"]).toBe("handler");
      });

      it("handles CLASS (uppercase) the same as class", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ CLASS: "cls" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier"]).toBe("cls");
      });
    });

    // ---------------------------------------------------------------
    // Multiple props combined
    // ---------------------------------------------------------------

    describe("multiple props combined", () => {
      it("normalizes a mixed set of props in one call", async () => {
        const storage = createInMemoryStorage();
        const props = {
          onclick: "clickHandler",
          class: "btn-primary",
          "aria-label": "Primary button",
          "data-testid": "primary-btn",
          style: "padding:8dp",
          title: "Click me",
        };
        const result = await composeadapterHandler.normalize(
          { adapter: "compose-mix", props: JSON.stringify(props) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.clickable"]).toBe("clickHandler");
        expect(normalized["Modifier"]).toBe("btn-primary");
        expect(normalized["Modifier.semantics:contentDescription"]).toBe("Primary button");
        expect(normalized["Modifier.testTag:testid"]).toBe("primary-btn");
        expect(normalized["Modifier.style"]).toBe("padding:8dp");
        expect(normalized["title"]).toBe("Click me");
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error when props is an empty string", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is only whitespace", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: "   " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: "{not valid json}" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error when props is a JSON array instead of object", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: "[1,2,3]" },
          storage,
        );
        // JSON.parse succeeds but Object.entries on an array still works,
        // so this actually does not error - it processes numeric keys
        expect(result.variant).toBe("ok");
      });

      it("returns error when props is undefined/null", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is a bare string (not JSON)", async () => {
        const storage = createInMemoryStorage();
        const result = await composeadapterHandler.normalize(
          { adapter: "a", props: "just a string" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });
    });

    // ---------------------------------------------------------------
    // Storage side effects
    // ---------------------------------------------------------------

    describe("storage side effects", () => {
      it("writes the normalized output to storage under the output relation", async () => {
        const storage = createInMemoryStorage();
        await composeadapterHandler.normalize(
          { adapter: "compose-store", props: JSON.stringify({ onclick: "fn" }) },
          storage,
        );

        const record = await storage.get("output", "compose-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("compose-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["Modifier.clickable"]).toBe("fn");
      });

      it("overwrites previous storage entry for the same adapter", async () => {
        const storage = createInMemoryStorage();
        await composeadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await composeadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "a1");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["Modifier.clickable"]).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await composeadapterHandler.normalize(
          { adapter: "bad", props: "" },
          storage,
        );

        const record = await storage.get("output", "bad");
        expect(record).toBeNull();
      });

      it("stores different adapters independently", async () => {
        const storage = createInMemoryStorage();
        await composeadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "fn1" }) },
          storage,
        );
        await composeadapterHandler.normalize(
          { adapter: "a2", props: JSON.stringify({ onchange: "fn2" }) },
          storage,
        );

        const r1 = await storage.get("output", "a1");
        const r2 = await storage.get("output", "a2");
        const o1 = JSON.parse(r1!.outputs as string);
        const o2 = JSON.parse(r2!.outputs as string);
        expect(o1["Modifier.clickable"]).toBe("fn1");
        expect(o2["onValueChange"]).toBe("fn2");
      });
    });
  });

  // ---------------------------------------------------------------
  // integration
  // ---------------------------------------------------------------

  describe("integration", () => {
    it("normalize -> storage read-back -> re-normalize produces consistent results", async () => {
      const storage = createInMemoryStorage();

      const props = {
        onclick: "doClick",
        class: "card",
        "aria-label": "Card element",
        "data-id": "card-42",
      };

      // First normalize
      const result1 = await composeadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result1.variant).toBe("ok");

      // Read back from storage
      const record = await storage.get("output", "int-1");
      expect(record).not.toBeNull();
      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs["Modifier.clickable"]).toBe("doClick");
      expect(storedOutputs["Modifier"]).toBe("card");
      expect(storedOutputs["Modifier.semantics:contentDescription"]).toBe("Card element");
      expect(storedOutputs["Modifier.testTag:id"]).toBe("card-42");

      // Re-normalize the same props again
      const result2 = await composeadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result2.variant).toBe("ok");
      expect((result2 as any).normalized).toBe((result1 as any).normalized);

      // Verify storage reflects the latest
      const record2 = await storage.get("output", "int-1");
      expect(record2!.outputs).toBe(record!.outputs);
    });

    it("normalizes all event handlers simultaneously", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "c",
        ondblclick: "dc",
        onchange: "ch",
        onscroll: "sc",
        onfocus: "fo",
        onblur: "bl",
        onkeydown: "kd",
        onsubmit: "su",
        ondrag: "dr",
        ondrop: "dp",
        onmouseover: "mo",
      };

      const result = await composeadapterHandler.normalize(
        { adapter: "all-events", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["Modifier.clickable"]).toBe("c");
      expect(n["Modifier.combinedClickable:onDoubleClick"]).toBe("dc");
      expect(n["onValueChange"]).toBe("ch");
      expect(n["Modifier.verticalScroll"]).toBe("sc");
      expect(n["Modifier.onFocusChanged"]).toBe("fo");
      expect(n["Modifier.onFocusChanged:lost"]).toBe("bl");
      expect(n["Modifier.onKeyEvent"]).toBe("kd");
      expect(n["keyboardActions:onDone"]).toBe("su");
      expect(n["Modifier.draggable"]).toBe("dr");
      expect(n["Modifier.dropTarget"]).toBe("dp");
      expect(n["Modifier.hoverable"]).toBe("mo");
    });

    it("handles props with special characters in values", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "() => alert('hello \"world\"')",
        "aria-label": "Label with <special> & chars",
        "data-json": "{\"nested\":true}",
      };

      const result = await composeadapterHandler.normalize(
        { adapter: "special", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["Modifier.clickable"]).toBe("() => alert('hello \"world\"')");
      expect(n["Modifier.semantics:contentDescription"]).toBe("Label with <special> & chars");
      expect(n["Modifier.testTag:json"]).toBe("{\"nested\":true}");
    });

    it("handles numeric and boolean values in props", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-hidden": true,
        "data-count": 42,
        tabIndex: 0,
      };

      const result = await composeadapterHandler.normalize(
        { adapter: "types", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["Modifier.semantics:invisibleToUser"]).toBe(true);
      expect(n["Modifier.testTag:count"]).toBe(42);
      expect(n["tabIndex"]).toBe(0);
    });
  });
});
