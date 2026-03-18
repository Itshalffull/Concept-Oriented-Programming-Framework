// @migrated dsl-constructs 2026-03-18
// Surface Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _interfaceSurfaceHandler: FunctionalConceptHandler = {
  compose(input: Record<string, unknown>) {
    const kit = input.kit as string;
    const target = input.target as string;
    const outputs = JSON.parse(input.outputs as string) as string[];

    // Detect conflicting routes
    const routeMap = new Map<string, string>();
    const conflicts: string[] = [];
    for (const output of outputs) {
      const route = `/${output.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      if (routeMap.has(route)) {
        conflicts.push(`"${routeMap.get(route)}" and "${output}" both map to ${route}`);
      } else {
        routeMap.set(route, output);
      }
    }

    if (conflicts.length > 0) {
      const p = createProgram();
      return complete(p, 'conflictingRoutes', { target, conflicts: JSON.stringify(conflicts) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const entrypoint = outputs.map((o) => `export { ${o} } from './${o.toLowerCase()}';`).join('\n');
    const surfaceId = `surface-${kit}-${target}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'surface', surfaceId, {
      surfaceId, kit, target,
      concepts: JSON.stringify(outputs),
      entrypoint,
      routes: JSON.stringify([]),
      sharedTypes: JSON.stringify([]),
    });

    return complete(p, 'ok', {
      surface: surfaceId,
      entrypoint,
      conceptCount: outputs.length,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  entrypoint(input: Record<string, unknown>) {
    const surface = input.surface as string;

    let p = createProgram();
    p = spGet(p, 'surface', surface, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { content: '' }),
      (b) => complete(b, 'ok', { content: '' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const interfaceSurfaceHandler = autoInterpret(_interfaceSurfaceHandler);

