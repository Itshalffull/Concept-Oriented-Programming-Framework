# Clef Formal Verification Suite: Unified Synthesis & Implementation Plan

**Version:** 0.1.0
**Date:** 2026-03-03
**Status:** Implementation-Ready Specification
**Scope:** New formal verification suite, QualitySignal addition to test kit, syncs to existing kits, derived concepts, 4-language implementation plan

---

## 0. Files Read & Coverage

| File | Size | Status | Role |
|---|---|---|---|
| clef-reference.md | 47,976 | **FULLY READ** | Architecture: 54 concepts, 15 kits, concept test, coordination+provider |
| derived-concepts-proposal-v3.md | 21,193 | **FULLY READ** | .derived format, derivedContext, hierarchical composition |
| concept-library.md | 83,813 | **FULLY READ** | 54 concepts, Intent (semantic layer), Schema as coordination hub |
| clef-llm-kits-specification-v2.md | 127,753 | **FULLY READ** | 24 LLM concepts, 7 suites (core, conversation, prompt, agent, embedding, safety, training) |
| test-layer.md | 59,270 | **FULLY READ** | 5 test concepts: Snapshot, Conformance, ContractTest, TestSelection, FlakyTest |
| procrss-repetorie-implementation-plan.md | 96,844 | **FULLY READ** | 20 process concepts, 6 suites (foundation, human, automation, reliability, observability, llm) |
| testing-score-qualitysignal-formal-verification-design.md | 19,060 | **FULLY READ** | QualitySignal concept, Score bridge, publisher syncs, deploy gating |
| formal-verification-research (compass) | 23,784 | **FULLY READ** | 10 patterns, tool decomposition, compositional verification, 5 CLEF primitives |
| Formal_Verification_with_LLMs_and_CLEF.md | 51,618 | **FULLY READ** | Neuro-symbolic architecture, CEGIS/CEGAR, CLEF pipeline mapping, compositional Score integration |
| deep-research-report-formal-verification-with-large-language-models.md | 38,413 | **FULLY READ** | 11 proposed primitives, VC pipelines, failure modes, prioritized roadmap |

All 10 files were successfully read. No files were missed.

---

## 1. Source Comparison

### 1.1 Concept Proposals Across All Four Research Reports

| Concept Idea | QualitySignal Doc | Compass Report | FV+LLMs Report | Deep Research Report |
|---|---|---|---|---|
| FormalProperty / Specification | dimension="formal" | Property primitive | Intent.operationalPrinciples | Specification concept |
| Contract (assume-guarantee) | — | Contract primitive | Transition Contract → Intent | — |
| Evidence / ProofCertificate | artifact_path/hash | Evidence primitive | Counterexample capture | ProofCertificate + Counterexample |
| VerificationRun / Task | run_ref field | VerificationRun primitive | CEGIS loop iteration | VerificationTask + SolverCall |
| SolverProvider | PluginRegistry ref | SolverProvider primitive | PluginRegistry dispatch | SolverProvider (coordination) |
| SpecificationSchema / Patterns | — | Dwyer patterns mentioned | — | — |
| QualitySignal | **Full spec** | — | Score integration | VerificationMetrics |
| State Machine | — | **Reject** → Schema+Intent | Schema+TypeSystem mapping | — |
| Obligation | — | — | — | Obligation concept |
| Translation | — | — | — | Translation concept |
| RegressionSuite | — | — | — | RegressionSuite concept |
| VerificationArtifact | — | — | — | VerificationArtifact concept |
| Ghost State | — | Ghost primitive | — | — |
| Refinement Mapping | — | Refinement primitive | .derived+.sync mapping | — |
| Interaction Protocol | — | Protocol primitive | Sync coordination | — |
| LLMProver | — | AgentLoop reuse | AgentLoop+CEGIS | — |
| Verdict | — | — | — | — |

### 1.2 Points of Agreement

All four reports converge on these architectural insights:

1. **Untrusted generation, trusted checking.** LLMs are heuristic generators; only solver-verified results count. Every report independently arrives at this separation.

2. **Compositional verification via concept independence.** Clef's independent concepts with relational state map directly onto assume-guarantee reasoning. The frame rule from separation logic applies because concepts don't share state.

3. **QualitySignal as the bridge.** Formal verification results must flow through a normalized quality channel to reach Score and deploy gates. The QualitySignal doc provides the definitive design.

4. **Coordination+provider for solvers.** All reports agree SolverProvider should use the same pattern as ModelRouter, PluginRegistry, and other Clef coordination concepts.

5. **CEGIS loops via AgentLoop.** LLM-assisted verification reuses the existing AgentLoop concept with a verification-specific strategy provider.

### 1.3 Points of Divergence (Resolved Below)

| Divergence | Resolution |
|---|---|
| Deep Research proposes 11 fine-grained concepts | Collapse to 6 (see Section 2) |
| Compass proposes 5+Ghost+Refinement | Ghost → field, Refinement → sync |
| FV+LLMs maps everything to existing concepts | Too aggressive — FormalProperty and Evidence need independent state |
| QualitySignal doc proposes single "FormalVerification" concept | Too coarse — decompose into 6 concepts for independent evolution |

---

## 2. Concept Test Application & Collapse Justifications

Every proposed concept is evaluated against the three-test procedure from clef-reference.md:

**Test 1 — Concept Test:** Does it have independent state, meaningful actions with domain-specific variants, and operational principles that compose via syncs?

**Test 2 — Overlap Test:** Does it overlap with any of the existing 54 concepts across 15 kits?

**Test 3 — Sync Test:** Is it really just wiring logic between existing concepts?

### 2.1 Concepts RETAINED (Pass All Three Tests)

#### FormalProperty [P]
- **Independent state:** property text, target symbol, kind (invariant/precondition/postcondition/temporal/safety/liveness), formal language, scope, proof status, dependencies, priority. None of this state lives in any existing concept.
- **Meaningful actions:** define, prove, refute, check, synthesize, coverage — each with domain-specific variants.
- **Operational principle:** "After defining a property and checking it with a solver that returns unsat, proving the property transitions its status to proved and creates linked evidence."
- **Overlap test:** Intent stores informal operational principles as strings. FormalProperty stores machine-checkable formal logic with proof status tracking. Different state, different actions, complementary.
- **Sync test:** Not wiring — owns proof lifecycle independently.
- **Absorbs from other reports:** Specification (Report 4) is a collection query over FormalProperty. Obligation (Report 4) is FormalProperty with status="unproven". Safety/Liveness (Compass) are kind field values. Ghost State is a boolean flag on the property.

#### Contract [C]
- **Independent state:** name, source/target concepts, assumptions (property refs), guarantees (property refs), compatibility status, composition chain.
- **Meaningful actions:** define, verify, compose, discharge — each has clear domain semantics.
- **Operational principle:** "After defining a contract between two concepts and verifying it, the source's guarantees satisfy the target's assumptions, enabling compositional reasoning."
- **Overlap test:** No existing concept tracks assume-guarantee pairs.
- **Sync test:** Not wiring — contracts have identity and compatibility lifecycle.
- **Absorbs:** Transition Contract (FV+LLMs) when kind=pre/post, Interaction Protocol as contract chains over sync boundaries.

#### Evidence [E]
- **Independent state:** artifact type (proof_certificate/counterexample/model_trace/coverage_report/solver_log), content path, content hash, solver metadata (name, version, theories, resource usage), confidence score, property ref, timestamps.
- **Meaningful actions:** record, validate (integrity check), retrieve, compare, minimize (counterexample minimization).
- **Operational principle:** "After recording evidence with a content hash, validating it confirms integrity; for proof certificates, validation checks proof structure."
- **Overlap test:** Artifact (deploy kit) stores generic build artifacts. Evidence stores verification-specific artifacts with solver metadata, confidence scores, and property linkage. Different enough.
- **Sync test:** Not wiring — evidence has content-addressed lifecycle independent of what produced it.
- **Absorbs:** ProofCertificate (Report 4) = artifact_type="proof_certificate". Counterexample (Report 4) = artifact_type="counterexample". VerificationArtifact (Report 4) — Evidence is the verification-specific artifact store.

#### VerificationRun [V]
- **Independent state:** properties checked, solver used, timeout, status (running/completed/timeout/cancelled), start/end timestamps, per-property results with evidence refs, resource usage.
- **Meaningful actions:** start, complete, timeout, cancel, get_status.
- **Operational principle:** "After starting a run and completing it, the results list contains one entry per property with status and optional evidence ref."
- **Overlap test:** ProcessRun (process kit) tracks process execution. VerificationRun tracks solver-specific verification sessions with resource budgets. Different domain.
- **Sync test:** Not wiring — runs have temporal identity and resource tracking.
- **Absorbs:** VerificationTask (Report 4) = a run before it starts. SolverCall (Report 4) = the per-property entry in the results list.

#### SolverProvider [S] (Coordination Concept)
- **Uses coordination+provider pattern** from clef-reference.md, like ModelRouter in LLM kits.
- **Independent state:** registered providers, supported languages, supported kinds, capabilities, health status.
- **Meaningful actions:** register, dispatch, health_check.
- **Operational principle:** "After registering a provider and dispatching a property, the provider with matching language and kind capabilities is selected."
- **Overlap test:** PluginRegistry is generic infrastructure. SolverProvider adds verification-domain routing logic (language+kind matching).
- **Provider implementations:** Z3Provider, CVC5Provider, AlloyProvider, LeanProvider, DafnyProvider, CertoraProvider.

#### SpecificationSchema [SS]
- **Independent state:** name, category (dwyer_pattern/smart_contract/distributed_system/custom), pattern type, template text with parameters, examples.
- **Meaningful actions:** define, instantiate (creates FormalProperty), validate, list_by_category.
- **Operational principle:** "After defining a reentrancy_guard schema and instantiating it for a Token contract, a FormalProperty is created with the template filled in."
- **Overlap test:** Schema (foundation) defines data structure. SpecificationSchema defines reusable *verification property* templates. Different domain.
- **Sync test:** Not wiring — schemas have independent template lifecycle.

#### QualitySignal [Q] (Addition to Test Kit)
- **Independent state:** target symbol, dimension, status, severity, run ref, observed_at, evidence (summary, artifact_path, artifact_hash).
- **Meaningful actions:** record, latest, rollup, explain.
- **Operational principle:** "After recording signals for a target across multiple dimensions, rollup returns worst-of status and blocking=true if any gate dimension fails."
- **Overlap test:** Score aggregates concept-level metrics. QualitySignal is the normalized *input* channel — Score consumes it. Different roles.
- **Sync test:** Not wiring — QualitySignal stores quality events with evidence pointers.
- **Placement:** Test kit v0.2.0 (as specified in the QualitySignal design doc).

### 2.2 Concepts REMOVED (Fail Concept Test)

| Proposed Concept | Reason for Removal | Where Its Concern Lives |
|---|---|---|
| **State Machine** (Compass, FV+LLMs) | Overlaps Schema + Intent. Schema defines structure, Intent defines behavior. No new independent state. | Schema (foundation) + Intent (foundation) |
| **Obligation** (Report 4) | An obligation IS a FormalProperty with status="unproven". Adding a separate concept creates artificial coupling. | FormalProperty.status field |
| **Specification** (Report 4) | A specification is a query: `FormalProperty.list(target_symbol: X)`. No independent state beyond the collection. | Query over FormalProperty |
| **SolverCall** (Report 4) | Always subordinate to a VerificationRun. The results list on VerificationRun tracks per-property solver interactions. | VerificationRun.results list entries |
| **ProofCertificate** (Report 4) | Evidence with artifact_type="proof_certificate". Same state shape, same actions. | Evidence.artifact_type field |
| **Counterexample** (Report 4) | Evidence with artifact_type="counterexample". Source mapping and minimization are actions on Evidence. | Evidence.artifact_type + minimize action |
| **VerificationArtifact** (Report 4) | Generic storage duplicates Evidence (for verification artifacts) and Artifact (for source artifacts). | Evidence + Artifact (deploy kit) |
| **Translation** (Report 4) | Translation between formalisms is the SolverProvider's responsibility during dispatch. No independent lifecycle. | SolverProvider dispatch logic |
| **RegressionSuite** (Report 4) | Conformance (test kit) already handles regression testing. Formal verification regression = Conformance with dimension="formal". | Conformance + QualitySignal |
| **VerificationMetrics** (Report 4) | Score already handles metric aggregation. QualitySignal feeds Score. | Score via QualitySignal |
| **Refinement Mapping** (Compass) | Refinement is a relationship between two FormalProperty sets, tracked in sync state. No independent identity. | Sync between FormalProperty sets |
| **Ghost State** (Compass) | A boolean field on FormalProperty (ghost: Bool). Not enough independent state. | FormalProperty.ghost field |
| **Interaction Protocol** (Compass, FV+LLMs) | Session types are contract compositions verified through sync chains. | Contract.compose over sync boundaries |
| **Safety/Liveness categories** (Compass) | Property classification values, not independent concepts. | FormalProperty.kind field |
| **LLMProver** (Compass, FV+LLMs) | AgentLoop (LLM Agent Kit) with FormalVerificationStrategy provider. Reuses existing LLM orchestration. | AgentLoop + new strategy provider |
| **Verdict** (implicit in several) | QualitySignal already provides normalized verdict with rollup. | QualitySignal.rollup |

### 2.3 Concepts in Existing Kits Requiring Enhancement

| Concept | Kit | Change | Justification |
|---|---|---|---|
| **Score** | foundation | Add consumption of QualitySignal.rollup for quality-aware hierarchy rendering | Score currently lacks quality dimension. QualitySignal provides the stable interface. Minimal change: Score calls QualitySignal.rollup and renders green/red/yellow/gray. |
| **Builder** (all providers) | deploy | Add optional `testFilter` parameter on `test` action | TestSelection needs to pass filter criteria to builders. |
| **DeployPlan** | deploy | Add `gate` action consuming QualitySignal.rollup | Deployment gating based on quality signals across all dimensions. |

No existing concepts need to be **superseded** or **removed**. All changes are additive.

---

## 3. Final Suite Architecture

### 3.1 New Suite: `formal-verification`

```yaml
kit:
  name: formal-verification
  version: 0.1.0
  description: >
    Composable formal verification: properties, assume-guarantee contracts,
    proof evidence, verification runs, solver dispatch, and reusable
    specification templates. Publishes results to QualitySignal.

concepts:
  FormalProperty:
    spec: ./formal-property.concept
    params:
      P: { as: property-id, description: "Formal property identifier" }
  Contract:
    spec: ./contract.concept
    params:
      C: { as: contract-id, description: "Assume-guarantee contract identifier" }
  Evidence:
    spec: ./evidence.concept
    params:
      E: { as: evidence-id, description: "Verification evidence identifier" }
  VerificationRun:
    spec: ./verification-run.concept
    params:
      V: { as: run-id, description: "Verification run identifier" }
  SolverProvider:
    spec: ./solver-provider.concept
    params:
      S: { as: solver-id, description: "Registered solver provider identifier" }
  SpecificationSchema:
    spec: ./specification-schema.concept
    params:
      SS: { as: schema-id, description: "Specification template identifier" }

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
    concepts:
      - name: QualitySignal
  - kit: foundation
    concepts:
      - name: Intent
      - name: Schema
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
      - name: Validator
  - kit: deploy
    optional: true
    concepts:
      - name: Artifact
  - kit: llm-agent
    optional: true
    concepts:
      - name: AgentLoop
  - kit: llm-core
    optional: true
    concepts:
      - name: LLMProvider
```

### 3.2 New Suite: `formal-verification-solvers`

```yaml
kit:
  name: formal-verification-solvers
  version: 0.1.0
  description: >
    Solver provider implementations for the formal verification suite.
    Each provider registers with SolverProvider and handles translation
    to solver-specific input formats.

providers:
  Z3Provider:
    spec: ./z3-provider.provider
    optional: false
  CVC5Provider:
    spec: ./cvc5-provider.provider
    optional: true
  AlloyProvider:
    spec: ./alloy-provider.provider
    optional: false
  LeanProvider:
    spec: ./lean-provider.provider
    optional: true
  DafnyProvider:
    spec: ./dafny-provider.provider
    optional: true
  CertoraProvider:
    spec: ./certora-provider.provider
    optional: true

uses:
  - kit: formal-verification
    concepts:
      - name: SolverProvider
      - name: FormalProperty
      - name: Evidence
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
```

### 3.3 Updated Suite: `test` (v0.1.0 → v0.2.0)

Addition of QualitySignal concept. All existing concepts (Snapshot, Conformance, ContractTest, TestSelection, FlakyTest) unchanged.

```yaml
kit:
  name: test
  version: 0.2.0
  description: "Cross-layer testing coordination + normalized quality publishing to Score."

concepts:
  Snapshot:
    spec: ./snapshot.concept
  Conformance:
    spec: ./conformance.concept
  ContractTest:
    spec: ./contract-test.concept
  TestSelection:
    spec: ./test-selection.concept
  FlakyTest:
    spec: ./flaky-test.concept
  # NEW in v0.2.0
  QualitySignal:
    spec: ./quality-signal.concept
    params:
      Q: { as: quality-signal-ref, description: "Quality signal reference" }

syncs:
  required:
    # Existing syncs unchanged
    - ./syncs/compare-snapshot-after-emit.sync
    - ./syncs/block-build-on-snapshot-rejection.sync
    - ./syncs/conformance-monitors-spec-changes.sync
    - ./syncs/conformance-gates-deploy.sync
    - ./syncs/contract-gates-deploy.sync
    # NEW in v0.2.0 — QualitySignal publishers
    - ./syncs/snapshot-publishes-quality-signal.sync
    - ./syncs/conformance-publishes-quality-signal.sync
    - ./syncs/contract-publishes-quality-signal.sync
    - ./syncs/unit-tests-publish-quality-signal.sync
  recommended:
    - ./syncs/flaky-publishes-quality-signal.sync
    - ./syncs/selection-publishes-quality-signal.sync

uses:
  - kit: deploy
    optional: true
    concepts:
      - name: Builder
      - name: Artifact
      - name: DeployPlan
```

### 3.4 Derived Concept: VerifiedConcept

```
derived VerifiedConcept [T] {

  purpose {
    Compose formal verification with concept implementation,
    ensuring all operational principles are formally verified
    before deployment. A VerifiedConcept is a concept whose
    Intent principles have been formalized as FormalProperties,
    bound by assume-guarantee Contracts at sync boundaries,
    and proved with solver-checked Evidence.
  }

  composes {
    Schema [T]
    Intent [T]
    FormalProperty [T]
    Contract [T]
    Evidence [T]
    QualitySignal [T]
  }

  syncs {
    required: [
      property-from-intent-principles,
      verification-publishes-quality-signal,
      run-records-evidence
    ]
    recommended: [
      contract-from-sync-definitions,
      llm-synthesizes-property
    ]
  }

  surface {
    action verify(target: String) {
      entry: Intent/verify matches on targetId: ?target
      triggers: [
        FormalProperty/synthesize(target_symbol: ?target, intent_ref: ?intent),
        VerificationRun/start(properties: ?synthesized, solver: "auto", timeout_ms: 30000)
      ]
    }

    query verificationStatus(target: String) {
      reads: QualitySignal/latest(target_symbol: ?target, dimension: "formal")
    }

    query proofCoverage(target: String) {
      reads: FormalProperty/coverage(target_symbol: ?target)
    }

    query contracts(target: String) {
      reads: Contract/list(source_concept: ?target)
    }
  }

  principle {
    after verify(target: x)
    and  all FormalProperty for target x have status "proved"
    then verificationStatus(target: x) returns status: "pass"
    and  proofCoverage(target: x) returns coverage_pct: 100.0
  }
}
```

---

## 4. Complete Concept Specifications

### 4.1 FormalProperty

```clef
@version(1)
concept FormalProperty [P] {

  purpose {
    Atomic formal claim about system behavior. Tracks proof status
    and links to Evidence artifacts. Kinds include invariant,
    precondition, postcondition, temporal, safety, and liveness.
    Properties target Clef symbols (concepts, actions, syncs).
  }

  state {
    properties: set P

    target_symbol: P -> String
    kind: P -> String
    property_text: P -> String
    formal_language: P -> String
    scope: P -> String
    status: P -> String
    ghost: P -> Bool
    dependencies: P -> list String

    metadata {
      created_at: P -> DateTime
      updated_at: P -> DateTime
      author: P -> option String
      priority: P -> String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {

    action define(
      target_symbol: String,
      kind: String,
      property_text: String,
      formal_language: String,
      scope: String,
      priority: String
    ) {
      -> ok(property: P) {
        Creates new formal property in "unproven" status.
        kind: invariant | precondition | postcondition | temporal | safety | liveness
        formal_language: smtlib | tlaplus | alloy | lean | dafny | cvl
        scope: local | global | sync
        priority: required | recommended | optional
      }
      -> invalid(message: String) {
        Invalid kind, language, or malformed property text.
      }
    }

    action prove(property: P, evidence_ref: String) {
      -> ok(property: P, evidence: String) {
        Transitions from unproven to "proved". Links Evidence artifact.
      }
      -> notfound(property: P) {
        Property does not exist.
      }
    }

    action refute(property: P, evidence_ref: String) {
      -> ok(property: P, counterexample: String) {
        Transitions to "refuted". Links Evidence counterexample artifact.
      }
      -> notfound(property: P) {
        Property does not exist.
      }
    }

    action check(property: P, solver: String, timeout_ms: Int) {
      -> ok(property: P, status: String) {
        Dispatches to SolverProvider. Returns updated status.
      }
      -> timeout(property: P, elapsed_ms: Int) {
        Solver exceeded timeout. Status becomes "timeout".
      }
      -> unknown(property: P, reason: String) {
        Solver returned unknown. Status becomes "unknown".
      }
    }

    action synthesize(target_symbol: String, intent_ref: String) {
      -> ok(properties: list P) {
        Generates formal properties from Intent.operationalPrinciples.
        Uses pattern matching against SpecificationSchema library,
        or LLM generation via sync to AgentLoop.
      }
      -> invalid(message: String) {
        Intent not found or has no principles.
      }
    }

    action coverage(target_symbol: String) {
      -> ok(total: Int, proved: Int, refuted: Int, unknown: Int,
            timeout: Int, coverage_pct: Float) {
        Proof coverage statistics for target.
      }
    }

    action list(target_symbol: option String, kind: option String,
                status: option String) {
      -> ok(properties: list P) {
        Filtered listing. All params optional.
      }
    }

    action invalidate(property: P) {
      -> ok(property: P) {
        Resets proved/refuted property to "unproven" when source changes.
        Triggered by Score change detection via sync.
      }
      -> notfound(property: P) {
        Property does not exist.
      }
    }
  }

  invariant {
    after define(target_symbol: "clef/concept/Password", kind: "invariant",
                 property_text: "forall p: Password | len(p.hash) > 0",
                 formal_language: "smtlib", scope: "local",
                 priority: "required")
      -> ok(property: p)
    then check(property: p, solver: "z3", timeout_ms: 5000)
      -> ok(property: p, status: "proved")
    and  coverage(target_symbol: "clef/concept/Password")
      -> ok(total: 1, proved: 1, refuted: 0, unknown: 0,
            timeout: 0, coverage_pct: 100.0)
  }
}
```

### 4.2 Contract

```clef
@version(1)
concept Contract [C] {

  purpose {
    Assume-guarantee pair for compositional verification. Binds
    assumptions about environment concepts with guarantees of the
    subject concept. Enables modular reasoning: verify each concept
    against its contract independently, then compose via assumption
    discharge.
  }

  state {
    contracts: set C

    name: C -> String
    source_concept: C -> String
    target_concept: C -> String
    assumptions: C -> list String
    guarantees: C -> list String
    compatibility_status: C -> String
    composition_chain: C -> list String
  }

  capabilities {
    requires persistent-storage
  }

  actions {

    action define(
      name: String,
      source_concept: String,
      target_concept: String,
      assumptions: list String,
      guarantees: list String
    ) {
      -> ok(contract: C) {
        Creates contract. Validates all property refs exist in FormalProperty.
        compatibility_status starts as "unchecked".
      }
      -> invalid(message: String) {
        Property refs not found or concepts invalid.
      }
    }

    action verify(contract: C) {
      -> ok(contract: C, compatible: Bool) {
        Checks source guarantees satisfy target assumptions.
        Updates compatibility_status to "compatible" or "incompatible".
      }
      -> incompatible(contract: C, violations: list String) {
        Specific assumptions not satisfied.
      }
    }

    action compose(contracts: list C) {
      -> ok(composed: C, transitive_guarantees: list String) {
        Composes chain via assumption discharge.
        A's guarantees discharge B's assumptions; B's guarantees
        discharge C's assumptions. Returns transitive guarantee set.
      }
      -> incompatible(message: String) {
        Chain has incompatible link.
      }
    }

    action discharge(
      contract: C,
      assumption_ref: String,
      evidence_ref: String
    ) {
      -> ok(contract: C, remaining: list String) {
        Marks assumption as discharged. Updates compatibility
        if all assumptions discharged.
      }
      -> notfound(message: String) {
        Contract or assumption not found.
      }
    }

    action list(source_concept: option String, target_concept: option String) {
      -> ok(contracts: list C) {
        Filtered listing.
      }
    }
  }

  invariant {
    after define(name: "user-password-contract",
                 source_concept: "clef/concept/User",
                 target_concept: "clef/concept/Password",
                 assumptions: ["user-exists-before-password"],
                 guarantees: ["password-hash-nonzero"])
      -> ok(contract: c)
    then verify(contract: c) -> ok(contract: c, compatible: true)
  }
}
```

### 4.3 Evidence

```clef
@version(1)
concept Evidence [E] {

  purpose {
    Proof artifacts and verification results. Content-addressed
    for integrity. Stores proof certificates, counterexamples,
    model traces, coverage reports, and solver logs. Supports
    counterexample minimization.
  }

  state {
    evidence: set E

    artifact_type: E -> String
    content_path: E -> String
    content_hash: E -> String
    solver_metadata: E -> {
      solver_name: String,
      solver_version: String,
      theories_used: list String,
      resource_usage: {
        time_ms: Int,
        memory_mb: Int,
        solver_calls: Int
      }
    }
    confidence_score: E -> option Float
    property_ref: E -> String
    created_at: E -> DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {

    action record(
      artifact_type: String,
      content: Bytes,
      solver_metadata: Bytes,
      property_ref: String,
      confidence_score: option Float
    ) {
      -> ok(evidence: E, content_hash: String) {
        Stores evidence. Computes SHA-256 content hash.
        artifact_type: proof_certificate | counterexample |
          model_trace | coverage_report | solver_log
      }
      -> invalid(message: String) {
        Invalid artifact type or malformed content.
      }
    }

    action validate(evidence: E) {
      -> ok(evidence: E, valid: Bool) {
        Recomputes content hash and compares. For proof_certificate
        type, optionally re-checks proof structure with solver.
      }
      -> corrupted(evidence: E, message: String) {
        Hash mismatch or invalid proof structure.
      }
    }

    action retrieve(evidence: E) {
      -> ok(evidence: E, content: Bytes, metadata: Bytes) {
        Returns evidence content and solver metadata.
      }
      -> notfound(evidence: E) {
        Evidence does not exist.
      }
    }

    action compare(evidence1: E, evidence2: E) {
      -> ok(identical: Bool, diff: option String) {
        Compares two evidence artifacts.
      }
    }

    action minimize(evidence: E) {
      -> ok(minimized: E, reduction_pct: Float) {
        For counterexamples: reduces trace to minimal
        reproducing sequence. For model traces: strips
        irrelevant variable assignments.
      }
      -> not_applicable(evidence: E) {
        Artifact type does not support minimization.
      }
    }

    action list(property_ref: option String, artifact_type: option String) {
      -> ok(evidence: list E) {
        Filtered listing.
      }
    }
  }

  invariant {
    after record(artifact_type: "proof_certificate", content: c,
                 solver_metadata: m, property_ref: "prop-1",
                 confidence_score: 1.0)
      -> ok(evidence: e, content_hash: h)
    then validate(evidence: e) -> ok(evidence: e, valid: true)
  }
}
```

### 4.4 VerificationRun

```clef
@version(1)
@gate
concept VerificationRun [V] {

  purpose {
    Verification session lifecycle. Tracks which properties are
    checked, solver used, timeout budget, per-property results
    with evidence refs, and aggregate resource usage.
    Supports incremental verification and run comparison.
  }

  state {
    runs: set V

    target_symbol: V -> String
    properties_checked: V -> list String
    solver_used: V -> String
    timeout_ms: V -> Int
    status: V -> String
    started_at: V -> DateTime
    ended_at: V -> option DateTime

    results: V -> list {
      property_ref: String,
      status: String,
      evidence_ref: option String,
      duration_ms: Int
    }

    resource_usage: V -> {
      total_time_ms: Int,
      peak_memory_mb: Int,
      solver_calls: Int
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {

    action start(
      target_symbol: String,
      properties: list String,
      solver: String,
      timeout_ms: Int
    ) {
      -> ok(run: V) {
        Creates run in "running" status.
        solver: specific provider id or "auto" for SolverProvider dispatch.
      }
      -> invalid(message: String) {
        Invalid solver or properties not found.
      }
    }

    action complete(run: V, results: Bytes, resource_usage: Bytes) {
      -> ok(run: V, proved: Int, refuted: Int, unknown: Int) {
        Transitions to "completed". Records results and resources.
      }
      -> notfound(run: V) {
        Run does not exist.
      }
    }

    action timeout(run: V, partial_results: Bytes) {
      -> ok(run: V, completed_count: Int, remaining_count: Int) {
        Transitions to "timeout". Records partial results.
      }
    }

    action cancel(run: V) {
      -> ok(run: V) {
        Transitions to "cancelled".
      }
    }

    action get_status(run: V) {
      -> ok(run: V, status: String, progress: Float) {
        Current status and completion percentage.
      }
    }

    action compare(run1: V, run2: V) {
      -> ok(regressions: list String, improvements: list String,
            unchanged: list String) {
        Compares two runs on the same target. Identifies properties
        that changed status between runs.
      }
    }
  }

  invariant {
    after start(target_symbol: "clef/concept/Password",
                properties: ["p1", "p2"], solver: "z3",
                timeout_ms: 10000)
      -> ok(run: r)
    then complete(run: r, results: res, resource_usage: usage)
      -> ok(run: r, proved: 2, refuted: 0, unknown: 0)
  }
}
```

### 4.5 SolverProvider (Coordination)

```clef
@version(1)
concept SolverProvider [S] {

  purpose {
    Coordination concept dispatching verification requests to
    registered solver backends. Routes based on formal language,
    property kind, and solver capabilities. Follows the same
    coordination+provider pattern as ModelRouter in LLM kits.
  }

  state {
    providers: set S

    provider_id: S -> String
    supported_languages: S -> list String
    supported_kinds: S -> list String
    capabilities: S -> set String
    status: S -> String
    priority: S -> Int
  }

  capabilities {
    requires persistent-storage
  }

  actions {

    action register(
      provider_id: String,
      supported_languages: list String,
      supported_kinds: list String,
      capabilities: set String,
      priority: Int
    ) {
      -> ok(provider: S) {
        Registers solver. Also registers with PluginRegistry under
        category "solver". priority: lower = preferred when multiple
        providers match.
      }
      -> duplicate(provider_id: String) {
        Provider already registered.
      }
    }

    action dispatch(
      property_ref: String,
      formal_language: String,
      kind: String,
      timeout_ms: Int
    ) {
      -> ok(provider: S, run_ref: String) {
        Selects provider with matching language+kind and lowest priority
        number. Creates VerificationRun. Returns provider and run ref.
      }
      -> no_provider(formal_language: String, kind: String) {
        No registered provider supports this combination.
      }
    }

    action dispatch_batch(
      properties: list String,
      timeout_ms: Int
    ) {
      -> ok(assignments: list {property_ref: String, provider: S}) {
        Groups properties by language+kind and dispatches to optimal
        providers. Creates a single VerificationRun with all properties.
      }
      -> partial(assigned: list String, unassigned: list String) {
        Some properties have no matching provider.
      }
    }

    action health_check(provider: S) {
      -> ok(provider: S, status: String, latency_ms: Int) {
        Checks provider availability and response time.
      }
      -> unavailable(provider: S, message: String) {
        Provider not responding.
      }
    }

    action list() {
      -> ok(providers: list S) {
        All registered providers with capabilities.
      }
    }

    action unregister(provider_id: String) {
      -> ok() {
        Removes provider from registry.
      }
      -> notfound(provider_id: String) {
        Provider not registered.
      }
    }
  }

  invariant {
    after register(provider_id: "z3", supported_languages: ["smtlib"],
                   supported_kinds: ["invariant", "precondition", "postcondition", "safety"],
                   capabilities: ["smt", "quantifiers", "theories"],
                   priority: 1)
      -> ok(provider: p)
    then dispatch(property_ref: "prop-1", formal_language: "smtlib",
                  kind: "invariant", timeout_ms: 5000)
      -> ok(provider: p, run_ref: _)
  }
}
```

### 4.6 SpecificationSchema

```clef
@version(1)
concept SpecificationSchema [SS] {

  purpose {
    Reusable formal property templates following Dwyer specification
    patterns and domain-specific schemas. Enables property instantiation
    from parameterized templates, reducing the expertise barrier for
    writing formal specifications.
  }

  state {
    schemas: set SS

    name: SS -> String
    category: SS -> String
    pattern_type: SS -> String
    template_text: SS -> String
    formal_language: SS -> String
    parameters: SS -> list {
      name: String,
      type: String,
      description: String,
      default_value: option String
    }
    examples: SS -> list {
      parameter_values: Bytes,
      instantiated_text: String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {

    action define(
      name: String,
      category: String,
      pattern_type: String,
      template_text: String,
      formal_language: String,
      parameters: Bytes
    ) {
      -> ok(schema: SS) {
        Creates reusable template.
        category: dwyer_pattern | smart_contract | distributed_system |
          data_integrity | access_control | custom
        pattern_type: absence | existence | universality | response |
          precedence | bounded_existence | chain_response
      }
      -> invalid(message: String) {
        Invalid category or malformed template.
      }
    }

    action instantiate(
      schema: SS,
      parameter_values: Bytes,
      target_symbol: String
    ) {
      -> ok(property_ref: String) {
        Fills template with values. Creates FormalProperty via sync.
      }
      -> invalid(message: String) {
        Parameter mismatch or type error.
      }
    }

    action validate(schema: SS, parameter_values: Bytes) {
      -> ok(valid: Bool, instantiated_preview: String) {
        Validates parameters and returns preview without creating property.
      }
      -> invalid(message: String) {
        Type mismatch or missing required parameter.
      }
    }

    action list_by_category(category: String) {
      -> ok(schemas: list SS) {
        All schemas in category.
      }
    }

    action search(query: String) {
      -> ok(schemas: list SS) {
        Text search over name, template_text, parameter descriptions.
      }
    }
  }

  invariant {
    after define(name: "reentrancy-guard", category: "smart_contract",
                 pattern_type: "absence",
                 template_text: "always (call_depth(${function}) <= 1)",
                 formal_language: "smtlib",
                 parameters: [{name: "function", type: "String",
                               description: "Function to guard"}])
      -> ok(schema: s)
    then instantiate(schema: s,
                     parameter_values: {function: "transfer"},
                     target_symbol: "clef/concept/Token")
      -> ok(property_ref: _)
  }
}
```

### 4.7 QualitySignal (Addition to Test Kit)

```clef
@version(1)
concept QualitySignal [Q] {

  purpose {
    Normalize quality outcomes from testing, formal verification,
    and other quality producers into a single stream consumable
    by Score rollups and deploy gates. Coordination-only: does
    not run tests or proofs, only stores normalized outcomes.
  }

  state {
    signals: set Q

    target_symbol: Q -> String
    dimension: Q -> String
    status: Q -> String
    severity: Q -> String

    run_ref: Q -> option String
    observed_at: Q -> DateTime

    evidence {
      summary: Q -> option String
      artifact_path: Q -> option String
      artifact_hash: Q -> option String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {

    action record(
      target_symbol: String,
      dimension: String,
      status: String,
      severity: String,
      summary: option String,
      artifact_path: option String,
      artifact_hash: option String,
      run_ref: option String
    ) {
      -> ok(signal: Q) {
        Records quality event.
        dimension: snapshot | conformance | contract | unit |
          flaky | selection | formal
        status: pass | fail | warn | unknown | skipped
        severity: gate | warn | info
      }
      -> invalid(message: String) {
        Invalid dimension, status, or severity value.
      }
    }

    action latest(target_symbol: String, dimension: String) {
      -> ok(signal: Q, status: String, severity: String,
            summary: option String, observed_at: DateTime) {
        Most recent signal for target+dimension.
      }
      -> notfound(target_symbol: String, dimension: String) {
        No signal recorded.
      }
    }

    action rollup(
      target_symbols: list String,
      dimensions: option list String
    ) {
      -> ok(results: list {
        target: String,
        status: String,
        blocking: Bool
      }) {
        Worst-of rollup per target.
        blocking=true iff any gate-severity signal has fail or unknown.
        Status ordering: fail > unknown > warn > pass > skipped.
      }
    }

    action explain(
      target_symbol: String,
      dimensions: option list String
    ) {
      -> ok(contributors: list {
        dimension: String,
        status: String,
        severity: String,
        observed_at: DateTime,
        summary: option String,
        artifact_path: option String,
        artifact_hash: option String,
        run_ref: option String
      }) {
        Leaf signals for drilldown UI.
      }
    }
  }

  invariant {
    after record(target_symbol: "clef/concept/Password",
                 dimension: "formal", status: "pass",
                 severity: "gate", summary: "Proved 3 properties",
                 artifact_path: null, artifact_hash: null,
                 run_ref: "run-1")
      -> ok(signal: q)
    then latest(target_symbol: "clef/concept/Password",
                dimension: "formal")
      -> ok(signal: q, status: "pass", severity: "gate",
            summary: "Proved 3 properties", observed_at: _)
  }
}
```

---

## 5. Complete Sync Specifications

### 5.1 Required Syncs

#### verification-publishes-quality-signal.sync

```clef
sync VerificationPublishesQualitySignal [eager]
  purpose {
    Publish formal verification results as normalized quality signals.
    Three variants: proved, refuted, unknown.
  }

when {
  VerificationRun/complete: [run: ?r; target_symbol: ?target]
    => ok(run: ?r, proved: ?proved, refuted: ?refuted, unknown: ?unknown)
}
where {
  VerificationRun: {?r results: ?results}
}
then {
  for_each(?result in ?results) {
    QualitySignal/record: [
      target_symbol: ?target;
      dimension: "formal";
      status: case(?result.status,
                "proved" => "pass",
                "refuted" => "fail",
                "unknown" => "unknown",
                "timeout" => "unknown");
      severity: "gate";
      summary: concat(?result.status, " property ", ?result.property_ref);
      artifact_path: ?result.evidence_ref;
      artifact_hash: null;
      run_ref: toString(?r)
    ]
  }
}
```

#### property-from-intent-principles.sync

```clef
sync PropertyFromIntentPrinciples [eager]
  purpose {
    When Intent defines or updates operational principles for a target,
    attempt to formalize them as FormalProperties.
  }

when {
  Intent/define: [targetId: ?target; principles: ?principles]
    => ok(intent: ?i)
}
then {
  FormalProperty/synthesize: [
    target_symbol: concat("clef/concept/", ?target);
    intent_ref: toString(?i)
  ]
}
```

#### solver-dispatch.sync

```clef
sync SolverDispatch [eager]
  purpose {
    When FormalProperty/check is called, route to SolverProvider
    for automatic provider selection.
  }

when {
  FormalProperty/check: [property: ?p; solver: "auto"; timeout_ms: ?t]
}
where {
  FormalProperty: {?p formal_language: ?lang; kind: ?kind}
}
then {
  SolverProvider/dispatch: [
    property_ref: toString(?p);
    formal_language: ?lang;
    kind: ?kind;
    timeout_ms: ?t
  ]
}
```

#### evidence-to-artifact.sync

```clef
sync EvidenceToArtifact [eager]
  purpose {
    Persist Evidence content as immutable Artifacts in the deploy kit
    for long-term storage and CI caching.
  }

when {
  Evidence/record: [artifact_type: ?type; content: ?content;
                    property_ref: ?prop]
    => ok(evidence: ?e, content_hash: ?hash)
}
then {
  Artifact/store: [
    name: concat("evidence/", ?type, "/", ?hash);
    content: ?content;
    content_hash: ?hash;
    metadata: {
      evidence_ref: toString(?e),
      property_ref: ?prop,
      artifact_type: ?type
    }
  ]
}
```

#### run-records-evidence.sync

```clef
sync RunRecordsEvidence [eager]
  purpose {
    After a solver returns a result during a VerificationRun,
    record the output as Evidence and update the property status.
  }

when {
  SolverProvider/dispatch: [property_ref: ?prop]
    => ok(provider: ?s, run_ref: ?run)
}
# Note: The actual evidence recording happens inside the solver
# provider implementation. This sync connects the dispatch result
# back to Evidence/record and FormalProperty/prove or /refute.
# Implementation: solver providers call Evidence/record directly
# and return the evidence_ref, which VerificationRun stores in results.
```

### 5.2 Recommended Syncs

#### contract-from-sync-definitions.sync

```clef
sync ContractFromSyncDefinitions [lazy]
  purpose {
    When processing .sync files at compile time, generate Contract
    skeletons for each sync that connects two concepts. The sync's
    when-clause concepts become assumption sources; then-clause
    concepts become guarantee targets.
  }

when {
  # Triggered by kernel sync compilation
  SyncCompiler/compile: [sync_path: ?path; source_concepts: ?sources;
                         target_concepts: ?targets]
    => ok()
}
then {
  Contract/define: [
    name: concat("auto/", ?path);
    source_concept: first(?sources);
    target_concept: first(?targets);
    assumptions: [];
    guarantees: []
  ]
}
```

#### llm-synthesizes-property.sync

```clef
sync LLMSynthesizesProperty [lazy]
  purpose {
    Use AgentLoop with FormalVerificationStrategy to generate
    formal properties from natural language operational principles.
  }

when {
  FormalProperty/synthesize: [target_symbol: ?target; intent_ref: ?intent]
    => ok(properties: ?props)
}
where {
  # Only trigger LLM synthesis when pattern matching produces
  # fewer properties than Intent has principles
  Intent: {?intent operationalPrinciples: ?principles}
  filter(count(?props) < count(?principles))
}
then {
  AgentLoop/execute: [
    task: concat("Formalize remaining principles for ", ?target);
    strategy: "formal-verification";
    context: {
      target: ?target,
      existing_properties: ?props,
      principles: ?principles
    }
  ]
}
```

#### cegis-refinement-loop.sync

```clef
sync CEGISRefinementLoop [eager]
  purpose {
    Counter-Example Guided Inductive Synthesis: when a property
    is refuted, feed the counterexample back to the LLM to
    generate a refined property. Bounded by 4/delta iterations.
  }

when {
  FormalProperty/refute: [property: ?p; evidence_ref: ?e]
    => ok(property: ?p, counterexample: ?ce)
}
where {
  FormalProperty: {?p metadata: ?m}
  filter(get(?m, "cegis_iteration", 0) < get(?m, "cegis_max", 5))
}
then {
  AgentLoop/execute: [
    task: "Refine formal property given counterexample";
    strategy: "formal-verification";
    context: {
      property: ?p,
      counterexample: ?ce,
      iteration: increment(get(?m, "cegis_iteration", 0))
    }
  ]
}
```

#### property-coverage-to-score.sync

```clef
sync PropertyCoverageToScore [lazy]
  purpose {
    Publish proof coverage percentage as a QualitySignal so Score
    can render coverage alongside pass/fail status.
  }

when {
  FormalProperty/coverage: [target_symbol: ?target]
    => ok(total: ?total, proved: ?proved, coverage_pct: ?pct)
}
where {
  filter(?total > 0)
}
then {
  QualitySignal/record: [
    target_symbol: ?target;
    dimension: "formal";
    status: if(greaterOrEqual(?pct, 80.0), "pass",
            if(greaterOrEqual(?pct, 50.0), "warn", "fail"));
    severity: "info";
    summary: concat("Proof coverage: ", toString(?pct), "% (",
                    toString(?proved), "/", toString(?total), ")");
    artifact_path: null;
    artifact_hash: null;
    run_ref: null
  ]
}
```

#### conformance-triggers-reverification.sync

```clef
sync ConformanceTriggersReverification [lazy]
  purpose {
    When Conformance detects a spec change, invalidate affected
    formal properties so they are re-verified.
  }

when {
  Conformance/monitor: [concept: ?concept]
    => specChanged(concept: ?concept, changes: ?changes)
}
then {
  FormalProperty/list: [
    target_symbol: concat("clef/concept/", ?concept);
    status: "proved"
  ]
  # For each proved property, invalidate it
  # Implementation note: the sync engine iterates the list result
  # and calls invalidate on each
}
```

### 5.3 QualitySignal Publisher Syncs (Test Kit v0.2.0)

These syncs are specified in the QualitySignal design doc and live in the test kit:

```
syncs/
  snapshot-publishes-quality-signal.sync       # Snapshot compare → QualitySignal
  conformance-publishes-quality-signal.sync    # Conformance verify → QualitySignal
  contract-publishes-quality-signal.sync       # ContractTest verify → QualitySignal
  unit-tests-publish-quality-signal.sync       # Builder test → QualitySignal
  flaky-publishes-quality-signal.sync          # FlakyTest detection → QualitySignal (recommended)
  selection-publishes-quality-signal.sync       # TestSelection confidence → QualitySignal (recommended)
```

Implementation: each sync translates the native concept's result shape into a QualitySignal/record call with appropriate dimension, status, and severity. See Section 6 of the QualitySignal design doc for full sync bodies (already specified there; not duplicated here).

---

## 6. Solver Provider Specifications

Each provider implements the same interface and registers with SolverProvider. The provider pattern matches ModelRouter → LLMProvider in the LLM kits.

### 6.1 Provider Interface

```typescript
interface SolverProviderPlugin {
  // Registration metadata
  id: string;
  supportedLanguages: string[];
  supportedKinds: string[];
  capabilities: Set<string>;

  // Core verification
  verify(property: {
    text: string;
    language: string;
    kind: string;
  }, timeout_ms: number): Promise<{
    status: "proved" | "refuted" | "unknown" | "timeout";
    evidence?: {
      type: "proof_certificate" | "counterexample" | "solver_log";
      content: Uint8Array;
    };
    resource_usage: {
      time_ms: number;
      memory_mb: number;
      solver_calls: number;
    };
  }>;

  // Health
  healthCheck(): Promise<{ available: boolean; latency_ms: number }>;
}
```

### 6.2 Provider Implementations

#### Z3Provider (Priority 1)

```
provider Z3Provider implements SolverProviderPlugin {
  id: "z3"
  supportedLanguages: ["smtlib"]
  supportedKinds: ["invariant", "precondition", "postcondition", "safety"]
  capabilities: {"smt", "quantifiers", "theories", "optimization"}

  Implementation:
    - Translates property_text to SMT-LIB v2 format
    - Invokes z3 CLI with: z3 -smt2 -in -T:{timeout_s}
    - Parses output: "unsat" → proved, "sat" → refuted (with model),
      "unknown"/"timeout" → unknown/timeout
    - Extracts model (counterexample) or unsat core (proof certificate)
    - Records resource usage from z3 statistics output

  TypeScript: child_process.spawn('z3', [...])
  Rust: std::process::Command::new("z3") or z3-sys crate for FFI
  Swift: Process() with launchPath
  Solidity: N/A (verification target, not host)
}
```

#### AlloyProvider (Priority 1)

```
provider AlloyProvider implements SolverProviderPlugin {
  id: "alloy"
  supportedLanguages: ["alloy"]
  supportedKinds: ["invariant", "safety", "temporal"]
  capabilities: {"bounded_model_checking", "temporal", "relations"}

  Implementation:
    - Wraps Alloy 6 CLI (alloy-cli or Java API)
    - Translates property_text to Alloy sig/pred/assert format
    - Runs bounded check with configurable scope
    - "No counterexample found" → proved (within bound)
    - "Counterexample found" → refuted (with instance)
    - Extracts Alloy instance as counterexample

  TypeScript: java -jar alloy.jar CLI invocation
  Rust: std::process::Command for Java invocation
  Swift: Process() for Java invocation
  Solidity: N/A
}
```

#### CVC5Provider (Priority 2)

```
provider CVC5Provider implements SolverProviderPlugin {
  id: "cvc5"
  supportedLanguages: ["smtlib"]
  supportedKinds: ["invariant", "precondition", "postcondition"]
  capabilities: {"smt", "strings", "sequences", "datatypes"}

  Implementation:
    - Similar to Z3 but invokes cvc5 CLI
    - Stronger for string/sequence theories
    - Same SMT-LIB input format
}
```

#### LeanProvider (Priority 2)

```
provider LeanProvider implements SolverProviderPlugin {
  id: "lean"
  supportedLanguages: ["lean"]
  supportedKinds: ["invariant", "temporal", "liveness"]
  capabilities: {"interactive_theorem_proving", "dependent_types", "tactics"}

  Implementation:
    - Invokes lean CLI or lake build
    - Property expressed as Lean theorem statement
    - LLM generates tactic proof (via CEGIS sync)
    - Lean kernel type-checks proof term
    - Success → proved, Type error → needs repair, Timeout → unknown
    - Proof term is the certificate

  Note: Most useful with llm-synthesizes-property sync for
  tactic generation. Manual proofs also supported.
}
```

#### DafnyProvider (Priority 3)

```
provider DafnyProvider implements SolverProviderPlugin {
  id: "dafny"
  supportedLanguages: ["dafny"]
  supportedKinds: ["precondition", "postcondition", "invariant"]
  capabilities: {"deductive_verification", "loop_invariants", "termination"}

  Implementation:
    - Invokes dafny verify CLI
    - Three-layer pipeline: Dafny → Boogie → Z3
    - Method-level verification with contracts
    - Each method verified independently (scalability key)
    - Annotation repair loop via CEGIS sync
}
```

#### CertoraProvider (Priority 3)

```
provider CertoraProvider implements SolverProviderPlugin {
  id: "certora"
  supportedLanguages: ["cvl"]
  supportedKinds: ["invariant", "safety"]
  capabilities: {"smart_contract_verification", "evm_semantics"}

  Implementation:
    - Invokes certoraRun CLI
    - CVL (Certora Verification Language) specs
    - Targets Solidity/EVM bytecode
    - Returns verification report with counterexamples
}
```

---

## 7. LLM Integration: FormalVerificationStrategy

A new AgentLoop strategy provider that implements the CEGIS loop:

```clef
provider FormalVerificationStrategy implements AgentLoopStrategy {

  purpose {
    LLM-assisted formal verification via CEGIS:
    1. Parse Intent.operationalPrinciples
    2. LLMProvider.generate() synthesizes formal property text
    3. Match against SpecificationSchema for known patterns
    4. SolverProvider.dispatch() checks property
    5. If counterexample: LLMProvider.generate() refines
    6. Iterate until proved or max_iterations reached
    7. Record Evidence for each attempt
  }

  config {
    max_iterations: Int = 5        // 4/delta convergence bound
    initial_model: String = "claude-sonnet-4-5-20250929"
    retry_model: String = "claude-sonnet-4-5-20250929"
    temperature: Float = 0.3
    solver_timeout_ms: Int = 10000
  }

  actions {
    action execute(task: String, context: Bytes) {
      -> ok(result: Bytes) {
        Returns list of FormalProperty refs created and their statuses.
      }
      -> timeout(iterations: Int) {
        Max iterations reached. Returns partial results.
      }
      -> error(message: String) {
        LLM or solver infrastructure failure.
      }
    }
  }

  Registration:
    AgentLoop strategy registry under name "formal-verification"
    Requires: LLMProvider, SolverProvider, FormalProperty, Evidence,
              SpecificationSchema (optional)
}
```

---

## 8. Changes to Existing Concepts

### 8.1 Score (Foundation Kit)

**Change type:** Minor enhancement (non-breaking)

Add quality-aware rendering by consuming QualitySignal:

```
# New query on Score (or new sync connecting Score to QualitySignal)
# Score calls QualitySignal.rollup(target_symbols, dimensions)
# and integrates the result into its concept dependency graph rendering:
#
# - Green node: rollup status=pass, blocking=false
# - Red node: rollup status=fail or blocking=true
# - Yellow node: rollup status=unknown, blocking=true
# - Gray node: no signals
#
# Implementation: Score adds an optional dependency on QualitySignal.
# When present, Score.evaluate() calls QualitySignal.rollup() for
# each node in the dependency graph and annotates the result.
```

### 8.2 Builder (Deploy Kit)

**Change type:** Additive (non-breaking)

```
# Add optional testFilter parameter to Builder/test action:
action test(concept: String, language: String,
            testFilter: option list String) {
  # testFilter: list of test IDs to run (from TestSelection).
  # When null, runs all tests (current behavior).
}
```

### 8.3 DeployPlan (Deploy Kit)

**Change type:** Additive (non-breaking)

```
# Add gate action consuming QualitySignal:
action gate(environment: String, dimensions: list String) {
  -> ok(passed: Bool, blocking_signals: list String) {
    Calls QualitySignal.rollup for all targets in the deploy scope.
    Returns whether the gate passes and which signals are blocking.
  }
  -> degraded(warnings: list String) {
    Gate passes but with warnings.
  }
}
```

---

## 9. Implementation Plan

### Phase 1: QualitySignal (Week 1)

**Goal:** Quality bridge in place so all subsequent work has a publication target.

**Deliverables:**
1. QualitySignal concept spec (Section 4.7 above)
2. Test kit suite.yaml update to v0.2.0
3. TypeScript implementation of QualitySignal
4. 6 publisher syncs (snapshot, conformance, contract, unit, flaky, selection)
5. CLI: `clef quality latest`, `clef quality rollup`, `clef quality explain`

**Acceptance:** `clef quality rollup clef/concept/Password` returns aggregated status.

### Phase 2: FormalProperty + Evidence (Week 2)

**Goal:** Core formal verification state management.

**Deliverables:**
1. FormalProperty concept spec (Section 4.1)
2. Evidence concept spec (Section 4.3)
3. TypeScript implementations
4. property-from-intent-principles.sync
5. evidence-to-artifact.sync
6. Unit tests: define → check → prove → coverage lifecycle

**Acceptance:** Can define a property, check it (mock solver), record evidence, query coverage.

### Phase 3: Contract + VerificationRun (Week 3)

**Goal:** Compositional reasoning and session tracking.

**Deliverables:**
1. Contract concept spec (Section 4.2)
2. VerificationRun concept spec (Section 4.4)
3. TypeScript implementations
4. verification-publishes-quality-signal.sync
5. run-records-evidence.sync
6. Unit tests: define contract → verify → compose chain

**Acceptance:** Can define contracts between concepts, verify compatibility, run verification sessions that publish to QualitySignal.

### Phase 4: SolverProvider + SpecificationSchema (Week 4)

**Goal:** Solver coordination and property templates.

**Deliverables:**
1. SolverProvider concept spec (Section 4.5)
2. SpecificationSchema concept spec (Section 4.6)
3. TypeScript implementations
4. solver-dispatch.sync
5. Suite manifest: formal-verification/suite.yaml
6. Built-in Dwyer pattern schemas (absence, existence, response, precedence, universality)

**Acceptance:** `clef verify clef/concept/Password` dispatches to registered solver and publishes result.

### Phase 5: Solver Providers — Z3 + Alloy (Week 5)

**Goal:** Real solver backends.

**Deliverables:**
1. Z3Provider (TypeScript + Rust)
2. AlloyProvider (TypeScript)
3. formal-verification-solvers/suite.yaml
4. Integration tests with actual Z3/Alloy binaries
5. Counterexample extraction and evidence recording

**Acceptance:** Properties verified by actual Z3 and Alloy with real proof artifacts.

### Phase 6: LLM Integration (Week 6)

**Goal:** CEGIS loop and LLM-assisted property synthesis.

**Deliverables:**
1. FormalVerificationStrategy provider (Section 7)
2. llm-synthesizes-property.sync
3. cegis-refinement-loop.sync
4. Integration with AgentLoop + LLMProvider
5. Convergence tests (max 5 iterations)

**Acceptance:** Natural language operational principle → formal property → solver check → counterexample → LLM refinement → proved.

### Phase 7: Derived Concept + Score Integration (Week 7)

**Goal:** VerifiedConcept derived concept and Score quality rendering.

**Deliverables:**
1. VerifiedConcept.derived (Section 3.4)
2. property-coverage-to-score.sync
3. conformance-triggers-reverification.sync
4. Score enhancement for QualitySignal consumption
5. DeployPlan gate action

**Acceptance:** `clef verify --derived ProjectManagement` verifies all constituent concepts and rolls up to Score.

### Phase 8: Additional Solver Providers (Week 8)

**Deliverables:**
1. CVC5Provider (TypeScript)
2. LeanProvider (TypeScript)
3. DafnyProvider (TypeScript)
4. CertoraProvider (TypeScript)

### Phase 9: Rust Implementation (Week 9)

**Deliverables (all 6 core concepts + SolverProvider):**
1. `formal_property.rs` — Full concept with all actions
2. `contract.rs` — Full concept with composition
3. `evidence.rs` — Content-addressed storage with SHA-256
4. `verification_run.rs` — Session lifecycle
5. `solver_provider.rs` — Coordination with PluginRegistry
6. `specification_schema.rs` — Template engine
7. Z3Provider via `z3-sys` crate (FFI to libz3)
8. `quality_signal.rs` — QualitySignal for test kit
9. Conformance tests against TypeScript implementation

### Phase 10: Swift Implementation (Week 10)

**Deliverables (all 6 core concepts + SolverProvider):**
1. `FormalProperty.swift` — Full concept
2. `Contract.swift` — Full concept
3. `Evidence.swift` — CryptoKit for SHA-256
4. `VerificationRun.swift` — Session lifecycle
5. `SolverProvider.swift` — Coordination
6. `SpecificationSchema.swift` — Template engine
7. Z3Provider via C interop (`z3.h` bridging header)
8. `QualitySignal.swift`
9. Conformance tests against TypeScript implementation

### Phase 11: Solidity Implementation (Week 11)

**Deliverables (limited scope — Solidity is a verification target, not host):**
1. `Evidence.sol` — On-chain proof verification and certificate storage
2. `FormalProperty.sol` — On-chain property registry (read-only; properties defined off-chain)
3. CertoraProvider integration for Solidity contract verification
4. Foundry test harness

**Why limited:** Solidity contracts are what we verify, not where we run verification. Only Evidence (for on-chain proof anchoring) and FormalProperty (for on-chain property registry) make sense on-chain.

---

## 10. Directory Structure

```
kits/
  formal-verification/
    suite.yaml
    formal-property.concept
    contract.concept
    evidence.concept
    verification-run.concept
    solver-provider.concept
    specification-schema.concept
    syncs/
      verification-publishes-quality-signal.sync
      property-from-intent-principles.sync
      solver-dispatch.sync
      evidence-to-artifact.sync
      run-records-evidence.sync
      contract-from-sync-definitions.sync
      llm-synthesizes-property.sync
      cegis-refinement-loop.sync
      property-coverage-to-score.sync
      conformance-triggers-reverification.sync
    derived/
      verified-concept.derived
    schemas/
      dwyer-absence.schema.yaml
      dwyer-existence.schema.yaml
      dwyer-response.schema.yaml
      dwyer-precedence.schema.yaml
      dwyer-universality.schema.yaml
      smart-contract-reentrancy.schema.yaml
      smart-contract-overflow.schema.yaml
      data-integrity-nonzero.schema.yaml

  formal-verification-solvers/
    suite.yaml
    providers/
      z3-provider.provider
      cvc5-provider.provider
      alloy-provider.provider
      lean-provider.provider
      dafny-provider.provider
      certora-provider.provider

  test/
    suite.yaml                          # Updated to v0.2.0
    quality-signal.concept              # NEW
    syncs/
      snapshot-publishes-quality-signal.sync      # NEW
      conformance-publishes-quality-signal.sync   # NEW
      contract-publishes-quality-signal.sync      # NEW
      unit-tests-publish-quality-signal.sync      # NEW
      flaky-publishes-quality-signal.sync         # NEW
      selection-publishes-quality-signal.sync      # NEW
      # ... existing syncs unchanged

implementations/
  typescript/
    formal-verification/
      formal-property.impl.ts
      contract.impl.ts
      evidence.impl.ts
      verification-run.impl.ts
      solver-provider.impl.ts
      specification-schema.impl.ts
    formal-verification-solvers/
      z3-provider.impl.ts
      cvc5-provider.impl.ts
      alloy-provider.impl.ts
      lean-provider.impl.ts
      dafny-provider.impl.ts
      certora-provider.impl.ts
    test/
      quality-signal.impl.ts
    llm-agent/
      formal-verification-strategy.impl.ts

  rust/
    formal-verification/
      formal_property.rs
      contract.rs
      evidence.rs
      verification_run.rs
      solver_provider.rs
      specification_schema.rs
    formal-verification-solvers/
      z3_provider.rs
    test/
      quality_signal.rs

  swift/
    formal-verification/
      FormalProperty.swift
      Contract.swift
      Evidence.swift
      VerificationRun.swift
      SolverProvider.swift
      SpecificationSchema.swift
    formal-verification-solvers/
      Z3Provider.swift
    test/
      QualitySignal.swift

  solidity/
    formal-verification/
      Evidence.sol
      FormalProperty.sol
```

---

## 11. Concept Count Impact

| Category | Count |
|---|---|
| **New concepts** (formal-verification suite) | 6 |
| **New concept** (QualitySignal in test suite) | 1 |
| **New solver providers** | 6 |
| **New strategy provider** (FormalVerificationStrategy) | 1 |
| **New derived concept** (VerifiedConcept) | 1 |
| **New syncs** (formal-verification) | 10 |
| **New syncs** (QualitySignal publishers) | 6 |
| **Existing concepts enhanced** | 3 (Score, Builder, DeployPlan) |
| **Existing concepts superseded/removed** | 0 |
| **Total new syncs** | 16 |

**Updated library totals:**
- Concepts: 54 + 7 = **61 concepts**
- Derived concepts: 0 + 1 = **1 derived concept**
- Kits: 15 + 2 = **17 kits** (test kit updated, not new)
- Solver providers: 6 new
- Strategy providers: 1 new

---

## 12. Concept Library Version

Per the versioning instruction (semver, bump minor per completed phase):

```
COPF concept library: v0.5.0
61 concepts and 1 derived concept across 17 kits
v0.5 adds QualitySignal (test kit), formal verification suite
(FormalProperty, Contract, Evidence, VerificationRun, SolverProvider,
SpecificationSchema), VerifiedConcept derived concept, and
FormalVerificationStrategy for LLM-assisted proving.
```

---

## 13. Open Questions

1. **Canonical target IDs:** Standardize `clef/concept/X`, `clef/action/X/Y`, `clef/sync/X`, `clef/derived/X` in suite manifests? Current usage is ad-hoc.

2. **Evidence retention:** Append-only (all proofs retained for audit) vs. latest-only (save space)? Recommend append-only with configurable TTL.

3. **Incremental re-verification:** When source changes, which properties must be re-verified? Recommend: invalidate all properties for the changed target, use TestSelection to prioritize by cost and failure probability.

4. **Solver timeout defaults:** Per-kind defaults? Recommend: invariant=5s, precondition/postcondition=3s, temporal=10s, safety=10s, liveness=30s. Configurable per suite.

5. **LLM confidence threshold:** When should auto-synthesized properties be accepted without human review? Recommend: always require solver verification (confidence from LLM is irrelevant when solver provides ground truth).

6. **History retention for QualitySignal:** Append-only vs dedupe by `(target, dimension, run_ref)`? Recommend: append-only with `latest()` query returning most recent.
