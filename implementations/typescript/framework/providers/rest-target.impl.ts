// ============================================================
// REST Target Provider — Interface Kit
//
// Generates Hono route files from ConceptManifest data. Each
// concept produces a single {kebab-name}/routes.ts file with
// typed route handlers that delegate to the kernel.
// Architecture doc: Interface Kit
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
} from '../../../../kernel/src/types.js';

import {
  inferHttpRoute,
  toKebabCase,
  toPascalCase,
  generateFileHeader,
  getActionOverrides,
  getRestBasePath,
} from './codegen-utils.js';

import type { HttpRoute } from './codegen-utils.js';

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
 * Generate the full routes.ts file content for a single concept.
 */
function generateRoutesFile(
  manifest: ConceptManifest,
  overrides: Record<string, Record<string, unknown>>,
  basePath: string,
): { content: string; routes: RouteSummary[] } {
  const header = generateFileHeader('rest', manifest.name);
  const routerName = `${toPascalCase(manifest.name).charAt(0).toLowerCase()}${toPascalCase(manifest.name).slice(1)}Router`;

  const imports = [
    `import { Hono } from 'hono';`,
    `import type { Context } from 'hono';`,
  ].join('\n');

  const routeBlocks: string[] = [];
  const routeSummaries: RouteSummary[] = [];

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

    routeBlocks.push(generateRouteHandler(action, route, manifest.name));
    routeSummaries.push({
      action: action.name,
      method: route.method,
      path: route.path,
      statusCodes: route.statusCodes,
    });
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

// --- Concept Handler ---

export const restTargetHandler: ConceptHandler = {
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
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // --- Parse inputs ---

    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      return {
        variant: 'error',
        reason: 'projection is required and must be a JSON string',
      };
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw) as Record<string, unknown>;
    } catch {
      return { variant: 'error', reason: 'projection is not valid JSON' };
    }

    const manifestRaw = projection.conceptManifest as string;
    if (!manifestRaw || typeof manifestRaw !== 'string') {
      return {
        variant: 'error',
        reason: 'projection.conceptManifest is required and must be a JSON string',
      };
    }

    let manifest: ConceptManifest;
    try {
      manifest = JSON.parse(manifestRaw) as ConceptManifest;
    } catch {
      return { variant: 'error', reason: 'conceptManifest is not valid JSON' };
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

    // --- Determine base path ---

    const kebabName = toKebabCase(manifest.name);
    const defaultBasePath = `/${kebabName}s`;
    const basePath = (config.path as string) || defaultBasePath;

    // --- Validate manifest has actions ---

    if (!manifest.actions || manifest.actions.length === 0) {
      return {
        variant: 'ok',
        files: [],
        routes: [],
      };
    }

    // --- Generate route file ---

    const { content, routes } = generateRoutesFile(manifest, overrides, basePath);

    const files: GeneratedFile[] = [
      {
        path: `${kebabName}/routes.ts`,
        content,
      },
    ];

    return {
      variant: 'ok',
      files,
      routes,
    };
  },
};
