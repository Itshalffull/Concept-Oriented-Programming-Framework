// OpenApiTarget Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const openapiTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projections = input.projections as string[];
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const title = (parsedConfig.title as string) || 'Generated API';
    const apiVersion = (parsedConfig.apiVersion as string) || '1.0.0';
    const basePath = (parsedConfig.basePath as string) || '/api/v1';

    const paths: string[] = [];
    const schemas: string[] = [];

    for (const proj of projections) {
      const conceptName = proj.replace(/-projection$/, '').replace(/^proj-/, '').replace(/-/g, '');
      const typeName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);
      const resourcePath = conceptName.toLowerCase();

      paths.push(
        `    ${basePath}/${resourcePath}:`,
        `      get:`,
        `        summary: List ${typeName} entries`,
        `        operationId: list${typeName}`,
        `        responses:`,
        `          '200':`,
        `            description: Successful response`,
        `            content:`,
        `              application/json:`,
        `                schema:`,
        `                  type: array`,
        `                  items:`,
        `                    $ref: '#/components/schemas/${typeName}'`,
        `      post:`,
        `        summary: Create a ${typeName}`,
        `        operationId: create${typeName}`,
        `        requestBody:`,
        `          required: true`,
        `          content:`,
        `            application/json:`,
        `              schema:`,
        `                $ref: '#/components/schemas/Create${typeName}Input'`,
        `        responses:`,
        `          '201':`,
        `            description: Created`,
        `            content:`,
        `              application/json:`,
        `                schema:`,
        `                  $ref: '#/components/schemas/${typeName}'`,
        `    ${basePath}/${resourcePath}/{id}:`,
        `      get:`,
        `        summary: Get a ${typeName} by ID`,
        `        operationId: get${typeName}`,
        `        parameters:`,
        `          - name: id`,
        `            in: path`,
        `            required: true`,
        `            schema:`,
        `              type: string`,
        `        responses:`,
        `          '200':`,
        `            description: Successful response`,
        `            content:`,
        `              application/json:`,
        `                schema:`,
        `                  $ref: '#/components/schemas/${typeName}'`,
        `          '404':`,
        `            description: Not found`,
        `      put:`,
        `        summary: Update a ${typeName}`,
        `        operationId: update${typeName}`,
        `        parameters:`,
        `          - name: id`,
        `            in: path`,
        `            required: true`,
        `            schema:`,
        `              type: string`,
        `        requestBody:`,
        `          required: true`,
        `          content:`,
        `            application/json:`,
        `              schema:`,
        `                $ref: '#/components/schemas/Update${typeName}Input'`,
        `        responses:`,
        `          '200':`,
        `            description: Updated`,
        `      delete:`,
        `        summary: Delete a ${typeName}`,
        `        operationId: delete${typeName}`,
        `        parameters:`,
        `          - name: id`,
        `            in: path`,
        `            required: true`,
        `            schema:`,
        `              type: string`,
        `        responses:`,
        `          '204':`,
        `            description: Deleted`,
      );

      schemas.push(
        `    ${typeName}:`,
        `      type: object`,
        `      properties:`,
        `        id:`,
        `          type: string`,
        `        name:`,
        `          type: string`,
        `        createdAt:`,
        `          type: string`,
        `          format: date-time`,
        `        updatedAt:`,
        `          type: string`,
        `          format: date-time`,
        `      required:`,
        `        - id`,
        `        - name`,
        `    Create${typeName}Input:`,
        `      type: object`,
        `      properties:`,
        `        name:`,
        `          type: string`,
        `      required:`,
        `        - name`,
        `    Update${typeName}Input:`,
        `      type: object`,
        `      properties:`,
        `        name:`,
        `          type: string`,
      );
    }

    const content = [
      `openapi: 3.1.0`,
      `info:`,
      `  title: ${title}`,
      `  version: ${apiVersion}`,
      `  description: Generated OpenAPI specification from ${projections.length} concept projection(s)`,
      `paths:`,
      ...paths,
      `components:`,
      `  schemas:`,
      ...schemas,
    ].join('\n');

    const pathCount = projections.length * 2; // collection + item paths per projection
    const schemaCount = projections.length * 3; // entity + create input + update input per projection

    const specId = `openapi-${Date.now()}`;

    await storage.put('spec', specId, {
      specId,
      version: '3.1.0',
      paths: pathCount,
      schemas: schemaCount,
      content,
      projections: JSON.stringify(projections),
      config,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      spec: specId,
      content,
    };
  },
};
