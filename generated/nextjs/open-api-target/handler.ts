// OpenApiTarget — OpenAPI specification generator from concept definitions.
// Takes a set of concept projections and produces a complete OpenAPI 3.0
// specification with paths, schemas, and operation definitions. Each concept
// action maps to an HTTP endpoint with typed request/response schemas.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  OpenApiTargetStorage,
  OpenApiTargetGenerateInput,
  OpenApiTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface OpenApiTargetError {
  readonly code: string;
  readonly message: string;
}

export interface OpenApiTargetHandler {
  readonly generate: (
    input: OpenApiTargetGenerateInput,
    storage: OpenApiTargetStorage,
  ) => TE.TaskEither<OpenApiTargetError, OpenApiTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): OpenApiTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse config JSON safely. */
const parseConfig = (config: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(config);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

/** Convert a concept name to a URL-safe path segment. */
const toPathSegment = (name: string): string =>
  name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

/** Convert a projection name to a PascalCase schema name. */
const toSchemaName = (name: string): string =>
  name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

/** Build a single path entry for a concept projection. */
const buildPathEntry = (
  projection: string,
): Record<string, unknown> => {
  const segment = toPathSegment(projection);
  const schema = toSchemaName(projection);

  return {
    [`/api/${segment}`]: {
      get: {
        operationId: `get${schema}`,
        summary: `Retrieve ${projection}`,
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${schema}Response` },
              },
            },
          },
        },
      },
      post: {
        operationId: `create${schema}`,
        summary: `Create ${projection}`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${schema}Input` },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${schema}Response` },
              },
            },
          },
        },
      },
    },
  };
};

/** Build component schemas for a projection. */
const buildSchemas = (
  projection: string,
): Record<string, unknown> => {
  const schema = toSchemaName(projection);

  return {
    [`${schema}Input`]: {
      type: 'object',
      properties: {
        data: { type: 'object', description: `Input data for ${projection}` },
      },
      required: ['data'],
    },
    [`${schema}Response`]: {
      type: 'object',
      properties: {
        variant: { type: 'string', enum: ['ok'] },
        data: { type: 'object', description: `Response data for ${projection}` },
      },
      required: ['variant'],
    },
  };
};

/** Assemble a full OpenAPI 3.0 specification object. */
const buildOpenApiSpec = (
  projections: readonly string[],
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const title = (config['title'] as string) ?? 'Clef API';
  const version = (config['version'] as string) ?? '1.0.0';
  const description = (config['description'] as string) ?? 'Auto-generated OpenAPI specification from concept definitions';

  // Merge all path entries
  const paths: Record<string, unknown> = {};
  for (const projection of projections) {
    const pathEntry = buildPathEntry(projection);
    Object.assign(paths, pathEntry);
  }

  // Merge all schema entries
  const schemas: Record<string, unknown> = {};
  for (const projection of projections) {
    const schemaEntries = buildSchemas(projection);
    Object.assign(schemas, schemaEntries);
  }

  return {
    openapi: '3.0.3',
    info: {
      title,
      version,
      description,
    },
    paths,
    components: {
      schemas,
    },
  };
};

// --- Implementation ---

export const openApiTargetHandler: OpenApiTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { projections, config } = input;
          const parsedConfig = parseConfig(config);

          // Enrich projections from storage if available
          const enrichedProjections: string[] = [];
          for (const projection of projections) {
            const record = await storage.get('projections', projection);
            pipe(
              O.fromNullable(record),
              O.fold(
                // Use the projection name as-is if no record exists
                () => enrichedProjections.push(projection),
                (r) => {
                  const name = (r['name'] as string) ?? projection;
                  enrichedProjections.push(name);
                },
              ),
            );
          }

          const spec = buildOpenApiSpec(enrichedProjections, parsedConfig);
          const content = JSON.stringify(spec, null, 2);
          const specId = `openapi:${projections.join('+')}`;

          // Persist the generated spec for future reference
          await storage.put('specs', specId, {
            projections: [...projections],
            config,
            content,
            generatedAt: new Date().toISOString(),
          });

          return generateOk(specId, content);
        },
        storageError,
      ),
    ),
};
