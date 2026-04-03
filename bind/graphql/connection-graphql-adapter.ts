// ============================================================
// Clef Bind — Connection-Aware GraphQL Adapter
//
// Section 6.4: GraphQL
//   Generates a GraphQL schema and resolvers wired through
//   Connection/invoke and Connection/observe. On startup, connects
//   to the kernel and discovers registered concepts via
//   Connection/discover(depth: "manifest"). Each concept becomes
//   a GraphQL type, each action a Mutation field, and list/get
//   actions become Query fields. Subscriptions map to
//   Connection/observe completion streams.
//
// MAG-330: Wire GraphQL resolvers through Connection
// ============================================================

// --- Types ---

/**
 * Configuration for creating a Connection-wired GraphQL schema.
 */
export interface ConnectionGraphQLConfig {
  /** Kernel endpoint (e.g., "ws://localhost:3000/kernel"). */
  endpoint: string;
  /** Optional credentials for Connection/connect. */
  credentials?: string;
  /** Transport adapter name (e.g., "websocket", "http"). Defaults to "websocket". */
  transport?: string;
}

/**
 * A concept entry as returned by Connection/discover(depth: "manifest").
 */
interface DiscoveredConcept {
  name: string;
  actions: string[];
  variants: string[];
}

/**
 * Discovery result from Connection/discover(depth: "manifest").
 */
interface ManifestDiscovery {
  depth: 'manifest';
  concepts: DiscoveredConcept[];
}

/**
 * Invoke result from Connection/invoke.
 */
interface InvokeResult {
  variant: string;
  output: string;
}

/**
 * Connection handler interface — the subset of Connection actions
 * this adapter uses. Accepts a handler object so callers can provide
 * either the real kernel handler or a test stub.
 */
export interface ConnectionInterface {
  connect(input: {
    connection: string;
    endpoint: string;
    transportAdapter: string;
    credentials?: string;
  }): Promise<{ variant: string; connection?: string }>;

  discover(input: {
    connection: string;
    depth: string;
    concept?: string;
  }): Promise<{ variant: string; result?: string }>;

  invoke(input: {
    connection: string;
    concept: string;
    action: string;
    input: string;
  }): Promise<{ variant: string; output?: string }>;

  observe(input: {
    connection: string;
    concept?: string;
  }): Promise<{ variant: string; streamId?: string }>;

  disconnect(input: {
    connection: string;
  }): Promise<{ variant: string }>;
}

// --- Schema Generation ---

/** Actions that map to Query fields rather than Mutation fields. */
const QUERY_ACTIONS = new Set(['get', 'list', 'find', 'search', 'count']);

/**
 * Convert a concept name to a GraphQL type name (PascalCase, already expected).
 */
function toTypeName(conceptName: string): string {
  return conceptName;
}

/**
 * Convert a concept + action pair to a GraphQL field name.
 * e.g., ("Task", "create") => "createTask", ("Task", "list") => "listTasks"
 */
function toFieldName(conceptName: string, action: string): string {
  return `${action}${conceptName}`;
}

/**
 * Build GraphQL type definitions from discovered concepts.
 *
 * Each concept gets:
 *   - A type with `id`, `data`, and `variant` fields (generic since
 *     we don't have full field-level schema from manifest depth)
 *   - Query fields for list/get actions
 *   - Mutation fields for all other actions
 *   - A Subscription field for completion events
 */
function buildTypeDefs(concepts: DiscoveredConcept[]): string {
  const typeBlocks: string[] = [];
  const queryFields: string[] = [];
  const mutationFields: string[] = [];
  const subscriptionFields: string[] = [];

  // Scalar for JSON passthrough
  typeBlocks.push('scalar JSON');

  for (const concept of concepts) {
    const typeName = toTypeName(concept.name);

    // Concept result type — wraps invoke output
    typeBlocks.push(
      `"""Result of invoking an action on ${concept.name}."""\n` +
      `type ${typeName}Result {\n` +
      `  variant: String!\n` +
      `  output: JSON\n` +
      `}`,
    );

    for (const action of concept.actions) {
      const fieldName = toFieldName(concept.name, action);
      const inputArgStr = `input: JSON`;

      if (QUERY_ACTIONS.has(action)) {
        queryFields.push(
          `  """${concept.name}/${action}"""\n` +
          `  ${fieldName}(${inputArgStr}): ${typeName}Result!`,
        );
      } else {
        mutationFields.push(
          `  """${concept.name}/${action}"""\n` +
          `  ${fieldName}(${inputArgStr}): ${typeName}Result!`,
        );
      }
    }

    // Subscription for concept completion stream
    subscriptionFields.push(
      `  """Completion events for ${concept.name} actions."""\n` +
      `  ${concept.name.charAt(0).toLowerCase() + concept.name.slice(1)}Completed: ${typeName}Result!`,
    );
  }

  // Assemble schema
  const parts: string[] = [...typeBlocks];

  if (queryFields.length > 0) {
    parts.push(`type Query {\n${queryFields.join('\n')}\n}`);
  } else {
    // GraphQL requires at least a Query type
    parts.push(`type Query {\n  """Health check."""\n  _ping: Boolean!\n}`);
  }

  if (mutationFields.length > 0) {
    parts.push(`type Mutation {\n${mutationFields.join('\n')}\n}`);
  }

  if (subscriptionFields.length > 0) {
    parts.push(`type Subscription {\n${subscriptionFields.join('\n')}\n}`);
  }

  return parts.join('\n\n') + '\n';
}

// --- Resolver Generation ---

/**
 * Build resolvers that invoke through Connection/invoke and
 * subscribe through Connection/observe.
 */
function buildResolvers(
  concepts: DiscoveredConcept[],
  connectionId: string,
  conn: ConnectionInterface,
): Record<string, unknown> {
  const resolvers: Record<string, Record<string, unknown>> = {};

  // JSON scalar passthrough
  resolvers['JSON'] = {
    __serialize: (value: unknown) => value,
    __parseValue: (value: unknown) => value,
    __parseLiteral: (ast: { kind: string; value?: string }) => {
      if (ast.kind === 'StringValue') {
        try { return JSON.parse(ast.value!); } catch { return ast.value; }
      }
      return ast.value;
    },
  };

  const queryResolvers: Record<string, unknown> = {};
  const mutationResolvers: Record<string, unknown> = {};
  const subscriptionResolvers: Record<string, unknown> = {};

  // Ping fallback
  queryResolvers['_ping'] = () => true;

  for (const concept of concepts) {
    for (const action of concept.actions) {
      const fieldName = toFieldName(concept.name, action);

      // Create resolver that invokes through Connection
      const resolver = async (
        _parent: unknown,
        args: { input?: Record<string, unknown> },
      ) => {
        const inputStr = JSON.stringify(args.input ?? {});

        const result = await conn.invoke({
          connection: connectionId,
          concept: concept.name,
          action,
          input: inputStr,
        });

        let parsedOutput: unknown = null;
        if (result.output) {
          try {
            parsedOutput = JSON.parse(result.output as string);
          } catch {
            parsedOutput = result.output;
          }
        }

        return {
          variant: result.variant,
          output: parsedOutput,
        };
      };

      if (QUERY_ACTIONS.has(action)) {
        queryResolvers[fieldName] = resolver;
      } else {
        mutationResolvers[fieldName] = resolver;
      }
    }

    // Subscription resolver using Connection/observe
    const subFieldName =
      concept.name.charAt(0).toLowerCase() + concept.name.slice(1) + 'Completed';

    subscriptionResolvers[subFieldName] = {
      subscribe: async function* () {
        // Request an observe stream from Connection
        const observeResult = await conn.observe({
          connection: connectionId,
          concept: concept.name,
        });

        if (observeResult.variant !== 'ok') {
          throw new Error(
            `Failed to observe ${concept.name}: ${observeResult.variant}`,
          );
        }

        // Yield completions as they arrive.
        // The actual event delivery depends on the transport adapter;
        // this generator bridges Connection/observe into GraphQL
        // subscription semantics via an async iterable.
        //
        // In a full integration, the transport adapter's observe()
        // returns an AsyncIterable<CompletionEvent>. Here we expose
        // the streamId so the caller can wire their transport's
        // completion push into this generator.
        const streamId = observeResult.streamId;
        yield {
          [subFieldName]: {
            variant: 'subscribed',
            output: { streamId },
          },
        };
      },
    };
  }

  if (Object.keys(queryResolvers).length > 0) {
    resolvers['Query'] = queryResolvers;
  }
  if (Object.keys(mutationResolvers).length > 0) {
    resolvers['Mutation'] = mutationResolvers;
  }
  if (Object.keys(subscriptionResolvers).length > 0) {
    resolvers['Subscription'] = subscriptionResolvers;
  }

  return resolvers;
}

// --- Public API ---

/**
 * Create a Connection-wired GraphQL schema from kernel discovery.
 *
 * Connects to the kernel via Connection/connect, discovers registered
 * concepts via Connection/discover(depth: "manifest"), then generates
 * GraphQL typeDefs and resolvers that invoke through Connection/invoke
 * and subscribe through Connection/observe.
 *
 * @param config - Kernel endpoint, credentials, and transport adapter
 * @param conn - Connection handler interface (real kernel or test stub)
 * @returns typeDefs (SDL string) and resolvers (for use with graphql-tools
 *          makeExecutableSchema, Apollo Server, or any SDL-first server)
 */
export async function createConnectionGraphQLSchema(
  config: ConnectionGraphQLConfig,
  conn: ConnectionInterface,
): Promise<{ typeDefs: string; resolvers: Record<string, unknown> }> {
  const connectionId = `graphql-${Date.now()}`;
  const transport = config.transport ?? 'websocket';

  // 1. Connect to the kernel
  const connectResult = await conn.connect({
    connection: connectionId,
    endpoint: config.endpoint,
    transportAdapter: transport,
    credentials: config.credentials,
  });

  if (connectResult.variant !== 'ok') {
    throw new Error(
      `Connection/connect failed: ${connectResult.variant}`,
    );
  }

  // 2. Discover registered concepts at manifest depth
  const discoverResult = await conn.discover({
    connection: connectionId,
    depth: 'manifest',
  });

  if (discoverResult.variant !== 'ok') {
    throw new Error(
      `Connection/discover failed: ${discoverResult.variant}`,
    );
  }

  let discovery: ManifestDiscovery;
  try {
    discovery = JSON.parse(discoverResult.result as string) as ManifestDiscovery;
  } catch {
    throw new Error(
      'Connection/discover returned unparseable result',
    );
  }

  const concepts = discovery.concepts;

  // 3. Generate typeDefs and resolvers
  const typeDefs = buildTypeDefs(concepts);
  const resolvers = buildResolvers(concepts, connectionId, conn);

  return { typeDefs, resolvers };
}

/**
 * Synchronous variant: build schema from a pre-fetched manifest
 * without calling connect/discover. Useful when the caller already
 * has the discovery result (e.g., from a cached manifest or test).
 */
export function createConnectionGraphQLSchemaFromManifest(
  concepts: DiscoveredConcept[],
  connectionId: string,
  conn: ConnectionInterface,
): { typeDefs: string; resolvers: Record<string, unknown> } {
  const typeDefs = buildTypeDefs(concepts);
  const resolvers = buildResolvers(concepts, connectionId, conn);
  return { typeDefs, resolvers };
}
