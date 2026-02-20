import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { wearcomposeadapterHandler } from "./wearcomposeadapter.impl";

describe("WearComposeAdapter Concept", () => {
  // ---------------------------------------------------------------
  // normalize – happy path
  // ---------------------------------------------------------------

  describe("normalize", () => {
    it("normalizes a simple onclick prop to Modifier.clickable", async () => {
      const storage = createInMemoryStorage();
      const result = await wearcomposeadapterHandler.normalize(
        { adapter: "wear-1", props: JSON.stringify({ onclick: "handleClick" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const normalized = JSON.parse((result as any).normalized);
      expect(normalized["Modifier.clickable"]).toBe("handleClick");
    });

    it("returns the adapter id in the ok response", async () => {
      const storage = createInMemoryStorage();
      const result = await wearcomposeadapterHandler.normalize(
        { adapter: "my-wear", props: JSON.stringify({ onclick: "fn" }) },
        storage,
      );
      expect(result.variant).toBe("ok");
      expect((result as any).adapter).toBe("my-wear");
    });

    it("normalizes an empty props object to an empty normalized object", async () => {
      const storage = createInMemoryStorage();
      const result = await wearcomposeadapterHandler.normalize(
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
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onclick: "onClick" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.clickable"]).toBe("onClick");
      });

      it("maps ondblclick to Modifier.combinedClickable:onDoubleClick", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondblclick: "onDbl" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.combinedClickable:onDoubleClick"]).toBe("onDbl");
      });

      it("maps onchange to onValueChange", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onchange: "onChange" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["onValueChange"]).toBe("onChange");
      });

      it("maps onscroll to Modifier.rotaryScrollable (crown/bezel)", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onscroll: "onScroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.rotaryScrollable"]).toBe("onScroll");
      });

      it("maps onfocus to Modifier.onFocusChanged", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onfocus: "onFocus" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.onFocusChanged"]).toBe("onFocus");
      });

      it("maps onblur to Modifier.onFocusChanged:lost", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onblur: "onBlur" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.onFocusChanged:lost"]).toBe("onBlur");
      });

      it("maps onkeydown to Modifier.onRotaryScrollEvent (rotary input)", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onkeydown: "onKey" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.onRotaryScrollEvent"]).toBe("onKey");
      });

      it("maps onsubmit to keyboardActions:onDone", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onsubmit: "onSubmit" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["keyboardActions:onDone"]).toBe("onSubmit");
      });
    });

    // ---------------------------------------------------------------
    // Mouse/hover events IGNORED on Wear OS
    // ---------------------------------------------------------------

    describe("ignored mouse/hover/drag events", () => {
      it("ignores onmouseover (no pointer on Wear OS)", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseover: "onHover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("onmouseover");
        expect(normalized).not.toHaveProperty("Modifier.hoverable");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores onmouseenter (no pointer on Wear OS)", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseenter: "onEnter" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores onmouseleave (no pointer on Wear OS)", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onmouseleave: "onLeave" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores ondrag (not practical on Wear OS)", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrag: "onDrag" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("ondrag");
        expect(normalized).not.toHaveProperty("Modifier.draggable");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores ondrop (not practical on Wear OS)", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ondrop: "onDrop" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized).not.toHaveProperty("ondrop");
        expect(normalized).not.toHaveProperty("Modifier.dropTarget");
        expect(Object.keys(normalized)).toHaveLength(0);
      });

      it("ignores mouse events but keeps other props in a mixed set", async () => {
        const storage = createInMemoryStorage();
        const props = {
          onclick: "handleClick",
          onmouseover: "hoverHandler",
          ondrag: "dragHandler",
          onchange: "changeHandler",
        };
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify(props) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.clickable"]).toBe("handleClick");
        expect(normalized["onValueChange"]).toBe("changeHandler");
        expect(Object.keys(normalized)).toHaveLength(2);
      });
    });

    // ---------------------------------------------------------------
    // class / className mapping
    // ---------------------------------------------------------------

    describe("class and className mapping", () => {
      it("maps class to Modifier", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ class: "wear-btn" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier"]).toBe("wear-btn");
      });

      it("maps className to Modifier", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ className: "wear-card" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier"]).toBe("wear-card");
      });
    });

    // ---------------------------------------------------------------
    // style mapping
    // ---------------------------------------------------------------

    describe("style mapping", () => {
      it("maps style to Modifier.style", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ style: "shape:round" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.style"]).toBe("shape:round");
      });
    });

    // ---------------------------------------------------------------
    // aria-* attribute mappings
    // ---------------------------------------------------------------

    describe("aria-* attribute mappings", () => {
      it("maps aria-label to Modifier.semantics:contentDescription", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-label": "Heart rate" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:contentDescription"]).toBe("Heart rate");
      });

      it("maps aria-hidden to Modifier.semantics:invisibleToUser", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-hidden": "true" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:invisibleToUser"]).toBe("true");
      });

      it("maps aria-role to Modifier.semantics:role", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-role": "timer" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:role"]).toBe("timer");
      });

      it("maps arbitrary aria-* to Modifier.semantics:<key>", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "aria-valuenow": "72" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.semantics:valuenow"]).toBe("72");
      });
    });

    // ---------------------------------------------------------------
    // data-* attribute mappings
    // ---------------------------------------------------------------

    describe("data-* attribute mappings", () => {
      it("maps data-testid to Modifier.testTag:testid", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-testid": "hr-display" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.testTag:testid"]).toBe("hr-display");
      });

      it("maps multiple data-* attributes correctly", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ "data-screen": "main", "data-complication": "hr" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.testTag:screen"]).toBe("main");
        expect(normalized["Modifier.testTag:complication"]).toBe("hr");
      });
    });

    // ---------------------------------------------------------------
    // Pass-through for unknown keys
    // ---------------------------------------------------------------

    describe("pass-through for unknown keys", () => {
      it("passes through unknown props unchanged", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ complication: "heartRate", shape: "round" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["complication"]).toBe("heartRate");
        expect(normalized["shape"]).toBe("round");
      });
    });

    // ---------------------------------------------------------------
    // Case insensitivity
    // ---------------------------------------------------------------

    describe("case insensitivity", () => {
      it("handles onClick (camelCase) the same as onclick", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ onClick: "handler" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.clickable"]).toBe("handler");
      });

      it("handles ONSCROLL (uppercase) mapping to rotaryScrollable", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ONSCROLL: "scroll" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(normalized["Modifier.rotaryScrollable"]).toBe("scroll");
      });

      it("handles ONMOUSEOVER (uppercase) still being ignored", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: JSON.stringify({ ONMOUSEOVER: "hover" }) },
          storage,
        );
        const normalized = JSON.parse((result as any).normalized);
        expect(Object.keys(normalized)).toHaveLength(0);
      });
    });

    // ---------------------------------------------------------------
    // Error paths
    // ---------------------------------------------------------------

    describe("error paths", () => {
      it("returns error when props is an empty string", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: "" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is only whitespace", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: "  \t\n  " },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is invalid JSON", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: "{{bad}}" },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("Invalid JSON");
      });

      it("returns error when props is undefined", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: undefined as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error when props is null", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: null as any },
          storage,
        );
        expect(result.variant).toBe("error");
        expect((result as any).message).toContain("empty");
      });

      it("returns error for a bare non-JSON string", async () => {
        const storage = createInMemoryStorage();
        const result = await wearcomposeadapterHandler.normalize(
          { adapter: "a", props: "hello world" },
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
        await wearcomposeadapterHandler.normalize(
          { adapter: "wear-store", props: JSON.stringify({ onclick: "fn" }) },
          storage,
        );

        const record = await storage.get("output", "wear-store");
        expect(record).not.toBeNull();
        expect(record!.adapter).toBe("wear-store");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["Modifier.clickable"]).toBe("fn");
      });

      it("overwrites previous storage entry for the same adapter", async () => {
        const storage = createInMemoryStorage();
        await wearcomposeadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "first" }) },
          storage,
        );
        await wearcomposeadapterHandler.normalize(
          { adapter: "a1", props: JSON.stringify({ onclick: "second" }) },
          storage,
        );

        const record = await storage.get("output", "a1");
        const outputs = JSON.parse(record!.outputs as string);
        expect(outputs["Modifier.clickable"]).toBe("second");
      });

      it("does not write to storage on error", async () => {
        const storage = createInMemoryStorage();
        await wearcomposeadapterHandler.normalize(
          { adapter: "bad", props: "" },
          storage,
        );

        const record = await storage.get("output", "bad");
        expect(record).toBeNull();
      });

      it("stores different adapters independently", async () => {
        const storage = createInMemoryStorage();
        await wearcomposeadapterHandler.normalize(
          { adapter: "w1", props: JSON.stringify({ onclick: "fn1" }) },
          storage,
        );
        await wearcomposeadapterHandler.normalize(
          { adapter: "w2", props: JSON.stringify({ onscroll: "fn2" }) },
          storage,
        );

        const r1 = await storage.get("output", "w1");
        const r2 = await storage.get("output", "w2");
        const o1 = JSON.parse(r1!.outputs as string);
        const o2 = JSON.parse(r2!.outputs as string);
        expect(o1["Modifier.clickable"]).toBe("fn1");
        expect(o2["Modifier.rotaryScrollable"]).toBe("fn2");
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
        class: "chip",
        "aria-label": "Timer chip",
        "data-id": "chip-7",
        onscroll: "scrollHandler",
      };

      // First normalize
      const result1 = await wearcomposeadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result1.variant).toBe("ok");

      // Read back from storage
      const record = await storage.get("output", "int-1");
      expect(record).not.toBeNull();
      const storedOutputs = JSON.parse(record!.outputs as string);
      expect(storedOutputs["Modifier.clickable"]).toBe("doClick");
      expect(storedOutputs["Modifier"]).toBe("chip");
      expect(storedOutputs["Modifier.semantics:contentDescription"]).toBe("Timer chip");
      expect(storedOutputs["Modifier.testTag:id"]).toBe("chip-7");
      expect(storedOutputs["Modifier.rotaryScrollable"]).toBe("scrollHandler");

      // Re-normalize
      const result2 = await wearcomposeadapterHandler.normalize(
        { adapter: "int-1", props: JSON.stringify(props) },
        storage,
      );
      expect(result2.variant).toBe("ok");
      expect((result2 as any).normalized).toBe((result1 as any).normalized);
    });

    it("correctly differentiates from standard Compose: onscroll maps to rotaryScrollable", async () => {
      const storage = createInMemoryStorage();
      const result = await wearcomposeadapterHandler.normalize(
        { adapter: "diff", props: JSON.stringify({ onscroll: "sc" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      // Wear Compose uses rotaryScrollable, NOT verticalScroll
      expect(normalized["Modifier.rotaryScrollable"]).toBe("sc");
      expect(normalized).not.toHaveProperty("Modifier.verticalScroll");
    });

    it("correctly differentiates from standard Compose: mouse events are dropped", async () => {
      const storage = createInMemoryStorage();
      const result = await wearcomposeadapterHandler.normalize(
        { adapter: "diff2", props: JSON.stringify({ onmouseover: "h", ondrag: "d", ondrop: "dp" }) },
        storage,
      );
      const normalized = JSON.parse((result as any).normalized);
      expect(Object.keys(normalized)).toHaveLength(0);
    });

    it("handles all supported Wear events simultaneously", async () => {
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
      };

      const result = await wearcomposeadapterHandler.normalize(
        { adapter: "all-wear", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["Modifier.clickable"]).toBe("c");
      expect(n["Modifier.combinedClickable:onDoubleClick"]).toBe("dc");
      expect(n["onValueChange"]).toBe("ch");
      expect(n["Modifier.rotaryScrollable"]).toBe("sc");
      expect(n["Modifier.onFocusChanged"]).toBe("fo");
      expect(n["Modifier.onFocusChanged:lost"]).toBe("bl");
      expect(n["Modifier.onRotaryScrollEvent"]).toBe("kd");
      expect(n["keyboardActions:onDone"]).toBe("su");
      expect(Object.keys(n)).toHaveLength(8);
    });

    it("handles numeric and boolean values in props", async () => {
      const storage = createInMemoryStorage();
      const props = {
        "aria-hidden": true,
        "data-count": 42,
        radius: 180,
      };

      const result = await wearcomposeadapterHandler.normalize(
        { adapter: "types", props: JSON.stringify(props) },
        storage,
      );
      expect(result.variant).toBe("ok");
      const n = JSON.parse((result as any).normalized);
      expect(n["Modifier.semantics:invisibleToUser"]).toBe(true);
      expect(n["Modifier.testTag:count"]).toBe(42);
      expect(n["radius"]).toBe(180);
    });
  });
});
