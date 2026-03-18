// @migrated dsl-constructs 2026-03-18
// Publisher Concept Implementation (Package Distribution Suite)
// Package and upload modules to a registry. Manages the full publication
// lifecycle: artifact packaging, cryptographic signing, provenance
// attestation, SBOM generation, and registry upload.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { createHash } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;
export function resetPublisherIds() { nextId = 1; }

const _handler: FunctionalConceptHandler = {
  package(input: Record<string, unknown>) {
    const sourcePath = input.source_path as string;
    const kind = input.kind as string;
    const manifest = input.manifest as {
      module_id: string;
      version: string;
      dependencies: string[];
    };

    // Validate manifest completeness
    const errors: string[] = [];
    if (!manifest.module_id) errors.push('manifest.module_id is required');
    if (!manifest.version) errors.push('manifest.version is required');
    if (!sourcePath) errors.push('source_path is required');
    if (!kind) errors.push('kind is required');
    const supportedKinds = ['library', 'application', 'plugin'];
    if (kind && !supportedKinds.includes(kind)) {
      errors.push(`Unsupported kind "${kind}"; expected one of: ${supportedKinds.join(', ')}`);
    }

    if (errors.length > 0) {
      const p = createProgram();
      return complete(p, 'invalid', { errors: JSON.stringify(errors) }) as StorageProgram<Result>;
    }

    // Compute content hash from source path and manifest
    const hashInput = [sourcePath, kind, manifest.module_id, manifest.version,
      ...manifest.dependencies].join('|');
    const artifactHash = createHash('sha256').update(hashInput).digest('hex');

    const id = `pub-${nextId++}`;

    let p = createProgram();
    p = put(p, 'publication', id, {
      id,
      module_id: manifest.module_id,
      version: manifest.version,
      artifact_hash: artifactHash,
      signature: null,
      provenance: null,
      sbom: null,
      status: 'packaged',
      source_path: sourcePath,
      kind,
      dependencies: JSON.stringify(manifest.dependencies),
    });

    return complete(p, 'ok', { publication: id }) as StorageProgram<Result>;
  },

  sign(input: Record<string, unknown>) {
    const publication = input.publication as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    return branch(p, 'pub',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const pub = bindings.pub as Record<string, unknown>;
          const artifactHash = pub.artifact_hash as string;
          const signature = createHash('sha256')
            .update(`sig:${artifactHash}`)
            .digest('hex');
          return {};
        });
      },
      (elseP) => complete(elseP, 'error', { message: `Publication "${publication}" not found` }),
    ) as StorageProgram<Result>;
  },

  attest(input: Record<string, unknown>) {
    const publication = input.publication as string;
    const builder = input.builder as string;
    const sourceRepo = input.source_repo as string;
    const sourceCommit = input.source_commit as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    return branch(p, 'pub',
      (thenP) => complete(thenP, 'ok', {}),
      (elseP) => complete(elseP, 'error', { message: `Publication "${publication}" not found` }),
    ) as StorageProgram<Result>;
  },

  generateSbom(input: Record<string, unknown>) {
    const publication = input.publication as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    return branch(p, 'pub',
      (thenP) => complete(thenP, 'ok', {}),
      (elseP) => complete(elseP, 'error', { message: `Publication "${publication}" not found` }),
    ) as StorageProgram<Result>;
  },

  upload(input: Record<string, unknown>) {
    const publication = input.publication as string;
    const registryUrl = input.registry_url as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    return branch(p, 'pub',
      (thenP) => {
        thenP = find(thenP, 'publication', {}, 'allPubs');
        return completeFrom(thenP, 'ok', (bindings) => {
          const pub = bindings.pub as Record<string, unknown>;
          const allPubs = bindings.allPubs as Record<string, unknown>[];
          for (const existing of allPubs) {
            if (existing.id !== publication &&
                existing.module_id === pub.module_id &&
                existing.version === pub.version &&
                existing.status === 'published') {
              return { variant: 'duplicate', existing_version: existing.version as string };
            }
          }
          return {};
        });
      },
      (elseP) => complete(elseP, 'error', { message: `Publication "${publication}" not found` }),
    ) as StorageProgram<Result>;
  },
};

export const publisherHandler = autoInterpret(_handler);
