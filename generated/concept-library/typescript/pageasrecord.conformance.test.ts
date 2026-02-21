// generated: pageasrecord.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
import { pageasrecordHandler } from "./pageasrecord.impl";

describe("PageAsRecord conformance", () => {

  it("invariant 1: after create, setProperty, getProperty behaves correctly", async () => {
    const storage = createInMemoryStorage();

    const p = "u-test-invariant-001";

    // --- AFTER clause ---
    // create(page: p, schema: "{\"fields\":[\"title\"]}") -> ok(page: p)
    const step1 = await pageasrecordHandler.create(
      { page: p, schema: "{\"fields\":[\"title\"]}" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).page).toBe(p);
    // setProperty(page: p, key: "title", value: "My Page") -> ok(page: p)
    const step2 = await pageasrecordHandler.setProperty(
      { page: p, key: "title", value: "My Page" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).page).toBe(p);

    // --- THEN clause ---
    // getProperty(page: p, key: "title") -> ok(value: "My Page")
    const step3 = await pageasrecordHandler.getProperty(
      { page: p, key: "title" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).value).toBe("My Page");
  });

});
