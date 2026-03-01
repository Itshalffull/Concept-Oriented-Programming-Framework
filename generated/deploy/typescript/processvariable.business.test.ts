import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@clef/runtime";
import { processVariableHandler } from "./processvariable.impl";

describe("ProcessVariable business logic", () => {
  it("set then get returns the stored value", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-1", name: "counter", value: "42", value_type: "number", scope: "run" },
      storage,
    );

    const got = await processVariableHandler.get(
      { run_ref: "run-1", name: "counter" },
      storage,
    );
    expect(got.variant).toBe("ok");
    expect((got as any).value).toBe("42");
    expect((got as any).value_type).toBe("number");
  });

  it("get nonexistent variable returns not_found", async () => {
    const storage = createInMemoryStorage();
    const result = await processVariableHandler.get(
      { run_ref: "run-2", name: "missing" },
      storage,
    );
    expect(result.variant).toBe("not_found");
  });

  it("set overwrites existing value", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-3", name: "status", value: "pending", value_type: "string", scope: "run" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "run-3", name: "status", value: "approved", value_type: "string", scope: "run" },
      storage,
    );

    const got = await processVariableHandler.get(
      { run_ref: "run-3", name: "status" },
      storage,
    );
    expect((got as any).value).toBe("approved");
  });

  it("merge with append strategy concatenates arrays", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-4", name: "items", value: '["a","b"]', value_type: "json", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "run-4", name: "items", update: '["c"]', strategy: "append" },
      storage,
    );
    expect(merged.variant).toBe("ok");

    const parsed = JSON.parse((merged as any).merged_value);
    expect(parsed).toEqual(["a", "b", "c"]);
  });

  it("merge with sum strategy adds numeric values", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-5", name: "total", value: "100", value_type: "number", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "run-5", name: "total", update: "50", strategy: "sum" },
      storage,
    );
    expect(merged.variant).toBe("ok");
    expect((merged as any).merged_value).toBe("150");
  });

  it("merge with replace strategy overwrites", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-6", name: "config", value: '{"old":true}', value_type: "json", scope: "run" },
      storage,
    );

    const merged = await processVariableHandler.merge(
      { run_ref: "run-6", name: "config", update: '{"new":true}', strategy: "replace" },
      storage,
    );
    expect(merged.variant).toBe("ok");
    expect((merged as any).merged_value).toBe('{"new":true}');
  });

  it("merge on nonexistent variable returns not_found", async () => {
    const storage = createInMemoryStorage();
    const result = await processVariableHandler.merge(
      { run_ref: "run-7", name: "phantom", update: "123", strategy: "sum" },
      storage,
    );
    expect(result.variant).toBe("not_found");
  });

  it("delete then get returns not_found", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-8", name: "temp", value: "data", value_type: "string", scope: "step" },
      storage,
    );

    const deleted = await processVariableHandler.delete(
      { run_ref: "run-8", name: "temp" },
      storage,
    );
    expect(deleted.variant).toBe("ok");

    const got = await processVariableHandler.get(
      { run_ref: "run-8", name: "temp" },
      storage,
    );
    expect(got.variant).toBe("not_found");
  });

  it("list returns all variables for a run", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-9", name: "alpha", value: "1", value_type: "number", scope: "run" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "run-9", name: "beta", value: "two", value_type: "string", scope: "step" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "run-9", name: "gamma", value: '{"x":3}', value_type: "json", scope: "global" },
      storage,
    );

    const listed = await processVariableHandler.list({ run_ref: "run-9" }, storage);
    expect(listed.variant).toBe("ok");
    const vars = JSON.parse((listed as any).variables);
    expect(vars.length).toBe(3);
    const names = vars.map((v: any) => v.name).sort();
    expect(names).toEqual(["alpha", "beta", "gamma"]);
  });

  it("snapshot captures all variables keyed by name", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-10", name: "x", value: "10", value_type: "number", scope: "run" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "run-10", name: "y", value: "hello", value_type: "string", scope: "step" },
      storage,
    );

    const snap = await processVariableHandler.snapshot({ run_ref: "run-10" }, storage);
    expect(snap.variant).toBe("ok");
    const parsed = JSON.parse((snap as any).snapshot);
    expect(parsed.x.value).toBe("10");
    expect(parsed.x.value_type).toBe("number");
    expect(parsed.y.value).toBe("hello");
    expect(parsed.y.scope).toBe("step");
  });

  it("different scopes are stored correctly for variables", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-11", name: "scoped_step", value: "step_val", value_type: "string", scope: "step" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "run-11", name: "scoped_run", value: "run_val", value_type: "string", scope: "run" },
      storage,
    );
    await processVariableHandler.set(
      { run_ref: "run-11", name: "scoped_global", value: "global_val", value_type: "string", scope: "global" },
      storage,
    );

    const snap = await processVariableHandler.snapshot({ run_ref: "run-11" }, storage);
    const parsed = JSON.parse((snap as any).snapshot);
    expect(parsed.scoped_step.scope).toBe("step");
    expect(parsed.scoped_run.scope).toBe("run");
    expect(parsed.scoped_global.scope).toBe("global");
  });

  it("merge with sum strategy on non-numeric values returns merge_error", async () => {
    const storage = createInMemoryStorage();

    await processVariableHandler.set(
      { run_ref: "run-12", name: "text", value: "hello", value_type: "string", scope: "run" },
      storage,
    );

    const result = await processVariableHandler.merge(
      { run_ref: "run-12", name: "text", update: "world", strategy: "sum" },
      storage,
    );
    expect(result.variant).toBe("merge_error");
    expect((result as any).message).toContain("non-numeric");
  });
});
