// DeployOrchestrator Concept Handler
// End-to-end deployment orchestrator that reads deploy manifests,
// creates deployment plans, validates, provisions runtimes, and deploys
// through the kernel's sync-driven pipeline.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import YAML from 'yaml';
import type { ConceptHandler } from '../../../runtime/types.js';
import type { Kernel } from '../../../runtime/self-hosted.js';

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

/**
 * Deploy a single app through the kernel's sync-driven pipeline.
 *
 * Follows Clef conventions: the orchestrator only talks to abstract
 * concepts (DeployPlan, Runtime). The sync engine routes actions to
 * provider-specific handlers (VercelRuntime, etc.) based on runtimeType.
 */
async function deploySingleApp(
  kernel: Kernel,
  app: { name: string; dir: string; manifest: string },
  environment: string,
): Promise<{ variant: string; url?: string; errors?: string[] }> {
  // Step 1: Read manifest
  const manifestJson = readManifest(app.manifest);

  // Step 2: Create deployment plan
  const planResult = await kernel.invokeConcept(
    'urn:clef/DeployPlan', 'plan',
    { manifest: manifestJson, environment },
  );
  if (planResult.variant !== 'ok') {
    return {
      variant: 'planFailed',
      errors: [JSON.stringify(planResult.errors || planResult.missing || planResult.details || [])],
    };
  }

  // Step 3: Validate the plan
  const validateResult = await kernel.invokeConcept(
    'urn:clef/DeployPlan', 'validate',
    { plan: planResult.plan },
  );
  if (validateResult.variant !== 'ok') {
    return {
      variant: 'validationFailed',
      errors: [JSON.stringify(validateResult.details || [])],
    };
  }

  // Step 3.5: Provision storage from infrastructure.storage declarations.
  // First initialize any storage provider plugins needed, then provision.
  const manifest = JSON.parse(manifestJson);
  const storageDeclarations = manifest.infrastructure?.storage as Record<string, Record<string, unknown>> | undefined;
  const provisionedStorage: Record<string, string> = {};

  // Initialize storage provider plugins based on declared types
  if (storageDeclarations) {
    const storageTypes = new Set(
      Object.values(storageDeclarations).map(s => (s.type as string) || ''),
    );

    // Map storage types to provider concept URIs
    const providerMap: Record<string, string> = {
      'vercel-kv': 'urn:clef/VercelKVProvider',
      'dynamodb': 'urn:clef/DynamoDBProvider',
      'redis': 'urn:clef/RedisProvider',
      'firestore': 'urn:clef/FirestoreProvider',
      'postgresql': 'urn:clef/PostgreSQLProvider',
      's3': 'urn:clef/S3Provider',
    };

    for (const storageType of storageTypes) {
      const providerUri = providerMap[storageType];
      if (providerUri) {
        try {
          await kernel.invokeConcept(providerUri, 'initialize', { config: '{}' });
        } catch {
          // Provider not registered — that's ok, provision will report the error
        }
      }
    }
  }

  if (storageDeclarations) {
    for (const [storageName, storageConfig] of Object.entries(storageDeclarations)) {
      const storageType = (storageConfig.type as string) || storageName;
      const config = storageConfig.config as Record<string, unknown> || {};
      const appName = manifest.app?.name || app.name;
      const fullStoreName = `${appName}-${storageName}`;

      console.log(`  Provisioning storage: ${fullStoreName} (${storageType})`);

      const storageResult = await kernel.invokeConcept(
        'urn:clef/StorageProvider', 'provision',
        {
          storeName: fullStoreName,
          storageType,
          conceptName: appName,
          config: JSON.stringify(config),
        },
      );

      if (storageResult.variant === 'ok' || storageResult.variant === 'alreadyProvisioned') {
        const creds = storageResult.credentials as string || '{}';
        provisionedStorage[storageName] = creds;
        console.log(`  Storage provisioned: ${fullStoreName}`);
      } else {
        console.error(`  Storage provision failed for ${fullStoreName}: ${storageResult.reason || storageResult.variant}`);
      }
    }
  }

  // Step 4: Provision and deploy each runtime.
  // The orchestrator only calls Runtime/provision and Runtime/deploy.
  // Routing syncs (e.g., RouteToVercel, RouteDeployToVercel) fire as
  // side effects, invoking the correct provider handler.
  const runtimeEntries = Object.entries(manifest.runtimes || {});
  let deploymentUrl: string | undefined;

  for (const [runtimeName, runtimeConfig] of runtimeEntries) {
    const config = runtimeConfig as Record<string, unknown>;
    const runtimeType = ((config.type as string) || '').toLowerCase().replace('runtime', '');
    const runtimeConfigObj = (config.config as Record<string, unknown>) || {};
    const framework = (runtimeConfigObj.framework as string) || 'nextjs';

    // Provision: abstract Runtime concept, sync-routed to provider
    const provisionResult = await kernel.invokeConcept(
      'urn:clef/Runtime', 'provision',
      {
        concept: manifest.app?.name || app.name,
        runtimeType,
        framework,
        config: JSON.stringify(config),
      },
    );

    if (provisionResult.variant !== 'ok' && provisionResult.variant !== 'alreadyProvisioned') {
      return {
        variant: 'deployFailed',
        errors: [`Provision failed for ${runtimeName}: ${provisionResult.variant}`],
      };
    }

    // Deploy: abstract Runtime concept, sync-routed to provider
    const deployResult = await kernel.invokeConcept(
      'urn:clef/Runtime', 'deploy',
      {
        instance: provisionResult.instance,
        concept: manifest.app?.name || app.name,
        artifact: app.dir,
        version: environment,
        runtimeType,
        sourceDirectory: app.dir,
      },
    );

    if (deployResult.variant === 'ok') {
      // Query Runtime state for the real endpoint — propagation syncs
      // update it after the provider deploy completes (e.g., PropagateVercelDeployUrl).
      // By the time invokeConcept returns, all syncs have fired.
      const endpointResult = await kernel.invokeConcept(
        'urn:clef/Runtime', 'getEndpoint',
        { instance: provisionResult.instance },
      );
      deploymentUrl = (endpointResult.endpoint as string) || undefined;
    } else if (deployResult.variant === 'deployFailed') {
      return {
        variant: 'deployFailed',
        errors: [`Deploy failed for ${runtimeName}: ${deployResult.reason || deployResult.variant}`],
      };
    }
  }

  // Step 4.5: Configure storage credentials as env vars on the runtime.
  // Merge all provisioned storage credentials and set them on the runtime.
  if (Object.keys(provisionedStorage).length > 0) {
    const allCreds: Record<string, string> = {};
    for (const [, credsJson] of Object.entries(provisionedStorage)) {
      try {
        const creds = JSON.parse(credsJson);
        Object.assign(allCreds, creds);
      } catch {
        // Skip unparseable credentials
      }
    }

    if (Object.keys(allCreds).length > 0) {
      const firstRuntime = runtimeEntries[0];
      if (firstRuntime) {
        const runtimeConfig = firstRuntime[1] as Record<string, unknown>;
        const runtimeType = ((runtimeConfig.type as string) || '').toLowerCase().replace('runtime', '');

        console.log(`  Configuring ${Object.keys(allCreds).length} storage env vars on runtime`);

        await kernel.invokeConcept(
          'urn:clef/Runtime', 'configureDependencies',
          {
            instance: manifest.app?.name || app.name,
            dependencies: JSON.stringify(allCreds),
            runtimeType,
          },
        );
      }
    }
  }

  // Step 5: Mark plan as executed
  await kernel.invokeConcept(
    'urn:clef/DeployPlan', 'execute',
    { plan: planResult.plan },
  );

  return { variant: 'ok', url: deploymentUrl };
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

export const deployOrchestratorHandler: ConceptHandler = {
  async deploy(input, storage) {
    const manifestPath = resolve(input.manifestPath as string);
    const environment = (input.environment as string) || 'production';

    if (!existsSync(manifestPath)) {
      return { variant: 'manifestNotFound', path: manifestPath };
    }

    // Get the kernel from globalThis (set by KernelBoot)
    const kernel = (globalThis as Record<string, unknown>).kernel as Kernel | undefined;
    if (!kernel) {
      return {
        variant: 'deployFailed',
        appName: 'unknown',
        errors: ['Kernel not booted. Run kernel-boot boot first.'],
      };
    }

    const manifestJson = readManifest(manifestPath);
    const manifest = JSON.parse(manifestJson);
    const appName = manifest.app?.name || basename(manifestPath);

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date().toISOString();

    runs.set(runId, {
      appName,
      manifestPath,
      environment,
      status: 'deploying',
      startedAt,
    });

    const appDir = resolve(manifestPath, '..', '..');
    const result = await deploySingleApp(
      kernel,
      { name: appName, dir: appDir, manifest: manifestPath },
      environment,
    );

    if (result.variant === 'ok') {
      const completedAt = new Date().toISOString();
      const duration = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
      runs.set(runId, {
        ...runs.get(runId)!,
        status: 'deployed',
        deploymentUrl: result.url,
        completedAt,
      });
      return {
        variant: 'ok',
        run: runId,
        appName,
        deploymentUrl: result.url || '',
        duration,
      };
    }

    runs.set(runId, { ...runs.get(runId)!, status: 'failed' });
    return { variant: result.variant, appName, errors: result.errors || [] };
  },

  async deployAll(input, storage) {
    const projectRoot = resolve(input.projectRoot as string || '.');
    const environment = (input.environment as string) || 'production';

    const apps = findDeployableApps(projectRoot);
    if (apps.length === 0) {
      return { variant: 'noAppsFound', projectRoot };
    }

    const kernel = (globalThis as Record<string, unknown>).kernel as Kernel | undefined;
    if (!kernel) {
      return {
        variant: 'noAppsFound',
        projectRoot,
      };
    }

    const deployed: string[] = [];
    const urls: string[] = [];
    const failed: string[] = [];
    const appUrlMap = new Map<string, string>();
    const appInstanceMap = new Map<string, { instance: string; runtimeType: string }>();

    // Phase 1: Deploy all apps
    for (const app of apps) {
      console.log(`\nDeploying: ${app.name}`);

      // Read manifest to get runtime type for dependency config later
      const manifestJson = readManifest(app.manifest);
      const manifest = JSON.parse(manifestJson);
      const runtimeEntries = Object.entries(manifest.runtimes || {});
      const firstRuntime = runtimeEntries[0];
      const runtimeType = firstRuntime
        ? ((firstRuntime[1] as Record<string, unknown>).type as string || '').toLowerCase().replace('runtime', '')
        : 'unknown';

      const result = await deploySingleApp(kernel, app, environment);

      if (result.variant === 'ok') {
        deployed.push(app.name);
        urls.push(result.url || '');
        const appName = manifest.app?.name || app.name;
        appUrlMap.set(appName, result.url || '');
        appInstanceMap.set(appName, { instance: appName, runtimeType });
        console.log(`  Deployed: ${result.url}`);
      } else {
        failed.push(app.name);
        console.error(`  Failed: ${(result.errors || []).join(', ')}`);
      }
    }

    // Phase 2: Configure cross-app dependencies
    // After all apps are deployed, set env vars so apps can find each other
    const configuredApps: string[] = [];
    for (const app of apps) {
      const manifestJson = readManifest(app.manifest);
      const manifest = JSON.parse(manifestJson);
      const appName = manifest.app?.name || app.name;
      const deps = manifest.dependencies as Record<string, { env: string; transport: string }> | undefined;

      if (!deps || Object.keys(deps).length === 0) continue;
      if (!deployed.includes(app.name)) continue;

      // Build env var map: { "CLEF_ACCOUNT_URL": "https://clef-account-xxx.vercel.app" }
      const envVars: Record<string, string> = {};
      for (const [depName, depConfig] of Object.entries(deps)) {
        const depUrl = appUrlMap.get(depName);
        if (depUrl && depConfig.env) {
          envVars[depConfig.env] = depUrl;
        }
      }

      if (Object.keys(envVars).length === 0) continue;

      console.log(`\nConfiguring dependencies for ${appName}:`);
      for (const [key, val] of Object.entries(envVars)) {
        console.log(`  ${key} = ${val}`);
      }

      // Look up the Runtime instance for this app
      const runtimeEntries = Object.entries(manifest.runtimes || {});
      const firstRuntime = runtimeEntries[0];
      const runtimeType = firstRuntime
        ? ((firstRuntime[1] as Record<string, unknown>).type as string || '').toLowerCase().replace('runtime', '')
        : 'unknown';

      // Find the provisioned Runtime instance by concept name
      const allInstances = await kernel.invokeConcept(
        'urn:clef/Runtime', 'provision',
        {
          concept: appName,
          runtimeType,
          framework: 'nextjs',
          config: '{}',
        },
      );
      // provision returns alreadyProvisioned with the instance ID if it exists
      const instanceId = allInstances.instance as string;

      if (instanceId) {
        const configResult = await kernel.invokeConcept(
          'urn:clef/Runtime', 'configureDependencies',
          {
            instance: instanceId,
            dependencies: JSON.stringify(envVars),
            runtimeType,
          },
        );

        if (configResult.variant === 'ok') {
          configuredApps.push(appName);
          console.log(`  Configured ${configResult.configured} env vars`);
        } else {
          console.error(`  Config failed: ${configResult.variant} ${configResult.reason || ''}`);
        }
      }
    }

    return { variant: 'ok', deployed, urls, failed, configuredApps };
  },

  async status(input, storage) {
    const runId = input.run as string;
    const run = runs.get(runId);

    if (!run) {
      return { variant: 'notfound', run: runId };
    }

    return {
      variant: 'ok',
      run: runId,
      appName: run.appName,
      status: run.status,
      deploymentUrl: run.deploymentUrl,
    };
  },
};
