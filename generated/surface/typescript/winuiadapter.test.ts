import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { winuiadapterHandler } from "./winuiadapter.impl";

describe("WinUIAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple onclick prop to Tapped", async () => {
      const storage = createInMemoryStorage();
      const result = await winuiadapterHandler.normalize(
        { adapter: "winui-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["Tapped"]).toBe("handleClick");
    });

    it("returns the adapter id in the ok response", async () => {
      const storage = createInMemoryStorage();
      const result = await winuiadapterHandler.normalize(
        { adapter: "my-winui", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("my-winui");
    });

    it("normalizes an empty props object to an empty normalized object", async () => {
      const storage = createInMemoryStorage();
      const result = await winuiadapterHandler.normalize(
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
      it("maps onclick to Tapped", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onclick: "onClick" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Tapped"]).toBe("onClick");
      });

      it("maps ondblclick to DoubleTapped", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondblclick: "onDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["DoubleTapped"]).toBe("onDbl");
      });

      it("maps onchange to SelectionChanged", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onchange: "onChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["SelectionChanged"]).toBe("onChange");
      });

      it("maps onscroll to ViewChanged", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onscroll: "onScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["ViewChanged"]).toBe("onScroll");
      });

      it("maps onfocus to GotFocus", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onfocus: "onFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["GotFocus"]).toBe("onFocus");
      });

      it("maps onblur to LostFocus", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onblur: "onBlur" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["LostFocus"]).toBe("onBlur");
      });

      it("maps onkeydown to KeyDown", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeydown: "onKey" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["KeyDown"]).toBe("onKey");
      });

      it("maps onkeyup to KeyUp", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeyup: "onKeyUp" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["KeyUp"]).toBe("onKeyUp");
      });

      it("maps onsubmit to TextSubmitted", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onsubmit: "onSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["TextSubmitted"]).toBe("onSubmit");
      });

      it("maps onmouseover to PointerEntered", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseover: "onHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["PointerEntered"]).toBe("onHover");
      });

      it("maps onmouseenter to PointerEntered", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseenter: "onEnter" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["PointerEntered"]).toBe("onEnter");
      });

      it("maps onmouseleave to PointerExited", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseleave: "onLeave" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["PointerExited"]).toBe("onLeave");
      });

      it("maps ondrag to DragStarting", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrag: "onDrag" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["DragStarting"]).toBe("onDrag");
      });

      it("maps ondrop to Drop", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrop: "onDrop" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Drop"]).toBe("onDrop");
      });

      it("maps oncontextmenu to RightTapped", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ oncontextmenu: "onCtx" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["RightTapped"]).toBe("onCtx");
      });
    });

    // ---------------------------------------------------------------
    // class / className -> Style mapping
    // ---------------------------------------------------------------

    describe("class and className mapping", () => {
      it("maps class to Style", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ class: "ButtonStyle" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Style"]).toBe("ButtonStyle");
      });

      it("maps className to Style", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ className: "TextBlockStyle" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Style"]).toBe("TextBlockStyle");
      });
    });

    // ---------------------------------------------------------------
    // style -> inlineStyle mapping
    // ---------------------------------------------------------------

    describe("style mapping", () => {
      it("maps style to inlineStyle", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ style: "Foreground=Red" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["inlineStyle"]).toBe("Foreground=Red");
      });
    });

    // ---------------------------------------------------------------
    // aria-* -> AutomationProperties mappings
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to AutomationProperties.Name", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-label": "Submit button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["AutomationProperties.Name"]).toBe("Submit button");
      });

      it("maps aria-hidden=true to AutomationProperties.AccessibilityView=Raw", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["AutomationProperties.AccessibilityView"]).toBe("Raw");
      });

      it("maps aria-hidden=false to AutomationProperties.AccessibilityView=Content", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-hidden": "false" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["AutomationProperties.AccessibilityView"]).toBe("Content");
      });

      it("maps aria-role to AutomationProperties.LocalizedControlType", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-role": "button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["AutomationProperties.LocalizedControlType"]).toBe("button");
      });

      it("maps aria-describedby to AutomationProperties.HelpText", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-describedby": "tooltip-1" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["AutomationProperties.HelpText"]).toBe("tooltip-1");
      });

      it("maps arbitrary aria-* to AutomationProperties.<key>", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-expanded": "false", "aria-live": "polite" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["AutomationProperties.expanded"]).toBe("false");
        expect(normalized["AutomationProperties.live"]).toBe("polite");
      });
    });

    // ---------------------------------------------------------------
    // data-* -> Tag properties mappings
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to Tag:testid", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-testid": "btn-1" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Tag:testid"]).toBe("btn-1");
      });

      it("maps multiple data-* attributes correctly", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-page": "settings", "data-section": "general" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Tag:page"]).toBe("settings");
        expect(normalized["Tag:section"]).toBe("general");
      });
    });

    // ---------------------------------------------------------------
    // Pass-through for unknown keys
    // ---------------------------------------------------------------

    describe("pass-through for unknown keys", () => {
      it("passes through unknown props unchanged", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ Header: "Settings", IsEnabled: true }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Header"]).toBe("Settings");
        expect(normalized["IsEnabled"]).toBe(true);
      });
    });

    // ---------------------------------------------------------------
    // Case insensitivity
    // ---------------------------------------------------------------

    describe("case insensitivity", () => {
      it("handles onClick (camelCase) the same as onclick", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onClick: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Tapped"]).toBe("handler");
      });

      it("handles ONDBLCLICK (uppercase) the same as ondblclick", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ONDBLCLICK: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["DoubleTapped"]).toBe("handler");
      });

      it("handles CLASS (uppercase) the same as class", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ CLASS: "MyStyle" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Style"]).toBe("MyStyle");
      });
    });

    // ---------------------------------------------------------------
    // Multiple props combined
    // ---------------------------------------------------------------

    describe("multiple props combined", () => {
      it("normalizes a mixed set of XAML-bound props in one call", async () => {
        const storage = createInMemoryStorage();
        const props = {
          onclick: "clickHandler",
          ondblclick: "dblHandler",
          class: "NavigationViewStyle",
          "aria-label": "Navigation menu",
          "aria-hidden": "true",
          "data-testid": "nav-menu",
          style: "Background=Transparent",
          Content: "Menu",
        };
        const result = await winuiadapterHandler.normalize(
          { adapter: "winui-mix", props: JSON.stringify(props) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Tapped"]).toBe("clickHandler");
        expect(normalized["DoubleTapped"]).toBe("dblHandler");
        expect(normalized["Style"]).toBe("NavigationViewStyle");
        expect(normalized["AutomationProperties.Name"]).toBe("Navigation menu");
        expect(normalized["AutomationProperties.AccessibilityView"]).toBe("Raw");
        expect(normalized["Tag:testid"]).toBe("nav-menu");
        expect(normalized["inlineStyle"]).toBe("Background=Transparent");
        expect(normalized["Content"]).toBe("Menu");
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error when props is an empty string", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is only whitespace", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: "   " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: "<xaml>not json</xaml>" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error when props is undefined", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is null", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: null as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for a bare non-JSON string", async () => {
        const storage = createInMemoryStorage();
        const result = await winuiadapterHandler.normalize(
          { adapter: "a", props: "Button_Click" },
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
        await winuiadapterHandler.normalize(
          { adapter: "winui-store", props: JSON.stringify({ onclick: "fn" }) },
          storage,
        );

        const record = await storage.get("output", "winui-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("winui-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["Tapped"]).toBe("fn");
      });

      it("overwrites previous storage entry for the same adapter", async () => {
        const storage = createInMemoryStorage();
        await winuiadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await winuiadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "a1");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["Tapped"]).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await winuiadapterHandler.normalize(
          { adapter: "bad", props: "" },
          storage,
        );

        const record = await storage.get("output", "bad");
        expect(record).toBeNull();
      });

      it("stores different adapters independently", async () => {
        const storage = createInMemoryStorage();
        await winuiadapterHandler.normalize(
          { adapter: "w1", props: JSON.stringify({ onclick: "fn1" }) },
          storage,
        );
        await winuiadapterHandler.normalize(
          { adapter: "w2", props: JSON.stringify({ onchange: "fn2" }) },
          storage,
        );

        const r1 = await storage.get("output", "w1");
        const r2 = await storage.get("output", "w2");
        const o1 = JSON.parse(r1!.outputs as string);
        const o2 = JSON.parse(r2!.outputs as string);
        expect(o1["Tapped"]).toBe("fn1");
        expect(o2["SelectionChanged"]).toBe("fn2");
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
        class: "AppBarButtonStyle",
        "aria-label": "Settings button",
        "aria-hidden": "false",
        "data-id": "settings-btn",
      };

      // First normalize
      const result1 = await winuiadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result1.variant).toBe("ok");

      // Read back from storage
      const record = await storage.get("output", "int-1");
      expect(record).not.toBeNull();
      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs["Tapped"]).toBe("doClick");
      expect(storedOutputs["Style"]).toBe("AppBarButtonStyle");
      expect(storedOutputs["AutomationProperties.Name"]).toBe("Settings button");
      expect(storedOutputs["AutomationProperties.AccessibilityView"]).toBe("Content");
      expect(storedOutputs["Tag:id"]).toBe("settings-btn");

      // Re-normalize
      const result2 = await winuiadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result2.variant).toBe("ok");
      expect((result2 as any).normalized).toBe((result1 as any).normalized);
    });

    it("normalizes all WinUI event handlers simultaneously", async () => {
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

      const result = await winuiadapterHandler.normalize(
        { adapter: "all-events", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["Tapped"]).toBe("c");
      expect(n["DoubleTapped"]).toBe("dc");
      expect(n["SelectionChanged"]).toBe("ch");
      expect(n["ViewChanged"]).toBe("sc");
      expect(n["GotFocus"]).toBe("fo");
      expect(n["LostFocus"]).toBe("bl");
      expect(n["KeyDown"]).toBe("kd");
      expect(n["KeyUp"]).toBe("ku");
      expect(n["TextSubmitted"]).toBe("su");
      expect(n["PointerEntered"]).toBe("mo");
      expect(n["PointerExited"]).toBe("ml");
      expect(n["DragStarting"]).toBe("dr");
      expect(n["Drop"]).toBe("dp");
      expect(n["RightTapped"]).toBe("ctx");
    });

    it("handles props with special characters in values", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "Button_Click",
        "aria-label": "Label with {Binding} syntax",
        "data-json": "{\"key\":\"val\"}",
      };

      const result = await winuiadapterHandler.normalize(
        { adapter: "special", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["Tapped"]).toBe("Button_Click");
      expect(n["AutomationProperties.Name"]).toBe("Label with {Binding} syntax");
      expect(n["Tag:json"]).toBe("{\"key\":\"val\"}");
    });

    it("handles numeric and boolean values in props", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-hidden": "true",
        "data-count": 42,
        Width: 200,
        IsEnabled: false,
      };

      const result = await winuiadapterHandler.normalize(
        { adapter: "types", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["AutomationProperties.AccessibilityView"]).toBe("Raw");
      expect(n["Tag:count"]).toBe(42);
      expect(n["Width"]).toBe(200);
      expect(n["IsEnabled"]).toBe(false);
    });
  });
});
