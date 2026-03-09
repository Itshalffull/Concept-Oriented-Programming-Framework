// ============================================================
// clef deploy
//
// Boot a kernel with the full deployment concept suite, compile
// routing syncs, and execute a deployment plan end-to-end.
//
// The sync engine routes actions to the correct runtime providers:
//   DeployPlan/plan → (ValidateBeforeExecute) → DeployPlan/validate
//   DeployPlan/validate → (ExecuteAfterValidation) → Runtime/provision
//   Runtime/provision [runtimeType: "vercel"] → (RouteToVercel) → VercelRuntime/provision
//   VercelRuntime/provision → VercelRuntime/deploy
//
// Usage:
//   clef deploy --manifest <path-to-deploy.yaml> [--environment production]
//   clef deploy --app <clef-app-dir> [--environment production]
//   clef deploy --all [--environment production]
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, basename, join } from 'path';
import { createConceptRegistry } from '../../../runtime/adapters/transport.js';
import { createSelfHostedKernel } from '../../../runtime/self-hosted.js';
import { createSyncEngineHandler } from '../../../handlers/ts/framework/sync-engine.handler.js';
import { parseSyncFile } from '../../../handlers/ts/framework/sync-parser.handler.js';
import { syncCompilerHandler } from '../../../handlers/ts/framework/sync-compiler.handler.js';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import type { Kernel } from '../../../runtime/self-hosted.js';
import type { CompiledSync } from '../../../runtime/types.js';

// Deploy concept handlers
import { deployPlanHandler } from '../../../handlers/ts/deploy/deploy-plan.handler.js';
import { runtimeHandler } from '../../../handlers/ts/deploy/runtime.handler.js';
import { vercelRuntimeHandler } from '../../../handlers/ts/deploy/vercel-runtime.handler.js';
import { builderHandler } from '../../../handlers/ts/deploy/builder.handler.js';
import { typescriptBuilderHandler } from '../../../handlers/ts/deploy/typescript-builder.handler.js';
import { storageProviderHandler } from '../../../handlers/ts/deploy/storage-provider.handler.js';
import { vercelKVProviderHandler } from '../../../handlers/ts/deploy/vercel-kv-provider.handler.js';

// ─── Sync files for the deploy orchestration ───────────────
const DEPLOY_SYNC_PATHS = [
  'repertoire/concepts/deployment/syncs/core/validate-before-execute.sync',
  'repertoire/concepts/deployment/syncs/core/execute-after-validation.sync',
  'repertoire/concepts/deployment/syncs/routing/route-to-vercel.sync',
  'repertoire/concepts/deployment/syncs/routing/route-builder-to-typescript.sync',
  'repertoire/concepts/deployment/syncs/build/toolchain-before-build.sync',
  'repertoire/concepts/deployment/syncs/build/build-after-toolchain.sync',
  'repertoire/concepts/deployment/syncs/build/store-after-build.sync',
  'repertoire/concepts/deployment/syncs/observability/marker-on-deploy-start.sync',
  'repertoire/concepts/deployment/syncs/observability/marker-on-deploy-complete.sync',
  'repertoire/concepts/deployment/syncs/storage-routing.sync',
];

/**
 * Boot a kernel with all deployment concepts and routing syncs.
 */
function bootDeployKernel(projectRoot: string): Kernel {
  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  // Register all deployment concepts
  kernel.registerConcept('urn:clef/DeployPlan', deployPlanHandler);
  kernel.registerConcept('urn:clef/Runtime', runtimeHandler);
  kernel.registerConcept('urn:clef/VercelRuntime', vercelRuntimeHandler);
  kernel.registerConcept('urn:clef/Builder', builderHandler);
  kernel.registerConcept('urn:clef/TypescriptBuilder', typescriptBuilderHandler);
  kernel.registerConcept('urn:clef/StorageProvider', storageProviderHandler);
  kernel.registerConcept('urn:clef/VercelKVProvider', vercelKVProviderHandler);

  console.log('  Registered 7 deployment concepts');

  // Compile and register routing syncs
  let syncsLoaded = 0;
  for (const syncRelPath of DEPLOY_SYNC_PATHS) {
    const syncPath = resolve(projectRoot, syncRelPath);
    if (!existsSync(syncPath)) {
      console.log(`  [SKIP] Sync not found: ${syncRelPath}`);
      continue;
    }

    try {
      const source = readFileSync(syncPath, 'utf-8');
      const compiledSyncs = parseSyncFile(source);
      for (const sync of compiledSyncs) {
        kernel.registerSync(sync);
        syncsLoaded++;
      }
    } catch (err) {
      console.log(`  [WARN] Failed to compile sync ${syncRelPath}: ${err}`);
    }
  }

  console.log(`  Registered ${syncsLoaded} routing sync(s)`);
  return kernel;
}

/**
 * Read and JSON-serialize a deploy.yaml manifest.
 * Since our DeployPlan handler currently accepts JSON, we do a simple
 * YAML-to-JSON conversion for the structured format.
 */
function readManifest(manifestPath: string): string {
  const raw = readFileSync(manifestPath, 'utf-8');

  // If already JSON, return as-is
  if (raw.trim().startsWith('{')) return raw;

  // Simple YAML parser for deploy manifests
  // Handles the specific structure of deploy.yaml files
  return yamlToJson(raw);
}

/**
 * Minimal YAML-to-JSON converter for deploy.yaml manifests.
 * Handles nested objects, arrays, strings, numbers, booleans.
 * Not a full YAML parser — just enough for deploy manifests.
 */
function yamlToJson(yaml: string): string {
  const lines = yaml.split('\n');
  const result: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown>; key?: string }> = [
    { indent: -1, obj: result },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    const match = line.match(/^(\s*)([\w-]+)\s*:\s*(.*)/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2];
    let value = match[3].trim();

    // Pop stack to find parent at correct indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (value === '' || value === '|') {
      // Nested object or block scalar
      if (value === '|') {
        // Block scalar — collect indented lines
        const blockLines: string[] = [];
        const blockIndent = indent + 2;
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine.trim() === '' || nextLine.match(/^\s{2,}/) && nextLine.search(/\S/) >= blockIndent) {
            blockLines.push(nextLine.slice(blockIndent));
            i++;
          } else {
            break;
          }
        }
        parent[key] = blockLines.join('\n').trim();
      } else {
        const child: Record<string, unknown> = {};
        parent[key] = child;
        stack.push({ indent, obj: child, key });
      }
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Inline array
      const items = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      parent[key] = items;
    } else if (value.startsWith('"') && value.endsWith('"')) {
      parent[key] = value.slice(1, -1);
    } else if (value === 'true') {
      parent[key] = true;
    } else if (value === 'false') {
      parent[key] = false;
    } else if (/^\d+$/.test(value)) {
      parent[key] = parseInt(value, 10);
    } else {
      parent[key] = value;
    }
  }

  return JSON.stringify(result);
}

/**
 * Find all clef-* app directories that have a vercel.deploy.yaml.
 */
function findDeployableApps(projectRoot: string): Array<{ name: string; dir: string; manifest: string }> {
  const apps: Array<{ name: string; dir: string; manifest: string }> = [];
  const entries = require('fs').readdirSync(projectRoot);

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

export async function deployCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectRoot = resolve(process.cwd());
  const environment = (flags.environment as string) || 'production';

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         Clef Deploy — Sync-Driven Orchestration ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Check for VERCEL_TOKEN
  if (!process.env.VERCEL_TOKEN) {
    console.error('ERROR: VERCEL_TOKEN environment variable is required.');
    console.error('  export VERCEL_TOKEN=<your-vercel-token>');
    console.error('  Get a token at: https://vercel.com/account/tokens');
    process.exit(1);
  }

  // Determine which manifests to deploy
  let manifests: Array<{ name: string; dir: string; manifest: string }> = [];

  if (flags.all) {
    // Deploy all clef-* apps with vercel.deploy.yaml
    manifests = findDeployableApps(projectRoot);
    if (manifests.length === 0) {
      console.error('No deployable apps found (looking for clef-*/deploy/vercel.deploy.yaml)');
      process.exit(1);
    }
    console.log(`Found ${manifests.length} deployable app(s):`);
    for (const m of manifests) {
      console.log(`  - ${m.name} (${m.manifest})`);
    }
  } else if (flags.app) {
    // Deploy a specific app
    const appDir = resolve(projectRoot, flags.app as string);
    const manifestPath = resolve(appDir, 'deploy', 'vercel.deploy.yaml');
    if (!existsSync(manifestPath)) {
      console.error(`No deploy manifest found at: ${manifestPath}`);
      process.exit(1);
    }
    manifests = [{ name: basename(appDir), dir: appDir, manifest: manifestPath }];
  } else if (flags.manifest) {
    // Deploy from a specific manifest
    const manifestPath = resolve(flags.manifest as string);
    if (!existsSync(manifestPath)) {
      console.error(`Manifest not found: ${manifestPath}`);
      process.exit(1);
    }
    manifests = [{ name: 'custom', dir: projectRoot, manifest: manifestPath }];
  } else {
    console.error('Usage:');
    console.error('  clef deploy --all                          Deploy all clef-* apps');
    console.error('  clef deploy --app <dir>                    Deploy a specific app');
    console.error('  clef deploy --manifest <path>              Deploy from a manifest');
    console.error('');
    console.error('Options:');
    console.error('  --environment <env>    Environment (default: production)');
    process.exit(1);
  }

  console.log('');

  // Boot the deployment kernel
  console.log('Booting deployment kernel...');
  const kernel = bootDeployKernel(projectRoot);
  console.log('');

  // Deploy each app through the sync-driven pipeline
  const results: Array<{ name: string; status: string; url?: string; error?: string }> = [];

  for (const app of manifests) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`Deploying: ${app.name}`);
    console.log(`${'═'.repeat(50)}`);

    try {
      // Step 1: Read and parse the manifest
      console.log('\n  [1/4] Reading deploy manifest...');
      const manifestJson = readManifest(app.manifest);
      console.log(`         Manifest: ${app.manifest}`);

      // Step 2: Create the deployment plan via kernel
      // This triggers ValidateBeforeExecute sync automatically
      console.log('\n  [2/4] Creating deployment plan (DeployPlan/plan)...');
      const planResult = await kernel.invokeConcept(
        'urn:clef/DeployPlan',
        'plan',
        { manifest: manifestJson, environment },
      );

      if (planResult.variant !== 'ok') {
        throw new Error(
          `Plan failed: ${planResult.variant} — ${JSON.stringify(planResult.errors || planResult.missing || planResult.details || [])}`,
        );
      }
      console.log(`         Plan ID: ${planResult.plan}`);
      console.log(`         Estimated duration: ${planResult.estimatedDuration}s`);

      // Step 3: Validate the plan via kernel
      // This triggers ExecuteAfterValidation sync
      console.log('\n  [3/4] Validating deployment plan (DeployPlan/validate)...');
      const validateResult = await kernel.invokeConcept(
        'urn:clef/DeployPlan',
        'validate',
        { plan: planResult.plan },
      );

      if (validateResult.variant !== 'ok') {
        throw new Error(
          `Validation failed: ${validateResult.variant} — ${JSON.stringify(validateResult.details || [])}`,
        );
      }
      if (validateResult.warnings && (validateResult.warnings as string[]).length > 0) {
        for (const w of validateResult.warnings as string[]) {
          console.log(`         ⚠ ${w}`);
        }
      }
      console.log('         Validation passed');

      // Step 4: Execute — provision storage and runtimes, then deploy
      console.log('\n  [4/4] Executing deployment...');

      // Parse the manifest to get runtime and storage config
      const manifest = JSON.parse(manifestJson);

      // Provision storage from infrastructure.storage declarations.
      // StorageProvider/provision triggers routing syncs that dispatch
      // to the correct provider (e.g., RouteStorageToVercelKV).
      const storageDeclarations = manifest.infrastructure?.storage as Record<string, Record<string, unknown>> | undefined;
      if (storageDeclarations) {
        for (const [storageName, storageConfig] of Object.entries(storageDeclarations)) {
          const storageType = (storageConfig.type as string) || storageName;
          const config = storageConfig.config as Record<string, unknown> || {};
          const appName = manifest.app?.name || app.name;
          const fullStoreName = `${appName}-${storageName}`;

          console.log(`\n         Provisioning storage "${fullStoreName}" (${storageType})...`);

          const storageResult = await kernel.invokeConcept(
            'urn:clef/StorageProvider',
            'provision',
            {
              storeName: fullStoreName,
              storageType,
              conceptName: appName,
              config: JSON.stringify(config),
            },
          );

          if (storageResult.variant === 'ok' || storageResult.variant === 'alreadyProvisioned') {
            console.log(`         Storage provisioned: ${fullStoreName}`);
          } else {
            console.log(`         Storage provision failed: ${storageResult.reason || storageResult.variant}`);
          }
        }
      }

      const runtimeEntries = Object.entries(manifest.runtimes || {});

      for (const [runtimeName, runtimeConfig] of runtimeEntries) {
        const config = runtimeConfig as Record<string, unknown>;
        const runtimeType = ((config.type as string) || '').toLowerCase().replace('runtime', '');
        const framework = ((config.config as Record<string, unknown>)?.framework as string) || 'nextjs';

        console.log(`\n         Provisioning runtime "${runtimeName}" (type: ${runtimeType})...`);

        // Invoke Runtime/provision through the kernel
        // The sync engine routes this to VercelRuntime/provision via route-to-vercel.sync
        const provisionResult = await kernel.invokeConcept(
          'urn:clef/Runtime',
          'provision',
          {
            concept: manifest.app?.name || app.name,
            runtimeType,
            config: JSON.stringify(config),
          },
        );

        console.log(`         Provision result: ${provisionResult.variant}`);
        if (provisionResult.variant === 'ok') {
          console.log(`         Instance: ${provisionResult.instance}`);
          console.log(`         Endpoint: ${provisionResult.endpoint}`);
        }

        // Now deploy to the provisioned runtime
        console.log(`\n         Deploying to runtime "${runtimeName}"...`);

        // For Vercel deployments, invoke VercelRuntime/deploy directly
        // (The provision sync chain returns the project ID)
        if (runtimeType === 'vercel' || runtimeType === 'vercelruntime') {
          const deployResult = await kernel.invokeConcept(
            'urn:clef/VercelRuntime',
            'deploy',
            {
              project: provisionResult.instance || provisionResult.project,
              sourceDirectory: app.dir,
            },
          );

          if (deployResult.variant === 'ok') {
            console.log(`         ✓ Deployed: ${deployResult.deploymentUrl}`);
            results.push({
              name: app.name,
              status: 'deployed',
              url: deployResult.deploymentUrl as string,
            });
          } else {
            const errors = (deployResult.errors as string[]) || [];
            throw new Error(`Deploy failed: ${errors.join(', ')}`);
          }
        } else {
          console.log(`         [SKIP] Runtime type "${runtimeType}" — only Vercel is supported currently`);
          results.push({ name: app.name, status: 'skipped', error: `Unsupported runtime: ${runtimeType}` });
        }
      }

      // Update plan status
      await kernel.invokeConcept(
        'urn:clef/DeployPlan',
        'execute',
        { plan: planResult.plan },
      );

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n  ✗ FAILED: ${message}`);
      results.push({ name: app.name, status: 'failed', error: message });
    }
  }

  // Print summary
  console.log(`\n\n${'═'.repeat(50)}`);
  console.log('Deployment Summary');
  console.log(`${'═'.repeat(50)}`);

  for (const r of results) {
    const icon = r.status === 'deployed' ? '✓' : r.status === 'skipped' ? '○' : '✗';
    console.log(`  ${icon} ${r.name}: ${r.status}${r.url ? ` → ${r.url}` : ''}${r.error ? ` (${r.error})` : ''}`);
  }

  const deployed = results.filter(r => r.status === 'deployed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`\n  ${deployed} deployed, ${failed} failed, ${results.length - deployed - failed} skipped`);

  if (failed > 0) {
    process.exit(1);
  }
}
