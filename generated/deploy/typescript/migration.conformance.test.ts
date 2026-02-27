// generated: migration.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { migrationHandler } from "./migration.impl";

describe("Migration conformance", () => {

  it("invariant 1: after plan, expand, migrate behaves correctly", async () => {
    const storage = createInMemoryStorage();

    let m = "u-test-invariant-001";
    let s = "u-test-invariant-002";

    // --- AFTER clause ---
    // plan(concept: "Entity", fromVersion: 1, toVersion: 2) -> ok(migration: m, steps: s, estimatedRecords: 1000)
    const step1 = await migrationHandler.plan(
      { concept: "Entity", fromVersion: 1, toVersion: 2 },
      storage,
    );
    expect(step1.variant).toBe("ok");
    m = (step1 as any).migration;
    s = (step1 as any).steps;
    expect((step1 as any).estimatedRecords).toBe(1000);

    // --- THEN clause ---
    // expand(migration: m) -> ok(migration: m)
    const step2 = await migrationHandler.expand(
      { migration: m },
      storage,
    );
    expect(step2.variant).toBe("ok");
    m = (step2 as any).migration;
    // migrate(migration: m) -> ok(migration: m, recordsMigrated: 1000)
    const step3 = await migrationHandler.migrate(
      { migration: m },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).migration).toBe(m);
    expect((step3 as any).recordsMigrated).toBe(1000);
  });

});
