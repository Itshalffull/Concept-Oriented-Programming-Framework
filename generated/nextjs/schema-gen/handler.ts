// SchemaGen — Schema generator: transforms concept AST into JSON Schema and OpenAPI
// specifications, producing typed schema definitions for concept operations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SchemaGenStorage,
  SchemaGenGenerateInput,
  SchemaGenGenerateOutput,
  SchemaGenRegisterInput,
  SchemaGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  registerOk,
} from './types.js';

export interface SchemaGenError {
  readonly code: string;
  readonly message: string;
}

export interface SchemaGenHandler {
  readonly generate: (
    input: SchemaGenGenerateInput,
    storage: SchemaGenStorage,
  ) => TE.TaskEither<SchemaGenError, SchemaGenGenerateOutput>;
  readonly register: (
    input: SchemaGenRegisterInput,
    storage: SchemaGenStorage,
  ) => TE.TaskEither<SchemaGenError, SchemaGenRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): SchemaGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SCHEMA_GEN_CAPABILITIES: readonly string[] = [
  'json-schema',
  'openapi',
  'definitions',
  'validation',
  'references',
] as const;

const toPascalCase = (s: string): string =>
  s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());

const mapTypeToJsonSchema = (t: string): Record<string, unknown> => {
  switch (t) {
    case 'string': return { type: 'string' };
    case 'number': case 'float': return { type: 'number' };
    case 'integer': return { type: 'integer' };
    case 'boolean': return { type: 'boolean' };
    case 'date': return { type: 'string', format: 'date-time' };
    case 'array': return { type: 'array', items: {} };
    case 'object': return { type: 'object', additionalProperties: true };
    default: return {};
  }
};

const extractAst = (ast: unknown): {
  readonly name: string;
  readonly operations: readonly { readonly name: string; readonly input: readonly { readonly name: string; readonly type: string; readonly required?: boolean }[]; readonly output: readonly { readonly variant: string; readonly fields: readonly { readonly name: string; readonly type: string }[] }[] }[];
} | null => {
  if (typeof ast !== 'object' || ast === null) return null;
  const a = ast as Record<string, unknown>;
  const name = String(a.name ?? '');
  if (!name) return null;

  const ops = Array.isArray(a.operations) ? a.operations : [];
  const operations = ops.map((op) => {
    const o = op as Record<string, unknown>;
    const inputs = Array.isArray(o.input) ? o.input.map((i: unknown) => {
      const inp = i as Record<string, unknown>;
      return {
        name: String(inp.name ?? ''),
        type: String(inp.type ?? 'unknown'),
        required: inp.required !== false,
      };
    }) : [];
    const outputs = Array.isArray(o.output) ? o.output.map((out: unknown) => {
      const ou = out as Record<string, unknown>;
      const fields = Array.isArray(ou.fields) ? ou.fields.map((f: unknown) => {
        const fi = f as Record<string, unknown>;
        return { name: String(fi.name ?? ''), type: String(fi.type ?? 'unknown') };
      }) : [];
      return { variant: String(ou.variant ?? 'ok'), fields };
    }) : [];
    return { name: String(o.name ?? ''), input: inputs, output: outputs };
  });

  return { name, operations };
};

// --- Implementation ---

export const schemaGenHandler: SchemaGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.of(extractAst(input.ast)),
      TE.chain((parsed) => {
        if (parsed === null) {
          return TE.right(generateError(
            'Invalid AST: must be an object with "name" and "operations" fields',
          ) as SchemaGenGenerateOutput);
        }

        const conceptName = toPascalCase(parsed.name);
        const definitions: Record<string, unknown> = {};
        const paths: Record<string, unknown> = {};

        // Build JSON Schema definitions for each operation
        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);

          // Input schema
          const inputProperties: Record<string, unknown> = {};
          const requiredFields: string[] = [];
          for (const field of op.input) {
            inputProperties[field.name] = mapTypeToJsonSchema(field.type);
            if (field.required !== false) {
              requiredFields.push(field.name);
            }
          }

          definitions[`${conceptName}${opPascal}Input`] = {
            type: 'object',
            properties: inputProperties,
            required: requiredFields,
            additionalProperties: false,
          };

          // Output schemas for each variant
          const outputOneOf: Record<string, unknown>[] = [];
          for (const variant of op.output) {
            const variantPascal = toPascalCase(variant.variant);
            const variantProperties: Record<string, unknown> = {
              variant: { type: 'string', const: variant.variant },
            };
            for (const field of variant.fields) {
              variantProperties[field.name] = mapTypeToJsonSchema(field.type);
            }

            const variantSchema = {
              type: 'object',
              properties: variantProperties,
              required: ['variant', ...variant.fields.map((f) => f.name)],
              additionalProperties: false,
            };

            definitions[`${conceptName}${opPascal}Output${variantPascal}`] = variantSchema;
            outputOneOf.push({
              $ref: `#/definitions/${conceptName}${opPascal}Output${variantPascal}`,
            });
          }

          if (outputOneOf.length > 0) {
            definitions[`${conceptName}${opPascal}Output`] = { oneOf: outputOneOf };
          }

          // OpenAPI path entry
          paths[`/${parsed.name}/${op.name}`] = {
            post: {
              operationId: `${parsed.name}_${op.name}`,
              summary: `${conceptName} ${op.name} operation`,
              requestBody: {
                content: {
                  'application/json': {
                    schema: { $ref: `#/definitions/${conceptName}${opPascal}Input` },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Successful response',
                  content: {
                    'application/json': {
                      schema: { $ref: `#/definitions/${conceptName}${opPascal}Output` },
                    },
                  },
                },
              },
            },
          };
        }

        // Assemble the complete manifest
        const manifest = {
          $schema: 'http://json-schema.org/draft-07/schema#',
          title: conceptName,
          description: `Schema generated from concept spec '${input.spec}'`,
          definitions,
          openapi: {
            openapi: '3.0.3',
            info: { title: conceptName, version: '1.0.0' },
            paths,
          },
        };

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('schemas', input.spec, {
                spec: input.spec,
                conceptName: parsed.name,
                definitionCount: Object.keys(definitions).length,
                pathCount: Object.keys(paths).length,
                generatedAt: new Date().toISOString(),
              });
              return generateOk(manifest);
            },
            toStorageError,
          ),
        );
      }),
    ),

  register: (_input, _storage) =>
    TE.right(registerOk('schema-gen', 'concept-ast', 'json-schema', SCHEMA_GEN_CAPABILITIES)),
};
