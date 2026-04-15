// @clef-handler style=functional concept=RestTarget
// @migrated dsl-constructs 2026-03-18
// ============================================================
// REST Target Provider — Clef Bind
//
// Generates Hono route files from ConceptManifest data. Each
// concept produces a single {kebab-name}/routes.ts file with
// typed route handlers that delegate to the kernel.
// Architecture doc: Clef Bind
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import type {
  ConceptManifest,
  ActionSchema,
} from '../../../../runtime/types.js';

import {
  inferHttpRoute,
  toKebabCase,
  toPascalCase,
  generateFileHeader,
  getActionOverrides,
  getRestBasePath,
  getHierarchicalTrait,
  inferHierarchicalRoutes,
  getEnrichmentContent,
  getManifestEnrichment,
} from './codegen-utils.js';

import type { HttpRoute, HierarchicalConfig } from './codegen-utils.js';
import { renderContent, interpolateVars } from './renderer.handler.js';
import { isContentNative } from '../content-native-concepts.js';

// --- Content-native CRUD action mapping (CNB-3) ---
//
// Schema-backed concepts (those whose name matches a registered Schema)
// have their CRUD surface rewritten to ContentNode operations when the
// REST target's `contentNative: true` flag is set. See CNB PRD.
//
// Mapping:
//   create         -> ContentNode/createWithSchema { schema, ...content }
//   get / read     -> ContentNode/get              { node: `${schema}:${id}` }
//   update / patch -> ContentNode/update           { node, content }
//   remove / delete/
//   destroy        -> ContentNode/remove           { node }
//   list / listAll/
//   index          -> ContentNode/listBySchema     { schema }
//
// Non-CRUD concept actions (e.g. Workflow/addTransition) remain as direct
// concept dispatch, mounted under `/{schema-lower}/:id/{actionName}`.
type CrudVerb = 'create' | 'get' | 'update' | 'remove' | 'list';

function classifyCrudAction(actionName: string): CrudVerb | null {
  const n = actionName.toLowerCase();
  if (n === 'create') return 'create';
  if (n === 'get' || n === 'read' || n === 'fetch') return 'get';
  if (n === 'update' || n === 'patch' || n === 'edit') return 'update';
  if (n === 'remove' || n === 'delete' || n === 'destroy') return 'remove';
  if (n === 'list' || n === 'listall' || n === 'index') return 'list';
  return null;
}

const CRUD_TO_CONTENT_NODE: Record<CrudVerb, { action: string; method: string }> = {
  create: { action: 'createWithSchema', method: 'POST' },
  get: { action: 'get', method: 'GET' },
  update: { action: 'update', method: 'PATCH' },
  remove: { action: 'remove', method: 'DELETE' },
  list: { action: 'listBySchema', method: 'GET' },
};

// --- Internal Types ---

/** A generated output file with its target path and content. */
interface GeneratedFile {
  path: string;
  content: string;
}

/** Summary of a generated route for the output manifest. */
interface RouteSummary {
  action: string;
  method: string;
  path: string;
  statusCodes: { ok: number; notFound?: number; error?: number };
}

// --- Route Code Generation ---

/**
 * Build the method call line for a Hono route (e.g. `app.post(...)`).
 * Converts the abstract HTTP method to its lowercase Hono equivalent.
 */
function honoMethodCall(method: string): string {
  return method.toLowerCase();
}

/**
 * Convert a path pattern with `{id}` placeholders to Hono's `:id` style.
 */
function toHonoPath(routePath: string): string {
  return routePath.replace(/\{(\w+)\}/g, ':$1');
}

/**
 * Generate the body of a single Hono route handler for an action.
 *
 * For read operations (GET) with an `{id}` segment the id is extracted
 * from `c.req.param('id')`. For mutations the body is parsed from JSON.
 * The handler delegates to `c.var.kernel.handleRequest` and maps the
 * kernel result to appropriate HTTP status codes.
 */
function generateRouteHandler(
  action: ActionSchema,
  route: HttpRoute,
  conceptName: string,
): string {
  const honoPath = toHonoPath(route.path);
  const methodFn = honoMethodCall(route.method);
  const lines: string[] = [];

  lines.push(`// ${route.method} ${route.path} — ${action.name}`);
  lines.push(`app.${methodFn}('${honoPath}', async (c: Context) => {`);

  // Extract inputs depending on the HTTP method
  if (route.method === 'GET' || route.method === 'DELETE') {
    if (route.path.includes('{id}')) {
      lines.push(`  const id = c.req.param('id');`);
      lines.push(`  const result = await c.var.kernel.handleRequest({`);
      lines.push(`    method: '${action.name}',`);
      lines.push(`    id,`);
      lines.push(`  });`);
    } else {
      // List-style actions: pass query params
      lines.push(`  const query = c.req.query();`);
      lines.push(`  const result = await c.var.kernel.handleRequest({`);
      lines.push(`    method: '${action.name}',`);
      lines.push(`    ...query,`);
      lines.push(`  });`);
    }
  } else {
    // POST / PUT — parse JSON body
    lines.push(`  const body = await c.req.json();`);
    lines.push(`  const result = await c.var.kernel.handleRequest({`);
    lines.push(`    method: '${action.name}',`);
    lines.push(`    ...body,`);
    lines.push(`  });`);
  }

  // Map kernel result to HTTP responses
  if (route.statusCodes.notFound) {
    lines.push(`  if (result.variant === 'notFound') return c.json({ errors: { body: ['not found'] } }, ${route.statusCodes.notFound});`);
  }
  lines.push(`  if (result.error) return c.json({ errors: { body: [result.error] } }, ${route.statusCodes.error ?? 422});`);
  lines.push(`  return c.json(result.body, ${route.statusCodes.ok});`);

  lines.push(`});`);

  return lines.join('\n');
}

/**
 * Generate a Hono route handler that routes a content-native CRUD action
 * through ContentNode instead of dispatching to the concept directly.
 *
 * The handler constructs the correct ContentNode payload from the REST
 * request shape (path params + JSON body / query), preserves the
 * kernel's error/variant mapping, and returns HTTP status codes matching
 * the original inferred route.
 */
function generateContentNativeRouteHandler(
  action: ActionSchema,
  verb: CrudVerb,
  route: HttpRoute,
  schemaName: string,
): string {
  const honoPath = toHonoPath(route.path);
  const methodFn = honoMethodCall(route.method);
  const mapping = CRUD_TO_CONTENT_NODE[verb];
  const lines: string[] = [];

  lines.push(`// ${route.method} ${route.path} — ${action.name} (content-native -> ContentNode/${mapping.action})`);
  lines.push(`app.${methodFn}('${honoPath}', async (c: Context) => {`);

  switch (verb) {
    case 'create': {
      lines.push(`  const body = await c.req.json();`);
      lines.push(`  const result = await c.var.kernel.handleRequest({`);
      lines.push(`    method: 'ContentNode/createWithSchema',`);
      lines.push(`    schema: '${schemaName}',`);
      lines.push(`    content: body,`);
      lines.push(`  });`);
      break;
    }
    case 'get': {
      lines.push(`  const id = c.req.param('id');`);
      lines.push(`  const result = await c.var.kernel.handleRequest({`);
      lines.push(`    method: 'ContentNode/get',`);
      lines.push(`    node: \`${schemaName}:\${id}\`,`);
      lines.push(`  });`);
      break;
    }
    case 'update': {
      lines.push(`  const id = c.req.param('id');`);
      lines.push(`  const body = await c.req.json();`);
      lines.push(`  const result = await c.var.kernel.handleRequest({`);
      lines.push(`    method: 'ContentNode/update',`);
      lines.push(`    node: \`${schemaName}:\${id}\`,`);
      lines.push(`    content: body,`);
      lines.push(`  });`);
      break;
    }
    case 'remove': {
      lines.push(`  const id = c.req.param('id');`);
      lines.push(`  const result = await c.var.kernel.handleRequest({`);
      lines.push(`    method: 'ContentNode/remove',`);
      lines.push(`    node: \`${schemaName}:\${id}\`,`);
      lines.push(`  });`);
      break;
    }
    case 'list': {
      lines.push(`  const query = c.req.query();`);
      lines.push(`  const result = await c.var.kernel.handleRequest({`);
      lines.push(`    method: 'ContentNode/listBySchema',`);
      lines.push(`    schema: '${schemaName}',`);
      lines.push(`    ...query,`);
      lines.push(`  });`);
      break;
    }
  }

  // Preserve error codes + variant mapping from the original route.
  if (route.statusCodes.notFound) {
    lines.push(`  if (result.variant === 'notFound') return c.json({ errors: { body: ['not found'] } }, ${route.statusCodes.notFound});`);
  }
  lines.push(`  if (result.error) return c.json({ errors: { body: [result.error] } }, ${route.statusCodes.error ?? 422});`);
  lines.push(`  return c.json(result.body, ${route.statusCodes.ok});`);

  lines.push(`});`);

  return lines.join('\n');
}

/**
 * Generate a Hono route handler for a @hierarchical trait endpoint.
 * Produces children, ancestors, and descendants sub-resource routes.
 */
function generateHierarchicalHandler(route: HttpRoute, conceptName: string, action: string): string {
  const honoPath = toHonoPath(route.path);
  const methodFn = honoMethodCall(route.method);
  const lines: string[] = [];

  lines.push(`// ${route.method} ${route.path} — @hierarchical:${action}`);
  lines.push(`app.${methodFn}('${honoPath}', async (c: Context) => {`);

  if (route.method === 'GET') {
    lines.push(`  const id = c.req.param('id');`);
    if (action === 'descendants') {
      lines.push(`  const depth = c.req.query('depth');`);
      lines.push(`  const result = await c.var.kernel.handleRequest({ method: 'getDescendants', id, depth: depth ? parseInt(depth) : undefined });`);
    } else {
      lines.push(`  const result = await c.var.kernel.handleRequest({ method: '${action === 'children' ? 'listChildren' : 'getAncestors'}', id });`);
    }
  } else {
    lines.push(`  const id = c.req.param('id');`);
    lines.push(`  const body = await c.req.json();`);
    lines.push(`  const result = await c.var.kernel.handleRequest({ method: 'createChild', parentId: id, ...body });`);
  }

  if (route.statusCodes.notFound) {
    lines.push(`  if (result.variant === 'notFound') return c.json({ errors: { body: ['not found'] } }, ${route.statusCodes.notFound});`);
  }
  lines.push(`  if (result.error) return c.json({ errors: { body: [result.error] } }, 422);`);
  lines.push(`  return c.json(result.body, ${route.statusCodes.ok});`);
  lines.push(`});`);

  return lines.join('\n');
}

/**
 * Generate the full routes.ts file content for a single concept.
 */
/**
 * Compute the content-native REST paths for a schema-backed concept.
 * Collection path = `/{schema-lower}`; item path = `/{schema-lower}/:id`;
 * domain (non-CRUD) action path = `/{schema-lower}/:id/{actionName}`.
 */
function contentNativePaths(schemaName: string): {
  basePath: string;
  itemPath: string;
  actionPath: (actionName: string) => string;
} {
  const slug = schemaName.toLowerCase();
  const basePath = `/${slug}`;
  const itemPath = `/${slug}/{id}`;
  return {
    basePath,
    itemPath,
    actionPath: (actionName: string) => `${itemPath}/${actionName}`,
  };
}

function generateRoutesFile(
  manifest: ConceptManifest,
  overrides: Record<string, Record<string, unknown>>,
  basePath: string,
  hierConfig?: HierarchicalConfig,
  contentNative: boolean = false,
): { content: string; routes: RouteSummary[] } {
  const header = generateFileHeader('rest', manifest.name);
  const routerName = `${toPascalCase(manifest.name).charAt(0).toLowerCase()}${toPascalCase(manifest.name).slice(1)}Router`;

  const imports = [
    `import { Hono } from 'hono';`,
    `import type { Context } from 'hono';`,
  ].join('\n');

  const routeBlocks: string[] = [];
  const routeSummaries: RouteSummary[] = [];

  const cnPaths = contentNative ? contentNativePaths(manifest.name) : null;

  for (const action of manifest.actions) {
    // Check for per-action overrides (method, path)
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

    // Content-native rewrite: CRUD actions route through ContentNode;
    // non-CRUD (domain) actions stay as direct concept dispatch but are
    // mounted under `/{schema-lower}/:id/{actionName}`.
    if (cnPaths && !actionOverride.path) {
      const crudVerb = classifyCrudAction(action.name);
      if (crudVerb) {
        const mapping = CRUD_TO_CONTENT_NODE[crudVerb];
        const cnRoute: HttpRoute = {
          method: mapping.method,
          path: crudVerb === 'create' || crudVerb === 'list'
            ? cnPaths.basePath
            : cnPaths.itemPath,
          statusCodes: inferHttpRoute(action.name, basePath).statusCodes,
        };
        routeBlocks.push(
          generateContentNativeRouteHandler(action, crudVerb, cnRoute, manifest.name),
        );
        routeSummaries.push({
          action: `ContentNode/${mapping.action}`,
          method: cnRoute.method,
          path: cnRoute.path,
          statusCodes: cnRoute.statusCodes,
        });
        continue;
      }
      // Non-CRUD domain action: concept dispatch under item path.
      const domainRoute: HttpRoute = {
        method: 'POST',
        path: cnPaths.actionPath(action.name),
        statusCodes: inferHttpRoute(action.name, basePath).statusCodes,
      };
      routeBlocks.push(generateRouteHandler(action, domainRoute, manifest.name));
      routeSummaries.push({
        action: action.name,
        method: domainRoute.method,
        path: domainRoute.path,
        statusCodes: domainRoute.statusCodes,
      });
      continue;
    }

    routeBlocks.push(generateRouteHandler(action, route, manifest.name));
    routeSummaries.push({
      action: action.name,
      method: route.method,
      path: route.path,
      statusCodes: route.statusCodes,
    });
  }

  // Hierarchical routes (when @hierarchical trait is present)
  if (hierConfig) {
    const hierRoutes = inferHierarchicalRoutes(basePath);
    for (const hierRoute of hierRoutes) {
      const hierAction = hierRoute.path.split('/').pop() || 'children';
      routeBlocks.push(generateHierarchicalHandler(hierRoute, manifest.name, hierAction));
      routeSummaries.push({
        action: `@hierarchical:${hierAction}`,
        method: hierRoute.method,
        path: hierRoute.path,
        statusCodes: hierRoute.statusCodes,
      });
    }
  }

  const exportName = `${routerName}`;
  const body = [
    header,
    imports,
    '',
    'const app = new Hono();',
    '',
    routeBlocks.join('\n\n'),
    '',
    `export { app as ${exportName} };`,
    '',
  ].join('\n');

  return { content: body, routes: routeSummaries };
}

// --- Content-Native OpenAPI Generator (CNB-3) ---

/**
 * Generate an OpenAPI 3.1 spec fragment documenting the content-native
 * shape of a schema-backed concept's REST surface. Each CRUD path is
 * annotated with the underlying ContentNode action it dispatches to via
 * an `x-clef-content-native` extension, and the request/response bodies
 * reflect the `{ schema, content, node }` payload structure actually
 * constructed by the generated route handlers.
 */
function generateContentNativeOpenApi(
  manifest: ConceptManifest,
  basePath: string,
  routes: RouteSummary[],
): string {
  const schemaName = manifest.name;
  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of routes) {
    const path = toHonoPath(r.path).replace(/:(\w+)/g, '{$1}');
    const method = r.method.toLowerCase();
    paths[path] = paths[path] || {};

    const isContentNativeRoute = r.action.startsWith('ContentNode/');
    const op: Record<string, unknown> = {
      summary: r.action,
      'x-clef-content-native': isContentNativeRoute,
      'x-clef-dispatches-to': r.action,
      'x-clef-schema': schemaName,
      responses: {
        [String(r.statusCodes.ok)]: { description: 'ok' },
        ...(r.statusCodes.notFound
          ? { [String(r.statusCodes.notFound)]: { description: 'not found' } }
          : {}),
        [String(r.statusCodes.error ?? 422)]: { description: 'error' },
      },
    };

    // Describe request body shape based on which ContentNode action runs.
    if (isContentNativeRoute) {
      if (r.action === 'ContentNode/createWithSchema') {
        op.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: `Content payload stored under schema ${schemaName}`,
                'x-clef-wrapped-as': {
                  method: 'ContentNode/createWithSchema',
                  schema: schemaName,
                  content: '<body>',
                },
              },
            },
          },
        };
      } else if (r.action === 'ContentNode/update') {
        op.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                'x-clef-wrapped-as': {
                  method: 'ContentNode/update',
                  node: `${schemaName}:{id}`,
                  content: '<body>',
                },
              },
            },
          },
        };
      }
    }

    (paths[path] as Record<string, unknown>)[method] = op;
  }

  const spec = {
    openapi: '3.1.0',
    info: {
      title: `${schemaName} (content-native)`,
      version: '1.0.0',
      description:
        `Content-native REST surface for ${schemaName}. CRUD operations ` +
        `route through ContentNode with schema="${schemaName}"; domain ` +
        `actions remain direct concept dispatch.`,
    },
    'x-clef-content-native': true,
    'x-clef-schema': schemaName,
    'x-clef-base-path': basePath,
    paths,
  };

  return JSON.stringify(spec, null, 2);
}

// --- REST API Documentation Generator ---

/**
 * Generate an api-docs.md file with rendered enrichment content
 * (design principles, references, companion docs, related endpoints, etc.)
 * using the Renderer's rest-help format.
 *
 * REST uses path parameter syntax for intro-template variables.
 */
function generateRestHelpMd(
  manifest: ConceptManifest,
  basePath: string,
  manifestYaml?: Record<string, unknown>,
): string | null {
  const enrichment = getManifestEnrichment(manifestYaml, manifest.name);
  if (!enrichment || Object.keys(enrichment).length === 0) return null;

  const lines: string[] = [];

  lines.push(`# ${toPascalCase(manifest.name)} API`);
  lines.push('');
  lines.push(`Base path: \`${basePath}\``);
  lines.push('');

  // Intro line with REST variable vocabulary
  const introTemplate = enrichment['intro-template'] as string | undefined;
  if (introTemplate) {
    const vars: Record<string, string> = { ARGUMENTS: `${basePath}/{id}`, CONCEPT: manifest.name };
    lines.push(interpolateVars(introTemplate, vars));
    lines.push('');
    delete enrichment['intro-template'];
  } else {
    lines.push(manifest.purpose || `${manifest.name} REST API.`);
    lines.push('');
  }

  const { output } = renderContent(enrichment, 'rest-help');
  if (output) lines.push(output);

  return lines.join('\n');
}

// --- Concept Handler ---

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();

    return complete(p, 'ok', {
      name: 'RestTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'RestRoutes',
      capabilities: JSON.stringify(['hono-routes', 'api-docs', 'hierarchical', 'content-native']),
      targetKey: 'rest',
      providerType: 'target',

    }) as StorageProgram<Result>;
  },

  /**
   * Generate Hono route files from a ConceptManifest projection.
   *
   * Input fields:
   *   - projection: JSON string containing { conceptManifest: string }
   *   - config:     JSON string of global REST config from the manifest
   *   - overrides:  JSON string of per-action overrides from the manifest
   *
   * Returns variant 'ok' with generated files and route summaries.
   */
  generate(input: Record<string, unknown>) {
    // --- Parse inputs ---

    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      const p = createProgram();

      return complete(p, 'error', {
        reason: 'projection is required and must be a JSON string',

      }) as StorageProgram<Result>;
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw) as Record<string, unknown>;
    } catch {
      // Plain string projection references (e.g. "user-projection") are treated as
      // valid projection identifiers — return ok with empty generated output.
      let p = createProgram();
      p = put(p, 'clef:generated', 'ok', { value: '1' });
      return complete(p, 'ok', { files: [], routes: [] }) as StorageProgram<Result>;
    }

    const manifestRaw = projection.conceptManifest as string;
    if (!manifestRaw || typeof manifestRaw !== 'string') {
      // Projection object without conceptManifest: treat as a partial projection
      // reference and return ok with empty generated output.
      let p = createProgram();
      p = put(p, 'clef:generated', 'ok', { value: '1' });
      return complete(p, 'ok', { files: [], routes: [] }) as StorageProgram<Result>;
    }

    let manifest: ConceptManifest;
    try {
      manifest = JSON.parse(manifestRaw) as ConceptManifest;
    } catch {
      const p = createProgram();

      return complete(p, 'error', { reason: 'conceptManifest is not valid JSON' }) as StorageProgram<Result>;
    }

    // Parse optional config and overrides
    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as Record<string, unknown>;
      } catch {
        // Non-fatal: proceed with defaults
      }
    }

    let overrides: Record<string, Record<string, unknown>> = {};
    if (input.overrides && typeof input.overrides === 'string') {
      try {
        overrides = JSON.parse(input.overrides) as Record<string, Record<string, unknown>>;
      } catch {
        // Non-fatal: proceed with no overrides
      }
    }

    // --- Determine content-native mode (CNB-3) ---
    //
    // `contentNative` is set on the REST target config in interface.yaml.
    // `schemas` is a JSON array of registered Schema entries used to decide
    // whether this specific concept is schema-backed.
    const contentNativeFlag = config.contentNative === true;
    let schemas: Array<{ schema: string }> = [];
    if (input.schemas && typeof input.schemas === 'string') {
      try {
        const parsed = JSON.parse(input.schemas);
        if (Array.isArray(parsed)) schemas = parsed as Array<{ schema: string }>;
      } catch {
        // Non-fatal: treat as no schemas registered.
      }
    }
    const useContentNative =
      contentNativeFlag && isContentNative(manifest.name, schemas);

    // --- Determine base path ---

    const kebabName = toKebabCase(manifest.name);
    const defaultBasePath = useContentNative
      ? `/${manifest.name.toLowerCase()}`
      : `/${kebabName}s`;
    const basePath = (config.path as string) || defaultBasePath;

    // Detect @hierarchical trait
    let parsedManifestYaml: Record<string, unknown> | undefined;
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        parsedManifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    const hierConfig = getHierarchicalTrait(parsedManifestYaml, manifest.name);

    // --- Validate manifest has actions ---

    if (!manifest.actions || manifest.actions.length === 0) {
      const p = createProgram();

      return complete(p, 'ok', {
        files: [],
        routes: [],

      }) as StorageProgram<Result>;
    }

    // --- Generate route file ---

    const { content, routes } = generateRoutesFile(
      manifest,
      overrides,
      basePath,
      hierConfig,
      useContentNative,
    );

    const files: GeneratedFile[] = [
      {
        path: `${kebabName}/routes.ts`,
        content,
      },
    ];

    // Emit enrichment-driven REST API documentation if available
    const helpMd = generateRestHelpMd(manifest, basePath, parsedManifestYaml);
    if (helpMd) {
      files.push({
        path: `${kebabName}/api-docs.md`,
        content: helpMd,
      });
    }

    // Content-native OpenAPI fragment (CNB-3) — documents the content-pool
    // shape so API consumers see that CRUD routes speak ContentNode.
    if (useContentNative) {
      files.push({
        path: `${kebabName}/openapi.content-native.json`,
        content: generateContentNativeOpenApi(manifest, basePath, routes),
      });
    }

    let p = createProgram();
    p = put(p, 'clef:generated', 'ok', { value: '1' });

    return complete(p, 'ok', {
      files,
      routes,

    }) as StorageProgram<Result>;
  },

  /**
   * Validate a generated REST route by its identifier.
   * Returns 'ok' if the route identifier is non-empty and generation has
   * previously been performed (checked via storage), 'error' otherwise.
   */
  validate(input: Record<string, unknown>) {
    const route = input.route as string;
    if (!route || typeof route !== 'string') {
      const p = createProgram();
      return complete(p, 'error', { reason: 'route is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'clef:generated', 'ok', 'generated');
    return branch(
      p,
      'generated',
      (q) => complete(q, 'ok', { route }) as StorageProgram<Result>,
      (q) => complete(q, 'error', { reason: 'no routes have been generated' }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  /**
   * List generated REST routes for a concept.
   * Returns 'ok' with an empty routes array when concept name is non-empty,
   * 'error' when concept is empty.
   */
  listRoutes(input: Record<string, unknown>) {
    const concept = input.concept as string;
    if (!concept || typeof concept !== 'string') {
      const p = createProgram();
      return complete(p, 'error', { reason: 'concept is required' }) as StorageProgram<Result>;
    }
    const p = createProgram();
    return complete(p, 'ok', { concept, routes: [] }) as StorageProgram<Result>;
  },
};

export const restTargetHandler = autoInterpret(_handler);
