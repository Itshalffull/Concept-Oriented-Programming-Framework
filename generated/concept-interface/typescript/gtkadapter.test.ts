import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { gtkadapterHandler } from "./gtkadapter.impl";

describe("GTKAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple onclick prop to signal:clicked", async () => {
      const storage = createInMemoryStorage();
      const result = await gtkadapterHandler.normalize(
        { adapter: "gtk-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["signal:clicked"]).toBe("handleClick");
    });

    it("returns the adapter id in the ok response", async () => {
      const storage = createInMemoryStorage();
      const result = await gtkadapterHandler.normalize(
        { adapter: "my-gtk", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("my-gtk");
    });

    it("normalizes an empty props object to an empty normalized object", async () => {
      const storage = createInMemoryStorage();
      const result = await gtkadapterHandler.normalize(
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
      it("maps onclick to signal:clicked", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onclick: "onClick" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["signal:clicked"]).toBe("onClick");
      });

      it("maps ondblclick to gesture:pressed:n_press:2", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondblclick: "onDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["gesture:pressed:n_press:2"]).toBe("onDbl");
      });

      it("maps onchange to signal:changed", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onchange: "onChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["signal:changed"]).toBe("onChange");
      });

      it("maps onscroll to controller:scroll", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onscroll: "onScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:scroll"]).toBe("onScroll");
      });

      it("maps onfocus to controller:focus-in", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onfocus: "onFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:focus-in"]).toBe("onFocus");
      });

      it("maps onblur to controller:focus-out", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onblur: "onBlur" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:focus-out"]).toBe("onBlur");
      });

      it("maps onkeydown to controller:key-pressed", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeydown: "onKey" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:key-pressed"]).toBe("onKey");
      });

      it("maps onkeyup to controller:key-released", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeyup: "onKeyUp" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:key-released"]).toBe("onKeyUp");
      });

      it("maps onsubmit to signal:activate", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onsubmit: "onSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["signal:activate"]).toBe("onSubmit");
      });

      it("maps onmouseover to controller:enter", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseover: "onHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:enter"]).toBe("onHover");
      });

      it("maps onmouseenter to controller:enter", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseenter: "onEnter" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:enter"]).toBe("onEnter");
      });

      it("maps onmouseleave to controller:leave", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseleave: "onLeave" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:leave"]).toBe("onLeave");
      });

      it("maps ondrag to controller:drag-begin", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrag: "onDrag" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:drag-begin"]).toBe("onDrag");
      });

      it("maps ondrop to controller:drop", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrop: "onDrop" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["controller:drop"]).toBe("onDrop");
      });

      it("maps oncontextmenu to gesture:pressed:button:3", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ oncontextmenu: "onCtx" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["gesture:pressed:button:3"]).toBe("onCtx");
      });
    });

    // ---------------------------------------------------------------
    // class / className -> cssClass mapping
    // ---------------------------------------------------------------

    describe("class and className mapping", () => {
      it("maps class to cssClass", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ class: "suggested-action" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["cssClass"]).toBe("suggested-action");
      });

      it("maps className to cssClass", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ className: "destructive-action" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["cssClass"]).toBe("destructive-action");
      });
    });

    // ---------------------------------------------------------------
    // style -> cssProvider:inline mapping
    // ---------------------------------------------------------------

    describe("style mapping", () => {
      it("maps style to cssProvider:inline", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ style: "color: #ff0000;" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["cssProvider:inline"]).toBe("color: #ff0000;");
      });
    });

    // ---------------------------------------------------------------
    // aria-* -> accessible properties mappings
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to accessible:label", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-label": "Open file" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["accessible:label"]).toBe("Open file");
      });

      it("maps aria-hidden to accessible:hidden", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["accessible:hidden"]).toBe("true");
      });

      it("maps aria-role to accessible:role", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-role": "button" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["accessible:role"]).toBe("button");
      });

      it("maps aria-describedby to accessible:description", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-describedby": "desc-1" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["accessible:description"]).toBe("desc-1");
      });

      it("maps arbitrary aria-* to accessible:<key>", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-expanded": "true", "aria-valuenow": "75" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["accessible:expanded"]).toBe("true");
        expect(normalized["accessible:valuenow"]).toBe("75");
      });
    });

    // ---------------------------------------------------------------
    // data-* -> g_object_set_data keys mappings
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to g_object_set_data:testid", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-testid": "open-btn" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["g_object_set_data:testid"]).toBe("open-btn");
      });

      it("maps multiple data-* attributes correctly", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-widget": "headerbar", "data-position": "top" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["g_object_set_data:widget"]).toBe("headerbar");
        expect(normalized["g_object_set_data:position"]).toBe("top");
      });
    });

    // ---------------------------------------------------------------
    // Pass-through for unknown keys
    // ---------------------------------------------------------------

    describe("pass-through for unknown keys", () => {
      it("passes through unknown props unchanged", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ label: "Click Me", sensitive: true }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["label"]).toBe("Click Me");
        expect(normalized["sensitive"]).toBe(true);
      });
    });

    // ---------------------------------------------------------------
    // Case insensitivity
    // ---------------------------------------------------------------

    describe("case insensitivity", () => {
      it("handles onClick (camelCase) the same as onclick", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onClick: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["signal:clicked"]).toBe("handler");
      });

      it("handles ONDBLCLICK (uppercase) the same as ondblclick", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ONDBLCLICK: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["gesture:pressed:n_press:2"]).toBe("handler");
      });

      it("handles CLASS (uppercase) the same as class", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ CLASS: "flat" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["cssClass"]).toBe("flat");
      });

      it("handles STYLE (uppercase) the same as style", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ STYLE: "margin: 12px;" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["cssProvider:inline"]).toBe("margin: 12px;");
      });
    });

    // ---------------------------------------------------------------
    // Multiple props combined
    // ---------------------------------------------------------------

    describe("multiple props combined", () => {
      it("normalizes a mixed set of GTK-bound props in one call", async () => {
        const storage = createInMemoryStorage();
        const props = {
          onclick: "clickedCallback",
          ondblclick: "dblCallback",
          class: "suggested-action",
          "aria-label": "Save button",
          "aria-describedby": "save-desc",
          "data-testid": "save-btn",
          style: "padding: 8px;",
          label: "Save",
        };
        const result = await gtkadapterHandler.normalize(
          { adapter: "gtk-mix", props: JSON.stringify(props) },
          storage,
        );
        expect(result.variant).toBe("ok");
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["signal:clicked"]).toBe("clickedCallback");
        expect(normalized["gesture:pressed:n_press:2"]).toBe("dblCallback");
        expect(normalized["cssClass"]).toBe("suggested-action");
        expect(normalized["accessible:label"]).toBe("Save button");
        expect(normalized["accessible:description"]).toBe("save-desc");
        expect(normalized["g_object_set_data:testid"]).toBe("save-btn");
        expect(normalized["cssProvider:inline"]).toBe("padding: 8px;");
        expect(normalized["label"]).toBe("Save");
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error when props is an empty string", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is only whitespace", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: "   \t  " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: "g_signal_connect(btn, \"clicked\", ...)" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error when props is undefined", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is null", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: null as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for a bare non-JSON string", async () => {
        const storage = createInMemoryStorage();
        const result = await gtkadapterHandler.normalize(
          { adapter: "a", props: "GtkButton" },
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
        await gtkadapterHandler.normalize(
          { adapter: "gtk-store", props: JSON.stringify({ onclick: "fn" }) },
          storage,
        );

        const record = await storage.get("output", "gtk-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("gtk-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["signal:clicked"]).toBe("fn");
      });

      it("overwrites previous storage entry for the same adapter", async () => {
        const storage = createInMemoryStorage();
        await gtkadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await gtkadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "a1");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["signal:clicked"]).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await gtkadapterHandler.normalize(
          { adapter: "bad", props: "" },
          storage,
        );

        const record = await storage.get("output", "bad");
        expect(record).toBeNull();
      });

      it("stores different adapters independently", async () => {
        const storage = createInMemoryStorage();
        await gtkadapterHandler.normalize(
          { adapter: "g1", props: JSON.stringify({ onclick: "fn1" }) },
          storage,
        );
        await gtkadapterHandler.normalize(
          { adapter: "g2", props: JSON.stringify({ onchange: "fn2" }) },
          storage,
        );

        const r1 = await storage.get("output", "g1");
        const r2 = await storage.get("output", "g2");
        const o1 = JSON.parse(r1!.outputs as string);
        const o2 = JSON.parse(r2!.outputs as string);
        expect(o1["signal:clicked"]).toBe("fn1");
        expect(o2["signal:changed"]).toBe("fn2");
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
        class: "linked",
        "aria-label": "Navigation button",
        "aria-describedby": "nav-desc",
        "data-id": "nav-btn",
      };

      // First normalize
      const result1 = await gtkadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result1.variant).toBe("ok");

      // Read back from storage
      const record = await storage.get("output", "int-1");
      expect(record).not.toBeNull();
      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs["signal:clicked"]).toBe("doClick");
      expect(storedOutputs["cssClass"]).toBe("linked");
      expect(storedOutputs["accessible:label"]).toBe("Navigation button");
      expect(storedOutputs["accessible:description"]).toBe("nav-desc");
      expect(storedOutputs["g_object_set_data:id"]).toBe("nav-btn");

      // Re-normalize
      const result2 = await gtkadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result2.variant).toBe("ok");
      expect((result2 as any).normalized).toBe((result1 as any).normalized);
    });

    it("normalizes all GTK event handlers simultaneously", async () => {
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

      const result = await gtkadapterHandler.normalize(
        { adapter: "all-events", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["signal:clicked"]).toBe("c");
      expect(n["gesture:pressed:n_press:2"]).toBe("dc");
      expect(n["signal:changed"]).toBe("ch");
      expect(n["controller:scroll"]).toBe("sc");
      expect(n["controller:focus-in"]).toBe("fo");
      expect(n["controller:focus-out"]).toBe("bl");
      expect(n["controller:key-pressed"]).toBe("kd");
      expect(n["controller:key-released"]).toBe("ku");
      expect(n["signal:activate"]).toBe("su");
      expect(n["controller:enter"]).toBe("mo");
      expect(n["controller:leave"]).toBe("ml");
      expect(n["controller:drag-begin"]).toBe("dr");
      expect(n["controller:drop"]).toBe("dp");
      expect(n["gesture:pressed:button:3"]).toBe("ctx");
    });

    it("handles props with special characters in values", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "on_button_clicked",
        "aria-label": "Label with <markup> & entities",
        "data-json": "{\"nested\":true}",
      };

      const result = await gtkadapterHandler.normalize(
        { adapter: "special", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["signal:clicked"]).toBe("on_button_clicked");
      expect(n["accessible:label"]).toBe("Label with <markup> & entities");
      expect(n["g_object_set_data:json"]).toBe("{\"nested\":true}");
    });

    it("handles numeric and boolean values in props", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-hidden": true,
        "data-count": 42,
        widthRequest: 200,
        sensitive: false,
      };

      const result = await gtkadapterHandler.normalize(
        { adapter: "types", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["accessible:hidden"]).toBe(true);
      expect(n["g_object_set_data:count"]).toBe(42);
      expect(n["widthRequest"]).toBe(200);
      expect(n["sensitive"]).toBe(false);
    });

    it("verifies GTK gesture pattern: double-click uses n_press:2 and right-click uses button:3", async () => {
      const storage = createInMemoryStorage();
      const props = {
        ondblclick: "dblHandler",
        oncontextmenu: "ctxHandler",
      };

      const result = await gtkadapterHandler.normalize(
        { adapter: "gestures", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      // GTK uses GtkGestureClick with n_press parameter for double-click
      expect(n["gesture:pressed:n_press:2"]).toBe("dblHandler");
      // GTK uses GtkGestureClick with button parameter for right-click
      expect(n["gesture:pressed:button:3"]).toBe("ctxHandler");
    });

    it("verifies GTK signal vs controller distinction", async () => {
      const storage = createInMemoryStorage();
      const props = {
        onclick: "clickCb",
        onchange: "changeCb",
        onsubmit: "activateCb",
        onfocus: "focusCb",
        onkeydown: "keyCb",
        onscroll: "scrollCb",
      };

      const result = await gtkadapterHandler.normalize(
        { adapter: "sig-vs-ctrl", props: JSON.stringify(props) },
        storage,
      );
      const n = JSON.parse((result as any).normalized);
      // signal-based: clicked, changed, activate
      expect(n["signal:clicked"]).toBe("clickCb");
      expect(n["signal:changed"]).toBe("changeCb");
      expect(n["signal:activate"]).toBe("activateCb");
      // controller-based: focus-in, key-pressed, scroll
      expect(n["controller:focus-in"]).toBe("focusCb");
      expect(n["controller:key-pressed"]).toBe("keyCb");
      expect(n["controller:scroll"]).toBe("scrollCb");
    });
  });
});
