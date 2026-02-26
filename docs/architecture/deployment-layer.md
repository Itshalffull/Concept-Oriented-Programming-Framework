# Clef Deployment Layer — Architecture Extension

## Design Principle

Apply the same boundary test as the rest of Clef: **the engine owns coordination mechanics, concepts own domain logic.** Deployment is a domain — it has state (what's deployed where), actions with meaningful variants (deploy → ok | migrationRequired | rollbackTriggered), and coordination needs (syncs between health checks and rollout progression). The entire deployment layer is concepts and syncs.

For cross-cutting concerns that span multiple providers (runtimes, secrets, IaC), the architecture uses a **coordination + provider concept pattern**: a coordination concept owns the shared interface and state that the rest of the system talks to, while provider concepts own the provider-specific state, actions, and variants. Integration syncs route from the coordination concept to the active provider. This is the same pattern as the auth suite (JWT/Wallet/OAuth are provider concepts beneath an auth coordination layer) and follows the same principle as ConceptStorage — common contract, multiple backends — but elevated to the concept tier because providers have sovereign state and meaningful domain-specific variants that differ per provider.

---

## Conceptual Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Clef Deploy Kit                                │
│                                                                         │
│  Orchestration Concepts:                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │DeployPlan│ │ Rollout  │ │Migration │ │  Health  │ │   Env    │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       │             │            │             │            │           │
│  ┌────┴─────┐ ┌────┴─────┐                                            │
│  │Telemetry │ │ Artifact │                                             │
│  └──────────┘ └──────────┘                                             │
│                                                                         │
│  Coordination Concepts:        Provider Concepts:                       │
│  ┌──────────┐                  ┌──────────────┐ ┌──────────────┐       │
│  │ Runtime  │──[route syncs]──▶│LambdaRuntime │ │  EcsRuntime  │ …     │
│  └──────────┘                  └──────────────┘ └──────────────┘       │
│  ┌──────────┐                  ┌──────────────┐ ┌──────────────┐       │
│  │  Secret  │──[route syncs]──▶│VaultProvider │ │AwsSmProvider │ …     │
│  └──────────┘                  └──────────────┘ └──────────────┘       │
│  ┌──────────┐                  ┌──────────────┐ ┌──────────────┐       │
│  │   IaC    │──[route syncs]──▶│PulumiProvider│ │  TfProvider  │ …     │
│  └──────────┘                  └──────────────┘ └──────────────┘       │
│                                                                         │
│  Syncs:                                                                 │
│  DeployPlan/execute → ok → Migration/run (if needed)                   │
│  Migration/run → ok → Rollout/begin                                    │
│  Rollout/step → ok → Health/check                                      │
│  Health/check → ok → Rollout/advance                                   │
│  Health/check → degraded → Rollout/pause                               │
│  Health/check → failed → DeployPlan/rollback                           │
│  Rollout/complete → ok → Telemetry/deployMarker                        │
│  Runtime/provision → [route] → LambdaRuntime/provision (integration)   │
│  Secret/resolve → [route] → VaultProvider/fetch (integration)          │
│  IaC/emit → [route] → PulumiProvider/generate (integration)           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Concepts

### 1.1 DeployPlan

The central orchestration concept. Owns the deploy graph — the DAG of deployment operations derived from a suite's structure.

```
@version(1)
concept DeployPlan [D] {

  purpose {
    Compute, validate, and execute deployment plans for suites.
    Constructs a dependency graph from concept specs, syncs,
    and the deploy manifest, then executes operations in
    topological order with parallelism on independent branches.
  }

  state {
    plans: set D
    graph {
      nodes: D -> list { id: String, kind: String, target: String, status: String }
      edges: D -> list { from: String, to: String }
    }
    metadata {
      suiteName: D -> String
      kitVersion: D -> String
      environment: D -> String
      createdAt: D -> DateTime
      strategy: D -> String
    }
    execution {
      currentPhase: D -> String
      completedNodes: D -> list String
      failedNodes: D -> list String
      rollbackStack: D -> list String
    }
  }

  actions {
    action plan(manifest: String, environment: String) {
      -> ok(plan: D, graph: String, estimatedDuration: Int) {
        Parse the deploy manifest, resolve environment overlays,
        construct the deploy DAG. Return the plan for inspection
        before execution. Graph returned as serialized DOT or JSON.
      }
      -> invalidManifest(errors: list String) {
        Manifest parsing or schema validation failed.
      }
      -> incompleteGraph(missing: list String) {
        Sync references concepts not present in manifest or
        declared as external dependencies.
      }
      -> circularDependency(cycle: list String) {
        Deploy graph contains a cycle.
      }
      -> transportMismatch(details: list String) {
        Connected concepts use incompatible transports
        without an adapter path.
      }
    }

    action validate(plan: D) {
      -> ok(plan: D, warnings: list String) {
        All pre-deployment invariants pass: sync completeness,
        transport compatibility, storage migration safety,
        dependency ordering. Warnings for non-blocking issues.
      }
      -> migrationRequired(plan: D, concepts: list String, fromVersions: list Int, toVersions: list Int) {
        Storage schema changes detected. Migration must run
        before deployment can proceed.
      }
      -> schemaIncompatible(details: list String) {
        Breaking schema change with no migration path declared.
      }
    }

    action execute(plan: D) {
      -> ok(plan: D, duration: Int, nodesDeployed: Int) {
        All nodes in the deploy graph executed successfully.
        Progressive delivery (if configured) has completed.
      }
      -> partial(plan: D, deployed: list String, failed: list String) {
        Some nodes succeeded, some failed. System is in a
        mixed state. Rollback recommended but not automatic.
      }
      -> rollbackTriggered(plan: D, reason: String, rolledBack: list String) {
        Deployment failed and automatic rollback executed.
        All compensating actions completed.
      }
      -> rollbackFailed(plan: D, reason: String, stuck: list String) {
        Rollback itself failed. Manual intervention required.
        Lists the nodes that couldn't be rolled back.
      }
    }

    action rollback(plan: D) {
      -> ok(plan: D, rolledBack: list String) {
        Compensating actions executed in reverse dependency order.
      }
      -> partial(plan: D, rolledBack: list String, stuck: list String) {
        Some rollbacks succeeded, some failed.
      }
    }

    action status(plan: D) {
      -> ok(plan: D, phase: String, progress: Float, activeNodes: list String) {
        Current execution status of an in-progress deployment.
      }
      -> notfound(plan: D) { Plan doesn't exist. }
    }
  }

  invariant {
    planThenExecute {
      after plan(manifest: m, environment: "staging") -> ok(plan: p)
      then validate(plan: p) -> ok(plan: p)
      and  execute(plan: p) -> ok(plan: p)
    }
  }
}
```

#### How the deploy graph is constructed

The `plan` action analyzes the suite manifest and produces a DAG:

```
For each concept in suite.yaml:
  1. Node: provision-storage/{concept} — depends on nothing
  2. Node: deploy-concept/{concept} — depends on provision-storage/{concept}
  3. Node: configure-transport/{concept} — depends on deploy-concept/{concept}

For each sync in suite.yaml:
  4. Node: register-sync/{sync} — depends on configure-transport/{C}
     for every concept C referenced in the sync's when/then clauses

For each integration sync:
  5. Node: register-integration/{sync} — depends on
     configure-transport/{C} for referenced concepts AND
     external-dependency-check/{externalKit}

Implicit edges:
  - If concept A's @version changed: insert migrate-storage/{A}
    between provision-storage/{A} and deploy-concept/{A}
  - If rollout strategy is canary: insert traffic-split nodes
    between deploy-concept and register-sync
```

Independent branches execute in parallel. The topological sort guarantees no concept activates before its dependencies are ready.


### 1.2 Rollout

Progressive delivery as a concept. Owns traffic splitting state and rollout progression logic.

```
@version(1)
concept Rollout [R] {

  purpose {
    Manage progressive delivery of concept deployments.
    Controls traffic splitting between old and new versions,
    monitors health analysis between steps, and triggers
    rollback on failure. Strategies: canary, blue-green, rolling.
  }

  state {
    rollouts: set R
    config {
      strategy: R -> String
      steps: R -> list { weight: Int, pauseSeconds: Int }
      successCriteria: R -> { maxErrorRate: Float, maxLatencyP99: Int }
      autoRollback: R -> Bool
    }
    progress {
      currentStep: R -> Int
      currentWeight: R -> Int
      startedAt: R -> DateTime
      status: R -> String
    }
    versions {
      oldVersion: R -> String
      newVersion: R -> String
      plan: R -> String
    }
  }

  actions {
    action begin(plan: String, strategy: String, steps: list String) {
      -> ok(rollout: R) {
        Initialize progressive rollout. First step begins
        with minimal traffic weight.
      }
      -> invalidStrategy(message: String) {
        Unknown strategy or malformed step configuration.
      }
    }

    action advance(rollout: R) {
      -> ok(rollout: R, newWeight: Int, step: Int) {
        Move to next traffic weight step.
      }
      -> complete(rollout: R) {
        All steps completed. New version receives 100% traffic.
      }
      -> paused(rollout: R, reason: String) {
        Rollout paused due to analysis results. Waiting for
        manual intervention or auto-resume timer.
      }
    }

    action pause(rollout: R, reason: String) {
      -> ok(rollout: R) { Freeze at current traffic weight. }
    }

    action resume(rollout: R) {
      -> ok(rollout: R, currentWeight: Int) { Continue from pause. }
    }

    action abort(rollout: R) {
      -> ok(rollout: R) {
        Immediately shift all traffic back to old version.
        Triggers compensating deploy actions.
      }
      -> alreadyComplete(rollout: R) { Rollout already finished. }
    }

    action status(rollout: R) {
      -> ok(rollout: R, step: Int, weight: Int, status: String, elapsed: Int) {
        Current state of the rollout.
      }
    }
  }
}
```


### 1.3 Migration

Storage schema migration orchestration. Implements the expand/contract pattern.

```
@version(1)
concept Migration [M] {

  purpose {
    Orchestrate storage schema migrations for concepts whose
    @version has changed. Uses the expand/contract pattern:
    expand (add new schema alongside old), migrate (copy data,
    establish dual-write), contract (remove old schema).
    Each phase is a gate — deployment blocks until it passes.
  }

  state {
    migrations: set M
    config {
      concept: M -> String
      fromVersion: M -> Int
      toVersion: M -> Int
      phase: M -> String
    }
    progress {
      recordsMigrated: M -> Int
      recordsTotal: M -> Int
      startedAt: M -> DateTime
      errors: M -> list String
    }
  }

  actions {
    action plan(concept: String, fromVersion: Int, toVersion: Int) {
      -> ok(migration: M, steps: list String, estimatedRecords: Int) {
        Analyze schema diff. Determine migration steps.
        Estimate record count for progress tracking.
      }
      -> noMigrationNeeded(concept: String) {
        Versions are compatible (additive changes only).
      }
      -> incompatible(concept: String, reason: String) {
        Breaking change with no declared migration path.
      }
    }

    action expand(migration: M) {
      -> ok(migration: M) {
        New schema elements added alongside old. Both
        versions can read/write. Dual-write enabled.
      }
      -> failed(migration: M, reason: String) {
        Storage backend rejected schema expansion.
      }
    }

    action migrate(migration: M) {
      -> ok(migration: M, recordsMigrated: Int) {
        All existing data transformed to new schema.
        Dual-write continues for safety.
      }
      -> partial(migration: M, migrated: Int, failed: Int, errors: list String) {
        Some records failed migration. Manual review needed.
      }
    }

    action contract(migration: M) {
      -> ok(migration: M) {
        Old schema elements removed. Migration complete.
        Dual-write disabled.
      }
      -> rollback(migration: M) {
        Contraction failed. Reverted to expanded state.
        Both schemas still present.
      }
    }

    action status(migration: M) {
      -> ok(migration: M, phase: String, progress: Float) {
        Current migration state.
      }
    }
  }
}
```


### 1.4 Health

Post-deployment verification. Checks concept liveness, sync connectivity, and storage accessibility.

```
@version(1)
concept Health [H] {

  purpose {
    Verify deployment health at concept, sync, and suite levels.
    Used as a gate in progressive delivery — rollout advances
    only when health checks pass. Also provides ongoing
    monitoring after deployment completes.
  }

  state {
    checks: set H
    results {
      target: H -> String
      kind: H -> String
      status: H -> String
      latencyMs: H -> Int
      checkedAt: H -> DateTime
      details: H -> option String
    }
  }

  actions {
    action checkConcept(concept: String, runtime: String) {
      -> ok(check: H, latencyMs: Int) {
        Concept's runtime responds to health probe.
        Transport is reachable. Storage is accessible.
      }
      -> unreachable(concept: String, transport: String) {
        Transport probe failed. Concept may not be deployed
        or runtime is down.
      }
      -> storageFailed(concept: String, storage: String, reason: String) {
        Concept reachable but storage backend inaccessible.
      }
      -> degraded(concept: String, latencyMs: Int, threshold: Int) {
        Concept responds but latency exceeds threshold.
      }
    }

    action checkSync(sync: String, concepts: list String) {
      -> ok(check: H, roundTripMs: Int) {
        Synthetic test message delivered through sync path.
        All referenced concepts received and responded.
      }
      -> partialFailure(sync: String, failed: list String) {
        Some concepts in the sync chain are unreachable.
      }
      -> timeout(sync: String, timeoutMs: Int) {
        Sync path didn't complete within timeout.
      }
    }

    action checkKit(kit: String, environment: String) {
      -> ok(check: H, conceptResults: list String, syncResults: list String) {
        All concepts healthy, all syncs connected.
      }
      -> degraded(check: H, healthy: list String, degraded: list String) {
        Kit functional but some components below threshold.
      }
      -> failed(check: H, healthy: list String, failed: list String) {
        Kit non-functional. Critical components unreachable.
      }
    }

    action checkInvariant(concept: String, invariant: String) {
      -> ok(check: H) {
        Ran the concept's invariant test against the live
        deployment. Action sequence produced expected variants.
      }
      -> violated(concept: String, invariant: String, expected: String, actual: String) {
        Invariant test failed. Deployment may be corrupted.
      }
    }
  }
}
```


### 1.5 Env

Environment composition and promotion. Manages the base + overlay model.

```
@version(1)
concept Env [E] {

  purpose {
    Manage deployment environments with composable configuration.
    Base environment defines defaults; overlays for dev, staging,
    production override specific values. Promotion moves a
    validated kit version reference from one environment to another
    without rebuilding.
  }

  state {
    environments: set E
    config {
      name: E -> String
      base: E -> option E
      overrides: E -> String
      kitVersions: E -> list { kit: String, version: String }
      secrets: E -> list { name: String, provider: String, ref: String }
    }
    promotion {
      lastPromotedAt: E -> option DateTime
      promotedFrom: E -> option E
      promotedBy: E -> option String
    }
  }

  actions {
    action resolve(environment: E) {
      -> ok(environment: E, resolved: String) {
        Merge base + overlays into a fully resolved
        deploy manifest. Resolves secret references
        to provider paths (not values — values resolved
        at deploy time by Secret concept).
      }
      -> missingBase(environment: E) { Base environment not found. }
      -> conflictingOverrides(environment: E, conflicts: list String) {
        Overlay values conflict with base constraints.
      }
    }

    action promote(fromEnv: E, toEnv: E, suiteName: String) {
      -> ok(toEnv: E, version: String) {
        Copy kit version reference from source to target
        environment. Does not redeploy — a separate
        DeployPlan/execute handles that.
      }
      -> notValidated(fromEnv: E, suiteName: String) {
        Source environment hasn't passed health checks
        for this suite version.
      }
      -> versionMismatch(fromEnv: E, toEnv: E, details: String) {
        Target environment has constraints the source
        version doesn't satisfy.
      }
    }

    action diff(envA: E, envB: E) {
      -> ok(differences: list String) {
        Compare resolved configurations between environments.
      }
    }
  }
}
```


### 1.6 Telemetry

Automatic observability injection and deployment markers.

```
@version(1)
concept Telemetry [T] {

  purpose {
    Manage observability configuration for deployed concepts.
    Injects OpenTelemetry instrumentation at deploy time,
    emits deployment markers to observability backends, and
    provides metric analysis for progressive delivery gates.
  }

  state {
    configs: set T
    settings {
      endpoint: T -> String
      samplingRate: T -> Float
      serviceName: T -> String
      serviceNamespace: T -> String
      serviceVersion: T -> String
    }
    markers: T -> list { deployId: String, timestamp: DateTime, kitVersion: String }
  }

  actions {
    action configure(concept: String, endpoint: String, samplingRate: Float) {
      -> ok(config: T) {
        Register telemetry config for a concept. At deploy time
        the Runtime concept injects OTEL instrumentation with
        these settings.
      }
    }

    action deployMarker(kit: String, version: String, environment: String, status: String) {
      -> ok(marker: T) {
        Emit a deployment event to the observability backend.
        Includes kit name, version, environment, start/end time,
        changed concepts, and deployment strategy.
      }
      -> backendUnavailable(endpoint: String) {
        Observability backend unreachable. Non-fatal — deployment
        continues, marker is queued for retry.
      }
    }

    action analyze(concept: String, window: Int, criteria: String) {
      -> ok(healthy: Bool, errorRate: Float, latencyP99: Int, sampleSize: Int) {
        Query the observability backend for concept health metrics
        over the specified time window. Used by Rollout to decide
        whether to advance, pause, or abort.
      }
      -> insufficientData(concept: String, samplesFound: Int, samplesNeeded: Int) {
        Not enough data points in the window to make a decision.
        Rollout should wait and retry.
      }
      -> backendUnavailable(endpoint: String) {
        Can't query metrics. Conservative action: pause rollout.
      }
    }
  }
}
```


### 1.7 Artifact

Immutable, content-addressed build artifacts. The Nix-inspired foundation for reproducible deployments.

```
@version(1)
concept Artifact [A] {

  purpose {
    Manage immutable, content-addressed build artifacts for
    concept deployments. Each compiled concept produces an
    artifact with a hash derived from its inputs (spec, handler,
    dependencies). Same inputs always produce the same artifact.
    Rollback = redeploy a previous artifact, not rebuild.
  }

  state {
    artifacts: set A
    metadata {
      hash: A -> String
      suiteName: A -> String
      kitVersion: A -> String
      conceptName: A -> String
      builtAt: A -> DateTime
      inputs: A -> list { name: String, hash: String }
    }
    storage {
      location: A -> String
      sizeBytes: A -> Int
    }
  }

  actions {
    action build(concept: String, spec: String, implementation: String, deps: list String) {
      -> ok(artifact: A, hash: String, sizeBytes: Int) {
        Compile concept spec + implementation into a deployable
        artifact. Hash computed from all inputs. If artifact with
        same hash already exists, return it without rebuilding.
      }
      -> compilationError(concept: String, errors: list String) {
        Spec or implementation has errors.
      }
    }

    action resolve(hash: String) {
      -> ok(artifact: A, location: String) {
        Look up artifact by content hash. For rollback —
        previous deployment's hash resolves to the exact
        artifact that was deployed.
      }
      -> notfound(hash: String) { No artifact with this hash. }
    }

    action gc(olderThan: DateTime, keepVersions: Int) {
      -> ok(removed: Int, freedBytes: Int) {
        Garbage collect old artifacts, keeping at least
        keepVersions recent artifacts per concept for rollback.
      }
    }
  }
}
```

---

## Part 2: Syncs — The Deployment Flow

The deployment flow is a sync chain, just like any other Clef workflow. Each step pattern-matches on the previous step's completion variant.

### 2.1 Core Deployment Chain

```
# Entry point: plan validates and triggers execution
sync ValidateBeforeExecute [eager] {
  when {
    DeployPlan/plan: [ manifest: ?manifest; environment: ?env ]
      => ok[ plan: ?plan ]
  }
  then {
    DeployPlan/validate: [ plan: ?plan ]
  }
}

# Validation passed with no migration needed → execute directly
sync ExecuteAfterValidation [eager] {
  when {
    DeployPlan/validate: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  then {
    Artifact/build: [ concept: ?concept; spec: ?spec;
      implementation: ?impl; deps: ?deps ]
  }
}

# Validation found migration needed → run migration first
sync MigrateBeforeExecute [eager] {
  when {
    DeployPlan/validate: [ plan: ?plan ]
      => migrationRequired[ plan: ?plan; concepts: ?concepts;
         fromVersions: ?from; toVersions: ?to ]
  }
  then {
    Migration/plan: [ concept: ?concept;
      fromVersion: ?from; toVersion: ?to ]
  }
}
```


### 2.2 Migration Chain (Expand/Contract)

```
# Migration planned → expand schema
sync ExpandAfterPlan [eager] {
  when {
    Migration/plan: [ concept: ?concept ]
      => ok[ migration: ?m ]
  }
  then {
    Migration/expand: [ migration: ?m ]
  }
}

# Schema expanded → migrate data
sync MigrateAfterExpand [eager] {
  when {
    Migration/expand: [ migration: ?m ]
      => ok[ migration: ?m ]
  }
  then {
    Migration/migrate: [ migration: ?m ]
  }
}

# Data migrated → contract (remove old schema)
# This is [eventual] because contraction can be deferred
# until after the deployment completes and is verified
sync ContractAfterMigrate [eventual] {
  when {
    Migration/migrate: [ migration: ?m ]
      => ok[ migration: ?m ]
  }
  then {
    Migration/contract: [ migration: ?m ]
  }
}

# Data migrated → also proceed with deployment (don't wait for contract)
sync DeployAfterMigrate [eager] {
  when {
    Migration/migrate: [ migration: ?m ]
      => ok[ migration: ?m ]
  }
  then {
    DeployPlan/execute: [ plan: ?plan ]
  }
}
```


### 2.3 Progressive Delivery Chain

```
# Execution complete → begin rollout if strategy requires it
sync BeginRollout [eager] {
  when {
    DeployPlan/execute: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  where {
    Rollout: { ?config plan: ?plan }
    filter(?config.strategy != "immediate")
  }
  then {
    Rollout/begin: [ plan: ?plan; strategy: ?strategy; steps: ?steps ]
  }
}

# Rollout step → health check before advancing
sync HealthCheckAfterStep [eager] {
  when {
    Rollout/advance: [ rollout: ?r ]
      => ok[ rollout: ?r; newWeight: ?w ]
  }
  then {
    Health/checkKit: [ kit: ?kit; environment: ?env ]
  }
}

# Health OK → advance rollout
sync AdvanceOnHealthy [eager] {
  when {
    Health/checkKit: [ kit: ?kit ]
      => ok[ check: ?h ]
    Rollout/advance: [ rollout: ?r ]
      => ok[ rollout: ?r ]
  }
  then {
    Telemetry/analyze: [ concept: ?concept; window: 300; criteria: ?criteria ]
  }
}

# Telemetry analysis healthy → advance to next step
sync AdvanceOnMetrics [eager] {
  when {
    Telemetry/analyze: [ concept: ?concept ]
      => ok[ healthy: true ]
  }
  then {
    Rollout/advance: [ rollout: ?r ]
  }
}

# Telemetry analysis unhealthy → pause rollout
sync PauseOnBadMetrics [eager] {
  when {
    Telemetry/analyze: [ concept: ?concept ]
      => ok[ healthy: false; errorRate: ?rate ]
  }
  then {
    Rollout/pause: [ rollout: ?r; reason: "Error rate exceeded threshold" ]
  }
}

# Health failed → abort rollout and rollback
sync RollbackOnFailure [eager] {
  when {
    Health/checkKit: [ kit: ?kit ]
      => failed[ check: ?h; failed: ?failedConcepts ]
  }
  then {
    Rollout/abort: [ rollout: ?r ]
  }
}

sync RollbackPlanOnAbort [eager] {
  when {
    Rollout/abort: [ rollout: ?r ]
      => ok[ rollout: ?r ]
  }
  then {
    DeployPlan/rollback: [ plan: ?plan ]
  }
}
```


### 2.4 Observability Chain

```
# Any deployment start → emit marker
sync MarkerOnDeployStart [eventual] {
  when {
    DeployPlan/execute: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  then {
    Telemetry/deployMarker: [
      kit: ?kit; version: ?version;
      environment: ?env; status: "started" ]
  }
}

# Rollout complete → emit completion marker
sync MarkerOnDeployComplete [eventual] {
  when {
    Rollout/advance: [ rollout: ?r ]
      => complete[ rollout: ?r ]
  }
  then {
    Telemetry/deployMarker: [
      kit: ?kit; version: ?version;
      environment: ?env; status: "completed" ]
  }
}

# Rollback → emit rollback marker
sync MarkerOnRollback [eventual] {
  when {
    DeployPlan/rollback: [ plan: ?plan ]
      => ok[ plan: ?plan; rolledBack: ?concepts ]
  }
  then {
    Telemetry/deployMarker: [
      kit: ?kit; version: ?version;
      environment: ?env; status: "rolledback" ]
  }
}
```


### 2.5 Environment Promotion Chain

```
# Promotion requested → resolve target environment
sync ResolveBeforePromote [eager] {
  when {
    Env/promote: [ fromEnv: ?from; toEnv: ?to; suiteName: ?kit ]
      => ok[ toEnv: ?to; version: ?version ]
  }
  then {
    Env/resolve: [ environment: ?to ]
  }
}

# Environment resolved → create deploy plan for target
sync PlanAfterPromotion [eager] {
  when {
    Env/resolve: [ environment: ?env ]
      => ok[ environment: ?env; resolved: ?manifest ]
  }
  then {
    DeployPlan/plan: [ manifest: ?manifest; environment: ?envName ]
  }
}
```

---

## Part 3: Coordination and Provider Concepts

Three cross-cutting concerns — runtimes, secrets, and infrastructure-as-code — follow the **coordination + provider pattern**. The coordination concept owns shared state and the stable interface that the rest of the deploy kit talks to. Provider concepts own provider-specific state, actions, and variants. Integration syncs route from coordination to the active provider based on manifest configuration.

```
┌─────────────────────┐     integration sync     ┌─────────────────────┐
│  Runtime (coord.)   │────── runtimeType ──────▶│  LambdaRuntime      │
│                     │       "aws-lambda"        │  (provider)         │
│  • instance registry│                           │  • function ARNs    │
│  • endpoint map     │     integration sync      │  • cold start stats │
│  • version history  │────── runtimeType ──────▶├─────────────────────┤
│  • traffic weights  │       "ecs-fargate"       │  EcsRuntime         │
│                     │                           │  (provider)         │
│                     │                           │  • service ARNs     │
│                     │                           │  • task definitions │
└─────────────────────┘                           └─────────────────────┘
  DeployPlan only                                   Never referenced
  talks to this                                     outside this suite
```

### 3.1 Runtime (Coordination Concept)

The stable interface for all deployment operations. DeployPlan, Rollout, and Health talk to Runtime. Runtime owns the registry of what's deployed where, regardless of provider.

```
@version(1)
concept Runtime [I] {

  purpose {
    Coordinate compute provisioning across cloud providers.
    Owns the deployed-instance registry, endpoint mappings,
    version history, and traffic weight state. Provider-
    agnostic — DeployPlan invokes Runtime actions, and
    integration syncs route to the active provider concept.
  }

  state {
    instances: set I
    registry {
      concept: I -> String
      runtimeType: I -> String
      endpoint: I -> String
      version: I -> String
      artifactHash: I -> String
      deployedAt: I -> DateTime
      status: I -> String
    }
    traffic {
      activeWeight: I -> Int
      canaryWeight: I -> Int
      canaryEndpoint: I -> option String
    }
    history: I -> list { version: String, artifactHash: String, deployedAt: DateTime }
  }

  actions {
    action provision(concept: String, runtimeType: String, config: String) {
      -> ok(instance: I, endpoint: String) {
        Registers the provisioning intent. Completion arrives
        after the provider concept finishes actual provisioning.
        Runtime records the instance in its registry.
      }
      -> alreadyProvisioned(instance: I, endpoint: String) {
        Instance exists and is healthy. No action needed.
      }
      -> provisionFailed(concept: String, runtimeType: String, reason: String) {
        Provider reported failure. Propagated from provider
        concept via sync.
      }
    }

    action deploy(instance: I, artifact: String, version: String) {
      -> ok(instance: I, endpoint: String) {
        Artifact deployed to the instance's runtime. Endpoint
        updated if changed. Version and hash recorded in history.
      }
      -> deployFailed(instance: I, reason: String) {
        Provider reported deployment failure.
      }
    }

    action setTrafficWeight(instance: I, weight: Int) {
      -> ok(instance: I, newWeight: Int) {
        Traffic weight updated. For canary: splits between
        current and canary endpoint.
      }
    }

    action rollback(instance: I) {
      -> ok(instance: I, previousVersion: String) {
        Rolled back to previous version from history.
        Provider handles the actual redeployment.
      }
      -> noHistory(instance: I) {
        No previous version to roll back to.
      }
      -> rollbackFailed(instance: I, reason: String) {
        Provider couldn't roll back.
      }
    }

    action destroy(instance: I) {
      -> ok(instance: I) {
        Instance removed from registry. Provider tears down
        the actual resources.
      }
      -> destroyFailed(instance: I, reason: String) {
        Provider couldn't destroy. Instance marked for
        manual cleanup.
      }
    }

    action healthCheck(instance: I) {
      -> ok(instance: I, latencyMs: Int) {
        Instance healthy and reachable.
      }
      -> unreachable(instance: I) {
        Transport probe failed.
      }
      -> degraded(instance: I, latencyMs: Int) {
        Responding but above latency threshold.
      }
    }
  }
}
```


### 3.2 Runtime Provider Concepts

Each provider concept has its own sovereign state and provider-specific variants. These are never referenced outside the deploy kit — only reached through integration syncs from Runtime.

#### LambdaRuntime

```
@version(1)
concept LambdaRuntime [F] {

  purpose {
    Manage AWS Lambda function deployments. Owns function
    configurations, IAM roles, API Gateway routes, layer
    versions, and cold start metrics.
  }

  state {
    functions: set F
    config {
      functionArn: F -> String
      roleArn: F -> String
      memory: F -> Int
      timeout: F -> Int
      runtime: F -> String
      layers: F -> list String
      apiGatewayRoute: F -> option String
    }
    metrics {
      coldStartMs: F -> option Int
      lastInvokedAt: F -> option DateTime
    }
  }

  actions {
    action provision(concept: String, memory: Int, timeout: Int, region: String) {
      -> ok(function: F, functionArn: String, endpoint: String) {
        Lambda function created. IAM role attached.
        API Gateway route configured if HTTP transport.
      }
      -> quotaExceeded(region: String, limit: String) {
        AWS Lambda quota hit in this region.
      }
      -> iamError(policy: String, reason: String) {
        IAM role creation or policy attachment failed.
      }
    }

    action deploy(function: F, artifactLocation: String) {
      -> ok(function: F, version: String) {
        Function code updated from artifact. New version published.
      }
      -> packageTooLarge(function: F, sizeBytes: Int, limitBytes: Int) {
        Deployment package exceeds Lambda limits.
      }
      -> runtimeUnsupported(function: F, runtime: String) {
        Requested runtime version not available.
      }
    }

    action setTrafficWeight(function: F, aliasWeight: Int) {
      -> ok(function: F) {
        Lambda alias weighted routing updated for canary.
      }
    }

    action rollback(function: F, targetVersion: String) {
      -> ok(function: F, restoredVersion: String) {
        Alias pointed to previous function version.
      }
    }

    action destroy(function: F) {
      -> ok(function: F) {
        Function, role, and API Gateway route deleted.
      }
      -> resourceInUse(function: F, dependents: list String) {
        Other resources reference this function.
      }
    }
  }
}
```

#### EcsRuntime

```
@version(1)
concept EcsRuntime [S] {

  purpose {
    Manage AWS ECS Fargate service deployments. Owns service
    configurations, task definitions, ALB target groups,
    auto-scaling policies, and service mesh settings.
  }

  state {
    services: set S
    config {
      serviceArn: S -> String
      clusterArn: S -> String
      taskDefinition: S -> String
      desiredCount: S -> Int
      cpu: S -> Int
      memory: S -> Int
      targetGroupArn: S -> option String
    }
    scaling {
      minInstances: S -> Int
      maxInstances: S -> Int
      targetCpu: S -> Int
    }
  }

  actions {
    action provision(concept: String, cpu: Int, memory: Int, cluster: String) {
      -> ok(service: S, serviceArn: String, endpoint: String) {
        ECS service created. Task definition registered.
        ALB target group configured.
      }
      -> capacityUnavailable(cluster: String, requested: String) {
        Cluster lacks capacity for the requested CPU/memory.
      }
      -> clusterNotFound(cluster: String) {
        Named cluster doesn't exist.
      }
    }

    action deploy(service: S, imageUri: String) {
      -> ok(service: S, taskDefinition: String) {
        New task definition registered. Service updated.
        Rolling deployment initiated.
      }
      -> imageNotFound(imageUri: String) {
        Container image not found in registry.
      }
      -> healthCheckFailed(service: S, failedTasks: Int) {
        New tasks failed health checks. ECS rolled back
        to previous task definition automatically.
      }
    }

    action setTrafficWeight(service: S, weight: Int) {
      -> ok(service: S) {
        ALB target group weight updated for canary.
      }
    }

    action rollback(service: S, targetTaskDefinition: String) {
      -> ok(service: S) {
        Service updated to previous task definition.
      }
    }

    action destroy(service: S) {
      -> ok(service: S) {
        Service scaled to 0, then deleted. Target group removed.
      }
      -> drainTimeout(service: S, activeConnections: Int) {
        Connections still draining after timeout.
      }
    }
  }
}
```

#### Other Runtime Providers (same pattern)

| Provider | Sovereign State | Key Variants |
|----------|----------------|--------------|
| `CloudRunRuntime` | Service URLs, revision history, IAM bindings | `-> billingDisabled()`, `-> regionUnavailable()` |
| `GcfRuntime` | Function names, trigger configs, gen1/gen2 | `-> gen2Required()`, `-> triggerConflict()` |
| `CloudflareRuntime` | Worker scripts, routes, KV namespace bindings | `-> scriptTooLarge()`, `-> routeConflict()` |
| `VercelRuntime` | Project configs, deployment URLs, edge regions | `-> buildFailed()`, `-> domainConflict()` |
| `K8sRuntime` | Deployments, Services, ConfigMaps, Ingress | `-> podCrashLoop()`, `-> resourceQuotaExceeded()` |
| `DockerComposeRuntime` | Service definitions in compose file | `-> portConflict()` |
| `LocalRuntime` | Child process PIDs, port assignments | `-> portInUse()` |


### 3.3 Secret (Coordination Concept)

Stable interface for secret resolution. Owns the resolution cache, access audit log, and rotation tracking.

```
@version(1)
concept Secret [S] {

  purpose {
    Coordinate secret resolution across vault and secret
    manager providers. Owns the resolution cache, access
    audit log, rotation tracking, and expiry monitoring.
    Env and DeployPlan talk to Secret — never to providers
    directly.
  }

  state {
    secrets: set S
    resolved {
      name: S -> String
      provider: S -> String
      cachedAt: S -> option DateTime
      expiresAt: S -> option DateTime
      version: S -> option String
    }
    audit: S -> list { accessedAt: DateTime, accessedBy: String }
  }

  actions {
    action resolve(name: String, provider: String) {
      -> ok(secret: S, version: String) {
        Secret resolved and cached. Value held in memory
        only — never persisted to concept storage. The
        completion carries the value to the requesting
        concept via sync.
      }
      -> notFound(name: String, provider: String) {
        Secret doesn't exist in the specified provider.
      }
      -> accessDenied(name: String, provider: String, reason: String) {
        Authentication or authorization failed with provider.
      }
      -> expired(name: String, expiresAt: DateTime) {
        Cached secret has expired. Rotation may be needed.
      }
    }

    action exists(name: String, provider: String) {
      -> ok(name: String, exists: Bool) {
        Check without retrieving value. For pre-deploy validation.
      }
    }

    action rotate(name: String, provider: String) {
      -> ok(secret: S, newVersion: String) {
        Rotation triggered. Provider generates new value.
        Cache invalidated.
      }
      -> rotationUnsupported(name: String, provider: String) {
        Provider doesn't support programmatic rotation.
      }
    }

    action invalidateCache(name: String) {
      -> ok(secret: S) {
        Cached value cleared. Next resolve fetches fresh.
      }
    }
  }
}
```


### 3.4 Secret Provider Concepts

#### VaultProvider

```
@version(1)
concept VaultProvider [V] {

  purpose {
    Manage secret resolution from HashiCorp Vault.
    Owns Vault connection state, lease tracking,
    token renewal, and seal status monitoring.
  }

  state {
    connections: set V
    config {
      address: V -> String
      authMethod: V -> String
      mountPath: V -> String
    }
    leases {
      leaseId: V -> option String
      leaseDuration: V -> option Int
      renewable: V -> Bool
    }
    health {
      sealed: V -> Bool
      lastCheckedAt: V -> DateTime
    }
  }

  actions {
    action fetch(path: String) {
      -> ok(value: String, leaseId: String, leaseDuration: Int) {
        Secret retrieved from Vault KV v2.
        Lease tracked for renewal.
      }
      -> sealed(address: String) {
        Vault is sealed. Manual unseal required.
      }
      -> tokenExpired(address: String) {
        Auth token expired. Re-authentication needed.
      }
      -> pathNotFound(path: String) {
        Secret path doesn't exist in Vault.
      }
    }

    action renewLease(leaseId: String) {
      -> ok(leaseId: String, newDuration: Int) {
        Lease renewed.
      }
      -> leaseExpired(leaseId: String) {
        Lease already expired. Must re-fetch.
      }
    }

    action rotate(path: String) {
      -> ok(newVersion: Int) {
        New secret version written to Vault.
      }
    }
  }
}
```

#### AwsSmProvider

```
@version(1)
concept AwsSmProvider [A] {

  purpose {
    Manage secret resolution from AWS Secrets Manager.
    Owns IAM session state, KMS key accessibility,
    and rotation schedule tracking.
  }

  state {
    secrets: set A
    config {
      region: A -> String
      kmsKeyId: A -> option String
    }
    rotation {
      scheduleEnabled: A -> Bool
      lastRotatedAt: A -> option DateTime
      nextRotationAt: A -> option DateTime
    }
  }

  actions {
    action fetch(secretId: String, versionStage: String) {
      -> ok(value: String, versionId: String, arn: String) {
        Secret retrieved from AWS Secrets Manager.
      }
      -> kmsKeyInaccessible(secretId: String, kmsKeyId: String) {
        KMS key used to encrypt this secret is not accessible.
        IAM or key policy issue.
      }
      -> resourceNotFound(secretId: String) {
        Secret doesn't exist in Secrets Manager.
      }
      -> decryptionFailed(secretId: String, reason: String) {
        Secret exists but decryption failed.
      }
    }

    action rotate(secretId: String) {
      -> ok(secretId: String, newVersionId: String) {
        Rotation Lambda triggered. New version staged.
      }
      -> rotationInProgress(secretId: String) {
        Rotation already running.
      }
    }
  }
}
```

#### Other Secret Providers (same pattern)

| Provider | Sovereign State | Key Variants |
|----------|----------------|--------------|
| `GcpSmProvider` | Project/database IDs, IAM bindings | `-> iamBindingMissing()`, `-> versionDisabled()` |
| `EnvProvider` | Environment variable cache | `-> variableNotSet()` |
| `DotenvProvider` | File path, loaded key set | `-> fileNotFound()`, `-> parseError()` |


### 3.5 IaC (Coordination Concept)

Stable interface for infrastructure-as-code operations. Owns the resource inventory and drift detection state.

```
@version(1)
concept IaC [R] {

  purpose {
    Coordinate infrastructure-as-code generation and
    application across IaC providers. Owns the resource
    inventory (what cloud resources exist for this app),
    drift detection state, and cost tracking. DeployPlan
    talks to IaC — never to providers directly.
  }

  state {
    resources: set R
    inventory {
      resourceId: R -> String
      provider: R -> String
      resourceType: R -> String
      concept: R -> String
      createdAt: R -> DateTime
      lastSyncedAt: R -> DateTime
      driftDetected: R -> Bool
    }
    costs {
      estimatedMonthlyCost: R -> option Float
    }
  }

  actions {
    action emit(plan: String, provider: String) {
      -> ok(output: String, fileCount: Int) {
        IaC code generated from deploy plan. Output is
        a reference to the generated files, not the files
        themselves. Provider concept handles file content.
      }
      -> unsupportedResource(resource: String, provider: String) {
        Deploy plan requires a resource type the provider
        can't express.
      }
    }

    action preview(plan: String, provider: String) {
      -> ok(toCreate: list String, toUpdate: list String, toDelete: list String,
            estimatedMonthlyCost: Float) {
        Dry-run showing what would change.
      }
      -> stateCorrupted(provider: String, reason: String) {
        Provider's state file is corrupted or inaccessible.
      }
    }

    action apply(plan: String, provider: String) {
      -> ok(created: list String, updated: list String, deleted: list String) {
        Resources provisioned. Inventory updated.
      }
      -> partial(created: list String, failed: list String, reason: String) {
        Some resources created, some failed. Provider
        state may be inconsistent.
      }
      -> applyFailed(reason: String) {
        Apply failed entirely. No changes made.
      }
    }

    action detectDrift(provider: String) {
      -> ok(drifted: list String, clean: list String) {
        Compared actual cloud state to expected state.
        Drifted resources flagged in inventory.
      }
      -> noDrift() {
        All resources match expected state.
      }
    }

    action teardown(plan: String, provider: String) {
      -> ok(destroyed: list String) {
        All resources for this plan destroyed.
        Inventory cleared.
      }
      -> partial(destroyed: list String, stuck: list String) {
        Some resources couldn't be destroyed.
      }
    }
  }
}
```


### 3.6 IaC Provider Concepts

#### PulumiProvider

```
@version(1)
concept PulumiProvider [P] {

  purpose {
    Generate and apply Pulumi TypeScript programs from
    Clef deploy plans. Owns Pulumi stack state, backend
    configuration, and plugin versioning.
  }

  state {
    stacks: set P
    config {
      backend: P -> String
      stackName: P -> String
      project: P -> String
      plugins: P -> list { name: String, version: String }
    }
    state {
      lastUpdatedAt: P -> option DateTime
      resourceCount: P -> Int
      pendingOperations: P -> list String
    }
  }

  actions {
    action generate(plan: String) {
      -> ok(stack: P, files: list String) {
        Pulumi TypeScript program generated from deploy plan.
        One file per resource group (compute, storage, transport).
      }
    }

    action preview(stack: P) {
      -> ok(stack: P, toCreate: Int, toUpdate: Int, toDelete: Int,
            estimatedCost: Float) {
        pulumi preview executed against stack.
      }
      -> backendUnreachable(backend: String) {
        State backend (S3, Pulumi Cloud, etc.) inaccessible.
      }
    }

    action apply(stack: P) {
      -> ok(stack: P, created: list String, updated: list String) {
        pulumi up completed successfully.
      }
      -> pluginMissing(plugin: String, version: String) {
        Required Pulumi provider plugin not installed.
      }
      -> conflictingUpdate(stack: P, pendingOps: list String) {
        Another update is in progress on this stack.
      }
      -> partial(stack: P, created: list String, failed: list String) {
        Apply partially succeeded. Stack state may have
        pending operations.
      }
    }

    action teardown(stack: P) {
      -> ok(stack: P, destroyed: list String) {
        pulumi destroy completed.
      }
      -> protectedResource(stack: P, resource: String) {
        Resource has protect: true. Must be unprotected first.
      }
    }
  }
}
```

#### TerraformProvider

```
@version(1)
concept TerraformProvider [T] {

  purpose {
    Generate and apply Terraform HCL modules from Clef
    deploy plans. Owns Terraform state file management,
    lock handling, and workspace configuration.
  }

  state {
    workspaces: set T
    config {
      stateBackend: T -> String
      lockTable: T -> option String
      workspace: T -> String
    }
    state {
      lockId: T -> option String
      serial: T -> Int
      lastAppliedAt: T -> option DateTime
    }
  }

  actions {
    action generate(plan: String) {
      -> ok(workspace: T, files: list String) {
        HCL modules generated. main.tf, variables.tf,
        outputs.tf per resource group.
      }
    }

    action preview(workspace: T) {
      -> ok(workspace: T, toCreate: Int, toUpdate: Int, toDelete: Int) {
        terraform plan executed.
      }
      -> stateLocked(workspace: T, lockId: String, lockedBy: String) {
        State file is locked by another process.
      }
      -> backendInitRequired(workspace: T) {
        terraform init hasn't been run for this backend.
      }
    }

    action apply(workspace: T) {
      -> ok(workspace: T, created: list String, updated: list String) {
        terraform apply completed.
      }
      -> stateLocked(workspace: T, lockId: String) {
        Can't acquire state lock.
      }
      -> partial(workspace: T, created: list String, failed: list String) {
        Apply failed midway. State partially updated.
        Manual terraform state inspection may be needed.
      }
    }

    action teardown(workspace: T) {
      -> ok(workspace: T, destroyed: list String) {
        terraform destroy completed.
      }
    }
  }
}
```

#### Other IaC Providers (same pattern)

| Provider | Sovereign State | Key Variants |
|----------|----------------|--------------|
| `CloudFormationProvider` | Stack IDs, change sets, rollback configs | `-> changeSetEmpty()`, `-> rollbackComplete()` |
| `DockerComposeProvider` | Compose file path, running containers | `-> portConflict()` |


### 3.7 GitOps (Coordination Concept)

Generates manifests for GitOps controllers. Follows the same coordination + provider pattern.

```
@version(1)
concept GitOps [G] {

  purpose {
    Coordinate manifest generation for GitOps controllers.
    Owns the manifest registry (what's been pushed to the
    deploy repo), reconciliation status tracking, and
    drift detection from the controller's perspective.
  }

  state {
    manifests: set G
    registry {
      plan: G -> String
      controller: G -> String
      repoPath: G -> String
      committedAt: G -> option DateTime
      reconciledAt: G -> option DateTime
      status: G -> String
    }
  }

  actions {
    action emit(plan: String, controller: String, repo: String, path: String) {
      -> ok(manifest: G, files: list String) {
        Manifests generated and committed to deploy repo.
        Controller will detect and reconcile.
      }
      -> controllerUnsupported(controller: String) {
        Unknown GitOps controller type.
      }
    }

    action reconciliationStatus(manifest: G) {
      -> ok(manifest: G, status: String, reconciledAt: DateTime) {
        Controller has reconciled the manifests.
      }
      -> pending(manifest: G, waitingOn: list String) {
        Controller hasn't finished reconciling.
      }
      -> failed(manifest: G, reason: String) {
        Controller reported reconciliation failure.
      }
    }
  }
}
```

Provider concepts: `ArgoCDProvider` (owns Application CRDs, sync waves, health assessments), `FluxProvider` (owns Kustomization CRDs, HelmRelease objects, source controllers).


### 3.8 Routing Syncs

Integration syncs that route from coordination concepts to the active provider. Each activates only when its provider concept is loaded.

```
# ─── Runtime Routing ────────────────────────────────

sync RouteToLambda [eager] {
  when {
    Runtime/provision: [ concept: ?concept; runtimeType: "aws-lambda"; config: ?config ]
      => ok[ instance: ?instance ]
  }
  then {
    LambdaRuntime/provision: [ concept: ?concept; memory: ?mem;
      timeout: ?timeout; region: ?region ]
  }
}

sync RouteToEcs [eager] {
  when {
    Runtime/provision: [ concept: ?concept; runtimeType: "ecs-fargate"; config: ?config ]
      => ok[ instance: ?instance ]
  }
  then {
    EcsRuntime/provision: [ concept: ?concept; cpu: ?cpu;
      memory: ?mem; cluster: ?cluster ]
  }
}

# Deploy routing follows the same pattern for Runtime/deploy,
# Runtime/rollback, Runtime/destroy, Runtime/setTrafficWeight.
# Each runtimeType has a full set of routing syncs.

sync RouteLambdaDeploy [eager] {
  when {
    Runtime/deploy: [ instance: ?i; artifact: ?artifact ]
      => ok[ instance: ?i ]
  }
  where {
    Runtime: { ?i runtimeType: "aws-lambda" }
  }
  then {
    LambdaRuntime/deploy: [ function: ?f; artifactLocation: ?artifact ]
  }
}

# Provider completion propagates back to Runtime
sync LambdaProvisionComplete [eager] {
  when {
    LambdaRuntime/provision: [ concept: ?concept ]
      => ok[ function: ?f; functionArn: ?arn; endpoint: ?endpoint ]
  }
  then {
    # Runtime records the endpoint in its registry.
    # This is an update to Runtime's state, triggered
    # by the provider's completion.
    Runtime/provision: [ concept: ?concept; runtimeType: "aws-lambda";
      config: ?config ]
  }
}


# ─── Secret Routing ─────────────────────────────────

sync RouteToVault [eager] {
  when {
    Secret/resolve: [ name: ?name; provider: "vault" ]
      => ok[ secret: ?s ]
  }
  then {
    VaultProvider/fetch: [ path: ?name ]
  }
}

sync RouteToAwsSm [eager] {
  when {
    Secret/resolve: [ name: ?name; provider: "aws-sm" ]
      => ok[ secret: ?s ]
  }
  then {
    AwsSmProvider/fetch: [ secretId: ?name; versionStage: "AWSCURRENT" ]
  }
}

sync VaultResolved [eager] {
  when {
    VaultProvider/fetch: [ path: ?path ]
      => ok[ value: ?value; leaseId: ?lease; leaseDuration: ?duration ]
  }
  then {
    # Secret caches the resolved value and records the access
    Secret/resolve: [ name: ?path; provider: "vault" ]
  }
}


# ─── IaC Routing ────────────────────────────────────

sync RouteToPulumi [eager] {
  when {
    IaC/emit: [ plan: ?plan; provider: "pulumi" ]
      => ok[ output: ?output ]
  }
  then {
    PulumiProvider/generate: [ plan: ?plan ]
  }
}

sync RouteToTerraform [eager] {
  when {
    IaC/emit: [ plan: ?plan; provider: "terraform" ]
      => ok[ output: ?output ]
  }
  then {
    TerraformProvider/generate: [ plan: ?plan ]
  }
}

sync RoutePulumiApply [eager] {
  when {
    IaC/apply: [ plan: ?plan; provider: "pulumi" ]
      => ok[]
  }
  then {
    PulumiProvider/apply: [ stack: ?stack ]
  }
}

sync PulumiApplyComplete [eager] {
  when {
    PulumiProvider/apply: [ stack: ?stack ]
      => ok[ stack: ?stack; created: ?created; updated: ?updated ]
  }
  then {
    # IaC updates its resource inventory
    IaC/apply: [ plan: ?plan; provider: "pulumi" ]
  }
}
```

### 3.9 What Remains Pre-Conceptual

The truly pre-conceptual pieces are the libraries that provider concepts call internally:

| Library | Used By | Why Pre-Conceptual |
|---------|---------|-------------------|
| `@aws-sdk/client-lambda` | LambdaRuntime handler | Raw SDK client. No state, no variants, no domain logic. |
| `@aws-sdk/client-ecs` | EcsRuntime handler | Same. |
| `@google-cloud/run` | CloudRunRuntime handler | Same. |
| `@pulumi/pulumi` | PulumiProvider handler | CLI wrapper. Pulumi's own state is managed by PulumiProvider concept. |
| `hashicorp-vault-js` | VaultProvider handler | HTTP client for Vault API. |
| `@aws-sdk/client-secrets-manager` | AwsSmProvider handler | Raw SDK client. |

These are `import` statements inside handler implementations — the same level as `import pg from 'pg'` inside a Postgres storage handler. No concepts, no syncs, just libraries.

---

## Part 4: Deploy Manifest Extensions

The existing deploy manifest gains new sections for the deployment layer.

```yaml
app:
  name: my-app
  version: 2.1.0

# ─── EXISTING ───────────────────────────────────────
kits:
  - name: content-management
    path: ./kits/content-management
    overrides:
      DefaultTitleField: ./syncs/custom-title.sync

runtimes:
  server:
    type: ecs-fargate
    engine: true
    storage: postgres

concepts:
  Theme:
    runtime: server
    storage: postgres
    query: lite

# ─── NEW: ENVIRONMENTS ─────────────────────────────
environments:
  base:
    runtimes:
      server:
        type: ecs-fargate
        cpu: 256
        memory: 512
    observability:
      endpoint: ${OTEL_ENDPOINT}
      samplingRate: 0.1

  staging:
    extends: base
    overrides:
      runtimes:
        server:
          cpu: 256
          memory: 256
      observability:
        samplingRate: 1.0       # capture everything in staging
    secrets:
      provider: dotenv
      path: .env.staging

  production:
    extends: base
    overrides:
      runtimes:
        server:
          cpu: 1024
          memory: 2048
          minInstances: 2
    secrets:
      provider: aws-sm
      prefix: /myapp/prod/

# ─── NEW: ROLLOUT STRATEGY ─────────────────────────
rollout:
  strategy: canary
  steps:
    - weight: 5
      pause: 300               # 5 min at 5% traffic
    - weight: 25
      pause: 600               # 10 min at 25%
    - weight: 50
      pause: 900               # 15 min at 50%
    - weight: 100
  analysis:
    interval: 60               # check every 60s
    maxErrorRate: 0.01         # abort if >1% errors
    maxLatencyP99: 500         # abort if p99 >500ms
  autoRollback: true

# ─── NEW: INFRASTRUCTURE PROVIDER ──────────────────
infrastructure:
  iac:
    provider: pulumi           # or terraform, cloudformation
    stateBackend: s3://my-bucket/pulumi-state
  gitops:
    controller: argocd         # or flux, or omit for direct deploy
    repo: git@github.com:myorg/deploy-manifests.git
    path: environments/${environment}

# ─── NEW: OBSERVABILITY ────────────────────────────
observability:
  provider: otlp
  endpoint: ${OTEL_ENDPOINT}
  samplingRate: 0.1
  deployMarkers:
    enabled: true
    backends:
      - type: datadog
        apiKey: ${DD_API_KEY}
      - type: grafana
        endpoint: ${GRAFANA_ENDPOINT}
  tracing:
    propagation: w3c           # W3C TraceContext headers
    conceptSpans: true         # auto-span per action invocation
    syncSpans: true            # auto-span per sync evaluation
    storageSpans: false        # opt-in: span per storage operation

# ─── NEW: MIGRATION POLICY ─────────────────────────
migrations:
  autoExpand: true             # automatically expand schema on version bump
  autoMigrate: true            # automatically migrate data
  autoContract: false          # require manual trigger for contraction
  backupBefore: true           # snapshot storage before migration
```

---

## Part 5: Kit Packaging — The Deploy Kit

All deployment concepts, syncs, and infrastructure ship as a Clef kit. Apps include it like any other kit.

```yaml
# suite.yaml for the deploy kit
kit:
  name: deploy
  version: 0.1.0
  description: >
    Deployment orchestration for Clef applications. Provides
    deploy planning, progressive delivery, schema migrations,
    health verification, environment management, observability
    injection, and immutable artifact management.

concepts:
  # ─── Orchestration Concepts ─────────────────────────
  DeployPlan:
    spec: ./concepts/deploy-plan.concept
    params:
      D: { as: deploy-plan-ref }

  Rollout:
    spec: ./concepts/rollout.concept
    params:
      R: { as: rollout-ref }

  Migration:
    spec: ./concepts/migration.concept
    params:
      M: { as: migration-ref }

  Health:
    spec: ./concepts/health.concept
    params:
      H: { as: health-check-ref }

  Env:
    spec: ./concepts/env.concept
    params:
      E: { as: environment-ref }

  Telemetry:
    spec: ./concepts/telemetry.concept
    params:
      T: { as: telemetry-config-ref }

  Artifact:
    spec: ./concepts/artifact.concept
    params:
      A: { as: artifact-ref }

  # ─── Coordination Concepts ──────────────────────────
  Runtime:
    spec: ./concepts/runtime.concept
    params:
      I: { as: runtime-instance-ref }

  Secret:
    spec: ./concepts/secret.concept
    params:
      S: { as: secret-ref }

  IaC:
    spec: ./concepts/iac.concept
    params:
      R: { as: iac-resource-ref }

  GitOps:
    spec: ./concepts/gitops.concept
    params:
      G: { as: gitops-manifest-ref }

  # ─── Runtime Provider Concepts (load what you need) ─
  LambdaRuntime:
    spec: ./concepts/providers/lambda-runtime.concept
    params:
      F: { as: lambda-function-ref }
    optional: true

  EcsRuntime:
    spec: ./concepts/providers/ecs-runtime.concept
    params:
      S: { as: ecs-service-ref }
    optional: true

  CloudRunRuntime:
    spec: ./concepts/providers/cloud-run-runtime.concept
    optional: true

  GcfRuntime:
    spec: ./concepts/providers/gcf-runtime.concept
    optional: true

  CloudflareRuntime:
    spec: ./concepts/providers/cloudflare-runtime.concept
    optional: true

  VercelRuntime:
    spec: ./concepts/providers/vercel-runtime.concept
    optional: true

  K8sRuntime:
    spec: ./concepts/providers/k8s-runtime.concept
    optional: true

  DockerComposeRuntime:
    spec: ./concepts/providers/docker-compose-runtime.concept
    optional: true

  LocalRuntime:
    spec: ./concepts/providers/local-runtime.concept
    optional: true

  # ─── Secret Provider Concepts (load what you need) ──
  VaultProvider:
    spec: ./concepts/providers/vault-provider.concept
    optional: true

  AwsSmProvider:
    spec: ./concepts/providers/aws-sm-provider.concept
    optional: true

  GcpSmProvider:
    spec: ./concepts/providers/gcp-sm-provider.concept
    optional: true

  EnvProvider:
    spec: ./concepts/providers/env-provider.concept
    optional: true

  DotenvProvider:
    spec: ./concepts/providers/dotenv-provider.concept
    optional: true

  # ─── IaC Provider Concepts (load what you need) ─────
  PulumiProvider:
    spec: ./concepts/providers/pulumi-provider.concept
    optional: true

  TerraformProvider:
    spec: ./concepts/providers/terraform-provider.concept
    optional: true

  CloudFormationProvider:
    spec: ./concepts/providers/cloudformation-provider.concept
    optional: true

  DockerComposeProvider:
    spec: ./concepts/providers/docker-compose-iac-provider.concept
    optional: true

  # ─── GitOps Provider Concepts ───────────────────────
  ArgoCDProvider:
    spec: ./concepts/providers/argocd-provider.concept
    optional: true

  FluxProvider:
    spec: ./concepts/providers/flux-provider.concept
    optional: true

syncs:
  required:
    - path: ./syncs/validate-before-execute.sync
    - path: ./syncs/rollback-on-failure.sync
    - path: ./syncs/rollback-plan-on-abort.sync

  recommended:
    - path: ./syncs/begin-rollout.sync
      name: ProgressiveDelivery
    - path: ./syncs/health-check-after-step.sync
      name: HealthGatedRollout
    - path: ./syncs/advance-on-metrics.sync
      name: MetricGatedAdvance
    - path: ./syncs/marker-on-deploy-start.sync
      name: DeployStartMarker
    - path: ./syncs/marker-on-deploy-complete.sync
      name: DeployCompleteMarker
    - path: ./syncs/resolve-before-promote.sync
      name: PromotionFlow
    - path: ./syncs/migrate-before-execute.sync
      name: AutoMigration
    - path: ./syncs/contract-after-migrate.sync
      name: DeferredContraction

  # ─── Routing Syncs (activate per loaded provider) ───
  integration:
    # Runtime routing
    - path: ./syncs/routing/route-to-lambda.sync
      name: RouteLambda
    - path: ./syncs/routing/route-to-ecs.sync
      name: RouteEcs
    - path: ./syncs/routing/route-to-cloud-run.sync
      name: RouteCloudRun
    - path: ./syncs/routing/route-to-gcf.sync
      name: RouteGcf
    - path: ./syncs/routing/route-to-cloudflare.sync
      name: RouteCloudflare
    - path: ./syncs/routing/route-to-vercel.sync
      name: RouteVercel
    - path: ./syncs/routing/route-to-k8s.sync
      name: RouteK8s
    - path: ./syncs/routing/route-to-docker-compose.sync
      name: RouteDockerCompose
    - path: ./syncs/routing/route-to-local.sync
      name: RouteLocal

    # Secret routing
    - path: ./syncs/routing/route-to-vault.sync
      name: RouteVault
    - path: ./syncs/routing/route-to-aws-sm.sync
      name: RouteAwsSm
    - path: ./syncs/routing/route-to-gcp-sm.sync
      name: RouteGcpSm
    - path: ./syncs/routing/route-to-env.sync
      name: RouteEnvSecrets
    - path: ./syncs/routing/route-to-dotenv.sync
      name: RouteDotenv

    # IaC routing
    - path: ./syncs/routing/route-to-pulumi.sync
      name: RoutePulumi
    - path: ./syncs/routing/route-to-terraform.sync
      name: RouteTerraform
    - path: ./syncs/routing/route-to-cloudformation.sync
      name: RouteCloudFormation

    # GitOps routing
    - path: ./syncs/routing/route-to-argocd.sync
      name: RouteArgoCD
    - path: ./syncs/routing/route-to-flux.sync
      name: RouteFlux
```

---

## Part 6: CLI Extensions

```bash
# Planning
clef deploy plan ./app.deploy.yaml --env production
clef deploy plan ./app.deploy.yaml --env staging --dry-run
clef deploy diff staging production

# Execution
clef deploy execute <plan-id>
clef deploy execute <plan-id> --skip-rollout     # immediate, no canary
clef deploy status <plan-id>

# Progressive delivery
clef rollout status <rollout-id>
clef rollout advance <rollout-id>                # manual advance
clef rollout pause <rollout-id> --reason "investigating"
clef rollout resume <rollout-id>
clef rollout abort <rollout-id>

# Rollback
clef deploy rollback <plan-id>
clef deploy rollback --to-version 2.0.3 --env production

# Migrations
clef migrate plan <concept> --from 2 --to 3
clef migrate expand <migration-id>
clef migrate status <migration-id>
clef migrate contract <migration-id>             # manual contraction

# Environments
clef env resolve staging
clef env promote staging production --kit content-management
clef env diff staging production

# Health
clef health check --kit content-management --env production
clef health check --concept User --env staging
clef health invariant User articleCreation --env production

# Artifacts
clef artifact build ./kits/content-management
clef artifact list --kit content-management --last 5
clef artifact gc --older-than 30d --keep 3

# IaC
clef iac preview ./app.deploy.yaml --env production --provider pulumi
clef iac emit ./app.deploy.yaml --env production --provider terraform --output ./tf/
clef iac apply <plan-id>

# Observability
clef telemetry configure --concept User --sampling 0.5
clef telemetry markers --env production --last 10
```

---

## Part 7: What This Enables

### The developer experience

```bash
# Write concepts and syncs (existing workflow)
# ...

# One command to deploy with full safety:
clef deploy plan ./app.deploy.yaml --env production

# Output:
# Deploy Plan dp-2026-02-20-001
# ├─ Kit: content-management v0.4.0
# │  ├─ Migration: Entity v1→v2 (expand + migrate)
# │  ├─ Deploy: Entity, Field, Relation, Node (parallel)
# │  ├─ Syncs: 2 required, 4 recommended
# │  └─ Rollout: canary (5% → 25% → 50% → 100%)
# ├─ Kit: auth v0.2.0 (no changes)
# ├─ Health gates: 4 concept checks, 6 sync checks
# ├─ Telemetry: OTEL → Datadog, deploy markers enabled
# └─ Estimated duration: 45 min (including canary bake time)
#
# Pre-deploy validation:
#   ✅ Sync graph complete
#   ✅ Transport compatibility
#   ✅ Migration path: Entity v1→v2 (additive, auto-migrate)
#   ✅ No circular dependencies
#   ⚠  Recommended: backup Entity storage before migration
#
# Execute? [y/N]

clef deploy execute dp-2026-02-20-001
```

### What happens under the hood

1. `Artifact/build` compiles each changed concept into a content-addressed artifact
2. `Secret/resolve` fetches credentials → routes to VaultProvider or AwsSmProvider via integration sync
3. `Migration/expand` adds new Entity schema alongside old
4. `Migration/migrate` copies data to new schema format
5. `IaC/apply` provisions cloud resources → routes to PulumiProvider or TerraformProvider
6. `DeployPlan/execute` walks the deploy graph in topological order:
   - Parallel: `Runtime/provision` per concept → routes to LambdaRuntime, EcsRuntime, etc.
   - Parallel: `Runtime/deploy` per concept with built artifacts
   - Sequential: register syncs (after their concepts are ready)
7. `Rollout/begin` starts canary at 5% → `Runtime/setTrafficWeight`
8. Loop: `Health/checkKit` → `Telemetry/analyze` → `Rollout/advance`
9. On success: `Rollout/advance → complete`, `Telemetry/deployMarker`
10. On failure: `Rollout/abort` → `Runtime/rollback` → `DeployPlan/rollback` (reverse dependency order)
11. `Migration/contract` runs eventually after deployment verified stable