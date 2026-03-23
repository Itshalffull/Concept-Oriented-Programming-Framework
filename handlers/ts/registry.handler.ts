// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Registry Concept Implementation
// Index of available module metadata with versioned artifacts, dependency edges,
// capability declarations, and compile-time feature definitions.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

const _handler: FunctionalConceptHandler = {
  lookup(input: Record<string, unknown>) {
    const name = input.name as string;
    const namespace = input.namespace as string;
    const versionRange = input.version_range as string;

    let p = createProgram();
    p = find(p, 'registryModule', {}, 'allModules');

    return completeFrom(p, 'ok', (bindings) => {
      const allModules = bindings.allModules as Record<string, unknown>[];
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

      return { modules: matched.map((m) => m.moduleId as string) };
    }) as StorageProgram<Result>;
  },

  search(input: Record<string, unknown>) {
    const query = (input.query as string).toLowerCase();
    const kind = input.kind as string | undefined;
    const namespace = input.namespace as string | undefined;

    let p = createProgram();
    p = find(p, 'registryModule', {}, 'allModules');

    return completeFrom(p, 'ok', (bindings) => {
      const allModules = bindings.allModules as Record<string, unknown>[];
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

      return { modules: results.map((m) => m.moduleId as string) };
    }) as StorageProgram<Result>;
  },

  listVersions(input: Record<string, unknown>) {
    const name = input.name as string;
    const namespace = input.namespace as string;

    let p = createProgram();
    p = find(p, 'registryModule', {}, 'allModules');

    return completeFrom(p, 'ok', (bindings) => {
      const allModules = bindings.allModules as Record<string, unknown>[];
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

      return { versions: matching.map((m) => m.version as string) };
    }) as StorageProgram<Result>;
  },

  resolveCapability(input: Record<string, unknown>) {
    if (!input.capability || (typeof input.capability === 'string' && (input.capability as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'capability is required' }) as StorageProgram<Result>;
    }
    const capability = input.capability as string;

    let p = createProgram();
    p = find(p, 'registryModule', {}, 'allModules');

    return completeFrom(p, 'ok', (bindings) => {
      const allModules = bindings.allModules as Record<string, unknown>[];
      const providers = allModules.filter((m) => {
        if (m.yanked) return false;
        const caps = m.capabilitiesProvided as string[];
        return caps && caps.includes(capability);
      });

      if (providers.length === 0) {
        return { variant: 'notfound' };
      }

      return { providers: providers.map((m) => m.moduleId as string) };
    }) as StorageProgram<Result>;
  },

  /**
   * Publish a new module version to the registry.
   * Uses find + mapBindings to check for duplicates, then put with a generated moduleId.
   */
  publish(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.dependencies || (typeof input.dependencies === 'string' && (input.dependencies as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'dependencies is required' }) as StorageProgram<Result>;
    }
    if (!input.metadata || (typeof input.metadata === 'string' && (input.metadata as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'metadata is required' }) as StorageProgram<Result>;
    }
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
    const capabilitiesProvided = input.capabilities_provided as string[] | undefined;

    // Validate artifact hash format
    if (!artifactHash || !artifactHash.includes(':')) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Artifact hash must be in algorithm:digest format (e.g., sha256:abc)' }) as StorageProgram<Result>;
    }

    // Validate required metadata fields
    if (!metadata || !metadata.description || !metadata.license) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Metadata must include description and license fields' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'registryModule', {}, 'allModules');

    // Check for duplicate and conditionally publish
    p = mapBindings(p, (bindings) => {
      const allModules = bindings.allModules as Record<string, unknown>[];
      return allModules.some(
        (mod) => mod.name === name && mod.namespace === namespace && mod.version === version,
      );
    }, '_isDuplicate');

    return branch(p,
      (bindings) => bindings._isDuplicate as boolean,
      (thenP) => complete(thenP, 'duplicate', {}),
      (elseP) => {
        const moduleId = `mod-${nextId++}`;
        elseP = put(elseP, 'registryModule', moduleId, {
          moduleId,
          name,
          namespace,
          version,
          kind,
          artifactHash,
          dependencies: JSON.stringify(dependencies || []),
          metadata,
          capabilitiesProvided: capabilitiesProvided || [],
          yanked: false,
        });
        return complete(elseP, 'ok', { module: moduleId });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * Yank (deprecate) a module version by marking it as yanked.
   * Uses get + branch to find the module by its moduleId key and update it.
   */
  yank(input: Record<string, unknown>) {
    const moduleId = input.module as string;

    let p = createProgram();
    p = get(p, 'registryModule', moduleId, 'mod');

    return branch(p, 'mod',
      (thenP) => {
        // Module found — mark as yanked by re-putting with yanked: true
        thenP = mapBindings(thenP, (bindings) => {
          const mod = bindings.mod as Record<string, unknown>;
          return { ...mod, yanked: true };
        }, '_updatedMod');

        // Use traverse over a single-element array to write with dynamic data
        thenP = mapBindings(thenP, (bindings) => {
          return [bindings._updatedMod];
        }, '_modArray');

        thenP = traverse(thenP, '_modArray', '_m', (item) => {
          const mod = item as Record<string, unknown>;
          let sub = createProgram();
          sub = put(sub, 'registryModule', moduleId, mod);
          return complete(sub, 'ok', {});
        }, '_yankResults');

        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const registryHandler = autoInterpret(_handler);
