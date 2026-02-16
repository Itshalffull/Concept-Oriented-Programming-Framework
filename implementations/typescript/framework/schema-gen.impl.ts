// ============================================================
// Stage 1 — SchemaGen Concept Implementation
//
// Generates GraphQL schema fragments and JSON Schemas from
// parsed concept ASTs. Follows the architecture doc:
//   - Section 3.2: JSON Schema generation from action signatures
//   - Section 3.3: Type mapping table
//   - Section 4.1: GraphQL schema from state section
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptAST, TypeExpr, ActionDecl } from '../../../kernel/src/types.js';

// --- Type Mapping (Section 3.3) ---

function typeExprToJsonSchema(t: TypeExpr): Record<string, unknown> {
  switch (t.kind) {
    case 'primitive':
      return primitiveToJsonSchema(t.name);
    case 'param':
      // Type parameters are opaque string identifiers on the wire
      return { type: 'string' };
    case 'set':
      return { type: 'array', items: typeExprToJsonSchema(t.inner), uniqueItems: true };
    case 'list':
      return { type: 'array', items: typeExprToJsonSchema(t.inner) };
    case 'option': {
      const inner = typeExprToJsonSchema(t.inner);
      return { oneOf: [inner, { type: 'null' }] };
    }
    case 'relation':
      return { type: 'object', additionalProperties: typeExprToJsonSchema(t.to) };
    case 'record': {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const f of t.fields) {
        properties[f.name] = typeExprToJsonSchema(f.type);
        required.push(f.name);
      }
      return { type: 'object', properties, required };
    }
  }
}

function primitiveToJsonSchema(name: string): Record<string, unknown> {
  switch (name) {
    case 'String': return { type: 'string' };
    case 'Int': return { type: 'integer' };
    case 'Float': return { type: 'number' };
    case 'Bool': return { type: 'boolean' };
    case 'Bytes': return { type: 'string', contentEncoding: 'base64' };
    case 'DateTime': return { type: 'string', format: 'date-time' };
    case 'ID': return { type: 'string' };
    default: return { type: 'string' };
  }
}

function typeExprToGraphQL(t: TypeExpr): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToGraphQL(t.name);
    case 'param':
      return 'ID';
    case 'set':
    case 'list':
      return `[${typeExprToGraphQL(t.inner)}!]`;
    case 'option':
      return typeExprToGraphQL(t.inner); // nullable by default in GraphQL
    case 'relation':
      return 'JSON'; // fallback for map types
    case 'record':
      return 'JSON'; // inline records map to JSON scalar
  }
}

function primitiveToGraphQL(name: string): string {
  switch (name) {
    case 'String': return 'String';
    case 'Int': return 'Int';
    case 'Float': return 'Float';
    case 'Bool': return 'Boolean';
    case 'Bytes': return 'String';
    case 'DateTime': return 'String';
    case 'ID': return 'ID';
    default: return 'String';
  }
}

// --- JSON Schema Generation (Section 3.2) ---

function generateActionSchemas(
  conceptName: string,
  conceptUri: string,
  action: ActionDecl,
): string[] {
  const schemas: string[] = [];

  // Invocation schema
  const inputProperties: Record<string, unknown> = {};
  const inputRequired: string[] = [];
  for (const param of action.params) {
    inputProperties[param.name] = typeExprToJsonSchema(param.type);
    inputRequired.push(param.name);
  }

  const invocationSchema = {
    $id: `${conceptUri}/${action.name}/invocation`,
    type: 'object',
    properties: {
      concept: { const: conceptUri },
      action: { const: action.name },
      input: {
        type: 'object',
        properties: inputProperties,
        required: inputRequired,
      },
    },
  };
  schemas.push(JSON.stringify(invocationSchema, null, 2));

  // One completion schema per return variant
  for (const variant of action.variants) {
    const outputProperties: Record<string, unknown> = {};
    const outputRequired: string[] = [];
    for (const param of variant.params) {
      outputProperties[param.name] = typeExprToJsonSchema(param.type);
      outputRequired.push(param.name);
    }

    const completionSchema = {
      $id: `${conceptUri}/${action.name}/completion/${variant.name}`,
      type: 'object',
      properties: {
        concept: { const: conceptUri },
        action: { const: action.name },
        variant: { const: variant.name },
        output: {
          type: 'object',
          properties: outputProperties,
          required: outputRequired,
        },
      },
    };
    schemas.push(JSON.stringify(completionSchema, null, 2));
  }

  return schemas;
}

// --- GraphQL Schema Generation (Section 4.1) ---

function generateGraphQLSchema(ast: ConceptAST): string {
  const name = ast.name;
  const lines: string[] = [];

  // Determine the key type parameter (first type param, lowercased)
  const keyParam = ast.typeParams.length > 0 ? ast.typeParams[0] : null;
  const keyFieldName = keyParam ? keyParam.toLowerCase() : 'id';

  // Group state entries by relation (using the merge rules from Section 2.4)
  // State components with the same domain type and scalar values merge.
  // For simplicity in Stage 1, we merge all entries that share a relation
  // type of "param -> X" into one type.
  const mergedFields: { name: string; gqlType: string }[] = [];
  const separateRelations: { name: string; fields: { name: string; gqlType: string }[] }[] = [];

  for (const entry of ast.state) {
    if (entry.type.kind === 'relation') {
      // Domain -> Range relation: merge into the main type
      mergedFields.push({
        name: entry.name,
        gqlType: typeExprToGraphQL(entry.type.to) + '!',
      });
    } else if (entry.type.kind === 'set') {
      // set T becomes a separate relation
      separateRelations.push({
        name: entry.name,
        fields: [{ name: 'value', gqlType: typeExprToGraphQL(entry.type.inner) + '!' }],
      });
    } else {
      mergedFields.push({
        name: entry.name,
        gqlType: typeExprToGraphQL(entry.type) + '!',
      });
    }
  }

  // State type
  if (mergedFields.length > 0 || keyParam) {
    lines.push(`type ${name}State {`);
    if (keyParam) {
      lines.push(`  """All ${keyFieldName}s in this concept"""`);
      lines.push(`  ${keyFieldName}s: [ID!]!`);
    }
    lines.push(`}`);
    lines.push('');

    // Entry type with merged fields
    lines.push(`type ${name}Entry {`);
    lines.push(`  ${keyFieldName}: ID!`);
    for (const f of mergedFields) {
      lines.push(`  ${f.name}: ${f.gqlType}`);
    }
    lines.push(`}`);
    lines.push('');

    // Query extensions
    lines.push(`extend type Query {`);
    lines.push(`  ${name.toLowerCase()}_entry(${keyFieldName}: ID!): ${name}Entry`);
    lines.push(`  ${name.toLowerCase()}_entries: [${name}Entry!]!`);
    lines.push(`}`);
  }

  // Separate set-valued relations
  for (const rel of separateRelations) {
    lines.push('');
    lines.push(`type ${name}${capitalize(rel.name)} {`);
    if (keyParam) {
      lines.push(`  ${keyFieldName}: ID!`);
    }
    for (const f of rel.fields) {
      lines.push(`  ${f.name}: ${f.gqlType}`);
    }
    lines.push(`}`);
  }

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Handler ---

export const schemaGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;
    const ast = input.ast as ConceptAST;

    if (!ast || !ast.name) {
      return { variant: 'error', message: 'Invalid AST: missing concept name' };
    }

    try {
      const conceptUri = `urn:copf/${ast.name}`;

      // Generate GraphQL schema
      const graphql = generateGraphQLSchema(ast);

      // Generate JSON Schemas for all actions
      const jsonSchemas: string[] = [];
      for (const action of ast.actions) {
        const schemas = generateActionSchemas(ast.name, conceptUri, action);
        jsonSchemas.push(...schemas);
      }

      // Store the result keyed by spec reference
      await storage.put('schemas', spec, {
        spec,
        graphql,
        jsonSchemas,
      });

      return { variant: 'ok', graphql, jsonSchemas };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
