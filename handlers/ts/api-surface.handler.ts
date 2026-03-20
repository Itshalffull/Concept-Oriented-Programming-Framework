// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ApiSurface Handler
//
// Compose generated interfaces from multiple concepts into a
// cohesive, unified API surface per target. For REST: a single
// router with concept-namespaced routes. For GraphQL: a merged
// schema with shared types. For CLI: a command tree with concept
// subcommands. For MCP: a combined tool set. For SDKs: a single
// client with concept-namespaced methods.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `api-surface-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

/**
 * Generate routes and entrypoint content for a given target. Pure helper.
 */
function buildSurface(
  suite: string,
  target: string,
  outputs: string[],
): {
  routes: Array<{ path: string; concept: string; action: string }>;
  sharedTypes: Array<{ name: string; usedBy: string[] }>;
  entrypoint: string;
  conflict?: string;
} {
  const routes: Array<{ path: string; concept: string; action: string }> = [];
  const sharedTypes: Array<{ name: string; usedBy: string[] }> = [];
  const seenPaths = new Map<string, string>();

  for (const output of outputs) {
    const conceptName = output.replace(/-output$/, '');

    let routePath: string;
    if (target === 'rest') {
      routePath = `/${suite}/${conceptName}`;
    } else if (target === 'graphql') {
      routePath = conceptName;
    } else if (target === 'cli') {
      routePath = `${suite} ${conceptName}`;
    } else if (target === 'mcp') {
      routePath = `${suite}/${conceptName}`;
    } else {
      routePath = `${suite}.${conceptName}`;
    }

    if (seenPaths.has(routePath)) {
      return { routes: [], sharedTypes: [], entrypoint: '', conflict: routePath };
    }
    seenPaths.set(routePath, conceptName);

    routes.push({ path: routePath, concept: conceptName, action: '*' });
  }

  let entrypoint: string;
  if (target === 'rest') {
    const routeLines = routes.map(r => `  router.use('${r.path}', ${r.concept}Router);`).join('\n');
    entrypoint = [
      `// Auto-generated REST surface for suite: ${suite}`,
      `import { Router } from 'express';`,
      ``,
      `const router = Router();`,
      routeLines,
      ``,
      `export default router;`,
    ].join('\n');
  } else if (target === 'graphql') {
    const typeLines = routes.map(r => `  # ${r.concept} types and queries`).join('\n');
    entrypoint = [
      `# Auto-generated GraphQL schema for suite: ${suite}`,
      `type Query {`,
      typeLines,
      `}`,
    ].join('\n');
  } else if (target === 'cli') {
    const cmdLines = routes.map(r => `  program.command('${r.concept}')`).join('\n');
    entrypoint = [
      `// Auto-generated CLI surface for suite: ${suite}`,
      `import { Command } from 'commander';`,
      `const program = new Command('${suite}');`,
      cmdLines,
      `export default program;`,
    ].join('\n');
  } else if (target === 'mcp') {
    const toolLines = routes.map(r => `  { name: '${r.path}', concept: '${r.concept}' }`).join(',\n');
    entrypoint = [
      `// Auto-generated MCP tool set for suite: ${suite}`,
      `export const tools = [`,
      toolLines,
      `];`,
    ].join('\n');
  } else {
    const methodLines = routes.map(r => `  ${r.concept}: ${r.concept}Client`).join(',\n');
    entrypoint = [
      `// Auto-generated SDK client for suite: ${suite}`,
      `export const client = {`,
      methodLines,
      `};`,
    ].join('\n');
  }

  return { routes, sharedTypes, entrypoint };
}

const _apiSurfaceHandler: FunctionalConceptHandler = {
  compose(input: Record<string, unknown>) {
    const suite = input.suite as string;
    const target = input.target as string;
    const outputs = input.outputs as string[];

    if (!Array.isArray(outputs) || outputs.length === 0) {
      const p = createProgram();
      return complete(p, 'conflictingRoutes', { target, conflicts: [] }) as StorageProgram<Result>;
    }

    const surface = buildSurface(suite, target, outputs);

    if (surface.conflict) {
      const p = createProgram();
      return complete(p, 'conflictingRoutes', {
        target,
        conflicts: [surface.conflict],
      }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'api-surface', id, {
      id,
      suite,
      target,
      concepts: JSON.stringify(outputs),
      entrypoint: surface.entrypoint,
      routes: JSON.stringify(surface.routes),
      sharedTypes: JSON.stringify(surface.sharedTypes),
      createdAt: now,
    });

    return complete(p, 'ok', {
      surface: id,
      entrypoint: surface.entrypoint,
      conceptCount: outputs.length,
    }) as StorageProgram<Result>;
  },

  entrypoint(input: Record<string, unknown>) {
    const surface = input.surface as string;

    let p = createProgram();
    p = get(p, 'api-surface', surface, 'record');

    return completeFrom(p, 'ok', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      if (!record) return { content: '' };
      return { content: record.entrypoint as string };
    }) as StorageProgram<Result>;
  },
};

export const apiSurfaceHandler = autoInterpret(_apiSurfaceHandler);

/** Reset the ID counter. Useful for testing. */
export function resetApiSurfaceCounter(): void {
  idCounter = 0;
}
