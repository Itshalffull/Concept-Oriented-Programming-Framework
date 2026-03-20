// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
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

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type {
  ConceptAST,
  TypeExpr,
  ActionPattern,
  InvariantASTStep,
  ConceptManifest,
  TypeParamInfo,
  RelationSchema,
  FieldSchema,
  ResolvedType,
  ActionSchema,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

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
    default: {
      const _exhaustive: never = t;
      throw new Error(`Unknown TypeExpr kind: ${(t as { kind: string }).kind}`);
    }
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
      mergedFields.push({
        name: entry.name,
        type: typeExprToResolvedType(entry.type.to),
        optional: false,
      });
    } else if (entry.type.kind === 'set') {
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
  return ast.actions.map(action => {
    const schema: ActionSchema = {
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
    };
    if (action.description) {
      schema.description = action.description;
    }
    return schema;
  });
}

// --- Invariants → InvariantSchema conversion ---

function buildInvariantSchemas(ast: ConceptAST): InvariantSchema[] {
  if (!ast.invariants || ast.invariants.length === 0) return [];

  return ast.invariants.map((inv, i) => {
    const freeVars: { name: string; testValue: string }[] = [];
    const seenVars = new Set<string>();
    let varCount = 0;

    function collectVar(name: string) {
      if (name === '_') return;
      if (!seenVars.has(name)) {
        seenVars.add(name);
        varCount++;
        freeVars.push({
          name,
          testValue: `u-test-invariant-${String(varCount).padStart(3, '0')}`,
        });
      }
    }

    function convertValue(v: import('../../../runtime/types.js').ArgPatternValue): InvariantValue {
      if (v.type === 'literal') {
        return { kind: 'literal', value: v.value };
      }
      if (v.type === 'variable') {
        return { kind: 'variable', name: v.name };
      }
      if (v.type === 'record') {
        return {
          kind: 'record',
          fields: v.fields.map(f => ({ name: f.name, value: convertValue(f.value) })),
        };
      }
      if (v.type === 'list') {
        return { kind: 'list', items: v.items.map(item => convertValue(item)) };
      }
      return { kind: 'literal', value: '' };
    }

    function collectVarsFromValue(v: import('../../../runtime/types.js').ArgPatternValue): void {
      if (v.type === 'variable') {
        collectVar(v.name);
      } else if (v.type === 'record') {
        for (const f of v.fields) collectVarsFromValue(f.value);
      } else if (v.type === 'list') {
        for (const item of v.items) collectVarsFromValue(item);
      }
    }

    function convertPatternToStep(pattern: ActionPattern): InvariantStep {
      for (const arg of pattern.inputArgs) {
        collectVarsFromValue(arg.value);
      }
      for (const arg of pattern.outputArgs) {
        collectVarsFromValue(arg.value);
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

    function convertASTStepToStep(step: InvariantASTStep): InvariantStep | null {
      if (step.kind === 'action') {
        return convertPatternToStep(step);
      }
      if (step.kind === 'assertion') {
        function collectAssertionVars(expr: import('../../../runtime/types.js').AssertionExpr) {
          if (expr.type === 'variable') collectVar(expr.name);
          if (expr.type === 'dot_access') collectVar(expr.variable);
          if (expr.type === 'list') for (const item of expr.items) collectAssertionVars(item);
        }
        collectAssertionVars(step.left);
        collectAssertionVars(step.right);
      }
      return null;
    }

    const setup = inv.afterPatterns.map(p => convertPatternToStep(p));
    const assertions = inv.thenPatterns
      .map(p => convertASTStepToStep(p))
      .filter((s): s is InvariantStep => s !== null);

    const afterNames = inv.afterPatterns.map(p => p.actionName).join(', ');
    const thenNames = inv.thenPatterns
      .map(p => p.kind === 'action' ? p.actionName : `assert(${p.kind})`)
      .join(', ');
    const whenDesc = inv.whenClause
      ? ` (when ${inv.whenClause.conditions.map(c => `${c.operator}`).join(' and ')})`
      : '';
    const description = `invariant ${i + 1}: after ${afterNames}, ${thenNames} behaves correctly${whenDesc}`;

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
    default: {
      const _exhaustive: never = t;
      throw new Error(`Unknown ResolvedType kind: ${(t as { kind: string }).kind}`);
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
      return resolvedTypeToGraphQL(t.inner);
    case 'map':
      return 'JSON';
    case 'record':
      return 'JSON';
    default: {
      const _exhaustive: never = t;
      throw new Error(`Unknown ResolvedType kind: ${(t as { kind: string }).kind}`);
    }
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

  const mergedRelation = relations.find(r => r.source === 'merged');
  const setRelations = relations.filter(r => r.source === 'set-valued');

  if (mergedRelation || keyParam) {
    lines.push(`type ${name}State {`);
    if (keyParam) {
      lines.push(`  """All ${keyFieldName}s in this concept"""`);
      lines.push(`  ${keyFieldName}s: [ID!]!`);
    }
    lines.push(`}`);
    lines.push('');

    lines.push(`type ${name}Entry {`);
    lines.push(`  ${keyFieldName}: ID!`);
    if (mergedRelation) {
      for (const f of mergedRelation.fields) {
        lines.push(`  ${f.name}: ${resolvedTypeToGraphQL(f.type)}!`);
      }
    }
    lines.push(`}`);
    lines.push('');

    lines.push(`extend type Query {`);
    lines.push(`  ${name.toLowerCase()}_entry(${keyFieldName}: ID!): ${name}Entry`);
    lines.push(`  ${name.toLowerCase()}_entries: [${name}Entry!]!`);
    lines.push(`}`);
  }

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
  const conceptUri = `urn:clef/${ast.name}`;

  const typeParams: TypeParamInfo[] = ast.typeParams.map(p => ({
    name: p,
    wireType: 'string' as const,
  }));

  const relations = buildRelationSchemas(ast);
  const actions = buildActionSchemas(ast);
  const invariants = buildInvariantSchemas(ast);
  const graphqlSchema = generateGraphQLSchema(ast, relations);
  const jsonSchemas = buildJsonSchemas(conceptUri, actions);

  const manifest: ConceptManifest = {
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

  if (ast.annotations?.gate) {
    manifest.gate = true;
  }

  if (ast.annotations?.category) {
    manifest.category = ast.annotations.category;
  }
  if (ast.annotations?.visibility) {
    manifest.visibility = ast.annotations.visibility;
  }

  return manifest;
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'SchemaGen',
      inputKind: 'ConceptAST',
      outputKind: 'ConceptManifest',
      capabilities: JSON.stringify(['graphql', 'json-schema', 'invariants', 'generate-seeds']),
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const spec = input.spec as string;
    const ast = input.ast as ConceptAST;

    if (!ast || !ast.name) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid AST: missing concept name' }) as StorageProgram<Result>;
    }

    try {
      const manifest = buildManifest(ast, spec);

      let p = createProgram();
      p = put(p, 'manifests', spec, { spec, manifest });

      return complete(p, 'ok', { manifest }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const p = createProgram();
      return complete(p, 'error', { message, ...(stack ? { stack } : {}) }) as StorageProgram<Result>;
    }
  },

  generateSeeds(input: Record<string, unknown>) {
    const conceptPaths = input.concept_paths as string;
    const outputFormat = (input.output_format as string) ?? 'yaml';

    if (!conceptPaths) {
      const p = createProgram();
      return complete(p, 'error', { message: 'concept_paths is required' }) as StorageProgram<Result>;
    }

    // Note: This action uses fs/path imports which are side effects.
    // In the functional DSL, we compute the result eagerly and return
    // it via complete() since the logic is pure computation over files.
    try {
      const fs = require('fs');
      const path = require('path');
      const { parseConceptFile } = require('./parser.js');

      const paths = conceptPaths.split(',').map((p: string) => p.trim());
      const conceptFiles: string[] = [];

      for (const p of paths) {
        const resolved = path.resolve(p);
        try {
          const stat = fs.statSync(resolved);
          if (stat.isDirectory()) {
            const entries = fs.readdirSync(resolved);
            for (const entry of entries) {
              if (entry.endsWith('.concept')) {
                conceptFiles.push(path.join(resolved, entry));
              }
            }
          } else if (resolved.endsWith('.concept')) {
            conceptFiles.push(resolved);
          }
        } catch {
          // skip inaccessible paths
        }
      }

      if (conceptFiles.length === 0) {
        const p = createProgram();
        return complete(p, 'error', { message: 'No .concept files found' }) as StorageProgram<Result>;
      }

      const seedEntries: Array<{ schema: string; fields: string }> = [];

      for (const filePath of conceptFiles) {
        try {
          const source = fs.readFileSync(filePath, 'utf-8');
          const ast = parseConceptFile(source);

          const fields = ast.state
            .filter((entry: { type: { kind: string } }) => entry.type.kind !== 'set')
            .map((entry: { name: string }) => entry.name);

          if (fields.length > 0) {
            seedEntries.push({
              schema: ast.name,
              fields: fields.join(','),
            });
          }
        } catch {
          // skip files that fail to parse
        }
      }

      if (outputFormat === 'json') {
        const prog = createProgram();
        return complete(prog, 'ok', { seeds: JSON.stringify(seedEntries, null, 2) }) as StorageProgram<Result>;
      }

      const yamlLines: string[] = [
        '# Auto-generated Schema seed entries',
        '# Review and paste into Schema.seeds.yaml',
        '',
        'concept: Schema',
        'action: defineSchema',
        'entries:',
      ];

      for (const entry of seedEntries) {
        yamlLines.push(`  - schema: ${entry.schema}`);
        yamlLines.push(`    fields: '${entry.fields}'`);
      }

      const prog = createProgram();
      return complete(prog, 'ok', { seeds: yamlLines.join('\n') }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const prog = createProgram();
      return complete(prog, 'error', { message }) as StorageProgram<Result>;
    }
  },
};

export const schemaGenHandler = autoInterpret(_handler);
