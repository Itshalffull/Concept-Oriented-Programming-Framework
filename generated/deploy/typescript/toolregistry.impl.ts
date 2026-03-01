// ToolRegistry Concept Implementation
// Register, version, and authorize tool schemas for LLM function/tool calling.
import type { ConceptStorage } from "@clef/runtime";
import type { ToolRegistryHandler } from "./toolregistry.handler";

const RELATION = "toolregistry";
const NAME_INDEX_RELATION = "toolregistry_name";
const AUTH_RELATION = "toolregistry_auth";

let toolCounter = 0;
function nextToolId(): string {
  toolCounter += 1;
  return `tool-${Date.now()}-${String(toolCounter).padStart(4, "0")}`;
}

export const toolRegistryHandler: ToolRegistryHandler = {
  async register(input, storage) {
    const { name, description, schema } = input;

    // Validate that schema is valid JSON
    try {
      JSON.parse(schema);
    } catch {
      return { variant: "invalidSchema", message: "Schema is not valid JSON" };
    }

    // Check if a tool with this name already exists (version increment)
    const nameIndex = await storage.get(NAME_INDEX_RELATION, name);
    let toolId: string;
    let version: number;

    if (nameIndex) {
      toolId = nameIndex.tool as string;
      version = ((nameIndex.version as number) || 1) + 1;
    } else {
      toolId = nextToolId();
      version = 1;
    }

    await storage.put(RELATION, toolId, {
      tool: toolId,
      name,
      version,
      description,
      schema,
      status: "active",
      allowedModels: JSON.stringify(["*"]),
      allowedProcesses: JSON.stringify(["*"]),
    });

    // Update name index
    await storage.put(NAME_INDEX_RELATION, name, {
      name,
      tool: toolId,
      version,
    });

    return { variant: "ok", tool: toolId, version };
  },

  async deprecate(input, storage) {
    const { tool } = input;

    const record = await storage.get(RELATION, tool);
    if (record) {
      await storage.put(RELATION, tool, {
        ...record,
        status: "deprecated",
      });
    }

    return { variant: "ok", tool };
  },

  async disable(input, storage) {
    const { tool } = input;

    const record = await storage.get(RELATION, tool);
    if (record) {
      await storage.put(RELATION, tool, {
        ...record,
        status: "disabled",
      });
    }

    return { variant: "ok", tool };
  },

  async authorize(input, storage) {
    const { tool, model, processRef } = input;

    // Store authorization record
    const authKey = `${tool}::${model}::${processRef}`;
    await storage.put(AUTH_RELATION, authKey, {
      authKey,
      tool,
      model,
      processRef,
    });

    // Update allowed lists on the tool record
    const record = await storage.get(RELATION, tool);
    if (record) {
      const allowedModels: string[] = JSON.parse(record.allowedModels as string);
      const allowedProcesses: string[] = JSON.parse(record.allowedProcesses as string);

      if (!allowedModels.includes(model) && !allowedModels.includes("*")) {
        allowedModels.push(model);
      }
      if (!allowedProcesses.includes(processRef) && !allowedProcesses.includes("*")) {
        allowedProcesses.push(processRef);
      }

      await storage.put(RELATION, tool, {
        ...record,
        allowedModels: JSON.stringify(allowedModels),
        allowedProcesses: JSON.stringify(allowedProcesses),
      });
    }

    return { variant: "ok", tool };
  },

  async checkAccess(input, storage) {
    const { tool, model, processRef } = input;

    const record = await storage.get(RELATION, tool);
    if (!record) {
      return { variant: "denied", tool, reason: "Tool not found" };
    }

    const status = record.status as string;
    if (status === "disabled") {
      return { variant: "denied", tool, reason: "Tool is disabled" };
    }
    if (status === "deprecated") {
      return { variant: "denied", tool, reason: "Tool is deprecated" };
    }

    const allowedModels: string[] = JSON.parse(record.allowedModels as string);
    const allowedProcesses: string[] = JSON.parse(record.allowedProcesses as string);

    const modelAllowed = allowedModels.includes("*") || allowedModels.includes(model);
    const processAllowed = allowedProcesses.includes("*") || allowedProcesses.includes(processRef);

    if (!modelAllowed) {
      return { variant: "denied", tool, reason: `Model "${model}" is not authorized` };
    }
    if (!processAllowed) {
      return { variant: "denied", tool, reason: `Process "${processRef}" is not authorized` };
    }

    return {
      variant: "allowed",
      tool,
      schema: record.schema as string,
    };
  },

  async listActive(input, storage) {
    const { processRef } = input;

    const allTools = await storage.find(RELATION, { status: "active" });

    const activeTools = allTools.filter((t) => {
      const allowedProcesses: string[] = JSON.parse(t.allowedProcesses as string);
      return allowedProcesses.includes("*") || allowedProcesses.includes(processRef);
    });

    const toolList = activeTools.map((t) => ({
      tool: t.tool,
      name: t.name,
      version: t.version,
      description: t.description,
      schema: t.schema,
    }));

    return { variant: "ok", tools: JSON.stringify(toolList) };
  },
};
