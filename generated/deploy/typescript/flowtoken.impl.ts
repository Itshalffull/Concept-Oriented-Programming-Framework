// generated: flowtoken.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { FlowTokenHandler } from "./flowtoken.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_flowtoken");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_flowtoken", { value: next });
  return `ftk-${String(next).padStart(6, "0")}`;
}

/** Retrieve the token index for a run, or initialize an empty one. */
async function getTokenIndex(storage: ConceptStorage, runRef: string): Promise<string[]> {
  const index = await storage.get("tokenIndex", runRef);
  if (!index) return [];
  return JSON.parse(index.ids as string);
}

async function putTokenIndex(storage: ConceptStorage, runRef: string, ids: string[]): Promise<void> {
  await storage.put("tokenIndex", runRef, { ids: JSON.stringify(ids) });
}

export const flowTokenHandler: FlowTokenHandler = {
  async emit(input, storage) {
    const token = await nextId(storage);
    const now = new Date().toISOString();

    await storage.put("token", token, {
      id: token,
      run_ref: input.run_ref,
      position: input.position,
      status: "active",
      branch_id: input.branch_id,
      created_at: now,
    });

    // Add to run's token index
    const ids = await getTokenIndex(storage, input.run_ref);
    ids.push(token);
    await putTokenIndex(storage, input.run_ref, ids);

    return { variant: "ok", token, run_ref: input.run_ref, position: input.position };
  },

  async consume(input, storage) {
    const record = await storage.get("token", input.token);
    if (!record || (record.status as string) !== "active") {
      return { variant: "not_active", token: input.token };
    }

    await storage.put("token", input.token, {
      ...record,
      status: "consumed",
    });

    return {
      variant: "ok",
      token: input.token,
      run_ref: record.run_ref as string,
      position: record.position as string,
    };
  },

  async kill(input, storage) {
    const record = await storage.get("token", input.token);
    if (!record || (record.status as string) !== "active") {
      return { variant: "not_active", token: input.token };
    }

    await storage.put("token", input.token, {
      ...record,
      status: "dead",
    });

    return { variant: "ok", token: input.token };
  },

  async countActive(input, storage) {
    const ids = await getTokenIndex(storage, input.run_ref);
    let count = 0;

    for (const id of ids) {
      const record = await storage.get("token", id);
      if (
        record &&
        (record.status as string) === "active" &&
        (record.position as string) === input.position
      ) {
        count++;
      }
    }

    return { variant: "ok", count };
  },

  async listActive(input, storage) {
    const ids = await getTokenIndex(storage, input.run_ref);
    const activeTokens: Array<{ token: string; position: string; branch_id: string }> = [];

    for (const id of ids) {
      const record = await storage.get("token", id);
      if (record && (record.status as string) === "active") {
        activeTokens.push({
          token: id,
          position: record.position as string,
          branch_id: record.branch_id as string,
        });
      }
    }

    return { variant: "ok", tokens: JSON.stringify(activeTokens) };
  },
};
