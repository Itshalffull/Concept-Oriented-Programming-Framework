// generated: formbuilder.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { formbuilderHandler } from "./formbuilder.impl";

describe("FormBuilder conformance", () => {

  it("invariant 1: after buildForm, registerWidget behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const f = "u-test-invariant-001";

    // --- AFTER clause ---
    // buildForm(form: f, schema: "user-profile") -> ok(definition: _)
    const step1 = await formbuilderHandler.buildForm(
      { form: f, schema: "user-profile" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).definition).toBeDefined();

    // --- THEN clause ---
    // registerWidget(form: f, type: "date", widget: "datepicker") -> ok(form: f)
    const step2 = await formbuilderHandler.registerWidget(
      { form: f, type: "date", widget: "datepicker" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).form).toBe(f);
  });

  it("invariant 2: after registerWidget, validate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const f = "u-test-invariant-001";

    // --- AFTER clause ---
    // registerWidget(form: f, type: "date", widget: "datepicker") -> ok(form: f)
    const step1 = await formbuilderHandler.registerWidget(
      { form: f, type: "date", widget: "datepicker" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).form).toBe(f);

    // --- THEN clause ---
    // validate(form: f, data: "name=Alice&dob=2000-01-01") -> ok(valid: true, errors: "")
    const step2 = await formbuilderHandler.validate(
      { form: f, data: "name=Alice&dob=2000-01-01" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).valid).toBe(true);
    expect((step2 as any).errors).toBe("");
  });

});
