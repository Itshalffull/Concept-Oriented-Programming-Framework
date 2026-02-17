// ============================================================
// SchemaGen Concept Implementation
//
// Produces a rich, language-neutral
// ConceptManifest instead of standalone GraphQL/JSON schemas.
// The manifest contains:
//   - Relation schemas (with merge/grouping from state section)
//   - Fully typed action signatures (ResolvedType trees)
//   - Structured invariants with deterministic test values
//   - GraphQL schema fragment
//   - JSON Schemas for wire validation
//
// Follows the architecture doc:
//   - Section 3.2: JSON Schema generation
//   - Section 3.3: Type mapping table
//   - Section 4.1: GraphQL schema from state
//   - Section 10.1: ConceptManifest as language-neutral IR
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptAST,
  TypeExpr,
  ActionDecl,
  ActionPattern,
  ConceptManifest,
  TypeParamInfo,
  RelationSchema,
  FieldSchema,
  ResolvedType,
  ActionSchema,
  ActionParamSchema,
  VariantSchema,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../kernel/src/types.js';

// --- TypeExpr → ResolvedType conversion ---

function typeExprToResolvedType(t: TypeExpr): ResolvedType {
  switch (t.kind) {
    case 'primitive':
      return { kind: 'primitive', primitive: t.name };
    case 'param':
      return { kind: 'param', paramRef: t.name };
    case 'set':
      return { kind: 'set', inner: typeExprToResolvedType(t.inner) };
    case 'list':
      return { kind: 'list', inner: typeExprToResolvedType(t.inner) };
    case 'option':
      return { kind: 'option', inner: typeExprToResolvedType(t.inner) };
    case 'relation':
      return {
        kind: 'map',
        keyType: typeExprToResolvedType(t.from),
        inner: typeExprToResolvedType(t.to),
      };
    case 'record':
      return {
        kind: 'record',
        fields: t.fields.map(f => ({
          name: f.name,
          type: typeExprToResolvedType(f.type),
          optional: false,
        })),
      };
  }
}

// --- State → RelationSchema conversion (merge/grouping rules) ---

function buildRelationSchemas(ast: ConceptAST): RelationSchema[] {
  const keyParam = ast.typeParams.length > 0 ? ast.typeParams[0] : null;
  const keyFieldName = keyParam ? keyParam.toLowerCase() : 'id';

  const mergedFields: FieldSchema[] = [];
  const relations: RelationSchema[] = [];

  for (const entry of ast.state) {
    if (entry.type.kind === 'relation') {
      // U -> Bytes: the "to" type becomes a field in the merged relation
      mergedFields.push({
        name: entry.name,
        type: typeExprToResolvedType(entry.type.to),
        optional: false,
      });
    } else if (entry.type.kind === 'set') {
      // set T becomes a separate set-valued relation
      relations.push({
        name: entry.name,
        source: 'set-valued',
        keyField: { name: keyFieldName, paramRef: keyParam || 'id' },
        fields: [{
          name: 'value',
          type: typeExprToResolvedType(entry.type.inner),
          optional: false,
        }],
      });
    } else {
      mergedFields.push({
        name: entry.name,
        type: typeExprToResolvedType(entry.type),
        optional: false,
      });
    }
  }

  if (mergedFields.length > 0) {
    relations.unshift({
      name: 'entries',
      source: 'merged',
      keyField: { name: keyFieldName, paramRef: keyParam || 'id' },
      fields: mergedFields,
    });
  }

  return relations;
}

// --- Actions → ActionSchema conversion ---

function buildActionSchemas(ast: ConceptAST): ActionSchema[] {
  return ast.actions.map(action => ({
    name: action.name,
    params: action.params.map(p => ({
      name: p.name,
      type: typeExprToResolvedType(p.type),
    })),
    variants: action.variants.map(v => ({
      tag: v.name,
      fields: v.params.map(p => ({
        name: p.name,
        type: typeExprToResolvedType(p.type),
      })),
      prose: v.description,
    })),
  }));
}

// --- Invariants → InvariantSchema conversion ---

function buildInvariantSchemas(ast: ConceptAST): InvariantSchema[] {
  if (!ast.invariants || ast.invariants.length === 0) return [];

  return ast.invariants.map((inv, i) => {
    const freeVars: { name: string; testValue: string }[] = [];
    const seenVars = new Set<string>();
    let varCount = 0;

    function collectVar(name: string) {
      if (!seenVars.has(name)) {
        seenVars.add(name);
        varCount++;
        freeVars.push({
          name,
          testValue: `u-test-invariant-${String(varCount).padStart(3, '0')}`,
        });
      }
    }

    function convertValue(v: { type: 'literal'; value: string | number | boolean } | { type: 'variable'; name: string }): InvariantValue {
      if (v.type === 'literal') {
        return { kind: 'literal', value: v.value };
      }
      return { kind: 'variable', name: v.name };
    }

    function convertPatternToStep(pattern: ActionPattern): InvariantStep {
      // Collect variables (inputs first, then outputs — preserves ordering)
      for (const arg of pattern.inputArgs) {
        if (arg.value.type === 'variable') collectVar(arg.value.name);
      }
      for (const arg of pattern.outputArgs) {
        if (arg.value.type === 'variable') collectVar(arg.value.name);
      }

      return {
        action: pattern.actionName,
        inputs: pattern.inputArgs.map(a => ({
          name: a.name,
          value: convertValue(a.value),
        })),
        expectedVariant: pattern.variantName,
        expectedOutputs: pattern.outputArgs.map(a => ({
          name: a.name,
          value: convertValue(a.value),
        })),
      };
    }

    const setup = inv.afterPatterns.map(p => convertPatternToStep(p));
    const assertions = inv.thenPatterns.map(p => convertPatternToStep(p));

    const afterNames = inv.afterPatterns.map(p => p.actionName).join(', ');
    const thenNames = inv.thenPatterns.map(p => p.actionName).join(', ');
    const description = `invariant ${i + 1}: after ${afterNames}, ${thenNames} behaves correctly`;

    return { description, setup, assertions, freeVariables: freeVars };
  });
}

// --- JSON Schema Generation (Section 3.2) ---

function resolvedTypeToJsonSchema(t: ResolvedType): Record<string, unknown> {
  switch (t.kind) {
    case 'primitive':
      return primitiveToJsonSchema(t.primitive);
    case 'param':
      return { type: 'string' };
    case 'set':
      return { type: 'array', items: resolvedTypeToJsonSchema(t.inner), uniqueItems: true };
    case 'list':
      return { type: 'array', items: resolvedTypeToJsonSchema(t.inner) };
    case 'option': {
      const inner = resolvedTypeToJsonSchema(t.inner);
      return { oneOf: [inner, { type: 'null' }] };
    }
    case 'map':
      return { type: 'object', additionalProperties: resolvedTypeToJsonSchema(t.inner) };
    case 'record': {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const f of t.fields) {
        properties[f.name] = resolvedTypeToJsonSchema(f.type);
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

function buildJsonSchemas(
  conceptUri: string,
  actions: ActionSchema[],
): { invocations: Record<string, object>; completions: Record<string, Record<string, object>> } {
  const invocations: Record<string, object> = {};
  const completions: Record<string, Record<string, object>> = {};

  for (const action of actions) {
    // Invocation schema
    const inputProperties: Record<string, unknown> = {};
    const inputRequired: string[] = [];
    for (const param of action.params) {
      inputProperties[param.name] = resolvedTypeToJsonSchema(param.type);
      inputRequired.push(param.name);
    }

    invocations[action.name] = {
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

    // Completion schemas per variant
    completions[action.name] = {};
    for (const variant of action.variants) {
      const outputProperties: Record<string, unknown> = {};
      const outputRequired: string[] = [];
      for (const param of variant.fields) {
        outputProperties[param.name] = resolvedTypeToJsonSchema(param.type);
        outputRequired.push(param.name);
      }

      completions[action.name][variant.tag] = {
        $id: `${conceptUri}/${action.name}/completion/${variant.tag}`,
        type: 'object',
        properties: {
          concept: { const: conceptUri },
          action: { const: action.name },
          variant: { const: variant.tag },
          output: {
            type: 'object',
            properties: outputProperties,
            required: outputRequired,
          },
        },
      };
    }
  }

  return { invocations, completions };
}

// --- GraphQL Schema Generation (Section 4.1) ---

function resolvedTypeToGraphQL(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToGraphQL(t.primitive);
    case 'param':
      return 'ID';
    case 'set':
    case 'list':
      return `[${resolvedTypeToGraphQL(t.inner)}!]`;
    case 'option':
      return resolvedTypeToGraphQL(t.inner); // nullable by default in GraphQL
    case 'map':
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

function generateGraphQLSchema(
  ast: ConceptAST,
  relations: RelationSchema[],
): string {
  const name = ast.name;
  const lines: string[] = [];

  const keyParam = ast.typeParams.length > 0 ? ast.typeParams[0] : null;
  const keyFieldName = keyParam ? keyParam.toLowerCase() : 'id';

  // Find merged and set-valued relations
  const mergedRelation = relations.find(r => r.source === 'merged');
  const setRelations = relations.filter(r => r.source === 'set-valued');

  // State type
  if (mergedRelation || keyParam) {
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
    if (mergedRelation) {
      for (const f of mergedRelation.fields) {
        lines.push(`  ${f.name}: ${resolvedTypeToGraphQL(f.type)}!`);
      }
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
  for (const rel of setRelations) {
    lines.push('');
    lines.push(`type ${name}${capitalize(rel.name)} {`);
    if (keyParam) {
      lines.push(`  ${keyFieldName}: ID!`);
    }
    for (const f of rel.fields) {
      lines.push(`  ${f.name}: ${resolvedTypeToGraphQL(f.type)}!`);
    }
    lines.push(`}`);
  }

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Build ConceptManifest ---

function buildManifest(ast: ConceptAST, spec: string): ConceptManifest {
  const conceptUri = `urn:copf/${ast.name}`;

  const typeParams: TypeParamInfo[] = ast.typeParams.map(p => ({
    name: p,
    wireType: 'string' as const,
  }));

  const relations = buildRelationSchemas(ast);
  const actions = buildActionSchemas(ast);
  const invariants = buildInvariantSchemas(ast);
  const graphqlSchema = generateGraphQLSchema(ast, relations);
  const jsonSchemas = buildJsonSchemas(conceptUri, actions);

  return {
    uri: conceptUri,
    name: ast.name,
    typeParams,
    relations,
    actions,
    invariants,
    graphqlSchema,
    jsonSchemas,
    capabilities: ast.capabilities || [],
    purpose: ast.purpose || '',
  };
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
      const manifest = buildManifest(ast, spec);

      // Store the manifest keyed by spec reference
      await storage.put('manifests', spec, { spec, manifest });

      return { variant: 'ok', manifest };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
