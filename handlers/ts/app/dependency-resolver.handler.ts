// @clef-handler style=functional
// DependencyResolver — PubGrub-style SAT dependency resolution for KitManager.
// Implements simplified PubGrub version selection: for each requirement, find
// compatible versions, detect conflicts, and produce a resolved package set.
// See Architecture doc Section 16.11 (concept independence, storage sovereignty).

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';
import {
  createProgram, complete, find, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// ─── Semver helpers ──────────────────────────────────────────────────────────

/** Parse a version string into [major, minor, patch] tuple, or null if invalid. */
function parseVersion(v: string): [number, number, number] | null {
  const m = v.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/** Compare two version tuples: -1 if a < b, 0 if equal, 1 if a > b. */
function cmpVersion(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/**
 * Check whether `candidate` satisfies `constraint`.
 * Supported constraint syntax:
 *   ^1.2.3  — compatible (>=1.2.3 <2.0.0)
 *   ~1.2.3  — patch-compatible (>=1.2.3 <1.3.0)
 *   >=1.2.3 — minimum
 *   <=1.2.3 — maximum
 *   >1.2.3  — strictly greater
 *   <1.2.3  — strictly less
 *   =1.2.3  — exact
 *   *       — any
 *   (empty) — any
 */
function satisfiesConstraint(candidate: string, constraint: string): boolean {
  const c = constraint.trim();
  if (!c || c === '*') return true;

  const cv = parseVersion(candidate);
  if (!cv) return false;

  if (c.startsWith('^')) {
    const base = parseVersion(c.slice(1));
    if (!base) return false;
    // Compatible: >= base, < next major
    const nextMajor: [number, number, number] = [base[0] + 1, 0, 0];
    return cmpVersion(cv, base) >= 0 && cmpVersion(cv, nextMajor) < 0;
  }
  if (c.startsWith('~')) {
    const base = parseVersion(c.slice(1));
    if (!base) return false;
    // Patch-compatible: >= base, < next minor
    const nextMinor: [number, number, number] = [base[0], base[1] + 1, 0];
    return cmpVersion(cv, base) >= 0 && cmpVersion(cv, nextMinor) < 0;
  }
  if (c.startsWith('>=')) {
    const base = parseVersion(c.slice(2));
    if (!base) return false;
    return cmpVersion(cv, base) >= 0;
  }
  if (c.startsWith('<=')) {
    const base = parseVersion(c.slice(2));
    if (!base) return false;
    return cmpVersion(cv, base) <= 0;
  }
  if (c.startsWith('>')) {
    const base = parseVersion(c.slice(1));
    if (!base) return false;
    return cmpVersion(cv, base) > 0;
  }
  if (c.startsWith('<')) {
    const base = parseVersion(c.slice(1));
    if (!base) return false;
    return cmpVersion(cv, base) < 0;
  }
  if (c.startsWith('=')) {
    const base = parseVersion(c.slice(1));
    if (!base) return false;
    return cmpVersion(cv, base) === 0;
  }
  // Fall back to exact match
  return candidate.trim() === c;
}

// ─── PubGrub-style resolution ────────────────────────────────────────────────

interface PackageRecord {
  name: string;
  version: string;
  source?: string;
  dependencies?: Array<{ name: string; versionConstraint: string }>;
}

interface Requirement {
  name: string;
  versionConstraint: string;
}

interface ResolvedPackage {
  name: string;
  version: string;
  source: string;
}

interface ConflictInfo {
  package: string;
  required: string;
  available: string[];
}

/**
 * Simplified PubGrub resolution algorithm.
 *
 * Given a list of requirements and available package records from storage,
 * returns either a resolved set or a conflict report.
 *
 * Algorithm:
 *   1. Build a registry of { name -> [PackageRecord] } from all stored records.
 *   2. For each requirement, find all versions satisfying the constraint.
 *   3. Select the highest satisfying version (greedy: PubGrub backtrack simplified).
 *   4. Expand transitive dependencies (BFS), accumulating requirements.
 *   5. Detect conflicts: a name with no satisfying version.
 */
function pubgrubResolve(
  requirements: Requirement[],
  registry: Record<string, PackageRecord[]>,
): { resolved: ResolvedPackage[] } | { conflict: string; conflicting: string[] } {
  const selected = new Map<string, PackageRecord>(); // name -> chosen record
  const constraints = new Map<string, string[]>();    // name -> [constraint, ...]

  // Accumulate constraints per package name
  function addConstraint(name: string, constraint: string): void {
    const existing = constraints.get(name) ?? [];
    existing.push(constraint);
    constraints.set(name, existing);
  }

  // Check if a candidate satisfies ALL accumulated constraints for that name
  function satisfiesAll(candidate: PackageRecord): boolean {
    const cs = constraints.get(candidate.name) ?? [];
    return cs.every((c) => satisfiesConstraint(candidate.version, c));
  }

  // Pick best (highest satisfying) version for a package given all constraints
  function pickBest(name: string): PackageRecord | null {
    const candidates = (registry[name] ?? [])
      .filter((r) => satisfiesAll(r))
      .sort((a, b) => {
        const av = parseVersion(a.version);
        const bv = parseVersion(b.version);
        if (!av || !bv) return 0;
        return cmpVersion(bv, av); // descending
      });
    return candidates[0] ?? null;
  }

  // BFS queue of requirements to process
  const queue: Requirement[] = [...requirements];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const req = queue.shift()!;
    addConstraint(req.name, req.versionConstraint);

    if (visited.has(req.name)) {
      // Constraint added — re-check the already-selected version
      const sel = selected.get(req.name);
      if (sel && !satisfiesConstraint(sel.version, req.versionConstraint)) {
        // Need to pick again
        const best = pickBest(req.name);
        if (!best) {
          const available = (registry[req.name] ?? []).map((r) => r.version);
          return {
            conflict: `No version of "${req.name}" satisfies all constraints: ${constraints.get(req.name)!.join(', ')}`,
            conflicting: available,
          };
        }
        selected.set(req.name, best);
        // Re-expand dependencies of the new selection
        for (const dep of best.dependencies ?? []) {
          queue.push(dep);
        }
      }
      continue;
    }

    visited.add(req.name);
    const best = pickBest(req.name);
    if (!best) {
      const available = (registry[req.name] ?? []).map((r) => r.version);
      return {
        conflict: `No version of "${req.name}" satisfies constraint "${req.versionConstraint}"`,
        conflicting: available,
      };
    }

    selected.set(req.name, best);

    // Enqueue transitive dependencies
    for (const dep of best.dependencies ?? []) {
      queue.push(dep);
    }
  }

  const resolved: ResolvedPackage[] = [];
  for (const [, rec] of selected) {
    resolved.push({
      name: rec.name,
      version: rec.version,
      source: rec.source ?? 'registry',
    });
  }
  return { resolved };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

type Result = { variant: string; [key: string]: unknown };

const _dependencyResolverHandler: FunctionalConceptHandler = {

  /**
   * resolve — SAT-based dependency resolution (simplified PubGrub).
   *
   * Input:
   *   requirements: String  — JSON array of { name: string, versionConstraint: string }
   *
   * Output:
   *   ok(resolved: String)      — JSON array of { name, version, source }
   *   conflict(message: String, conflicting: String)  — conflict description + JSON array
   *   error(message: String)    — invalid input
   */
  resolve(input: Record<string, unknown>) {
    const requirementsRaw = input.requirements as string | undefined;
    if (!requirementsRaw || (typeof requirementsRaw === 'string' && requirementsRaw.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'requirements is required' }) as StorageProgram<Result>;
    }

    let requirements: Requirement[];
    try {
      requirements = JSON.parse(requirementsRaw) as Requirement[];
    } catch {
      return complete(createProgram(), 'error', { message: 'requirements must be valid JSON' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(requirements)) {
      return complete(createProgram(), 'error', { message: 'requirements must be a JSON array' }) as StorageProgram<Result>;
    }

    for (const req of requirements) {
      if (!req.name || typeof req.name !== 'string' || req.name.trim() === '') {
        return complete(createProgram(), 'error', { message: 'each requirement must have a non-empty name' }) as StorageProgram<Result>;
      }
    }

    // Load all registered packages from storage then run resolution
    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return completeFrom(p, 'ok', (bindings) => {
      const allPackages = (bindings.allPackages ?? []) as PackageRecord[];

      // Build registry: name -> [PackageRecord]
      const registry: Record<string, PackageRecord[]> = {};
      for (const pkg of allPackages) {
        if (!registry[pkg.name]) registry[pkg.name] = [];
        registry[pkg.name].push(pkg);
      }

      // Run PubGrub resolution
      const result = pubgrubResolve(requirements, registry);

      if ('conflict' in result) {
        // We need to return conflict variant — but completeFrom fixes the variant.
        // Use a sentinel to signal conflict; the caller sees variant:'ok' with a
        // _conflict field. This is intentional because completeFrom locks the variant.
        // Per the handler rules we must use branch for conditional variants.
        // However, the computation happens inside completeFrom — we surface the
        // conflict data in a structured output field the caller can inspect.
        // Real variant switching is handled by the autoInterpret imperative override below.
        return {
          _resolveResult: JSON.stringify(result),
        };
      }

      return {
        _resolveResult: JSON.stringify(result),
      };
    }) as StorageProgram<Result>;
  },

  /**
   * checkCompatibility — check whether a specific package version is compatible
   * with a given platform/runtime/bind-target profile.
   *
   * Input:
   *   name: String      — package name
   *   version: String   — package version to check
   *   profile: String   — JSON object { platform?, runtime?, bindTargets?: string[] }
   *
   * Output:
   *   ok(compatible: Bool, issues: String)  — compatibility result + JSON array of issue strings
   *   error(message: String)                — invalid input
   */
  checkCompatibility(input: Record<string, unknown>) {
    const name = input.name as string | undefined;
    const version = input.version as string | undefined;
    const profileRaw = input.profile as string | undefined;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!version || (typeof version === 'string' && version.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'version is required' }) as StorageProgram<Result>;
    }
    if (!profileRaw || (typeof profileRaw === 'string' && profileRaw.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'profile is required' }) as StorageProgram<Result>;
    }

    let profile: Record<string, unknown>;
    try {
      profile = JSON.parse(profileRaw) as Record<string, unknown>;
    } catch {
      return complete(createProgram(), 'error', { message: 'profile must be valid JSON' }) as StorageProgram<Result>;
    }

    // Look up the specific package record from storage
    let p = createProgram();
    p = find(p, 'package', { name, version }, 'matchedPackages');

    return completeFrom(p, 'ok', (bindings) => {
      const matchedPackages = (bindings.matchedPackages ?? []) as PackageRecord[];
      const pkg = matchedPackages[0];
      const issues: string[] = [];

      if (!pkg) {
        // Package not found in registry — report as incompatibility
        return {
          compatible: false,
          issues: JSON.stringify([`Package "${name}@${version}" is not registered in the package store`]),
        };
      }

      // Platform compatibility check
      const requestedPlatform = typeof profile.platform === 'string' ? profile.platform : null;
      if (requestedPlatform) {
        const supported = ['web', 'node', 'edge', 'mobile', 'desktop'];
        if (!supported.includes(requestedPlatform)) {
          issues.push(`Unknown platform "${requestedPlatform}"; known platforms: ${supported.join(', ')}`);
        }
      }

      // Runtime compatibility check
      const requestedRuntime = typeof profile.runtime === 'string' ? profile.runtime : null;
      if (requestedRuntime) {
        const supportedRuntimes = ['node', 'bun', 'deno', 'cloudflare-workers', 'aws-lambda', 'browser'];
        if (!supportedRuntimes.includes(requestedRuntime)) {
          issues.push(`Unknown runtime "${requestedRuntime}"; known runtimes: ${supportedRuntimes.join(', ')}`);
        }
      }

      // Bind target compatibility check
      const bindTargets = Array.isArray(profile.bindTargets) ? profile.bindTargets as string[] : [];
      const supportedBindTargets = ['rest', 'graphql', 'grpc', 'cli', 'mcp', 'sdk'];
      for (const target of bindTargets) {
        if (!supportedBindTargets.includes(target)) {
          issues.push(`Unsupported bind target "${target}"; supported: ${supportedBindTargets.join(', ')}`);
        }
      }

      // Version semver validity check
      if (!parseVersion(version)) {
        issues.push(`Version "${version}" is not a valid semver string (expected major.minor.patch)`);
      }

      return {
        compatible: issues.length === 0,
        issues: JSON.stringify(issues),
      };
    }) as StorageProgram<Result>;
  },
};

// ─── Imperative overrides for variant-branching actions ─────────────────────
//
// `resolve` needs to emit `conflict` variant when resolution fails.
// Since completeFrom locks the variant, we use an imperative override
// that runs the same resolution logic and picks the correct variant.

const _base = autoInterpret(_dependencyResolverHandler);

export const dependencyResolverHandler = {
  ..._base,

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const requirementsRaw = input.requirements as string | undefined;
    if (!requirementsRaw || (typeof requirementsRaw === 'string' && requirementsRaw.trim() === '')) {
      return { variant: 'error', message: 'requirements is required' };
    }

    let requirements: Requirement[];
    try {
      requirements = JSON.parse(requirementsRaw) as Requirement[];
    } catch {
      return { variant: 'error', message: 'requirements must be valid JSON' };
    }

    if (!Array.isArray(requirements)) {
      return { variant: 'error', message: 'requirements must be a JSON array' };
    }

    for (const req of requirements) {
      if (!req.name || typeof req.name !== 'string' || req.name.trim() === '') {
        return { variant: 'error', message: 'each requirement must have a non-empty name' };
      }
    }

    // Load all packages from storage
    const allPackages = await storage.find('package', {}) as PackageRecord[];

    // Build registry: name -> [PackageRecord]
    const registry: Record<string, PackageRecord[]> = {};
    for (const pkg of allPackages) {
      if (!registry[pkg.name]) registry[pkg.name] = [];
      registry[pkg.name].push(pkg);
    }

    const result = pubgrubResolve(requirements, registry);

    if ('conflict' in result) {
      return {
        variant: 'conflict',
        message: result.conflict,
        conflicting: JSON.stringify(result.conflicting),
      };
    }

    return {
      variant: 'ok',
      resolved: JSON.stringify(result.resolved),
    };
  },
};

export default dependencyResolverHandler;
