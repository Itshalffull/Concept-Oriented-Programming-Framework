// @migrated dsl-constructs 2026-03-18
// DeployOrchestrator Concept Handler
// End-to-end deployment orchestrator that reads deploy manifests,
// creates deployment plans, validates, provisions runtimes, and deploys
// through the kernel's sync-driven pipeline.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import YAML from 'yaml';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, perform, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const RELATION = 'deploy-orchestrator';

/**
 * Parse YAML deploy manifest to JSON using the `yaml` package.
 */
function yamlToJson(yamlStr: string): string {
  return JSON.stringify(YAML.parse(yamlStr));
}

function readManifest(manifestPath: string): string {
  const raw = readFileSync(manifestPath, 'utf-8');
  if (raw.trim().startsWith('{')) return raw;
  return yamlToJson(raw);
}

function findDeployableApps(projectRoot: string): Array<{ name: string; dir: string; manifest: string }> {
  const apps: Array<{ name: string; dir: string; manifest: string }> = [];
  const entries = readdirSync(projectRoot);

  for (const entry of entries) {
    if (!entry.startsWith('clef-')) continue;
    const appDir = resolve(projectRoot, entry);
    const manifestPath = resolve(appDir, 'deploy', 'vercel.deploy.yaml');
    if (existsSync(manifestPath)) {
      apps.push({ name: entry, dir: appDir, manifest: manifestPath });
    }
  }
  return apps;
}

// In-memory run tracking
const runs = new Map<string, {
  appName: string;
  manifestPath: string;
  environment: string;
  status: string;
  deploymentUrl?: string;
  startedAt: string;
  completedAt?: string;
}>();

const _handler: FunctionalConceptHandler = {
  deploy(input: Record<string, unknown>) {
    const manifestPath = resolve(input.manifestPath as string);
    const environment = (input.environment as string) || 'production';

    if (!existsSync(manifestPath)) {
      let p = createProgram(); p = complete(p, 'manifestNotFound', { path: manifestPath }); return p;
    }

    const manifestJson = readManifest(manifestPath);
    const manifest = JSON.parse(manifestJson);
    const appName = manifest.app?.name || basename(manifestPath);

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date().toISOString();
    const appDir = resolve(manifestPath, '..', '..');

    runs.set(runId, {
      appName,
      manifestPath,
      environment,
      status: 'deploying',
      startedAt,
    });

    // Deployment orchestration requires kernel dispatch — modeled as
    // perform() transport effects. The interpreter resolves them through
    // the kernel's concept transport at execution time.
    let p = createProgram();

    // Step 1: Plan deployment via kernel
    p = perform(p, 'kernel', 'invokeConcept', {
      concept: 'urn:clef/DeployPlan',
      action: 'plan',
      input: { manifest: manifestJson, environment },
    }, 'planResult');

    // Step 2: Validate, provision, deploy — all deferred to interpretation time
    // via completeFrom, which has access to bindings from the perform results.
    return completeFrom(p, 'ok', (bindings) => {
      const planResult = bindings.planResult as Record<string, unknown> | null;
      if (!planResult || planResult.variant !== 'ok') {
        return {
          variant: 'planFailed',
          appName,
          errors: [JSON.stringify(planResult?.errors || planResult?.missing || planResult?.details || [])],
        };
      }

      // Record deployment as pending — actual multi-step deploy
      // (validate, provision storage, provision runtimes, deploy)
      // is handled by the sync engine's cascading sync chain.
      // The orchestrator kicks off the pipeline; syncs do the rest.
      runs.set(runId, {
        ...runs.get(runId)!,
        status: 'pipeline-started',
      });

      return {
        run: runId,
        appName,
        deploymentUrl: '',
        duration: 0,
      };
    });
  },

  deployAll(input: Record<string, unknown>) {
    const projectRoot = resolve(input.projectRoot as string || '.');
    const environment = (input.environment as string) || 'production';

    const apps = findDeployableApps(projectRoot);
    if (apps.length === 0) {
      let p = createProgram(); p = complete(p, 'noAppsFound', { projectRoot }); return p;
    }

    // Multi-app deployment is orchestrated through perform() effects.
    // Each app's deploy is a separate kernel invocation.
    let p = createProgram();

    const appManifests = apps.map(app => {
      const manifestJson = readManifest(app.manifest);
      const manifest = JSON.parse(manifestJson);
      return {
        name: app.name,
        dir: app.dir,
        manifest: app.manifest,
        appName: manifest.app?.name || app.name,
      };
    });

    // Perform a batch deploy via kernel transport effect
    p = perform(p, 'kernel', 'deployBatch', {
      apps: JSON.stringify(appManifests),
      environment,
    }, 'batchResult');

    return completeFrom(p, 'ok', (bindings) => {
      const batchResult = bindings.batchResult as Record<string, unknown> | null;
      return {
        deployed: batchResult?.deployed || [],
        urls: batchResult?.urls || [],
        failed: batchResult?.failed || [],
        configuredApps: batchResult?.configuredApps || [],
      };
    });
  },

  status(input: Record<string, unknown>) {
    const runId = input.run as string;
    const run = runs.get(runId);

    if (!run) {
      let p = createProgram(); p = complete(p, 'notfound', { run: runId }); return p;
    }

    let p = createProgram(); p = complete(p, 'ok', { run: runId,
      appName: run.appName,
      status: run.status,
      deploymentUrl: run.deploymentUrl }); return p;
  },
};

export const deployOrchestratorHandler = autoInterpret(_handler);
