# Testing → Score integration via normalized quality signals  
**Clef Design Doc v0.1.0**  
**Date:** 2026-03-02  
**Status:** Proposed  
**Scope:** Testing suite + Score bridge + minimal integration surface for Formal Verification suite

---

## 0. Executive summary

We make **Score** “quality-aware” by connecting it to the **Testing suite** (cross-layer coordination) through a single normalized contract:

- **New concept in Testing suite:** `QualitySignal`
- **New Score Query Contract:** `latest`, `rollup`, `explain` on `QualitySignal`
- **Publisher syncs:** Snapshot / Conformance / ContractTest / Builder unit tests / Flaky / Selection publish into `QualitySignal`
- **Result:** Score can roll up quality at **any derived concept level** with no bespoke integrations per test type.
- **Formal Verification suite:** only needs to publish its outcomes into `QualitySignal` under `dimension="formal"`. Everything else is internal to Formal Verification.

This preserves the Clef rules:
- concepts are independent; cross-cutting integration happens through syncs and `suite.yaml uses`
- builders/runner providers continue to execute tests; suites coordinate and publish outcomes

---

## 1. Motivation

Clef already has:

1) A **Testing suite** coordinating cross-layer concerns (Snapshot, Conformance, ContractTest, TestSelection, FlakyTest).  
2) A **Score** concept (or suite) that evaluates “what matters” at different levels (especially derived concepts / feature trees).  
3) A multi-layer system where testing is inherently cross-cutting: generator output (Snapshot), built artifacts (Conformance), cross-target interop (ContractTest), change-aware selection (TestSelection), and reliability management (FlakyTest).

What’s missing is the final stitch: Score needs a stable, minimal interface for “what’s the quality status of X?”, without binding to the internal structures of Snapshot/Conformance/etc.

### Key idea

**Testing suite → publishes normalized quality events → Score consumes those events and rolls them up.**

Then formal verification becomes “just another publisher” into that same normalized channel.

---

## 2. Terms and definitions

### 2.1 Target

A **Target** is the thing quality applies to. Targets are identified by stable strings (symbol-like IDs), e.g.:

- `clef/derived/<FeatureName>` (preferred for Score rollups)
- `clef/concept/<ConceptName>`
- `clef/action/<ConceptName>/<ActionName>`
- `clef/sync/<SyncName>`
- `clef/file/<path>` (optional for file-level signals)
- `clef/generated/<path>` (useful for Snapshot)

Targets should be resolvable through existing semantic/symbol systems if present.

### 2.2 Dimension

A **Dimension** is the type of quality check. Initial canonical set:

- `snapshot` — generator output stability
- `conformance` — spec fidelity
- `contract` — cross-target interoperability
- `unit` — language-native tests (builder executed)
- `flaky` — reliability policy / quarantine state
- `selection` — whether selection confidence constraints are met
- `formal` — formal verification results (properties/proofs/model-checks)

Dimensions are intentionally small and stable; new ones can be added without changing Score.

### 2.3 Status

`pass | fail | warn | unknown | skipped`

- `pass`: check is satisfied
- `fail`: check violated
- `warn`: non-blocking issue
- `unknown`: not proven / timeout / solver unknown / not run when required
- `skipped`: intentionally not run (policy or config)

### 2.4 Severity

`gate | warn | info`

- `gate`: failures and unknowns block “green” status and can block deploy if wired as a gate
- `warn`: visible but not blocking
- `info`: informational only

---

## 3. Score Query Contract

Score should depend only on `QualitySignal` actions (below), not on testing suite internals.

### Contract methods

1) `QualitySignal/latest(target_symbol, dimension)`  
Returns most recent signal for that target+dimension.

2) `QualitySignal/rollup(target_symbols, dimensions?)`  
Returns rollup verdict per target, with a “blocking” boolean.

3) `QualitySignal/explain(target_symbol, dimensions?)`  
Returns the leaf signals contributing to the rollup (for drilldown).

### Rollup semantics (deterministic, shared)

For a given target:

- Filter signals to the requested `dimensions` if provided; otherwise all.
- Determine **worst-of** status ordering:
  1. `fail`
  2. `unknown`
  3. `warn`
  4. `pass`
  5. `skipped`
- `blocking=true` iff any contributing signal with `severity="gate"` has status in `{fail, unknown}`.

This is enough for Score UI:
- **Green**: rollup status `pass` and `blocking=false`
- **Red**: `fail` and/or `blocking=true`
- **Yellow**: `unknown` with `blocking=true` (or configurable)
- **Gray**: no signals exist for the node

---

## 4. New concept: `QualitySignal` (in Testing suite)

### 4.1 Design intent

`QualitySignal` is a *coordination-only* concept:

- It does not run tests or proofs.
- It stores normalized outcomes, evidence pointers, and run metadata.
- It is the single “publish bus” into Score.

### 4.2 Concept spec

```clef
@version(1)
concept QualitySignal [Q] {

  purpose {
    Normalize quality outcomes from cross-layer testing and verification
    into a single stream consumable by Score rollups.
  }

  state {
    signals: set Q

    target_symbol: Q -> String          // clef/derived/..., clef/concept/..., etc.
    dimension: Q -> String              // snapshot | conformance | contract | unit | flaky | selection | formal
    status: Q -> String                 // pass | fail | warn | unknown | skipped
    severity: Q -> String               // gate | warn | info

    run_ref: Q -> option String         // build/test run id/etc
    observed_at: Q -> DateTime

    evidence {
      summary: Q -> option String
      artifact_path: Q -> option String // junit xml, snapshot diff, proof cert, counterexample, etc.
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
        Records a new quality signal event for the given target.
      }
      -> invalid(message: String) {
        Invalid dimension/status/severity.
      }
    }

    action latest(target_symbol: String, dimension: String) {
      -> ok(signal: Q, status: String, severity: String,
            summary: option String, observed_at: DateTime) {
        Returns latest recorded signal for this target+dimension.
      }
      -> notfound(target_symbol: String, dimension: String) {
        No signal recorded.
      }
    }

    action rollup(target_symbols: list String, dimensions: option list String) {
      -> ok(results: list {
        target: String,
        status: String,        // worst-of
        blocking: Bool         // any gate fail/unknown
      }) {
        Computes rollup verdict per target using deterministic semantics.
      }
    }

    action explain(target_symbol: String, dimensions: option list String) {
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
        Returns contributing leaf signals for UI drilldown.
      }
    }
  }
}
```

---

## 5. Testing suite packaging (suites, not “kits”)

Clef currently uses `suite.yaml` manifests. Directory names may still use `kits/` in paths; treat that as an implementation detail. Going forward we’ll call them **suites**.

### 5.1 Updated `test/suite.yaml`

```yaml
kit:
  name: test
  version: 0.2.0
  description: "Cross-layer testing coordination + Score publishing."

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

  # NEW: Score bridge
  QualitySignal:
    spec: ./quality-signal.concept
    params:
      Q: { as: quality-signal-ref, description: "Quality signal ref" }

syncs:
  required:
    - snapshot-publishes-quality-signal.sync
    - conformance-publishes-quality-signal.sync
    - contract-publishes-quality-signal.sync
    - unit-tests-publish-quality-signal.sync

  recommended:
    - flaky-publishes-quality-signal.sync
    - selection-publishes-quality-signal.sync

uses:
  - kit: deploy
    optional: true
    concepts:
      - name: Builder
      - name: Artifact
```

**Why `Artifact`?** to store evidence as immutable, content-addressed artifacts:
- snapshot diffs/summaries
- junit xml files
- conformance/contract reports
- proof certificates / counterexamples (later)

---

## 6. Publisher sync inventory (Testing suite → QualitySignal)

These syncs translate each concept’s native result shape into a normalized `QualitySignal/record`.

### 6.1 Snapshot → QualitySignal

**Rule:** Snapshot `unchanged` → pass/gate; Snapshot `changed/new/rejected` → fail/gate (or warn per config).

```clef
sync SnapshotPublishesQualitySignal [eager]
when {
  Snapshot/compare: [ outputPath: ?p ] => unchanged(snapshot: _)
}
then {
  QualitySignal/record: [
    target_symbol: concat("clef/generated/", ?p);
    dimension: "snapshot";
    status: "pass";
    severity: "gate";
    summary: null;
    artifact_path: null;
    artifact_hash: null;
    run_ref: null
  ]
}

sync SnapshotChangePublishesQualitySignal [eager]
when {
  Snapshot/compare: [ outputPath: ?p ] => changed(diff: ?diff)
}
then {
  QualitySignal/record: [
    target_symbol: concat("clef/generated/", ?p);
    dimension: "snapshot";
    status: "fail";
    severity: "gate";
    summary: "Snapshot changed (approval required)";
    artifact_path: null;
    artifact_hash: null;
    run_ref: null
  ]
}
```

### 6.2 Conformance → QualitySignal

**Rule:** conformance is a gate. Failures block.

- `Conformance/verify => ok(passed=total)` → `pass/gate`
- `Conformance/verify => failure(...)` → `fail/gate`
- deviations may be emitted as an additional warn signal

```clef
sync ConformancePassPublishesQualitySignal [eager]
when {
  Conformance/verify: [ suite: ?s; language: ?lang; artifactLocation: ?loc ]
    => ok(passed: ?p; total: ?t)
}
where {
  equals(?p, ?t)
}
then {
  QualitySignal/record: [
    target_symbol: concat("clef/lang/", ?lang, "/artifact/", ?loc);
    dimension: "conformance";
    status: "pass";
    severity: "gate";
    summary: concat("Conformance: ", toString(?p), "/", toString(?t));
    artifact_path: null;
    artifact_hash: null;
    run_ref: null
  ]
}

sync ConformanceFailPublishesQualitySignal [eager]
when {
  Conformance/verify: [ ] => failure(failures: ?fs)
}
then {
  QualitySignal/record: [
    target_symbol: "clef/conformance";      # optionally per concept/language
    dimension: "conformance";
    status: "fail";
    severity: "gate";
    summary: "Conformance failures (see report)";
    artifact_path: ?fs.report_path;         # optional if produced
    artifact_hash: null;
    run_ref: null
  ]
}
```

### 6.3 ContractTest → QualitySignal

**Rule:** contract incompatibility is a gate (if enabled), and always visible.

```clef
sync ContractPassPublishesQualitySignal [eager]
when {
  ContractTest/verify: [ contract: ?c ] => ok(passed: ?p; total: ?t)
}
then {
  QualitySignal/record: [
    target_symbol: concat("clef/contract/", ContractTest: { ?c concept: ?name }, ?name);
    dimension: "contract";
    status: "pass";
    severity: "gate";
    summary: concat("Contract: ", toString(?p), "/", toString(?t));
    artifact_path: null;
    artifact_hash: null;
    run_ref: null
  ]
}

sync ContractFailPublishesQualitySignal [eager]
when {
  ContractTest/verify: [ contract: ?c ] => incompatible(failures: ?fails)
}
then {
  QualitySignal/record: [
    target_symbol: concat("clef/contract/", ContractTest: { ?c concept: ?name }, ?name);
    dimension: "contract";
    status: "fail";
    severity: "gate";
    summary: "Contract incompatibilities (see report)";
    artifact_path: ?fails.report_path;
    artifact_hash: null;
    run_ref: null
  ]
}
```

### 6.4 Builder unit tests → QualitySignal

Builders execute unit tests; the testing suite observes results and publishes `dimension="unit"`.

```clef
sync UnitTestsPublishQualitySignal [eager]
when {
  Builder/test: [ concept: ?concept; language: ?lang ]
    => ok(passed: ?p; failed: ?f; skipped: ?s; duration: ?d)
}
then {
  QualitySignal/record: [
    target_symbol: concat("clef/concept/", ?concept);
    dimension: "unit";
    status: if(equals(?f, 0), "pass", "fail");
    severity: "gate";
    summary: concat("Unit: passed=", toString(?p), " failed=", toString(?f), " skipped=", toString(?s));
    artifact_path: null;   # or junit xml path if available
    artifact_hash: null;
    run_ref: null
  ]
}
```

### 6.5 FlakyTest → QualitySignal (recommended)

Publish quarantines and policy states:

- quarantined test present → `flaky warn/warn`
- too many quarantined tests → `flaky fail/warn` (optional)

### 6.6 TestSelection → QualitySignal (recommended)

If selection confidence is enforced:

- confidence >= threshold → `selection pass/gate`
- confidence < threshold → `selection fail/gate`

---

## 7. How Score uses this

### 7.1 Ingestion

Score calls:

- `QualitySignal.rollup([targets...])` for aggregate nodes
- `QualitySignal.latest(target, dimension)` for per-dimension dashboards
- `QualitySignal.explain(target)` for drilldown

### 7.2 Hierarchical rollups

Score can compute derived feature status by:

1) Determine the set of leaf targets included in that derived node (or sub-tree).
2) Roll up by calling `QualitySignal.rollup`.
3) Render:
   - green: no gate fail/unknown
   - red: any gate fail
   - yellow: any gate unknown
   - gray: no signals

### 7.3 Drilldown UX

`QualitySignal.explain` returns:
- failing dimensions
- severity
- evidence pointers (artifact path/hash)
- run references

---

## 8. Formal Verification suite integration (minimal)

### 8.1 Core idea

Formal verification owns its internal state, but publishes outcomes into `QualitySignal`:

- `dimension="formal"`
- `severity` typically `gate` for required properties
- `artifact_path/hash` points to proof certificate or counterexample artifact

### 8.2 Suite manifest

```yaml
kit:
  name: formal-verification
  version: 0.1.0
  description: "Formal properties + obligations + evidence; publishes to QualitySignal."

concepts:
  FormalVerification:
    spec: ./formal-verification.concept

syncs:
  required:
    - verification-publishes-quality-signal.sync

uses:
  - kit: test
    concepts:
      - name: QualitySignal
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
  - kit: deploy
    optional: true
    concepts:
      - name: Artifact
```

### 8.3 Required sync: FV result → QualitySignal

```clef
sync VerificationPublishesQualitySignal [eager]
when {
  FormalVerification/recordResult: [ property_id: ?pid; target_symbol: ?t ]
    => proved(proof_artifact_path: ?path; proof_hash: ?h)
}
then {
  QualitySignal/record: [
    target_symbol: ?t;
    dimension: "formal";
    status: "pass";
    severity: "gate";
    summary: concat("Proved property ", ?pid);
    artifact_path: ?path;
    artifact_hash: ?h;
    run_ref: null
  ]
}

sync VerificationRefutedPublishesQualitySignal [eager]
when {
  FormalVerification/recordResult: [ property_id: ?pid; target_symbol: ?t ]
    => refuted(counterexample_path: ?path; counterexample_hash: ?h)
}
then {
  QualitySignal/record: [
    target_symbol: ?t;
    dimension: "formal";
    status: "fail";
    severity: "gate";
    summary: concat("Counterexample for property ", ?pid);
    artifact_path: ?path;
    artifact_hash: ?h;
    run_ref: null
  ]
}

sync VerificationUnknownPublishesQualitySignal [eager]
when {
  FormalVerification/recordResult: [ property_id: ?pid; target_symbol: ?t ]
    => unknown(reason: ?r)
}
then {
  QualitySignal/record: [
    target_symbol: ?t;
    dimension: "formal";
    status: "unknown";
    severity: "gate";
    summary: concat("Unknown: ", ?r);
    artifact_path: null;
    artifact_hash: null;
    run_ref: null
  ]
}
```

---

## 9. Deploy gating (optional but recommended)

Because the contract is uniform, deploy gating can be generic:

- Configure gate dimensions per environment, e.g.:
  - dev: `unit`, `snapshot` (warn), `conformance` (warn)
  - prod: `unit`, `conformance`, `contract`, `formal` (gate)

Implementation options:
- DeployPlan calls `QualitySignal.rollup` directly (preferred simplicity).
- Or a testing-suite sync emits DeployPlan gate nodes.

---

## 10. LLM/process/automation compatibility (optional)

This design is intentionally agnostic about *how* checks are produced. It supports:

- LLM-proposed invariants/properties
- automated solver/prover runs
- LLM-assisted lemma discovery / proof script generation
- counterexample minimization

All of these produce results that publish into the same `QualitySignal` contract.

---

## 11. Implementation plan

### Phase 1 — Testing suite bridge
- Implement `QualitySignal` concept
- Add required publisher syncs
- Add debug CLI helpers (`latest/rollup/explain`)

### Phase 2 — Score integration
- Score reads `rollup` + `explain` and renders quality alongside hierarchy

### Phase 3 — Formal verification MVP
- Implement FormalVerification internal model + provider dispatch
- Publish results into `QualitySignal` via required sync

### Phase 4 — Selection + policy sophistication
- Proof rerun selection using TestSelection
- Policy for unknown/timeouts
- Evidence storage standardization via Artifact

---

## 12. Configuration knobs

Recommended config surface (location flexible):

- gate dimensions per env
- snapshot auto-approval
- minimum selection confidence
- FV budgets/timeouts
- required property sets per derived feature

---

## 13. Open questions

1) Canonical target IDs: do we standardize `clef/derived/...` in suite manifests?  
2) Evidence paths: standard layout for diffs/reports/proofs?  
3) Handling deviations/partial conformance: warn vs pass-with-metadata?  
4) History retention: append-only signals vs dedupe by `(target, dimension, run_ref)`?

---

## Appendix — Suggested directory layout

```
suites/
  test/
    suite.yaml
    quality-signal.concept
    syncs/
      snapshot-publishes-quality-signal.sync
      conformance-publishes-quality-signal.sync
      contract-publishes-quality-signal.sync
      unit-tests-publish-quality-signal.sync
      flaky-publishes-quality-signal.sync
      selection-publishes-quality-signal.sync

  formal-verification/
    suite.yaml
    formal-verification.concept
    syncs/
      verification-publishes-quality-signal.sync
```
