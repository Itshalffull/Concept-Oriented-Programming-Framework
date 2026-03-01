// ============================================================
// DeploymentValidator Concept Implementation
//
// Parses and validates deployment manifests per Section 8.1.
// A deployment manifest declares:
//   - Application metadata (name, version, uri)
//   - Runtime environments (node, swift, browser, etc.)
//   - Concept deployments (spec, implementations, storage, queryMode)
//   - Sync assignments (which engine evaluates each sync)
//
// Validation rules (Section 7.1):
//   1. Each concept referenced by syncs has a deployment entry
//   2. Each concept's declared capabilities are satisfied by runtime
//   3. Warn about eager syncs spanning high-latency runtimes
//   4. Produce a deployment plan: which concepts run where, which
//      engine evaluates which syncs
//
// See Architecture doc Section 17.2.
// ============================================================

import type { ConceptHandler } from '../../../runtime/types.js';
import { generateId } from '../../../runtime/types.js';

// --- Deployment Manifest Types ---

export interface DeploymentManifest {
  app: {
    name: string;
    version: string;
    uri: string;
  };
  runtimes: Record<string, RuntimeConfig>;
  concepts: Record<string, ConceptDeployment>;
  syncs: SyncDeployment[];
  build?: BuildConfig;
}

export interface RuntimeConfig {
  type: 'node' | 'swift' | 'browser' | 'embedded'
    | 'aws-lambda' | 'ecs-fargate' | 'google-cloud-function' | 'cloud-run'
    | string;
  engine: boolean;
  transport: 'in-process' | 'http' | 'websocket' | 'worker' | 'sqs' | 'pubsub';
  upstream?: string;
  /** Configurable warn threshold for lite query snapshot size. */
  liteQueryWarnThreshold?: number;
  /** Storage backend for this runtime. */
  storage?: 'dynamodb' | 'firestore' | 'redis' | 'memory' | string;
  /** Durable action log backend (required for per-request and event-driven engines). */
  actionLog?: 'dynamodb' | 'firestore' | string;
  /** Location of compiled sync artifacts (for serverless engines). */
  syncCache?: 's3' | 'gcs' | 'bundled' | string;
  /** Memory allocation in MB (serverless). */
  memory?: number;
  /** Timeout in seconds (serverless). */
  timeout?: number;
  /** CPU allocation (managed compute). */
  cpu?: number;
  /** Minimum instances (managed compute, 0 for scale-to-zero). */
  minInstances?: number;
  /** AWS/GCP region. */
  region?: string;
}

export interface ConceptDeployment {
  spec: string;
  implementations: ConceptImplementation[];
}

export interface ConceptImplementation {
  language: string;
  path: string;
  runtime: string;
  storage: string;
  queryMode: 'graphql' | 'lite';
  cacheTtl?: number;
}

export interface SyncDeployment {
  path: string;
  engine: string;
  annotations?: string[];
}

// --- Build Config Types (Section 8.1) ---

export interface LanguageBuildConfig {
  compiler: string;        // e.g., "tsc", "cargo build"
  testRunner: string;      // e.g., "npx vitest run framework/test/tests"
  testPath: string;        // working directory relative to project root
  testTypes: string[];     // e.g., ["unit", "integration"]
  e2eRunner?: string;
  versionConstraint?: string;
}

export type BuildConfig = Record<string, LanguageBuildConfig>;

// --- Validation Result ---

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  plan: DeploymentPlan | null;
}

export interface DeploymentPlan {
  conceptPlacements: ConceptPlacement[];
  syncAssignments: SyncAssignment[];
}

export interface ConceptPlacement {
  concept: string;
  runtime: string;
  language: string;
  transport: string;
  queryMode: 'graphql' | 'lite';
}

export interface SyncAssignment {
  sync: string;
  engine: string;
  annotations: string[];
  crossRuntime: boolean;
}

// --- Runtime capability table ---

const RUNTIME_CAPABILITIES: Record<string, string[]> = {
  node: ['crypto', 'fs', 'network', 'database', 'full-compute'],
  swift: ['crypto', 'coredata', 'network', 'ui'],
  browser: ['network', 'ui', 'localstorage'],
  embedded: ['crypto', 'minimal-compute'],
  'aws-lambda': ['crypto', 'network', 'database', 'full-compute'],
  'ecs-fargate': ['crypto', 'fs', 'network', 'database', 'full-compute'],
  'google-cloud-function': ['crypto', 'network', 'database', 'full-compute'],
  'cloud-run': ['crypto', 'fs', 'network', 'database', 'full-compute'],
};

// --- Parse Deployment Manifest ---

/**
 * Parse a deployment manifest from a plain object (e.g., from YAML/JSON).
 * Validates the structure and returns typed result.
 */
export function parseDeploymentManifest(raw: Record<string, unknown>): DeploymentManifest {
  const app = raw.app as Record<string, string>;
  if (!app || !app.name || !app.version || !app.uri) {
    throw new Error('Deployment manifest must have app.name, app.version, and app.uri');
  }

  const runtimes: Record<string, RuntimeConfig> = {};
  const rawRuntimes = (raw.runtimes || {}) as Record<string, Record<string, unknown>>;
  for (const [name, cfg] of Object.entries(rawRuntimes)) {
    runtimes[name] = {
      type: (cfg.type as string) || 'node',
      engine: Boolean(cfg.engine),
      transport: (cfg.transport as string) as RuntimeConfig['transport'] || 'in-process',
      upstream: cfg.upstream as string | undefined,
      liteQueryWarnThreshold: cfg.liteQueryWarnThreshold as number | undefined,
      storage: cfg.storage as string | undefined,
      actionLog: cfg.actionLog as string | undefined,
      syncCache: cfg.syncCache as string | undefined,
      memory: cfg.memory as number | undefined,
      timeout: cfg.timeout as number | undefined,
      cpu: cfg.cpu as number | undefined,
      minInstances: cfg.minInstances as number | undefined,
      region: cfg.region as string | undefined,
    };
  }

  const concepts: Record<string, ConceptDeployment> = {};
  const rawConcepts = (raw.concepts || {}) as Record<string, Record<string, unknown>>;
  for (const [name, cfg] of Object.entries(rawConcepts)) {
    const impls = (cfg.implementations as Record<string, unknown>[]) || [];
    concepts[name] = {
      spec: cfg.spec as string,
      implementations: impls.map(impl => ({
        language: impl.language as string,
        path: impl.path as string,
        runtime: impl.runtime as string,
        storage: impl.storage as string,
        queryMode: (impl.queryMode as 'graphql' | 'lite') || 'lite',
        cacheTtl: impl.cacheTtl as number | undefined,
      })),
    };
  }

  const syncs: SyncDeployment[] = [];
  const rawSyncs = (raw.syncs || []) as Record<string, unknown>[];
  for (const s of rawSyncs) {
    syncs.push({
      path: s.path as string,
      engine: s.engine as string,
      annotations: (s.annotations as string[]) || [],
    });
  }

  let build: BuildConfig | undefined;
  const rawBuild = raw.build as Record<string, Record<string, unknown>> | undefined;
  if (rawBuild && typeof rawBuild === 'object') {
    build = {};
    for (const [language, cfg] of Object.entries(rawBuild)) {
      build[language] = {
        compiler: (cfg.compiler as string) || '',
        testRunner: (cfg.testRunner as string) || '',
        testPath: (cfg.testPath as string) || '.',
        testTypes: (cfg.testTypes as string[]) || ['unit'],
        e2eRunner: cfg.e2eRunner as string | undefined,
        versionConstraint: cfg.versionConstraint as string | undefined,
      };
    }
  }

  return {
    app: { name: app.name, version: app.version, uri: app.uri },
    runtimes,
    concepts,
    syncs,
    ...(build ? { build } : {}),
  };
}

// --- Validate Deployment Manifest ---

/**
 * Validate a deployment manifest against the system's concepts and syncs.
 *
 * @param manifest - The parsed deployment manifest
 * @param registeredConcepts - URIs of all registered concepts
 * @param syncConceptRefs - For each sync path, the set of concept names referenced
 * @param conceptCapabilities - For each concept, its required capabilities
 */
export function validateDeploymentManifest(
  manifest: DeploymentManifest,
  registeredConcepts: string[],
  syncConceptRefs: Record<string, string[]>,
  conceptCapabilities: Record<string, string[]>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1: Each concept referenced by syncs has a deployment entry
  for (const [syncPath, conceptNames] of Object.entries(syncConceptRefs)) {
    for (const conceptName of conceptNames) {
      if (!manifest.concepts[conceptName]) {
        errors.push(
          `Sync "${syncPath}" references concept "${conceptName}" which has no deployment entry`
        );
      }
    }
  }

  // Rule 2: Each concept's declared capabilities are satisfied by runtime
  for (const [conceptName, deployment] of Object.entries(manifest.concepts)) {
    const requiredCaps = conceptCapabilities[conceptName] || [];
    for (const impl of deployment.implementations) {
      const runtime = manifest.runtimes[impl.runtime];
      if (!runtime) {
        errors.push(
          `Concept "${conceptName}" references runtime "${impl.runtime}" which is not defined`
        );
        continue;
      }

      const runtimeCaps = RUNTIME_CAPABILITIES[runtime.type] || [];
      for (const cap of requiredCaps) {
        if (!runtimeCaps.includes(cap)) {
          errors.push(
            `Concept "${conceptName}" requires capability "${cap}" but runtime "${impl.runtime}" (${runtime.type}) does not provide it`
          );
        }
      }
    }
  }

  // Rule 3: Each sync's engine must be a runtime with engine: true
  for (const sync of manifest.syncs) {
    const runtime = manifest.runtimes[sync.engine];
    if (!runtime) {
      errors.push(
        `Sync "${sync.path}" assigned to engine "${sync.engine}" which is not a defined runtime`
      );
    } else if (!runtime.engine) {
      errors.push(
        `Sync "${sync.path}" assigned to runtime "${sync.engine}" which does not have engine: true`
      );
    }
  }

  // Rule 4: Warn about eager syncs spanning runtimes with non-in-process transport
  for (const sync of manifest.syncs) {
    const annotations = sync.annotations || [];
    if (!annotations.includes('eager') && annotations.length === 0) {
      // Default is eager
    }
    const isEager = annotations.length === 0 || annotations.includes('eager');

    if (isEager) {
      const referencedConcepts = syncConceptRefs[sync.path] || [];
      const runtimes = new Set<string>();

      for (const conceptName of referencedConcepts) {
        const deployment = manifest.concepts[conceptName];
        if (deployment) {
          for (const impl of deployment.implementations) {
            runtimes.add(impl.runtime);
          }
        }
      }

      if (runtimes.size > 1) {
        warnings.push(
          `Eager sync "${sync.path}" spans multiple runtimes: ${[...runtimes].join(', ')}. Consider marking as [eventual] if latency is a concern.`
        );
      }
    }
  }

  // Rule 5: Validate upstream references form a valid hierarchy (no cycles)
  const visited = new Set<string>();
  for (const [name, runtime] of Object.entries(manifest.runtimes)) {
    if (runtime.upstream) {
      if (!manifest.runtimes[runtime.upstream]) {
        errors.push(
          `Runtime "${name}" references upstream "${runtime.upstream}" which is not defined`
        );
      }
      // Simple cycle detection
      const chain = new Set<string>();
      let current: string | undefined = name;
      while (current) {
        if (chain.has(current)) {
          errors.push(`Runtime hierarchy has a cycle involving "${current}"`);
          break;
        }
        chain.add(current);
        current = manifest.runtimes[current]?.upstream;
      }
    }
  }

  // Rule 6: Serverless engines without persistent compute need a durable action log
  for (const [name, runtime] of Object.entries(manifest.runtimes)) {
    if (!runtime.engine) continue;
    const isServerless = ['aws-lambda', 'google-cloud-function'].includes(runtime.type);
    if (isServerless && !runtime.actionLog) {
      warnings.push(
        `Serverless engine runtime "${name}" (${runtime.type}) has no actionLog configured. ` +
        `Engine state will be lost between invocations. Consider setting actionLog to "dynamodb" or "firestore".`
      );
    }
  }

  // Rule 7: Queue-based transports require matching cloud provider
  for (const [name, runtime] of Object.entries(manifest.runtimes)) {
    if (runtime.transport === 'sqs' && !['aws-lambda', 'ecs-fargate'].includes(runtime.type) && runtime.type !== 'node') {
      warnings.push(
        `Runtime "${name}" uses SQS transport but is type "${runtime.type}". SQS transport is designed for AWS runtimes.`
      );
    }
    if (runtime.transport === 'pubsub' && !['google-cloud-function', 'cloud-run'].includes(runtime.type) && runtime.type !== 'node') {
      warnings.push(
        `Runtime "${name}" uses Pub/Sub transport but is type "${runtime.type}". Pub/Sub transport is designed for GCP runtimes.`
      );
    }
  }

  // Build deployment plan if valid
  let plan: DeploymentPlan | null = null;
  if (errors.length === 0) {
    const conceptPlacements: ConceptPlacement[] = [];
    for (const [conceptName, deployment] of Object.entries(manifest.concepts)) {
      for (const impl of deployment.implementations) {
        const runtime = manifest.runtimes[impl.runtime];
        conceptPlacements.push({
          concept: conceptName,
          runtime: impl.runtime,
          language: impl.language,
          transport: runtime?.transport || 'in-process',
          queryMode: impl.queryMode,
        });
      }
    }

    const syncAssignments: SyncAssignment[] = [];
    for (const sync of manifest.syncs) {
      const referencedConcepts = syncConceptRefs[sync.path] || [];
      const runtimes = new Set<string>();
      for (const conceptName of referencedConcepts) {
        const deployment = manifest.concepts[conceptName];
        if (deployment) {
          for (const impl of deployment.implementations) {
            runtimes.add(impl.runtime);
          }
        }
      }

      syncAssignments.push({
        sync: sync.path,
        engine: sync.engine,
        annotations: sync.annotations || [],
        crossRuntime: runtimes.size > 1,
      });
    }

    plan = { conceptPlacements, syncAssignments };
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    plan,
  };
}

// --- Concept Handler ---

export const deploymentValidatorHandler: ConceptHandler = {
  async parse(input, storage) {
    const raw = input.raw as string;
    if (!raw || typeof raw !== 'string') {
      return { variant: 'error', message: 'raw is required and must be a string' };
    }

    try {
      const parsed = JSON.parse(raw);
      const manifest = parseDeploymentManifest(parsed);
      const manifestId = generateId();

      await storage.put('manifests', manifestId, { manifestId });
      await storage.put('plan', manifestId, { manifestId, manifest });

      return { variant: 'ok', manifest: manifestId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async validate(input, storage) {
    const manifestRef = input.manifest as string;
    if (!manifestRef) {
      return { variant: 'error', issues: ['manifest reference is required'] };
    }

    const stored = await storage.get('plan', manifestRef);
    if (!stored || !stored.manifest) {
      return { variant: 'error', issues: ['manifest not found'] };
    }

    return { variant: 'error', issues: ['full validation requires concept and sync registrations'] };
  },
};
