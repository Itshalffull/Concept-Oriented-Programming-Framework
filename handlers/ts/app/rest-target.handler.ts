// RestTarget Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const restTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const basePath = (parsedConfig.basePath as string) || '/api/v1';
    const framework = (parsedConfig.framework as string) || 'express';
    const versioning = (parsedConfig.versioning as string) || '';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const typeName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);
    const resourcePath = conceptName.toLowerCase();

    // Check for ambiguous mappings
    if (parsedConfig.ambiguousActions) {
      const actions = parsedConfig.ambiguousActions as Array<{ action: string; reason: string }>;
      if (actions.length > 0) {
        return {
          variant: 'ambiguousMapping',
          action: actions[0].action,
          reason: actions[0].reason,
        };
      }
    }

    const routes = [
      `GET ${basePath}/${resourcePath}`,
      `POST ${basePath}/${resourcePath}`,
      `GET ${basePath}/${resourcePath}/:id`,
      `PUT ${basePath}/${resourcePath}/:id`,
      `DELETE ${basePath}/${resourcePath}/:id`,
    ];

    const statusCodeTable = JSON.stringify([
      { code: 200, meaning: 'Success' },
      { code: 201, meaning: 'Created' },
      { code: 204, meaning: 'No Content (Deleted)' },
      { code: 400, meaning: 'Bad Request' },
      { code: 404, meaning: 'Not Found' },
      { code: 500, meaning: 'Internal Server Error' },
    ]);

    const routerFile = framework === 'express'
      ? [
          `// Generated REST routes for ${typeName}`,
          `import { Router, Request, Response } from 'express';`,
          ``,
          `const router = Router();`,
          ``,
          `// GET ${basePath}/${resourcePath} - List all ${typeName} entries`,
          `router.get('${basePath}/${resourcePath}', async (req: Request, res: Response) => {`,
          `  try {`,
          `    // List implementation`,
          `    res.json([]);`,
          `  } catch (error) {`,
          `    res.status(500).json({ error: 'Internal server error' });`,
          `  }`,
          `});`,
          ``,
          `// POST ${basePath}/${resourcePath} - Create a ${typeName}`,
          `router.post('${basePath}/${resourcePath}', async (req: Request, res: Response) => {`,
          `  try {`,
          `    const { name } = req.body;`,
          `    // Create implementation`,
          `    res.status(201).json({ id: 'new-id', name });`,
          `  } catch (error) {`,
          `    res.status(500).json({ error: 'Internal server error' });`,
          `  }`,
          `});`,
          ``,
          `// GET ${basePath}/${resourcePath}/:id - Get a ${typeName} by ID`,
          `router.get('${basePath}/${resourcePath}/:id', async (req: Request, res: Response) => {`,
          `  try {`,
          `    const { id } = req.params;`,
          `    // Get implementation`,
          `    res.json({ id });`,
          `  } catch (error) {`,
          `    res.status(500).json({ error: 'Internal server error' });`,
          `  }`,
          `});`,
          ``,
          `// PUT ${basePath}/${resourcePath}/:id - Update a ${typeName}`,
          `router.put('${basePath}/${resourcePath}/:id', async (req: Request, res: Response) => {`,
          `  try {`,
          `    const { id } = req.params;`,
          `    const { name } = req.body;`,
          `    // Update implementation`,
          `    res.json({ id, name });`,
          `  } catch (error) {`,
          `    res.status(500).json({ error: 'Internal server error' });`,
          `  }`,
          `});`,
          ``,
          `// DELETE ${basePath}/${resourcePath}/:id - Delete a ${typeName}`,
          `router.delete('${basePath}/${resourcePath}/:id', async (req: Request, res: Response) => {`,
          `  try {`,
          `    const { id } = req.params;`,
          `    // Delete implementation`,
          `    res.status(204).send();`,
          `  } catch (error) {`,
          `    res.status(500).json({ error: 'Internal server error' });`,
          `  }`,
          `});`,
          ``,
          `export default router;`,
        ].join('\n')
      : [
          `// Generated REST routes for ${typeName} (${framework})`,
          `// Route definitions for ${basePath}/${resourcePath}`,
          `export const routes = ${JSON.stringify(routes, null, 2)};`,
        ].join('\n');

    const typesFile = [
      `// Generated types for ${typeName} REST API`,
      ``,
      `export interface ${typeName} {`,
      `  id: string;`,
      `  name: string;`,
      `  createdAt: string;`,
      `  updatedAt: string;`,
      `}`,
      ``,
      `export interface Create${typeName}Input {`,
      `  name: string;`,
      `}`,
      ``,
      `export interface Update${typeName}Input {`,
      `  name?: string;`,
      `}`,
    ].join('\n');

    const files = [
      `src/routes/${resourcePath}.ts`,
      `src/types/${resourcePath}.ts`,
    ];

    const routeId = `rest-${conceptName}-${Date.now()}`;

    await storage.put('route', routeId, {
      routeId,
      basePath,
      framework,
      versioning,
      concept: conceptName,
      action: 'crud',
      method: 'GET,POST,PUT,DELETE',
      path: `${basePath}/${resourcePath}`,
      statusCodes: statusCodeTable,
      routes: JSON.stringify(routes),
      files: JSON.stringify(files),
      routerFile,
      typesFile,
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      routes,
      files,
    };
  },

  async validate(input, storage) {
    const route = input.route as string;

    const existing = await storage.get('route', route);
    if (!existing) {
      return { variant: 'ok', route };
    }

    const routes = JSON.parse(existing.routes as string) as string[];

    // Check for path conflicts (same method + path)
    const seen = new Map<string, string>();
    for (const r of routes) {
      const key = r; // "METHOD path" format
      if (seen.has(key)) {
        return {
          variant: 'pathConflict',
          route,
          conflicting: seen.get(key)!,
          reason: `Duplicate route: ${key}`,
        };
      }
      seen.set(key, r);
    }

    return { variant: 'ok', route };
  },

  async listRoutes(input, storage) {
    const concept = input.concept as string;
    const resourcePath = concept.toLowerCase();

    const routes = [
      `/api/v1/${resourcePath}`,
      `/api/v1/${resourcePath}/:id`,
    ];

    const methods = [
      'GET,POST',
      'GET,PUT,DELETE',
    ];

    return {
      variant: 'ok',
      routes,
      methods,
    };
  },
};
