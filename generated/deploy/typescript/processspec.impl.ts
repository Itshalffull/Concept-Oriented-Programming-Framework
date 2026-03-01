// generated: processspec.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { ProcessSpecHandler } from "./processspec.handler";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_processspec");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_processspec", { value: next });
  return `pspec-${String(next).padStart(6, "0")}`;
}

function validateStepsAndEdges(stepsJson: string, edgesJson: string): string | null {
  let steps: Array<{ key: string; step_type: string; config: string }>;
  let edges: Array<{ from_step: string; to_step: string; on_variant: string }>;

  try {
    steps = JSON.parse(stepsJson);
  } catch {
    return "Invalid steps JSON";
  }
  try {
    edges = JSON.parse(edgesJson);
  } catch {
    return "Invalid edges JSON";
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    return "At least one step is required";
  }

  const keys = new Set<string>();
  for (const step of steps) {
    if (!step.key) return "Each step must have a key";
    if (keys.has(step.key)) return `Duplicate step key: ${step.key}`;
    keys.add(step.key);
  }

  for (const edge of edges) {
    if (!keys.has(edge.from_step)) return `Edge references unknown from_step: ${edge.from_step}`;
    if (!keys.has(edge.to_step)) return `Edge references unknown to_step: ${edge.to_step}`;
  }

  return null;
}

export const processSpecHandler: ProcessSpecHandler = {
  async create(input, storage) {
    const error = validateStepsAndEdges(input.steps, input.edges);
    if (error) {
      return { variant: "invalid", message: error };
    }

    const spec = await nextId(storage);
    await storage.put("spec", spec, {
      id: spec,
      name: input.name,
      version: 1,
      status: "draft",
      steps: input.steps,
      edges: input.edges,
    });

    return { variant: "ok", spec };
  },

  async publish(input, storage) {
    const record = await storage.get("spec", input.spec);
    if (!record) {
      return { variant: "not_found", spec: input.spec };
    }

    const status = record.status as string;
    if (status === "active") {
      return { variant: "already_active", spec: input.spec };
    }

    let version = record.version as number;
    if (status === "deprecated") {
      version += 1;
    }

    await storage.put("spec", input.spec, {
      ...record,
      status: "active",
      version,
    });

    return { variant: "ok", spec: input.spec, version };
  },

  async deprecate(input, storage) {
    const record = await storage.get("spec", input.spec);
    if (!record) {
      return { variant: "not_found", spec: input.spec };
    }

    await storage.put("spec", input.spec, {
      ...record,
      status: "deprecated",
    });

    return { variant: "ok", spec: input.spec };
  },

  async update(input, storage) {
    const record = await storage.get("spec", input.spec);
    if (!record) {
      return { variant: "not_draft", spec: input.spec };
    }

    if ((record.status as string) !== "draft") {
      return { variant: "not_draft", spec: input.spec };
    }

    const error = validateStepsAndEdges(input.steps, input.edges);
    if (error) {
      return { variant: "invalid", message: error };
    }

    const version = (record.version as number) + 1;
    await storage.put("spec", input.spec, {
      ...record,
      steps: input.steps,
      edges: input.edges,
      version,
    });

    return { variant: "ok", spec: input.spec, version };
  },

  async get(input, storage) {
    const record = await storage.get("spec", input.spec);
    if (!record) {
      return { variant: "not_found", spec: input.spec };
    }

    return {
      variant: "ok",
      spec: input.spec,
      name: record.name as string,
      version: record.version as number,
      status: record.status as string,
      steps: record.steps as string,
      edges: record.edges as string,
    };
  },
};
