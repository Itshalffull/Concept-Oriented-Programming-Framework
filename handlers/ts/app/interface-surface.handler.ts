// Surface Concept Implementation (Interface Kit)
import type { ConceptHandler } from '@clef/kernel';

export const interfaceSurfaceHandler: ConceptHandler = {
  async compose(input, storage) {
    const kit = input.kit as string;
    const target = input.target as string;
    const outputs = JSON.parse(input.outputs as string) as string[];

    // Detect conflicting routes/commands/tool names
    const routeMap = new Map<string, string>();
    const conflicts: string[] = [];

    for (const output of outputs) {
      // Derive a route/path from the output name
      const route = `/${output.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      if (routeMap.has(route)) {
        conflicts.push(`"${routeMap.get(route)}" and "${output}" both map to ${route}`);
      } else {
        routeMap.set(route, output);
      }
    }

    if (conflicts.length > 0) {
      return {
        variant: 'conflictingRoutes',
        target,
        conflicts: JSON.stringify(conflicts),
      };
    }

    // Build composed surface based on target type
    let entrypoint = '';
    const routes: Array<{ path: string; concept: string; action: string }> = [];
    const sharedTypes: Array<{ name: string; usedBy: string[] }> = [];

    if (target === 'rest') {
      const routeLines: string[] = [];
      for (const output of outputs) {
        const basePath = `/${output.toLowerCase()}s`;
        routes.push({ path: basePath, concept: output, action: 'list' });
        routes.push({ path: `${basePath}/:id`, concept: output, action: 'get' });
        routeLines.push(`router.use('${basePath}', ${output}Router);`);
      }
      entrypoint = [
        `import { Router } from 'express';`,
        `const router = Router();`,
        ...routeLines,
        `export default router;`,
      ].join('\n');
    } else if (target === 'graphql') {
      const typeLines: string[] = [];
      const queryFields: string[] = [];
      for (const output of outputs) {
        typeLines.push(`type ${output} { id: ID! }`);
        queryFields.push(`  ${output.toLowerCase()}s: [${output}!]!`);
        sharedTypes.push({ name: output, usedBy: [output] });
      }
      entrypoint = [
        ...typeLines,
        '',
        'type Query {',
        ...queryFields,
        '}',
      ].join('\n');
    } else if (target === 'cli') {
      const commandLines: string[] = [];
      for (const output of outputs) {
        commandLines.push(`program.command('${output.toLowerCase()}').description('${output} operations');`);
      }
      entrypoint = [
        `import { Command } from 'commander';`,
        `const program = new Command();`,
        `program.name('${kit}').description('${kit} CLI');`,
        ...commandLines,
        `program.parse();`,
      ].join('\n');
    } else if (target === 'mcp') {
      const toolLines: string[] = [];
      for (const output of outputs) {
        toolLines.push(`server.addTool('${output.toLowerCase()}', ${output}Tool);`);
      }
      entrypoint = [
        `const server = new McpServer();`,
        ...toolLines,
        `export default server;`,
      ].join('\n');
    } else if (target === 'grpc') {
      const serviceLines: string[] = [];
      for (const output of outputs) {
        serviceLines.push(`service ${output}Service {`);
        serviceLines.push(`  rpc List(Empty) returns (${output}List);`);
        serviceLines.push(`  rpc Get(${output}Id) returns (${output});`);
        serviceLines.push(`}`);
      }
      entrypoint = [
        `syntax = "proto3";`,
        `package ${kit};`,
        '',
        ...serviceLines,
      ].join('\n');
    } else {
      // Generic entrypoint
      entrypoint = outputs.map((o) => `export { ${o} } from './${o.toLowerCase()}';`).join('\n');
    }

    const surfaceId = `surface-${kit}-${target}-${Date.now()}`;

    await storage.put('surface', surfaceId, {
      surfaceId,
      kit,
      target,
      concepts: JSON.stringify(outputs),
      entrypoint,
      routes: JSON.stringify(routes),
      sharedTypes: JSON.stringify(sharedTypes),
    });

    return {
      variant: 'ok',
      surface: surfaceId,
      entrypoint,
      conceptCount: outputs.length,
    };
  },

  async entrypoint(input, storage) {
    const surface = input.surface as string;

    const existing = await storage.get('surface', surface);
    if (!existing) {
      return { variant: 'ok', content: '' };
    }

    return { variant: 'ok', content: existing.entrypoint as string };
  },
};
