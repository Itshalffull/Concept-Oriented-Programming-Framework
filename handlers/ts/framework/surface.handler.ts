// @migrated dsl-constructs 2026-03-18
// ============================================================
// ApiSurface Concept Implementation (formerly Surface)
//
// Composes per-concept generated interfaces into cohesive,
// unified API surfaces per target.
// Architecture doc: Clef Bind, Section 1.7
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';
import { toKebabCase, toCamelCase } from './providers/codegen-utils.js';

type Result = { variant: string; [key: string]: unknown };

interface RouteEntry { path: string; method: string; concept: string; action: string; }

const TARGET_ENTRYPOINTS: Record<string, string> = { rest: 'router.ts', graphql: 'schema.ts', grpc: 'server.ts', cli: 'commands.ts', mcp: 'tools.ts' };

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function extractRoutes(output: string, target: string): RouteEntry[] {
  const conceptName = output.replace(/-output$/, '');
  switch (target) {
    case 'rest': return [{ path: `/${conceptName}`, method: 'GET', concept: conceptName, action: 'list' }, { path: `/${conceptName}`, method: 'POST', concept: conceptName, action: 'create' }, { path: `/${conceptName}/:id`, method: 'GET', concept: conceptName, action: 'get' }];
    case 'graphql': return [{ path: `Query.${conceptName}`, method: 'query', concept: conceptName, action: 'resolve' }, { path: `Mutation.${conceptName}`, method: 'mutation', concept: conceptName, action: 'mutate' }];
    case 'grpc': return [{ path: `${capitalize(conceptName)}Service`, method: 'rpc', concept: conceptName, action: 'serve' }];
    case 'cli': return [{ path: conceptName, method: 'command', concept: conceptName, action: 'execute' }];
    case 'mcp': return [{ path: `${conceptName}_list`, method: 'tool', concept: conceptName, action: 'list' }, { path: `${conceptName}_get`, method: 'tool', concept: conceptName, action: 'get' }];
    default: return [{ path: `/${conceptName}`, method: 'GET', concept: conceptName, action: 'default' }];
  }
}

function detectConflicts(routes: RouteEntry[]): string[] {
  const seen = new Map<string, RouteEntry>();
  const conflicts: string[] = [];
  for (const route of routes) {
    const key = `${route.method}:${route.path}`;
    const existing = seen.get(key);
    if (existing && existing.concept !== route.concept) conflicts.push(`${route.method} ${route.path} claimed by both "${existing.concept}" and "${route.concept}"`);
    else seen.set(key, route);
  }
  return conflicts;
}

function generateEntrypointContent(suite: string, target: string, outputs: string[], _routes: RouteEntry[]): string {
  const conceptNames = outputs.map(o => o.replace(/-output$/, ''));
  const header = `// Auto-generated entrypoint for suite "${suite}", target "${target}"\n`;

  // MCP target: generate a boot script that starts the MCP server
  if (target === 'mcp') {
    return header +
      `import { bootMcpServer } from '../../handlers/ts/framework/mcp-server.handler';\n\n` +
      `const manifestPath = process.argv[2];\n` +
      `if (!manifestPath) {\n` +
      `  console.error('Usage: tsx <entrypoint> <manifest-path>');\n` +
      `  process.exit(1);\n` +
      `}\n\n` +
      `await bootMcpServer(manifestPath);\n`;
  }

  // Default: simplified module-based entrypoint
  const imports = conceptNames.map(c => `import { ${toCamelCase(c)}Module } from './${toKebabCase(c)}/${toKebabCase(c)}.module';`).join('\n');
  const modules = conceptNames.map(c => `${toCamelCase(c)}Module`).join(', ');
  return header + `${imports}\n\nexport const modules = [${modules}];\n`;
}

const _handler: FunctionalConceptHandler = {
  compose(input: Record<string, unknown>) {
    const suite = input.suite as string;
    const target = input.target as string;
    const outputs = input.outputs as string[];

    if (!suite || typeof suite !== 'string') { const p = createProgram(); return complete(p, 'conflictingRoutes', { target: target ?? '', conflicts: ['suite is required'] }) as StorageProgram<Result>; }
    if (!target || typeof target !== 'string') { const p = createProgram(); return complete(p, 'conflictingRoutes', { target: '', conflicts: ['target is required'] }) as StorageProgram<Result>; }
    if (!Array.isArray(outputs) || outputs.length === 0) { const p = createProgram(); return complete(p, 'conflictingRoutes', { target, conflicts: ['outputs must be a non-empty list'] }) as StorageProgram<Result>; }

    const allRoutes: RouteEntry[] = [];
    for (const output of outputs) allRoutes.push(...extractRoutes(output, target));

    const conflicts = detectConflicts(allRoutes);
    if (conflicts.length > 0) { const p = createProgram(); return complete(p, 'conflictingRoutes', { target, conflicts }) as StorageProgram<Result>; }

    const entrypoint = TARGET_ENTRYPOINTS[target] ?? `${target}.ts`;
    const entrypointContent = generateEntrypointContent(suite, target, outputs, allRoutes);
    const surfaceId = randomUUID();

    let p = createProgram();
    p = put(p, 'surfaces', surfaceId, { id: surfaceId, suite, target, outputs, entrypoint, entrypointContent, conceptCount: outputs.length, routes: allRoutes } as unknown as Record<string, unknown>);

    return complete(p, 'ok', { surface: surfaceId, entrypoint, conceptCount: outputs.length }) as StorageProgram<Result>;
  },

  entrypoint(input: Record<string, unknown>) {
    const surfaceId = input.surface as string;
    if (!surfaceId || typeof surfaceId !== 'string') { const p = createProgram(); return complete(p, 'ok', { content: '' }) as StorageProgram<Result>; }

    let p = createProgram();
    p = get(p, 'surfaces', surfaceId, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return { content: record.entrypointContent as string };
      }),
      (elseP) => complete(elseP, 'ok', { content: '' }),
    ) as StorageProgram<Result>;
  },
};

export const surfaceHandler = autoInterpret(_handler);
