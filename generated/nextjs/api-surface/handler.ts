// ApiSurface — API surface area composition and tracking: assembles concept outputs into
// unified API surfaces, detects route conflicts, checks for cyclic dependencies,
// generates entrypoint code.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ApiSurfaceStorage,
  ApiSurfaceComposeInput,
  ApiSurfaceComposeOutput,
  ApiSurfaceEntrypointInput,
  ApiSurfaceEntrypointOutput,
} from './types.js';

import {
  composeOk,
  composeConflictingRoutes,
  composeCyclicDependency,
  entrypointOk,
} from './types.js';

export interface ApiSurfaceError {
  readonly code: string;
  readonly message: string;
}

export interface ApiSurfaceHandler {
  readonly compose: (
    input: ApiSurfaceComposeInput,
    storage: ApiSurfaceStorage,
  ) => TE.TaskEither<ApiSurfaceError, ApiSurfaceComposeOutput>;
  readonly entrypoint: (
    input: ApiSurfaceEntrypointInput,
    storage: ApiSurfaceStorage,
  ) => TE.TaskEither<ApiSurfaceError, ApiSurfaceEntrypointOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): ApiSurfaceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const detectRouteConflicts = (outputs: readonly string[]): readonly string[] => {
  // Parse each output as a route path and check for duplicates
  const routeMap = new Map<string, string[]>();

  for (const output of outputs) {
    // Extract the route path from the output identifier (format: "concept/operation")
    const route = output.split('/').slice(0, 2).join('/');
    const existing = routeMap.get(route) ?? [];
    existing.push(output);
    routeMap.set(route, existing);
  }

  const conflicts: string[] = [];
  for (const [route, sources] of routeMap.entries()) {
    if (sources.length > 1) {
      conflicts.push(`Route '${route}' defined by: ${sources.join(', ')}`);
    }
  }

  return conflicts;
};

const detectCyclicDependencies = (
  outputs: readonly string[],
  depGraph: Map<string, readonly string[]>,
): readonly string[] => {
  // DFS cycle detection on the dependency graph
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycle: string[] = [];

  const dfs = (node: string): boolean => {
    if (inStack.has(node)) {
      cycle.push(node);
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);

    const deps = depGraph.get(node) ?? [];
    for (const dep of deps) {
      if (dfs(dep)) {
        if (cycle.length > 0 && cycle[0] !== node) {
          cycle.push(node);
        }
        return true;
      }
    }

    inStack.delete(node);
    return false;
  };

  for (const output of outputs) {
    if (!visited.has(output)) {
      if (dfs(output)) break;
    }
  }

  return cycle;
};

// --- Implementation ---

export const apiSurfaceHandler: ApiSurfaceHandler = {
  compose: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept-outputs', { kit: input.kit }),
        toStorageError,
      ),
      TE.chain((existingOutputs) => {
        // Merge existing outputs with newly provided outputs
        const allOutputs = [
          ...existingOutputs.map((r) => String((r as Record<string, unknown>).path ?? '')),
          ...input.outputs,
        ];

        // Check for route conflicts
        const conflicts = detectRouteConflicts(allOutputs);
        if (conflicts.length > 0) {
          return TE.right(composeConflictingRoutes(
            input.target,
            conflicts,
          ) as ApiSurfaceComposeOutput);
        }

        // Build dependency graph from stored dependencies and check for cycles
        return pipe(
          TE.tryCatch(
            () => storage.find('concept-deps', { kit: input.kit }),
            toStorageError,
          ),
          TE.chain((depRecords) => {
            const depGraph = new Map<string, readonly string[]>();
            for (const dep of depRecords) {
              const d = dep as Record<string, unknown>;
              const source = String(d.source ?? '');
              const targets = Array.isArray(d.targets) ? d.targets.map(String) : [];
              depGraph.set(source, targets);
            }

            const cycle = detectCyclicDependencies(input.outputs, depGraph);
            if (cycle.length > 0) {
              return TE.right(composeCyclicDependency(
                input.target,
                cycle,
              ) as ApiSurfaceComposeOutput);
            }

            // Compose the API surface
            const surfaceId = `surface-${input.kit}-${input.target}-${Date.now()}`;
            const entrypointPath = `${input.target}/index.ts`;

            return pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('surfaces', surfaceId, {
                    surfaceId,
                    kit: input.kit,
                    target: input.target,
                    outputs: input.outputs,
                    entrypoint: entrypointPath,
                    conceptCount: input.outputs.length,
                    composedAt: new Date().toISOString(),
                  });

                  return composeOk(surfaceId, entrypointPath, input.outputs.length);
                },
                toStorageError,
              ),
            );
          }),
        );
      }),
    ),

  entrypoint: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('surfaces', input.surface),
        toStorageError,
      ),
      TE.chain((surfaceRecord) =>
        pipe(
          O.fromNullable(surfaceRecord),
          O.fold(
            () => TE.right(entrypointOk(
              `// Surface '${input.surface}' not found. Compose the surface first.\nexport {};\n`,
            )),
            (rec) => {
              const surface = rec as Record<string, unknown>;
              const outputs = Array.isArray(surface.outputs) ? surface.outputs.map(String) : [];
              const kit = String(surface.kit ?? 'unknown');
              const target = String(surface.target ?? 'unknown');

              // Generate the entrypoint that re-exports all concept outputs
              const lines: string[] = [
                `// API Surface entrypoint for kit '${kit}' targeting '${target}'`,
                `// Composed from ${outputs.length} concept outputs.`,
                ``,
              ];

              for (const output of outputs) {
                const moduleName = output.replace(/[^a-zA-Z0-9]/g, '_');
                lines.push(`export * as ${moduleName} from './${output}';`);
              }

              lines.push(``);

              return TE.right(entrypointOk(lines.join('\n')));
            },
          ),
        ),
      ),
    ),
};
