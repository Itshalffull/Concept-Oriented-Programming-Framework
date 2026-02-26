// generated: view.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { viewHandler } from "./view.impl";

describe("View conformance", () => {

  it("invariant 1: after create, setFilter behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(view: v, dataSource: "tasks", layout: "table") -> ok(view: v)
    const step1 = await viewHandler.create(
      { view: v, dataSource: "tasks", layout: "table" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).view).toBe(v);

    // --- THEN clause ---
    // setFilter(view: v, filter: "status=active") -> ok(view: v)
    const step2 = await viewHandler.setFilter(
      { view: v, filter: "status=active" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).view).toBe(v);
  });

  it("invariant 2: after setFilter, changeLayout behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const v = "u-test-invariant-001";

    // --- AFTER clause ---
    // setFilter(view: v, filter: "status=active") -> ok(view: v)
    const step1 = await viewHandler.setFilter(
      { view: v, filter: "status=active" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).view).toBe(v);

    // --- THEN clause ---
    // changeLayout(view: v, layout: "board") -> ok(view: v)
    const step2 = await viewHandler.changeLayout(
      { view: v, layout: "board" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).view).toBe(v);
  });

});
