// Deploy Kit Implementation Tests
// Tests all 17 concept handler implementations for the deploy kit,
// verifying action variants, storage behavior, and invariant contracts.
import { describe, it, expect, beforeEach } from 'vitest';
import { createKernel } from '../implementations/typescript/framework/kernel-factory.js';

// --- Orchestration handlers ---
import { deployPlanHandler } from '../implementations/typescript/deploy/deploy-plan.impl.js';
import { rolloutHandler } from '../implementations/typescript/deploy/rollout.impl.js';
import { migrationHandler } from '../implementations/typescript/deploy/migration.impl.js';
import { healthHandler } from '../implementations/typescript/deploy/health.impl.js';
import { envHandler } from '../implementations/typescript/deploy/env.impl.js';
import { telemetryHandler } from '../implementations/typescript/deploy/telemetry.impl.js';
import { artifactHandler } from '../implementations/typescript/deploy/artifact.impl.js';

// --- Coordination handlers ---
import { runtimeHandler } from '../implementations/typescript/deploy/runtime.impl.js';
import { secretHandler } from '../implementations/typescript/deploy/secret.impl.js';
import { iacHandler } from '../implementations/typescript/deploy/iac.impl.js';
import { gitopsHandler } from '../implementations/typescript/deploy/gitops.impl.js';

// --- Provider handlers ---
import { lambdaRuntimeHandler } from '../implementations/typescript/deploy/lambda-runtime.impl.js';
import { ecsRuntimeHandler } from '../implementations/typescript/deploy/ecs-runtime.impl.js';
import { vaultProviderHandler } from '../implementations/typescript/deploy/vault-provider.impl.js';
import { awsSmProviderHandler } from '../implementations/typescript/deploy/aws-sm-provider.impl.js';
import { pulumiProviderHandler } from '../implementations/typescript/deploy/pulumi-provider.impl.js';
import { terraformProviderHandler } from '../implementations/typescript/deploy/terraform-provider.impl.js';

// ============================================================
// Orchestration Concept Implementations
// ============================================================

describe('DeployPlan Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:copf/DeployPlan', deployPlanHandler);
  });

  it('plan -> ok creates a deployment plan', async () => {
    const result = await kernel.invokeConcept('urn:copf/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    expect(result.variant).toBe('ok');
    expect(result.plan).toBeDefined();
    expect(result.graph).toBeDefined();
    expect(result.estimatedDuration).toBe(300);
  });

  it('plan -> invalidManifest for empty manifest', async () => {
    const result = await kernel.invokeConcept('urn:copf/DeployPlan', 'plan', {
      manifest: '', environment: 'staging',
    });
    expect(result.variant).toBe('invalidManifest');
  });

  it('validate -> ok for existing plan', async () => {
    const plan = await kernel.invokeConcept('urn:copf/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    const result = await kernel.invokeConcept('urn:copf/DeployPlan', 'validate', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
  });

  it('execute -> ok for validated plan', async () => {
    const plan = await kernel.invokeConcept('urn:copf/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    await kernel.invokeConcept('urn:copf/DeployPlan', 'validate', {
      plan: plan.plan,
    });
    const result = await kernel.invokeConcept('urn:copf/DeployPlan', 'execute', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
    expect(result.duration).toBeDefined();
    expect(result.nodesDeployed).toBeDefined();
  });

  it('rollback -> ok for executed plan', async () => {
    const plan = await kernel.invokeConcept('urn:copf/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    await kernel.invokeConcept('urn:copf/DeployPlan', 'execute', {
      plan: plan.plan,
    });
    const result = await kernel.invokeConcept('urn:copf/DeployPlan', 'rollback', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
  });

  it('status -> ok for existing plan', async () => {
    const plan = await kernel.invokeConcept('urn:copf/DeployPlan', 'plan', {
      manifest: 'my-kit', environment: 'staging',
    });
    const result = await kernel.invokeConcept('urn:copf/DeployPlan', 'status', {
      plan: plan.plan,
    });
    expect(result.variant).toBe('ok');
    expect(result.phase).toBe('planned');
  });

  it('status -> notfound for unknown plan', async () => {
    const result = await kernel.invokeConcept('urn:copf/DeployPlan', 'status', {
      plan: 'nonexistent',
    });
    expect(result.variant).toBe('notfound');
  });

  it('invariant: plan -> validate -> execute succeeds', async () => {
    const p = await kernel.invokeConcept('urn:copf/DeployPlan', 'plan', {
      manifest: 'valid-manifest', environment: 'staging',
    });
    expect(p.variant).toBe('ok');
    const v = await kernel.invokeConcept('urn:copf/DeployPlan', 'validate', {
      plan: p.plan,
    });
    expect(v.variant).toBe('ok');
    const e = await kernel.invokeConcept('urn:copf/DeployPlan', 'execute', {
      plan: p.plan,
    });
    expect(e.variant).toBe('ok');
  });
});

describe('Rollout Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:copf/Rollout', rolloutHandler);
  });

  it('begin -> ok with valid strategy', async () => {
    const result = await kernel.invokeConcept('urn:copf/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '50%', '100%'],
    });
    expect(result.variant).toBe('ok');
    expect(result.rollout).toBeDefined();
  });

  it('begin -> invalidStrategy for unknown strategy', async () => {
    const result = await kernel.invokeConcept('urn:copf/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'chaos', steps: [],
    });
    expect(result.variant).toBe('invalidStrategy');
  });

  it('advance -> ok increments step', async () => {
    const r = await kernel.invokeConcept('urn:copf/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'linear', steps: ['25%', '50%', '75%', '100%'],
    });
    const result = await kernel.invokeConcept('urn:copf/Rollout', 'advance', {
      rollout: r.rollout,
    });
    expect(result.variant).toBe('ok');
    expect(result.step).toBe(1);
  });

  it('advance -> complete when all steps done', async () => {
    const r = await kernel.invokeConcept('urn:copf/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'immediate', steps: ['100%'],
    });
    const result = await kernel.invokeConcept('urn:copf/Rollout', 'advance', {
      rollout: r.rollout,
    });
    expect(result.variant).toBe('complete');
  });

  it('pause -> ok and resume -> ok', async () => {
    const r = await kernel.invokeConcept('urn:copf/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '100%'],
    });
    const pause = await kernel.invokeConcept('urn:copf/Rollout', 'pause', {
      rollout: r.rollout, reason: 'metrics degraded',
    });
    expect(pause.variant).toBe('ok');
    const resume = await kernel.invokeConcept('urn:copf/Rollout', 'resume', {
      rollout: r.rollout,
    });
    expect(resume.variant).toBe('ok');
  });

  it('abort -> ok for active rollout', async () => {
    const r = await kernel.invokeConcept('urn:copf/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '100%'],
    });
    const result = await kernel.invokeConcept('urn:copf/Rollout', 'abort', {
      rollout: r.rollout,
    });
    expect(result.variant).toBe('ok');
  });

  it('status -> ok returns rollout state', async () => {
    const r = await kernel.invokeConcept('urn:copf/Rollout', 'begin', {
      plan: 'plan-1', strategy: 'canary', steps: ['10%', '100%'],
    });
    const result = await kernel.invokeConcept('urn:copf/Rollout', 'status', {
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
    kernel.registerConcept('urn:copf/Migration', migrationHandler);
  });

  it('plan -> ok for version upgrade', async () => {
    const result = await kernel.invokeConcept('urn:copf/Migration', 'plan', {
      concept: 'User', fromVersion: 1, toVersion: 3,
    });
    expect(result.variant).toBe('ok');
    expect(result.steps).toHaveLength(2);
  });

  it('plan -> noMigrationNeeded for same version', async () => {
    const result = await kernel.invokeConcept('urn:copf/Migration', 'plan', {
      concept: 'User', fromVersion: 2, toVersion: 2,
    });
    expect(result.variant).toBe('noMigrationNeeded');
  });

  it('expand-migrate-contract chain succeeds', async () => {
    const plan = await kernel.invokeConcept('urn:copf/Migration', 'plan', {
      concept: 'User', fromVersion: 1, toVersion: 2,
    });
    const expand = await kernel.invokeConcept('urn:copf/Migration', 'expand', {
      migration: plan.migration,
    });
    expect(expand.variant).toBe('ok');
    const migrate = await kernel.invokeConcept('urn:copf/Migration', 'migrate', {
      migration: plan.migration,
    });
    expect(migrate.variant).toBe('ok');
    const contract = await kernel.invokeConcept('urn:copf/Migration', 'contract', {
      migration: plan.migration,
    });
    expect(contract.variant).toBe('ok');
  });

  it('status tracks migration progress', async () => {
    const plan = await kernel.invokeConcept('urn:copf/Migration', 'plan', {
      concept: 'User', fromVersion: 1, toVersion: 2,
    });
    const status = await kernel.invokeConcept('urn:copf/Migration', 'status', {
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
    kernel.registerConcept('urn:copf/Health', healthHandler);
  });

  it('checkConcept -> ok returns latency', async () => {
    const result = await kernel.invokeConcept('urn:copf/Health', 'checkConcept', {
      concept: 'User', runtime: 'lambda',
    });
    expect(result.variant).toBe('ok');
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('checkSync -> ok returns roundTripMs', async () => {
    const result = await kernel.invokeConcept('urn:copf/Health', 'checkSync', {
      sync: 'LoginFlow', concepts: ['User', 'Password'],
    });
    expect(result.variant).toBe('ok');
    expect(result.roundTripMs).toBeGreaterThan(0);
  });

  it('checkKit -> ok returns results arrays', async () => {
    const result = await kernel.invokeConcept('urn:copf/Health', 'checkKit', {
      kit: 'deploy', environment: 'staging',
    });
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.conceptResults)).toBe(true);
  });

  it('checkInvariant -> ok verifies behavioral contract', async () => {
    const result = await kernel.invokeConcept('urn:copf/Health', 'checkInvariant', {
      concept: 'User', invariant: 'create-then-get',
    });
    expect(result.variant).toBe('ok');
  });
});

describe('Env Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:copf/Env', envHandler);
  });

  it('resolve -> ok returns resolved config', async () => {
    const result = await kernel.invokeConcept('urn:copf/Env', 'resolve', {
      environment: 'staging',
    });
    expect(result.variant).toBe('ok');
    expect(result.resolved).toBeDefined();
  });

  it('resolve -> missingBase for empty environment', async () => {
    const result = await kernel.invokeConcept('urn:copf/Env', 'resolve', {
      environment: '',
    });
    expect(result.variant).toBe('missingBase');
  });

  it('promote -> ok promotes from one env to another', async () => {
    const env = await kernel.invokeConcept('urn:copf/Env', 'resolve', {
      environment: 'staging',
    });
    const result = await kernel.invokeConcept('urn:copf/Env', 'promote', {
      fromEnv: env.environment, toEnv: 'production', kitName: 'deploy',
    });
    expect(result.variant).toBe('ok');
    expect(result.version).toBeDefined();
  });

  it('diff -> ok returns differences', async () => {
    const result = await kernel.invokeConcept('urn:copf/Env', 'diff', {
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
    kernel.registerConcept('urn:copf/Telemetry', telemetryHandler);
  });

  it('configure -> ok creates telemetry config', async () => {
    const result = await kernel.invokeConcept('urn:copf/Telemetry', 'configure', {
      concept: 'User', endpoint: 'https://otel.local', samplingRate: 0.1,
    });
    expect(result.variant).toBe('ok');
    expect(result.config).toBeDefined();
  });

  it('deployMarker -> ok emits a marker', async () => {
    const result = await kernel.invokeConcept('urn:copf/Telemetry', 'deployMarker', {
      kit: 'deploy', version: '1.0.0', environment: 'staging', status: 'started',
    });
    expect(result.variant).toBe('ok');
    expect(result.marker).toBeDefined();
  });

  it('analyze -> insufficientData when no config exists', async () => {
    const result = await kernel.invokeConcept('urn:copf/Telemetry', 'analyze', {
      concept: 'Unknown', window: 300, criteria: 'errorRate < 0.01',
    });
    expect(result.variant).toBe('insufficientData');
  });

  it('analyze -> ok when telemetry is configured', async () => {
    await kernel.invokeConcept('urn:copf/Telemetry', 'configure', {
      concept: 'User', endpoint: 'https://otel.local', samplingRate: 0.1,
    });
    const result = await kernel.invokeConcept('urn:copf/Telemetry', 'analyze', {
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
    kernel.registerConcept('urn:copf/Artifact', artifactHandler);
  });

  it('build -> ok produces content-addressed artifact', async () => {
    const result = await kernel.invokeConcept('urn:copf/Artifact', 'build', {
      concept: 'User', spec: 'user.concept', implementation: 'user.impl.ts', deps: [],
    });
    expect(result.variant).toBe('ok');
    expect(result.hash).toBeDefined();
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('build -> compilationError for missing spec', async () => {
    const result = await kernel.invokeConcept('urn:copf/Artifact', 'build', {
      concept: 'User', spec: '', implementation: '', deps: [],
    });
    expect(result.variant).toBe('compilationError');
  });

  it('resolve -> ok finds artifact by hash', async () => {
    const built = await kernel.invokeConcept('urn:copf/Artifact', 'build', {
      concept: 'User', spec: 'user.concept', implementation: 'user.impl.ts', deps: [],
    });
    const result = await kernel.invokeConcept('urn:copf/Artifact', 'resolve', {
      hash: built.hash,
    });
    expect(result.variant).toBe('ok');
    expect(result.location).toBeDefined();
  });

  it('resolve -> notfound for unknown hash', async () => {
    const result = await kernel.invokeConcept('urn:copf/Artifact', 'resolve', {
      hash: 'sha256-nonexistent',
    });
    expect(result.variant).toBe('notfound');
  });

  it('gc -> ok returns cleanup metrics', async () => {
    const result = await kernel.invokeConcept('urn:copf/Artifact', 'gc', {
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
    kernel.registerConcept('urn:copf/Runtime', runtimeHandler);
  });

  it('provision -> ok creates runtime instance', async () => {
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    expect(result.variant).toBe('ok');
    expect(result.instance).toBeDefined();
    expect(result.endpoint).toBeDefined();
  });

  it('provision -> alreadyProvisioned on duplicate', async () => {
    await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    expect(result.variant).toBe('alreadyProvisioned');
  });

  it('deploy -> ok updates version', async () => {
    const prov = await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'deploy', {
      instance: prov.instance, artifact: 'art-123', version: 'v2',
    });
    expect(result.variant).toBe('ok');
  });

  it('rollback -> ok reverts to previous version', async () => {
    const prov = await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    await kernel.invokeConcept('urn:copf/Runtime', 'deploy', {
      instance: prov.instance, artifact: 'art-123', version: 'v1',
    });
    await kernel.invokeConcept('urn:copf/Runtime', 'deploy', {
      instance: prov.instance, artifact: 'art-456', version: 'v2',
    });
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'rollback', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('ok');
    expect(result.previousVersion).toBe('v1');
  });

  it('rollback -> noHistory when no previous versions', async () => {
    const prov = await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'rollback', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('noHistory');
  });

  it('destroy -> ok removes instance', async () => {
    const prov = await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'destroy', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('ok');
  });

  it('healthCheck -> ok returns latency', async () => {
    const prov = await kernel.invokeConcept('urn:copf/Runtime', 'provision', {
      concept: 'User', runtimeType: 'lambda', config: '{}',
    });
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'healthCheck', {
      instance: prov.instance,
    });
    expect(result.variant).toBe('ok');
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('healthCheck -> unreachable for unknown instance', async () => {
    const result = await kernel.invokeConcept('urn:copf/Runtime', 'healthCheck', {
      instance: 'nonexistent',
    });
    expect(result.variant).toBe('unreachable');
  });
});

describe('Secret Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:copf/Secret', secretHandler);
  });

  it('resolve -> ok fetches and caches secret', async () => {
    const result = await kernel.invokeConcept('urn:copf/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    expect(result.variant).toBe('ok');
    expect(result.secret).toBeDefined();
    expect(result.version).toBeDefined();
  });

  it('exists -> ok returns existence check', async () => {
    await kernel.invokeConcept('urn:copf/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    const result = await kernel.invokeConcept('urn:copf/Secret', 'exists', {
      name: 'db-password', provider: 'vault',
    });
    expect(result.variant).toBe('ok');
    expect(result.exists).toBe(true);
  });

  it('rotate -> ok creates new version', async () => {
    await kernel.invokeConcept('urn:copf/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    const result = await kernel.invokeConcept('urn:copf/Secret', 'rotate', {
      name: 'db-password', provider: 'vault',
    });
    expect(result.variant).toBe('ok');
    expect(result.newVersion).toBeDefined();
  });

  it('invalidateCache -> ok clears cache', async () => {
    await kernel.invokeConcept('urn:copf/Secret', 'resolve', {
      name: 'db-password', provider: 'vault',
    });
    const result = await kernel.invokeConcept('urn:copf/Secret', 'invalidateCache', {
      name: 'db-password',
    });
    expect(result.variant).toBe('ok');
  });
});

describe('IaC Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:copf/IaC', iacHandler);
  });

  it('emit -> ok generates IaC files', async () => {
    const result = await kernel.invokeConcept('urn:copf/IaC', 'emit', {
      plan: 'plan-1', provider: 'terraform',
    });
    expect(result.variant).toBe('ok');
    expect(result.fileCount).toBeGreaterThan(0);
  });

  it('preview -> ok shows planned changes', async () => {
    const result = await kernel.invokeConcept('urn:copf/IaC', 'preview', {
      plan: 'plan-1', provider: 'terraform',
    });
    expect(result.variant).toBe('ok');
    expect(Array.isArray(result.toCreate)).toBe(true);
  });

  it('apply -> ok applies changes', async () => {
    const result = await kernel.invokeConcept('urn:copf/IaC', 'apply', {
      plan: 'plan-1', provider: 'pulumi',
    });
    expect(result.variant).toBe('ok');
  });

  it('detectDrift -> noDrift when state is clean', async () => {
    const result = await kernel.invokeConcept('urn:copf/IaC', 'detectDrift', {
      provider: 'terraform',
    });
    expect(result.variant).toBe('noDrift');
  });

  it('teardown -> ok destroys resources', async () => {
    const result = await kernel.invokeConcept('urn:copf/IaC', 'teardown', {
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
    kernel.registerConcept('urn:copf/GitOps', gitopsHandler);
  });

  it('emit -> ok generates manifests for argocd', async () => {
    const result = await kernel.invokeConcept('urn:copf/GitOps', 'emit', {
      plan: 'plan-1', controller: 'argocd', repo: 'my-repo', path: 'k8s',
    });
    expect(result.variant).toBe('ok');
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('emit -> controllerUnsupported for unknown controller', async () => {
    const result = await kernel.invokeConcept('urn:copf/GitOps', 'emit', {
      plan: 'plan-1', controller: 'unknown', repo: 'my-repo', path: 'k8s',
    });
    expect(result.variant).toBe('controllerUnsupported');
  });

  it('reconciliationStatus -> pending for new manifest', async () => {
    const emit = await kernel.invokeConcept('urn:copf/GitOps', 'emit', {
      plan: 'plan-1', controller: 'flux', repo: 'my-repo', path: 'k8s',
    });
    const result = await kernel.invokeConcept('urn:copf/GitOps', 'reconciliationStatus', {
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
    kernel.registerConcept('urn:copf/LambdaRuntime', lambdaRuntimeHandler);
  });

  it('provision -> ok creates Lambda function', async () => {
    const result = await kernel.invokeConcept('urn:copf/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.functionArn).toContain('arn:aws:lambda');
  });

  it('deploy -> ok deploys to function', async () => {
    const fn = await kernel.invokeConcept('urn:copf/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    const result = await kernel.invokeConcept('urn:copf/LambdaRuntime', 'deploy', {
      function: fn.function, artifactLocation: 's3://bucket/code.zip',
    });
    expect(result.variant).toBe('ok');
    expect(result.version).toBeDefined();
  });

  it('rollback -> ok restores target version', async () => {
    const fn = await kernel.invokeConcept('urn:copf/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    const result = await kernel.invokeConcept('urn:copf/LambdaRuntime', 'rollback', {
      function: fn.function, targetVersion: 'v1',
    });
    expect(result.variant).toBe('ok');
    expect(result.restoredVersion).toBe('v1');
  });

  it('destroy -> ok removes function', async () => {
    const fn = await kernel.invokeConcept('urn:copf/LambdaRuntime', 'provision', {
      concept: 'User', memory: 256, timeout: 30, region: 'us-east-1',
    });
    const result = await kernel.invokeConcept('urn:copf/LambdaRuntime', 'destroy', {
      function: fn.function,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('EcsRuntime Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:copf/EcsRuntime', ecsRuntimeHandler);
  });

  it('provision -> ok creates ECS service', async () => {
    const result = await kernel.invokeConcept('urn:copf/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: 'default',
    });
    expect(result.variant).toBe('ok');
    expect(result.serviceArn).toContain('arn:aws:ecs');
  });

  it('provision -> clusterNotFound for empty cluster', async () => {
    const result = await kernel.invokeConcept('urn:copf/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: '',
    });
    expect(result.variant).toBe('clusterNotFound');
  });

  it('deploy -> ok creates task definition', async () => {
    const svc = await kernel.invokeConcept('urn:copf/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: 'default',
    });
    const result = await kernel.invokeConcept('urn:copf/EcsRuntime', 'deploy', {
      service: svc.service, imageUri: '123456789.dkr.ecr.us-east-1.amazonaws.com/user:latest',
    });
    expect(result.variant).toBe('ok');
    expect(result.taskDefinition).toBeDefined();
  });

  it('destroy -> ok removes service', async () => {
    const svc = await kernel.invokeConcept('urn:copf/EcsRuntime', 'provision', {
      concept: 'User', cpu: 256, memory: 512, cluster: 'default',
    });
    const result = await kernel.invokeConcept('urn:copf/EcsRuntime', 'destroy', {
      service: svc.service,
    });
    expect(result.variant).toBe('ok');
  });
});

describe('VaultProvider Implementation', () => {
  let kernel: ReturnType<typeof createKernel>;
  beforeEach(() => {
    kernel = createKernel();
    kernel.registerConcept('urn:copf/VaultProvider', vaultProviderHandler);
  });

  it('fetch -> ok returns secret with lease', async () => {
    const result = await kernel.invokeConcept('urn:copf/VaultProvider', 'fetch', {
      path: 'secret/data/db-password',
    });
    expect(result.variant).toBe('ok');
    expect(result.leaseId).toBeDefined();
    expect(result.leaseDuration).toBe(3600);
  });

  it('fetch -> pathNotFound for empty path', async () => {
    const result = await kernel.invokeConcept('urn:copf/VaultProvider', 'fetch', {
      path: '',
    });
    expect(result.variant).toBe('pathNotFound');
  });

  it('renewLease -> ok extends lease', async () => {
    const fetched = await kernel.invokeConcept('urn:copf/VaultProvider', 'fetch', {
      path: 'secret/data/db-password',
    });
    const result = await kernel.invokeConcept('urn:copf/VaultProvider', 'renewLease', {
      leaseId: fetched.leaseId,
    });
    expect(result.variant).toBe('ok');
    expect(result.newDuration).toBe(3600);
  });

  it('renewLease -> leaseExpired for unknown lease', async () => {
    const result = await kernel.invokeConcept('urn:copf/VaultProvider', 'renewLease', {
      leaseId: 'nonexistent',
    });
    expect(result.variant).toBe('leaseExpired');
  });

  it('rotate -> ok creates new version', async () => {
    const result = await kernel.invokeConcept('urn:copf/VaultProvider', 'rotate', {
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
    kernel.registerConcept('urn:copf/AwsSmProvider', awsSmProviderHandler);
  });

  it('fetch -> ok returns secret value', async () => {
    const result = await kernel.invokeConcept('urn:copf/AwsSmProvider', 'fetch', {
      secretId: 'prod/db/password', versionStage: 'AWSCURRENT',
    });
    expect(result.variant).toBe('ok');
    expect(result.arn).toContain('arn:aws:secretsmanager');
  });

  it('fetch -> resourceNotFound for empty secretId', async () => {
    const result = await kernel.invokeConcept('urn:copf/AwsSmProvider', 'fetch', {
      secretId: '', versionStage: 'AWSCURRENT',
    });
    expect(result.variant).toBe('resourceNotFound');
  });

  it('rotate -> ok triggers rotation', async () => {
    const result = await kernel.invokeConcept('urn:copf/AwsSmProvider', 'rotate', {
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
    kernel.registerConcept('urn:copf/PulumiProvider', pulumiProviderHandler);
  });

  it('generate -> ok creates stack files', async () => {
    const result = await kernel.invokeConcept('urn:copf/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('index.ts');
  });

  it('preview -> ok shows planned changes', async () => {
    const gen = await kernel.invokeConcept('urn:copf/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:copf/PulumiProvider', 'preview', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
  });

  it('apply -> ok applies stack', async () => {
    const gen = await kernel.invokeConcept('urn:copf/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:copf/PulumiProvider', 'apply', {
      stack: gen.stack,
    });
    expect(result.variant).toBe('ok');
  });

  it('teardown -> ok destroys stack', async () => {
    const gen = await kernel.invokeConcept('urn:copf/PulumiProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:copf/PulumiProvider', 'teardown', {
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
    kernel.registerConcept('urn:copf/TerraformProvider', terraformProviderHandler);
  });

  it('generate -> ok creates workspace files', async () => {
    const result = await kernel.invokeConcept('urn:copf/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    expect(result.variant).toBe('ok');
    expect(result.files).toContain('main.tf');
  });

  it('preview -> ok shows planned changes', async () => {
    const gen = await kernel.invokeConcept('urn:copf/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:copf/TerraformProvider', 'preview', {
      workspace: gen.workspace,
    });
    expect(result.variant).toBe('ok');
  });

  it('preview -> backendInitRequired for unknown workspace', async () => {
    const result = await kernel.invokeConcept('urn:copf/TerraformProvider', 'preview', {
      workspace: 'nonexistent',
    });
    expect(result.variant).toBe('backendInitRequired');
  });

  it('apply -> ok applies workspace', async () => {
    const gen = await kernel.invokeConcept('urn:copf/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:copf/TerraformProvider', 'apply', {
      workspace: gen.workspace,
    });
    expect(result.variant).toBe('ok');
  });

  it('teardown -> ok destroys workspace', async () => {
    const gen = await kernel.invokeConcept('urn:copf/TerraformProvider', 'generate', {
      plan: 'plan-1',
    });
    const result = await kernel.invokeConcept('urn:copf/TerraformProvider', 'teardown', {
      workspace: gen.workspace,
    });
    expect(result.variant).toBe('ok');
    expect(result.destroyed).toContain(gen.workspace);
  });
});
