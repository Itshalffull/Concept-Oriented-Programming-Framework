// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Publisher Concept Implementation (Package Distribution Suite)
// Package and upload modules to a registry. Manages the full publication
// lifecycle: artifact packaging, cryptographic signing, provenance
// attestation, SBOM generation, and registry upload.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  putFrom, traverse, type StorageProgram,
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

  /**
   * Sign a publication's artifact. Gets the publication, computes a
   * signature from the artifact hash, and updates the record.
   */
  sign(input: Record<string, unknown>) {
    const publication = input.publication as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    p = branch(p, 'pub',
      (b) => {
        let b2 = putFrom(b, 'publication', publication, (bindings) => {
          const pub = bindings.pub as Record<string, unknown>;
          const artifactHash = pub.artifact_hash as string;
          const signature = createHash('sha256')
            .update(`sig:${artifactHash}`)
            .digest('hex');
          return { ...pub, signature, status: 'signed' };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'error', { message: `Publication "${publication}" not found` }),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Attest provenance for a publication. Records builder, source repo,
   * and commit information on the publication record.
   */
  attest(input: Record<string, unknown>) {
    const publication = input.publication as string;
    const builder = input.builder as string;
    const sourceRepo = input.source_repo as string;
    const sourceCommit = input.source_commit as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    p = branch(p, 'pub',
      (b) => {
        let b2 = putFrom(b, 'publication', publication, (bindings) => {
          const pub = bindings.pub as Record<string, unknown>;
          const provenance = JSON.stringify({
            builder,
            source_repo: sourceRepo,
            source_commit: sourceCommit,
            slsa_level: 2,
            timestamp: new Date().toISOString(),
          });
          return { ...pub, provenance };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'error', { message: `Publication "${publication}" not found` }),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Generate an SBOM for a publication. Reads the publication's dependencies
   * and constructs an SPDX-2.3 SBOM stored on the record.
   */
  generateSbom(input: Record<string, unknown>) {
    const publication = input.publication as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    p = branch(p, 'pub',
      (b) => {
        let b2 = putFrom(b, 'publication', publication, (bindings) => {
          const pub = bindings.pub as Record<string, unknown>;
          const dependencies = JSON.parse(pub.dependencies as string || '[]');
          const sbom = JSON.stringify({
            spdxVersion: 'SPDX-2.3',
            dataLicense: 'CC0-1.0',
            name: pub.module_id as string,
            packages: [
              {
                name: pub.module_id as string,
                version: pub.version as string,
                downloadLocation: pub.source_path as string,
              },
              ...dependencies.map((dep: string) => ({
                name: dep,
                version: '*',
                downloadLocation: 'NOASSERTION',
              })),
            ],
          });
          return { ...pub, sbom };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'error', { message: `Publication "${publication}" not found` }),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Upload a publication to a registry. Checks for duplicate published
   * versions using traverse over all publications, then marks the
   * publication as published.
   */
  upload(input: Record<string, unknown>) {
    const publication = input.publication as string;
    const registryUrl = input.registry_url as string;

    let p = createProgram();
    p = get(p, 'publication', publication, 'pub');

    p = branch(p, 'pub',
      (b) => {
        // Find all publications to check for duplicates
        let b2 = find(b, 'publication', {}, 'allPubs');

        // Check for duplicate published version
        b2 = mapBindings(b2, (bindings) => {
          const pub = bindings.pub as Record<string, unknown>;
          const allPubs = bindings.allPubs as Array<Record<string, unknown>>;
          for (const existing of allPubs) {
            if ((existing._key as string) !== publication &&
                existing.module_id === pub.module_id &&
                existing.version === pub.version &&
                existing.status === 'published') {
              return { isDuplicate: true, existingVersion: existing.version as string };
            }
          }
          return { isDuplicate: false, existingVersion: null };
        }, '_dupCheck');

        return branch(b2,
          (bindings) => {
            const dupCheck = bindings._dupCheck as Record<string, unknown>;
            return dupCheck.isDuplicate as boolean;
          },
          (t) => completeFrom(t, 'duplicate', (bindings) => {
            const dupCheck = bindings._dupCheck as Record<string, unknown>;
            return { existing_version: dupCheck.existingVersion as string };
          }),
          (e) => {
            let e2 = putFrom(e, 'publication', publication, (bindings) => {
              const pub = bindings.pub as Record<string, unknown>;
              return { ...pub, status: 'published', registry_url: registryUrl };
            });
            return complete(e2, 'ok', {});
          },
        );
      },
      (b) => complete(b, 'error', { message: `Publication "${publication}" not found` }),
    );

    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const publisherHandler = autoInterpret(_handler);
