// Connection-aware MCP Server Adapter
//
// Makes any Clef kernel accessible as an MCP server by routing all tool
// calls through Connection/invoke. On startup the adapter connects to
// the kernel, discovers registered concepts, and exposes each concept
// action as an MCP tool. On shutdown it disconnects cleanly.
//
// Section 6.2 — Connected Bind and Surface Pilot PRD

import type { ConceptStorage } from '../../runtime/types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ConnectionMcpConfig {
  /** Credential profile name (looked up via Credential/load). */
  profile?: string;
  /** Direct endpoint (alternative to profile). */
  endpoint?: string;
  /** Direct credentials (alternative to profile). */
  credentials?: string;
  /** Transport protocol: websocket | http. Default: websocket. */
  transport?: string;
  /** Tool filter patterns (e.g., ["task/*", "pilot/*"]). */
  tools?: string[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved endpoint + credentials ready for Connection/connect. */
interface ResolvedConfig {
  endpoint: string;
  credentials: string | null;
  transport: string;
}

/** A discovered concept action exposed as an MCP tool. */
interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  concept: string;
  action: string;
}

/** Result of a Connection/invoke call. */
interface InvokeResult {
  variant: string;
  connection?: string;
  output?: string;
  message?: string;
  [key: string]: unknown;
}

/** Result of a Connection/discover call. */
interface DiscoverResult {
  variant: string;
  connection?: string;
  result?: string;
  message?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
}

function toToolName(concept: string, action: string): string {
  return `${toSnakeCase(concept)}_${toSnakeCase(action)}`;
}

/** Check if a tool name matches any of the filter patterns. */
function matchesFilter(toolName: string, filters: string[]): boolean {
  if (filters.length === 0) return true;
  for (const pattern of filters) {
    if (matchGlob(toolName, pattern)) return true;
  }
  return false;
}

/** Simple glob matching supporting * wildcard segments. */
function matchGlob(value: string, pattern: string): boolean {
  // Normalize: patterns use concept/action format (e.g., "task/*")
  // Tool names use concept_action format (e.g., "task_create")
  // Support both conventions
  const normalizedPattern = pattern.replace(/\//g, '_');
  const regex = new RegExp(
    '^' + normalizedPattern.replace(/\*/g, '.*') + '$',
    'i',
  );
  return regex.test(value);
}

// ---------------------------------------------------------------------------
// ConnectionMcpServer
// ---------------------------------------------------------------------------

export class ConnectionMcpServer {
  private readonly config: ConnectionMcpConfig;
  private readonly connectionId: string;
  private connectionHandler: Record<string, (input: Record<string, unknown>, storage: ConceptStorage) => Promise<Record<string, unknown>>> | null = null;
  private credentialHandler: Record<string, (input: Record<string, unknown>, storage: ConceptStorage) => Promise<Record<string, unknown>>> | null = null;
  private storage: ConceptStorage | null = null;
  private tools: McpTool[] = [];
  private connected = false;

  constructor(config: ConnectionMcpConfig) {
    this.config = {
      transport: 'websocket',
      tools: [],
      ...config,
    };
    this.connectionId = `mcp-${Date.now()}`;
  }

  // ---- Lifecycle ----------------------------------------------------------

  /**
   * Boot the MCP server:
   * 1. Resolve config (profile or direct endpoint)
   * 2. Connect to the kernel via Connection/connect
   * 3. Discover registered concepts via Connection/discover
   * 4. Build MCP tool list from discovered concepts
   * 5. Start the MCP protocol server on stdio
   */
  async start(): Promise<void> {
    const { createInMemoryStorage } = await import('../../runtime/adapters/storage.js');
    const { connectionHandler } = await import('../../handlers/ts/bind/connection.handler.js');
    this.connectionHandler = connectionHandler;
    this.storage = createInMemoryStorage();

    // Resolve endpoint + credentials from profile or direct config
    const resolved = await this.resolveConfig();

    // Connect to the kernel
    const connectResult = await this.connectionHandler!.connect(
      {
        connection: this.connectionId,
        endpoint: resolved.endpoint,
        transportAdapter: resolved.transport,
        credentials: resolved.credentials,
      },
      this.storage!,
    ) as InvokeResult;

    if (connectResult.variant === 'unreachable') {
      throw new Error(`Kernel unreachable: ${connectResult.message}`);
    }
    if (connectResult.variant === 'unauthorized') {
      throw new Error(`Unauthorized: ${connectResult.message}`);
    }
    if (connectResult.variant !== 'ok') {
      throw new Error(`Connection failed: ${connectResult.variant} — ${connectResult.message || ''}`);
    }

    this.connected = true;

    // Discover registered concepts at manifest depth (includes actions)
    this.tools = await this.discoverTools();

    // Start the MCP protocol server
    await this.serveMcp();
  }

  /**
   * Shut down the MCP server and disconnect from the kernel.
   */
  async stop(): Promise<void> {
    if (!this.connected || !this.connectionHandler || !this.storage) return;

    await this.connectionHandler.disconnect(
      { connection: this.connectionId },
      this.storage,
    );
    this.connected = false;
    this.tools = [];
  }

  // ---- Config resolution --------------------------------------------------

  private async resolveConfig(): Promise<ResolvedConfig> {
    const transport = this.config.transport || 'websocket';

    // Direct endpoint takes precedence
    if (this.config.endpoint) {
      return {
        endpoint: this.config.endpoint,
        credentials: this.config.credentials || null,
        transport,
      };
    }

    // Resolve from credential profile
    if (this.config.profile) {
      try {
        const { credentialHandler } = await import('../../handlers/ts/bind/credential.handler.js');
        this.credentialHandler = credentialHandler;
        const { createInMemoryStorage } = await import('../../runtime/adapters/storage.js');
        const credStorage = createInMemoryStorage();

        const loadResult = await this.credentialHandler!.load(
          { name: this.config.profile },
          credStorage,
        ) as Record<string, unknown>;

        if (loadResult.variant === 'ok') {
          return {
            endpoint: loadResult.endpoint as string,
            credentials: loadResult.token as string || null,
            transport,
          };
        }
        if (loadResult.variant === 'expired') {
          throw new Error(`Credential profile "${this.config.profile}" has expired. Run: clef auth refresh ${this.config.profile}`);
        }
        throw new Error(`Credential profile "${this.config.profile}" not found. Run: clef auth add ${this.config.profile}`);
      } catch (err) {
        if (err instanceof Error && err.message.includes('profile')) throw err;
        throw new Error(`Failed to load credential profile "${this.config.profile}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new Error(
      'ConnectionMcpConfig requires either "endpoint" or "profile". ' +
      'Provide a direct endpoint or a credential profile name.',
    );
  }

  // ---- Tool discovery -----------------------------------------------------

  private async discoverTools(): Promise<McpTool[]> {
    if (!this.connectionHandler || !this.storage) return [];

    const discoverResult = await this.connectionHandler.discover(
      {
        connection: this.connectionId,
        depth: 'manifest',
        concept: null,
      },
      this.storage,
    ) as DiscoverResult;

    if (discoverResult.variant !== 'ok' || !discoverResult.result) {
      console.error(`[connection-mcp] Discovery failed: ${discoverResult.variant}`);
      return [];
    }

    const discovered = JSON.parse(discoverResult.result as string) as {
      depth: string;
      concepts: Array<{ name: string; actions: string[]; variants?: string[] }>;
    };

    const tools: McpTool[] = [];
    const filters = this.config.tools || [];

    for (const concept of discovered.concepts) {
      for (const action of concept.actions) {
        const toolName = toToolName(concept.name, action);

        if (!matchesFilter(toolName, filters)) continue;

        tools.push({
          name: toolName,
          description: `${concept.name}/${action} — invoke via connected kernel`,
          inputSchema: {
            type: 'object',
            properties: {
              input: {
                type: 'string',
                description: `JSON input for ${concept.name}/${action}`,
              },
            },
            required: [],
          },
          concept: concept.name,
          action,
        });
      }
    }

    return tools;
  }

  // ---- Tool invocation ----------------------------------------------------

  /**
   * Route an MCP tool call through Connection/invoke.
   * Maps Connection error variants to MCP error responses.
   */
  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
    const tool = this.tools.find((t) => t.name === toolName);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    if (!this.connectionHandler || !this.storage) {
      return {
        content: [{ type: 'text', text: 'MCP server is not connected to a kernel' }],
        isError: true,
      };
    }

    // Build the input JSON from the args
    const inputJson = typeof args.input === 'string'
      ? args.input
      : JSON.stringify(args);

    const result = await this.connectionHandler.invoke(
      {
        connection: this.connectionId,
        concept: tool.concept,
        action: tool.action,
        input: inputJson,
      },
      this.storage,
    ) as InvokeResult;

    // Map Connection variants to MCP responses
    switch (result.variant) {
      case 'ok':
        return {
          content: [{ type: 'text', text: result.output || '{}' }],
        };

      case 'not_found':
        return {
          content: [{ type: 'text', text: `Tool not found: ${result.message}` }],
          isError: true,
        };

      case 'unauthorized':
        return {
          content: [{ type: 'text', text: `Unauthorized: ${result.message}` }],
          isError: true,
        };

      case 'error':
      default:
        return {
          content: [{ type: 'text', text: `Error: ${result.message || result.variant}` }],
          isError: true,
        };
    }
  }

  // ---- MCP protocol server ------------------------------------------------

  private async serveMcp(): Promise<void> {
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const {
      ListToolsRequestSchema,
      CallToolRequestSchema,
    } = await import('@modelcontextprotocol/sdk/types.js');

    const server = new Server(
      {
        name: `clef-connection-${this.config.profile || 'direct'}`,
        version: '0.1.0',
      },
      { capabilities: { tools: {} } },
    );

    // tools/list — return all discovered tools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));

    // tools/call — route through Connection/invoke
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = (request.params.arguments || {}) as Record<string, unknown>;
      return this.handleToolCall(toolName, args);
    });

    // Graceful shutdown
    const onShutdown = async () => {
      await this.stop();
      process.exit(0);
    };
    process.on('SIGINT', onShutdown);
    process.on('SIGTERM', onShutdown);

    // Start stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error(
      `[connection-mcp] Connected to ${this.config.endpoint || this.config.profile} ` +
      `(${this.tools.length} tools, transport: ${this.config.transport})`,
    );
  }

  // ---- Accessors (for testing) --------------------------------------------

  get isConnected(): boolean {
    return this.connected;
  }

  get registeredTools(): ReadonlyArray<McpTool> {
    return this.tools;
  }

  get connectionIdentifier(): string {
    return this.connectionId;
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/**
 * Boot a Connection-aware MCP server from CLI arguments or environment.
 *
 * Usage:
 *   npx tsx bind/mcp/connection-mcp-server.ts --profile prod
 *   npx tsx bind/mcp/connection-mcp-server.ts --endpoint ws://localhost:3000/kernel
 */
export async function bootConnectionMcpServer(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  const config: ConnectionMcpConfig = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--profile':
        config.profile = args[++i];
        break;
      case '--endpoint':
        config.endpoint = args[++i];
        break;
      case '--credentials':
        config.credentials = args[++i];
        break;
      case '--transport':
        config.transport = args[++i];
        break;
      case '--tools':
        config.tools = args[++i]?.split(',') || [];
        break;
    }
  }

  // Fall back to environment variables
  if (!config.profile && !config.endpoint) {
    config.profile = process.env.CLEF_PROFILE;
    config.endpoint = process.env.CLEF_ENDPOINT;
    config.credentials = config.credentials || process.env.CLEF_CREDENTIALS;
  }

  const server = new ConnectionMcpServer(config);
  await server.start();
}

// Auto-boot when run directly
const isDirectRun = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;
if (isDirectRun) {
  bootConnectionMcpServer().catch((err) => {
    console.error(`[connection-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
