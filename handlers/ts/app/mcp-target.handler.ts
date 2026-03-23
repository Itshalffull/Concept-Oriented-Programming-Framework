// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// McpTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _mcpTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const serverName = (parsedConfig.serverName as string) || 'clef-mcp-server';
    const transport = (parsedConfig.transport as string) || 'stdio';
    const version = (parsedConfig.version as string) || '1.0.0';
    const toolLimit = (parsedConfig.toolLimit as number) || 50;

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const displayName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    const tools = [
      `${conceptName}_create`,
      `${conceptName}_get`,
      `${conceptName}_list`,
      `${conceptName}_update`,
      `${conceptName}_delete`,
    ];

    let p = createProgram();

    // Check tool count limit
    if (tools.length > toolLimit) {
      return complete(p, 'tooManyTools', {
        count: tools.length,
        limit: toolLimit,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const serverFile = [
      `// MCP Server: ${serverName}`,
      `// Transport: ${transport}`,
      `// Version: ${version}`,
      ``,
      `import { Server } from "@modelcontextprotocol/sdk/server/index.js";`,
      `import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";`,
      ``,
      `const server = new Server({`,
      `  name: "${serverName}",`,
      `  version: "${version}",`,
      `}, {`,
      `  capabilities: { tools: {} },`,
      `});`,
      ``,
      `server.setRequestHandler("tools/list", async () => ({`,
      `  tools: [`,
      `    {`,
      `      name: "${conceptName}_create",`,
      `      description: "Create a new ${displayName}. Provide a name and any optional fields.",`,
      `      inputSchema: {`,
      `        type: "object",`,
      `        properties: {`,
      `          name: { type: "string", description: "The name of the ${displayName} to create" },`,
      `        },`,
      `        required: ["name"],`,
      `      },`,
      `    },`,
      `    {`,
      `      name: "${conceptName}_get",`,
      `      description: "Retrieve a ${displayName} by its unique identifier.",`,
      `      inputSchema: {`,
      `        type: "object",`,
      `        properties: {`,
      `          id: { type: "string", description: "The unique ID of the ${displayName}" },`,
      `        },`,
      `        required: ["id"],`,
      `      },`,
      `    },`,
      `    {`,
      `      name: "${conceptName}_list",`,
      `      description: "List all ${displayName} entries. Returns an array of ${displayName} objects.",`,
      `      inputSchema: {`,
      `        type: "object",`,
      `        properties: {},`,
      `      },`,
      `    },`,
      `    {`,
      `      name: "${conceptName}_update",`,
      `      description: "Update an existing ${displayName} by ID with new field values.",`,
      `      inputSchema: {`,
      `        type: "object",`,
      `        properties: {`,
      `          id: { type: "string", description: "The unique ID of the ${displayName} to update" },`,
      `          name: { type: "string", description: "New name for the ${displayName}" },`,
      `        },`,
      `        required: ["id"],`,
      `      },`,
      `    },`,
      `    {`,
      `      name: "${conceptName}_delete",`,
      `      description: "Delete a ${displayName} by its unique identifier.",`,
      `      inputSchema: {`,
      `        type: "object",`,
      `        properties: {`,
      `          id: { type: "string", description: "The unique ID of the ${displayName} to delete" },`,
      `        },`,
      `        required: ["id"],`,
      `      },`,
      `    },`,
      `  ],`,
      `}));`,
      ``,
      `server.setRequestHandler("tools/call", async (request) => {`,
      `  const { name, arguments: args } = request.params;`,
      `  switch (name) {`,
      `    case "${conceptName}_create":`,
      `      return { content: [{ type: "text", text: JSON.stringify({ created: true }) }] };`,
      `    case "${conceptName}_get":`,
      `      return { content: [{ type: "text", text: JSON.stringify({ id: args?.id }) }] };`,
      `    case "${conceptName}_list":`,
      `      return { content: [{ type: "text", text: JSON.stringify({ items: [] }) }] };`,
      `    case "${conceptName}_update":`,
      `      return { content: [{ type: "text", text: JSON.stringify({ updated: true }) }] };`,
      `    case "${conceptName}_delete":`,
      `      return { content: [{ type: "text", text: JSON.stringify({ deleted: true }) }] };`,
      `    default:`,
      `      throw new Error(\`Unknown tool: \${name}\`);`,
      `  }`,
      `});`,
      ``,
      `async function main() {`,
      `  const transport = new StdioServerTransport();`,
      `  await server.connect(transport);`,
      `}`,
      ``,
      `main().catch(console.error);`,
    ].join('\n');

    const files = [
      `src/mcp/${conceptName}-server.ts`,
      `src/mcp/${conceptName}-tools.ts`,
    ];

    const toolId = `mcp-${conceptName}-${Date.now()}`;

    p = put(p, 'tool', toolId, {
      toolId,
      serverName,
      transport,
      version,
      concept: conceptName,
      mcpType: 'tool',
      tools: JSON.stringify(tools),
      files: JSON.stringify(files),
      serverFile,
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      tools,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const tool = input.tool as string;

    let p = createProgram();
    p = spGet(p, 'tool', tool, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { tool }),
      (b) => complete(b, 'ok', { tool }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listTools(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const conceptLower = concept.toLowerCase();

    const tools = [
      `${conceptLower}_create`,
      `${conceptLower}_get`,
      `${conceptLower}_list`,
      `${conceptLower}_update`,
      `${conceptLower}_delete`,
    ];

    const resources = [
      `${conceptLower}://list`,
      `${conceptLower}://get/{id}`,
    ];

    const templates = [
      `${conceptLower}-summary`,
      `${conceptLower}-detail`,
    ];

    let p = createProgram();
    return complete(p, 'ok', {
      tools,
      resources,
      templates,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const mcpTargetHandler = autoInterpret(_mcpTargetHandler);

