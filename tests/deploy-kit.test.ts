// ============================================================
// Deploy Kit Tests
//
// Validates all concept specs, sync definitions, and suite.yaml
// for the deployment orchestration kit parse correctly.
// See Architecture doc: Deployment Layer Extension.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler';

const DEPLOY_DIR = resolve(__dirname, '../framework/deploy');
const CONCEPTS_DIR = resolve(DEPLOY_DIR, 'concepts');
const PROVIDERS_DIR = resolve(CONCEPTS_DIR, 'providers');

function readConcept(name: string): ReturnType<typeof parseConceptFile> {
  const source = readFileSync(resolve(CONCEPTS_DIR, name), 'utf-8');
  return parseConceptFile(source);
}

function readProvider(name: string): ReturnType<typeof parseConceptFile> {
  const source = readFileSync(resolve(PROVIDERS_DIR, name), 'utf-8');
  return parseConceptFile(source);
}

function readSync(category: string, name: string) {
  const source = readFileSync(resolve(DEPLOY_DIR, 'syncs', category, name), 'utf-8');
  return parseSyncFile(source);
}

// ============================================================
// Orchestration Concepts
// ============================================================

describe('Orchestration Concepts', () => {

  it('parses DeployPlan', () => {
    const ast = readConcept('deploy-plan.concept');
    expect(ast.name).toBe('DeployPlan');
    expect(ast.typeParams).toEqual(['D']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions.map(a => a.name)).toEqual(['plan', 'validate', 'execute', 'rollback', 'status']);
    // plan has 5 variants: ok, invalidManifest, incompleteGraph, circularDependency, transportMismatch
    expect(ast.actions[0].variants).toHaveLength(5);
    // validate has 3 variants: ok, migrationRequired, schemaIncompatible
    expect(ast.actions[1].variants).toHaveLength(3);
    // execute has 4 variants: ok, partial, rollbackTriggered, rollbackFailed
    expect(ast.actions[2].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
    expect(ast.state.length).toBeGreaterThan(0);
  });

  it('parses Rollout', () => {
    const ast = readConcept('rollout.concept');
    expect(ast.name).toBe('Rollout');
    expect(ast.typeParams).toEqual(['R']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(6);
    expect(ast.actions.map(a => a.name)).toEqual(['begin', 'advance', 'pause', 'resume', 'abort', 'status']);
    // advance has 3 variants: ok, complete, paused
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Migration', () => {
    const ast = readConcept('migration.concept');
    expect(ast.name).toBe('Migration');
    expect(ast.typeParams).toEqual(['M']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions.map(a => a.name)).toEqual(['plan', 'expand', 'migrate', 'contract', 'status']);
    // plan has 3 variants: ok, noMigrationNeeded, incompatible
    expect(ast.actions[0].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Health', () => {
    const ast = readConcept('health.concept');
    expect(ast.name).toBe('Health');
    expect(ast.typeParams).toEqual(['H']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['checkConcept', 'checkSync', 'checkKit', 'checkInvariant']);
    // checkConcept has 4 variants: ok, unreachable, storageFailed, degraded
    expect(ast.actions[0].variants).toHaveLength(4);
    // checkKit has 3 variants: ok, degraded, failed
    expect(ast.actions[2].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Env', () => {
    const ast = readConcept('env.concept');
    expect(ast.name).toBe('Env');
    expect(ast.typeParams).toEqual(['E']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions.map(a => a.name)).toEqual(['resolve', 'promote', 'diff']);
    // promote has 3 variants: ok, notValidated, versionMismatch
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Telemetry', () => {
    const ast = readConcept('telemetry.concept');
    expect(ast.name).toBe('Telemetry');
    expect(ast.typeParams).toEqual(['T']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions.map(a => a.name)).toEqual(['configure', 'deployMarker', 'analyze']);
    // analyze has 3 variants: ok, insufficientData, backendUnavailable
    expect(ast.actions[2].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Artifact', () => {
    const ast = readConcept('artifact.concept');
    expect(ast.name).toBe('Artifact');
    expect(ast.typeParams).toEqual(['A']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['build', 'store', 'resolve', 'gc']);
    // build has 2 variants: ok, compilationError
    expect(ast.actions[0].variants).toHaveLength(2);
    // resolve has 2 variants: ok, notfound
    expect(ast.actions[2].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });
});

// ============================================================
// Coordination Concepts
// ============================================================

describe('Coordination Concepts', () => {

  it('parses Runtime', () => {
    const ast = readConcept('runtime.concept');
    expect(ast.name).toBe('Runtime');
    expect(ast.typeParams).toEqual(['I']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(6);
    expect(ast.actions.map(a => a.name)).toEqual([
      'provision', 'deploy', 'setTrafficWeight', 'rollback', 'destroy', 'healthCheck',
    ]);
    // provision has 3 variants: ok, alreadyProvisioned, provisionFailed
    expect(ast.actions[0].variants).toHaveLength(3);
    // rollback has 3 variants: ok, noHistory, rollbackFailed
    expect(ast.actions[3].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Secret', () => {
    const ast = readConcept('secret.concept');
    expect(ast.name).toBe('Secret');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['resolve', 'exists', 'rotate', 'invalidateCache']);
    // resolve has 4 variants: ok, notFound, accessDenied, expired
    expect(ast.actions[0].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses IaC', () => {
    const ast = readConcept('iac.concept');
    expect(ast.name).toBe('IaC');
    expect(ast.typeParams).toEqual(['R']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions.map(a => a.name)).toEqual(['emit', 'preview', 'apply', 'detectDrift', 'teardown']);
    // apply has 3 variants: ok, partial, applyFailed
    expect(ast.actions[2].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses GitOps', () => {
    const ast = readConcept('gitops.concept');
    expect(ast.name).toBe('GitOps');
    expect(ast.typeParams).toEqual(['G']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['emit', 'reconciliationStatus']);
    // reconciliationStatus has 3 variants: ok, pending, failed
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });
});

// ============================================================
// Provider Concepts
// ============================================================

describe('Provider Concepts', () => {

  it('parses LambdaRuntime', () => {
    const ast = readProvider('lambda-runtime.concept');
    expect(ast.name).toBe('LambdaRuntime');
    expect(ast.typeParams).toEqual(['F']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions.map(a => a.name)).toEqual([
      'provision', 'deploy', 'setTrafficWeight', 'rollback', 'destroy',
    ]);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses EcsRuntime', () => {
    const ast = readProvider('ecs-runtime.concept');
    expect(ast.name).toBe('EcsRuntime');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions.map(a => a.name)).toEqual([
      'provision', 'deploy', 'setTrafficWeight', 'rollback', 'destroy',
    ]);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses VaultProvider', () => {
    const ast = readProvider('vault-provider.concept');
    expect(ast.name).toBe('VaultProvider');
    expect(ast.typeParams).toEqual(['V']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions.map(a => a.name)).toEqual(['fetch', 'renewLease', 'rotate']);
    // fetch has 4 variants: ok, sealed, tokenExpired, pathNotFound
    expect(ast.actions[0].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses AwsSmProvider', () => {
    const ast = readProvider('aws-sm-provider.concept');
    expect(ast.name).toBe('AwsSmProvider');
    expect(ast.typeParams).toEqual(['A']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['fetch', 'rotate']);
    // fetch has 4 variants: ok, kmsKeyInaccessible, resourceNotFound, decryptionFailed
    expect(ast.actions[0].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses PulumiProvider', () => {
    const ast = readProvider('pulumi-provider.concept');
    expect(ast.name).toBe('PulumiProvider');
    expect(ast.typeParams).toEqual(['P']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['generate', 'preview', 'apply', 'teardown']);
    // apply has 4 variants: ok, pluginMissing, conflictingUpdate, partial
    expect(ast.actions[2].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses TerraformProvider', () => {
    const ast = readProvider('terraform-provider.concept');
    expect(ast.name).toBe('TerraformProvider');
    expect(ast.typeParams).toEqual(['T']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['generate', 'preview', 'apply', 'teardown']);
    // preview has 3 variants: ok, stateLocked, backendInitRequired
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  // --- Additional Runtime Providers ---

  it('parses CloudRunRuntime', () => {
    const ast = readProvider('cloud-run-runtime.concept');
    expect(ast.name).toBe('CloudRunRuntime');
    expect(ast.typeParams).toEqual(['C']);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions.map(a => a.name)).toEqual(['provision', 'deploy', 'setTrafficWeight', 'rollback', 'destroy']);
    expect(ast.actions[0].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses GcfRuntime', () => {
    const ast = readProvider('gcf-runtime.concept');
    expect(ast.name).toBe('GcfRuntime');
    expect(ast.typeParams).toEqual(['G']);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions[0].variants).toHaveLength(3);
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses CloudflareRuntime', () => {
    const ast = readProvider('cloudflare-runtime.concept');
    expect(ast.name).toBe('CloudflareRuntime');
    expect(ast.typeParams).toEqual(['W']);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions[0].variants).toHaveLength(2);
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses VercelRuntime', () => {
    const ast = readProvider('vercel-runtime.concept');
    expect(ast.name).toBe('VercelRuntime');
    expect(ast.typeParams).toEqual(['V']);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions[0].variants).toHaveLength(2);
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses K8sRuntime', () => {
    const ast = readProvider('k8s-runtime.concept');
    expect(ast.name).toBe('K8sRuntime');
    expect(ast.typeParams).toEqual(['K']);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions[0].variants).toHaveLength(3);
    expect(ast.actions[1].variants).toHaveLength(5);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses DockerComposeRuntime', () => {
    const ast = readProvider('docker-compose-runtime.concept');
    expect(ast.name).toBe('DockerComposeRuntime');
    expect(ast.typeParams).toEqual(['D']);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions[0].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses LocalRuntime', () => {
    const ast = readProvider('local-runtime.concept');
    expect(ast.name).toBe('LocalRuntime');
    expect(ast.typeParams).toEqual(['L']);
    expect(ast.actions).toHaveLength(5);
    expect(ast.actions[0].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  // --- Additional Secret Providers ---

  it('parses GcpSmProvider', () => {
    const ast = readProvider('gcp-sm-provider.concept');
    expect(ast.name).toBe('GcpSmProvider');
    expect(ast.typeParams).toEqual(['G']);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions[0].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses EnvProvider', () => {
    const ast = readProvider('env-provider.concept');
    expect(ast.name).toBe('EnvProvider');
    expect(ast.typeParams).toEqual(['E']);
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses DotenvProvider', () => {
    const ast = readProvider('dotenv-provider.concept');
    expect(ast.name).toBe('DotenvProvider');
    expect(ast.typeParams).toEqual(['D']);
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  // --- Additional IaC Providers ---

  it('parses CloudFormationProvider', () => {
    const ast = readProvider('cloudformation-provider.concept');
    expect(ast.name).toBe('CloudFormationProvider');
    expect(ast.typeParams).toEqual(['C']);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.actions[2].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses DockerComposeIacProvider', () => {
    const ast = readProvider('docker-compose-iac-provider.concept');
    expect(ast.name).toBe('DockerComposeIacProvider');
    expect(ast.typeParams).toEqual(['I']);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions[2].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  // --- GitOps Providers ---

  it('parses ArgoCDProvider', () => {
    const ast = readProvider('argocd-provider.concept');
    expect(ast.name).toBe('ArgoCDProvider');
    expect(ast.typeParams).toEqual(['A']);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions[1].variants).toHaveLength(4);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses FluxProvider', () => {
    const ast = readProvider('flux-provider.concept');
    expect(ast.name).toBe('FluxProvider');
    expect(ast.typeParams).toEqual(['F']);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.actions[2].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });
});

// ============================================================
// Bulk Concept Validation
// ============================================================

describe('Bulk Concept Validation', () => {

  const allConcepts = [
    'deploy-plan.concept', 'rollout.concept', 'migration.concept',
    'health.concept', 'env.concept', 'telemetry.concept', 'artifact.concept',
    'runtime.concept', 'secret.concept', 'iac.concept', 'gitops.concept',
  ];

  const allProviders = [
    'lambda-runtime.concept', 'ecs-runtime.concept',
    'cloud-run-runtime.concept', 'gcf-runtime.concept',
    'cloudflare-runtime.concept', 'vercel-runtime.concept',
    'k8s-runtime.concept', 'docker-compose-runtime.concept',
    'local-runtime.concept',
    'vault-provider.concept', 'aws-sm-provider.concept',
    'gcp-sm-provider.concept', 'env-provider.concept',
    'dotenv-provider.concept',
    'pulumi-provider.concept', 'terraform-provider.concept',
    'cloudformation-provider.concept', 'docker-compose-iac-provider.concept',
    'argocd-provider.concept', 'flux-provider.concept',
  ];

  it('all 31 concepts parse without error and have required fields', () => {
    for (const file of allConcepts) {
      const ast = readConcept(file);
      expect(ast.name, `${file} should have a name`).toBeTruthy();
      expect(ast.typeParams.length, `${file} should have type params`).toBeGreaterThan(0);
      expect(ast.version, `${file} should have @version`).toBe(1);
      expect(ast.actions.length, `${file} should have actions`).toBeGreaterThan(0);
      expect(ast.state.length, `${file} should have state`).toBeGreaterThan(0);
    }

    for (const file of allProviders) {
      const ast = readProvider(file);
      expect(ast.name, `${file} should have a name`).toBeTruthy();
      expect(ast.typeParams.length, `${file} should have type params`).toBeGreaterThan(0);
      expect(ast.version, `${file} should have @version`).toBe(1);
      expect(ast.actions.length, `${file} should have actions`).toBeGreaterThan(0);
      expect(ast.state.length, `${file} should have state`).toBeGreaterThan(0);
    }
  });

  it('all 31 concepts have at least one invariant', () => {
    for (const file of allConcepts) {
      const ast = readConcept(file);
      expect(ast.invariants.length, `${file} should have invariants`).toBeGreaterThan(0);
    }
    for (const file of allProviders) {
      const ast = readProvider(file);
      expect(ast.invariants.length, `${file} should have invariants`).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Core & Migration Sync Parsing
// ============================================================

describe('Core & Migration Syncs', () => {

  it('parses ValidateBeforeExecute', () => {
    const syncs = readSync('core', 'validate-before-execute.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ValidateBeforeExecute');
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[0].when).toHaveLength(1);
    expect(syncs[0].then).toHaveLength(1);
    expect(syncs[0].then[0].concept).toContain('DeployPlan');
  });

  it('parses ExecuteAfterValidation', () => {
    const syncs = readSync('core', 'execute-after-validation.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ExecuteAfterValidation');
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[0].then[0].concept).toContain('Artifact');
  });

  it('parses MigrateBeforeExecute', () => {
    const syncs = readSync('core', 'migrate-before-execute.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('MigrateBeforeExecute');
    expect(syncs[0].then[0].concept).toContain('Migration');
  });

  it('parses ExpandAfterPlan', () => {
    const syncs = readSync('migration', 'expand-after-plan.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ExpandAfterPlan');
    expect(syncs[0].annotations).toContain('eager');
  });

  it('parses MigrateAfterExpand', () => {
    const syncs = readSync('migration', 'migrate-after-expand.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('MigrateAfterExpand');
  });

  it('parses ContractAfterMigrate as eventual', () => {
    const syncs = readSync('migration', 'contract-after-migrate.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ContractAfterMigrate');
    expect(syncs[0].annotations).toContain('eventual');
  });

  it('parses DeployAfterMigrate', () => {
    const syncs = readSync('migration', 'deploy-after-migrate.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('DeployAfterMigrate');
    expect(syncs[0].then[0].concept).toContain('DeployPlan');
  });
});

// ============================================================
// Progressive Delivery Syncs
// ============================================================

describe('Progressive Delivery Syncs', () => {

  it('parses BeginRollout with where clause', () => {
    const syncs = readSync('delivery', 'begin-rollout.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('BeginRollout');
    expect(syncs[0].where.length).toBeGreaterThan(0);
    expect(syncs[0].then[0].concept).toContain('Rollout');
  });

  it('parses HealthCheckAfterStep', () => {
    const syncs = readSync('delivery', 'health-check-after-step.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('HealthCheckAfterStep');
    expect(syncs[0].then[0].concept).toContain('Health');
  });

  it('parses AdvanceOnHealthy with two when patterns', () => {
    const syncs = readSync('delivery', 'advance-on-healthy.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('AdvanceOnHealthy');
    expect(syncs[0].when).toHaveLength(2);
    expect(syncs[0].then[0].concept).toContain('Telemetry');
  });

  it('parses AdvanceOnMetrics', () => {
    const syncs = readSync('delivery', 'advance-on-metrics.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('AdvanceOnMetrics');
    expect(syncs[0].then[0].concept).toContain('Rollout');
  });

  it('parses PauseOnBadMetrics', () => {
    const syncs = readSync('delivery', 'pause-on-bad-metrics.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('PauseOnBadMetrics');
    expect(syncs[0].then[0].concept).toContain('Rollout');
    // Then clause should have a literal "reason" field
    const reasonField = syncs[0].then[0].fields.find(f => f.name === 'reason');
    expect(reasonField).toBeTruthy();
    expect(reasonField!.value.type).toBe('literal');
  });

  it('parses RollbackOnFailure', () => {
    const syncs = readSync('delivery', 'rollback-on-failure.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RollbackOnFailure');
    expect(syncs[0].then[0].concept).toContain('Rollout');
  });

  it('parses RollbackPlanOnAbort', () => {
    const syncs = readSync('delivery', 'rollback-plan-on-abort.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RollbackPlanOnAbort');
    expect(syncs[0].then[0].concept).toContain('DeployPlan');
  });
});

// ============================================================
// Observability & Promotion Syncs
// ============================================================

describe('Observability & Promotion Syncs', () => {

  it('parses MarkerOnDeployStart as eventual', () => {
    const syncs = readSync('observability', 'marker-on-deploy-start.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('MarkerOnDeployStart');
    expect(syncs[0].annotations).toContain('eventual');
    expect(syncs[0].then[0].concept).toContain('Telemetry');
  });

  it('parses MarkerOnDeployComplete as eventual', () => {
    const syncs = readSync('observability', 'marker-on-deploy-complete.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('MarkerOnDeployComplete');
    expect(syncs[0].annotations).toContain('eventual');
  });

  it('parses MarkerOnRollback as eventual', () => {
    const syncs = readSync('observability', 'marker-on-rollback.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('MarkerOnRollback');
    expect(syncs[0].annotations).toContain('eventual');
  });

  it('parses ResolveBeforePromote', () => {
    const syncs = readSync('promotion', 'resolve-before-promote.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ResolveBeforePromote');
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[0].then[0].concept).toContain('Env');
  });

  it('parses PlanAfterPromotion', () => {
    const syncs = readSync('promotion', 'plan-after-promotion.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('PlanAfterPromotion');
    expect(syncs[0].then[0].concept).toContain('DeployPlan');
  });
});

// ============================================================
// Routing Syncs
// ============================================================

describe('Routing Syncs', () => {

  it('parses RouteToLambda', () => {
    const syncs = readSync('routing', 'route-to-lambda.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToLambda');
    expect(syncs[0].when[0].concept).toContain('Runtime');
    expect(syncs[0].then[0].concept).toContain('LambdaRuntime');
  });

  it('parses RouteLambdaDeploy with where clause', () => {
    const syncs = readSync('routing', 'route-lambda-deploy.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteLambdaDeploy');
    expect(syncs[0].where.length).toBeGreaterThan(0);
  });

  it('parses LambdaProvisionComplete', () => {
    const syncs = readSync('routing', 'lambda-provision-complete.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('LambdaProvisionComplete');
    expect(syncs[0].when[0].concept).toContain('LambdaRuntime');
    expect(syncs[0].then[0].concept).toContain('Runtime');
  });

  it('parses RouteToEcs', () => {
    const syncs = readSync('routing', 'route-to-ecs.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToEcs');
    expect(syncs[0].then[0].concept).toContain('EcsRuntime');
  });

  it('parses RouteToVault', () => {
    const syncs = readSync('routing', 'route-to-vault.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToVault');
    expect(syncs[0].when[0].concept).toContain('Secret');
    expect(syncs[0].then[0].concept).toContain('VaultProvider');
  });

  it('parses RouteToAwsSm', () => {
    const syncs = readSync('routing', 'route-to-aws-sm.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToAwsSm');
    expect(syncs[0].then[0].concept).toContain('AwsSmProvider');
  });

  it('parses VaultResolved', () => {
    const syncs = readSync('routing', 'vault-resolved.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('VaultResolved');
    expect(syncs[0].when[0].concept).toContain('VaultProvider');
    expect(syncs[0].then[0].concept).toContain('Secret');
  });

  it('parses RouteToPulumi', () => {
    const syncs = readSync('routing', 'route-to-pulumi.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToPulumi');
    expect(syncs[0].when[0].concept).toContain('IaC');
    expect(syncs[0].then[0].concept).toContain('PulumiProvider');
  });

  it('parses RouteToTerraform', () => {
    const syncs = readSync('routing', 'route-to-terraform.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToTerraform');
    expect(syncs[0].then[0].concept).toContain('TerraformProvider');
  });

  it('parses RoutePulumiApply', () => {
    const syncs = readSync('routing', 'route-pulumi-apply.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RoutePulumiApply');
    expect(syncs[0].then[0].concept).toContain('PulumiProvider');
  });

  it('parses PulumiApplyComplete', () => {
    const syncs = readSync('routing', 'pulumi-apply-complete.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('PulumiApplyComplete');
    expect(syncs[0].when[0].concept).toContain('PulumiProvider');
    expect(syncs[0].then[0].concept).toContain('IaC');
  });

  // --- Additional Runtime Routing ---

  it('parses RouteToCloudRun', () => {
    const syncs = readSync('routing', 'route-to-cloud-run.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToCloudRun');
    expect(syncs[0].when[0].concept).toContain('Runtime');
    expect(syncs[0].then[0].concept).toContain('CloudRunRuntime');
  });

  it('parses RouteToGcf', () => {
    const syncs = readSync('routing', 'route-to-gcf.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToGcf');
    expect(syncs[0].then[0].concept).toContain('GcfRuntime');
  });

  it('parses RouteToCloudflare', () => {
    const syncs = readSync('routing', 'route-to-cloudflare.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToCloudflare');
    expect(syncs[0].then[0].concept).toContain('CloudflareRuntime');
  });

  it('parses RouteToVercel', () => {
    const syncs = readSync('routing', 'route-to-vercel.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToVercel');
    expect(syncs[0].then[0].concept).toContain('VercelRuntime');
  });

  it('parses RouteToK8s', () => {
    const syncs = readSync('routing', 'route-to-k8s.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToK8s');
    expect(syncs[0].then[0].concept).toContain('K8sRuntime');
  });

  it('parses RouteToDockerCompose', () => {
    const syncs = readSync('routing', 'route-to-docker-compose.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToDockerCompose');
    expect(syncs[0].then[0].concept).toContain('DockerComposeRuntime');
  });

  it('parses RouteToLocal', () => {
    const syncs = readSync('routing', 'route-to-local.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToLocal');
    expect(syncs[0].then[0].concept).toContain('LocalRuntime');
  });

  // --- Additional Secret Routing ---

  it('parses RouteToGcpSm', () => {
    const syncs = readSync('routing', 'route-to-gcp-sm.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToGcpSm');
    expect(syncs[0].when[0].concept).toContain('Secret');
    expect(syncs[0].then[0].concept).toContain('GcpSmProvider');
  });

  it('parses RouteToEnv', () => {
    const syncs = readSync('routing', 'route-to-env.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToEnv');
    expect(syncs[0].then[0].concept).toContain('EnvProvider');
  });

  it('parses RouteToDotenv', () => {
    const syncs = readSync('routing', 'route-to-dotenv.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToDotenv');
    expect(syncs[0].then[0].concept).toContain('DotenvProvider');
  });

  // --- Additional IaC Routing ---

  it('parses RouteToCloudFormation', () => {
    const syncs = readSync('routing', 'route-to-cloudformation.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToCloudFormation');
    expect(syncs[0].when[0].concept).toContain('IaC');
    expect(syncs[0].then[0].concept).toContain('CloudFormationProvider');
  });

  it('parses RouteToDockerComposeIac', () => {
    const syncs = readSync('routing', 'route-to-docker-compose-iac.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToDockerComposeIac');
    expect(syncs[0].then[0].concept).toContain('DockerComposeIacProvider');
  });

  // --- GitOps Routing ---

  it('parses RouteToArgoCD', () => {
    const syncs = readSync('routing', 'route-to-argocd.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToArgoCD');
    expect(syncs[0].when[0].concept).toContain('GitOps');
    expect(syncs[0].then[0].concept).toContain('ArgoCDProvider');
  });

  it('parses RouteToFlux', () => {
    const syncs = readSync('routing', 'route-to-flux.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToFlux');
    expect(syncs[0].then[0].concept).toContain('FluxProvider');
  });
});

// ============================================================
// Bulk Sync Validation
// ============================================================

describe('Bulk Sync Validation', () => {

  const allSyncs: [string, string][] = [
    ['core', 'validate-before-execute.sync'],
    ['core', 'execute-after-validation.sync'],
    ['core', 'migrate-before-execute.sync'],
    ['migration', 'expand-after-plan.sync'],
    ['migration', 'migrate-after-expand.sync'],
    ['migration', 'contract-after-migrate.sync'],
    ['migration', 'deploy-after-migrate.sync'],
    ['delivery', 'begin-rollout.sync'],
    ['delivery', 'health-check-after-step.sync'],
    ['delivery', 'advance-on-healthy.sync'],
    ['delivery', 'advance-on-metrics.sync'],
    ['delivery', 'pause-on-bad-metrics.sync'],
    ['delivery', 'rollback-on-failure.sync'],
    ['delivery', 'rollback-plan-on-abort.sync'],
    ['observability', 'marker-on-deploy-start.sync'],
    ['observability', 'marker-on-deploy-complete.sync'],
    ['observability', 'marker-on-rollback.sync'],
    ['promotion', 'resolve-before-promote.sync'],
    ['promotion', 'plan-after-promotion.sync'],
    ['routing', 'route-to-lambda.sync'],
    ['routing', 'route-lambda-deploy.sync'],
    ['routing', 'lambda-provision-complete.sync'],
    ['routing', 'route-to-ecs.sync'],
    ['routing', 'route-to-vault.sync'],
    ['routing', 'route-to-aws-sm.sync'],
    ['routing', 'vault-resolved.sync'],
    ['routing', 'route-to-pulumi.sync'],
    ['routing', 'route-to-terraform.sync'],
    ['routing', 'route-pulumi-apply.sync'],
    ['routing', 'pulumi-apply-complete.sync'],
    ['routing', 'route-to-cloud-run.sync'],
    ['routing', 'route-to-gcf.sync'],
    ['routing', 'route-to-cloudflare.sync'],
    ['routing', 'route-to-vercel.sync'],
    ['routing', 'route-to-k8s.sync'],
    ['routing', 'route-to-docker-compose.sync'],
    ['routing', 'route-to-local.sync'],
    ['routing', 'route-to-gcp-sm.sync'],
    ['routing', 'route-to-env.sync'],
    ['routing', 'route-to-dotenv.sync'],
    ['routing', 'route-to-cloudformation.sync'],
    ['routing', 'route-to-docker-compose-iac.sync'],
    ['routing', 'route-to-argocd.sync'],
    ['routing', 'route-to-flux.sync'],
  ];

  it('all 44 sync files parse without error', () => {
    for (const [category, file] of allSyncs) {
      const syncs = readSync(category, file);
      expect(syncs.length, `${category}/${file} should produce at least one sync`).toBeGreaterThan(0);
      expect(syncs[0].name, `${category}/${file} should have a name`).toBeTruthy();
      expect(syncs[0].when.length, `${category}/${file} should have when patterns`).toBeGreaterThan(0);
      expect(syncs[0].then.length, `${category}/${file} should have then actions`).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Kit YAML Validation
// ============================================================

describe('Kit YAML', () => {

  it('suite.yaml exists and references valid files', () => {
    const kitPath = resolve(DEPLOY_DIR, 'suite.yaml');
    expect(existsSync(kitPath)).toBe(true);

    const content = readFileSync(kitPath, 'utf-8');
    expect(content).toContain('name: deploy');
    expect(content).toContain('version: 0.1.0');

    // Verify all concept spec paths reference existing files
    const specPaths = content.match(/spec:\s+\.\/[\w/.-]+\.concept/g) || [];
    expect(specPaths.length).toBe(41);
    for (const match of specPaths) {
      const relPath = match.replace('spec: ', '').trim();
      const fullPath = resolve(DEPLOY_DIR, relPath);
      expect(existsSync(fullPath), `spec path should exist: ${relPath}`).toBe(true);
    }

    // Verify all sync paths reference existing files
    const syncPaths = content.match(/path:\s+\.\/syncs\/[\w/.-]+\.sync/g) || [];
    expect(syncPaths.length).toBe(95);
    for (const match of syncPaths) {
      const relPath = match.replace('path: ', '').trim();
      const fullPath = resolve(DEPLOY_DIR, relPath);
      expect(existsSync(fullPath), `sync path should exist: ${relPath}`).toBe(true);
    }
  });
});
