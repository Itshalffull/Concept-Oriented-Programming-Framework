// ============================================================
// GraphQL Target Provider Implementation
//
// Generates GraphQL schema (SDL) and resolver map files from
// ConceptManifest data. Produces one file per concept containing
// both the type definitions string and a resolver object that
// delegates to the Clef kernel.
// Architecture doc: Clef Bind
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
  ActionParamSchema,
  RelationSchema,
  FieldSchema,
} from '../../../../runtime/types.js';

import {
  typeToGraphQL,
  inferGraphqlOp,
  toPascalCase,
  toKebabCase,
  generateFileHeader,
  getActionOverrides,
  getHierarchicalTrait,
  getEnrichmentContent,
} from './codegen-utils.js';

import type { HierarchicalConfig } from './codegen-utils.js';

// --- Internal Types ---

/** A generated output file descriptor. */
interface OutputFile {
  path: string;
  content: string;
}

/** Per-action override entry from the interface manifest. */
interface ActionOverride {
  op?: 'query' | 'mutation';
  name?: string;
  skip?: boolean;
}

// --- GraphQL SDL Generation Helpers ---

/**
 * Resolve a FieldSchema to its GraphQL SDL type string, appending
 * "!" for required (non-optional) fields.
 */
function fieldToGraphQLType(field: FieldSchema): string {
  const base = typeToGraphQL(field.type);
  return field.optional ? base : `${base}!`;
}

/**
 * Resolve an ActionParamSchema to its GraphQL SDL type string.
 * Action params are always required (non-nullable).
 */
function paramToGraphQLType(param: ActionParamSchema): string {
  return `${typeToGraphQL(param.type)}!`;
}

/**
 * Build the main GraphQL object type definition from the manifest's
 * primary relation (first relation) fields.
 */
function buildObjectType(conceptName: string, relations: RelationSchema[]): string {
  if (relations.length === 0) {
    return `  type ${conceptName} {\n    _empty: Boolean\n  }`;
  }

  const primary = relations[0];
  const lines = primary.fields.map(
    f => `    ${f.name}: ${fieldToGraphQLType(f)}`,
  );

  // Include key field as ID
  const keyName = primary.keyField.name;
  const hasKeyInFields = primary.fields.some(f => f.name === keyName);
  if (!hasKeyInFields) {
    lines.unshift(`    ${keyName}: ID!`);
  }

  return `  type ${conceptName} {\n${lines.join('\n')}\n  }`;
}

/**
 * Augment an object type with self-referential hierarchy fields
 * when @hierarchical trait is present.
 */
function buildHierarchicalFields(conceptName: string): string {
  return [
    `    children: [${conceptName}!]!`,
    `    parent: ${conceptName}`,
    `    ancestors: [${conceptName}!]!`,
    `    depth: Int!`,
  ].join('\n');
}

/**
 * Build a GraphQL input type for a create/mutation action.
 * Only generated for actions that have parameters beyond a single ID.
 */
function buildInputType(
  conceptName: string,
  action: ActionSchema,
): string | null {
  if (action.params.length === 0) return null;

  const pascal = toPascalCase(action.name);
  const inputName = `${pascal}${conceptName}Input`;
  const lines = action.params.map(
    p => `    ${p.name}: ${paramToGraphQLType(p)}`,
  );

  return `  input ${inputName} {\n${lines.join('\n')}\n  }`;
}

/**
 * Determine the GraphQL operation type for an action, respecting
 * overrides from the interface manifest before falling back to
 * inference from action name.
 */
function resolveOp(
  actionName: string,
  overrides: Record<string, Record<string, unknown>>,
): 'query' | 'mutation' {
  const override = overrides[actionName] as ActionOverride | undefined;
  if (override?.op) return override.op;
  return inferGraphqlOp(actionName);
}

/**
 * Determine the GraphQL field name for an action, respecting
 * a name override if present.
 */
function resolveFieldName(
  actionName: string,
  conceptName: string,
  op: 'query' | 'mutation',
  overrides: Record<string, Record<string, unknown>>,
): string {
  const override = overrides[actionName] as ActionOverride | undefined;
  if (override?.name) return override.name;

  // Default naming: camelCase action name + PascalCase concept name
  // e.g. "create" + "Article" -> "createArticle", "list" + "Article" -> "articles"
  const lower = actionName.toLowerCase();
  if (lower === 'list' || lower === 'all' || lower === 'search') {
    return `${actionName}${conceptName}s`;
  }
  return `${actionName}${conceptName}`;
}

/**
 * Build the argument signature for a query/mutation field.
 * For mutations with multiple params, wraps them in an input type.
 * For queries/simple mutations, inlines parameters.
 */
function buildFieldArgs(
  action: ActionSchema,
  conceptName: string,
  usesInputType: boolean,
): string {
  if (action.params.length === 0) return '';

  if (usesInputType) {
    const pascal = toPascalCase(action.name);
    return `(input: ${pascal}${conceptName}Input!)`;
  }

  const args = action.params.map(
    p => `${p.name}: ${paramToGraphQLType(p)}`,
  ).join(', ');
  return `(${args})`;
}

/**
 * Determine whether an action should use an input type wrapper
 * (true for mutations with more than 2 params) vs inline args.
 */
function shouldUseInputType(action: ActionSchema, op: 'query' | 'mutation'): boolean {
  if (op === 'query') return false;
  return action.params.length > 2;
}

// --- Resolver Generation Helpers ---

/**
 * Build a TypeScript resolver function string for a single action.
 */
function buildResolverBody(
  action: ActionSchema,
  usesInputType: boolean,
): string {
  if (action.params.length === 0) {
    return `(_: unknown, _args: unknown, ctx: { kernel: any }) =>\n      ctx.kernel.handleRequest({ method: '${action.name}' })`;
  }

  if (usesInputType) {
    return `(_: unknown, args: { input: any }, ctx: { kernel: any }) =>\n      ctx.kernel.handleRequest({ method: '${action.name}', ...args.input })`;
  }

  return `(_: unknown, args: any, ctx: { kernel: any }) =>\n      ctx.kernel.handleRequest({ method: '${action.name}', ...args })`;
}

// --- Main File Generation ---

/**
 * Generate the complete schema.graphql.ts file content for a single
 * concept, including both SDL type definitions and resolver map.
 */
function generateSchemaFile(
  manifest: ConceptManifest,
  overrides: Record<string, Record<string, unknown>>,
  hierConfig?: HierarchicalConfig,
): string {
  const name = manifest.name;
  const camelName = name.charAt(0).toLowerCase() + name.slice(1);

  // Collect SDL sections
  const sdlParts: string[] = [];
  const queryFields: string[] = [];
  const mutationFields: string[] = [];
  const queryResolvers: string[] = [];
  const mutationResolvers: string[] = [];
  const inputTypes: string[] = [];

  // Object type from relations
  sdlParts.push(buildObjectType(name, manifest.relations));

  // Add hierarchical fields if @hierarchical trait is present
  if (hierConfig) {
    const hierFields = buildHierarchicalFields(name);
    // Inject hierarchical fields into object type by appending before closing brace
    const lastPart = sdlParts[sdlParts.length - 1];
    sdlParts[sdlParts.length - 1] = lastPart.replace(/\n  \}$/, '\n' + hierFields + '\n  }');

    // Add hierarchy query operations
    queryFields.push(`    ${name.toLowerCase()}Children(id: ID!, depth: Int): [${name}!]!`);
    queryFields.push(`    ${name.toLowerCase()}Ancestors(id: ID!): [${name}!]!`);
    queryResolvers.push(`    ${name.toLowerCase()}Children: (_: unknown, args: { id: string, depth?: number }, ctx: { kernel: any }) =>\n      ctx.kernel.handleRequest({ method: 'listChildren', id: args.id, depth: args.depth }),`);
    queryResolvers.push(`    ${name.toLowerCase()}Ancestors: (_: unknown, args: { id: string }, ctx: { kernel: any }) =>\n      ctx.kernel.handleRequest({ method: 'getAncestors', id: args.id }),`);
  }

  // Process each action
  for (const action of manifest.actions) {
    const override = overrides[action.name] as ActionOverride | undefined;
    if (override?.skip) continue;

    const op = resolveOp(action.name, overrides);
    const fieldName = resolveFieldName(action.name, name, op, overrides);
    const usesInput = shouldUseInputType(action, op);

    // Build input type if needed
    if (usesInput) {
      const inputType = buildInputType(name, action);
      if (inputType) inputTypes.push(inputType);
    }

    // Build field signature
    const args = buildFieldArgs(action, name, usesInput);
    const returnType = op === 'query' && (action.name.toLowerCase().startsWith('list') ||
      action.name.toLowerCase().startsWith('all') ||
      action.name.toLowerCase().startsWith('search'))
      ? `[${name}]`
      : name;

    const fieldLine = `    ${fieldName}${args}: ${returnType}`;
    const resolverBody = buildResolverBody(action, usesInput);

    if (op === 'query') {
      queryFields.push(fieldLine);
      queryResolvers.push(`    ${fieldName}: ${resolverBody},`);
    } else {
      mutationFields.push(fieldLine);
      mutationResolvers.push(`    ${fieldName}: ${resolverBody},`);
    }
  }

  // Assemble SDL
  let sdl = '';
  sdl += sdlParts.join('\n\n');

  if (inputTypes.length > 0) {
    sdl += '\n\n' + inputTypes.join('\n\n');
  }

  if (queryFields.length > 0) {
    sdl += '\n\n  extend type Query {\n' + queryFields.join('\n') + '\n  }';
  }

  if (mutationFields.length > 0) {
    sdl += '\n\n  extend type Mutation {\n' + mutationFields.join('\n') + '\n  }';
  }

  // Build the file content
  const header = generateFileHeader('graphql', name);

  let content = header + '\n';
  content += `export const ${camelName}TypeDefs = \`\n${sdl}\n\`;\n`;

  // Build resolver map
  content += `\nexport const ${camelName}Resolvers = {\n`;

  if (queryResolvers.length > 0) {
    content += '  Query: {\n';
    content += queryResolvers.join('\n');
    content += '\n  },\n';
  }

  if (mutationResolvers.length > 0) {
    content += '  Mutation: {\n';
    content += mutationResolvers.join('\n');
    content += '\n  },\n';
  }

  content += '};\n';

  return content;
}

// --- Concept Handler ---

export const graphqlTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'GraphqlTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'GraphQLSchema',
      capabilities: JSON.stringify(['sdl', 'resolvers', 'hierarchical']),
      targetKey: 'graphql',
      providerType: 'target',
    };
  },

  /**
   * Generate GraphQL schema and resolver files from a ConceptManifest
   * projection. Produces one schema.graphql.ts file per concept
   * containing SDL type definitions and a resolver map.
   *
   * Input:
   *   projection - JSON string containing { conceptManifest: "<nested JSON>" }
   *   config     - JSON string of GraphQL target configuration
   *   overrides  - JSON string of per-action overrides
   *
   * Returns:
   *   variant 'ok' with files array and types summary, or
   *   variant 'error' with reason string.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const projectionRaw = input.projection as string;
    const configRaw = input.config as string | undefined;
    const overridesRaw = input.overrides as string | undefined;

    // --- Validate and parse projection ---
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      return {
        variant: 'error',
        reason: 'projection is required and must be a JSON string',
      };
    }

    let manifest: ConceptManifest;
    try {
      const projection = JSON.parse(projectionRaw) as Record<string, unknown>;
      const manifestJson = projection.conceptManifest as string;
      if (!manifestJson || typeof manifestJson !== 'string') {
        return {
          variant: 'error',
          reason: 'projection must contain a conceptManifest JSON string',
        };
      }
      manifest = JSON.parse(manifestJson) as ConceptManifest;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return { variant: 'error', reason: `failed to parse projection: ${reason}` };
    }

    if (!manifest.name || typeof manifest.name !== 'string') {
      return { variant: 'error', reason: 'conceptManifest must contain a name field' };
    }

    // --- Parse optional config ---
    let _config: Record<string, unknown> = {};
    if (configRaw && typeof configRaw === 'string') {
      try {
        _config = JSON.parse(configRaw) as Record<string, unknown>;
      } catch {
        // Ignore malformed config; use defaults
      }
    }

    // --- Parse optional overrides ---
    let overrides: Record<string, Record<string, unknown>> = {};
    if (overridesRaw && typeof overridesRaw === 'string') {
      try {
        overrides = JSON.parse(overridesRaw) as Record<string, Record<string, unknown>>;
      } catch {
        // Ignore malformed overrides; use defaults
      }
    }

    // --- Parse manifest YAML for trait detection ---
    let parsedManifestYaml: Record<string, unknown> | undefined;
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        parsedManifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    const hierConfig = getHierarchicalTrait(parsedManifestYaml, manifest.name);

    // --- Generate schema file ---
    const kebabName = toKebabCase(manifest.name);
    const filePath = `${kebabName}/schema.graphql.ts`;
    const fileContent = generateSchemaFile(manifest, overrides, hierConfig);

    const files: OutputFile[] = [{ path: filePath, content: fileContent }];

    // --- Collect type summary ---
    const types: string[] = [manifest.name];
    for (const action of manifest.actions) {
      const op = resolveOp(action.name, overrides);
      if (shouldUseInputType(action, op)) {
        types.push(`${toPascalCase(action.name)}${manifest.name}Input`);
      }
    }

    return {
      variant: 'ok',
      files,
      types,
    };
  },
};
