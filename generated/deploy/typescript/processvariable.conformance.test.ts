// generated: processvariable.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processVariableHandler } from "./processvariable.impl";

describe("ProcessVariable conformance", () => {

  it("invariant: after set, get returns the stored value", async () => {
    const storage = createInMemoryStorage();

    const setResult = await processVariableHandler.set(
      { run_ref: "r1", name: "total", value: "42", value_type: "int", scope: "run" },
      storage,
    );
    expect(setResult.variant).toBe("ok");
    const varId = (setResult as any).var;

    const got = await processVariableHandler.get(
      { run_ref: "r1", name: "total" },
      storage,
    );
    expect(got.variant).toBe("ok");
    expect((got as any).var).toBe(varId);
    expect((got as any).value).toBe("42");
    expect((got as any).value_type).toBe("int");
  });

  it("get returns not_found for nonexistent variable", async () => {
    const storage = createInMemoryStorage();

    const result = await processVariableHandler.get(
      { run_ref: "r1", name: "missing" },
      storage,
    );
    expect(result.variant).toBe("not_found");
  });

  it("set overwrites existing variable", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "count", value: "1", value_type: "int", scope: "run" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "r1", name: "count", value: "2", value_type: "int", scope: "run" },
      storage,
    );

    const got = await processVariableHandler.get(
      { run_ref: "r1", name: "count" },
      storage,
    );
    expect((got as any).value).toBe("2");
  });

  it("merge with replace strategy overwrites value", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "status", value: "pending", value_type: "string", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "r1", name: "status", update: "done", strategy: "replace" },
      storage,
    );
    expect(merged.variant).toBe("ok");
    expect((merged as any).merged_value).toBe("done");
  });

  it("merge with sum strategy adds numerically", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "total", value: "10", value_type: "int", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "r1", name: "total", update: "5", strategy: "sum" },
      storage,
    );
    expect(merged.variant).toBe("ok");
    expect((merged as any).merged_value).toBe("15");
  });

  it("merge with max strategy keeps maximum", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "high", value: "10", value_type: "int", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "r1", name: "high", update: "25", strategy: "max" },
      storage,
    );
    expect((merged as any).merged_value).toBe("25");
  });

  it("merge with min strategy keeps minimum", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "low", value: "10", value_type: "int", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "r1", name: "low", update: "3", strategy: "min" },
      storage,
    );
    expect((merged as any).merged_value).toBe("3");
  });

  it("merge with append strategy appends to array", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "items", value: '["a","b"]', value_type: "json", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "r1", name: "items", update: '"c"', strategy: "append" },
      storage,
    );
    expect(merged.variant).toBe("ok");
    const result = JSON.parse((merged as any).merged_value);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("merge with sum on non-numeric returns merge_error", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "text", value: "hello", value_type: "string", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "r1", name: "text", update: "world", strategy: "sum" },
      storage,
    );
    expect(merged.variant).toBe("merge_error");
  });

  it("delete removes variable", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "temp", value: "x", value_type: "string", scope: "run" },
      storage,
    );

    const deleted = await processVariableHandler.delete(
      { run_ref: "r1", name: "temp" },
      storage,
    );
    expect(deleted.variant).toBe("ok");

    const got = await processVariableHandler.get(
      { run_ref: "r1", name: "temp" },
      storage,
    );
    expect(got.variant).toBe("not_found");
  });

  it("delete returns not_found for nonexistent variable", async () => {
    const storage = createInMemoryStorage();

    const result = await processVariableHandler.delete(
      { run_ref: "r1", name: "nope" },
      storage,
    );
    expect(result.variant).toBe("not_found");
  });

  it("list returns all variables for a run", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "a", value: "1", value_type: "int", scope: "run" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "r1", name: "b", value: "2", value_type: "int", scope: "run" },
      storage,
    );

    const listed = await processVariableHandler.list({ run_ref: "r1" }, storage);
    expect(listed.variant).toBe("ok");
    const vars = JSON.parse((listed as any).variables);
    expect(vars).toHaveLength(2);
    expect(vars.map((v: any) => v.name).sort()).toEqual(["a", "b"]);
  });

  it("snapshot returns serialized snapshot of all variables", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "r1", name: "x", value: "10", value_type: "int", scope: "run" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "r1", name: "y", value: "hello", value_type: "string", scope: "step" },
      storage,
    );

    const snap = await processVariableHandler.snapshot({ run_ref: "r1" }, storage);
    expect(snap.variant).toBe("ok");
    const parsed = JSON.parse((snap as any).snapshot);
    expect(parsed.x.value).toBe("10");
    expect(parsed.y.value).toBe("hello");
    expect(parsed.y.scope).toBe("step");
  });
});
