// GraphqlTarget Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const graphqlTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const relay = (parsedConfig.relay as boolean) || false;
    const federation = (parsedConfig.federation as boolean) || false;
    const subscriptions = (parsedConfig.subscriptions as boolean) || false;

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const typeName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    // Check for federation conflicts
    if (federation && parsedConfig.federationConflict) {
      return {
        variant: 'federationConflict',
        type: typeName,
        reason: `Type ${typeName} cannot be federated: conflicting key directives`,
      };
    }

    const types = [typeName, `Create${typeName}Input`, `Update${typeName}Input`];
    if (relay) {
      types.push(`${typeName}Connection`, `${typeName}Edge`);
    }

    const connectionType = relay
      ? [
          ``,
          `type ${typeName}Connection {`,
          `  edges: [${typeName}Edge!]!`,
          `  pageInfo: PageInfo!`,
          `  totalCount: Int!`,
          `}`,
          ``,
          `type ${typeName}Edge {`,
          `  node: ${typeName}!`,
          `  cursor: String!`,
          `}`,
        ].join('\n')
      : '';

    const federationDirective = federation ? ` @key(fields: "id")` : '';

    const subscriptionBlock = subscriptions
      ? [
          ``,
          `type Subscription {`,
          `  ${conceptName}Created: ${typeName}!`,
          `  ${conceptName}Updated: ${typeName}!`,
          `  ${conceptName}Deleted: ID!`,
          `}`,
        ].join('\n')
      : '';

    const schemaContent = [
      `# Generated GraphQL Schema for ${typeName}`,
      ``,
      `type ${typeName}${federationDirective} {`,
      `  id: ID!`,
      `  name: String!`,
      `  createdAt: DateTime!`,
      `  updatedAt: DateTime!`,
      `}`,
      ``,
      `input Create${typeName}Input {`,
      `  name: String!`,
      `}`,
      ``,
      `input Update${typeName}Input {`,
      `  name: String`,
      `}`,
      connectionType,
      ``,
      `type Query {`,
      `  ${conceptName}(id: ID!): ${typeName}`,
      relay ? `  ${conceptName}s(first: Int, after: String): ${typeName}Connection!` : `  ${conceptName}s: [${typeName}!]!`,
      `}`,
      ``,
      `type Mutation {`,
      `  create${typeName}(input: Create${typeName}Input!): ${typeName}!`,
      `  update${typeName}(id: ID!, input: Update${typeName}Input!): ${typeName}!`,
      `  delete${typeName}(id: ID!): Boolean!`,
      `}`,
      subscriptionBlock,
    ].join('\n');

    const resolverContent = [
      `// Generated resolvers for ${typeName}`,
      `export const resolvers = {`,
      `  Query: {`,
      `    ${conceptName}: async (_: any, { id }: { id: string }) => { /* resolve */ },`,
      `    ${conceptName}s: async () => { /* resolve */ },`,
      `  },`,
      `  Mutation: {`,
      `    create${typeName}: async (_: any, { input }: any) => { /* resolve */ },`,
      `    update${typeName}: async (_: any, { id, input }: any) => { /* resolve */ },`,
      `    delete${typeName}: async (_: any, { id }: { id: string }) => { /* resolve */ },`,
      `  },`,
      `};`,
    ].join('\n');

    const files = [
      `src/graphql/schema/${conceptName}.graphql`,
      `src/graphql/resolvers/${conceptName}.ts`,
    ];

    const typeId = `graphql-${conceptName}-${Date.now()}`;

    await storage.put('type', typeId, {
      typeId,
      relay,
      federation,
      subscriptions,
      concept: conceptName,
      typeName,
      operationType: 'query',
      types: JSON.stringify(types),
      files: JSON.stringify(files),
      schemaContent,
      resolverContent,
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      types,
      files,
    };
  },

  async validate(input, storage) {
    const type = input.type as string;

    const existing = await storage.get('type', type);
    if (!existing) {
      return { variant: 'ok', type };
    }

    const types = JSON.parse(existing.types as string) as string[];

    // Check for cyclic type references
    const visited = new Set<string>();
    const stack = new Set<string>();

    for (const t of types) {
      if (visited.has(t)) continue;
      // Simplified cycle detection for generated types
      if (stack.has(t)) {
        return {
          variant: 'cyclicType',
          type,
          cycle: Array.from(stack),
        };
      }
      visited.add(t);
    }

    return { variant: 'ok', type };
  },

  async listOperations(input, storage) {
    const concept = input.concept as string;
    const conceptLower = concept.toLowerCase();

    const typeName = concept.charAt(0).toUpperCase() + concept.slice(1);

    const queries = [
      `${conceptLower}(id: ID!): ${typeName}`,
      `${conceptLower}s: [${typeName}!]!`,
    ];

    const mutations = [
      `create${typeName}(input: Create${typeName}Input!): ${typeName}!`,
      `update${typeName}(id: ID!, input: Update${typeName}Input!): ${typeName}!`,
      `delete${typeName}(id: ID!): Boolean!`,
    ];

    const subscriptionsList: string[] = [
      `${conceptLower}Created: ${typeName}!`,
      `${conceptLower}Updated: ${typeName}!`,
      `${conceptLower}Deleted: ID!`,
    ];

    return {
      variant: 'ok',
      queries,
      mutations,
      subscriptions: subscriptionsList,
    };
  },
};
