// @migrated dsl-constructs 2026-03-18
// RestTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _restTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const basePath = (parsedConfig.basePath as string) || '/api/v1';
    const framework = (parsedConfig.framework as string) || 'express';
    const versioning = (parsedConfig.versioning as string) || '';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const resourcePath = conceptName.toLowerCase();

    let p = createProgram();

    if (parsedConfig.ambiguousActions) {
      const actions = parsedConfig.ambiguousActions as Array<{ action: string; reason: string }>;
      if (actions.length > 0) {
        return complete(p, 'ambiguousMapping', {
          action: actions[0].action,
          reason: actions[0].reason,
        }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    }

    const routes = [
      `GET ${basePath}/${resourcePath}`,
      `POST ${basePath}/${resourcePath}`,
      `GET ${basePath}/${resourcePath}/:id`,
      `PUT ${basePath}/${resourcePath}/:id`,
      `DELETE ${basePath}/${resourcePath}/:id`,
    ];

    const files = [
      `src/routes/${resourcePath}.ts`,
      `src/types/${resourcePath}.ts`,
    ];

    const routeId = `rest-${conceptName}-${Date.now()}`;

    p = put(p, 'route', routeId, {
      routeId,
      basePath,
      framework,
      versioning,
      concept: conceptName,
      action: 'crud',
      method: 'GET,POST,PUT,DELETE',
      path: `${basePath}/${resourcePath}`,
      routes: JSON.stringify(routes),
      files: JSON.stringify(files),
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { routes, files }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const route = input.route as string;

    let p = createProgram();
    p = spGet(p, 'route', route, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { route }),
      (b) => complete(b, 'ok', { route }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listRoutes(input: Record<string, unknown>) {
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

    let p = createProgram();
    return complete(p, 'ok', { routes, methods }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const restTargetHandler = autoInterpret(_restTargetHandler);

