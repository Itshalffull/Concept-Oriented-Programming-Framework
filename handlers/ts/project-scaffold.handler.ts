// ============================================================
// ProjectScaffold Handler
//
// Initialize new Clef projects with the standard directory
// structure, example concept specs, and configuration files.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `project-scaffold-${++idCounter}`;
}

export const projectScaffoldHandler: ConceptHandler = {
  async scaffold(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    // Check if a project with this name already exists
    const existing = await storage.find('project-scaffold', { name });
    if (existing.length > 0) {
      return { variant: 'alreadyExists', name };
    }

    const path = `./${name}/`;
    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('project-scaffold', id, {
      id,
      name,
      path,
      createdAt: now,
    });

    return { variant: 'ok', project: id, path };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetProjectScaffoldCounter(): void {
  idCounter = 0;
}
