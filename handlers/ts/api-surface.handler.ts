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

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `api-surface-${++idCounter}`;
}

export const apiSurfaceHandler: ConceptHandler = {
  async compose(input: Record<string, unknown>, storage: ConceptStorage) {
    const kit = input.kit as string;
    const target = input.target as string;
    const outputs = input.outputs as string[];

    if (!Array.isArray(outputs) || outputs.length === 0) {
      return { variant: 'conflictingRoutes', target, conflicts: [] };
    }

    // Build route/schema/command entries per concept output
    const routes: Array<{ path: string; concept: string; action: string }> = [];
    const sharedTypes: Array<{ name: string; usedBy: string[] }> = [];
    const seenPaths = new Map<string, string>();

    for (const output of outputs) {
      // Derive concept name from the output identifier (e.g. "todo-output" -> "todo")
      const conceptName = output.replace(/-output$/, '');

      let routePath: string;
      if (target === 'rest') {
        routePath = `/${kit}/${conceptName}`;
      } else if (target === 'graphql') {
        routePath = conceptName;
      } else if (target === 'cli') {
        routePath = `${kit} ${conceptName}`;
      } else if (target === 'mcp') {
        routePath = `${kit}/${conceptName}`;
      } else {
        routePath = `${kit}.${conceptName}`;
      }

      // Check for route conflicts
      if (seenPaths.has(routePath)) {
        return {
          variant: 'conflictingRoutes',
          target,
          conflicts: [routePath],
        };
      }
      seenPaths.set(routePath, conceptName);

      routes.push({ path: routePath, concept: conceptName, action: '*' });
    }

    // Generate the entrypoint content based on target
    let entrypoint: string;
    if (target === 'rest') {
      const routeLines = routes.map(r => `  router.use('${r.path}', ${r.concept}Router);`).join('\n');
      entrypoint = [
        `// Auto-generated REST surface for kit: ${kit}`,
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
        `# Auto-generated GraphQL schema for kit: ${kit}`,
        `type Query {`,
        typeLines,
        `}`,
      ].join('\n');
    } else if (target === 'cli') {
      const cmdLines = routes.map(r => `  program.command('${r.concept}')`).join('\n');
      entrypoint = [
        `// Auto-generated CLI surface for kit: ${kit}`,
        `import { Command } from 'commander';`,
        `const program = new Command('${kit}');`,
        cmdLines,
        `export default program;`,
      ].join('\n');
    } else if (target === 'mcp') {
      const toolLines = routes.map(r => `  { name: '${r.path}', concept: '${r.concept}' }`).join(',\n');
      entrypoint = [
        `// Auto-generated MCP tool set for kit: ${kit}`,
        `export const tools = [`,
        toolLines,
        `];`,
      ].join('\n');
    } else {
      const methodLines = routes.map(r => `  ${r.concept}: ${r.concept}Client`).join(',\n');
      entrypoint = [
        `// Auto-generated SDK client for kit: ${kit}`,
        `export const client = {`,
        methodLines,
        `};`,
      ].join('\n');
    }

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('api-surface', id, {
      id,
      kit,
      target,
      concepts: JSON.stringify(outputs),
      entrypoint,
      routes: JSON.stringify(routes),
      sharedTypes: JSON.stringify(sharedTypes),
      createdAt: now,
    });

    return {
      variant: 'ok',
      surface: id,
      entrypoint,
      conceptCount: outputs.length,
    };
  },

  async entrypoint(input: Record<string, unknown>, storage: ConceptStorage) {
    const surface = input.surface as string;

    const record = await storage.get('api-surface', surface);
    if (!record) {
      return { variant: 'ok', content: '' };
    }

    return { variant: 'ok', content: record.entrypoint as string };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetApiSurfaceCounter(): void {
  idCounter = 0;
}
