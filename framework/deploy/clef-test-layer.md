# Clef Test Kit — Cross-Layer Testing Coordination

## Design Principle

Testing spans all three layers. Snapshot testing triggers on generated output (generation suite). Conformance testing runs against built artifacts (build layer). Contract testing verifies cross-target interoperability (build layer, multiple languages). Test selection determines *what* to test given a change (generation + build). Flaky test management operates across everything (any test from any builder at any point).

This is a **new suite** (`kits/test/`), not an extension of the deploy kit. Unlike Builder and Toolchain which feed directly into the deploy DAG, test coordination concepts have sync points across generation, build, and deploy — they don't belong to any single layer.

### Why This Exists

Per-language builders already run language-specific tests. Each `SwiftBuilder/test`, `TypeScriptBuilder/test`, etc. invokes the language's test runner. What builders can't do:

```
Generation Suite          Build Layer              Deploy Layer
─────────────          ───────────              ────────────
                                                              
Emitter writes TS ──?── "Did output change?"     (Snapshot)  
Emitter writes Rust ─?─ "Does it match spec?"    (Conformance)
                                                              
                  Builder/test Swift ──┐                      
                  Builder/test TS ─────?── "Do they interop?" (Contract)
                  Builder/test Rust ───┘                      
                                                              
Resource change ──?── "Which tests to run?"       (Selection) 
                                                              
Any test fails ───?── "Is this flaky?"            (Flaky)     
```

Five gaps, five concepts. Each has independent purpose, state, and actions per Jackson's test. Each registers through PluginRegistry. All five are **coordination-only** concepts — they don't run tests themselves. They select, verify, compare, evaluate, and manage, while builders handle actual test execution.

### Position in the Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│  .concept / .sync specs                                                       │
│       │                                                                       │
│       ▼                                                                       │
│  ┌─────────────────────────────────┐                                          │
│  │  Generation Suite                 │                                          │
│  │  Resource → KindSystem →        │    ┌───────────────────────────────┐     │
│  │  GenerationPlan → Emitter       │───▶│  Snapshot (golden files)      │     │
│  │                                 │    │  Conformance (spec fidelity)  │     │
│  └─────────────┬───────────────────┘    │  TestSelection (change→tests) │     │
│                │                         │                               │     │
│                ▼                         │  TEST KIT                     │     │
│  ┌─────────────────────────────────┐    │  (cross-layer coordination)   │     │
│  │  Build Layer (in deploy kit)    │───▶│                               │     │
│  │  Toolchain → Builder → Artifact │    │  ContractTest (cross-target)  │     │
│  │                                 │    │  FlakyTest (quarantine)        │     │
│  └─────────────┬───────────────────┘    └───────────────────────────────┘     │
│                │                                    │                          │
│                ▼                                    │ gate                     │
│  ┌─────────────────────────────────┐                │                          │
│  │  Deploy Layer                   │◀───────────────┘                          │
│  │  DeployPlan → Rollout → Health  │  (tests must pass before deploy)         │
│  └─────────────────────────────────┘                                          │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Concepts

### 1.1 Snapshot

Manages golden-file testing for generated output. Compares generator output against approved baselines to detect unintended changes. This is the dominant testing pattern for code generators — verifying *textual output stability* without executing the code.

**Sync point:** Generation kit → Emitter. After Emitter writes files, Snapshot compares them against approved baselines.

**Independent purpose test:** "Did the generator's output change? Is the change approved? Show me the diff." — answerable without building or running any code.

```
@version(1)
concept Snapshot [S] {

  purpose {
    Manage golden-file baselines for generated output.
    Compare current generator output against approved
    snapshots. Detect unintended changes to generated
    code structure, formatting, or content. Support a
    human-in-the-loop approval workflow for intentional
    changes.
  }

  state {
    snapshots: set S
    baseline {
      path: S -> String
      contentHash: S -> String
      approvedAt: S -> DateTime
      approvedBy: S -> option String
    }
    comparison {
      currentHash: S -> option String
      status: S -> String
      diffSummary: S -> option String
    }
  }

  actions {
    action compare(outputPath: String, currentContent: String) {
      -> unchanged(snapshot: S) {
        Current output matches approved baseline exactly.
        Content hash identical. No action needed.
      }
      -> changed(snapshot: S, diff: String, linesAdded: Int, linesRemoved: Int) {
        Current output differs from approved baseline.
        Returns unified diff. Requires approval before
        the change is accepted.
      }
      -> new(path: String, contentHash: String) {
        No baseline exists for this output path.
        First generation — requires initial approval.
      }
    }

    action approve(path: String, approver: option String) {
      -> ok(snapshot: S) {
        Current output becomes the new baseline.
        Records approval timestamp and optional approver.
        Future comparisons use this as the reference.
      }
      -> noChange(snapshot: S) {
        Nothing to approve — current output already
        matches baseline.
      }
    }

    action approveAll(paths: option list String) {
      -> ok(approved: Int) {
        Approve all pending changes, optionally filtered
        by path prefix. Used for bulk approval after
        intentional generator changes.
      }
    }

    action reject(path: String) {
      -> ok(snapshot: S) {
        Mark the current change as rejected. The output
        should be reverted to match the baseline. Signals
        that the generator change was unintentional.
      }
      -> noChange(snapshot: S) {
        Nothing to reject.
      }
    }

    action status(paths: option list String) {
      -> ok(results: list {
        path: String,
        status: String,
        linesChanged: option Int,
        approvedAt: option DateTime
      }) {
        Return snapshot status for all tracked paths.
        Statuses: "current", "changed", "new", "rejected".
        Used by `clef test snapshot --status`.
      }
    }

    action diff(path: String) {
      -> ok(diff: String, linesAdded: Int, linesRemoved: Int) {
        Return detailed unified diff between baseline and
        current output. Used by `clef test snapshot --diff`.
      }
      -> noBaseline(path: String) {
        No baseline exists for this path.
      }
      -> unchanged(path: String) {
        No difference — output matches baseline.
      }
    }

    action clean(outputDir: String) {
      -> ok(removed: list String) {
        Remove baselines for output files that no longer
        exist (orphaned snapshots from deleted concepts).
      }
    }
  }

  invariant {
    after compare(outputPath: "generated/ts/password.ts", currentContent: "...")
      -> changed(snapshot: s, diff: "...", linesAdded: 5, linesRemoved: 3)
    and  approve(path: "generated/ts/password.ts") -> ok(snapshot: s2)
    then compare(outputPath: "generated/ts/password.ts", currentContent: "...")
      -> unchanged(snapshot: s2)
  }
}
```

**Baseline storage convention:** `.clef-snapshots/{family}/{concept}/{language}/` alongside generated output. Committed to version control, reviewed in code review.


### 1.2 Conformance

Verifies that generated code faithfully implements the concept specification. Different from unit testing: unit tests verify code *works*; conformance tests verify code *matches the spec*. Each target language should produce identical observable behavior for the same concept.

**Sync points:** Generation kit → Resource (spec changes trigger re-verification). Build layer → Builder (conformance suites run against built artifacts).

**Independent purpose test:** "Does the generated TypeScript password module match the concept spec? Which spec requirements are covered? Are there deviations?" — answerable from the spec and the generated code.

```
@version(1)
concept Conformance [C] {

  purpose {
    Verify that generated code faithfully implements concept
    specifications. Maintain spec-to-test traceability. Track
    per-target conformance status. Document and manage acceptable
    deviations where a target language can't fully express a
    spec requirement.
  }

  state {
    suites: set C
    registry {
      concept: C -> String
      specVersion: C -> String
      targets: C -> list {
        language: String
        status: String
        coveredRequirements: Int
        totalRequirements: Int
        deviations: list { requirement: String, reason: String }
      }
    }
    requirements {
      specRequirements: C -> list {
        id: String
        description: String
        source: String
        category: String
      }
    }
    lastRun: C -> option DateTime
  }

  actions {
    action generate(concept: String, specPath: String) {
      -> ok(suite: C, testVectors: list { id: String, description: String, input: String, expectedOutput: String }) {
        Parse concept spec and generate language-independent
        test vectors. Each vector specifies an action invocation
        and expected outcome based on the spec's operational
        principle and invariants.

        Test vectors are language-independent — the same vector
        is executed against the TypeScript, Rust, Swift, and
        Solidity implementations.
      }
      -> specError(concept: String, message: String) {
        Spec couldn't be parsed or has ambiguous requirements.
      }
    }

    action verify(suite: C, language: String, artifactLocation: String) {
      -> ok(passed: Int, total: Int, coveredRequirements: list String) {
        Run conformance test vectors against a built artifact
        for a specific language. Returns which spec requirements
        are covered by passing tests.
      }
      -> failure(passed: Int, failed: Int, failures: list { testId: String, requirement: String, expected: String, actual: String }) {
        Some conformance tests failed. Each failure traces back
        to a specific spec requirement — not just "test X failed"
        but "requirement R is not implemented correctly."
      }
      -> deviationDetected(requirement: String, language: String, reason: String) {
        A known deviation — the language can't express this
        requirement. Recorded, not treated as failure.
      }
    }

    action registerDeviation(concept: String, language: String, requirement: String, reason: String) {
      -> ok(suite: C) {
        Record an acceptable deviation. Example: Solidity
        can't express Option types the same way as Rust,
        so the conformance test for optional return values
        uses a different assertion shape.
      }
    }

    action matrix(concepts: option list String) {
      -> ok(matrix: list {
        concept: String,
        targets: list { language: String, conformance: String, covered: Int, total: Int, deviations: Int }
      }) {
        Return cross-target conformance matrix.
        Shows which concepts pass conformance for which
        languages. Used by `clef test conformance --matrix`.
        conformance values: "full", "partial", "failing", "untested".
      }
    }

    action traceability(concept: String) {
      -> ok(requirements: list {
        id: String,
        description: String,
        testedBy: list { language: String, testId: String, status: String }
      }) {
        Return full traceability: which spec requirements
        are tested by which test vectors in which languages.
        Used by `clef test conformance --trace`.
      }
    }
  }

  invariant {
    after generate(concept: "password", specPath: "./specs/password.concept")
      -> ok(suite: c, testVectors: vs)
    and  verify(suite: c, language: "typescript", artifactLocation: ".clef-artifacts/ts/password")
      -> ok(passed: 12, total: 12, coveredRequirements: reqs)
    then matrix(concepts: ["password"]) -> ok(matrix: m)
  }
}
```


### 1.3 TestSelection

Determines which tests to run given a code change. Uses source-to-test mappings (from runtime coverage data, not just build dependency graphs) to select the minimum test set that achieves confident defect detection.

**Sync points:** Generation kit → Resource (source file changes trigger selection). Build layer → Builder (selected tests fed to builders). Also observes Builder/test results to update coverage mappings.

**Independent purpose test:** "Given that `password.concept` changed, which tests across all languages need to run? How confident are we that this selection catches regressions?" — answerable without running any tests.

```
@version(1)
concept TestSelection [M] {

  purpose {
    Select the minimum set of tests to run given a code change.
    Maintain source-to-test mappings from runtime coverage data.
    Prioritize tests by historical failure probability, change
    proximity, and execution cost. Enable confident defect
    detection while minimizing total test execution time.
  }

  state {
    mappings: set M
    coverage {
      testId: M -> String
      language: M -> String
      coveredSources: M -> list String
      lastExecuted: M -> DateTime
      avgDuration: M -> Int
      failureRate: M -> Float
    }
    selections {
      changeId: M -> String
      selectedTests: M -> list String
      confidence: M -> Float
      estimatedDuration: M -> Int
    }
  }

  actions {
    action analyze(changedSources: list String) {
      -> ok(affectedTests: list { testId: String, language: String, relevance: Float, reason: String }) {
        Given changed source files, compute which tests are
        affected using stored source-to-test coverage mappings.
        Relevance score (0-1) based on:
        - Direct coverage (test exercises changed code): 1.0
        - Transitive dependency (test exercises code that
          depends on changed code): 0.5-0.9
        - Historical co-failure (test historically fails
          when this source changes): variable

        Reason explains why each test was selected:
        "direct-coverage", "transitive-dep", "co-failure-history".
      }
      -> noMappings(message: String) {
        No coverage mappings available — first run or
        mappings expired. All tests should run.
      }
    }

    action select(affectedTests: list { testId: String, language: String, relevance: Float }, budget: option { maxDuration: Int, maxTests: Int }) {
      -> ok(selected: list { testId: String, language: String, priority: Int }, estimatedDuration: Int, confidence: Float) {
        From the affected tests, select the subset to run
        within the given budget. Prioritized by:
        1. Recent failure history (tests that failed recently)
        2. Relevance score (higher = more likely affected)
        3. Execution cost (faster tests first for quick signal)

        Confidence represents estimated probability that this
        selection catches a real regression (based on historical
        accuracy of selection for similar changes).

        If no budget specified, returns all affected tests.
      }
      -> budgetInsufficient(selected: list { testId: String }, missedTests: Int, confidence: Float) {
        Budget too small to achieve target confidence.
        Returns what fits, plus how many were dropped
        and the reduced confidence.
      }
    }

    action record(testId: String, language: String, coveredSources: list String, duration: Int, passed: Bool) {
      -> ok(mapping: M) {
        Update source-to-test coverage mapping after a test
        execution. This is how mappings are built — instrumenting
        test runs to collect file-level coverage, then storing
        the test-to-source mapping.
      }
    }

    action statistics() {
      -> ok(stats: {
        totalMappings: Int,
        avgSelectionRatio: Float,
        avgConfidence: Float,
        lastUpdated: DateTime
      }) {
        Return selection effectiveness statistics.
        Selection ratio: what fraction of tests are typically
        selected (lower = more efficient).
      }
    }
  }

  invariant {
    after record(testId: "test_password_hash", language: "typescript", coveredSources: ["./specs/password.concept", "generated/ts/password.ts"], duration: 45, passed: true)
      -> ok(mapping: m)
    then analyze(changedSources: ["./specs/password.concept"])
      -> ok(affectedTests: ts)
  }
}
```


### 1.4 ContractTest

Verifies that code generated for different target languages from the same concept specification actually interoperates. When Clef generates a TypeScript client and a Rust server from the same concept, no single builder can verify they work together.

**Sync points:** Build layer → Builder (fires after multiple targets build successfully for the same concept). Deploy layer → DeployPlan (contract test pass is a gate before deployment).

**Independent purpose test:** "Does the TypeScript client generated from `password` correctly communicate with the Rust server generated from `password`? Which serialization formats are compatible?" — requires state spanning both targets.

```
@version(1)
concept ContractTest [P] {

  purpose {
    Verify cross-target interoperability for concepts that
    generate code in multiple languages. Maintain contract
    definitions derived from concept specs. Track which
    producer-consumer pairs have been verified. Gate deployment
    on contract verification passing.
  }

  state {
    contracts: set P
    registry {
      concept: P -> String
      specVersion: P -> String
      producerLanguage: P -> String
      consumerLanguage: P -> String
      status: P -> String
      lastVerified: P -> option DateTime
    }
    definitions {
      actions: P -> list {
        actionName: String
        inputSchema: String
        outputVariants: list { name: String, schema: String }
        transport: String
      }
    }
  }

  actions {
    action generate(concept: String, specPath: String) {
      -> ok(contract: P, definition: { actions: list { actionName: String, inputSchema: String, outputVariants: list String } }) {
        Generate a contract definition from the concept spec.
        The contract captures the wire-level interface: action
        signatures, input/output schemas, and expected variants.
        Language-independent — the same contract applies to
        every target implementation.
      }
      -> specError(concept: String, message: String) {
        Spec couldn't be parsed or has no cross-target actions.
      }
    }

    action verify(contract: P, producerArtifact: String, producerLanguage: String, consumerArtifact: String, consumerLanguage: String) {
      -> ok(contract: P, passed: Int, total: Int) {
        Run contract verification: the consumer sends requests
        to the producer and checks that responses match the
        contract definition. Tests serialization round-trips,
        variant handling, error propagation, and edge cases.
      }
      -> incompatible(contract: P, failures: list { action: String, issue: String, producerBehavior: String, consumerExpectation: String }) {
        Contract verification failed. Returns per-action
        incompatibilities with what each side produced/expected.
        Common issues: serialization mismatch, missing variant
        handling, different default values, type coercion differences.
      }
      -> producerUnavailable(language: String, reason: String) {
        Producer artifact couldn't be loaded or started.
      }
      -> consumerUnavailable(language: String, reason: String) {
        Consumer artifact couldn't be loaded or started.
      }
    }

    action matrix(concepts: option list String) {
      -> ok(matrix: list {
        concept: String,
        pairs: list { producer: String, consumer: String, status: String, lastVerified: option DateTime }
      }) {
        Return cross-target verification matrix.
        Shows which language pairs have been verified
        for which concepts. Used by `clef test contract --matrix`.
      }
    }

    action canDeploy(concept: String, language: String) {
      -> ok(safe: Bool, verifiedAgainst: list String) {
        Check if deploying this concept in this language is
        safe — all contract pairs involving this language have
        been verified for the current spec version.
        Used as a deployment gate.
      }
      -> unverified(missingPairs: list { counterpart: String, lastVerified: option DateTime }) {
        Some contract pairs are unverified or stale.
        Deployment may be unsafe.
      }
    }
  }

  invariant {
    after generate(concept: "password", specPath: "./specs/password.concept")
      -> ok(contract: p, definition: d)
    and  verify(contract: p, producerArtifact: ".clef-artifacts/rust/password", producerLanguage: "rust", consumerArtifact: ".clef-artifacts/ts/password", consumerLanguage: "typescript")
      -> ok(contract: p, passed: 8, total: 8)
    then canDeploy(concept: "password", language: "typescript") -> ok(safe: true, verifiedAgainst: ["rust"])
  }
}
```


### 1.5 FlakyTest

Detects, tracks, and quarantines unreliable tests across all languages. Maintains per-test reliability history, quarantine status, and policy rules. Language-independent — the same quarantine mechanism applies to a flaky TypeScript test and a flaky Solidity test.

**Sync points:** Build layer → Builder (observes all test results from all builders). Deploy layer → DeployPlan (quarantined test failures don't block deployment).

**Independent purpose test:** "Is `test_password_hash_timing` flaky? How many times has it flip-flopped? Is it quarantined? Who owns it?" — answerable from test history alone.

```
@version(1)
concept FlakyTest [F] {

  purpose {
    Detect, track, and quarantine unreliable tests.
    Maintain per-test reliability history across all
    languages and builders. Apply quarantine policies
    so flaky tests don't block other developers.
    Notify owners. Monitor for stabilization.
  }

  state {
    tests: set F
    history {
      testId: F -> String
      language: F -> String
      builder: F -> String
      results: F -> list { passed: Bool, timestamp: DateTime, duration: Int }
      flipCount: F -> Int
      lastFlipAt: F -> option DateTime
    }
    quarantine {
      quarantined: F -> Bool
      quarantinedAt: F -> option DateTime
      quarantinedBy: F -> option String
      reason: F -> option String
      owner: F -> option String
      notifiedAt: F -> option DateTime
    }
    policy {
      flipThreshold: Int
      flipWindow: String
      autoQuarantine: Bool
      retryCount: Int
    }
  }

  actions {
    action record(testId: String, language: String, builder: String, passed: Bool, duration: Int) {
      -> ok(test: F) {
        Record a test result. Updates reliability history.
        If the result differs from the previous result
        (pass→fail or fail→pass), increments flipCount.
      }
      -> flakyDetected(test: F, flipCount: Int, recentResults: list Bool) {
        The test has exceeded the flip threshold within
        the configured window. This test is flaky.
        If autoQuarantine is enabled, automatically quarantines.
      }
    }

    action quarantine(testId: String, reason: String, owner: option String) {
      -> ok(test: F) {
        Manually quarantine a test. Quarantined tests still
        run but their failures don't block builds or deploys.
        Results are still recorded for monitoring.
      }
      -> alreadyQuarantined(test: F) {
        Test is already quarantined.
      }
      -> notFound(testId: String) {
        No history for this test ID.
      }
    }

    action release(testId: String) {
      -> ok(test: F) {
        Release a test from quarantine. It will block builds
        again if it fails. Used when a flaky test is fixed.
      }
      -> notQuarantined(test: F) {
        Test wasn't quarantined.
      }
    }

    action isQuarantined(testId: String) {
      -> yes(test: F, reason: String, owner: option String, quarantinedAt: DateTime) {
        Test is quarantined. Callers should treat failures
        as warnings, not errors.
      }
      -> no(test: F) {
        Test is not quarantined. Failures are real.
      }
      -> unknown(testId: String) {
        No history for this test.
      }
    }

    action report() {
      -> ok(summary: {
        totalTracked: Int,
        currentlyFlaky: Int,
        quarantined: Int,
        stabilized: Int,
        topFlaky: list { testId: String, language: String, flipCount: Int, owner: option String }
      }) {
        Return flaky test dashboard data.
        stabilized: tests that were quarantined but have
        been passing consistently (candidates for release).
      }
    }

    action setPolicy(flipThreshold: option Int, flipWindow: option String, autoQuarantine: option Bool, retryCount: option Int) {
      -> ok() {
        Update flaky detection policy.
        flipThreshold: number of flips to trigger detection (default: 3)
        flipWindow: time window for flips (default: "7d")
        autoQuarantine: automatically quarantine detected flaky tests (default: false)
        retryCount: number of retries before declaring failure (default: 1)
      }
    }
  }

  invariant {
    after record(testId: "test_timing", language: "typescript", builder: "TypeScriptBuilder", passed: true, duration: 50) -> ok(test: f)
    and  record(testId: "test_timing", language: "typescript", builder: "TypeScriptBuilder", passed: false, duration: 5001) -> ok(test: f)
    and  record(testId: "test_timing", language: "typescript", builder: "TypeScriptBuilder", passed: true, duration: 48) -> ok(test: f)
    then isQuarantined(testId: "test_timing") depends on policy.autoQuarantine
  }
}
```

---

## Part 2: Cross-Layer Syncs

The test suite's value is in how its five concepts wire into the existing generation, build, and deploy pipelines. Each sync point is documented with what triggers it and what it coordinates.

### 2.1 Generation Suite → Snapshot (output stability)

After Emitter writes generated files, Snapshot compares them against approved baselines.

```
sync CompareSnapshotAfterEmit [eager]
  purpose { Compare generated output against approved golden files. }
when {
  Emitter/writeBatch: []
    => ok(results: ?results)
}
then {
  Snapshot/compare: [
    outputPath: ?results.path;
    currentContent: ?results.contentHash
  ]
}
```

```
sync BlockBuildOnSnapshotRejection [eager]
  purpose { Prevent building if snapshot changes are unapproved. }
when {
  Snapshot/compare: [ outputPath: ?path ]
    => changed(snapshot: ?s; diff: ?diff)
}
then {
  # Generation continues, but build should check snapshot status
  # before proceeding. Snapshot/status gates Builder/build.
}
```

### 2.2 Generation Suite → Conformance (spec-to-test generation)

When a concept spec changes, Conformance regenerates test vectors from the spec.

```
sync RegenerateConformanceOnSpecChange [eager]
  purpose { Regenerate conformance vectors when concept spec changes. }
when {
  Resource/upsert: [ locator: ?loc; kind: "concept-spec" ]
    => changed(resource: ?r; previousDigest: ?prev)
}
where {
  bind(conceptNameFromLocator(?loc) as ?concept)
}
then {
  Conformance/generate: [ concept: ?concept; specPath: ?loc ]
}
```

### 2.3 Build Layer → TestSelection (change-aware test selection)

When source files change, TestSelection analyzes which tests to run before builders execute test suites.

```
sync AnalyzeTestsOnChange [eager]
  purpose { Determine affected tests when source changes. }
when {
  Resource/upsert: [ locator: ?loc ]
    => changed(resource: ?r; previousDigest: ?prev)
}
then {
  TestSelection/analyze: [ changedSources: [?loc] ]
}
```

```
sync SelectTestsWithBudget [eager]
  purpose { Select test subset from affected tests. }
when {
  TestSelection/analyze: [ changedSources: ?srcs ]
    => ok(affectedTests: ?affected)
}
then {
  TestSelection/select: [
    affectedTests: ?affected;
    budget: null
  ]
}
```

### 2.4 Build Layer → Builder (selected tests fed to builders)

Builder's `test` action receives selected test IDs from TestSelection instead of running all tests.

```
sync RunSelectedTests [eager]
  purpose { Run only selected tests instead of full suite. }
when {
  Builder/build: [ concept: ?concept; language: ?lang ]
    => ok(build: ?b; artifactHash: ?hash)
  TestSelection/select: []
    => ok(selected: ?tests; estimatedDuration: ?dur)
}
then {
  Builder/test: [
    concept: ?concept;
    language: ?lang;
    testFilter: ?tests
  ]
}
```

### 2.5 Build Layer → FlakyTest (observe all test results)

Every test result from every builder is recorded in FlakyTest for reliability tracking.

```
sync RecordTestResult [eager]
  purpose { Track every test result for flaky detection. }
when {
  Builder/test: [ concept: ?concept; language: ?lang ]
    => ok(passed: ?p; failed: ?f; skipped: ?s; duration: ?d)
}
then {
  FlakyTest/record: [
    testId: concat(?concept, ":", ?lang, ":suite");
    language: ?lang;
    builder: concat(?lang, "Builder");
    passed: equals(?f, 0);
    duration: ?d
  ]
}
```

```
sync RecordTestFailure [eager]
  purpose { Track individual test failures for flaky detection. }
when {
  Builder/test: [ concept: ?concept; language: ?lang ]
    => testFailure(passed: ?p; failed: ?f; failures: ?failures)
}
then {
  # Record each individual failing test
  FlakyTest/record: [
    testId: ?failures.test;
    language: ?lang;
    builder: concat(?lang, "Builder");
    passed: false;
    duration: 0
  ]
}
```

### 2.6 Build Layer → FlakyTest (quarantine check before blocking)

When a test fails, check if it's quarantined before blocking the build.

```
sync CheckQuarantineOnFailure [eager]
  purpose { Don't block build for quarantined (flaky) tests. }
when {
  Builder/test: [ concept: ?concept; language: ?lang ]
    => testFailure(failures: ?failures)
}
then {
  FlakyTest/isQuarantined: [ testId: ?failures.test ]
}

# If quarantined, downgrade failure to warning
sync DowngradeQuarantinedFailure [eager]
  purpose { Quarantined test failure becomes a warning, not a blocker. }
when {
  FlakyTest/isQuarantined: [ testId: ?testId ]
    => yes(reason: ?reason)
}
then {
  # Signal to DeployPlan that this failure is non-blocking
  Builder/recordWarning: [ testId: ?testId; message: concat("Quarantined: ", ?reason) ]
}
```

### 2.7 Build Layer → Conformance (verify after build)

After a concept is built for a language, run conformance verification.

```
sync VerifyConformanceAfterBuild [eager]
  purpose { Check spec conformance after build completes. }
when {
  Builder/build: [ concept: ?concept; language: ?lang ]
    => ok(build: ?b; artifactLocation: ?loc)
  Conformance/generate: [ concept: ?concept ]
    => ok(suite: ?suite)
}
then {
  Conformance/verify: [
    suite: ?suite;
    language: ?lang;
    artifactLocation: ?loc
  ]
}
```

### 2.8 Build Layer → ContractTest (cross-target after multi-build)

After builds complete for multiple languages of the same concept, run contract verification.

```
sync VerifyContractsAfterMultiBuild [eager]
  purpose { Verify cross-target contracts after all targets build. }
when {
  Builder/buildAll: [ concepts: ?concepts ]
    => ok(results: ?results)
}
then {
  ContractTest/generate: [ concept: ?concepts; specPath: ?specPath ]
}
```

```
sync RunContractVerification [eager]
  purpose { Execute contract verification between language pairs. }
when {
  ContractTest/generate: [ concept: ?concept ]
    => ok(contract: ?p; definition: ?def)
  Artifact/store: [ concept: ?concept; language: ?prodLang ] => ok(artifact: ?prodArt)
  Artifact/store: [ concept: ?concept; language: ?consLang ] => ok(artifact: ?consArt)
}
where {
  notEqual(?prodLang, ?consLang)
}
then {
  ContractTest/verify: [
    contract: ?p;
    producerArtifact: ?prodArt;
    producerLanguage: ?prodLang;
    consumerArtifact: ?consArt;
    consumerLanguage: ?consLang
  ]
}
```

### 2.9 Build Layer → TestSelection (update coverage mappings)

After tests run, record the coverage data to improve future test selection.

```
sync UpdateCoverageMappings [eager]
  purpose { Record test coverage for future test selection. }
when {
  Builder/test: [ concept: ?concept; language: ?lang ]
    => ok(passed: ?p; failed: ?f; duration: ?d)
}
then {
  TestSelection/record: [
    testId: concat(?concept, ":", ?lang);
    language: ?lang;
    coveredSources: sourcesFor(?concept);
    duration: ?d;
    passed: equals(?f, 0)
  ]
}
```

### 2.10 Deploy Layer → ContractTest (deployment gate)

Before deploying a concept, verify that its contracts are satisfied.

```
sync CheckContractsBeforeDeploy [eager]
  purpose { Gate deployment on cross-target contract verification. }
when {
  DeployPlan/execute: [ plan: ?plan ]
    => []
}
then {
  ContractTest/canDeploy: [ concept: ?concept; language: ?lang ]
}

sync BlockDeployOnContractFailure [eager]
  purpose { Prevent deployment if contracts are unverified. }
when {
  ContractTest/canDeploy: [ concept: ?concept; language: ?lang ]
    => unverified(missingPairs: ?pairs)
}
then {
  DeployPlan/gate: [
    concept: ?concept;
    reason: concat("Unverified contracts: ", ?pairs);
    severity: "error"
  ]
}
```

### 2.11 Deploy Layer → Conformance (deployment gate)

Before deploying, verify conformance passes.

```
sync CheckConformanceBeforeDeploy [eager]
  purpose { Gate deployment on conformance passing. }
when {
  DeployPlan/execute: [ plan: ?plan ]
    => []
}
then {
  Conformance/matrix: [ concepts: conceptsInPlan(?plan) ]
}

sync BlockDeployOnConformanceFailure [eager]
  purpose { Prevent deployment if conformance is failing. }
when {
  Conformance/matrix: []
    => ok(matrix: ?m)
}
where {
  hasStatus(?m, "failing")
}
then {
  DeployPlan/gate: [
    concept: failingConcept(?m);
    reason: "Conformance tests failing";
    severity: "error"
  ]
}
```

---

## Part 3: Full Pipeline Flow

### 3.1 The complete pipeline with test integration

```
Source change detected
    │
    ▼
Resource/upsert → changed
    │
    ├──▶ TestSelection/analyze (which tests are affected?)
    ├──▶ Conformance/generate (regenerate test vectors from spec)
    │
    ▼
GenerationPlan executes (sync engine drives)
    │
    ▼
Emitter/writeBatch → ok (generated files written)
    │
    ├──▶ Snapshot/compare (did generator output change?)
    │       ├── unchanged → continue
    │       ├── changed → requires approval before deploy
    │       └── new → requires initial approval
    │
    ▼
Toolchain/resolve → ok (compilers ready)
    │
    ▼
Builder/build → ok (per concept × per language)
    │
    ├──▶ Conformance/verify (does built code match spec?)
    │
    ▼
Builder/test → ok|testFailure (selected tests run)
    │
    ├──▶ FlakyTest/record (update reliability history)
    ├──▶ FlakyTest/isQuarantined (check before blocking)
    ├──▶ TestSelection/record (update coverage mappings)
    │
    ▼
Artifact/store → ok (per concept × per language)
    │
    ├──▶ ContractTest/verify (cross-target pairs)
    │
    ▼
DeployPlan/execute
    │
    ├── ContractTest/canDeploy → ok? (gate)
    ├── Conformance/matrix → all passing? (gate)
    ├── Snapshot/status → all approved? (gate)
    │
    ▼
Runtime/deploy → ok
```

### 3.2 DAG extension

The DeployPlan DAG gains test-specific gate nodes:

```
EXISTING BUILD NODES:
resolve-toolchain → build-concept → store-artifact

NEW TEST NODES (parallel with build where possible):
├── snapshot-check (after emit, before build — non-blocking advisory)
├── conformance-verify (after build, per language)
├── contract-verify (after build, per language pair)
├── flaky-check (observes test results)

DEPLOYMENT GATE:
test-gate (depends on: conformance-verify, contract-verify, snapshot-check)
    │
    ▼
provision-storage → deploy-concept → configure-transport → register-sync
```

---

## Part 4: Deploy Manifest Extension

```yaml
# app.deploy.yaml — test section
kit: content-management
version: 0.4.0

environment: production

# NEW — test configuration
test:
  snapshot:
    enabled: true
    baselineDir: .clef-snapshots/
    autoApprove: false                # require human approval

  conformance:
    enabled: true
    deviations:
      solidity:
        - requirement: optional-return-values
          reason: "Solidity uses revert instead of Option types"
        - requirement: datetime-actions
          reason: "Solidity uses block.timestamp, not DateTime"

  contracts:
    enabled: true
    pairs:
      - producer: rust
        consumer: typescript
      - producer: rust
        consumer: swift
    gate: true                        # block deploy on failure

  selection:
    enabled: true
    budget:
      maxDuration: 300                # seconds
    confidence: 0.95                  # minimum confidence threshold

  flaky:
    flipThreshold: 3
    flipWindow: 7d
    autoQuarantine: true
    retryCount: 2

# EXISTING — unchanged
build:
  targets:
    - language: typescript
      platform: node-20
      mode: release
    - language: rust
      platform: linux-x86_64
      mode: release

runtime:
  provider: LambdaRuntime
```


---

## Part 5: PluginRegistry Integration

Each test concept registers with PluginRegistry for discovery by DeployPlan and CLI tooling.

```
sync RegisterSnapshot [eager]
  purpose { Register Snapshot with PluginRegistry. }
when {
  Snapshot/register: []
    => ok(name: ?name; type: ?type)
}
then {
  PluginRegistry/register: [
    type: "test-concept";
    name: ?name;
    metadata: {
      layer: "generation";
      gate: false;
      concept: "Snapshot";
      trigger: "emitter-output"
    }
  ]
}
```

```
sync RegisterConformance [eager]
when {
  Conformance/register: []
    => ok(name: ?name)
}
then {
  PluginRegistry/register: [
    type: "test-concept";
    name: ?name;
    metadata: {
      layer: "build";
      gate: true;
      concept: "Conformance";
      trigger: "builder-output"
    }
  ]
}
```

Same pattern for ContractTest, TestSelection, FlakyTest — one registration sync each.

---

## Part 6: Kit Packaging

```yaml
# kits/test/suite.yaml
kit:
  name: test
  version: 0.1.0
  description: >
    Cross-layer testing coordination for Clef. Five concepts that span
    generation, build, and deploy: snapshot testing for generated output
    stability, conformance testing for spec fidelity, test selection for
    change-aware test optimization, cross-target contract testing for
    interoperability verification, and flaky test management for
    reliability tracking and quarantine.

concepts:
  Snapshot:
    spec: ./snapshot.concept
    params:
      S: { as: snapshot-ref, description: "Reference to a snapshot baseline" }

  Conformance:
    spec: ./conformance.concept
    params:
      C: { as: conformance-suite-ref, description: "Reference to a conformance test suite" }

  TestSelection:
    spec: ./test-selection.concept
    params:
      M: { as: mapping-ref, description: "Reference to a test-to-source coverage mapping" }

  ContractTest:
    spec: ./contract-test.concept
    params:
      P: { as: contract-ref, description: "Reference to a cross-target contract" }

  FlakyTest:
    spec: ./flaky-test.concept
    params:
      F: { as: flaky-ref, description: "Reference to a tracked test with reliability history" }

syncs:
  required:
    # Generation layer syncs
    - path: ./syncs/compare-snapshot-after-emit.sync
      description: "Emitter/writeBatch → Snapshot/compare"

    - path: ./syncs/regenerate-conformance-on-spec-change.sync
      description: "Resource/changed → Conformance/generate"

    # Build layer syncs
    - path: ./syncs/analyze-tests-on-change.sync
      description: "Resource/changed → TestSelection/analyze"

    - path: ./syncs/record-test-result.sync
      description: "Builder/test → FlakyTest/record"

    - path: ./syncs/update-coverage-mappings.sync
      description: "Builder/test → TestSelection/record"

  recommended:
    - path: ./syncs/verify-conformance-after-build.sync
      name: VerifyConformanceAfterBuild
      description: "Builder/build → ok → Conformance/verify"

    - path: ./syncs/verify-contracts-after-multi-build.sync
      name: VerifyContractsAfterMultiBuild
      description: "Builder/buildAll → ok → ContractTest/verify"

    - path: ./syncs/check-quarantine-on-failure.sync
      name: CheckQuarantineOnFailure
      description: "Builder/test → testFailure → FlakyTest/isQuarantined"

    - path: ./syncs/run-selected-tests.sync
      name: RunSelectedTests
      description: "TestSelection/select → Builder/test with filter"

    # Deploy layer gates
    - path: ./syncs/check-contracts-before-deploy.sync
      name: CheckContractsBeforeDeploy
      description: "DeployPlan/execute → ContractTest/canDeploy"

    - path: ./syncs/check-conformance-before-deploy.sync
      name: CheckConformanceBeforeDeploy
      description: "DeployPlan/execute → Conformance/matrix"

uses:
  - kit: infrastructure
    concepts:
      - name: PluginRegistry

  - kit: generation
    concepts:
      - name: Emitter
      - name: Resource

  - kit: deploy
    concepts:
      - name: Builder
      - name: Artifact
      - name: DeployPlan
```

### Directory structure

```
kits/test/
├── suite.yaml
├── snapshot.concept
├── conformance.concept
├── test-selection.concept
├── contract-test.concept
├── flaky-test.concept
├── syncs/
│   ├── compare-snapshot-after-emit.sync           # required
│   ├── regenerate-conformance-on-spec-change.sync # required
│   ├── analyze-tests-on-change.sync               # required
│   ├── record-test-result.sync                    # required
│   ├── update-coverage-mappings.sync              # required
│   ├── verify-conformance-after-build.sync        # recommended
│   ├── verify-contracts-after-multi-build.sync    # recommended
│   ├── check-quarantine-on-failure.sync           # recommended
│   ├── run-selected-tests.sync                    # recommended
│   ├── check-contracts-before-deploy.sync         # recommended
│   └── check-conformance-before-deploy.sync       # recommended
├── implementations/
│   └── typescript/
│       ├── snapshot.impl.ts
│       ├── conformance.impl.ts
│       ├── test-selection.impl.ts
│       ├── contract-test.impl.ts
│       └── flaky-test.impl.ts
└── tests/
    ├── conformance/
    └── integration/
        ├── snapshot-approval-workflow.test.ts
        ├── cross-target-contract.test.ts
        ├── flaky-detection.test.ts
        └── test-selection-accuracy.test.ts
```

---

## Part 7: CLI Integration

```bash
# ─── Snapshot commands ───

# Show snapshot status for all generated output
clef test snapshot --status
#   generated/ts/password.ts — current ✅
#   generated/ts/user.ts — CHANGED (3 lines added, 1 removed)
#   generated/rust/password.rs — current ✅
#   generated/swift/password.swift — NEW (no baseline)

# Show diff for a changed snapshot
clef test snapshot --diff generated/ts/user.ts

# Approve a specific change
clef test snapshot --approve generated/ts/user.ts

# Approve all changes (after reviewing diffs)
clef test snapshot --approve-all

# Reject a change (signals unintentional generator change)
clef test snapshot --reject generated/ts/user.ts

# Clean orphaned baselines
clef test snapshot --clean


# ─── Conformance commands ───

# Show conformance matrix
clef test conformance --matrix
#   Concept     │ TypeScript │ Rust   │ Swift  │ Solidity
#   ────────────┼────────────┼────────┼────────┼──────────
#   password    │ full ✅    │ full ✅│ full ✅│ partial (2 deviations)
#   user        │ full ✅    │ full ✅│ untested│ untested

# Show traceability for a concept
clef test conformance --trace password

# Run conformance for a specific language
clef test conformance --concept password --language swift

# Register a deviation
clef test conformance --deviation password solidity optional-return-values "Uses revert"


# ─── Contract commands ───

# Show contract verification matrix
clef test contract --matrix
#   Concept    │ rust→ts  │ rust→swift │ ts→rust
#   ───────────┼──────────┼────────────┼────────
#   password   │ pass ✅  │ pass ✅   │ pass ✅
#   user       │ pass ✅  │ unverified │ pass ✅

# Run contract verification for a specific pair
clef test contract --concept password --producer rust --consumer typescript

# Check if safe to deploy
clef test contract --can-deploy password typescript


# ─── Test selection commands ───

# Analyze what tests are affected by current changes
clef test select --analyze
#   Changed: ./specs/password.concept
#   Affected tests (12):
#     test_password_hash (typescript) — relevance: 1.0, direct coverage
#     test_password_hash (rust) — relevance: 1.0, direct coverage
#     test_password_verify (typescript) — relevance: 0.9, transitive
#     ...
#   Estimated duration: 23s (vs 180s full suite)
#   Selection confidence: 98.2%

# Show selection statistics
clef test select --stats


# ─── Flaky test commands ───

# Show flaky test report
clef test flaky --report
#   Currently flaky: 3
#   Quarantined: 2
#   Candidates for release: 1
#
#   Top flaky:
#     test_timing (typescript) — 7 flips in 7d, quarantined
#     test_network_timeout (rust) — 4 flips in 7d, quarantined
#     test_concurrent_hash (swift) — 3 flips in 7d, not quarantined

# Manually quarantine a test
clef test flaky --quarantine test_timing --reason "Timing-dependent" --owner "alice"

# Release a test from quarantine
clef test flaky --release test_timing

# Update policy
clef test flaky --policy flipThreshold=5 autoQuarantine=true


# ─── Unified test command ───

# Run all test types
clef test
#   Snapshots: 12 current, 2 changed (approval required)
#   Conformance: 8/8 passing, 2 deviations documented
#   Contracts: 3/3 pairs verified
#   Unit tests: 45 passed, 0 failed (12 selected, 33 skipped by selection)
#   Flaky: 2 quarantined, 0 new detections
#
#   Result: PASS (with 2 snapshot changes requiring approval)

# Run only specific test types
clef test --only snapshot,conformance
clef test --only contracts
clef test --skip flaky
```

---

## Part 8: Design Decisions

### Why a new suite instead of extending deploy

Builder and Toolchain extend the deploy kit because their artifacts feed directly into Runtime/deploy. Testing concepts have sync points across all three layers:

| Concept | Generation Suite | Build Layer | Deploy Layer |
|---|---|---|---|
| Snapshot | Emitter output | — | — |
| Conformance | Resource (spec changes) | Builder output | Deploy gate |
| TestSelection | Resource (changes) | Builder/test | — |
| ContractTest | — | Builder/buildAll, Artifact | Deploy gate |
| FlakyTest | — | Builder/test | Deploy gate (quarantine) |

No single layer owns testing. The test kit imports from all three and coordinates between them.

### Why five concepts, not one TestRunner

A single `TestRunner` concept that handles snapshots, conformance, contracts, selection, and flaky management would violate concept independence. Each has genuinely different state:

- Snapshot: golden file baselines + approval status
- Conformance: spec requirements + traceability + deviation registry
- TestSelection: source-to-test coverage mappings + historical fail rates
- ContractTest: contract definitions + verification matrix + language pair status
- FlakyTest: per-test reliability history + quarantine status + policy rules

A change to flaky test policy shouldn't affect snapshot baselines. A new conformance deviation shouldn't touch test selection mappings. Independence prevents coupling.

### Why no providers for test concepts

Unlike Runtime (which needs LambdaRuntime, EcsRuntime) or Builder (which needs SwiftBuilder, TypeScriptBuilder), test concepts are inherently language-agnostic:

- Snapshot compares file content hashes — language doesn't matter
- Conformance generates test vectors from the spec — same vectors for all languages
- TestSelection maintains coverage mappings — keyed by `(testId, language)` in one concept
- ContractTest verifies wire-level contracts — language-pair aware but not language-specific
- FlakyTest tracks reliability — same quarantine mechanism for any language

Per-language test *execution* stays in Builder providers. The test kit coordinates, selects, compares, and manages — it never runs language-specific code.

### What about unit tests?

Unit test execution stays exactly where it is — in `SwiftBuilder/test`, `TypeScriptBuilder/test`, etc. The test kit doesn't replace or wrap unit test execution. It adds five cross-cutting concerns that builders can't handle alone:

1. **Before** unit tests run: TestSelection decides *which* tests (not "all of them")
2. **After** unit tests complete: FlakyTest evaluates *reliability*, TestSelection updates *mappings*
3. **Alongside** unit tests: Conformance verifies *spec fidelity*, Snapshot checks *output stability*
4. **Across** unit tests: ContractTest verifies *cross-target interop*
5. **Gating** deployment: Conformance + ContractTest + Snapshot approval required before deploy

### Three concerns that don't warrant concepts

**Test result aggregation** — collecting pass/fail across all builders into a unified report. This is a query over existing Builder state, not independent state. A sync that observes all `Builder/test` completions and writes a summary is sufficient.

**Coverage aggregation** — merging coverage data from TypeScript (istanbul), Rust (tarpaulin), and Swift (xcov). No independent purpose beyond reporting. TestSelection already uses coverage data internally for selection accuracy — it doesn't need to expose aggregated coverage as a separate concept.

**Test environment provisioning** — creating isolated environments for integration tests. Uses the same mechanisms as deployment (Docker, cloud resources). The deploy suite's Runtime/Env concepts handle this. Test-specific aspects (ephemeral, auto-teardown) are configuration, not a new concept.

---

## Part 9: Concept Count Impact

| Addition | Count |
|---|---|
| Snapshot | 1 |
| Conformance | 1 |
| TestSelection | 1 |
| ContractTest | 1 |
| FlakyTest | 1 |
| **Total new concepts** | **5** |

No providers. No changes to existing concepts beyond Builder gaining an optional `testFilter` parameter on its `test` action and DeployPlan gaining a `gate` action for test-based deployment blocking.

| Syncs | Count |
|---|---|
| Required (generation→test, build→test) | 5 |
| Recommended (deployment gates, selection, quarantine) | 6 |
| **Total new syncs** | **11** |

---

## Part 10: Implementation Plan

### Phase 1: Snapshot (highest leverage for code generators)

**Goal:** Every generator change shows a diff. Unintentional changes caught before they reach build.

1. Implement Snapshot concept (compare, approve, reject, status, diff, clean)
2. Wire Emitter/writeBatch → Snapshot/compare sync
3. Implement `.clef-snapshots/` baseline storage
4. Implement `clef test snapshot` CLI
5. Validate: change a generator template → snapshot shows diff → approve → next generation matches

**Acceptance:** `clef test snapshot --status` shows per-file status. Changed snapshots require explicit `--approve`.

### Phase 2: FlakyTest (most persistent pain across any test suite)

**Goal:** Flaky tests detected, quarantined, and tracked without manual intervention.

1. Implement FlakyTest concept (record, quarantine, release, isQuarantined, report, setPolicy)
2. Wire Builder/test → FlakyTest/record for all builders
3. Wire FlakyTest/isQuarantined → downgrade failures
4. Implement `clef test flaky` CLI
5. Validate: run flaky test 5 times → auto-detected → auto-quarantined → doesn't block build

**Acceptance:** `clef test flaky --report` shows dashboard. Quarantined test failures produce warnings, not errors.

### Phase 3: Conformance (spec fidelity critical for multi-target)

**Goal:** Every generated target verified against the concept spec with requirement traceability.

1. Implement Conformance concept (generate, verify, registerDeviation, matrix, traceability)
2. Build test vector generator from concept spec parser
3. Wire Resource/changed → Conformance/generate
4. Wire Builder/build → Conformance/verify
5. Implement deviation registry
6. Implement `clef test conformance` CLI

**Acceptance:** `clef test conformance --matrix` shows per-language conformance. `clef test conformance --trace password` shows requirement-to-test mapping.

### Phase 4: TestSelection (optimization, not critical path)

**Goal:** Only run tests affected by changes. Reduce test suite time by >50%.

1. Implement TestSelection concept (analyze, select, record, statistics)
2. Wire Builder/test results → TestSelection/record (build coverage database)
3. Wire Resource/changed → TestSelection/analyze → Builder/test with filter
4. Validate: change one spec → only related tests run
5. Track selection accuracy over time

**Acceptance:** `clef test select --analyze` shows affected tests. Full suite only runs on `--force`.

### Phase 5: ContractTest (critical for multi-target deployments)

**Goal:** TypeScript client verified against Rust server (and every other language pair).

1. Implement ContractTest concept (generate, verify, matrix, canDeploy)
2. Build contract generator from concept spec
3. Wire Builder/buildAll → ContractTest/verify for configured pairs
4. Wire ContractTest/canDeploy as deployment gate
5. Implement `clef test contract` CLI

**Acceptance:** `clef test contract --matrix` shows verification status. `clef deploy` blocked if contracts unverified.

### Phase 6: Deployment gates (polish)

**Goal:** Full integration — tests gate deployment.

1. Wire Conformance/matrix → DeployPlan/gate
2. Wire ContractTest/canDeploy → DeployPlan/gate
3. Wire Snapshot/status → DeployPlan/gate (optionally — advisory vs blocking)
4. Implement `clef deploy --skip-tests` escape hatch
5. Validate: full pipeline from spec change → generation → snapshot → build → test → conformance → contract → deploy

**Acceptance:** `clef deploy` runs full test suite and blocks on failures. `clef deploy --skip-tests` bypasses for emergencies.
