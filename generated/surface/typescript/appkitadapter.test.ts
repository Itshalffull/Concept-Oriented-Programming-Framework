import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { appkitadapterHandler } from "./appkitadapter.impl";

describe("AppKitAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple onclick prop to target-action:click", async () => {
      const storage = createInMemoryStorage();
      const result = await appkitadapterHandler.normalize(
        { adapter: "appkit-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["target-action:click"]).toBe("handleClick");
    });

    it("returns the adapter id in the ok response", async () => {
      const storage = createInMemoryStorage();
      const result = await appkitadapterHandler.normalize(
        { adapter: "my-appkit", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("my-appkit");
    });

    it("normalizes an empty props object to an empty normalized object", async () => {
      const storage = createInMemoryStorage();
      const result = await appkitadapterHandler.normalize(
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
      it("maps onclick to target-action:click", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onclick: "onClick" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["target-action:click"]).toBe("onClick");
      });

      it("maps ondblclick to target-action:doubleClick", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondblclick: "onDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["target-action:doubleClick"]).toBe("onDbl");
      });

      it("maps onchange to target-action:change", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onchange: "onChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["target-action:change"]).toBe("onChange");
      });

      it("maps onscroll to notification:boundsDidChange", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onscroll: "onScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["notification:boundsDidChange"]).toBe("onScroll");
      });

      it("maps onfocus to notification:didBecomeFirstResponder", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onfocus: "onFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["notification:didBecomeFirstResponder"]).toBe("onFocus");
      });

      it("maps onblur to notification:didResignFirstResponder", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onblur: "onBlur" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["notification:didResignFirstResponder"]).toBe("onBlur");
      });

      it("maps onkeydown to override:keyDown", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeydown: "onKey" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["override:keyDown"]).toBe("onKey");
      });

      it("maps onkeyup to override:keyUp", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeyup: "onKeyUp" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["override:keyUp"]).toBe("onKeyUp");
      });

      it("maps onsubmit to target-action:submit", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onsubmit: "onSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["target-action:submit"]).toBe("onSubmit");
      });

      it("maps onmouseover to override:mouseEntered", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseover: "onHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["override:mouseEntered"]).toBe("onHover");
      });

      it("maps onmouseenter to override:mouseEntered", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseenter: "onEnter" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["override:mouseEntered"]).toBe("onEnter");
      });

      it("maps onmouseleave to override:mouseExited", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseleave: "onLeave" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["override:mouseExited"]).toBe("onLeave");
      });

      it("maps ondrag to protocol:draggingSource", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrag: "onDrag" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["protocol:draggingSource"]).toBe("onDrag");
      });

      it("maps ondrop to protocol:draggingDestination", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrop: "onDrop" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["protocol:draggingDestination"]).toBe("onDrop");
      });

      it("maps oncontextmenu to override:rightMouseDown", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ oncontextmenu: "onCtx" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["override:rightMouseDown"]).toBe("onCtx");
      });
    });

    // ---------------------------------------------------------------
    // class / className -> appearance mapping
    // ---------------------------------------------------------------

    describe("class and className mapping", () => {
      it("maps class to appearance", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ class: "darkAqua" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["appearance"]).toBe("darkAqua");
      });

      it("maps className to appearance", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ className: "vibrantDark" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["appearance"]).toBe("vibrantDark");
      });
    });

    // ---------------------------------------------------------------
    // style -> viewProperties mapping
    // ---------------------------------------------------------------

    describe("style mapping", () => {
      it("maps style to viewProperties", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ style: "wantsLayer=true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["viewProperties"]).toBe("wantsLayer=true");
      });
    });

    // ---------------------------------------------------------------
    // aria-* -> NSAccessibility mappings
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to NSAccessibility.label", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-label": "Close window" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["NSAccessibility.label"]).toBe("Close window");
      });

      it("maps aria-hidden to NSAccessibility.isHidden", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["NSAccessibility.isHidden"]).toBe("true");
      });

      it("maps aria-role to NSAccessibility.role", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-role": "button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["NSAccessibility.role"]).toBe("button");
      });

      it("maps aria-describedby to NSAccessibility.help", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-describedby": "help-text" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["NSAccessibility.help"]).toBe("help-text");
      });

      it("maps arbitrary aria-* to NSAccessibility.<key>", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-expanded": "false", "aria-valuenow": "50" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["NSAccessibility.expanded"]).toBe("false");
        expect(normalized["NSAccessibility.valuenow"]).toBe("50");
      });
    });

    // ---------------------------------------------------------------
    // data-* -> identifier keys mappings
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to identifier:testid", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-testid": "close-btn" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["identifier:testid"]).toBe("close-btn");
      });

      it("maps multiple data-* attributes correctly", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-window": "main", "data-tab": "general" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["identifier:window"]).toBe("main");
        expect(normalized["identifier:tab"]).toBe("general");
      });
    });

    // ---------------------------------------------------------------
    // Pass-through for unknown keys
    // ---------------------------------------------------------------

    describe("pass-through for unknown keys", () => {
      it("passes through unknown props unchanged", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ toolTip: "Info", tag: 42 }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["toolTip"]).toBe("Info");
        expect(normalized["tag"]).toBe(42);
      });
    });

    // ---------------------------------------------------------------
    // Case insensitivity
    // ---------------------------------------------------------------

    describe("case insensitivity", () => {
      it("handles onClick (camelCase) the same as onclick", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onClick: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["target-action:click"]).toBe("handler");
      });

      it("handles ONCHANGE (uppercase) the same as onchange", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ONCHANGE: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["target-action:change"]).toBe("handler");
      });

      it("handles CLASS (uppercase) the same as class", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ CLASS: "aqua" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["appearance"]).toBe("aqua");
      });

      it("handles STYLE (uppercase) the same as style", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ STYLE: "alphaValue=0.5" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["viewProperties"]).toBe("alphaValue=0.5");
      });
    });

    // ---------------------------------------------------------------
    // Multiple props combined
    // ---------------------------------------------------------------

    describe("multiple props combined", () => {
      it("normalizes a mixed set of AppKit-bound props in one call", async () => {
        const storage = createInMemoryStorage();
        const props = {
          onclick: "clickAction",
          ondblclick: "doubleClickAction",
          class: "vibrantLight",
          "aria-label": "Toolbar button",
          "aria-describedby": "tooltip-text",
          "data-testid": "toolbar-btn",
          style: "isOpaque=true",
          title: "My Button",
        };
        const result = await appkitadapterHandler.normalize(
          { adapter: "appkit-mix", props: JSON.stringify(props) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["target-action:click"]).toBe("clickAction");
        expect(normalized["target-action:doubleClick"]).toBe("doubleClickAction");
        expect(normalized["appearance"]).toBe("vibrantLight");
        expect(normalized["NSAccessibility.label"]).toBe("Toolbar button");
        expect(normalized["NSAccessibility.help"]).toBe("tooltip-text");
        expect(normalized["identifier:testid"]).toBe("toolbar-btn");
        expect(normalized["viewProperties"]).toBe("isOpaque=true");
        expect(normalized["title"]).toBe("My Button");
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error when props is an empty string", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is only whitespace", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: "   \n\t  " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: "@selector(clickAction:)" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error when props is undefined", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is null", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: null as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for a bare non-JSON string", async () => {
        const storage = createInMemoryStorage();
        const result = await appkitadapterHandler.normalize(
          { adapter: "a", props: "NSButton" },
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
      it("writes normalized output to storage under the output relation", async () => {
        const storage = createInMemoryStorage();
        await appkitadapterHandler.normalize(
          { adapter: "appkit-store", props: JSON.stringify({ onclick: "fn" }) },
          storage,
        );

        const record = await storage.get("output", "appkit-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("appkit-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["target-action:click"]).toBe("fn");
      });

      it("overwrites previous storage entry for the same adapter", async () => {
        const storage = createInMemoryStorage();
        await appkitadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await appkitadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "a1");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["target-action:click"]).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await appkitadapterHandler.normalize(
          { adapter: "bad", props: "" },
          storage,
        );

        const record = await storage.get("output", "bad");
        expect(record).toBeNull();
      });

      it("stores different adapters independently", async () => {
        const storage = createInMemoryStorage();
        await appkitadapterHandler.normalize(
          { adapter: "ak1", props: JSON.stringify({ onclick: "fn1" }) },
          storage,
        );
        await appkitadapterHandler.normalize(
          { adapter: "ak2", props: JSON.stringify({ onchange: "fn2" }) },
          storage,
        );

        const r1 = await storage.get("output", "ak1");
        const r2 = await storage.get("output", "ak2");
        const o1 = JSON.parse(r1!.outputs as string);
        const o2 = JSON.parse(r2!.outputs as string);
        expect(o1["target-action:click"]).toBe("fn1");
        expect(o2["target-action:change"]).toBe("fn2");
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
        class: "darkAqua",
        "aria-label": "Close button",
        "aria-describedby": "close-help",
        "data-id": "close-btn",
      };

      // First normalize
      const result1 = await appkitadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result1.variant).toBe("ok");

      // Read back from storage
      const record = await storage.get("output", "int-1");
      expect(record).not.toBeNull();
      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs["target-action:click"]).toBe("doClick");
      expect(storedOutputs["appearance"]).toBe("darkAqua");
      expect(storedOutputs["NSAccessibility.label"]).toBe("Close button");
      expect(storedOutputs["NSAccessibility.help"]).toBe("close-help");
      expect(storedOutputs["identifier:id"]).toBe("close-btn");

      // Re-normalize
      const result2 = await appkitadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result2.variant).toBe("ok");
      expect((result2 as any).normalized).toBe((result1 as any).normalized);
    });

    it("normalizes all AppKit event handlers simultaneously", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "c",
        ondblclick: "dc",
        onchange: "ch",
        onscroll: "sc",
        onfocus: "fo",
        onblur: "bl",
        onkeydown: "kd",
        onkeyup: "ku",
        onsubmit: "su",
        onmouseover: "mo",
        onmouseleave: "ml",
        ondrag: "dr",
        ondrop: "dp",
        oncontextmenu: "ctx",
      };

      const result = await appkitadapterHandler.normalize(
        { adapter: "all-events", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["target-action:click"]).toBe("c");
      expect(n["target-action:doubleClick"]).toBe("dc");
      expect(n["target-action:change"]).toBe("ch");
      expect(n["notification:boundsDidChange"]).toBe("sc");
      expect(n["notification:didBecomeFirstResponder"]).toBe("fo");
      expect(n["notification:didResignFirstResponder"]).toBe("bl");
      expect(n["override:keyDown"]).toBe("kd");
      expect(n["override:keyUp"]).toBe("ku");
      expect(n["target-action:submit"]).toBe("su");
      expect(n["override:mouseEntered"]).toBe("mo");
      expect(n["override:mouseExited"]).toBe("ml");
      expect(n["protocol:draggingSource"]).toBe("dr");
      expect(n["protocol:draggingDestination"]).toBe("dp");
      expect(n["override:rightMouseDown"]).toBe("ctx");
    });

    it("handles props with special characters in values", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "#selector(buttonClicked:)",
        "aria-label": "Label with @IBAction syntax",
        "data-json": "{\"nested\":true}",
      };

      const result = await appkitadapterHandler.normalize(
        { adapter: "special", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["target-action:click"]).toBe("#selector(buttonClicked:)");
      expect(n["NSAccessibility.label"]).toBe("Label with @IBAction syntax");
      expect(n["identifier:json"]).toBe("{\"nested\":true}");
    });

    it("handles numeric and boolean values in props", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-hidden": true,
        "data-count": 42,
        alphaValue: 0.8,
        isHidden: false,
      };

      const result = await appkitadapterHandler.normalize(
        { adapter: "types", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["NSAccessibility.isHidden"]).toBe(true);
      expect(n["identifier:count"]).toBe(42);
      expect(n["alphaValue"]).toBe(0.8);
      expect(n["isHidden"]).toBe(false);
    });
  });
});
