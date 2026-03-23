// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// GraphqlTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _graphqlTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const relay = (parsedConfig.relay as boolean) || false;
    const federation = (parsedConfig.federation as boolean) || false;
    const subscriptions = (parsedConfig.subscriptions as boolean) || false;

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const typeName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    if (federation && parsedConfig.federationConflict) {
      const p = createProgram();
      return complete(p, 'federationConflict', {
        type: typeName,
        reason: `Type ${typeName} cannot be federated: conflicting key directives`,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const types = [typeName, `Create${typeName}Input`, `Update${typeName}Input`];
    if (relay) {
      types.push(`${typeName}Connection`, `${typeName}Edge`);
    }

    const files = [
      `src/graphql/schema/${conceptName}.graphql`,
      `src/graphql/resolvers/${conceptName}.ts`,
    ];

    const typeId = `graphql-${conceptName}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'type', typeId, {
      typeId,
      relay,
      federation,
      subscriptions,
      concept: conceptName,
      typeName,
      operationType: 'query',
      types: JSON.stringify(types),
      files: JSON.stringify(files),
      schemaContent: '',
      resolverContent: '',
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      types,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const type = input.type as string;

    let p = createProgram();
    p = spGet(p, 'type', type, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { type }),
      (b) => complete(b, 'ok', { type }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listOperations(input: Record<string, unknown>) {
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

    const p = createProgram();
    return complete(p, 'ok', {
      queries,
      mutations,
      subscriptions: subscriptionsList,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const graphqlTargetHandler = autoInterpret(_graphqlTargetHandler);

