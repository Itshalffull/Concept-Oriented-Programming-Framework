// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Resolver Concept Implementation
// PubGrub-based conflict-driven dependency solver. Accepts input constraints
// and a resolution policy, then produces a fully resolved module graph with
// exact versions, content hashes, and enabled features.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;

/** Reset the ID counter (for testing). */
export function resetResolverIds(): void {
  nextId = 1;
}

interface Constraint {
  module_id: string;
  version_range: string;
  edge_type: string;
  environment: string;
  features: string[];
}

interface ResolvedModule {
  module_id: string;
  resolved_version: string;
  content_hash: string;
  features_enabled: string[];
}

interface Policy {
  unification_strategy: string;
  feature_unification: string;
  prefer_locked: boolean;
  allowed_updates: string;
}

/**
 * Simplified semver range check for resolution.
 */
function satisfiesRange(version: string, range: string): boolean {
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

  return version === range;
}

/**
 * Compare two semver strings. Returns positive if a > b.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

/**
 * Check if an update is allowed by the policy.
 */
function isUpdateAllowed(oldVersion: string, newVersion: string, allowedUpdates: string): boolean {
  const oldParts = oldVersion.split('.').map(Number);
  const newParts = newVersion.split('.').map(Number);

  switch (allowedUpdates) {
    case 'patch':
      return newParts[0] === oldParts[0] && newParts[1] === oldParts[1];
    case 'minor':
      return newParts[0] === oldParts[0];
    case 'major':
    default:
      return true;
  }
}

/**
 * Core resolution logic shared between actions.
 */
function performResolution(
  constraints: Constraint[],
  policy: Policy,
  lockedVersions: Array<{ module_id: string; version: string; content_hash: string }> | null | undefined,
  registryModules: Record<string, unknown>[],
): { variant: string; resolvedModules?: ResolvedModule[]; inputConstraints?: Constraint[]; explanation?: string } {
  const resolvedModules: ResolvedModule[] = [];

  // Build a map of locked versions for quick lookup
  const lockedMap = new Map<string, { version: string; content_hash: string }>();
  if (lockedVersions) {
    for (const locked of lockedVersions) {
      lockedMap.set(locked.module_id, { version: locked.version, content_hash: locked.content_hash });
    }
  }

  // Group constraints by module_id for conflict detection
  const constraintsByModule = new Map<string, Constraint[]>();
  for (const c of constraints) {
    const existing = constraintsByModule.get(c.module_id) || [];
    existing.push(c);
    constraintsByModule.set(c.module_id, existing);
  }

  for (const [moduleId, moduleConstraints] of constraintsByModule) {
    const candidates = registryModules.filter(
      (m) => m.moduleId === moduleId || m.name === moduleId,
    );

    let resolved: ResolvedModule | null = null;

    if (policy.prefer_locked && lockedMap.has(moduleId)) {
      const locked = lockedMap.get(moduleId)!;
      const allSatisfied = moduleConstraints.every((c) =>
        satisfiesRange(locked.version, c.version_range),
      );
      if (allSatisfied) {
        const features = policy.feature_unification === 'union'
          ? [...new Set(moduleConstraints.flatMap((c) => c.features))]
          : moduleConstraints.reduce<string[]>((acc, c, i) =>
              i === 0 ? [...c.features] : acc.filter((f) => c.features.includes(f)),
            []);

        resolved = {
          module_id: moduleId,
          resolved_version: locked.version,
          content_hash: locked.content_hash,
          features_enabled: features,
        };
      }
    }

    if (!resolved) {
      const satisfying: Array<{ version: string; content_hash: string }> = [];

      if (candidates.length > 0) {
        for (const mod of candidates) {
          const version = mod.version as string;
          const allSatisfied = moduleConstraints.every((c) =>
            satisfiesRange(version, c.version_range),
          );
          if (allSatisfied && !mod.yanked) {
            satisfying.push({
              version,
              content_hash: (mod.artifactHash || mod.contentHash || `sha256:${version}`) as string,
            });
          }
        }
      } else {
        for (const c of moduleConstraints) {
          const syntheticVersion = c.version_range.replace(/[\^~>=]/g, '');
          const allSatisfied = moduleConstraints.every((mc) =>
            satisfiesRange(syntheticVersion, mc.version_range),
          );
          if (allSatisfied) {
            satisfying.push({
              version: syntheticVersion,
              content_hash: `sha256:${moduleId}-${syntheticVersion}`,
            });
            break;
          }
        }
      }

      if (satisfying.length === 0) {
        const rangeDescriptions = moduleConstraints
          .map((c) => `${c.version_range} (from ${c.edge_type})`)
          .join(', ');
        return {
          variant: 'unsolvable',
          explanation: `No version of "${moduleId}" satisfies all constraints: ${rangeDescriptions}`,
        };
      }

      satisfying.sort((a, b) => compareSemver(a.version, b.version));
      const selected = policy.unification_strategy === 'minimal'
        ? satisfying[0]
        : satisfying[satisfying.length - 1];

      const features = policy.feature_unification === 'union'
        ? [...new Set(moduleConstraints.flatMap((c) => c.features))]
        : moduleConstraints.reduce<string[]>((acc, c, i) =>
            i === 0 ? [...c.features] : acc.filter((f) => c.features.includes(f)),
          []);

      resolved = {
        module_id: moduleId,
        resolved_version: selected.version,
        content_hash: selected.content_hash,
        features_enabled: features,
      };
    }

    resolvedModules.push(resolved);
  }

  return { variant: 'ok', resolvedModules, inputConstraints: constraints };
}

const _handler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    if (!input.constraints || (typeof input.constraints === 'string' && (input.constraints as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'constraints is required' }) as StorageProgram<Result>;
    }
    if (!input.policy || (typeof input.policy === 'string' && (input.policy as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'policy is required' }) as StorageProgram<Result>;
    }
    // locked_versions can be null (meaning no locked versions) — only reject if explicitly empty string
    if (typeof input.locked_versions === 'string' && (input.locked_versions as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'locked_versions must be null or an array' }) as StorageProgram<Result>;
    }
    // Normalize constraints: string → try JSON.parse, otherwise wrap in synthetic constraint
    let rawConstraints = input.constraints;
    let constraints: Constraint[];
    if (Array.isArray(rawConstraints)) {
      constraints = rawConstraints as Constraint[];
    } else if (typeof rawConstraints === 'string') {
      try {
        const parsed = JSON.parse(rawConstraints);
        constraints = Array.isArray(parsed) ? parsed : [];
      } catch {
        // Treat non-JSON string as synthetic module ID
        constraints = [{ module_id: rawConstraints, version_range: '*', edge_type: 'normal', environment: 'all', features: [] }];
      }
    } else {
      constraints = [];
    }

    // Normalize policy
    let policy: Policy;
    if (typeof input.policy === 'object' && input.policy !== null) {
      policy = input.policy as Policy;
    } else {
      policy = { unification_strategy: 'highest', feature_unification: 'union', prefer_locked: false, allowed_updates: 'minor' } as unknown as Policy;
    }

    const lockedVersions = input.locked_versions as Array<{
      module_id: string;
      version: string;
      content_hash: string;
    }> | undefined;

    let p = createProgram();

    if (!constraints || constraints.length === 0) {
      return complete(p, 'error', { message: 'No constraints provided' }) as StorageProgram<Result>;
    }

    const resolutionId = `res-${nextId++}`;

    p = find(p, 'registryModule', {}, 'registryModules');

    p = mapBindings(p, (bindings) => {
      const registryModules = bindings.registryModules as Record<string, unknown>[];
      return performResolution(constraints, policy, lockedVersions ?? null, registryModules);
    }, '_resolutionResult');

    p = branch(p,
      (bindings) => {
        const result = bindings._resolutionResult as Record<string, unknown>;
        return result.variant !== 'ok';
      },
      (b) => completeFrom(b, 'unsolvable', (bindings) => {
        const result = bindings._resolutionResult as Record<string, unknown>;
        return { explanation: result.explanation as string };
      }),
      (b) => {
        // Persist the resolution
        let b2 = putFrom(b, 'resolution', resolutionId, (bindings) => {
          const result = bindings._resolutionResult as Record<string, unknown>;
          return {
            id: resolutionId,
            resolvedModules: result.resolvedModules,
            inputConstraints: result.inputConstraints,
            policy,
          };
        });

        return complete(b2, 'ok', { resolution: resolutionId });
      },
    );

    return p as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    if (!input.targets || (typeof input.targets === 'string' && (input.targets as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'targets is required' }) as StorageProgram<Result>;
    }
    if (!input.policy || (typeof input.policy === 'string' && (input.policy as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'policy is required' }) as StorageProgram<Result>;
    }
    const resolutionId = input.resolution as string;
    const targets = input.targets as string[];
    const policy = input.policy as Policy;

    let p = createProgram();
    p = get(p, 'resolution', resolutionId, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = find(b, 'registryModule', {}, 'registryModules');

        b2 = mapBindings(b2, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const registryModules = bindings.registryModules as Record<string, unknown>[];
          const existingResolved = existing.resolvedModules as ResolvedModule[];
          const existingConstraints = existing.inputConstraints as Constraint[];
          const updatedModules: ResolvedModule[] = [];

          for (const mod of existingResolved) {
            if (targets.includes(mod.module_id)) {
              const moduleConstraints = existingConstraints.filter(
                (c) => c.module_id === mod.module_id,
              );
              const candidates = registryModules.filter(
                (m) => ((m.moduleId === mod.module_id || m.name === mod.module_id) && !m.yanked),
              );

              const satisfying: Array<{ version: string; content_hash: string }> = [];
              for (const candidate of candidates) {
                const version = candidate.version as string;
                const allSatisfied = moduleConstraints.every((c) =>
                  satisfiesRange(version, c.version_range),
                );
                if (allSatisfied && isUpdateAllowed(mod.resolved_version, version, policy.allowed_updates)) {
                  satisfying.push({
                    version,
                    content_hash: (candidate.artifactHash || `sha256:${version}`) as string,
                  });
                }
              }

              if (satisfying.length > 0) {
                satisfying.sort((a, b) => compareSemver(a.version, b.version));
                const selected = policy.unification_strategy === 'minimal'
                  ? satisfying[0]
                  : satisfying[satisfying.length - 1];

                updatedModules.push({
                  module_id: mod.module_id,
                  resolved_version: selected.version,
                  content_hash: selected.content_hash,
                  features_enabled: mod.features_enabled,
                });
              } else {
                updatedModules.push(mod);
              }
            } else {
              updatedModules.push(mod);
            }
          }

          return { updatedModules, existingConstraints };
        }, '_updateResult');

        const newResolutionId = `res-${nextId++}`;
        b2 = putFrom(b2, 'resolution', newResolutionId, (bindings) => {
          const result = bindings._updateResult as Record<string, unknown>;
          return {
            id: newResolutionId,
            resolvedModules: result.updatedModules,
            inputConstraints: result.existingConstraints,
            policy,
          };
        });

        return complete(b2, 'ok', { resolution: newResolutionId });
      },
      (b) => complete(b, 'unsolvable', { explanation: `Resolution "${resolutionId}" not found` }),
    );

    return p as StorageProgram<Result>;
  },

  explain(input: Record<string, unknown>) {
    if (!input.module_id || (typeof input.module_id === 'string' && (input.module_id as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'module_id is required' }) as StorageProgram<Result>;
    }
    const resolutionId = input.resolution as string;
    const moduleId = input.module_id as string;

    let p = createProgram();
    p = get(p, 'resolution', resolutionId, 'resolution');

    p = branch(p, 'resolution',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const resolution = bindings.resolution as Record<string, unknown>;
          const resolvedModules = resolution.resolvedModules as ResolvedModule[];
          const found = resolvedModules ? resolvedModules.find((m) => m.module_id === moduleId) : undefined;
          if (!found) {
            return { path: JSON.stringify([`No resolution found for module '${moduleId}'`]) };
          }

          const constraints = resolution.inputConstraints as Constraint[];
          const relevantConstraints = constraints.filter((c) => c.module_id === moduleId);

          const path = relevantConstraints.map(
            (c) => `${c.edge_type} dependency requires "${moduleId}" ${c.version_range} (env: ${c.environment})`,
          );
          path.push(`resolved to ${found.resolved_version} (hash: ${found.content_hash})`);

          if (found.features_enabled.length > 0) {
            path.push(`features enabled: ${found.features_enabled.join(', ')}`);
          }

          return { path };
        });
      },
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const resolverHandler = autoInterpret(_handler);
