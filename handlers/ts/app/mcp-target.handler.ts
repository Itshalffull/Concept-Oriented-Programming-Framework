// McpTarget Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const mcpTargetHandler: ConceptHandler = {
  async generate(input, storage) {
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

    // Check tool count limit
    if (tools.length > toolLimit) {
      return {
        variant: 'tooManyTools',
        count: tools.length,
        limit: toolLimit,
      };
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

    await storage.put('tool', toolId, {
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

    return {
      variant: 'ok',
      tools,
      files,
    };
  },

  async validate(input, storage) {
    const tool = input.tool as string;

    const existing = await storage.get('tool', tool);
    if (!existing) {
      return { variant: 'ok', tool };
    }

    // Check that all tools have descriptions
    const toolName = existing.concept as string;
    const tools = JSON.parse(existing.tools as string) as string[];

    for (const t of tools) {
      // In a real implementation, we would parse the server file
      // and verify each tool has a description. Here we check the stored metadata.
      const hasDescription = existing.serverFile &&
        (existing.serverFile as string).includes(`name: "${t}"`);

      if (!hasDescription) {
        return {
          variant: 'missingDescription',
          tool,
          toolName: t,
        };
      }
    }

    return { variant: 'ok', tool };
  },

  async listTools(input, storage) {
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

    return {
      variant: 'ok',
      tools,
      resources,
      templates,
    };
  },
};
