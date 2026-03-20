// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Publisher Concept Implementation (Package Distribution Suite)
// Package and upload modules to a registry. Manages the full publication
// lifecycle: artifact packaging, cryptographic signing, provenance
// attestation, SBOM generation, and registry upload.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';
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
};

const baseHandler = autoInterpret(_handler);

// sign, attest, generateSbom, upload need imperative style to merge publication records
const handler: ConceptHandler = {
  ...baseHandler,

  async sign(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

    const artifactHash = pub.artifact_hash as string;
    const signature = createHash('sha256')
      .update(`sig:${artifactHash}`)
      .digest('hex');

    await storage.put('publication', publication, {
      ...pub,
      signature,
      status: 'signed',
    });

    return { variant: 'ok' };
  },

  async attest(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;
    const builder = input.builder as string;
    const sourceRepo = input.source_repo as string;
    const sourceCommit = input.source_commit as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

    const provenance = JSON.stringify({
      builder,
      source_repo: sourceRepo,
      source_commit: sourceCommit,
      slsa_level: 2,
      timestamp: new Date().toISOString(),
    });

    await storage.put('publication', publication, {
      ...pub,
      provenance,
    });

    return { variant: 'ok' };
  },

  async generateSbom(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

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

    await storage.put('publication', publication, {
      ...pub,
      sbom,
    });

    return { variant: 'ok' };
  },

  async upload(input: Record<string, unknown>, storage: ConceptStorage) {
    const publication = input.publication as string;
    const registryUrl = input.registry_url as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

    // Check for duplicate published version
    const allPubs = await storage.find('publication', {});
    for (const existing of allPubs) {
      if (existing._key !== publication &&
          existing.module_id === pub.module_id &&
          existing.version === pub.version &&
          existing.status === 'published') {
        return { variant: 'duplicate', existing_version: existing.version as string };
      }
    }

    await storage.put('publication', publication, {
      ...pub,
      status: 'published',
      registry_url: registryUrl,
    });

    return { variant: 'ok' };
  },
};

export const publisherHandler = handler as FunctionalConceptHandler & ConceptHandler;
