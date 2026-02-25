// ============================================================
// ApiSurface Concept Implementation (formerly Surface)
//
// Composes per-concept generated interfaces into cohesive,
// unified API surfaces per target. Merges routes, schemas,
// commands, and tools across concepts.
// Architecture doc: Interface Kit, Section 1.7
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';
import { randomUUID } from 'crypto';

// --- Internal Types ---

/** Route descriptor extracted from a concept's generated output. */
interface RouteEntry {
  path: string;
  method: string;
  concept: string;
  action: string;
}

/** Stored surface record persisted via ConceptStorage. */
interface SurfaceRecord {
  id: string;
  kit: string;
  target: string;
  outputs: string[];
  entrypoint: string;
  entrypointContent: string;
  conceptCount: number;
  routes: RouteEntry[];
}

// --- Target-to-Entrypoint Mapping ---

const TARGET_ENTRYPOINTS: Record<string, string> = {
  rest: 'router.ts',
  graphql: 'schema.ts',
  grpc: 'server.ts',
  cli: 'commands.ts',
  mcp: 'tools.ts',
};

// --- Route Extraction ---

/**
 * Extract route descriptors from a concept's output identifier.
 *
 * In a real system, each output string would reference generated code
 * from which routes, schemas, services, or commands can be parsed.
 * Here we derive a deterministic route entry per output so that
 * conflict detection can operate across concepts.
 */
function extractRoutes(output: string, target: string): RouteEntry[] {
  // Parse output identifier: expected format "conceptName-output"
  const conceptName = output.replace(/-output$/, '');

  switch (target) {
    case 'rest':
      return [
        { path: `/${conceptName}`, method: 'GET', concept: conceptName, action: 'list' },
        { path: `/${conceptName}`, method: 'POST', concept: conceptName, action: 'create' },
        { path: `/${conceptName}/:id`, method: 'GET', concept: conceptName, action: 'get' },
      ];
    case 'graphql':
      return [
        { path: `Query.${conceptName}`, method: 'query', concept: conceptName, action: 'resolve' },
        { path: `Mutation.${conceptName}`, method: 'mutation', concept: conceptName, action: 'mutate' },
      ];
    case 'grpc':
      return [
        { path: `${capitalize(conceptName)}Service`, method: 'rpc', concept: conceptName, action: 'serve' },
      ];
    case 'cli':
      return [
        { path: conceptName, method: 'command', concept: conceptName, action: 'execute' },
      ];
    case 'mcp':
      return [
        { path: `${conceptName}_list`, method: 'tool', concept: conceptName, action: 'list' },
        { path: `${conceptName}_get`, method: 'tool', concept: conceptName, action: 'get' },
      ];
    default:
      return [
        { path: `/${conceptName}`, method: 'GET', concept: conceptName, action: 'default' },
      ];
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Conflict Detection ---

/**
 * Detect conflicting routes: same path+method across different concepts.
 * Returns a list of human-readable conflict descriptions, empty if none.
 */
function detectConflicts(routes: RouteEntry[]): string[] {
  const seen = new Map<string, RouteEntry>();
  const conflicts: string[] = [];

  for (const route of routes) {
    const key = `${route.method}:${route.path}`;
    const existing = seen.get(key);
    if (existing && existing.concept !== route.concept) {
      conflicts.push(
        `${route.method} ${route.path} claimed by both "${existing.concept}" and "${route.concept}"`
      );
    } else {
      seen.set(key, route);
    }
  }

  return conflicts;
}

// --- Entrypoint Content Generation ---

/**
 * Generate the composed entrypoint file content for a given target.
 * Produces a representative source string that imports and wires
 * together all concept outputs into a single surface.
 */
function generateEntrypointContent(
  kit: string,
  target: string,
  outputs: string[],
  routes: RouteEntry[],
): string {
  const conceptNames = outputs.map(o => o.replace(/-output$/, ''));
  const header = `// Auto-generated entrypoint for kit "${kit}", target "${target}"\n`;

  switch (target) {
    case 'rest': {
      const imports = conceptNames
        .map(c => `import { ${c}Router } from './${c}/${c}.routes';`)
        .join('\n');
      const mounts = conceptNames
        .map(c => `  router.use('/${c}', ${c}Router);`)
        .join('\n');
      return (
        header +
        `import { Router } from 'express';\n` +
        `${imports}\n\n` +
        `const router = Router();\n\n` +
        `${mounts}\n\n` +
        `export default router;\n`
      );
    }

    case 'graphql': {
      const imports = conceptNames
        .map(c => `import { ${c}TypeDefs, ${c}Resolvers } from './${c}/${c}.schema';`)
        .join('\n');
      const typeDefs = conceptNames.map(c => `${c}TypeDefs`).join(', ');
      const resolvers = conceptNames.map(c => `${c}Resolvers`).join(', ');
      return (
        header +
        `import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';\n` +
        `${imports}\n\n` +
        `export const typeDefs = mergeTypeDefs([${typeDefs}]);\n` +
        `export const resolvers = mergeResolvers([${resolvers}]);\n`
      );
    }

    case 'grpc': {
      const imports = conceptNames
        .map(c => `import { ${capitalize(c)}Service } from './${c}/${c}.service';`)
        .join('\n');
      const services = conceptNames
        .map(c => `  server.addService(${capitalize(c)}Service);`)
        .join('\n');
      return (
        header +
        `import { Server } from '@grpc/grpc-js';\n` +
        `${imports}\n\n` +
        `const server = new Server();\n\n` +
        `${services}\n\n` +
        `export default server;\n`
      );
    }

    case 'cli': {
      const imports = conceptNames
        .map(c => `import { ${c}Command } from './${c}/${c}.command';`)
        .join('\n');
      const commands = conceptNames
        .map(c => `  program.addCommand(${c}Command);`)
        .join('\n');
      return (
        header +
        `import { Command } from 'commander';\n` +
        `${imports}\n\n` +
        `const program = new Command();\n\n` +
        `${commands}\n\n` +
        `export default program;\n`
      );
    }

    case 'mcp': {
      const imports = conceptNames
        .map(c => `import { ${c}Tools } from './${c}/${c}.tools';`)
        .join('\n');
      const tools = conceptNames.map(c => `...${c}Tools`).join(', ');
      return (
        header +
        `${imports}\n\n` +
        `export const tools = [${tools}];\n`
      );
    }

    default: {
      const imports = conceptNames
        .map(c => `import { ${c}Module } from './${c}/${c}.module';`)
        .join('\n');
      const modules = conceptNames.map(c => `${c}Module`).join(', ');
      return (
        header +
        `${imports}\n\n` +
        `export const modules = [${modules}];\n`
      );
    }
  }
}

// --- Concept Handler ---

export const surfaceHandler: ConceptHandler = {
  /**
   * compose: Merge per-concept generated outputs into a unified surface.
   *
   * Creates an entrypoint file path based on target type, checks for
   * conflicting routes across concepts, and stores the surface record.
   */
  async compose(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const kit = input.kit as string;
    const target = input.target as string;
    const outputs = input.outputs as string[];

    if (!kit || typeof kit !== 'string') {
      return { variant: 'conflictingRoutes', target: target ?? '', conflicts: ['kit is required'] };
    }
    if (!target || typeof target !== 'string') {
      return { variant: 'conflictingRoutes', target: '', conflicts: ['target is required'] };
    }
    if (!Array.isArray(outputs) || outputs.length === 0) {
      return { variant: 'conflictingRoutes', target, conflicts: ['outputs must be a non-empty list'] };
    }

    // Collect all routes across concept outputs
    const allRoutes: RouteEntry[] = [];
    for (const output of outputs) {
      const routes = extractRoutes(output, target);
      allRoutes.push(...routes);
    }

    // Detect conflicting routes (same path+method, different concepts)
    const conflicts = detectConflicts(allRoutes);
    if (conflicts.length > 0) {
      return { variant: 'conflictingRoutes', target, conflicts };
    }

    // Determine entrypoint filename from target type
    const entrypoint = TARGET_ENTRYPOINTS[target] ?? `${target}.ts`;

    // Generate composed entrypoint content
    const entrypointContent = generateEntrypointContent(kit, target, outputs, allRoutes);

    // Create and store the surface record
    const surfaceId = randomUUID();
    const surfaceRecord: SurfaceRecord = {
      id: surfaceId,
      kit,
      target,
      outputs,
      entrypoint,
      entrypointContent,
      conceptCount: outputs.length,
      routes: allRoutes,
    };

    await storage.put('surfaces', surfaceId, surfaceRecord as unknown as Record<string, unknown>);

    return {
      variant: 'ok',
      surface: surfaceId,
      entrypoint,
      conceptCount: outputs.length,
    };
  },

  /**
   * entrypoint: Load surface from storage and return composed entrypoint content.
   */
  async entrypoint(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const surfaceId = input.surface as string;

    if (!surfaceId || typeof surfaceId !== 'string') {
      return { variant: 'ok', content: '' };
    }

    const record = await storage.get('surfaces', surfaceId) as unknown as SurfaceRecord | null;
    if (!record) {
      return { variant: 'ok', content: '' };
    }

    return { variant: 'ok', content: record.entrypointContent };
  },
};
