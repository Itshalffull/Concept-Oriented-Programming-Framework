// Deploy Kit Implementation Tests
// Tests all 17 concept handler implementations for the deploy kit,
// verifying action variants, storage behavior, and invariant contracts.
import { describe, it, expect, beforeEach } from 'vitest';
import { createKernel } from '../handlers/ts/framework/kernel-factory.js';

// --- Orchestration handlers ---
import { deployPlanHandler } from '../handlers/ts/deploy/deploy-plan.handler.js';
import { rolloutHandler } from '../handlers/ts/deploy/rollout.handler.js';
import { migrationHandler } from '../handlers/ts/deploy/migration.handler.js';
import { healthHandler } from '../handlers/ts/deploy/health.handler.js';
import { envHandler } from '../handlers/ts/deploy/env.handler.js';
import { telemetryHandler } from '../handlers/ts/deploy/telemetry.handler.js';
import { artifactHandler } from '../handlers/ts/deploy/artifact.handler.js';

// --- Coordination handlers ---
import { runtimeHandler } from '../handlers/ts/deploy/runtime.handler.js';
import { secretHandler } from '../handlers/ts/deploy/secret.handler.js';
import { iacHandler } from '../handlers/ts/deploy/iac.handler.js';
import { gitopsHandler } from '../handlers/ts/deploy/gitops.handler.js';

// --- Provider handlers ---
import { lambdaRuntimeHandler } from '../handlers/ts/deploy/lambda-runtime.handler.js';
import { ecsRuntimeHandler } from '../handlers/ts/deploy/ecs-runtime.handler.js';
import { vaultProviderHandler } from '../handlers/ts/deploy/vault-provider.handler.js';
import { awsSmProviderHandler } from '../handlers/ts/deploy/aws-sm-provider.handler.js';
import { pulumiProviderHandler } from '../handlers/ts/deploy/pulumi-provider.handler.js';
import { terraformProviderHandler } from '../handlers/ts/deploy/terraform-provider.handler.js';

// --- Additional Provider handlers ---
import { cloudRunRuntimeHandler } from '../handlers/ts/deploy/cloud-run-runtime.handler.js';
import { gcfRuntimeHandler } from '../handlers/ts/deploy/gcf-runtime.handler.js';
import { cloudflareRuntimeHandler } from '../handlers/ts/deploy/cloudflare-runtime.handler.js';
import { vercelRuntimeHandler } from '../handlers/ts/deploy/vercel-runtime.handler.js';
import { k8sRuntimeHandler } from '../handlers/ts/deploy/k8s-runtime.handler.js';
import { dockerComposeRuntimeHandler } from '../handlers/ts/deploy/docker-compose-runtime.handler.js';
import { localRuntimeHandler } from '../handlers/ts/deploy/local-runtime.handler.js';
import { gcpSmProviderHandler } from '../handlers/ts/deploy/gcp-sm-provider.handler.js';
import { envProviderHandler } from '../handlers/ts/deploy/env-provider.handler.js';
import { dotenvProviderHandler } from '../handlers/ts/deploy/dotenv-provider.handler.js';
import { cloudFormationProviderHandler } from '../handlers/ts/deploy/cloudformation-provider.handler.js';
import { dockerComposeIacProviderHandler } from '../handlers/ts/deploy/docker-compose-iac-provider.handler.js';
import { argoCDProviderHandler } from '../handlers/ts/deploy/argocd-provider.handler.js';
import { fluxProviderHandler } from '../handlers/ts/deploy/flux-provider.handler.js';

// ============================================================
// Orchestration Concept Implementations
// ============================================================

describe('DeployPlan Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/DeployPlan', deployPlanHandler);
  });

  it('plan -> ok creates a deployment plan', async () => {
    const result = await kernel.invokeConcept('urn:clef/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    expect(result.variant).toBe('ok');
    expect(result.plan).toBeDefined();
    expect(result.graph).toBeDefined();
    expect(result.estimatedDuration).toBe(300);
  });

  it('plan -> invalidManifest for empty manifest', async () => {
    const result = await kernel.invokeConcept('urn:clef/DeployPlan', 'plan', {
      manifest: '', environment: 'staging',
    });
    expect(result.variant).toBe('invalidManifest');
  });

  it('validate -> ok for existing plan', async () => {
    const plan = await kernel.invokeConcept('urn:clef/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    const result = await kernel.invokeConcept('urn:clef/DeployPlan', 'validate', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
  });

  it('execute -> ok for validated plan', async () => {
    const plan = await kernel.invokeConcept('urn:clef/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    await kernel.invokeConcept('urn:clef/DeployPlan', 'validate', {
      plan: plan.plan,
    });
    const result = await kernel.invokeConcept('urn:clef/DeployPlan', 'execute', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
    expect(result.duration).toBeDefined();
    expect(result.nodesDeployed).toBeDefined();
  });

  it('rollback -> ok for executed plan', async () => {
    const plan = await kernel.invokeConcept('urn:clef/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    await kernel.invokeConcept('urn:clef/DeployPlan', 'execute', {
      plan: plan.plan,
    });
    const result = await kernel.invokeConcept('urn:clef/DeployPlan', 'rollback', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
  });

  it('status -> ok for existing plan', async () => {
    const plan = await kernel.invokeConcept('urn:clef/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    const result = await kernel.invokeConcept('urn:clef/DeployPlan', 'status', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
    expect(result.phase).toBe('planned');
  });

  it('status -> notfound for unknown plan', async () => {
    const result = await kernel.invokeConcept('urn:clef/DeployPlan', 'status', {
      plan: 'nonexistent',
    });
    expect(result.variant).toBe('notfound');
  });

  it('invariant: plan -> validate -> execute succeeds', async () => {
    const p = await kernel.invokeConcept('urn:clef/DeployPlan', 'plan', {
      manifest: 'valid-manifest', environment: 'staging',
    });
    expect(p.variant).toBe('ok');
    const v = await kernel.invokeConcept('urn:clef/DeployPlan', 'validate', {
      plan: p.plan,
    });
    expect(v.variant).toBe('ok');
    const e = await kernel.invokeConcept('urn:clef/DeployPlan', 'execute', {
      plan: p.plan,
    });
    expect(e.variant).toBe('ok');
  });
});

describe('Rollout Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Rollout', rolloutHandler);
  });

  it('begin -> ok with valid strategy', async () => {
    const result = await kernel.invokeConcept('urn:clef/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '50%', '100%'],
    });
    expect(result.variant).toBe('ok');
    expect(result.rollout).toBeDefined();
  });

  it('begin -> invalidStrategy for unknown strategy', async () => {
    const result = await kernel.invokeConcept('urn:clef/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'chaos', steps: [],
    });
    expect(result.variant).toBe('invalidStrategy');
  });

  it('advance -> ok increments step', async () => {
    const r = await kernel.invokeConcept('urn:clef/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'linear', steps: ['25%', '50%', '75%', '100%'],
    });
    const result = await kernel.invokeConcept('urn:clef/Rollout', 'advance', {
      rollout: r.rollout,
    });
    expect(result.variant).toBe('ok');
    expect(result.step).toBe(1);
  });

  it('advance -> complete when all steps done', async () => {
    const r = await kernel.invokeConcept('urn:clef/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'immediate', steps: ['100%'],
    });
    const result = await kernel.invokeConcept('urn:clef/Rollout', 'advance', {
      rollout: r.rollout,
    });
    expect(result.variant).toBe('complete');
  });

  it('pause -> ok and resume -> ok', async () => {
    const r = await kernel.invokeConcept('urn:clef/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '100%'],
    });
    const pause = await kernel.invokeConcept('urn:clef/Rollout', 'pause', {
      rollout: r.rollout, reason: 'metrics degraded',
    });
    expect(pause.variant).toBe('ok');
    const resume = await kernel.invokeConcept('urn:clef/Rollout', 'resume', {
      rollout: r.rollout,
    });
    expect(resume.variant).toBe('ok');
  });

  it('abort -> ok for active rollout', async () => {
    const r = await kernel.invokeConcept('urn:clef/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '100%'],
    });
    const result = await kernel.invokeConcept('urn:clef/Rollout', 'abort', {
      rollout: r.rollout,
    });
    expect(result.variant).toBe('ok');
  });

  it('status -> ok returns rollout state', async () => {
    const r = await kernel.invokeConcept('urn:clef/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '100%'],
    });
    const result = await kernel.invokeConcept('urn:clef/Rollout', 'status', {
      rollout: r.rollout,
    });
    expect(result.variant).toBe('ok');
    expect(result.status).toBe('active');
  });
});

describe('Migration Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Migration', migrationHandler);
  });

  it('plan -> ok for version upgrade', async () => {
    const result = await kernel.invokeConcept('urn:clef/Migration', 'plan', {
      concept: 'User', fromVersion: 1, toVersion: 3,
    });
    expect(result.variant).toBe('ok');
    expect(result.steps).toHaveLength(2);
  });

  it('plan -> noMigrationNeeded for same version', async () => {
    const result = await kernel.invokeConcept('urn:clef/Migration', 'plan', {
      concept: 'User', fromVersion: 2, toVersion: 2,
    });
    expect(result.variant).toBe('noMigrationNeeded');
  });

  it('expand-migrate-contract chain succeeds', async () => {
    const plan = await kernel.invokeConcept('urn:clef/Migration', 'plan', {
      concept: 'User', fromVersion: 1, toVersion: 2,
    });
    const expand = await kernel.invokeConcept('urn:clef/Migration', 'expand', {
      migration: plan.migration,
    });
    expect(expand.variant).toBe('ok');
    const migrate = await kernel.invokeConcept('urn:clef/Migration', 'migrate', {
      migration: plan.migration,
    });
    expect(migrate.variant).toBe('ok');
    const contract = await kernel.invokeConcept('urn:clef/Migration', 'contract', {
      migration: plan.migration,
    });
    expect(contract.variant).toBe('ok');
  });

  it('status tracks migration progress', async () => {
    const plan = await kernel.invokeConcept('urn:clef/Migration', 'plan', {
      concept: 'User', fromVersion: 1, toVersion: 2,
    });
    const status = await kernel.invokeConcept('urn:clef/Migration', 'status', {
      migration: plan.migration,
    });
    expect(status.variant).toBe('ok');
    expect(status.phase).toBe('planned');
  });
});

describe('Health Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Health', healthHandler);
  });

  it('checkConcept -> ok returns latency', async () => {
    const result = await kernel.invokeConcept('urn:clef/Health', 'checkConcept', {
      concept: 'User', runtime: 'lambda',
    });
    expect(result.variant).toBe('ok');
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('checkSync -> ok returns roundTripMs', async () => {
    const result = await kernel.invokeConcept('urn:clef/Health', 'checkSync', {
      sync: 'LoginFlow', concepts: ['User', 'Password'],
    });
    expect(result.variant).toBe('ok');
    expect(result.roundTripMs).toBeGreaterThan(0);
  });

  it('checkKit -> ok returns results arrays', async () => {
    const result = await kernel.invokeConcept('urn:clef/Health', 'checkKit', {
      kit: 'deploy', environment: 'staging',
    });
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.conceptResults)).toBe(true);
  });

  it('checkInvariant -> ok verifies behavioral contract', async () => {
    const result = await kernel.invokeConcept('urn:clef/Health', 'checkInvariant', {
      concept: 'User', invariant: 'create-then-get',
    });
    expect(result.variant).toBe('ok');
  });
});

describe('Env Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Env', envHandler);
  });

  it('resolve -> ok returns resolved config', async () => {
    const result = await kernel.invokeConcept('urn:clef/Env', 'resolve', {
      environment: 'staging',
    });
    expect(result.variant).toBe('ok');
    expect(result.resolved).toBeDefined();
  });

  it('resolve -> missingBase for empty environment', async () => {
    const result = await kernel.invokeConcept('urn:clef/Env', 'resolve', {
      environment: '',
    });
    expect(result.variant).toBe('missingBase');
  });

  it('promote -> ok promotes from one env to another', async () => {
    const env = await kernel.invokeConcept('urn:clef/Env', 'resolve', {
      environment: 'staging',
    });
    const result = await kernel.invokeConcept('urn:clef/Env', 'promote', {
      fromEnv: env.environment, toEnv: 'production', suiteName: 'deploy',
    });
    expect(result.variant).toBe('ok');
    expect(result.version).toBeDefined();
  });

  it('diff -> ok returns differences', async () => {
    const result = await kernel.invokeConcept('urn:clef/Env', 'diff', {
      envA: 'staging', envB: 'production',
    });
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.differences)).toBe(true);
  });
});

describe('Telemetry Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Telemetry', telemetryHandler);
  });

  it('configure -> ok creates telemetry config', async () => {
    const result = await kernel.invokeConcept('urn:clef/Telemetry', 'configure', {
      concept: 'User', endpoint: 'https://otel.local', samplingRate: 0.1,
    });
    expect(result.variant).toBe('ok');
    expect(result.config).toBeDefined();
  });

  it('deployMarker -> ok emits a marker', async () => {
    const result = await kernel.invokeConcept('urn:clef/Telemetry', 'deployMarker', {
      kit: 'deploy', version: '1.0.0', environment: 'staging', status: 'started',
    });
    expect(result.variant).toBe('ok');
    expect(result.marker).toBeDefined();
  });

  it('analyze -> insufficientData when no config exists', async () => {
    const result = await kernel.invokeConcept('urn:clef/Telemetry', 'analyze', {
      concept: 'Unknown', window: 300, criteria: 'errorRate < 0.01',
    });
    expect(result.variant).toBe('insufficientData');
  });

  it('analyze -> ok when telemetry is configured', async () => {
    await kernel.invokeConcept('urn:clef/Telemetry', 'configure', {
      concept: 'User', endpoint: 'https://otel.local', samplingRate: 0.1,
    });
    const result = await kernel.invokeConcept('urn:clef/Telemetry', 'analyze', {
      concept: 'User', window: 300, criteria: 'errorRate < 0.01',
    });
    expect(result.variant).toBe('ok');
    expect(result.healthy).toBe(true);
  });
});

describe('Artifact Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Artifact', artifactHandler);
  });

  it('build -> ok produces content-addressed artifact', async () => {
    const result = await kernel.invokeConcept('urn:clef/Artifact', 'build', {
      concept: 'User', spec: 'user.concept', implementation: 'user.handler.ts', deps: [],
    });
    expect(result.variant).toBe('ok');
    expect(result.hash).toBeDefined();
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('build -> compilationError for missing spec', async () => {
    const result = await kernel.invokeConcept('urn:clef/Artifact', 'build', {
      concept: 'User', spec: '', implementation: '', deps: [],
    });
    expect(result.variant).toBe('compilationError');
  });

  it('resolve -> ok finds artifact by hash', async () => {
    const built = await kernel.invokeConcept('urn:clef/Artifact', 'build', {
      concept: 'User', spec: 'user.concept', implementation: 'user.handler.ts', deps: [],
    });
    const result = await kernel.invokeConcept('urn:clef/Artifact', 'resolve', {
      hash: built.hash,
    });
    expect(result.variant).toBe('ok');
    expect(result.location).toBeDefined();
  });

  it('resolve -> notfound for unknown hash', async () => {
    const result = await kernel.invokeConcept('urn:clef/Artifact', 'resolve', {
      hash: 'sha256-nonexistent',
    });
    expect(result.variant).toBe('notfound');
  });

  it('gc -> ok returns cleanup metrics', async () => {
    const result = await kernel.invokeConcept('urn:clef/Artifact', 'gc', {
      olderThan: new Date(), keepVersions: 3,
    });
    expect(result.variant).toBe('ok');
    expect(typeof result.removed).toBe('number');
  });
});

// ============================================================
// Coordination Concept Implementations
// ============================================================

describe('Runtime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Runtime', runtimeHandler);
  });

  it('provision -> ok creates runtime instance', async () => {
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    expect(result.variant).toBe('ok');
    expect(result.instance).toBeDefined();
    expect(result.endpoint).toBeDefined();
  });

  it('provision -> alreadyProvisioned on duplicate', async () => {
    await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    expect(result.variant).toBe('alreadyProvisioned');
  });

  it('deploy -> ok updates version', async () => {
    const prov = await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'deploy', {
      instance: prov.instance, artifact: 'art-123', version: 'v2',
    });
    expect(result.variant).toBe('ok');
  });

  it('rollback -> ok reverts to previous version', async () => {
    const prov = await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    await kernel.invokeConcept('urn:clef/Runtime', 'deploy', {
      instance: prov.instance, artifact: 'art-123', version: 'v1',
    });
    await kernel.invokeConcept('urn:clef/Runtime', 'deploy', {
      instance: prov.instance, artifact: 'art-456', version: 'v2',
    });
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'rollback', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('ok');
    expect(result.previousVersion).toBe('v1');
  });

  it('rollback -> noHistory when no previous versions', async () => {
    const prov = await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'rollback', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('noHistory');
  });

  it('destroy -> ok removes instance', async () => {
    const prov = await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'destroy', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('ok');
  });

  it('healthCheck -> ok returns latency', async () => {
    const prov = await kernel.invokeConcept('urn:clef/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'healthCheck', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('ok');
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('healthCheck -> unreachable for unknown instance', async () => {
    const result = await kernel.invokeConcept('urn:clef/Runtime', 'healthCheck', {
      instance: 'nonexistent',
    });
    expect(result.variant).toBe('unreachable');
  });
});

describe('Secret Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/Secret', secretHandler);
  });

  it('resolve -> ok fetches and caches secret', async () => {
    const result = await kernel.invokeConcept('urn:clef/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    expect(result.variant).toBe('ok');
    expect(result.secret).toBeDefined();
    expect(result.version).toBeDefined();
  });

  it('exists -> ok returns existence check', async () => {
    await kernel.invokeConcept('urn:clef/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    const result = await kernel.invokeConcept('urn:clef/Secret', 'exists', {
      name: 'db-password', provider: 'vault',
    });
    expect(result.variant).toBe('ok');
    expect(result.exists).toBe(true);
  });

  it('rotate -> ok creates new version', async () => {
    await kernel.invokeConcept('urn:clef/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    const result = await kernel.invokeConcept('urn:clef/Secret', 'rotate', {
      name: 'db-password', provider: 'vault',
    });
    expect(result.variant).toBe('ok');
    expect(result.newVersion).toBeDefined();
  });

  it('invalidateCache -> ok clears cache', async () => {
    await kernel.invokeConcept('urn:clef/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    const result = await kernel.invokeConcept('urn:clef/Secret', 'invalidateCache', {
      name: 'db-password',
    });
    expect(result.variant).toBe('ok');
  });
});

describe('IaC Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/IaC', iacHandler);
  });

  it('emit -> ok generates IaC files', async () => {
    const result = await kernel.invokeConcept('urn:clef/IaC', 'emit', {
      plan: 'plan-1', provider: 'terraform',
    });
    expect(result.variant).toBe('ok');
    expect(result.fileCount).toBeGreaterThan(0);
  });

  it('preview -> ok shows planned changes', async () => {
    const result = await kernel.invokeConcept('urn:clef/IaC', 'preview', {
      plan: 'plan-1', provider: 'terraform',
    });
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.toCreate)).toBe(true);
  });

  it('apply -> ok applies changes', async () => {
    const result = await kernel.invokeConcept('urn:clef/IaC', 'apply', {
      plan: 'plan-1', provider: 'pulumi',
    });
    expect(result.variant).toBe('ok');
  });

  it('detectDrift -> noDrift when state is clean', async () => {
    const result = await kernel.invokeConcept('urn:clef/IaC', 'detectDrift', {
      provider: 'terraform',
    });
    expect(result.variant).toBe('noDrift');
  });

  it('teardown -> ok destroys resources', async () => {
    const result = await kernel.invokeConcept('urn:clef/IaC', 'teardown', {
      plan: 'plan-1', provider: 'terraform',
    });
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.destroyed)).toBe(true);
  });
});

describe('GitOps Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/GitOps', gitopsHandler);
  });

  it('emit -> ok generates manifests for argocd', async () => {
    const result = await kernel.invokeConcept('urn:clef/GitOps', 'emit', {
      plan: 'plan-1', controller: 'argocd', repo: 'my-repo', path: 'k8s',
    });
    expect(result.variant).toBe('ok');
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('emit -> controllerUnsupported for unknown controller', async () => {
    const result = await kernel.invokeConcept('urn:clef/GitOps', 'emit', {
      plan: 'plan-1', controller: 'unknown', repo: 'my-repo', path: 'k8s',
    });
    expect(result.variant).toBe('controllerUnsupported');
  });

  it('reconciliationStatus -> pending for new manifest', async () => {
    const emit = await kernel.invokeConcept('urn:clef/GitOps', 'emit', {
      plan: 'plan-1', controller: 'flux', repo: 'my-repo', path: 'k8s',
    });
    const result = await kernel.invokeConcept('urn:clef/GitOps', 'reconciliationStatus', {
      manifest: emit.manifest,
    });
    expect(result.variant).toBe('pending');
  });
});

// ============================================================
// Provider Concept Implementations
// ============================================================

describe('LambdaRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/LambdaRuntime', lambdaRuntimeHandler);
  });

  it('provision -> ok creates Lambda function', async () => {
    const result = await kernel.invokeConcept('urn:clef/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.functionArn).toContain('arn:aws:lambda');
  });

  it('deploy -> ok deploys to function', async () => {
    const fn = await kernel.invokeConcept('urn:clef/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    const result = await kernel.invokeConcept('urn:clef/LambdaRuntime', 'deploy', {
      function: fn.function, artifactLocation: 's3://bucket/code.zip',
    });
    expect(result.variant).toBe('ok');
    expect(result.version).toBeDefined();
  });

  it('rollback -> ok restores target version', async () => {
    const fn = await kernel.invokeConcept('urn:clef/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    const result = await kernel.invokeConcept('urn:clef/LambdaRuntime', 'rollback', {
      function: fn.function, targetVersion: 'v1',
    });
    expect(result.variant).toBe('ok');
    expect(result.restoredVersion).toBe('v1');
  });

  it('destroy -> ok removes function', async () => {
    const fn = await kernel.invokeConcept('urn:clef/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    const result = await kernel.invokeConcept('urn:clef/LambdaRuntime', 'destroy', {
      function: fn.function,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('EcsRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/EcsRuntime', ecsRuntimeHandler);
  });

  it('provision -> ok creates ECS service', async () => {
    const result = await kernel.invokeConcept('urn:clef/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: 'default',
    });
    expect(result.variant).toBe('ok');
    expect(result.serviceArn).toContain('arn:aws:ecs');
  });

  it('provision -> clusterNotFound for empty cluster', async () => {
    const result = await kernel.invokeConcept('urn:clef/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: '',
    });
    expect(result.variant).toBe('clusterNotFound');
  });

  it('deploy -> ok creates task definition', async () => {
    const svc = await kernel.invokeConcept('urn:clef/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: 'default',
    });
    const result = await kernel.invokeConcept('urn:clef/EcsRuntime', 'deploy', {
      service: svc.service, imageUri: '123456789.dkr.ecr.us-east-1.amazonaws.com/user:latest',
    });
    expect(result.variant).toBe('ok');
    expect(result.taskDefinition).toBeDefined();
  });

  it('destroy -> ok removes service', async () => {
    const svc = await kernel.invokeConcept('urn:clef/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: 'default',
    });
    const result = await kernel.invokeConcept('urn:clef/EcsRuntime', 'destroy', {
      service: svc.service,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('VaultProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/VaultProvider', vaultProviderHandler);
  });

  it('fetch -> ok returns secret with lease', async () => {
    const result = await kernel.invokeConcept('urn:clef/VaultProvider', 'fetch', {
      path: 'secret/data/db-password',
    });
    expect(result.variant).toBe('ok');
    expect(result.leaseId).toBeDefined();
    expect(result.leaseDuration).toBe(3600);
  });

  it('fetch -> pathNotFound for empty path', async () => {
    const result = await kernel.invokeConcept('urn:clef/VaultProvider', 'fetch', {
      path: '',
    });
    expect(result.variant).toBe('pathNotFound');
  });

  it('renewLease -> ok extends lease', async () => {
    const fetched = await kernel.invokeConcept('urn:clef/VaultProvider', 'fetch', {
      path: 'secret/data/db-password',
    });
    const result = await kernel.invokeConcept('urn:clef/VaultProvider', 'renewLease', {
      leaseId: fetched.leaseId,
    });
    expect(result.variant).toBe('ok');
    expect(result.newDuration).toBe(3600);
  });

  it('renewLease -> leaseExpired for unknown lease', async () => {
    const result = await kernel.invokeConcept('urn:clef/VaultProvider', 'renewLease', {
      leaseId: 'nonexistent',
    });
    expect(result.variant).toBe('leaseExpired');
  });

  it('rotate -> ok creates new version', async () => {
    const result = await kernel.invokeConcept('urn:clef/VaultProvider', 'rotate', {
      path: 'secret/data/db-password',
    });
    expect(result.variant).toBe('ok');
    expect(result.newVersion).toBeGreaterThan(0);
  });
});

describe('AwsSmProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/AwsSmProvider', awsSmProviderHandler);
  });

  it('fetch -> ok returns secret value', async () => {
    const result = await kernel.invokeConcept('urn:clef/AwsSmProvider', 'fetch', {
      secretId: 'prod/db/password', versionStage: 'AWSCURRENT',
    });
    expect(result.variant).toBe('ok');
    expect(result.arn).toContain('arn:aws:secretsmanager');
  });

  it('fetch -> resourceNotFound for empty secretId', async () => {
    const result = await kernel.invokeConcept('urn:clef/AwsSmProvider', 'fetch', {
      secretId: '', versionStage: 'AWSCURRENT',
    });
    expect(result.variant).toBe('resourceNotFound');
  });

  it('rotate -> ok triggers rotation', async () => {
    const result = await kernel.invokeConcept('urn:clef/AwsSmProvider', 'rotate', {
      secretId: 'prod/db/password',
    });
    expect(result.variant).toBe('ok');
    expect(result.newVersionId).toBeDefined();
  });
});

describe('PulumiProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/PulumiProvider', pulumiProviderHandler);
  });

  it('generate -> ok creates stack files', async () => {
    const result = await kernel.invokeConcept('urn:clef/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('index.ts');
  });

  it('preview -> ok shows planned changes', async () => {
    const gen = await kernel.invokeConcept('urn:clef/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/PulumiProvider', 'preview', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
  });

  it('apply -> ok applies stack', async () => {
    const gen = await kernel.invokeConcept('urn:clef/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/PulumiProvider', 'apply', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
  });

  it('teardown -> ok destroys stack', async () => {
    const gen = await kernel.invokeConcept('urn:clef/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/PulumiProvider', 'teardown', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
    expect(result.destroyed).toContain(gen.stack);
  });
});

describe('TerraformProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/TerraformProvider', terraformProviderHandler);
  });

  it('generate -> ok creates workspace files', async () => {
    const result = await kernel.invokeConcept('urn:clef/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('main.tf');
  });

  it('preview -> ok shows planned changes', async () => {
    const gen = await kernel.invokeConcept('urn:clef/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/TerraformProvider', 'preview', {
      workspace: gen.workspace,
    });
    expect(result.variant).toBe('ok');
  });

  it('preview -> backendInitRequired for unknown workspace', async () => {
    const result = await kernel.invokeConcept('urn:clef/TerraformProvider', 'preview', {
      workspace: 'nonexistent',
    });
    expect(result.variant).toBe('backendInitRequired');
  });

  it('apply -> ok applies workspace', async () => {
    const gen = await kernel.invokeConcept('urn:clef/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/TerraformProvider', 'apply', {
      workspace: gen.workspace,
    });
    expect(result.variant).toBe('ok');
  });

  it('teardown -> ok destroys workspace', async () => {
    const gen = await kernel.invokeConcept('urn:clef/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/TerraformProvider', 'teardown', {
      workspace: gen.workspace,
    });
    expect(result.variant).toBe('ok');
    expect(result.destroyed).toContain(gen.workspace);
  });
});

// ============================================================
// Additional Provider Implementations
// ============================================================

describe('CloudRunRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/CloudRunRuntime', cloudRunRuntimeHandler);
  });

  it('provision -> ok creates Cloud Run service', async () => {
    const result = await kernel.invokeConcept('urn:clef/CloudRunRuntime', 'provision', {
      concept: 'User', projectId: 'my-project', region: 'us-central1', cpu: 1, memory: 512,
    });
    expect(result.variant).toBe('ok');
    expect(result.serviceUrl).toContain('.run.app');
  });

  it('deploy -> ok deploys new revision', async () => {
    const svc = await kernel.invokeConcept('urn:clef/CloudRunRuntime', 'provision', {
      concept: 'User', projectId: 'my-project', region: 'us-central1', cpu: 1, memory: 512,
    });
    const result = await kernel.invokeConcept('urn:clef/CloudRunRuntime', 'deploy', {
      service: svc.service, imageUri: 'gcr.io/my-project/user:latest',
    });
    expect(result.variant).toBe('ok');
    expect(result.revision).toBeDefined();
  });

  it('rollback -> ok restores revision', async () => {
    const svc = await kernel.invokeConcept('urn:clef/CloudRunRuntime', 'provision', {
      concept: 'User', projectId: 'my-project', region: 'us-central1', cpu: 1, memory: 512,
    });
    const result = await kernel.invokeConcept('urn:clef/CloudRunRuntime', 'rollback', {
      service: svc.service, targetRevision: 'rev-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.restoredRevision).toBe('rev-1');
  });

  it('destroy -> ok removes service', async () => {
    const svc = await kernel.invokeConcept('urn:clef/CloudRunRuntime', 'provision', {
      concept: 'User', projectId: 'my-project', region: 'us-central1', cpu: 1, memory: 512,
    });
    const result = await kernel.invokeConcept('urn:clef/CloudRunRuntime', 'destroy', {
      service: svc.service,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('GcfRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/GcfRuntime', gcfRuntimeHandler);
  });

  it('provision -> ok creates function', async () => {
    const result = await kernel.invokeConcept('urn:clef/GcfRuntime', 'provision', {
      concept: 'User', projectId: 'my-project', region: 'us-central1',
      runtime: 'nodejs20', triggerType: 'http',
    });
    expect(result.variant).toBe('ok');
    expect(result.endpoint).toContain('cloudfunctions.net');
  });

  it('deploy -> ok deploys source', async () => {
    const fn = await kernel.invokeConcept('urn:clef/GcfRuntime', 'provision', {
      concept: 'User', projectId: 'my-project', region: 'us-central1',
      runtime: 'nodejs20', triggerType: 'http',
    });
    const result = await kernel.invokeConcept('urn:clef/GcfRuntime', 'deploy', {
      function: fn.function, sourceArchive: 'gs://bucket/source.zip',
    });
    expect(result.variant).toBe('ok');
    expect(result.version).toBeDefined();
  });

  it('destroy -> ok removes function', async () => {
    const fn = await kernel.invokeConcept('urn:clef/GcfRuntime', 'provision', {
      concept: 'User', projectId: 'my-project', region: 'us-central1',
      runtime: 'nodejs20', triggerType: 'http',
    });
    const result = await kernel.invokeConcept('urn:clef/GcfRuntime', 'destroy', {
      function: fn.function,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('CloudflareRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/CloudflareRuntime', cloudflareRuntimeHandler);
  });

  it('provision -> ok creates worker', async () => {
    const result = await kernel.invokeConcept('urn:clef/CloudflareRuntime', 'provision', {
      concept: 'User', accountId: 'abc123', routes: ['example.com/*'],
    });
    expect(result.variant).toBe('ok');
    expect(result.scriptName).toContain('worker');
    expect(result.endpoint).toContain('workers.dev');
  });

  it('deploy -> ok deploys script', async () => {
    const wkr = await kernel.invokeConcept('urn:clef/CloudflareRuntime', 'provision', {
      concept: 'User', accountId: 'abc123', routes: ['example.com/*'],
    });
    const result = await kernel.invokeConcept('urn:clef/CloudflareRuntime', 'deploy', {
      worker: wkr.worker, scriptContent: 'export default { fetch() {} }',
    });
    expect(result.variant).toBe('ok');
    expect(result.version).toBeDefined();
  });

  it('destroy -> ok removes worker', async () => {
    const wkr = await kernel.invokeConcept('urn:clef/CloudflareRuntime', 'provision', {
      concept: 'User', accountId: 'abc123', routes: ['example.com/*'],
    });
    const result = await kernel.invokeConcept('urn:clef/CloudflareRuntime', 'destroy', {
      worker: wkr.worker,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('VercelRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/VercelRuntime', vercelRuntimeHandler);
  });

  it('provision -> ok creates project', async () => {
    const result = await kernel.invokeConcept('urn:clef/VercelRuntime', 'provision', {
      concept: 'User', teamId: 'team-1', framework: 'nextjs',
    });
    expect(result.variant).toBe('ok');
    expect(result.endpoint).toContain('vercel.app');
  });

  it('deploy -> ok creates deployment', async () => {
    const prj = await kernel.invokeConcept('urn:clef/VercelRuntime', 'provision', {
      concept: 'User', teamId: 'team-1', framework: 'nextjs',
    });
    const result = await kernel.invokeConcept('urn:clef/VercelRuntime', 'deploy', {
      project: prj.project, sourceDirectory: './dist',
    });
    expect(result.variant).toBe('ok');
    expect(result.deploymentUrl).toContain('vercel.app');
  });

  it('rollback -> ok restores deployment', async () => {
    const prj = await kernel.invokeConcept('urn:clef/VercelRuntime', 'provision', {
      concept: 'User', teamId: 'team-1', framework: 'nextjs',
    });
    const result = await kernel.invokeConcept('urn:clef/VercelRuntime', 'rollback', {
      project: prj.project, targetDeploymentId: 'dpl-prev',
    });
    expect(result.variant).toBe('ok');
    expect(result.restoredDeploymentId).toBe('dpl-prev');
  });

  it('destroy -> ok removes project', async () => {
    const prj = await kernel.invokeConcept('urn:clef/VercelRuntime', 'provision', {
      concept: 'User', teamId: 'team-1', framework: 'nextjs',
    });
    const result = await kernel.invokeConcept('urn:clef/VercelRuntime', 'destroy', {
      project: prj.project,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('K8sRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/K8sRuntime', k8sRuntimeHandler);
  });

  it('provision -> ok creates deployment', async () => {
    const result = await kernel.invokeConcept('urn:clef/K8sRuntime', 'provision', {
      concept: 'User', namespace: 'default', cluster: 'prod', replicas: 2,
    });
    expect(result.variant).toBe('ok');
    expect(result.serviceName).toContain('-svc');
    expect(result.endpoint).toContain('svc.cluster.local');
  });

  it('deploy -> ok creates new revision', async () => {
    const dep = await kernel.invokeConcept('urn:clef/K8sRuntime', 'provision', {
      concept: 'User', namespace: 'default', cluster: 'prod', replicas: 2,
    });
    const result = await kernel.invokeConcept('urn:clef/K8sRuntime', 'deploy', {
      deployment: dep.deployment, imageUri: 'myregistry/user:latest',
    });
    expect(result.variant).toBe('ok');
    expect(result.revision).toBeDefined();
  });

  it('rollback -> ok restores revision', async () => {
    const dep = await kernel.invokeConcept('urn:clef/K8sRuntime', 'provision', {
      concept: 'User', namespace: 'default', cluster: 'prod', replicas: 2,
    });
    const result = await kernel.invokeConcept('urn:clef/K8sRuntime', 'rollback', {
      deployment: dep.deployment, targetRevision: 'rev-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.restoredRevision).toBe('rev-1');
  });

  it('deploy -> imagePullBackOff for auth issues', async () => {
    const dep = await kernel.invokeConcept('urn:clef/K8sRuntime', 'provision', {
      concept: 'User', namespace: 'default', cluster: 'prod', replicas: 2,
    });
    const result = await kernel.invokeConcept('urn:clef/K8sRuntime', 'deploy', {
      deployment: dep.deployment, imageUri: 'private.registry/user:latest', simulatePullBackOff: true,
    });
    expect(result.variant).toBe('imagePullBackOff');
    expect(result.reason).toContain('authentication');
  });

  it('deploy -> oomKilled when memory limit exceeded', async () => {
    const dep = await kernel.invokeConcept('urn:clef/K8sRuntime', 'provision', {
      concept: 'User', namespace: 'default', cluster: 'prod', replicas: 2,
    });
    const result = await kernel.invokeConcept('urn:clef/K8sRuntime', 'deploy', {
      deployment: dep.deployment, imageUri: 'myregistry/user:latest', simulateOomKill: true,
    });
    expect(result.variant).toBe('oomKilled');
    expect(result.podName).toBeDefined();
    expect(result.memoryLimit).toBeDefined();
  });

  it('destroy -> ok removes deployment', async () => {
    const dep = await kernel.invokeConcept('urn:clef/K8sRuntime', 'provision', {
      concept: 'User', namespace: 'default', cluster: 'prod', replicas: 2,
    });
    const result = await kernel.invokeConcept('urn:clef/K8sRuntime', 'destroy', {
      deployment: dep.deployment,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('DockerComposeRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/DockerComposeRuntime', dockerComposeRuntimeHandler);
  });

  it('provision -> ok creates service', async () => {
    const result = await kernel.invokeConcept('urn:clef/DockerComposeRuntime', 'provision', {
      concept: 'User', composePath: './docker-compose.yml', ports: ['8080:80'],
    });
    expect(result.variant).toBe('ok');
    expect(result.serviceName).toBeDefined();
  });

  it('deploy -> ok deploys image', async () => {
    const svc = await kernel.invokeConcept('urn:clef/DockerComposeRuntime', 'provision', {
      concept: 'User', composePath: './docker-compose.yml', ports: ['8080:80'],
    });
    const result = await kernel.invokeConcept('urn:clef/DockerComposeRuntime', 'deploy', {
      service: svc.service, imageUri: 'user:latest',
    });
    expect(result.variant).toBe('ok');
    expect(result.containerId).toBeDefined();
  });

  it('destroy -> ok removes service', async () => {
    const svc = await kernel.invokeConcept('urn:clef/DockerComposeRuntime', 'provision', {
      concept: 'User', composePath: './docker-compose.yml', ports: ['8080:80'],
    });
    const result = await kernel.invokeConcept('urn:clef/DockerComposeRuntime', 'destroy', {
      service: svc.service,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('LocalRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/LocalRuntime', localRuntimeHandler);
  });

  it('provision -> ok starts local process', async () => {
    const result = await kernel.invokeConcept('urn:clef/LocalRuntime', 'provision', {
      concept: 'User', command: 'node server.js', port: 3000,
    });
    expect(result.variant).toBe('ok');
    expect(result.pid).toBeGreaterThan(0);
    expect(result.endpoint).toBe('http://localhost:3000');
  });

  it('deploy -> ok restarts with new command', async () => {
    const proc = await kernel.invokeConcept('urn:clef/LocalRuntime', 'provision', {
      concept: 'User', command: 'node server.js', port: 3000,
    });
    const result = await kernel.invokeConcept('urn:clef/LocalRuntime', 'deploy', {
      process: proc.process, command: 'node server-v2.js',
    });
    expect(result.variant).toBe('ok');
    expect(result.pid).toBeGreaterThan(0);
  });

  it('rollback -> ok restarts with previous command', async () => {
    const proc = await kernel.invokeConcept('urn:clef/LocalRuntime', 'provision', {
      concept: 'User', command: 'node server.js', port: 3000,
    });
    const result = await kernel.invokeConcept('urn:clef/LocalRuntime', 'rollback', {
      process: proc.process, previousCommand: 'node server.js',
    });
    expect(result.variant).toBe('ok');
    expect(result.pid).toBeGreaterThan(0);
  });

  it('destroy -> ok kills process', async () => {
    const proc = await kernel.invokeConcept('urn:clef/LocalRuntime', 'provision', {
      concept: 'User', command: 'node server.js', port: 3000,
    });
    const result = await kernel.invokeConcept('urn:clef/LocalRuntime', 'destroy', {
      process: proc.process,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('GcpSmProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/GcpSmProvider', gcpSmProviderHandler);
  });

  it('fetch -> ok returns secret', async () => {
    const result = await kernel.invokeConcept('urn:clef/GcpSmProvider', 'fetch', {
      secretId: 'db-password', version: 'latest',
    });
    expect(result.variant).toBe('ok');
    expect(result.projectId).toBeDefined();
  });

  it('fetch -> secretNotFound for empty secretId', async () => {
    const result = await kernel.invokeConcept('urn:clef/GcpSmProvider', 'fetch', {
      secretId: '', version: 'latest',
    });
    expect(result.variant).toBe('secretNotFound');
  });

  it('rotate -> ok creates new version', async () => {
    const result = await kernel.invokeConcept('urn:clef/GcpSmProvider', 'rotate', {
      secretId: 'db-password',
    });
    expect(result.variant).toBe('ok');
    expect(result.newVersionId).toBeDefined();
  });
});

describe('EnvProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/EnvProvider', envProviderHandler);
  });

  it('fetch -> ok returns env value', async () => {
    const result = await kernel.invokeConcept('urn:clef/EnvProvider', 'fetch', {
      name: 'DATABASE_URL',
    });
    expect(result.variant).toBe('ok');
    expect(result.value).toBeDefined();
  });

  it('fetch -> variableNotSet for empty name', async () => {
    const result = await kernel.invokeConcept('urn:clef/EnvProvider', 'fetch', {
      name: '',
    });
    expect(result.variant).toBe('variableNotSet');
  });
});

describe('DotenvProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/DotenvProvider', dotenvProviderHandler);
  });

  it('fetch -> ok returns dotenv value', async () => {
    const result = await kernel.invokeConcept('urn:clef/DotenvProvider', 'fetch', {
      name: 'DB_HOST', filePath: '.env',
    });
    expect(result.variant).toBe('ok');
    expect(result.value).toBeDefined();
  });

  it('fetch -> fileNotFound for empty path', async () => {
    const result = await kernel.invokeConcept('urn:clef/DotenvProvider', 'fetch', {
      name: 'DB_HOST', filePath: '',
    });
    expect(result.variant).toBe('fileNotFound');
  });

  it('fetch -> variableNotSet for empty name', async () => {
    const result = await kernel.invokeConcept('urn:clef/DotenvProvider', 'fetch', {
      name: '', filePath: '.env',
    });
    expect(result.variant).toBe('variableNotSet');
  });
});

describe('CloudFormationProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/CloudFormationProvider', cloudFormationProviderHandler);
  });

  it('generate -> ok creates template files', async () => {
    const result = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'generate', {
      plan: 'plan-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('template.yaml');
  });

  it('preview -> ok shows change set', async () => {
    const gen = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'preview', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
    expect(result.changeSetId).toBeDefined();
  });

  it('preview -> changeSetEmpty for unknown stack', async () => {
    const result = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'preview', {
      stack: 'nonexistent',
    });
    expect(result.variant).toBe('changeSetEmpty');
  });

  it('apply -> ok creates stack', async () => {
    const gen = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'apply', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
    expect(result.stackId).toContain('arn:aws:cloudformation');
  });

  it('apply -> insufficientCapabilities when IAM capabilities missing', async () => {
    const gen = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'generate', {
      plan: 'plan-iam',
      requiredCapabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
    });
    const result = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'apply', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('insufficientCapabilities');
    expect(result.required).toContain('CAPABILITY_IAM');
  });

  it('teardown -> ok destroys stack', async () => {
    const gen = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/CloudFormationProvider', 'teardown', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
    expect(result.destroyed).toContain(gen.stack);
  });
});

describe('DockerComposeIacProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/DockerComposeIacProvider', dockerComposeIacProviderHandler);
  });

  it('generate -> ok creates compose file', async () => {
    const result = await kernel.invokeConcept('urn:clef/DockerComposeIacProvider', 'generate', {
      plan: 'plan-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('docker-compose.yml');
  });

  it('apply -> ok applies compose', async () => {
    const gen = await kernel.invokeConcept('urn:clef/DockerComposeIacProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/DockerComposeIacProvider', 'apply', {
      composeFile: gen.composeFile,
    });
    expect(result.variant).toBe('ok');
  });

  it('teardown -> ok destroys compose', async () => {
    const gen = await kernel.invokeConcept('urn:clef/DockerComposeIacProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:clef/DockerComposeIacProvider', 'teardown', {
      composeFile: gen.composeFile,
    });
    expect(result.variant).toBe('ok');
    expect(result.destroyed).toContain(gen.composeFile);
  });
});

describe('ArgoCDProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/ArgoCDProvider', argoCDProviderHandler);
  });

  it('emit -> ok generates application CRD', async () => {
    const result = await kernel.invokeConcept('urn:clef/ArgoCDProvider', 'emit', {
      plan: 'plan-1', repo: 'git@github.com:org/deploy.git', path: 'envs/prod',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('application.yaml');
  });

  it('reconciliationStatus -> ok after emit', async () => {
    const emit = await kernel.invokeConcept('urn:clef/ArgoCDProvider', 'emit', {
      plan: 'plan-1', repo: 'git@github.com:org/deploy.git', path: 'envs/prod',
    });
    const result = await kernel.invokeConcept('urn:clef/ArgoCDProvider', 'reconciliationStatus', {
      application: emit.application,
    });
    expect(result.variant).toBe('ok');
    expect(result.syncStatus).toBe('Synced');
    expect(result.healthStatus).toBe('Healthy');
  });

  it('reconciliationStatus -> failed for unknown app', async () => {
    const result = await kernel.invokeConcept('urn:clef/ArgoCDProvider', 'reconciliationStatus', {
      application: 'nonexistent',
    });
    expect(result.variant).toBe('failed');
  });

  it('syncWave -> ok sets wave ordering', async () => {
    const emit = await kernel.invokeConcept('urn:clef/ArgoCDProvider', 'emit', {
      plan: 'plan-1', repo: 'git@github.com:org/deploy.git', path: 'envs/prod',
    });
    const result = await kernel.invokeConcept('urn:clef/ArgoCDProvider', 'syncWave', {
      application: emit.application, wave: 1,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('FluxProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:clef/FluxProvider', fluxProviderHandler);
  });

  it('emit -> ok generates kustomization CRDs', async () => {
    const result = await kernel.invokeConcept('urn:clef/FluxProvider', 'emit', {
      plan: 'plan-1', repo: 'git@github.com:org/deploy.git', path: 'envs/prod',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('kustomization.yaml');
  });

  it('reconciliationStatus -> ok after emit', async () => {
    const emit = await kernel.invokeConcept('urn:clef/FluxProvider', 'emit', {
      plan: 'plan-1', repo: 'git@github.com:org/deploy.git', path: 'envs/prod',
    });
    const result = await kernel.invokeConcept('urn:clef/FluxProvider', 'reconciliationStatus', {
      kustomization: emit.kustomization,
    });
    expect(result.variant).toBe('ok');
    expect(result.readyStatus).toBe('True');
  });

  it('reconciliationStatus -> failed for unknown kustomization', async () => {
    const result = await kernel.invokeConcept('urn:clef/FluxProvider', 'reconciliationStatus', {
      kustomization: 'nonexistent',
    });
    expect(result.variant).toBe('failed');
  });

  it('helmRelease -> ok creates helm release', async () => {
    const emit = await kernel.invokeConcept('urn:clef/FluxProvider', 'emit', {
      plan: 'plan-1', repo: 'git@github.com:org/deploy.git', path: 'envs/prod',
    });
    const result = await kernel.invokeConcept('urn:clef/FluxProvider', 'helmRelease', {
      kustomization: emit.kustomization, chart: 'nginx', values: 'replicas: 2',
    });
    expect(result.variant).toBe('ok');
    expect(result.releaseName).toContain('nginx');
  });
});
