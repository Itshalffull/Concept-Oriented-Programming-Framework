// Publisher Concept Implementation (Package Distribution Suite)
// Package and upload modules to a registry. Manages the full publication
// lifecycle: artifact packaging, cryptographic signing, provenance
// attestation, SBOM generation, and registry upload.
import type { ConceptHandler } from '@clef/runtime';
import { createHash } from 'crypto';

let nextId = 1;
export function resetPublisherIds() { nextId = 1; }

export const publisherHandler: ConceptHandler = {
  async package(input, storage) {
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
      return { variant: 'invalid', errors: JSON.stringify(errors) };
    }

    // Compute content hash from source path and manifest
    const hashInput = [sourcePath, kind, manifest.module_id, manifest.version,
      ...manifest.dependencies].join('|');
    const artifactHash = createHash('sha256').update(hashInput).digest('hex');

    const id = `pub-${nextId++}`;

    await storage.put('publication', id, {
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

    return { variant: 'ok', publication: id };
  },

  async sign(input, storage) {
    const publication = input.publication as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

    // Simulate cryptographic signing - generate signature from artifact hash
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

  async attest(input, storage) {
    const publication = input.publication as string;
    const builder = input.builder as string;
    const sourceRepo = input.source_repo as string;
    const sourceCommit = input.source_commit as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

    const buildTimestamp = new Date().toISOString();

    // Compute SLSA level based on available attestation data
    let slsaLevel = 1;
    if (sourceRepo && sourceCommit) slsaLevel = 2;
    if (builder && sourceRepo && sourceCommit) slsaLevel = 3;

    const provenance = JSON.stringify({
      builder,
      source_repo: sourceRepo,
      source_commit: sourceCommit,
      build_timestamp: buildTimestamp,
      slsa_level: slsaLevel,
    });

    await storage.put('publication', publication, {
      ...pub,
      provenance,
      status: 'attested',
    });

    return { variant: 'ok' };
  },

  async generateSbom(input, storage) {
    const publication = input.publication as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

    const dependencies: string[] = JSON.parse(pub.dependencies as string || '[]');

    // Generate a placeholder SPDX-format SBOM
    const sbom = JSON.stringify({
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      name: pub.module_id as string,
      documentNamespace: `https://spdx.org/spdxdocs/${pub.module_id}-${pub.version}`,
      packages: [
        {
          name: pub.module_id as string,
          version: pub.version as string,
          downloadLocation: 'NOASSERTION',
          supplier: 'NOASSERTION',
        },
        ...dependencies.map(dep => ({
          name: dep,
          version: 'NOASSERTION',
          downloadLocation: 'NOASSERTION',
          supplier: 'NOASSERTION',
        })),
      ],
    });

    await storage.put('publication', publication, {
      ...pub,
      sbom,
    });

    return { variant: 'ok' };
  },

  async upload(input, storage) {
    const publication = input.publication as string;
    const registryUrl = input.registry_url as string;

    const pub = await storage.get('publication', publication);
    if (!pub) {
      return { variant: 'error', message: `Publication "${publication}" not found` };
    }

    // Check for duplicate: same module_id + version already published
    const allPublications = await storage.find('publication');
    for (const existing of allPublications) {
      if (existing.id !== publication &&
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
      published_at: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },
};
