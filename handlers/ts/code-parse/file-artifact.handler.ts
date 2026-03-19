// @migrated dsl-constructs 2026-03-18
// ============================================================
// FileArtifact Handler
//
// Registers project files with role, language, and provenance
// metadata. Uses file-role-inference for auto-classification.
//
// See design doc Section 4.1 (FileArtifact).
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { inferLanguage, inferRole } from './file-role-inference.js';

let artifactCounter = 0;
function nextArtifactId(): string {
  return `artifact-${++artifactCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    let p = createProgram();
    const node = input.node as string;
    const role = (input.role as string) || inferRole(node);
    const language = (input.language as string) || inferLanguage(node) || '';
    const encoding = (input.encoding as string) || 'utf-8';

    // Check for duplicate registration by file path
    p = find(p, 'artifact', { node }, 'existing');
    if (existing.length > 0) {
      return complete(p, 'alreadyRegistered', { existing: existing[0].id }) as StorageProgram<Result>;
    }

    const id = nextArtifactId();
    p = put(p, 'artifact', id, {
      id,
      node,
      role,
      language,
      encoding,
      generationSource: '',
      schemaRef: '',
    });

    // Index by node path for fast lookup
    p = put(p, 'artifact_by_node', node, { artifactId: id });

    return complete(p, 'ok', { artifact: id }) as StorageProgram<Result>;
  },

  setProvenance(input: Record<string, unknown>) {
    let p = createProgram();
    const artifactId = input.artifact as string;
    const spec = input.spec as string;
    const generator = input.generator as string;

    p = get(p, 'artifact', artifactId, 'data');
    if (!data) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    p = put(p, 'artifact', artifactId, {
      ...data,
      generationSource: JSON.stringify({ spec, generator }),
    });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  findByRole(input: Record<string, unknown>) {
    let p = createProgram();
    const role = input.role as string;
    p = find(p, 'artifact', { role }, 'matches');
    return complete(p, 'ok', {
      artifacts: JSON.stringify(matches.map((m) => ({ id: m.id, node: m.node, role: m.role, language: m.language }))),
    }) as StorageProgram<Result>;
  },

  findGeneratedFrom(input: Record<string, unknown>) {
    let p = createProgram();
    const spec = input.spec as string;
    p = find(p, 'artifact', 'all');
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
      return complete(p, 'noGeneratedFiles', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', {
      artifacts: JSON.stringify(matches.map((m) => ({ id: m.id, node: m.node, role: m.role }))),
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const artifactId = input.artifact as string;
    p = get(p, 'artifact', artifactId, 'data');
    if (!data) {
      return complete(p, 'notfound', { message: `Artifact ${artifactId} not found` }) as StorageProgram<Result>;
    }
    return complete(p, 'ok', {
      artifact: artifactId,
      node: data.node as string,
      role: data.role as string,
      language: data.language as string,
      encoding: data.encoding as string,
    }) as StorageProgram<Result>;
  },
};

export const fileArtifactHandler = autoInterpret(_handler);

/** Reset the artifact counter. Useful for testing. */
export function resetArtifactCounter(): void {
  artifactCounter = 0;
}
