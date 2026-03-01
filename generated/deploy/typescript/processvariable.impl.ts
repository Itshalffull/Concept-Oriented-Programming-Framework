// generated: processvariable.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { ProcessVariableHandler } from "./processvariable.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_processvar");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_processvar", { value: next });
  return `pvar-${String(next).padStart(6, "0")}`;
}

function varKey(runRef: string, name: string): string {
  return `${runRef}::${name}`;
}

/** Retrieve the variable name index for a run, or initialize an empty one. */
async function getVarIndex(storage: ConceptStorage, runRef: string): Promise<string[]> {
  const index = await storage.get("varIndex", runRef);
  if (!index) return [];
  return JSON.parse(index.names as string);
}

async function putVarIndex(storage: ConceptStorage, runRef: string, names: string[]): Promise<void> {
  await storage.put("varIndex", runRef, { names: JSON.stringify(names) });
}

function applyMerge(existing: string, update: string, strategy: string): { ok: boolean; result: string; error?: string } {
  switch (strategy) {
    case "replace":
      return { ok: true, result: update };

    case "append": {
      try {
        const arr = JSON.parse(existing);
        const addition = JSON.parse(update);
        const merged = Array.isArray(arr) ? [...arr, ...(Array.isArray(addition) ? addition : [addition])] : [arr, addition];
        return { ok: true, result: JSON.stringify(merged) };
      } catch {
        return { ok: true, result: JSON.stringify([existing, update]) };
      }
    }

    case "sum": {
      const a = Number(existing);
      const b = Number(update);
      if (isNaN(a) || isNaN(b)) {
        return { ok: false, result: "", error: "Cannot apply sum strategy to non-numeric values" };
      }
      return { ok: true, result: String(a + b) };
    }

    case "max": {
      const a = Number(existing);
      const b = Number(update);
      if (isNaN(a) || isNaN(b)) {
        return { ok: false, result: "", error: "Cannot apply max strategy to non-numeric values" };
      }
      return { ok: true, result: String(Math.max(a, b)) };
    }

    case "min": {
      const a = Number(existing);
      const b = Number(update);
      if (isNaN(a) || isNaN(b)) {
        return { ok: false, result: "", error: "Cannot apply min strategy to non-numeric values" };
      }
      return { ok: true, result: String(Math.min(a, b)) };
    }

    default:
      return { ok: false, result: "", error: `Unknown merge strategy: ${strategy}` };
  }
}

export const processVariableHandler: ProcessVariableHandler = {
  async set(input, storage) {
    const key = varKey(input.run_ref, input.name);
    const existing = await storage.get("var", key);

    let id: string;
    if (existing) {
      id = existing.id as string;
    } else {
      id = await nextId(storage);
      // Add to index
      const names = await getVarIndex(storage, input.run_ref);
      if (!names.includes(input.name)) {
        names.push(input.name);
        await putVarIndex(storage, input.run_ref, names);
      }
    }

    await storage.put("var", key, {
      id,
      run_ref: input.run_ref,
      name: input.name,
      value: input.value,
      value_type: input.value_type,
      scope: input.scope,
      merge_strategy: null,
    });

    return { variant: "ok", var: id };
  },

  async get(input, storage) {
    const key = varKey(input.run_ref, input.name);
    const record = await storage.get("var", key);
    if (!record) {
      return { variant: "not_found", run_ref: input.run_ref, name: input.name };
    }

    return {
      variant: "ok",
      var: record.id as string,
      value: record.value as string,
      value_type: record.value_type as string,
    };
  },

  async merge(input, storage) {
    const key = varKey(input.run_ref, input.name);
    const record = await storage.get("var", key);
    if (!record) {
      return { variant: "not_found", run_ref: input.run_ref, name: input.name };
    }

    const mergeResult = applyMerge(record.value as string, input.update, input.strategy);
    if (!mergeResult.ok) {
      return { variant: "merge_error", message: mergeResult.error! };
    }

    await storage.put("var", key, {
      ...record,
      value: mergeResult.result,
      merge_strategy: input.strategy,
    });

    return {
      variant: "ok",
      var: record.id as string,
      merged_value: mergeResult.result,
    };
  },

  async delete(input, storage) {
    const key = varKey(input.run_ref, input.name);
    const record = await storage.get("var", key);
    if (!record) {
      return { variant: "not_found", run_ref: input.run_ref, name: input.name };
    }

    await storage.del("var", key);

    // Remove from index
    const names = await getVarIndex(storage, input.run_ref);
    const filtered = names.filter(n => n !== input.name);
    await putVarIndex(storage, input.run_ref, filtered);

    return { variant: "ok", run_ref: input.run_ref, name: input.name };
  },

  async list(input, storage) {
    const names = await getVarIndex(storage, input.run_ref);
    const variables: Array<{ name: string; value: string; value_type: string; scope: string }> = [];

    for (const name of names) {
      const key = varKey(input.run_ref, name);
      const record = await storage.get("var", key);
      if (record) {
        variables.push({
          name: record.name as string,
          value: record.value as string,
          value_type: record.value_type as string,
          scope: record.scope as string,
        });
      }
    }

    return { variant: "ok", variables: JSON.stringify(variables) };
  },

  async snapshot(input, storage) {
    const names = await getVarIndex(storage, input.run_ref);
    const snapshot: Record<string, { value: string; value_type: string; scope: string }> = {};

    for (const name of names) {
      const key = varKey(input.run_ref, name);
      const record = await storage.get("var", key);
      if (record) {
        snapshot[name] = {
          value: record.value as string,
          value_type: record.value_type as string,
          scope: record.scope as string,
        };
      }
    }

    return { variant: "ok", snapshot: JSON.stringify(snapshot) };
  },
};
