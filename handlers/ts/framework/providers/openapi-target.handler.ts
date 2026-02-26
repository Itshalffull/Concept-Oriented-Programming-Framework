// ============================================================
// OpenAPI Target Provider — Clef Bind
//
// Generates a single OpenAPI 3.1 YAML document covering all
// concepts in the project. Each concept's actions are mapped
// to HTTP paths using REST inference rules with optional
// per-concept overrides from the manifest YAML.
// Architecture doc: Clef Bind
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
  VariantSchema,
  RelationSchema,
  FieldSchema,
} from '../../../../kernel/src/types.js';

import {
  typeToJsonSchema,
  inferHttpRoute,
  toKebabCase,
  toPascalCase,
  getRestBasePath,
  getApiBasePath,
  getActionOverrides,
  getHierarchicalTrait,
} from './codegen-utils.js';

import type { HttpRoute, HierarchicalConfig } from './codegen-utils.js';

// --- YAML String Helpers ---

/**
 * Indent every line in a multi-line string by the given number of spaces.
 */
function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

/**
 * Serialize a JSON-schema-like object to inline YAML. Handles primitives,
 * arrays, and nested objects with correct indentation. This avoids needing
 * a YAML library dependency.
 */
function jsonToYaml(obj: unknown, indentLevel: number = 0): string {
  const pad = ' '.repeat(indentLevel);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    // Quote strings that contain special YAML characters or are empty
    if (
      obj === '' ||
      obj.includes(':') ||
      obj.includes('#') ||
      obj.includes('{') ||
      obj.includes('}') ||
      obj.includes('[') ||
      obj.includes(']') ||
      obj.includes(',') ||
      obj.includes('&') ||
      obj.includes('*') ||
      obj.includes('?') ||
      obj.includes('|') ||
      obj.includes('>') ||
      obj.includes("'") ||
      obj.includes('"') ||
      obj.includes('%') ||
      obj.includes('@') ||
      obj.includes('`') ||
      obj.startsWith(' ') ||
      obj.endsWith(' ') ||
      obj === 'true' ||
      obj === 'false' ||
      obj === 'null'
    ) {
      return `'${obj.replace(/'/g, "''")}'`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';

    // Check if all items are simple scalars
    const allScalar = obj.every(
      (item) => typeof item !== 'object' || item === null,
    );
    if (allScalar) {
      const items = obj.map((item) => jsonToYaml(item, 0)).join(', ');
      return `[${items}]`;
    }

    const lines: string[] = [];
    for (const item of obj) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length > 0) {
          const [firstKey, firstVal] = entries[0];
          lines.push(
            `${pad}- ${firstKey}: ${jsonToYaml(firstVal, indentLevel + 4)}`,
          );
          for (let i = 1; i < entries.length; i++) {
            const [k, v] = entries[i];
            lines.push(
              `${pad}  ${k}: ${jsonToYaml(v, indentLevel + 4)}`,
            );
          }
        } else {
          lines.push(`${pad}- {}`);
        }
      } else {
        lines.push(`${pad}- ${jsonToYaml(item, indentLevel + 2)}`);
      }
    }
    return '\n' + lines.join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    const lines: string[] = [];
    for (const [key, value] of entries) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0
      ) {
        lines.push(`${pad}${key}:`);
        lines.push(jsonToYaml(value, indentLevel + 2));
      } else if (Array.isArray(value) && value.length > 0 && value.some((v) => typeof v === 'object' && v !== null)) {
        lines.push(`${pad}${key}:`);
        lines.push(jsonToYaml(value, indentLevel + 2));
      } else {
        lines.push(`${pad}${key}: ${jsonToYaml(value, indentLevel + 2)}`);
      }
    }
    return lines.join('\n');
  }

  return String(obj);
}

// --- Schema Building ---

/**
 * Build a JSON Schema object for an action's input parameters.
 */
function buildInputSchema(action: ActionSchema, conceptName: string): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of action.params) {
    properties[param.name] = typeToJsonSchema(param.type);
    required.push(param.name);
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Build a JSON Schema object for a specific action variant's output.
 */
function buildVariantSchema(variant: VariantSchema, conceptName: string, actionName: string): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    variant: { type: 'string', enum: [variant.tag] },
  };
  const required: string[] = ['variant'];

  for (const field of variant.fields) {
    properties[field.name] = typeToJsonSchema(field.type);
    required.push(field.name);
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Build a schema for all state fields of a concept (for component schemas).
 */
function buildStateSchema(manifest: ConceptManifest): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const relation of manifest.relations) {
    for (const field of relation.fields) {
      properties[field.name] = typeToJsonSchema(field.type);
      if (!field.optional) {
        required.push(field.name);
      }
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// --- Path Building ---

interface PathOperation {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  tags: string[];
  requestBody?: Record<string, unknown>;
  parameters?: Record<string, unknown>[];
  responses: Record<string, unknown>;
}

/**
 * Build OpenAPI path operations for a concept's actions.
 */
function buildPathOperations(
  manifest: ConceptManifest,
  apiBasePath: string,
  manifestYaml: Record<string, unknown>,
): PathOperation[] {
  const conceptName = manifest.name;
  const kebabName = toKebabCase(conceptName);
  const defaultBasePath = `${apiBasePath}/${kebabName}s`;
  const basePath = getRestBasePath(manifestYaml, conceptName, defaultBasePath);
  const overrides = getActionOverrides(manifestYaml, conceptName, 'rest');

  const operations: PathOperation[] = [];

  for (const action of manifest.actions) {
    const actionOverride = overrides[action.name] || {};
    let route: HttpRoute;

    if (actionOverride.method && actionOverride.path) {
      route = {
        method: (actionOverride.method as string).toUpperCase(),
        path: actionOverride.path as string,
        statusCodes: inferHttpRoute(action.name, basePath).statusCodes,
      };
    } else {
      route = inferHttpRoute(action.name, basePath);
    }

    const pascal = toPascalCase(conceptName);
    const actionPascal = toPascalCase(action.name);
    const operationId = `${conceptName}_${action.name}`;

    const op: PathOperation = {
      method: route.method.toLowerCase(),
      path: route.path,
      operationId,
      summary: `${actionPascal} ${pascal}`,
      tags: [pascal],
      responses: {},
    };

    // Request body for POST/PUT
    if (route.method === 'POST' || route.method === 'PUT') {
      const inputSchemaName = `${pascal}${actionPascal}Input`;
      op.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${inputSchemaName}` },
          },
        },
      };
    }

    // Path parameters for {id}
    if (route.path.includes('{id}')) {
      op.parameters = [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${pascal} identifier`,
        },
      ];
    }

    // Responses
    const okVariant = action.variants.find((v) => v.tag === 'ok');
    const okSchemaName = okVariant
      ? `${pascal}${actionPascal}OkResponse`
      : undefined;

    op.responses[String(route.statusCodes.ok)] = {
      description: 'Successful operation',
      ...(okSchemaName
        ? {
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${okSchemaName}` },
              },
            },
          }
        : {}),
    };

    if (route.statusCodes.notFound) {
      op.responses['404'] = {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                errors: {
                  type: 'object',
                  properties: {
                    body: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      };
    }

    op.responses['422'] = {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              errors: {
                type: 'object',
                properties: {
                  body: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    };

    operations.push(op);
  }

  // @hierarchical: add tree navigation paths
  const hierConfig = getHierarchicalTrait(manifestYaml, conceptName);
  if (hierConfig) {
    const pascal = toPascalCase(conceptName);

    // GET /{resource}/{id}/children
    operations.push({
      method: 'get',
      path: `${basePath}/{id}/children`,
      operationId: `${conceptName}_getChildren`,
      summary: `Get Children of ${pascal}`,
      tags: [pascal],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${pascal} identifier`,
        },
      ],
      responses: {
        '200': {
          description: 'List of child resources',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: `#/components/schemas/${pascal}` } },
            },
          },
        },
        '404': {
          description: 'Resource not found',
        },
      },
    });

    // POST /{resource}/{id}/children
    operations.push({
      method: 'post',
      path: `${basePath}/{id}/children`,
      operationId: `${conceptName}_createChild`,
      summary: `Create Child of ${pascal}`,
      tags: [pascal],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `Parent ${pascal} identifier`,
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${pascal}` },
          },
        },
      },
      responses: {
        '201': {
          description: 'Child resource created',
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${pascal}` },
            },
          },
        },
        '404': {
          description: 'Parent resource not found',
        },
      },
    });

    // GET /{resource}/{id}/ancestors
    operations.push({
      method: 'get',
      path: `${basePath}/{id}/ancestors`,
      operationId: `${conceptName}_getAncestors`,
      summary: `Get Ancestors of ${pascal}`,
      tags: [pascal],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${pascal} identifier`,
        },
      ],
      responses: {
        '200': {
          description: 'List of ancestor resources',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: `#/components/schemas/${pascal}` } },
            },
          },
        },
        '404': {
          description: 'Resource not found',
        },
      },
    });

    // GET /{resource}/{id}/descendants with depth query parameter
    operations.push({
      method: 'get',
      path: `${basePath}/{id}/descendants`,
      operationId: `${conceptName}_getDescendants`,
      summary: `Get Descendants of ${pascal}`,
      tags: [pascal],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${pascal} identifier`,
        },
        {
          name: 'depth',
          in: 'query',
          required: false,
          schema: { type: 'integer' },
          description: 'Maximum depth of descendants to return',
        },
      ],
      responses: {
        '200': {
          description: 'List of descendant resources',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: `#/components/schemas/${pascal}` } },
            },
          },
        },
        '404': {
          description: 'Resource not found',
        },
      },
    });
  }

  return operations;
}

// --- Document Assembly ---

/**
 * Assemble the full OpenAPI 3.1 YAML document string.
 */
function assembleOpenApiDocument(
  manifests: ConceptManifest[],
  manifestYaml: Record<string, unknown>,
  config: Record<string, unknown>,
): string {
  const projectName = (manifestYaml as Record<string, unknown>).name as string || 'Clef API';
  const projectVersion = (manifestYaml as Record<string, unknown>).version as string || '1.0.0';
  const apiBasePath = getApiBasePath(manifestYaml);

  const lines: string[] = [];

  // --- Header ---
  lines.push('# Auto-generated by Clef Clef Bind — OpenAPI target');
  lines.push('# Do not edit manually; regenerate with: clef interface generate');
  lines.push('');
  lines.push("openapi: '3.1.0'");
  lines.push('info:');
  lines.push(`  title: ${projectName}`);
  lines.push(`  version: '${projectVersion}'`);
  lines.push(`  description: OpenAPI specification generated from Clef concept definitions`);
  lines.push('');

  // --- Servers ---
  const serverUrl = (config.serverUrl as string) || `http://localhost:3000${apiBasePath}`;
  lines.push('servers:');
  lines.push(`  - url: ${serverUrl}`);
  lines.push('');

  // --- Tags ---
  lines.push('tags:');
  for (const manifest of manifests) {
    const pascal = toPascalCase(manifest.name);
    lines.push(`  - name: ${pascal}`);
    if (manifest.purpose) {
      lines.push(`    description: ${manifest.purpose}`);
    }
  }
  lines.push('');

  // --- Paths ---
  // Group operations by path
  const pathMap = new Map<string, PathOperation[]>();

  for (const manifest of manifests) {
    const ops = buildPathOperations(manifest, apiBasePath, manifestYaml);
    for (const op of ops) {
      const existing = pathMap.get(op.path) || [];
      existing.push(op);
      pathMap.set(op.path, existing);
    }
  }

  lines.push('paths:');
  for (const [path, ops] of pathMap) {
    lines.push(`  ${path}:`);
    for (const op of ops) {
      lines.push(`    ${op.method}:`);
      lines.push(`      operationId: ${op.operationId}`);
      lines.push(`      summary: ${op.summary}`);
      lines.push(`      tags:`);
      for (const tag of op.tags) {
        lines.push(`        - ${tag}`);
      }
      lines.push(`      security:`);
      lines.push(`        - bearerAuth: []`);

      // Parameters
      if (op.parameters && op.parameters.length > 0) {
        lines.push(`      parameters:`);
        for (const param of op.parameters) {
          lines.push(`        - name: ${(param as Record<string, unknown>).name}`);
          lines.push(`          in: ${(param as Record<string, unknown>).in}`);
          lines.push(`          required: ${(param as Record<string, unknown>).required}`);
          const schema = (param as Record<string, unknown>).schema as Record<string, unknown>;
          lines.push(`          schema:`);
          lines.push(`            type: ${schema.type}`);
          if ((param as Record<string, unknown>).description) {
            lines.push(`          description: ${(param as Record<string, unknown>).description}`);
          }
        }
      }

      // Request body
      if (op.requestBody) {
        lines.push(`      requestBody:`);
        lines.push(`        required: true`);
        lines.push(`        content:`);
        lines.push(`          application/json:`);
        const content = (op.requestBody as Record<string, unknown>).content as Record<string, unknown>;
        const appJson = content['application/json'] as Record<string, unknown>;
        const schema = appJson.schema as Record<string, unknown>;
        lines.push(`            schema:`);
        lines.push(`              $ref: '${schema.$ref}'`);
      }

      // Responses
      lines.push(`      responses:`);
      for (const [statusCode, response] of Object.entries(op.responses)) {
        const resp = response as Record<string, unknown>;
        lines.push(`        '${statusCode}':`);
        lines.push(`          description: ${resp.description}`);
        if (resp.content) {
          lines.push(`          content:`);
          lines.push(`            application/json:`);
          const respContent = resp.content as Record<string, unknown>;
          const respJson = respContent['application/json'] as Record<string, unknown>;
          const respSchema = respJson.schema as Record<string, unknown>;
          if (respSchema.$ref) {
            lines.push(`              schema:`);
            lines.push(`                $ref: '${respSchema.$ref}'`);
          } else {
            lines.push(`              schema:`);
            lines.push(indent(jsonToYaml(respSchema, 0), 16));
          }
        }
      }
    }
  }
  lines.push('');

  // --- Components ---
  lines.push('components:');

  // Schemas
  lines.push('  schemas:');

  for (const manifest of manifests) {
    const pascal = toPascalCase(manifest.name);

    // State schema
    const stateSchema = buildStateSchema(manifest);
    lines.push(`    ${pascal}:`);
    lines.push(indent(jsonToYaml(stateSchema, 0), 6));

    // Action input and output schemas
    for (const action of manifest.actions) {
      const actionPascal = toPascalCase(action.name);

      // Input schema
      if (action.params.length > 0) {
        const inputSchema = buildInputSchema(action, manifest.name);
        lines.push(`    ${pascal}${actionPascal}Input:`);
        lines.push(indent(jsonToYaml(inputSchema, 0), 6));
      }

      // Variant output schemas
      for (const variant of action.variants) {
        const variantPascal = toPascalCase(variant.tag);
        const variantSchema = buildVariantSchema(variant, manifest.name, action.name);
        lines.push(`    ${pascal}${actionPascal}${variantPascal}Response:`);
        lines.push(indent(jsonToYaml(variantSchema, 0), 6));
      }
    }
  }

  // Security schemes
  lines.push('');
  lines.push('  securitySchemes:');
  lines.push('    bearerAuth:');
  lines.push('      type: http');
  lines.push('      scheme: bearer');
  lines.push('      bearerFormat: JWT');
  lines.push('');

  // Global security
  lines.push('security:');
  lines.push('  - bearerAuth: []');
  lines.push('');

  return lines.join('\n');
}

// --- Concept Handler ---

export const openapiTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'OpenapiTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'OpenApiSpec',
      capabilities: JSON.stringify(['openapi-3.1', 'yaml']),
      targetKey: 'openapi',
      providerType: 'spec',
    };
  },

  /**
   * Generate an OpenAPI 3.1 YAML document from all concept projections.
   *
   * Input fields:
   *   - allProjections: JSON string array of projection records
   *                     (each has conceptManifest as JSON string, conceptName, etc.)
   *   - config:         JSON string of REST config (basePath, serverUrl, etc.)
   *   - manifestYaml:   JSON string of the full parsed manifest YAML
   *
   * Returns variant 'ok' with a single openapi.yaml file and the document string.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // --- Parse allProjections ---

    const projectionsRaw = input.allProjections as string;
    if (!projectionsRaw || typeof projectionsRaw !== 'string') {
      return {
        variant: 'error',
        reason: 'allProjections is required and must be a JSON string',
      };
    }

    let projections: Record<string, unknown>[];
    try {
      projections = JSON.parse(projectionsRaw) as Record<string, unknown>[];
    } catch {
      return { variant: 'error', reason: 'allProjections is not valid JSON' };
    }

    if (!Array.isArray(projections) || projections.length === 0) {
      return {
        variant: 'error',
        reason: 'allProjections must be a non-empty array',
      };
    }

    // --- Parse config ---

    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as Record<string, unknown>;
      } catch {
        // Non-fatal: proceed with defaults
      }
    }

    // --- Parse manifestYaml ---

    let manifestYaml: Record<string, unknown> = {};
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        manifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch {
        // Non-fatal: proceed with defaults
      }
    }

    // --- Extract ConceptManifests from projections ---

    const manifests: ConceptManifest[] = [];

    for (const proj of projections) {
      const manifestStr = proj.conceptManifest as string;
      if (!manifestStr || typeof manifestStr !== 'string') {
        continue;
      }
      try {
        const manifest = JSON.parse(manifestStr) as ConceptManifest;
        if (manifest.name && manifest.actions) {
          manifests.push(manifest);
        }
      } catch {
        // Skip projections with invalid manifest JSON
        continue;
      }
    }

    if (manifests.length === 0) {
      return {
        variant: 'error',
        reason: 'No valid concept manifests found in projections',
      };
    }

    // --- Generate OpenAPI document ---

    const document = assembleOpenApiDocument(manifests, manifestYaml, config);

    return {
      variant: 'ok',
      files: [{ path: 'openapi.yaml', content: document }],
      document,
    };
  },
};
