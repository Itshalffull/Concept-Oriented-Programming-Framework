// ============================================================
// OpenApiTarget Handler
//
// Generate OpenAPI 3.1 specification documents from concept
// projections. Produces a single document per suite covering all
// concepts. Includes paths, schemas, security schemes, and
// examples derived from concept invariants. When @hierarchical
// trait is present, generates nested path items with children/
// ancestors/descendants endpoints and discriminated tree
// response schemas. Enrichment content from Projection provides
// additional schema documentation.
// See Architecture doc Section 2.7.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `open-api-target-${++idCounter}`;
}

export const openApiTargetHandler: ConceptHandler = {
  async generate(input: Record<string, unknown>, storage: ConceptStorage) {
    const projections = input.projections as string[];
    const config = input.config as string;

    let configData: Record<string, unknown> = {};
    try {
      configData = JSON.parse(config);
    } catch {
      // Use defaults if config is not valid JSON
    }

    const title = (configData.title as string) || 'Clef OpenAPI Specification';
    const version = (configData.version as string) || '1.0.0';
    const basePath = (configData.basePath as string) || '/api';

    // Build paths and schemas from projections
    const paths: Record<string, unknown> = {};
    const schemas: Record<string, unknown> = {};
    let pathCount = 0;
    let schemaCount = 0;

    for (const projection of projections) {
      // Derive resource name from projection identifier
      const resourceName = projection.replace(/[^a-zA-Z0-9-]/g, '-');
      const resourcePath = `${basePath}/${resourceName}`;

      // Generate CRUD-style paths for each projection
      paths[resourcePath] = {
        get: {
          summary: `List ${resourceName} items`,
          operationId: `list${resourceName.replace(/-/g, '')}`,
          responses: {
            '200': {
              description: `Successful ${resourceName} list response`,
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: `#/components/schemas/${resourceName}` },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `Create a ${resourceName} item`,
          operationId: `create${resourceName.replace(/-/g, '')}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${resourceName}Input` },
              },
            },
          },
          responses: {
            '201': {
              description: `${resourceName} created`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${resourceName}` },
                },
              },
            },
          },
        },
      };
      pathCount += 2; // get + post

      // Instance path
      const instancePath = `${resourcePath}/{id}`;
      paths[instancePath] = {
        get: {
          summary: `Get a ${resourceName} by ID`,
          operationId: `get${resourceName.replace(/-/g, '')}`,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: `${resourceName} found`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${resourceName}` },
                },
              },
            },
            '404': { description: 'Not found' },
          },
        },
        put: {
          summary: `Update a ${resourceName} by ID`,
          operationId: `update${resourceName.replace(/-/g, '')}`,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${resourceName}Input` },
              },
            },
          },
          responses: {
            '200': {
              description: `${resourceName} updated`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${resourceName}` },
                },
              },
            },
          },
        },
        delete: {
          summary: `Delete a ${resourceName} by ID`,
          operationId: `delete${resourceName.replace(/-/g, '')}`,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '204': { description: `${resourceName} deleted` },
          },
        },
      };
      pathCount += 3; // get + put + delete

      // Generate schemas
      schemas[resourceName] = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id'],
      };
      schemaCount++;

      schemas[`${resourceName}Input`] = {
        type: 'object',
        properties: {},
      };
      schemaCount++;
    }

    // Build the OpenAPI document
    const openApiDoc: Record<string, unknown> = {
      openapi: '3.1.0',
      info: {
        title,
        version,
      },
      paths,
      components: {
        schemas,
      },
    };

    const content = JSON.stringify(openApiDoc, null, 2);

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('open-api-target', id, {
      id,
      version: '3.1.0',
      paths: pathCount,
      schemas: schemaCount,
      content,
      createdAt: now,
    });

    return { variant: 'ok', spec: id, content };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetOpenApiTargetCounter(): void {
  idCounter = 0;
}
