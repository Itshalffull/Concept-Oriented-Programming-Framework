// @clef-handler style=functional
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
    p = branch(p,
      (bindings) => {
        const existing = bindings.existing as unknown[];
        return existing.length > 0;
      },
      (b) => {
        return completeFrom(b, 'alreadyRegistered', (bindings) => {
          const existing = bindings.existing as Array<Record<string, unknown>>;
          return { existing: existing[0].id };
        });
      },
      (b) => {
        const id = nextArtifactId();
        let b2 = put(b, 'artifact', id, {
          id,
          node,
          role,
          language,
          encoding,
          generationSource: '',
          schemaRef: '',
        });

        // Index by node path for fast lookup
        b2 = put(b2, 'artifact_by_node', node, { artifactId: id });

        return complete(b2, 'ok', { artifact: id });
      },
    );

    return p as StorageProgram<Result>;
  },

  setProvenance(input: Record<string, unknown>) {
    let p = createProgram();
    const artifactId = input.artifact as string;
    const spec = input.spec as string;
    const generator = input.generator as string;

    p = get(p, 'artifact', artifactId, 'data');
    p = branch(p, 'data',
      (b) => {
        let b2 = putFrom(b, 'artifact', artifactId, (bindings) => {
          const data = bindings.data as Record<string, unknown>;
          return {
            ...data,
            generationSource: JSON.stringify({ spec, generator }),
          };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<Result>;
  },

  findByRole(input: Record<string, unknown>) {
    let p = createProgram();
    const role = input.role as string;
    p = find(p, 'artifact', { role }, 'matches');
    return completeFrom(p, 'ok', (bindings) => {
      const matches = bindings.matches as Array<Record<string, unknown>>;
      return {
        artifacts: JSON.stringify(matches.map((m) => ({ id: m.id, node: m.node, role: m.role, language: m.language }))),
      };
    }) as StorageProgram<Result>;
  },

  findGeneratedFrom(input: Record<string, unknown>) {
    let p = createProgram();
    const spec = input.spec as string;
    p = find(p, 'artifact', {} as Record<string, unknown>, 'all');

    p = mapBindings(p, (bindings) => {
      const all = bindings.all as Array<Record<string, unknown>>;
      return all.filter((a) => {
        if (!a.generationSource) return false;
        try {
          const gs = JSON.parse(a.generationSource as string);
          return gs.spec === spec;
        } catch {
          return false;
        }
      });
    }, 'filtered');

    p = branch(p,
      (bindings) => {
        const filtered = bindings.filtered as unknown[];
        return filtered.length === 0;
      },
      (b) => complete(b, 'noGeneratedFiles', {}),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const filtered = bindings.filtered as Array<Record<string, unknown>>;
          return {
            artifacts: JSON.stringify(filtered.map((m) => ({ id: m.id, node: m.node, role: m.role }))),
          };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const artifactId = input.artifact as string;
    p = get(p, 'artifact', artifactId, 'data');
    p = branch(p, 'data',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.data as Record<string, unknown>;
          return {
            artifact: artifactId,
            node: data.node as string,
            role: data.role as string,
            language: data.language as string,
            encoding: data.encoding as string,
          };
        });
      },
      (b) => complete(b, 'notfound', { message: `Artifact ${artifactId} not found` }),
    );
    return p as StorageProgram<Result>;
  },
};

export const fileArtifactHandler = autoInterpret(_handler);

/** Reset the artifact counter. Useful for testing. */
export function resetArtifactCounter(): void {
  artifactCounter = 0;
}
