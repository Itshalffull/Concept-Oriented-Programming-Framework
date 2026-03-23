// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ProjectScaffold Handler
//
// Initialize new Clef projects with the standard directory
// structure, example concept specs, and configuration files.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `project-scaffold-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _projectScaffoldHandler: FunctionalConceptHandler = {
  scaffold(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    // Check if a project with this name already exists
    p = find(p, 'project-scaffold', { name }, 'existing');
    p = mapBindings(p, (bindings) => {
      const results = (bindings.existing as Array<Record<string, unknown>>) || [];
      return results.length;
    }, 'existingCount');

    p = branch(p,
      (bindings) => (bindings.existingCount as number) > 0,
      (b) => complete(b, 'ok', { name }),
      (b) => {
        const path = `./${name}/`;
        const id = nextId();
        const now = new Date().toISOString();
        let b2 = put(b, 'project-scaffold', id, {
          id,
          name,
          path,
          createdAt: now,
        });
        return complete(b2, 'ok', { project: id, path });
      },
    );
    return p as StorageProgram<Result>;
  },
};

export const projectScaffoldHandler = autoInterpret(_projectScaffoldHandler);

/** Reset the ID counter. Useful for testing. */
export function resetProjectScaffoldCounter(): void {
  idCounter = 0;
}
