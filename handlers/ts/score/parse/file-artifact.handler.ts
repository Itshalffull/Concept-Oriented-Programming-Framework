// ============================================================
// FileArtifact Handler
//
// Registers project files with role, language, and provenance
// metadata. Uses file-role-inference for auto-classification.
//
// See design doc Section 4.1 (FileArtifact).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';
import { inferLanguage, inferRole } from './file-role-inference.js';

let artifactCounter = 0;
function nextArtifactId(): string {
  return `artifact-${++artifactCounter}`;
}

export const fileArtifactHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const node = input.node as string;
    const role = (input.role as string) || inferRole(node);
    const language = (input.language as string) || inferLanguage(node) || '';
    const encoding = (input.encoding as string) || 'utf-8';

    // Check for duplicate registration by file path
    const existing = await storage.find('artifact', { node });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id };
    }

    const id = nextArtifactId();
    await storage.put('artifact', id, {
      id,
      node,
      role,
      language,
      encoding,
      generationSource: '',
      schemaRef: '',
    });

    // Index by node path for fast lookup
    await storage.put('artifact_by_node', node, { artifactId: id });

    return { variant: 'ok', artifact: id };
  },

  async setProvenance(input: Record<string, unknown>, storage: ConceptStorage) {
    const artifactId = input.artifact as string;
    const spec = input.spec as string;
    const generator = input.generator as string;

    const data = await storage.get('artifact', artifactId);
    if (!data) {
      return { variant: 'notfound' };
    }

    await storage.put('artifact', artifactId, {
      ...data,
      generationSource: JSON.stringify({ spec, generator }),
    });

    return { variant: 'ok' };
  },

  async findByRole(input: Record<string, unknown>, storage: ConceptStorage) {
    const role = input.role as string;
    const matches = await storage.find('artifact', { role });
    return {
      variant: 'ok',
      artifacts: JSON.stringify(matches.map((m) => ({ id: m.id, node: m.node, role: m.role, language: m.language }))),
    };
  },

  async findGeneratedFrom(input: Record<string, unknown>, storage: ConceptStorage) {
    const spec = input.spec as string;
    const all = await storage.find('artifact');
    const matches = all.filter((a) => {
      if (!a.generationSource) return false;
      try {
        const gs = JSON.parse(a.generationSource as string);
        return gs.spec === spec;
      } catch {
        return false;
      }
    });

    if (matches.length === 0) {
      return { variant: 'noGeneratedFiles' };
    }

    return {
      variant: 'ok',
      artifacts: JSON.stringify(matches.map((m) => ({ id: m.id, node: m.node, role: m.role }))),
    };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const artifactId = input.artifact as string;
    const data = await storage.get('artifact', artifactId);
    if (!data) {
      return { variant: 'notfound', message: `Artifact ${artifactId} not found` };
    }
    return {
      variant: 'ok',
      artifact: artifactId,
      node: data.node as string,
      role: data.role as string,
      language: data.language as string,
      encoding: data.encoding as string,
    };
  },
};

/** Reset the artifact counter. Useful for testing. */
export function resetArtifactCounter(): void {
  artifactCounter = 0;
}
