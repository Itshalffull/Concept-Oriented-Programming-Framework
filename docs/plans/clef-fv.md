# Clef Formal Verification: Complete Implementation Plan

**Version:** 2.0.0
**Date:** 2026-03-15
**Status:** Implementation-ready specification
**Supersedes:** formal-verification-synthesis.md, formal-verification-integration-plan.md, dual-path-handler-verification.md, clef-formal-verification-unified-plan.md v1.0.0

---

## 0. Executive Summary

This plan makes Clef a self-verifying framework. Every `.concept` file is a formal specification. Every handler is tested or proved against that specification. Every sync is a composable contract. Every `.widget` file is a checkable behavioral spec. Verification workflows are modeled as ProcessSpecs using the existing process kit, with multi-AI validation and human approval gates.

Five layers:
1. **Invariant language** — seven invariant constructs extending `.concept`, `.widget`, `.sync`, and `.derived` invariant sections via a shared universal grammar
2. **Test generation** — mechanical compilation from invariants to PBT, boundary vectors, and fuzz harnesses
3. **Formal verification** — dual-path solver-backed verification (Path A: spec consistency + conformance; Path B: direct translation)
4. **Surface verification** — automatic widget FSM, accessibility, theme contrast, affordance catalog checks
5. **Kernel verification** — TLA+ models of sync engine and concept runtime

Three DX tiers: Tier 1 (zero effort, automatic tests + Surface checks), Tier 2 (LLM-assisted property synthesis with multi-AI review + human approval), Tier 3 (expert-written formal invariants).

Six verification workflows modeled as ProcessSpecs using the existing process kit, seeded at kernel startup.

**Total additions:** 9 new concepts, 1 derived concept, 11 provider concepts, 35 syncs, 14 QualitySignal dimensions, 7 enhanced existing concepts, 6 ProcessSpec definitions, 7 Signature seeds, 8 SpecificationSchema seeds, 3 FewShotExample seeds, 1 Constitution seed.

---

## 1. Invariant Language Extensions

### 1.1 Existing Syntax (Retained)

Bare invariant blocks default to `example`. Zero change for existing authors.

### 1.2 New Constructs

| Construct | Syntax | Solver target | Test generation target | Tier |
|---|---|---|---|---|
| `example` | `example "name": { after ... then ... }` | None (Conformance test) | 1:1 test vector | 1 |
| `forall`/`given` | `forall "name": { given x in {set} after ... }` | Alloy (finite) / Z3 (infinite) | One PBT property per clause | 2-3 |
| `always` | `always "name": { forall p in state: predicate }` | Z3 / Alloy | Stateful sequence tests | 2-3 |
| `never` | `never "name": { exists p in state: bad_predicate }` | Z3 (negated existential) | Violation-attempt sequence tests | 2-3 |
| `eventually` | `eventually "name": { forall r where cond: outcome }` | TLC (TLA+) | Bounded sequence tests | 3-4 |
| `action requires/ensures` | `action X { requires: P  ensures ok: Q }` | Z3 / Dafny | PBT generators constrained by requires, assertions from ensures | 2-3 |
| `scenario` | `scenario "name" { fixture … when { … } then { … } settlement … }` | None (Integration test) | Multi-step end-to-end test via IntegrationTestGen | 1-2 |

All seven constructs are parsed by the universal `handlers/ts/framework/invariant-body-parser.ts` and shared across `.concept`, `.widget`, `.view`, `.sync`, and `.derived` specs. Per-kind variation is limited to the `AssertionContext` plugin that resolves identifiers.

### 1.3 Full Example

```
invariant {
  example "happy path": {
    after define(kind: "invariant", propertyText: "x > 0",
                 formalLanguage: "smtlib", scope: "local", priority: "required")
      -> ok(property: p)
    then check(property: p, solver: "z3", timeout_ms: 5000)
      -> ok(property: p, status: "proved")
  }

  forall "valid kinds accepted": {
    given kind in {"invariant","precondition","postcondition",
                   "temporal","safety","liveness"}
    after define(kind: kind, propertyText: any(String), formalLanguage: any(String),
                 scope: any(String), priority: any(String))
      -> ok(property: _)
  }

  always "status consistency": {
    forall p in properties:
      status(p) in {"unproven","proved","refuted","unknown","timeout"}
  }

  never "proved without evidence": {
    exists p in properties:
      status(p) = "proved" and not exists e in evidence_refs:
        e.property_ref = id(p)
  }

  eventually "runs terminate": {
    forall r in runs where status(r) = "running":
      status(r) in {"completed","timeout","cancelled"}
  }

  action define {
    requires: kind in {"invariant","precondition","postcondition",
                       "temporal","safety","liveness"}
    requires: propertyText.length > 0
    ensures ok: status(result.property) = "unproven"
    ensures ok: result.property not_in old(properties)
    ensures invalid: kind not_in valid_kinds or propertyText.length = 0
  }
}
```

---

## 2. Concept Inventory

### 2.1 New Concepts

| Concept | Suite | Purpose | Pattern |
|---|---|---|---|
| **FormalProperty** | formal-verification | Atomic formal claims with proof status | Standard |
| **Contract** | formal-verification | Assume-guarantee pairs | Standard |
| **Evidence** | formal-verification | Content-addressed proof artifacts | Standard |
| **VerificationRun** | formal-verification | Verification session lifecycle | Standard (@gate) |
| **SolverProvider** | formal-verification | Solver dispatch routing | Coordination+provider |
| **SpecificationSchema** | formal-verification | Reusable property templates | Standard |
| **QualitySignal** | test (v0.2.0) | Normalized quality for Score | Standard |
| **TestGen** | test (v0.3.0) | PBT/fuzz code generation from invariants | Coordination+provider |

### 2.2 Derived Concept

| Derived | Purpose |
|---|---|
| **VerifiedConcept** | Compose verification with concept implementation |

### 2.3 Provider Concepts (11)

| Provider | Coordinator | Purpose |
|---|---|---|
| Z3Provider | SolverProvider | SMT solving |
| CVC5Provider | SolverProvider | SMT with strings/sequences |
| AlloyProvider | SolverProvider | Bounded model checking |
| LeanProvider | SolverProvider | Interactive theorem proving |
| DafnyProvider | SolverProvider | Deductive verification |
| CertoraProvider | SolverProvider | Smart contract verification |
| FormalVerificationStrategy | AgentLoop | CEGIS loop for LLM-assisted proving |
| TestGenTypeScript | TestGen | fast-check + fc.commands |
| TestGenRust | TestGen | proptest + cargo-fuzz |
| TestGenSwift | TestGen | SwiftCheck |
| TestGenSolidity | TestGen | Foundry fuzz + Echidna |

### 2.4 Enhanced Existing Concepts (7)

| Concept | Enhancement |
|---|---|
| **Conformance** | `invariant-driven` generation mode for boundary vectors |
| **Builder** | `test` gains `--fuzz` and `--property` modes |
| **Score** | Consumes QualitySignal.rollup |
| **DeployPlan** | `gate` action consuming QualitySignal |
| **WidgetParser** | Emits FormalProperty for FSM/a11y/binding checks |
| **ThemeParser** | Emits FormalProperty for contrast checks |
| **Intent** | Property synthesis reads operationalPrinciples (via sync) |

### 2.5 Concepts Rejected (16)

State Machine (→ Schema+Intent), Obligation (→ FormalProperty.status), Specification (→ query over FormalProperty), SolverCall (→ VerificationRun.results), ProofCertificate (→ Evidence.artifact_type), Counterexample (→ Evidence.artifact_type), VerificationArtifact (→ Evidence+Artifact), Translation (→ SolverProvider), RegressionSuite (→ Conformance), VerificationMetrics (→ QualitySignal→Score), Refinement Mapping (→ Contract+sync), Ghost State (→ FormalProperty.ghost), LLMProver (→ FormalVerificationStrategy), TestVector separate concept (→ Conformance enhancement), FuzzTarget separate concept (→ TestGen providers).

---

## 3. Suite Architecture

### 3.1 formal-verification (new)

```yaml
kit:
  name: formal-verification
  version: 0.1.0
  description: >
    Composable formal verification: properties, contracts, evidence,
    runs, solver dispatch, specification templates.
concepts:
  FormalProperty: { spec: ./formal-property.concept, params: { P: { as: property-id } } }
  Contract: { spec: ./contract.concept, params: { C: { as: contract-id } } }
  Evidence: { spec: ./evidence.concept, params: { E: { as: evidence-id } } }
  VerificationRun: { spec: ./verification-run.concept, params: { V: { as: run-id } } }
  SolverProvider: { spec: ./solver-provider.concept, params: { S: { as: solver-id } } }
  SpecificationSchema: { spec: ./specification-schema.concept, params: { SS: { as: schema-id } } }
syncs:
  required:
    - ./syncs/verification-publishes-quality-signal.sync
    - ./syncs/property-from-intent-principles.sync
    - ./syncs/solver-dispatch.sync
    - ./syncs/evidence-to-artifact.sync
    - ./syncs/run-records-evidence.sync
  recommended:
    - ./syncs/contract-from-sync-definitions.sync
    - ./syncs/llm-synthesizes-property.sync
    - ./syncs/cegis-refinement-loop.sync
    - ./syncs/property-coverage-to-score.sync
    - ./syncs/conformance-triggers-reverification.sync
uses:
  - kit: test
    concepts: [QualitySignal]
  - kit: foundation
    concepts: [Intent, Schema]
  - kit: infrastructure
    concepts: [PluginRegistry, Validator]
  - kit: deploy
    optional: true
    concepts: [Artifact]
  - kit: llm-agent
    optional: true
    concepts: [AgentLoop]
  - kit: llm-core
    optional: true
    concepts: [LLMProvider]
  - kit: process-foundation
    optional: true
    concepts: [ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable]
```

### 3.2 formal-verification-solvers (new)

```yaml
kit:
  name: formal-verification-solvers
  version: 0.1.0
providers:
  Z3Provider: { spec: ./z3-provider.provider }
  CVC5Provider: { spec: ./cvc5-provider.provider, optional: true }
  AlloyProvider: { spec: ./alloy-provider.provider }
  LeanProvider: { spec: ./lean-provider.provider, optional: true }
  DafnyProvider: { spec: ./dafny-provider.provider, optional: true }
  CertoraProvider: { spec: ./certora-provider.provider, optional: true }
uses:
  - kit: formal-verification
    concepts: [SolverProvider, FormalProperty, Evidence]
  - kit: infrastructure
    concepts: [PluginRegistry]
```

### 3.3 test (updated v0.3.0)

```yaml
kit:
  name: test
  version: 0.3.0
  description: >
    Cross-layer testing, quality publishing, and automated test generation.
concepts:
  Snapshot: { spec: ./snapshot.concept }
  Conformance: { spec: ./conformance.concept }
  ContractTest: { spec: ./contract-test.concept }
  TestSelection: { spec: ./test-selection.concept }
  FlakyTest: { spec: ./flaky-test.concept }
  QualitySignal: { spec: ./quality-signal.concept, params: { Q: { as: quality-signal-ref } } }
  TestGen: { spec: ./test-gen.concept, params: { T: { as: test-gen-ref } } }
syncs:
  required:
    - ./syncs/compare-snapshot-after-emit.sync
    - ./syncs/conformance-monitors-spec-changes.sync
    - ./syncs/snapshot-publishes-quality-signal.sync
    - ./syncs/conformance-publishes-quality-signal.sync
    - ./syncs/contract-publishes-quality-signal.sync
    - ./syncs/unit-tests-publish-quality-signal.sync
    - ./syncs/invariant-compiled-to-conformance-vectors.sync
    - ./syncs/invariant-compiled-to-test-gen.sync
    - ./syncs/test-gen-dispatches-to-provider.sync
    - ./syncs/generated-tests-run-by-builder.sync
    - ./syncs/property-test-results-publish-quality-signal.sync
    - ./syncs/fuzz-results-publish-quality-signal.sync
  recommended:
    - ./syncs/flaky-publishes-quality-signal.sync
    - ./syncs/selection-publishes-quality-signal.sync
uses:
  - kit: deploy
    optional: true
    concepts: [Builder, Artifact, DeployPlan]
  - kit: infrastructure
    concepts: [PluginRegistry]
```

### 3.4 test-gen-providers (new)

```yaml
kit:
  name: test-gen-providers
  version: 0.1.0
providers:
  TestGenTypeScript: { spec: ./typescript-test-gen.provider }
  TestGenRust: { spec: ./rust-test-gen.provider }
  TestGenSwift: { spec: ./swift-test-gen.provider }
  TestGenSolidity: { spec: ./solidity-test-gen.provider }
uses:
  - kit: test
    concepts: [TestGen]
  - kit: infrastructure
    concepts: [PluginRegistry]
```

---

## 4. Concept Specifications

*(Full specs for FormalProperty, Contract, Evidence, VerificationRun, SolverProvider, SpecificationSchema, QualitySignal, and TestGen. These are unchanged from v1.0.0 of this plan — see §4.1-4.8 of the superseded document for complete state/actions/invariants. Reproduced here in summary form for space.)*

### 4.1 FormalProperty [P]
State: properties set, target_symbol, kind, property_text, formal_language, scope, status, ghost, dependencies, metadata (created_at, updated_at, author, priority).
Actions: define, prove, refute, check, synthesize, coverage, list, invalidate.

### 4.2 Contract [C]
State: contracts set, name, source_concept, target_concept, assumptions, guarantees, compatibility_status, composition_chain.
Actions: define, verify, compose, discharge, list.

### 4.3 Evidence [E]
State: evidence set, artifact_type, content_path, content_hash, solver_metadata, confidence_score, property_ref, created_at.
Actions: record, validate, retrieve, compare, minimize, list.

### 4.4 VerificationRun [V] (@gate)
State: runs set, target_symbol, properties_checked, solver_used, timeout_ms, status, started_at, ended_at, results, resource_usage.
Actions: start, complete, timeout, cancel, get_status, compare.

### 4.5 SolverProvider [S] (coordination+provider)
State: providers set, provider_id, supported_languages, supported_kinds, capabilities, status, priority.
Actions: register, dispatch, dispatch_batch, health_check, list, unregister.

### 4.6 SpecificationSchema [SS]
State: schemas set, name, category, pattern_type, template_text, formal_language, parameters, examples.
Actions: define, instantiate, validate, list_by_category, search.

### 4.7 QualitySignal [Q]
State: signals set, target_symbol, dimension, status, severity, run_ref, observed_at, evidence (summary, artifact_path, artifact_hash).
Actions: record, latest, rollup, explain.

### 4.8 TestGen [T] (coordination+provider)
State: generations set, concept_ref, language, provider_used, generated_files, invariant_version, generated_at, config (num_runs, fuzz_duration_s, shrink_enabled, stateful_test_depth).
Actions: generate, regenerate, list, configure, coverage.

---

## 5. Derived Concept: VerifiedConcept

```
derived VerifiedConcept [T] {
  purpose {
    Compose formal verification with concept implementation.
    A VerifiedConcept has formalized Intent principles, proved properties,
    satisfied contracts at sync boundaries, and generated tests passing
    across all target languages.
  }
  composes { Schema [T], Intent [T], FormalProperty [T], Contract [T],
             Evidence [T], QualitySignal [T] }
  syncs {
    required: [property-from-intent-principles, verification-publishes-quality-signal,
               run-records-evidence, invariant-compiled-to-test-gen,
               invariant-compiled-to-conformance-vectors]
    recommended: [contract-from-sync-definitions, llm-synthesizes-property]
  }
  surface {
    action verify(target: String) { entry: Intent/verify matches on targetId: ?target }
    query verificationStatus(target: String) {
      reads: QualitySignal/latest(target_symbol: ?target, dimension: "formal") }
    query proofCoverage(target: String) {
      reads: FormalProperty/coverage(target_symbol: ?target) }
    query testCoverage(target: String) {
      reads: TestGen/coverage(concept: ?target) }
  }
  principle {
    after verify(target: x) and all FormalProperty for x have status "proved"
    then verificationStatus(target: x) returns status: "pass"
    and  proofCoverage(target: x) returns coverage_pct: 100.0
  }
}
```

---

## 6. Handler Verification: Dual-Path Architecture

### 6.1 Shared: Spec Compilation (mechanical, no LLM)

Concept spec grammar compiles deterministically to Dafny contracts:
- `set P` → `set<PropertyId>`
- `P -> String` → `map<PropertyId, string>`
- `action -> ok|invalid` → `datatype` with variants
- `requires:` → Dafny `requires`
- `ensures ok:` → `ensures r.Ok? ==>`
- `always` → `predicate Valid()`
- Frame conditions auto-generated from concept independence rule

### 6.2 Path A: Spec Verification + Conformance (default, all languages)

| Step | LLM? | Task | SOTA rate |
|---|---|---|---|
| A.1 Spec compilation | No | Concept → Dafny contracts | 100% |
| A.2 Spec consistency | Yes | LLM fills witness body satisfying contracts | 86-96% |
| A.3 Test generation | No | InvariantCompiler → vectors + PBT + fuzz | 100% |
| A.4 Conformance | No | Run vectors against real handlers (all languages) | Handler-dependent |
| A.5 Property testing | No | fast-check/proptest/SwiftCheck (10K+) | Statistical |

A.2 uses the DafnyBench annotation task — the LLM generates ANY implementation satisfying the contracts (not a translation of the real handler). This proves the spec is consistent.

### 6.3 Path B: Direct Handler Translation (opt-in, stronger guarantee)

| Step | LLM? | Task | SOTA rate |
|---|---|---|---|
| B.1 Spec compilation | No | Same as A.1 | 100% |
| B.2a Rust→Verus annotation | Yes | Add Verus annotations to Rust | ~86-96% |
| B.2b TS→Dafny translation | Yes | Translate handler faithfully to Dafny | ~40-60% |
| B.3 Verification | No | Dafny/Verus verifies | 100% (oracle) |
| B.4 Fidelity check | No | Compare translation vs original on test vectors | Empirical |

Path B gracefully degrades to Path A on failure. Path selection: Rust+Verus→B.2a, Dafny handler→B.3, @security-critical→attempt B then A, default→A.

### 6.4 SOTA Reference

| Task | Best rate | System |
|---|---|---|
| Dafny annotation only | 96% | Latest LLMs on DafnyBench (2026) |
| DafnyPro annotation | 86% | Claude 3.5 + DafnyPro (POPL '26) |
| Dafny vericoding | 82% | Off-the-shelf LLMs (vericoding benchmark) |
| Lean theorem proving | 88.9% | DeepSeek-Prover-V2-671B |
| Dafny→Verus translation | 45% | AlphaVerus (self-improving) |
| TS→Dafny translation | No benchmark | — |

---

## 7. Test Generation Pipeline

### 7.1 Compilation Rules (InvariantCompiler, mechanical)

| Invariant construct | Boundary vectors | fast-check (TS) | proptest (Rust) | Foundry (Sol) |
|---|---|---|---|---|
| `kind in {set}` | One per enum | `fc.constantFrom(...)` | `prop_oneof![Just(...)]` | `vm.assume` |
| `kind not_in {set}` | Negative samples | `fc.string().filter(...)` | `.prop_filter(...)` | `vm.assume` |
| `x.length > 0` | `""` + `"a"` + long | `fc.string({minLength:1})` | `".{1,500}"` | `vm.assume` |
| `ensures ok: f = v` | Assert in vector | `expect(f).toBe(v)` | `prop_assert_eq!` | `assertEq` |
| `always: pred` | After-every-action | `fc.commands/modelRun` | State machine | Echidna invariant |
| `never: pred` | Targeted violation | `fc.commands + assert NOT` | State machine | Echidna property |

### 7.2 Target Frameworks

| Language | PBT | Stateful | Fuzzer | Runner |
|---|---|---|---|---|
| TypeScript | fast-check | fc.commands/fc.modelRun | — | Jest/Vitest |
| Rust | proptest | Custom state machine | cargo-fuzz (libFuzzer) | cargo test |
| Swift | SwiftCheck | Custom state machine | — | XCTest |
| Solidity | Foundry fuzz | Echidna sequences | Echidna | forge test |

---

## 8. Surface / UI Verification

### 8.1 Automatic Checks (Tier 1, in WidgetParser/ThemeParser)

| Check | Dimension |
|---|---|
| FSM determinism, reachability, deadlock-freedom, event coverage, parallel independence | surface-fsm |
| ARIA role-children, modal-focus, roving-keyboard, state references | surface-a11y |
| Part existence, prop existence, type compatibility, compose validity | surface-binding |
| WCAG contrast for all fg/bg pairs | surface-contrast |
| Affordance completeness, fallback existence, ambiguity detection | surface-catalog |

### 8.2 Generated Code Fidelity (Tier 1)

For each `.widget` FSM, generate Conformance tests: for each (state, event) → assert new state + connect bindings. Run against every WidgetGen output.

### 8.3 Widget Invariant Formalization (Tier 2-3)

Prose invariants → structured: `always "thumbs don't cross": { props.minValue <= props.maxValue }`

---

## 9. Verification Workflows (ProcessSpecs)

All verification workflows use existing process kit concepts (ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable, ProcessEvent, LLMCall, ConnectorCall, WorkItem, Approval, Timer, RetryPolicy, CompensationPlan, Escalation). No new concepts needed — workflows are configuration seeded at kernel startup.

### 9.1 Property Synthesis and Validation

The primary Tier 2 workflow. Claude synthesizes via CEGIS, solver verifies, two independent AIs review, developer approves.

```
Steps:
  synthesize      (llm)         Claude generates property via CEGIS loop
  solver-check    (automation)  Dafny/Z3 verifies spec consistency
  review-fork     (fork)        Parallel AI reviews
  ai-review-1     (llm)         ChatGPT independently reviews
  ai-review-2     (llm)         Gemini independently reviews
  review-join     (join)        Wait for both reviews
  consensus       (automation)  Check agreement + confidence
  record-yellow   (automation)  Record AI-validated property (yellow in Score)
  human-review    (human)       Developer approves/rejects (makes it green)
  upgrade-green   (automation)  Upgrade to gate severity
  discard         (automation)  Remove rejected property

Flow: synthesize → solver-check → FORK[ai-review-1, ai-review-2] → JOIN
      → consensus → (ai-validated → record-yellow → human-review
                      → approved: upgrade-green | rejected: discard
                     | ai-rejected: discard)
```

**Status lifecycle:**
- Created → Proved (solver says satisfiable) → AI-Validated (yellow, warn severity) → Human-Approved (green, gate severity)
- Score colors: Dark green (human-validated), Yellow (AI-validated), Light green (solver-verified only), Red/gray (unproven/failed)

**Configurable policies** (in `clef-verify.config.yaml`):
- `consensus.policy`: unanimous | majority | any-two
- `consensus.min_confidence`: 0.7
- `human_review.required`: true/false
- `human_review.escalation_timeout`: "7d"
- `human_review.auto_approve_after`: null | "30d"

### 9.2 Counterexample Investigation

When a property is refuted, minimize → explain → classify → triage.

```
Steps:
  minimize           (automation)  Evidence/minimize reduces trace
  explain            (llm)         LLM generates human-readable explanation
  classify           (llm)         LLM classifies: handler-bug | spec-error | spurious
  ai-confirm         (llm)         Second LLM confirms classification
  developer-triage   (human)       Developer decides action

developer-triage branches:
  "handler-bug"        → WorkItem for handler fix
  "spec-error"         → Subprocess: property-synthesis-and-validation (re-synthesis)
  "spurious"           → Mark Evidence as spurious
  "needs-investigation" → Escalation with full context
```

### 9.3 Solver Escalation Chain

When Z3 times out, try progressively more expensive solvers.

```
Steps:
  z3              (automation)  Z3 with 5s timeout
  cvc5            (automation)  CVC5 with 10s timeout (if z3 unknown/timeout)
  alloy           (automation)  Alloy bounded check scope 10, 15s (if cvc5 fails)
  dafny-with-llm  (llm)         Dafny with LLM annotation, CEGIS, 30s (if alloy fails)
  record-result   (automation)  Record Evidence + update FormalProperty
  report-unknown  (automation)  All solvers exhausted, record diagnostics

Flow: z3 →(proved/refuted: record-result)→(unknown/timeout: cvc5)
      →(proved/refuted: record-result)→(unknown/timeout: alloy)
      →(proved/refuted: record-result)→(unknown/timeout: dafny-with-llm)
      →(proved/refuted: record-result)→(unknown/timeout: report-unknown)

Retry policy: max 1 retry on solver_crash/network_error, fixed 1s delay.
```

### 9.4 Concept Onboarding Verification

New `.concept` file → extract intent, generate tests + properties in parallel, verify, establish baseline.

```
Steps:
  extract-intent    (automation)  Parse .concept, load Intent
  parallel-gen      (fork)        Tests + properties in parallel
  generate-tests    (automation)  TestGen/generate from invariants
  synthesize-props  (automation)  FormalProperty/synthesize from invariants
  gen-join          (join)        Wait for both
  run-conformance   (automation)  Conformance/verify with generated vectors
  verify-spec       (automation)  Path A spec consistency
  verify-properties (automation)  SolverProvider/dispatch_batch
  ai-validate-each  (subprocess)  property-synthesis-and-validation for each property
  publish-baseline  (automation)  QualitySignal initial quality

Flow: extract-intent → FORK[generate-tests, synthesize-props] → JOIN
      → run-conformance → verify-spec → verify-properties
      → for_each(property): subprocess(property-synthesis-and-validation)
      → publish-baseline
```

### 9.5 Reverification Cascade

Handler change → targeted re-verification within time budget.

```
Steps:
  identify-scope      (automation)  Find affected properties + contracts
  prioritize          (automation)  TestSelection ranks by cost + failure probability
  invalidate          (automation)  FormalProperty/invalidate batch
  reverify-batch      (automation)  SolverProvider/dispatch_batch (budgeted)
  recheck-contracts   (automation)  Contract/verify for affected syncs
  update-rollup       (automation)  QualitySignal batch update
  notify-if-regression (automation) Alert if previously-green now red

Timer: 300s budget. On timeout: record partial, queue remainder for next CI run.
```

### 9.6 Path B Handler Verification

Direct translation with fidelity check and graceful fallback.

```
Steps:
  select-strategy   (automation)  Determine: Rust→Verus, TS→Dafny, Swift→Dafny
  verus-annotate    (llm)         [Rust only] Add Verus annotations
  translate-to-dafny (llm)        [TS/Swift] Translate handler to Dafny
  verify-direct     (automation)  Dafny/Verus verify
  cegis-repair      (llm)         Repair on verification error (up to 5 iterations)
  fidelity-check    (automation)  Run Conformance on both original + translation
  record-proof      (automation)  Record Path B Evidence (green)
  fallback-path-a   (automation)  Fall back to Path A on any failure

Compensation: on failure, cleanup partial translation artifacts.
```

---

## 10. Seed Data

All seeds are illustrative. The actual format must conform to the Clef seeds specification (not available at time of writing). Each seed file lives alongside its suite's `suite.yaml`.

### 10.1 formal-verification/process-spec.seeds.yaml

```yaml
# NOTE: Format is illustrative. Adapt to actual Clef seeds spec.
# These seeds create ProcessSpec instances at kernel startup.

seeds:
  - concept: ProcessSpec
    id: property-synthesis-and-validation
    action: publish
    data:
      name: "Property Synthesis and Validation"
      version: 1
      steps:
        - key: synthesize
          type: llm
          config:
            provider: anthropic
            model: claude-sonnet-4-5-20250929
            strategy: formal-verification
            max_cegis_iterations: 5
          next: solver-check

        - key: solver-check
          type: automation
          config: { connector: dafny-verifier, timeout_ms: 30000 }
          next: review-fork

        - key: review-fork
          type: fork
          branches: [ai-review-1, ai-review-2]

        - key: ai-review-1
          type: llm
          config:
            provider: openai
            model: gpt-4o
            temperature: 0.1
            prompt_signature: property-review
          next: review-join

        - key: ai-review-2
          type: llm
          config:
            provider: google
            model: gemini-2.5-pro
            temperature: 0.1
            prompt_signature: property-review
          next: review-join

        - key: review-join
          type: join
          join_condition: all
          next: consensus

        - key: consensus
          type: automation
          config: { policy: unanimous, min_confidence: 0.7 }
          routing:
            - condition: "consensus in {ai-validated, ai-validated-with-concerns}"
              next: record-yellow
            - condition: "consensus = ai-rejected"
              next: discard

        - key: record-yellow
          type: automation
          config: { action: record-ai-validated-property }
          next: human-review

        - key: human-review
          type: human
          config:
            work_item_type: property-review
            priority: normal
            escalation_timeout: "7d"
          routing:
            - { condition: approved, next: upgrade-green }
            - { condition: rejected, next: discard }
            - { condition: edit, next: synthesize }

        - key: upgrade-green
          type: automation
          config: { action: upgrade-to-gate }

        - key: discard
          type: automation
          config: { action: discard-property }

  - concept: ProcessSpec
    id: counterexample-investigation
    action: publish
    data:
      name: "Counterexample Investigation"
      version: 1
      steps:
        - key: minimize
          type: automation
          config: { action: evidence-minimize, timeout_ms: 10000 }
          next: explain
        - key: explain
          type: llm
          config: { provider: anthropic, model: claude-sonnet-4-5-20250929, prompt_signature: counterexample-explanation }
          next: classify
        - key: classify
          type: llm
          config: { provider: anthropic, model: claude-sonnet-4-5-20250929, prompt_signature: counterexample-classification }
          next: ai-confirm
        - key: ai-confirm
          type: llm
          config: { provider: openai, model: gpt-4o, prompt_signature: counterexample-classification-review }
          next: developer-triage
        - key: developer-triage
          type: human
          config: { work_item_type: counterexample-triage, priority: high, escalation_timeout: "3d" }
          routing:
            - { condition: "action = handler-bug", next: create-fix-task }
            - { condition: "action = spec-error", next: restart-synthesis }
            - { condition: "action = spurious", next: mark-spurious }
            - { condition: "action = investigate", next: create-investigation }
        - key: create-fix-task
          type: human
          config: { work_item_type: handler-fix, priority: high }
        - key: restart-synthesis
          type: subprocess
          config: { spec_ref: property-synthesis-and-validation }
        - key: mark-spurious
          type: automation
          config: { action: mark-evidence-spurious }
        - key: create-investigation
          type: human
          config: { work_item_type: investigation, priority: normal }

  - concept: ProcessSpec
    id: solver-escalation
    action: publish
    data:
      name: "Solver Escalation Chain"
      version: 1
      steps:
        - key: z3
          type: automation
          config: { solver: z3, timeout_ms: 5000 }
          routing:
            - { condition: "status in {proved, refuted}", next: record-result }
            - { condition: "status in {unknown, timeout}", next: cvc5 }
        - key: cvc5
          type: automation
          config: { solver: cvc5, timeout_ms: 10000 }
          routing:
            - { condition: "status in {proved, refuted}", next: record-result }
            - { condition: "status in {unknown, timeout}", next: alloy }
        - key: alloy
          type: automation
          config: { solver: alloy, scope: 10, timeout_ms: 15000 }
          routing:
            - { condition: "status in {proved, refuted}", next: record-result }
            - { condition: "status in {unknown, timeout}", next: dafny-with-llm }
        - key: dafny-with-llm
          type: llm
          config: { provider: anthropic, model: claude-sonnet-4-5-20250929, strategy: formal-verification, max_cegis_iterations: 5, timeout_ms: 30000 }
          routing:
            - { condition: "status in {proved, refuted}", next: record-result }
            - { condition: "status in {unknown, timeout}", next: report-unknown }
        - key: record-result
          type: automation
          config: { action: record-evidence-and-update-property }
        - key: report-unknown
          type: automation
          config: { action: record-unknown-with-diagnostics }
      retry_policy: { max_retries: 1, retry_on: [solver_crash, network_error], delay_ms: 1000 }

  - concept: ProcessSpec
    id: concept-onboarding-verification
    action: publish
    data:
      name: "Concept Onboarding Verification"
      version: 1
      steps:
        - key: extract-intent
          type: automation
          config: { action: parse-concept-and-load-intent }
          next: parallel-gen
        - key: parallel-gen
          type: fork
          branches: [generate-tests, synthesize-props]
        - key: generate-tests
          type: automation
          config: { action: testgen-generate }
          next: gen-join
        - key: synthesize-props
          type: automation
          config: { action: formal-property-synthesize }
          next: gen-join
        - key: gen-join
          type: join
          join_condition: all
          next: run-conformance
        - key: run-conformance
          type: automation
          config: { action: conformance-verify, timeout_ms: 60000 }
          next: verify-spec
        - key: verify-spec
          type: automation
          config: { action: path-a-spec-consistency, timeout_ms: 30000 }
          next: verify-properties
        - key: verify-properties
          type: automation
          config: { action: solver-dispatch-batch, timeout_ms: 120000 }
          next: ai-validate-each
        - key: ai-validate-each
          type: subprocess
          config: { spec_ref: property-synthesis-and-validation, for_each: "$.process_variables.synthesized_properties" }
          next: publish-baseline
        - key: publish-baseline
          type: automation
          config: { action: publish-initial-quality-baseline }

  - concept: ProcessSpec
    id: reverification-cascade
    action: publish
    data:
      name: "Reverification Cascade"
      version: 1
      steps:
        - key: identify-scope
          type: automation
          config: { action: find-affected-properties-and-contracts }
          next: prioritize
        - key: prioritize
          type: automation
          config: { action: test-selection-rank, strategy: cost-then-failure-probability }
          next: invalidate
        - key: invalidate
          type: automation
          config: { action: formal-property-invalidate-batch }
          next: reverify-batch
        - key: reverify-batch
          type: automation
          config: { action: solver-dispatch-batch-budgeted, budget_ms: 120000 }
          next: recheck-contracts
        - key: recheck-contracts
          type: automation
          config: { action: contract-verify-affected }
          next: update-rollup
        - key: update-rollup
          type: automation
          config: { action: quality-signal-batch-update }
          next: notify-if-regression
        - key: notify-if-regression
          type: automation
          config: { action: check-regressions-and-notify, notify_on: previously-green-now-red }
      timer: { budget_timeout: 300000, on_timeout: record-partial-and-queue-remainder }

  - concept: ProcessSpec
    id: path-b-handler-verification
    action: publish
    data:
      name: "Path B Handler Verification"
      version: 1
      steps:
        - key: select-strategy
          type: automation
          config: { action: determine-translation-target }
          routing:
            - { condition: "language = rust and verus_available", next: verus-annotate }
            - { condition: "language = dafny", next: verify-direct }
            - { condition: "language in {typescript, swift}", next: translate-to-dafny }
        - key: verus-annotate
          type: llm
          config: { provider: anthropic, model: claude-sonnet-4-5-20250929, prompt_signature: rust-verus-annotation }
          next: verify-direct
        - key: translate-to-dafny
          type: llm
          config: { provider: anthropic, model: claude-sonnet-4-5-20250929, prompt_signature: handler-to-dafny-translation, max_cegis_iterations: 5 }
          next: verify-direct
        - key: verify-direct
          type: automation
          config: { action: dafny-or-verus-verify, timeout_ms: 30000 }
          routing:
            - { condition: verified, next: fidelity-check }
            - { condition: "error and attempts < 5", next: cegis-repair }
            - { condition: "error and attempts >= 5", next: fallback-path-a }
        - key: cegis-repair
          type: llm
          config: { provider: anthropic, model: claude-sonnet-4-5-20250929, prompt_signature: dafny-repair }
          next: verify-direct
        - key: fidelity-check
          type: automation
          config: { action: run-conformance-on-both, timeout_ms: 60000 }
          routing:
            - { condition: outputs-match, next: record-proof }
            - { condition: outputs-mismatch, next: fallback-path-a }
        - key: record-proof
          type: automation
          config: { action: record-path-b-evidence }
        - key: fallback-path-a
          type: automation
          config: { action: initiate-path-a-fallback }
      compensation: { on_failure: cleanup-partial-translation-artifacts }
```

### 10.2 formal-verification/signature.seeds.yaml

```yaml
# NOTE: Format is illustrative. Adapt to actual Clef seeds spec.
# These seeds create Signature instances for LLM prompt I/O schemas.

seeds:
  - concept: Signature
    id: property-review
    action: define
    data:
      name: property-review
      input_fields:
        - { name: property_text, type: String, description: "Formal property to review" }
        - { name: original_invariant, type: String, description: "Source invariant clause" }
        - { name: handler_source, type: String, description: "Handler implementation" }
        - { name: solver_result, type: String, description: "Solver verdict" }
      output_fields:
        - { name: verdict, type: String, description: "APPROVE | REJECT | CONCERNS" }
        - { name: confidence, type: Float, description: "0.0-1.0" }
        - { name: explanation, type: String, description: "Rationale" }
      instruction: >
        Review whether this formal property faithfully captures the intent of
        the original invariant. Is it too weak? Too strong? Does it match the
        handler logic? Does it make unstated assumptions?
      module_type: chain_of_thought

  - concept: Signature
    id: property-synthesis
    action: define
    data:
      name: property-synthesis
      input_fields:
        - { name: target_symbol, type: String }
        - { name: intent_principles, type: String }
        - { name: action_signature, type: String }
        - { name: state_declarations, type: String }
        - { name: example_traces, type: String }
      output_fields:
        - { name: properties, type: String, description: "Formal properties in extended invariant syntax" }
        - { name: confidence_per_property, type: String }
        - { name: reasoning, type: String }
      instruction: >
        Generate formal properties from operational principles and examples.
        Use forall, always, never, action requires/ensures. Be conservative.
      module_type: chain_of_thought

  - concept: Signature
    id: counterexample-explanation
    action: define
    data:
      name: counterexample-explanation
      input_fields:
        - { name: counterexample, type: String }
        - { name: property_text, type: String }
        - { name: handler_source, type: String }
        - { name: minimized_trace, type: String }
      output_fields:
        - { name: explanation, type: String }
        - { name: root_cause, type: String }
        - { name: suggested_fix, type: String }
      instruction: >
        Explain this counterexample to a developer. Use concrete values.
        Point to the specific handler line. Suggest a fix.
      module_type: chain_of_thought

  - concept: Signature
    id: counterexample-classification
    action: define
    data:
      name: counterexample-classification
      input_fields:
        - { name: counterexample, type: String }
        - { name: explanation, type: String }
        - { name: property_text, type: String }
        - { name: handler_source, type: String }
      output_fields:
        - { name: classification, type: String, description: "handler-bug | spec-error | spurious" }
        - { name: confidence, type: Float }
        - { name: reasoning, type: String }
      instruction: >
        Classify: handler-bug (handler has real bug), spec-error (property
        is wrong), spurious (solver artifact). When in doubt: needs-investigation.
      module_type: chain_of_thought

  - concept: Signature
    id: spec-consistency-check
    action: define
    data:
      name: spec-consistency-check
      input_fields:
        - { name: dafny_spec, type: String, description: "Dafny class with contracts, no body" }
      output_fields:
        - { name: dafny_witness, type: String, description: "Method body satisfying contracts" }
        - { name: auxiliary_lemmas, type: String }
      instruction: >
        Write a Dafny method body satisfying all requires/ensures. This is a
        witness proving satisfiability. Keep it simple. Do NOT modify contracts.
      module_type: chain_of_thought

  - concept: Signature
    id: handler-to-dafny-translation
    action: define
    data:
      name: handler-to-dafny-translation
      input_fields:
        - { name: handler_source, type: String }
        - { name: concept_state_dafny, type: String }
        - { name: preconditions, type: String }
        - { name: postconditions, type: String }
        - { name: action_signature, type: String }
      output_fields:
        - { name: dafny_method, type: String }
        - { name: auxiliary_lemmas, type: String }
        - { name: ghost_state, type: String }
      instruction: >
        Translate faithfully to Dafny. Mirror control flow exactly. Do not
        simplify. Every source branch must have a Dafny branch. Add frame
        conditions for all unmodified state fields.
      module_type: chain_of_thought

  - concept: Signature
    id: rust-verus-annotation
    action: define
    data:
      name: rust-verus-annotation
      input_fields:
        - { name: rust_handler, type: String }
        - { name: preconditions, type: String }
        - { name: postconditions, type: String }
      output_fields:
        - { name: annotated_rust, type: String }
        - { name: proof_functions, type: String }
      instruction: >
        Add Verus annotations. Do NOT modify executable code. Add only:
        requires, ensures, invariant, assert, proof blocks, spec functions.
        Executable functions cannot be called in ghost code.
      module_type: chain_of_thought

  - concept: Signature
    id: dafny-repair
    action: define
    data:
      name: dafny-repair
      input_fields:
        - { name: original_dafny, type: String }
        - { name: error_diagnostic, type: String }
        - { name: failing_clause, type: String }
        - { name: handler_source, type: String }
        - { name: attempt_number, type: Int }
      output_fields:
        - { name: repaired_dafny, type: String }
        - { name: explanation, type: String }
      instruction: >
        Fix so it verifies. Do not change requires/ensures. Add/modify:
        assert, ghost vars, helper lemmas, invariant clauses. Common: add
        intermediate assertions, strengthen loop invariants, prune non-inductive clauses.
      module_type: chain_of_thought
```

### 10.3 formal-verification/specification-schema.seeds.yaml

```yaml
# NOTE: Format is illustrative. Adapt to actual Clef seeds spec.

seeds:
  - concept: SpecificationSchema
    id: dwyer-absence
    action: define
    data:
      name: absence
      category: dwyer_pattern
      pattern_type: absence
      template_text: "always (not ${event})"
      formal_language: smtlib
      parameters: [{ name: event, type: String, description: "Event that must never occur" }]

  - concept: SpecificationSchema
    id: dwyer-existence
    action: define
    data:
      name: existence
      category: dwyer_pattern
      pattern_type: existence
      template_text: "eventually (${event})"
      formal_language: smtlib
      parameters: [{ name: event, type: String, description: "Event that must eventually occur" }]

  - concept: SpecificationSchema
    id: dwyer-universality
    action: define
    data:
      name: universality
      category: dwyer_pattern
      pattern_type: universality
      template_text: "always (${condition})"
      formal_language: smtlib
      parameters: [{ name: condition, type: String, description: "Condition that must always hold" }]

  - concept: SpecificationSchema
    id: dwyer-response
    action: define
    data:
      name: response
      category: dwyer_pattern
      pattern_type: response
      template_text: "always (${trigger} implies eventually ${response})"
      formal_language: smtlib
      parameters:
        - { name: trigger, type: String, description: "Triggering event" }
        - { name: response, type: String, description: "Required response" }

  - concept: SpecificationSchema
    id: dwyer-precedence
    action: define
    data:
      name: precedence
      category: dwyer_pattern
      pattern_type: precedence
      template_text: "not (${event}) until (${prerequisite})"
      formal_language: smtlib
      parameters:
        - { name: event, type: String, description: "Event that must be preceded" }
        - { name: prerequisite, type: String, description: "Prerequisite event" }

  - concept: SpecificationSchema
    id: smart-contract-reentrancy
    action: define
    data:
      name: reentrancy-guard
      category: smart_contract
      pattern_type: absence
      template_text: "always (call_depth(${function}) <= 1)"
      formal_language: cvl
      parameters: [{ name: function, type: String, description: "Function to guard" }]

  - concept: SpecificationSchema
    id: smart-contract-overflow
    action: define
    data:
      name: arithmetic-overflow-guard
      category: smart_contract
      pattern_type: absence
      template_text: "always (${expression} <= MAX_UINT256)"
      formal_language: cvl
      parameters: [{ name: expression, type: String, description: "Expression to guard" }]

  - concept: SpecificationSchema
    id: data-integrity-nonzero
    action: define
    data:
      name: non-zero-field
      category: data_integrity
      pattern_type: universality
      template_text: "always (forall x in ${collection}: ${field}(x) != ${zero_value})"
      formal_language: smtlib
      parameters:
        - { name: collection, type: String, description: "Set to check" }
        - { name: field, type: String, description: "Field that must be non-zero" }
        - { name: zero_value, type: String, description: "Zero/empty value", default_value: "0" }
```

### 10.4 formal-verification/constitution.seeds.yaml

```yaml
# NOTE: Format is illustrative. Adapt to actual Clef seeds spec.

seeds:
  - concept: Constitution
    id: formal-verification-constitution
    action: define
    data:
      name: "Formal Verification Constitution"
      rules:
        - "Never modify handler logic — only generate annotations, properties, or translations"
        - "Never weaken a requires or ensures clause to make verification pass"
        - "Never use assume(false), sorry, {:verify false}, or equivalent proof-disabling constructs"
        - "Never replace postconditions with ensures true or trivial conditions"
        - "All generated properties must be expressible in the target formal language"
        - "Frame conditions must cover all state fields not explicitly modified"
        - "Counterexample classifications must distinguish handler-bug from spec-error"
        - "When in doubt, classify as needs-investigation rather than spurious"
```

### 10.5 formal-verification/few-shot-example.seeds.yaml

```yaml
# NOTE: Format is illustrative. Adapt to actual Clef seeds spec.
# Bootstrap examples. These grow over time as verifications succeed.

seeds:
  - concept: FewShotExample
    id: review-approve-example
    action: add
    data:
      signature_ref: property-review
      input:
        property_text: "forall p in passwords: len(p.hash) = 64"
        original_invariant: "ensures ok: hash is 64 characters"
        handler_source: "function hash(pw) { return sha256(pw); }"
        solver_result: "satisfiable"
      output:
        verdict: "APPROVE"
        confidence: 0.95
        explanation: "Property correctly captures SHA-256 producing 64-char hex. Matches handler."

  - concept: FewShotExample
    id: review-concerns-example
    action: add
    data:
      signature_ref: property-review
      input:
        property_text: "forall p in passwords: len(p.hash) > 0"
        original_invariant: "ensures ok: hash is 64 characters"
        handler_source: "function hash(pw) { return sha256(pw); }"
        solver_result: "satisfiable"
      output:
        verdict: "CONCERNS"
        confidence: 0.7
        explanation: "Too weak. Original says exactly 64 chars but property only requires non-empty."

  - concept: FewShotExample
    id: repair-assert-example
    action: add
    data:
      signature_ref: dafny-repair
      input:
        original_dafny: "method define(...) ensures r.Ok? ==> status[r.property] == Unproven { ... }"
        error_diagnostic: "Error: postcondition might not hold on line 23"
        failing_clause: "ensures r.Ok? ==> status[r.property] == Unproven"
        handler_source: "function define(kind, text) { ... }"
        attempt_number: 1
      output:
        repaired_dafny: "method define(...) { ... assert status[p] == Unproven; return Ok(p); }"
        explanation: "Added assert before return to help prover track status through map update."
```

---

## 11. Complete Sync Inventory (35 total)

### 11.1 Formal Verification Syncs (10)

| # | Sync | Trigger → Effect |
|---|---|---|
| 1 | verification-publishes-quality-signal | VerificationRun/complete → QualitySignal/record |
| 2 | property-from-intent-principles | Intent/define → FormalProperty/synthesize |
| 3 | solver-dispatch | FormalProperty/check(solver:"auto") → SolverProvider/dispatch |
| 4 | evidence-to-artifact | Evidence/record → Artifact/store |
| 5 | run-records-evidence | SolverProvider result → Evidence/record + FormalProperty/prove\|refute |
| 6 | contract-from-sync-definitions | SyncCompiler/compile → Contract/define |
| 7 | llm-synthesizes-property | FormalProperty/synthesize gaps → AgentLoop/execute |
| 8 | cegis-refinement-loop | FormalProperty/refute → AgentLoop/execute (repair) |
| 9 | property-coverage-to-score | FormalProperty/coverage → QualitySignal/record |
| 10 | conformance-triggers-reverification | Conformance/monitor specChanged → FormalProperty/invalidate |

### 11.2 QualitySignal Publisher Syncs (8)

| # | Sync | Source → QualitySignal dimension |
|---|---|---|
| 11 | snapshot-publishes-quality-signal | Snapshot/compare → snapshot |
| 12 | conformance-publishes-quality-signal | Conformance/verify → conformance |
| 13 | contract-publishes-quality-signal | ContractTest/verify → contract |
| 14 | unit-tests-publish-quality-signal | Builder/test → unit |
| 15 | flaky-publishes-quality-signal | FlakyTest/detect → flaky |
| 16 | selection-publishes-quality-signal | TestSelection/confidence → selection |
| 17 | property-test-results-publish-quality-signal | Builder/test(property) → property-test |
| 18 | fuzz-results-publish-quality-signal | Builder/test(fuzz) → fuzz |

### 11.3 Test Generation Syncs (6)

| # | Sync | Trigger → Effect |
|---|---|---|
| 19 | invariant-compiled-to-conformance-vectors | Resource/track .concept → Conformance/generate(invariant-driven) |
| 20 | invariant-compiled-to-test-gen | Resource/track .concept → TestGen/generate |
| 21 | test-gen-dispatches-to-provider | TestGen/generate → PluginRegistry → TestGen{Lang}/generate |
| 22 | generated-tests-run-by-builder | TestGen ok → Builder/test(property) |
| 23 | surface-checks-publish-quality-signal | WidgetParser/parse → QualitySignal (fsm, a11y, binding) |
| 24 | theme-checks-publish-quality-signal | ThemeParser/parse → QualitySignal (contrast) |

### 11.4 Surface Verification Syncs (3)

| # | Sync | Trigger → Effect |
|---|---|---|
| 25 | widget-fsm-verified | WidgetParser/parse → QualitySignal(surface-fsm) |
| 26 | widget-a11y-verified | WidgetParser/parse → QualitySignal(surface-a11y) |
| 27 | widget-fidelity-tested | WidgetGen/generate → Conformance(surface-fidelity) |

### 11.5 Workflow Trigger Syncs (5)

| # | Sync | Trigger → Effect |
|---|---|---|
| 28 | property-synthesis-starts-process | FormalProperty/synthesize ok → ProcessRun/start(property-synthesis-and-validation) |
| 29 | counterexample-starts-investigation | FormalProperty/refute ok → ProcessRun/start(counterexample-investigation) |
| 30 | solver-timeout-starts-escalation | FormalProperty/check timeout → ProcessRun/start(solver-escalation) |
| 31 | new-concept-starts-onboarding | Resource/track new .concept → ProcessRun/start(concept-onboarding-verification) |
| 32 | change-starts-reverification | Conformance/monitor specChanged → ProcessRun/start(reverification-cascade) |

### 11.6 Multi-AI Validation Syncs (3)

| # | Sync | Trigger → Effect |
|---|---|---|
| 33 | ai-consensus-records-property | StepRun/complete(consensus, ai-validated) → QualitySignal(warn) |
| 34 | human-approval-upgrades-property | Approval/approve → QualitySignal(pass, gate) |
| 35 | path-b-request-starts-translation | FormalProperty/check(solver:"path-b") → ProcessRun/start(path-b-handler-verification) |

---

## 12. Kernel Verification

### 12.1 Concept Runtime — State Isolation

Property: action dispatch on C reads/writes only C's state. Approach: Dafny model + Rust ownership + Conformance from TLA+ model.

### 12.2 Sync Engine — Dispatch Correctness

Properties: fires only on match, executes only declared actions, no side effects, chains terminate. Approach: TLA+ model, TLC bounded check in CI.

### 12.3 Type System — Property-Based Testing

Properties: validation round-trips, type enforcement, schema extension. Approach: fast-check/proptest with random schemas.

---

## 13. Developer Experience Tiers

### 13.1 Tier 1: Zero Effort (80%)

```
$ clef build
  Password: compiled
    ✓ Conformance: 8/8 traces    ✓ Property tests: 847 (10K runs)
    ✓ Surface: FSM ok            ✓ Theme contrast: 12/12 WCAG AA
  Quality: ██████████████░░ 87%
    formal: gray (opt in with `clef verify --synthesize`)
```

### 13.2 Tier 2: LLM-Assisted (15%)

```
$ clef verify --synthesize
  Synthesized 5 properties → review → 3 AI-validated (yellow)
  → developer approves → 3 human-validated (green)
  Quality: ████████████████░ 93%
```

### 13.3 Tier 3: Expert (5%)

```
$ clef verify
  7 manual properties → 6 proved, 1 liveness unknown
  Quality: █████████████████ 97%
```

---

## 14. QualitySignal Dimensions (14)

| Dimension | Source | Default severity | Tier |
|---|---|---|---|
| conformance | Conformance/verify | gate | 1 |
| unit | Builder/test | gate | 1 |
| contract | ContractTest/verify | gate | 1 |
| snapshot | Snapshot/compare | gate | 1 |
| property-test | TestGen → Builder/test(property) | gate | 1 |
| fuzz | Builder/test(fuzz) | warn | 1 |
| formal | FormalProperty verification | gate | 2-3 |
| formal-liveness | Eventually properties | info | 3-4 |
| surface-fsm | WidgetParser FSM checks | gate | 1 |
| surface-a11y | WidgetParser a11y checks | gate | 1 |
| surface-contrast | ThemeParser contrast | gate | 1 |
| surface-binding | WidgetParser connect checks | gate | 1 |
| surface-catalog | Widget/register catalog | warn | 1 |
| surface-fidelity | Generated widget Conformance | gate | 1 |

---

## 15. Implementation Phases

### Phase 1: QualitySignal + Surface Checks + TestGen (Weeks 1-4)
QualitySignal, 8 publisher syncs, WidgetParser/ThemeParser extensions, affordance catalog checks, TestGen + TypeScript/Rust providers, InvariantCompiler, Score integration. **Deliverable: `clef build` shows all Tier 1 results.**

### Phase 2: FV Core Concepts (Weeks 5-8)
All 6 FV concepts, spec-to-Dafny compiler, 10 FV syncs, Contract auto-generation, Dwyer schema seeds. **Deliverable: Full pipeline with mock solver.**

### Phase 3: Real Solvers (Weeks 9-11)
Z3, Alloy, CVC5, Dafny providers. Invariant-to-SMT-LIB and invariant-to-Alloy translators. **Deliverable: `clef verify` produces real verdicts.**

### Phase 4: LLM Integration + Workflows (Weeks 12-15)
FormalVerificationStrategy, CEGIS sync, 6 ProcessSpec seeds, 7 Signature seeds, Constitution seed, FewShotExample seeds. Multi-AI review workflow. `clef verify --synthesize`. **Deliverable: Tier 2 DX complete.**

### Phase 5: Path B + Kernel Model (Weeks 16-19)
Verus annotation for Rust, TS→Dafny translation, fidelity checker, B→A fallback. TLA+ models. LeanProvider. **Deliverable: Path B works for Rust. Kernel models pass bounded checks.**

### Phase 6: Multi-Language + Polish (Weeks 20-26)
Rust/Swift/Solidity implementations. TestGenSwift/Solidity. VerifiedConcept.derived. Cross-language Conformance. `clef verify --watch`. Documentation. Schema library expansion.

---

## 16. Counts

| Category | Count |
|---|---|
| New repertoire concepts | 8 |
| New derived concept | 1 |
| New solver providers | 6 |
| New strategy provider | 1 |
| New test gen providers | 4 |
| Total new syncs | 35 |
| QualitySignal dimensions | 14 |
| Enhanced existing concepts | 7 |
| ProcessSpec definitions (seeded) | 6 |
| Signature definitions (seeded) | 7 |
| SpecificationSchema definitions (seeded) | 8 |
| FewShotExample definitions (seeded) | 3 |
| Constitution definitions (seeded) | 1 |
| Kernel enhancements | 2 (invariant parser, TLA+ models) |
| New suites | 3 |
| Updated suites | 1 (test v0.2.0→v0.3.0) |

**Library totals: 62 concepts, 1 derived concept, 18 kits, 11 provider concepts.**

---

## 17. What Is NOT In This Plan

- Full handler verification for all languages (only pure handlers, I/O uses @trusted)
- Full kernel implementation proof (TLA+ models, not implementation equivalence)
- Automatic property synthesis without human review (always requires approval)
- Liveness proofs at scale (bounded TLC only)
- Cross-language equivalence proofs (ContractTest, not formal)
- WidgetGen compiler verification (Conformance tests, not proof)
- TypeScript→Dafny benchmark (none published; estimated 40-60%)
