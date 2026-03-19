// Registry Concept Implementation
// Index of available module metadata with versioned artifacts, dependency edges,
// capability declarations, and compile-time feature definitions.
import type { ConceptHandler } from '@clef/runtime';

let nextId = 1;

/** Reset the ID counter (for testing). */
export function resetRegistryIds(): void {
  nextId = 1;
}

/**
 * Simplified semver range matching.
 * Supports ^x.y.z (compatible), ~x.y.z (patch-level), and exact x.y.z.
 */
function matchesSemverRange(version: string, range: string): boolean {
  const parse = (v: string) => {
    const parts = v.split('.').map(Number);
    return { major: parts[0] ?? 0, minor: parts[1] ?? 0, patch: parts[2] ?? 0 };
  };

  if (range === '*') return true;

  if (range.startsWith('^')) {
    const target = parse(range.slice(1));
    const v = parse(version);
    if (target.major !== 0) {
      return v.major === target.major &&
        (v.minor > target.minor || (v.minor === target.minor && v.patch >= target.patch));
    }
    // ^0.y.z: minor must match, patch >= target
    return v.major === 0 && v.minor === target.minor && v.patch >= target.patch;
  }

  if (range.startsWith('~')) {
    const target = parse(range.slice(1));
    const v = parse(version);
    return v.major === target.major && v.minor === target.minor && v.patch >= target.patch;
  }

  if (range.startsWith('>=')) {
    const target = parse(range.slice(2));
    const v = parse(version);
    if (v.major !== target.major) return v.major > target.major;
    if (v.minor !== target.minor) return v.minor > target.minor;
    return v.patch >= target.patch;
  }

  // Exact match
  return version === range;
}

export const registryHandler: ConceptHandler = {
  async publish(input, storage) {
    const name = input.name as string;
    const namespace = input.namespace as string;
    const version = input.version as string;
    const kind = input.kind as string;
    const artifactHash = input.artifact_hash as string;
    const dependencies = input.dependencies as Array<{
      module_id: string;
      version_range: string;
      edge_type: string;
      environment: string;
    }>;
    const metadata = input.metadata as {
      description: string;
      license: string;
      repository: string;
      authors: string[];
      keywords: string[];
    };

    // Validate artifact hash format
    if (!artifactHash || !artifactHash.includes(':')) {
      return { variant: 'invalid', message: 'Artifact hash must be in algorithm:digest format (e.g., sha256:abc)' };
    }

    // Validate required metadata fields
    if (!metadata || !metadata.description || !metadata.license) {
      return { variant: 'invalid', message: 'Metadata must include description and license fields' };
    }

    // Check uniqueness: name + namespace + version
    const existing = await storage.find('registryModule');
    for (const mod of existing) {
      if (mod.name === name && mod.namespace === namespace && mod.version === version) {
        return { variant: 'duplicate' };
      }
    }

    const moduleId = `mod-${nextId++}`;
    await storage.put('registryModule', moduleId, {
      moduleId,
      name,
      namespace,
      version,
      kind,
      artifactHash,
      dependencies: dependencies || [],
      capabilitiesProvided: (input.capabilities_provided as string[]) || [],
      capabilitiesRequired: (input.capabilities_required as string[]) || [],
      features: (input.features as unknown[]) || [],
      metadata,
      publishedAt: new Date().toISOString(),
      yanked: false,
    });

    return { variant: 'ok', module: moduleId };
  },

  async yank(input, storage) {
    const moduleId = input.module as string;

    const mod = await storage.get('registryModule', moduleId);
    if (!mod) {
      return { variant: 'notfound' };
    }

    await storage.put('registryModule', moduleId, { ...mod, yanked: true });
    return { variant: 'ok' };
  },

  async lookup(input, storage) {
    const name = input.name as string;
    const namespace = input.namespace as string;
    const versionRange = input.version_range as string;

    const allModules = await storage.find('registryModule');
    const candidates = allModules.filter(
      (m) => m.name === name && m.namespace === namespace && !m.yanked,
    );

    if (candidates.length === 0) {
      return { variant: 'notfound' };
    }

    const matched = candidates.filter((m) =>
      matchesSemverRange(m.version as string, versionRange),
    );

    if (matched.length === 0) {
      return { variant: 'notfound' };
    }

    // Sort by version descending
    matched.sort((a, b) => {
      const pa = (a.version as string).split('.').map(Number);
      const pb = (b.version as string).split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
      }
      return 0;
    });

    return { variant: 'ok', modules: matched.map((m) => m.moduleId as string) };
  },

  async search(input, storage) {
    const query = (input.query as string).toLowerCase();
    const kind = input.kind as string | undefined;
    const namespace = input.namespace as string | undefined;

    const allModules = await storage.find('registryModule');
    const results = allModules.filter((m) => {
      if (m.yanked) return false;
      if (kind && m.kind !== kind) return false;
      if (namespace && m.namespace !== namespace) return false;

      const name = (m.name as string).toLowerCase();
      const meta = m.metadata as { description: string; keywords: string[] };
      const description = (meta?.description || '').toLowerCase();
      const keywords = (meta?.keywords || []).map((k: string) => k.toLowerCase());

      return (
        name.includes(query) ||
        description.includes(query) ||
        keywords.some((k: string) => k.includes(query))
      );
    });

    return { variant: 'ok', modules: results.map((m) => m.moduleId as string) };
  },

  async listVersions(input, storage) {
    const name = input.name as string;
    const namespace = input.namespace as string;

    const allModules = await storage.find('registryModule');
    const matching = allModules.filter(
      (m) => m.name === name && m.namespace === namespace,
    );

    if (matching.length === 0) {
      return { variant: 'notfound' };
    }

    // Sort by version descending
    matching.sort((a, b) => {
      const pa = (a.version as string).split('.').map(Number);
      const pb = (b.version as string).split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
      }
      return 0;
    });

    return { variant: 'ok', versions: matching.map((m) => m.version as string) };
  },

  async resolveCapability(input, storage) {
    const capability = input.capability as string;

    const allModules = await storage.find('registryModule');
    const providers = allModules.filter((m) => {
      if (m.yanked) return false;
      const caps = m.capabilitiesProvided as string[];
      return caps && caps.includes(capability);
    });

    if (providers.length === 0) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', providers: providers.map((m) => m.moduleId as string) };
  },
};
