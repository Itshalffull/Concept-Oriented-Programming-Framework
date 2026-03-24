# Clef Quality Kit — Unified Synthesis v1.0.0

**16 concepts · 4 suites · 5 derived concepts · 21 syncs**

Synthesized from: (1) "The State of Code Quality Analysis" research report, (2) "Advanced Paradigms in Code Quality Analysis" research report, (3) Clef Quality Kit v0 design, (4) "Code Quality Measurement: Concepts and Best Practices" survey, and the Clef Comprehensive Reference architecture.

---

## §1 Source Comparison and Design Rationale

### 1.1 What Each Source Contributes

**Source 1 (State of Code Quality)** provides the strongest empirical grounding: 12 orthogonal quality dimensions identified from industry tools, 7 composability patterns extracted from SonarQube/ESLint/Semgrep/NDepend/CodeScene/MegaLinter, and the critical finding that composition beats inheritance. Its key novel insights: behavioral and static quality are genuinely orthogonal (uncorrelated rankings); AI simultaneously degrades and improves quality (1.7× more issues in generated code, 82% bug detection in AI review); DORA 2025 abandoned universal tier classifications in favor of context-dependent evaluation.

**Source 2 (Advanced Paradigms)** contributes the LLM-era perspective: the insufficiency of Pass@k metrics, Data Transformation Graphs as a successor to Code Property Graphs for AI agent navigation, "Implementation Laziness" in LLM-generated architecture, and the vision of LLMs as both generators and evaluators. It proposes 7 Clef concepts but maps them too coarsely — its "StaticGovernance" conflates Rule, Finding, and Metric; its "BehavioralDynamics" conflates Hotspot and ChangeCoupling.

**Source 3 (Quality Kit v0)** provides the strongest concept design: 12 well-separated concepts across 4 suites, each passing the concept test with independent state, meaningful actions, and operational principles. Its 13 syncs correctly wire measurement→policy→analysis→review. Its derived concepts (CleanAsYouCode, RefactoringAdvisor, QualityDashboard) demonstrate meaningful composition. This is the foundation we build on.

**Source 4 (Concepts and Best Practices)** provides an earlier, more naive decomposition (CyclomaticComplexity, CodeDuplication, LintIssue, TestCoverage, SecurityScan, MaintainabilityIndex as separate concepts). The Quality Kit v0 correctly supersedes this — those are all instances of Metric definitions and Rule evaluations, not independent concepts.

### 1.2 Concepts Retained from Quality Kit v0

All 12 original concepts are retained. They pass the concept test, have clean separation, and the 4-suite organization is well-motivated by rate-of-change arguments:

| Suite | Changes When | Concepts |
|---|---|---|
| Quality Measurement | Data model evolves | Metric, Rule, Finding, Baseline |
| Quality Policy | Organizational standards shift | QualityProfile, QualityGate, TechnicalDebt |
| Quality Analysis | Analysis dimensions/algorithms improve | Hotspot, ChangeCoupling, KnowledgeMap, CodeHealth |
| Quality Review | Review process requirements shift | ReviewCoverage |

### 1.3 Concepts Added from Research Synthesis

Four new concepts are pulled from the research that were not in the Quality Kit v0. Each passes the concept test independently.

**ArchitecturalFitness** (Quality Analysis suite) — Source 1 documents fitness functions extensively (Ford/Parsons/Kua, ArchUnit, NetArchTest). Source 2 proposes this as a concept with dependency graphs and boundary verification. Independent state: registered architectural boundaries, dependency snapshots, fitness function definitions and results. This is not reducible to Rule — rules check local code properties; fitness functions check global structural invariants (no circular dependencies across layers, no domain→infrastructure imports). Uses the provider pattern: ArchUnit (Java), NetArchTest (.NET), custom dependency checkers, Clef concept-graph analyzers.

**SemanticEvaluator** (Quality Review suite) — Source 1 documents HuCoSC (Pearson 0.753 correlation with human experts), Microsoft CORE (59.2% fix rate), CoReEval benchmarks. Source 2 proposes this with embeddings and prompt personas. Independent state: evaluation specifications, prompt templates, assessment results with rationale, embeddings cache. Not reducible to Rule — rules check deterministic structural patterns; semantic evaluation assesses contextual meaning, intent alignment, and readability through probabilistic LLM inference. Uses the provider pattern: Claude, GPT-4, CodeBERT/CodeBERTScore, local models.

**EnergyProfile** (Quality Analysis suite) — Source 1 documents SCI (ISO/IEC 21031:2024), PowerJoular/JoularJX, PowerAPI, Kepler. ICT accounts for ~415 TWh/year in data center energy alone. Independent state: energy measurements per target (kWh/request, Joules/operation), SCI scores, carbon intensity factors, measurement profiles. Not reducible to Metric — Metric stores scalar values; EnergyProfile manages measurement profiles with carbon intensity factors, functional unit normalization (per-request, per-operation, per-user), and SCI formula computation requiring multiple correlated inputs (E×I+M)/R. Uses the provider pattern: PowerJoular (Java per-method), PowerAPI (Python software power meter), Kepler (Kubernetes), cloud billing APIs.

**SupplyChainQuality** (Quality Analysis suite) — Source 1 documents OpenSSF Scorecard (18+ checks, 1M+ repos/week), SBOM quality scoring (sbomqs), behavioral dependency analysis (Socket.dev), and GUAC graph aggregation. Independent state: dependency inventory, scorecard results per dependency, vulnerability assessments, SBOM completeness scores, behavioral analysis flags (install scripts, credential exfiltration). Not reducible to Rule — supply chain analysis operates on a different substrate (package metadata, VCS signals, build provenance) than source code. Uses the provider pattern: OpenSSF Scorecard, Snyk, Socket.dev, SBOM generators (syft, cdxgen), GUAC.

### 1.4 Concepts Collapsed or Rejected

**Source 2's StaticGovernance** → Collapsed into existing Metric + Rule + Finding. StaticGovernance conflates three independent concerns: storing measurements (Metric), defining checks (Rule), and tracking issues (Finding). The Quality Kit v0's decomposition is correct.

**Source 2's BehavioralDynamics** → Collapsed into existing Hotspot + ChangeCoupling. BehavioralDynamics conflates churn calculation (Hotspot's concern) with co-change detection (ChangeCoupling's concern). These are genuinely orthogonal — a file can be high-churn without co-changing with anything, and two files can co-change without either being a churn hotspot.

**Source 2's SocioTechnicalMapper** → Collapsed into existing KnowledgeMap. KnowledgeMap already tracks authorship distribution, bus factor, knowledge concentration, and team coverage. SocioTechnicalMapper adds nothing that KnowledgeMap doesn't handle.

**Source 2's DebtLedger** → Already TechnicalDebt. Identical concept under a different name.

**Source 2's ResourceProfiler** → Subsumed by EnergyProfile (expanded scope). ResourceProfiler tracks execution time and memory; EnergyProfile tracks energy, carbon, and resource utilization with SCI normalization. EnergyProfile is the modern, standards-aligned version.

**Source 4's per-metric concepts** (CyclomaticComplexity, CodeDuplication, LintIssue, TestCoverage, SecurityScan, MaintainabilityIndex) → All handled by Metric + Rule + Finding. These are metric definitions and rule evaluations, not independent concepts. A CyclomaticComplexity concept would have no actions beyond "compute" and no lifecycle — it's a metric definition registered with Metric/define and computed by a provider.

**Source 4's QualityAlert** → Not a concept. Quality alerting is a sync from QualityGate/evaluate→failed to the existing Notification concept (suites/notification/). No independent state.

### 1.5 Provider Pattern Summary

| Concept | Provider Role | Example Providers |
|---|---|---|
| Metric | Compute language-specific metric values | tree-sitter (complexity), ESLint (cognitive complexity), Halstead tokenizer, CK metric calculator |
| Rule | Perform actual code evaluation | ESLint wrapper, Semgrep runner, SAST scanner, custom analyzer |
| Hotspot | Parse VCS history for change frequency | git log parser, SVN parser, Mercurial parser |
| ChangeCoupling | Detect co-change patterns from VCS | git log parser (shared with Hotspot), issue tracker linker |
| KnowledgeMap | Extract authorship data from VCS | git blame parser, SVN annotate parser |
| ArchitecturalFitness | Check structural/dependency invariants | ArchUnit (Java), NetArchTest (.NET), Clef concept-graph analyzer, custom import checker |
| SemanticEvaluator | Perform LLM-based semantic assessment | Claude API, GPT-4 API, CodeBERT/CodeBERTScore, local model runner |
| EnergyProfile | Measure energy/carbon | PowerJoular (Java), PowerAPI (Python), Kepler (K8s), cloud billing API |
| SupplyChainQuality | Scan dependencies and supply chain | OpenSSF Scorecard, Snyk, Socket.dev, SBOM generator (syft, cdxgen) |

Concepts that do NOT use providers: Finding, Baseline, QualityProfile, QualityGate, TechnicalDebt, CodeHealth, ReviewCoverage. These are pure coordination/policy/aggregation concepts — they consume data produced by provider-backed concepts.

### 1.6 Suite Assignment Rationale

The 4 new concepts slot into existing suites:

- **ArchitecturalFitness → Quality Analysis** — It answers "what's wrong structurally?" alongside Hotspot ("where should we invest?") and ChangeCoupling ("what's secretly coupled?"). All are analysis dimensions that change when analytical capabilities improve.

- **EnergyProfile → Quality Analysis** — Energy efficiency is an analysis dimension orthogonal to structural complexity and behavioral risk. It changes when measurement tools/standards evolve, which is the same cadence as analysis algorithm improvement.

- **SupplyChainQuality → Quality Analysis** — Dependency quality is an analysis dimension. Although it operates on a different substrate (packages vs. source code), it changes at the same rate and for the same reasons as other analysis capabilities.

- **SemanticEvaluator → Quality Review** — Semantic evaluation augments the code review process. It changes when review process requirements shift (new LLM capabilities, new prompt strategies, new assessment benchmarks), matching the Review suite's rate of change.

---

## §2 Complete Concept Specifications

### Suite 1: Quality Measurement (`suites/quality-measurement/`)

#### 2.1 Metric

```
@version(1)
concept Metric [M] {

  purpose {
    Define and store atomic quality measurements for code entities.
    Each metric has a name, unit, direction (lower-is-better or
    higher-is-better), and computed values per target. Language-agnostic
    storage — providers compute, Metric records.
  }

  state {
    metrics: set M
    definition {
      name: M -> String
      description: M -> option String
      unit: M -> String
      direction: M -> String
      category: M -> String
      thresholds: M -> option {
        info: Float,
        warning: Float,
        critical: Float
      }
    }
    measurements {
      target: M -> String
      value: M -> Float
      computedAt: M -> DateTime
      computedBy: M -> option String
    }
  }

  actions {
    action define(name: String, unit: String, direction: String, category: String) {
      -> ok(metric: M) {
        Register a new metric definition. Direction is "lower"
        (lower-is-better, e.g. complexity) or "higher" (higher-is-better,
        e.g. coverage). Category groups metrics: "complexity", "coupling",
        "size", "coverage", "duplication", "cohesion", "energy",
        "performance", "security", "supply-chain".
      }
      -> duplicate(name: String) {
        A metric with this name already exists.
      }
    }

    action setThresholds(name: String, info: Float, warning: Float, critical: Float) {
      -> ok(metric: M) {
        Set severity thresholds for a metric. Interpretation depends
        on direction: for "lower" metrics, exceeding threshold is worse;
        for "higher" metrics, falling below threshold is worse.
      }
      -> unknownMetric(name: String) {
        No metric definition with this name.
      }
    }

    action record(name: String, target: String, value: Float, computedBy: option String) {
      -> ok(metric: M, previous: option Float) {
        Record a measurement. Returns the previous value for the same
        target if one exists. Overwrites current value; historical values
        are tracked by Baseline, not Metric.
      }
      -> unknownMetric(name: String) {
        No metric definition with this name.
      }
      -> outOfRange(value: Float, message: String) {
        Value is outside plausible bounds for this metric.
      }
    }

    action query(name: String, targets: option list String) {
      -> ok(results: list {
        target: String,
        value: Float,
        rating: option String,
        computedAt: DateTime
      }) {
        Query current metric values. Rating is "ok", "info",
        "warning", or "critical" based on thresholds. If targets
        is null, returns all.
      }
      -> unknownMetric(name: String) {
        No metric definition with this name.
      }
    }

    action summary(category: option String) {
      -> ok(metrics: list {
        name: String,
        category: String,
        targetCount: Int,
        mean: Float,
        median: Float,
        p90: Float,
        worstTarget: String,
        worstValue: Float
      }) {
        Aggregate statistics across all targets for each metric,
        optionally filtered by category.
      }
    }

    action compare(name: String, target: String, otherTarget: String) {
      -> ok(delta: Float, direction: String, improved: Bool) {
        Compare two targets on one metric. Returns the delta and
        whether the comparison represents improvement per the
        metric's direction.
      }
      -> missing(target: String) {
        One or both targets have no measurement.
      }
    }
  }

  invariant {
    after define(name: "cyclomatic_complexity", unit: "paths", direction: "lower", category: "complexity")
      -> ok(metric: m)
    and record(name: "cyclomatic_complexity", target: "auth/login.ts:handleLogin", value: 12.0)
      -> ok(metric: m, previous: _)
    then query(name: "cyclomatic_complexity", targets: ["auth/login.ts:handleLogin"])
      -> ok(results: [{ target: "auth/login.ts:handleLogin", value: 12.0 }])
  }
}
```

**Provider interface:** Metric providers register via PluginRegistry with capability `quality.metric.compute`. Each provider declares which metric categories it can compute and for which languages. On invocation, a provider receives a list of targets and returns `(target, metricName, value)` triples that are fed to `Metric/record`.

**Built-in metric definitions** (registered during Phase 1 initialization):

| Name | Unit | Direction | Category | Source |
|---|---|---|---|---|
| `cyclomatic_complexity` | paths | lower | complexity | McCabe 1976; threshold 10 |
| `cognitive_complexity` | points | lower | complexity | SonarSource; threshold 15 |
| `halstead_volume` | bits | lower | complexity | Halstead; V = N × log₂n |
| `halstead_difficulty` | ratio | lower | complexity | D = n₁/2 × N₂/n₂ |
| `lines_of_code` | lines | lower | size | Physical LOC |
| `logical_loc` | statements | lower | size | Logical LOC |
| `coupling_between_objects` | count | lower | coupling | CK suite; CBO |
| `lack_of_cohesion` | ratio | lower | cohesion | Henderson-Sellers LCOM* (0–1) |
| `weighted_methods` | sum | lower | coupling | CK suite; WMC |
| `depth_of_inheritance` | levels | lower | coupling | CK suite; DIT |
| `instability` | ratio | — | coupling | Martin; I = Ce/(Ca+Ce) |
| `abstractness` | ratio | — | coupling | Martin; A = abstract/total |
| `main_sequence_distance` | ratio | lower | coupling | Martin; \|A + I − 1\| |
| `duplication_rate` | percent | lower | duplication | % duplicated lines |
| `test_coverage` | percent | higher | coverage | Line or branch coverage |
| `mutation_score` | percent | higher | coverage | Mutation testing kill rate |
| `review_coverage` | percent | higher | coverage | % changes reviewed |
| `energy_per_request` | joules | lower | energy | SCI E component |
| `carbon_intensity` | gCO2eq | lower | energy | SCI score |
| `dependency_vulnerability_density` | count/kloc | lower | supply-chain | Vuln count per KLOC |
| `openssf_scorecard` | score | higher | supply-chain | OpenSSF 0-10 scale |

#### 2.2 Rule

```
@version(1)
concept Rule [R] {

  purpose {
    Define quality checks with evaluation criteria, severity,
    categorization, and remediation guidance. Rules are the atomic
    unit of quality policy — each expresses one quality expectation
    independently. Providers perform actual code evaluation.
  }

  state {
    rules: set R
    definition {
      ruleId: R -> String
      name: R -> String
      description: R -> String
      category: R -> String
      severity: R -> String
      effort: R -> option String
      tags: R -> list String
      enabled: R -> Bool
      cleanCodeAttribute: R -> option String
    }
    evaluation {
      lastEvaluated: R -> option DateTime
      targetsChecked: R -> option Int
      violationsFound: R -> option Int
    }
  }

  actions {
    action define(ruleId: String, name: String, description: String, category: String, severity: String, effort: option String, tags: option list String, cleanCodeAttribute: option String) {
      -> ok(rule: R) {
        Register a quality rule. Category aligns with quality
        dimensions: "complexity", "coupling", "duplication",
        "naming", "security", "performance", "reliability",
        "maintainability", "style", "documentation", "energy",
        "architecture", "supply-chain". Severity: "info", "minor",
        "major", "critical", "blocker". Effort is estimated fix
        time: "trivial", "easy", "medium", "hard".
        cleanCodeAttribute maps to SonarQube's Clean Code taxonomy:
        "consistent", "intentional", "adaptable", "responsible".
      }
      -> duplicate(ruleId: String) {
        Rule ID already registered.
      }
    }

    action evaluate(ruleId: String, targets: list String) {
      -> ok(rule: R, violations: list { target: String, location: String, message: String }, clean: list String) {
        Evaluate the rule against targets. Returns violations
        with precise locations and the set of clean targets.
        Updates evaluation stats. Actual analysis is performed
        by providers; this action records their results.
      }
      -> disabled(ruleId: String) {
        Rule is disabled. No evaluation performed.
      }
      -> unknownRule(ruleId: String) {
        No rule with this ID.
      }
    }

    action enable(ruleId: String) {
      -> ok(rule: R) { Enable a disabled rule. }
      -> alreadyEnabled(rule: R) { Rule was already enabled. }
    }

    action disable(ruleId: String) {
      -> ok(rule: R) {
        Disable a rule. Disabled rules are skipped during
        evaluation. Existing findings remain.
      }
      -> alreadyDisabled(rule: R) { Rule was already disabled. }
    }

    action list(category: option String, severity: option String, tags: option list String) {
      -> ok(rules: list {
        ruleId: String,
        name: String,
        category: String,
        severity: String,
        enabled: Bool,
        violationsFound: option Int
      }) {
        List rules with optional filtering.
      }
    }
  }

  invariant {
    after define(ruleId: "max-cognitive-complexity", name: "Maximum Cognitive Complexity", description: "Function cognitive complexity must not exceed threshold", category: "complexity", severity: "major", effort: "medium", tags: ["maintainability"], cleanCodeAttribute: "intentional")
      -> ok(rule: r)
    and disable(ruleId: "max-cognitive-complexity") -> ok(rule: r)
    then evaluate(ruleId: "max-cognitive-complexity", targets: ["any.ts"])
      -> disabled(ruleId: "max-cognitive-complexity")
  }
}
```

**Provider interface:** Rule providers register via PluginRegistry with capability `quality.rule.evaluate`. Each provider declares which rule categories it handles and which languages. The provider receives `(ruleId, targets)` and returns violation lists. Providers include ESLint wrappers (JavaScript/TypeScript), Semgrep runners (multi-language YAML rules), tree-sitter analyzers (universal AST), SAST scanners (security), and custom Clef concept-spec analyzers.

**Clean Code attribute mapping** (from SonarQube research):

| Attribute | Sub-qualities | Rule Examples |
|---|---|---|
| Consistent | Formatted, Conventional, Identifiable | naming conventions, formatting rules, import ordering |
| Intentional | Clear, Logical, Complete, Efficient | cognitive complexity, dead code, unreachable branches |
| Adaptable | Focused, Distinct, Modular, Tested | single responsibility, duplication, coupling, coverage |
| Responsible | Lawful, Trustworthy, Respectful | license compliance, no hardcoded secrets, inclusive naming |

#### 2.3 Finding

```
@version(1)
concept Finding [F] {

  purpose {
    Track quality issues through their lifecycle. Each finding
    records what rule was violated, where in the code, when it
    was detected, and its resolution status. Supports acknowledge,
    suppress, and resolve workflows.
  }

  state {
    findings: set F
    identity {
      ruleId: F -> String
      target: F -> String
      location: F -> String
      message: F -> String
      fingerprint: F -> String
    }
    lifecycle {
      status: F -> String
      detectedAt: F -> DateTime
      detectedIn: F -> option String
      acknowledgedBy: F -> option String
      acknowledgedAt: F -> option DateTime
      suppressedBy: F -> option String
      suppressedAt: F -> option DateTime
      suppressionReason: F -> option String
      resolvedAt: F -> option DateTime
      resolvedIn: F -> option String
    }
    classification {
      severity: F -> String
      category: F -> String
      effort: F -> option String
      tags: F -> list String
      source: F -> option String
    }
  }

  actions {
    action report(ruleId: String, target: String, location: String, message: String, severity: String, category: String, effort: option String, tags: option list String, source: option String) {
      -> new(finding: F) {
        New finding detected. Status set to "open".
        Fingerprint computed from ruleId + target + location
        for deduplication. Source indicates origin:
        "static", "behavioral", "semantic", "architectural",
        "supply-chain", "energy", "review".
      }
      -> existing(finding: F) {
        Finding with same fingerprint already exists and is
        still open. No duplicate created. Updates detectedAt.
      }
      -> recurrence(finding: F) {
        A previously resolved or suppressed finding has
        reappeared. Status reset to "open".
      }
    }

    action acknowledge(finding: F, by: String) {
      -> ok(finding: F) {
        Mark finding as acknowledged — someone has seen it and
        accepted responsibility. Status: "acknowledged".
      }
      -> notOpen(finding: F, status: String) {
        Finding is not in "open" status.
      }
    }

    action suppress(finding: F, by: String, reason: String) {
      -> ok(finding: F) {
        Suppress finding — intentional decision not to fix.
        Requires reason. Status: "suppressed". Suppressed
        findings don't count toward quality gate evaluation.
      }
      -> alreadySuppressed(finding: F) { Finding already suppressed. }
    }

    action resolve(finding: F, resolvedIn: option String) {
      -> ok(finding: F) {
        Mark finding as resolved. Typically triggered when
        re-evaluation no longer detects the violation.
        Status: "resolved".
      }
      -> alreadyResolved(finding: F) { Finding already resolved. }
    }

    action query(targets: option list String, ruleIds: option list String, severities: option list String, statuses: option list String, sources: option list String) {
      -> ok(findings: list {
        finding: F,
        ruleId: String,
        target: String,
        location: String,
        message: String,
        severity: String,
        status: String,
        source: option String,
        detectedAt: DateTime
      }) {
        Query findings with multi-dimensional filtering.
      }
    }

    action summary(groupBy: String) {
      -> ok(groups: list {
        key: String,
        total: Int,
        open: Int,
        acknowledged: Int,
        suppressed: Int,
        resolved: Int,
        meanAge: option Float
      }) {
        Aggregate finding counts grouped by "severity",
        "category", "target", "ruleId", "status", or "source".
      }
    }
  }

  invariant {
    after report(ruleId: "max-cognitive-complexity", target: "auth/login.ts", location: "15:1", message: "Complexity 23 exceeds 15", severity: "critical", category: "complexity")
      -> new(finding: f)
    and acknowledge(finding: f, by: "alice") -> ok(finding: f)
    and resolve(finding: f) -> ok(finding: f)
    then query(statuses: ["resolved"], ruleIds: ["max-cognitive-complexity"])
      -> ok(findings: [{ finding: f }])
  }
}
```

#### 2.4 Baseline

```
@version(1)
concept Baseline [B] {

  purpose {
    Capture quality snapshots at meaningful points in time.
    Enable measurement of quality evolution by comparing current
    state against a reference. Support branch, date, and version
    reference strategies for "clean as you code" workflows.
  }

  state {
    baselines: set B
    identity {
      name: B -> String
      strategy: B -> String
      reference: B -> String
      capturedAt: B -> DateTime
    }
    snapshot_metrics {
      metricSnapshots: B -> list {
        metricName: String,
        target: String,
        value: Float
      }
    }
    snapshot_findings {
      findingCounts: B -> {
        total: Int,
        bySeverity: list { severity: String, count: Int },
        byCategory: list { category: String, count: Int }
      }
    }
  }

  actions {
    action capture(name: String, strategy: String, reference: String) {
      -> ok(baseline: B, metricsCount: Int, findingsCount: Int) {
        Capture current quality state as a named baseline.
        Strategy: "branch" (reference is branch name), "date"
        (ISO date), "version" (semver tag), "manual" (explicit
        snapshot). Reads current Metric and Finding state via syncs.
      }
      -> duplicate(name: String) {
        Baseline with this name already exists.
      }
    }

    action compare(baseline: B) {
      -> ok(delta: {
        metricsImproved: Int,
        metricsDegraded: Int,
        metricsUnchanged: Int,
        findingsIntroduced: Int,
        findingsResolved: Int,
        netFindingDelta: Int,
        degradedMetrics: list { name: String, target: String, baselineValue: Float, currentValue: Float },
        newFindings: list { ruleId: String, target: String, severity: String }
      }) {
        Compare current quality state against the baseline.
      }
    }

    action advance(name: String) {
      -> ok(baseline: B, previous: DateTime) {
        Update an existing baseline to current state.
      }
      -> notFound(name: String) { No baseline with this name. }
    }

    action list() {
      -> ok(baselines: list {
        name: String,
        strategy: String,
        reference: String,
        capturedAt: DateTime,
        metricsCount: Int,
        findingsCount: Int
      }) {
        List all baselines.
      }
    }
  }

  invariant {
    after capture(name: "v2.1-release", strategy: "version", reference: "v2.1.0")
      -> ok(baseline: b, metricsCount: 120, findingsCount: 45)
    then compare(baseline: b)
      -> ok(delta: { netFindingDelta: _ })
  }
}
```

### Suite 2: Quality Policy (`suites/quality-policy/`)

#### 2.5 QualityProfile

```
@version(1)
concept QualityProfile [P] {

  purpose {
    Compose rules into named quality standards. Select which rules
    are active, override severity and parameters per-profile.
    Support inheritance for progressive quality adoption:
    "essential" → "standard" → "strict" → "comprehensive".
    Inspired by SonarQube quality profiles and Codacy's
    layerable coding standards with sensitivity sliders.
  }

  state {
    profiles: set P
    identity {
      name: P -> String
      description: P -> option String
      parent: P -> option P
      language: P -> option String
      isDefault: P -> Bool
    }
    rule_assignments {
      assignments: P -> list {
        ruleId: String,
        enabled: Bool,
        severityOverride: option String,
        parameters: option list { key: String, value: String }
      }
    }
  }

  actions {
    action create(name: String, description: option String, parent: option String, language: option String) {
      -> ok(profile: P) {
        Create a quality profile. If parent is specified, the
        profile inherits all its rule assignments and can
        override or extend them.
      }
      -> duplicate(name: String) { Profile name already exists. }
      -> parentNotFound(parent: String) { Parent profile not found. }
    }

    action addRule(profile: P, ruleId: String, severityOverride: option String, parameters: option list { key: String, value: String }) {
      -> ok(profile: P) {
        Add a rule to the profile, optionally overriding
        severity and setting parameters.
      }
      -> alreadyAssigned(profile: P, ruleId: String) {
        Rule already in this profile.
      }
    }

    action removeRule(profile: P, ruleId: String) {
      -> ok(profile: P) {
        Remove a rule from the profile. If inherited from
        a parent, records an explicit disable.
      }
      -> notAssigned(ruleId: String) { Rule not in this profile. }
    }

    action configure(profile: P, ruleId: String, severityOverride: option String, parameters: option list { key: String, value: String }) {
      -> ok(profile: P) { Update configuration for an assigned rule. }
      -> notAssigned(ruleId: String) { Rule not in this profile. }
    }

    action resolve(profile: P) {
      -> ok(effectiveRules: list {
        ruleId: String,
        severity: String,
        source: String,
        parameters: list { key: String, value: String }
      }) {
        Resolve the full effective ruleset including inherited
        rules. Source: "own", "inherited", or "overridden".
      }
    }

    action setDefault(profile: P) {
      -> ok(profile: P, previous: option P) {
        Set as default for its language or globally.
      }
    }
  }

  invariant {
    after create(name: "standard") -> ok(profile: std)
    and addRule(profile: std, ruleId: "max-cognitive-complexity") -> ok(profile: std)
    and create(name: "strict", parent: "standard") -> ok(profile: strict)
    then resolve(profile: strict)
      -> ok(effectiveRules: [{ ruleId: "max-cognitive-complexity", source: "inherited" }])
  }
}
```

#### 2.6 QualityGate

```
@version(1)
concept QualityGate [G] {

  purpose {
    Define and evaluate quality threshold conditions that produce
    pass/fail decisions. Compose metric thresholds, finding limits,
    and custom conditions into named gates. Support deployment
    blocking, PR decoration, and quality trend tracking.
  }

  state {
    gates: set G
    identity {
      name: G -> String
      description: G -> option String
    }
    conditions {
      conditions: G -> list {
        conditionId: String,
        metricName: option String,
        findingQuery: option { severities: list String, statuses: list String },
        operator: String,
        threshold: Float,
        onNewCodeOnly: Bool
      }
    }
    evaluation_history {
      evaluations: G -> list {
        evaluatedAt: DateTime,
        passed: Bool,
        results: list {
          conditionId: String,
          actualValue: Float,
          threshold: Float,
          passed: Bool
        }
      }
    }
  }

  actions {
    action define(name: String, description: option String, conditions: list { conditionId: String, metricName: option String, findingQuery: option { severities: list String, statuses: list String }, operator: String, threshold: Float, onNewCodeOnly: Bool }) {
      -> ok(gate: G) {
        Define a quality gate with threshold conditions.
        Operator: "lt", "lte", "gt", "gte", "eq".
        onNewCodeOnly restricts evaluation to changes since baseline.
      }
      -> duplicate(name: String) { Gate name already exists. }
      -> invalidCondition(conditionId: String, message: String) {
        A condition references an unknown metric or invalid operator.
      }
    }

    action evaluate(gate: G, baseline: option String) {
      -> passed(gate: G, results: list { conditionId: String, actualValue: Float, threshold: Float, passed: Bool }) {
        All conditions met. Records evaluation in history.
      }
      -> failed(gate: G, failures: list { conditionId: String, actualValue: Float, threshold: Float, passed: Bool }, passing: list { conditionId: String, actualValue: Float, threshold: Float, passed: Bool }) {
        One or more conditions not met.
      }
      -> error(gate: G, message: String) {
        Evaluation could not complete.
      }
    }

    action override(gate: G, reason: String, overriddenBy: String) {
      -> ok(gate: G) {
        Override a failing gate. Records who overrode and why.
        Used for emergency deployments. Override does not change
        actual quality — gate remains failed in history.
      }
    }

    action trend(gate: G, count: option Int) {
      -> ok(evaluations: list {
        evaluatedAt: DateTime,
        passed: Bool,
        failureCount: Int
      }) {
        Return recent evaluation history (default: 20).
      }
    }
  }

  invariant {
    after define(name: "release-ready", conditions: [
      { conditionId: "no-new-blockers", findingQuery: { severities: ["blocker"], statuses: ["open"] }, operator: "eq", threshold: 0.0, onNewCodeOnly: true },
      { conditionId: "coverage-threshold", metricName: "test_coverage", operator: "gte", threshold: 80.0, onNewCodeOnly: false }
    ]) -> ok(gate: g)
    then evaluate(gate: g) -> passed(gate: g, results: _)
      or evaluate(gate: g) -> failed(gate: g, failures: _, passing: _)
  }
}
```

#### 2.7 TechnicalDebt

```
@version(1)
concept TechnicalDebt [D] {

  purpose {
    Quantify remediation cost (principal) and ongoing productivity
    cost (interest) for quality issues. Calculate ROI-prioritized
    fix ordering and break-even analysis. Track debt evolution.
    Implements NDepend's debt+interest+breaking-point model and
    SQALE's remediation-cost-in-time-units approach.
  }

  state {
    debts: set D
    assessment {
      findingRef: D -> String
      target: D -> String
      principal: D -> Float
      principalUnit: D -> String
      interest: D -> Float
      interestPeriod: D -> String
      assessedAt: D -> DateTime
    }
    calculation {
      breakEvenDays: D -> option Float
      roi: D -> option Float
      changeFrequency: D -> option Float
    }
    aggregation {
      totalPrincipal: Float
      totalMonthlyInterest: Float
      debtRatio: option Float
    }
  }

  actions {
    action assess(findingRef: String, target: String, principal: Float, principalUnit: String, interest: Float, interestPeriod: String) {
      -> ok(debt: D, breakEvenDays: option Float) {
        Assess technical debt for a finding. Principal is estimated
        fix cost. Interest is periodic productivity cost while unfixed.
        breakEvenDays = principal / (interest / periodDays).
      }
      -> duplicate(findingRef: String) { Debt already assessed. }
    }

    action prioritize(targets: option list String, limit: option Int) {
      -> ok(ranked: list {
        debt: D,
        findingRef: String,
        target: String,
        principal: Float,
        interest: Float,
        roi: Float,
        breakEvenDays: Float
      }) {
        Return debt items ranked by ROI (interest / principal).
        Highest-ROI items should be fixed first.
      }
    }

    action summary(groupBy: option String) {
      -> ok(groups: list {
        key: String,
        itemCount: Int,
        totalPrincipal: Float,
        totalMonthlyInterest: Float,
        avgBreakEvenDays: Float,
        worstItem: String
      }) {
        Aggregate debt by "target", "category", "severity", or "effort".
      }
    }

    action retire(findingRef: String) {
      -> ok(debt: D, principalSaved: Float) {
        Mark debt as retired (finding resolved). Removes from
        active totals. Keeps record for historical tracking.
      }
      -> notFound(findingRef: String) { No debt record for this finding. }
    }

    action recalculateInterest(findingRef: String, changeFrequency: Float) {
      -> ok(debt: D, previousInterest: Float, newInterest: Float) {
        Update interest based on observed change frequency.
        Interest scales with how often developers touch affected code.
      }
    }
  }

  invariant {
    after assess(findingRef: "f-001", target: "auth/login.ts", principal: 4.0, principalUnit: "hours", interest: 0.5, interestPeriod: "weekly")
      -> ok(debt: d, breakEvenDays: 56.0)
    and retire(findingRef: "f-001") -> ok(debt: d, principalSaved: 4.0)
    then summary() -> ok(groups: [{ totalPrincipal: 0.0 }])
  }
}
```

### Suite 3: Quality Analysis (`suites/quality-analysis/`)

#### 2.8 Hotspot

```
@version(1)
concept Hotspot [H] {

  purpose {
    Identify code that is both complex and frequently changed.
    Rank files by risk = complexity × change frequency. Track
    hotspot evolution. Enable targeted refactoring investment
    where it matters most. Empirical evidence shows ~2-4% of
    files account for the majority of change-weighted complexity.
  }

  state {
    hotspots: set H
    analysis {
      target: H -> String
      complexity: H -> Float
      changeFrequency: H -> Float
      riskScore: H -> Float
      rank: H -> Int
      analyzedAt: H -> DateTime
    }
    history {
      changeCount: H -> Int
      authorsCount: H -> Int
      lastChangedAt: H -> DateTime
      period: H -> String
    }
    trend {
      riskHistory: H -> list {
        date: DateTime,
        riskScore: Float,
        complexity: Float,
        changeFrequency: Float
      }
    }
  }

  actions {
    action analyze(targets: list String, period: option String, complexityMetric: option String) {
      -> ok(hotspots: list {
        target: String,
        complexity: Float,
        changeFrequency: Float,
        riskScore: Float,
        rank: Int
      }) {
        Analyze targets for hotspot risk. Period defaults to "6m".
        complexityMetric defaults to "cognitive_complexity".
        Risk = normalized complexity × normalized change frequency.
      }
      -> noHistory(message: String) { VCS history not available. }
    }

    action rank(limit: option Int, threshold: option Float) {
      -> ok(ranked: list {
        hotspot: H,
        target: String,
        riskScore: Float,
        complexity: Float,
        changeFrequency: Float,
        authorsCount: Int,
        rank: Int
      }) {
        Return ranked hotspot list. Default limit: 20.
        Threshold filters by minimum risk score (0-1).
      }
    }

    action trend(target: String) {
      -> ok(hotspot: H, trend: list {
        date: DateTime,
        riskScore: Float,
        improving: Bool
      }) {
        Risk score history for a specific target.
      }
      -> notTracked(target: String) { No hotspot data. }
    }

    action distribution() {
      -> ok(summary: {
        totalTargets: Int,
        hotspotsAboveThreshold: Int,
        hotspotPercentage: Float,
        topQuartileRisk: Float,
        medianRisk: Float,
        riskByDirectory: list { directory: String, avgRisk: Float, count: Int }
      }) {
        Project-wide hotspot distribution confirming power law.
      }
    }
  }

  invariant {
    after analyze(targets: ["auth/login.ts", "auth/register.ts", "utils/helpers.ts"])
      -> ok(hotspots: hs)
    then rank(limit: 3) -> ok(ranked: _)
    and distribution() -> ok(summary: { totalTargets: 3 })
  }
}
```

#### 2.9 ChangeCoupling

```
@version(1)
concept ChangeCoupling [C] {

  purpose {
    Detect implicit coupling between code entities by analyzing
    co-change patterns in version control history. Identify files
    that consistently change together, revealing hidden dependencies,
    architectural violations, and refactoring opportunities invisible
    to static analysis.
  }

  state {
    couplings: set C
    pair {
      source: C -> String
      target: C -> String
      coChangeCount: C -> Int
      totalChangesSource: C -> Int
      totalChangesTarget: C -> Int
      couplingStrength: C -> Float
      confidence: C -> Float
      detectedAt: C -> DateTime
    }
    context {
      period: C -> String
      sampleCommits: C -> list String
      crossModule: C -> Bool
    }
  }

  actions {
    action analyze(targets: option list String, period: option String, minStrength: option Float) {
      -> ok(couplings: list {
        source: String,
        target: String,
        couplingStrength: Float,
        confidence: Float,
        coChangeCount: Int,
        crossModule: Bool
      }) {
        Analyze co-change patterns. Strength = coChanges /
        max(sourceChanges, targetChanges). Period defaults to "12m".
        minStrength defaults to 0.3.
      }
      -> noHistory(message: String) { Insufficient VCS history. }
    }

    action neighbors(target: String, limit: option Int) {
      -> ok(coupled: list {
        partner: String,
        couplingStrength: Float,
        coChangeCount: Int,
        crossModule: Bool
      }) {
        All files coupled with the given target, ranked by strength.
      }
      -> notTracked(target: String) { No coupling data. }
    }

    action clusters() {
      -> ok(clusters: list {
        files: list String,
        avgCouplingStrength: Float,
        crossModulePairs: Int,
        suggestedAction: String
      }) {
        Group coupled files using community detection.
        suggestedAction: "co-locate", "extract-shared",
        "introduce-interface", or "investigate".
      }
    }
  }

  invariant {
    after analyze(period: "6m", minStrength: 0.5) -> ok(couplings: cs)
    then clusters() -> ok(clusters: _)
  }
}
```

#### 2.10 KnowledgeMap

```
@version(1)
concept KnowledgeMap [K] {

  purpose {
    Track code ownership and knowledge distribution by analyzing
    authorship patterns in version control. Identify bus-factor
    risks, knowledge silos, abandoned code, and onboarding
    priorities. Provides quantifiable visualization of Conway's Law.
  }

  state {
    entries: set K
    ownership {
      target: K -> String
      primaryAuthor: K -> String
      authors: K -> list {
        author: String,
        contribution: Float,
        lastActive: DateTime,
        commitCount: Int
      }
      busFactor: K -> Int
      analyzedAt: K -> DateTime
    }
    risk {
      abandonedSince: K -> option DateTime
      soloAuthorRisk: K -> Bool
      knowledgeConcentration: K -> Float
    }
  }

  actions {
    action analyze(targets: option list String, period: option String, activeThreshold: option String) {
      -> ok(entries: list {
        target: String,
        primaryAuthor: String,
        busFactor: Int,
        knowledgeConcentration: Float,
        authorCount: Int,
        soloAuthorRisk: Bool
      }) {
        Analyze knowledge distribution. busFactor = minimum authors
        for 80% knowledge coverage. knowledgeConcentration = Gini
        coefficient (0 = equal, 1 = monopoly). activeThreshold
        defaults to "6m".
      }
    }

    action experts(target: String) {
      -> ok(experts: list {
        author: String,
        contribution: Float,
        lastActive: DateTime,
        isActive: Bool,
        recentCommits: Int
      }) {
        Ranked knowledge holders for a target.
      }
      -> notTracked(target: String) { No authorship data. }
    }

    action risks(minBusFactor: option Int) {
      -> ok(atRisk: list {
        target: String,
        busFactor: Int,
        primaryAuthor: String,
        lastActive: DateTime,
        abandoned: Bool
      }) {
        Files/modules with bus factor at or below threshold (default: 1).
      }
    }

    action teamOverview(team: list String) {
      -> ok(coverage: list {
        target: String,
        teamContribution: Float,
        teamMembersActive: Int,
        knownBy: list String
      }) {
        Which targets a team collectively covers.
      }
    }
  }

  invariant {
    after analyze(targets: ["payments/stripe.ts"], period: "12m")
      -> ok(entries: [{ target: "payments/stripe.ts", busFactor: bf }])
    then experts(target: "payments/stripe.ts") -> ok(experts: _)
  }
}
```

#### 2.11 ArchitecturalFitness *(NEW)*

```
@version(1)
concept ArchitecturalFitness [A] {

  purpose {
    Monitor preservation of macro-system design and dependency
    boundaries. Define architectural fitness functions as automated
    tests for architectural intent. Detect illegal cross-layer
    dependencies, circular references, and boundary violations.
    Providers perform actual dependency analysis.
  }

  state {
    functions: set A
    definition {
      functionId: A -> String
      name: A -> String
      description: A -> String
      fitnessType: A -> String
      boundaryDefinition: A -> {
        layers: list { name: String, allowedDependencies: list String },
        forbiddenPatterns: list { from: String, to: String, reason: String }
      }
      enabled: A -> Bool
    }
    evaluation {
      lastEvaluated: A -> option DateTime
      passed: A -> option Bool
      violations: A -> list {
        from: String,
        to: String,
        violationType: String,
        message: String
      }
    }
    trend {
      history: A -> list {
        evaluatedAt: DateTime,
        passed: Bool,
        violationCount: Int
      }
    }
  }

  actions {
    action register(functionId: String, name: String, description: String, fitnessType: String, boundaryDefinition: { layers: list { name: String, allowedDependencies: list String }, forbiddenPatterns: list { from: String, to: String, reason: String } }) {
      -> ok(function: A) {
        Register an architectural fitness function.
        fitnessType: "structural" (dependency direction),
        "layering" (layer boundary), "coupling" (max
        coupling threshold), "circularity" (no circular deps),
        "naming" (module naming conventions),
        "custom" (provider-specific check).
      }
      -> duplicate(functionId: String) { Already registered. }
    }

    action verify(functionId: String, targets: option list String) {
      -> passed(function: A) {
        All architectural constraints satisfied.
      }
      -> violated(function: A, violations: list {
        from: String,
        to: String,
        violationType: String,
        message: String
      }) {
        One or more constraints violated. Returns all violations
        with precise source→target references and explanatory messages.
      }
      -> disabled(functionId: String) { Function is disabled. }
      -> unknownFunction(functionId: String) { No function with this ID. }
    }

    action verifyAll() {
      -> ok(results: list {
        functionId: String,
        name: String,
        passed: Bool,
        violationCount: Int
      }) {
        Evaluate all enabled fitness functions. Returns per-function
        pass/fail summary.
      }
    }

    action enable(functionId: String) {
      -> ok(function: A) { Enable a disabled function. }
      -> alreadyEnabled(function: A) { Already enabled. }
    }

    action disable(functionId: String) {
      -> ok(function: A) { Disable a function. }
      -> alreadyDisabled(function: A) { Already disabled. }
    }

    action trend(functionId: String, count: option Int) {
      -> ok(history: list {
        evaluatedAt: DateTime,
        passed: Bool,
        violationCount: Int
      }) {
        Evaluation history. Default count: 20.
      }
      -> unknownFunction(functionId: String) { No function with this ID. }
    }
  }

  invariant {
    after register(functionId: "no-circular-deps", name: "No Circular Dependencies", description: "Detect circular module dependencies", fitnessType: "circularity", boundaryDefinition: { layers: [], forbiddenPatterns: [] })
      -> ok(function: a)
    then verify(functionId: "no-circular-deps")
      -> passed(function: a) or -> violated(function: a, violations: _)
  }
}
```

**Provider interface:** ArchitecturalFitness providers register via PluginRegistry with capability `quality.fitness.verify`. Providers include:
- **ImportGraphAnalyzer** (TypeScript/JavaScript): Parses import statements, builds dependency graph, checks against layer definitions.
- **ArchUnitBridge** (Java): Delegates to ArchUnit's fluent API for JVM projects.
- **NetArchTestBridge** (.NET): Delegates to NetArchTest for .NET projects.
- **ClefConceptGraphAnalyzer**: Checks Clef concept specs for illegal cross-concept state references, sync dependency violations, and suite boundary violations. This is how the quality kit analyzes Clef itself.

#### 2.12 EnergyProfile *(NEW)*

```
@version(1)
concept EnergyProfile [E] {

  purpose {
    Measure and track energy consumption and carbon emissions of
    code execution. Compute Software Carbon Intensity (SCI) per
    ISO/IEC 21031:2024. Enable energy-aware quality gates and
    optimization tracking. Providers perform actual measurement.
  }

  state {
    profiles: set E
    measurement {
      target: E -> String
      functionalUnit: E -> String
      energyJoules: E -> Float
      carbonIntensityGrams: E -> Float
      embodiedCarbon: E -> Float
      sciScore: E -> Float
      measuredAt: E -> DateTime
    }
    configuration {
      gridCarbonIntensity: E -> Float
      embodiedCarbonPerUnit: E -> Float
      functionalUnitDefinition: E -> String
    }
    trend {
      history: E -> list {
        date: DateTime,
        sciScore: Float,
        energyJoules: Float
      }
    }
  }

  actions {
    action configure(target: String, functionalUnit: String, gridCarbonIntensity: Float, embodiedCarbonPerUnit: Float) {
      -> ok(profile: E) {
        Configure measurement parameters. functionalUnit defines
        the denominator for SCI: "per-request", "per-operation",
        "per-user", "per-transaction". gridCarbonIntensity is
        gCO2eq/kWh for the deployment region. embodiedCarbonPerUnit
        is the amortized hardware carbon per functional unit.
        SCI = ((E × I) + M) / R per ISO/IEC 21031:2024.
      }
      -> duplicate(target: String) { Already configured. }
    }

    action measure(target: String, energyJoules: Float, requestCount: Float) {
      -> ok(profile: E, sciScore: Float, previous: option Float) {
        Record energy measurement. Computes SCI from configured
        parameters: E = energyJoules/requestCount, I = gridCarbonIntensity,
        M = embodiedCarbonPerUnit, R = 1 (per functional unit).
        Returns previous SCI for comparison.
      }
      -> notConfigured(target: String) { No profile configured. }
    }

    action query(targets: option list String) {
      -> ok(results: list {
        target: String,
        sciScore: Float,
        energyJoules: Float,
        carbonIntensityGrams: Float,
        functionalUnit: String,
        measuredAt: DateTime
      }) {
        Query current energy profiles.
      }
    }

    action trend(target: String, count: option Int) {
      -> ok(target: String, currentSCI: Float, trend: list {
        date: DateTime,
        sciScore: Float,
        delta: Float
      }, trajectory: String) {
        SCI history. trajectory: "improving", "stable", "worsening".
      }
      -> notTracked(target: String) { No energy data. }
    }

    action summary() {
      -> ok(overview: {
        totalEnergy: Float,
        totalCarbon: Float,
        meanSCI: Float,
        worstTargets: list { target: String, sciScore: Float },
        improving: Int,
        worsening: Int,
        stable: Int
      }) {
        Project-wide energy summary.
      }
    }
  }

  invariant {
    after configure(target: "api/orders", functionalUnit: "per-request", gridCarbonIntensity: 400.0, embodiedCarbonPerUnit: 0.01)
      -> ok(profile: e)
    and measure(target: "api/orders", energyJoules: 0.5, requestCount: 100.0)
      -> ok(profile: e, sciScore: _, previous: _)
    then query(targets: ["api/orders"]) -> ok(results: [{ target: "api/orders" }])
  }
}
```

**Provider interface:** EnergyProfile providers register via PluginRegistry with capability `quality.energy.measure`. Providers include:
- **PowerJoular** (Java): Per-method energy via Intel RAPL/NVIDIA.
- **PowerAPI** (Python): Software-defined power meters from University of Lille/Inria.
- **Kepler** (Kubernetes): Container-level energy estimation from eBPF.
- **CloudBilling** (AWS/GCP/Azure): Estimate energy from cloud billing metrics.
- **SyntheticBenchmark**: Run benchmark harness, measure wall-clock time × TDP estimate.

#### 2.13 SupplyChainQuality *(NEW)*

```
@version(1)
concept SupplyChainQuality [S] {

  purpose {
    Assess the quality, security, and trustworthiness of software
    dependencies. Track OpenSSF Scorecard results, SBOM completeness,
    vulnerability density, and behavioral analysis flags. Operates
    on package metadata and provenance, not source code.
  }

  state {
    assessments: set S
    dependency {
      packageName: S -> String
      packageVersion: S -> String
      ecosystem: S -> String
      directDependency: S -> Bool
      assessedAt: S -> DateTime
    }
    scorecard {
      openssfScore: S -> option Float
      scorecardChecks: S -> list {
        check: String,
        score: Float,
        reason: String
      }
    }
    vulnerability {
      knownVulnerabilities: S -> list {
        cveId: String,
        severity: String,
        fixAvailable: Bool
      }
      vulnerabilityDensity: S -> Float
    }
    sbom {
      sbomPresent: S -> Bool
      sbomCompleteness: S -> option Float
      sbomStandard: S -> option String
      provenanceVerified: S -> Bool
    }
    behavioral {
      installScriptRisk: S -> option String
      networkAccess: S -> Bool
      credentialAccess: S -> Bool
      behavioralFlags: S -> list String
    }
  }

  actions {
    action scan(ecosystem: String, targets: option list String) {
      -> ok(assessments: list {
        packageName: String,
        packageVersion: String,
        openssfScore: option Float,
        vulnerabilityCount: Int,
        criticalVulnerabilities: Int,
        behavioralFlags: list String,
        riskLevel: String
      }) {
        Scan dependencies. ecosystem: "npm", "pypi", "cargo",
        "maven", "go". If targets is null, scans all declared
        dependencies. riskLevel: "low", "medium", "high", "critical".
        Providers perform actual scanning.
      }
      -> noManifest(message: String) { No dependency manifest found. }
    }

    action assess(packageName: String, packageVersion: String, ecosystem: String) {
      -> ok(assessment: S) {
        Deep assessment of a single dependency. Runs all available
        provider checks: OpenSSF Scorecard, vulnerability DB lookup,
        SBOM verification, behavioral analysis.
      }
      -> notFound(packageName: String, ecosystem: String) {
        Package not found in ecosystem registry.
      }
    }

    action risks(minRiskLevel: option String) {
      -> ok(atRisk: list {
        packageName: String,
        packageVersion: String,
        riskLevel: String,
        reasons: list String,
        directDependency: Bool
      }) {
        Dependencies at or above risk level (default: "medium").
      }
    }

    action summary() {
      -> ok(overview: {
        totalDependencies: Int,
        directDependencies: Int,
        transitiveDependencies: Int,
        meanOpenssfScore: option Float,
        totalVulnerabilities: Int,
        criticalVulnerabilities: Int,
        behavioralFlags: Int,
        sbomCompleteness: option Float
      }) {
        Project-wide supply chain quality overview.
      }
    }

    action verify(packageName: String, packageVersion: String) {
      -> trusted(assessment: S) {
        Package passes all quality checks.
      }
      -> untrusted(assessment: S, reasons: list String) {
        Package fails one or more quality checks.
      }
      -> unknown(packageName: String) {
        Insufficient data to make trust determination.
      }
    }
  }

  invariant {
    after scan(ecosystem: "npm") -> ok(assessments: as)
    then risks(minRiskLevel: "high") -> ok(atRisk: _)
    and summary() -> ok(overview: { totalDependencies: _ })
  }
}
```

**Provider interface:** SupplyChainQuality providers register via PluginRegistry with capability `quality.supply-chain.scan`. Providers include:
- **OpenSSFScorecard**: Runs 18+ automated checks per repository scoring 0-10.
- **SnykScanner**: Vulnerability database lookup with fix recommendations.
- **SocketDev**: Behavioral dependency analysis detecting install scripts, credential exfiltration, network access.
- **SBOMGenerator** (syft/cdxgen): Generate and validate SBOMs against BSI/FSCT/NTIA standards.
- **GUACBridge**: Query GUAC graph aggregating SBOMs, SLSA provenance, and Scorecard results.

#### 2.14 CodeHealth

```
@version(1)
concept CodeHealth [H] {

  purpose {
    Produce transparent aggregate health scores for code entities
    by combining multiple quality biomarkers. Every score includes
    a per-signal breakdown so the number is never opaque. Track
    health evolution to measure improvement. Uses CodeScene's
    1-10 scale with 25+ biomarkers as inspiration, but all signal
    sources are explicitly configured and traceable.
  }

  state {
    scores: set H
    assessment {
      target: H -> String
      score: H -> Float
      grade: H -> String
      assessedAt: H -> DateTime
    }
    biomarkers {
      signals: H -> list {
        name: String,
        value: Float,
        weight: Float,
        rating: String,
        contribution: Float
      }
    }
    trend {
      history: H -> list {
        date: DateTime,
        score: Float,
        grade: String
      }
    }
    configuration {
      biomarkerWeights: list {
        name: String,
        weight: Float,
        source: String
      }
    }
  }

  actions {
    action assess(targets: list String) {
      -> ok(results: list {
        target: String,
        score: Float,
        grade: String,
        biomarkers: list {
          name: String,
          value: Float,
          rating: String,
          contribution: Float
        },
        limitingFactor: String
      }) {
        Assess health. Score: 1-10. Grade: "A" (9-10), "B" (7-8.9),
        "C" (5-6.9), "D" (3-4.9), "F" (1-2.9). limitingFactor is
        the biomarker most reducing the score.
        Default biomarkers: cognitive_complexity, duplication,
        coupling, test_coverage, finding_density, hotspot_risk,
        knowledge_concentration, change_coupling,
        architectural_fitness, energy_efficiency,
        supply_chain_risk.
      }
    }

    action configure(biomarkerWeights: list { name: String, weight: Float, source: String }) {
      -> ok() {
        Configure biomarker weights and sources. Weight determines
        relative importance (sum normalized to 1.0). Source references
        which concept provides the signal.
      }
      -> invalidSource(name: String, source: String) {
        Source doesn't match a known quality concept action.
      }
    }

    action trend(target: String, count: option Int) {
      -> ok(target: String, currentScore: Float, trend: list {
        date: DateTime,
        score: Float,
        delta: Float
      }, trajectory: String) {
        Health score history. trajectory: "improving", "stable",
        "declining" based on linear regression.
      }
      -> notTracked(target: String) { No health data. }
    }

    action dashboard() {
      -> ok(overview: {
        projectScore: Float,
        projectGrade: String,
        targetCount: Int,
        gradeDistribution: list { grade: String, count: Int, percentage: Float },
        worstTargets: list { target: String, score: Float, limitingFactor: String },
        improving: Int,
        declining: Int,
        stable: Int
      }) {
        Project-wide health dashboard.
      }
    }
  }

  invariant {
    after configure(biomarkerWeights: [
      { name: "cognitive_complexity", weight: 0.15, source: "Metric/query" },
      { name: "finding_density", weight: 0.15, source: "Finding/summary" },
      { name: "hotspot_risk", weight: 0.12, source: "Hotspot/rank" },
      { name: "test_coverage", weight: 0.12, source: "Metric/query" },
      { name: "duplication", weight: 0.08, source: "Metric/query" },
      { name: "coupling", weight: 0.08, source: "ChangeCoupling/neighbors" },
      { name: "knowledge_concentration", weight: 0.08, source: "KnowledgeMap/analyze" },
      { name: "architectural_fitness", weight: 0.08, source: "ArchitecturalFitness/verifyAll" },
      { name: "energy_efficiency", weight: 0.07, source: "EnergyProfile/query" },
      { name: "supply_chain_risk", weight: 0.07, source: "SupplyChainQuality/summary" }
    ]) -> ok()
    and assess(targets: ["auth/login.ts"]) -> ok(results: [{ score: s, grade: g }])
    then trend(target: "auth/login.ts") -> ok(target: "auth/login.ts", currentScore: s, trend: _, trajectory: _)
  }
}
```

### Suite 4: Quality Review (`suites/quality-review/`)

#### 2.15 ReviewCoverage

```
@version(1)
concept ReviewCoverage [V] {

  purpose {
    Track code review process quality across the codebase. Measure
    coverage, depth, turnaround, and participation. Identify review
    gaps where code ships without adequate human verification.
    Orthogonal to code quality — clean code with no review process
    has different risks than messy code with thorough review.
  }

  state {
    reviews: set V
    identity {
      changeId: V -> String
      target: V -> String
      author: V -> String
      submittedAt: V -> DateTime
    }
    coverage {
      reviewed: V -> Bool
      reviewers: V -> list String
      reviewRounds: V -> Int
      firstResponseAt: V -> option DateTime
      completedAt: V -> option DateTime
      linesChanged: V -> Int
      linesReviewed: V -> Int
    }
    depth {
      commentCount: V -> Int
      substantiveComments: V -> Int
      timeInvestment: V -> option Float
      defectsFound: V -> Int
      suggestionsAccepted: V -> Int
    }
  }

  actions {
    action record(changeId: String, target: String, author: String, linesChanged: Int) {
      -> ok(review: V) { Record a change submitted for review. }
      -> duplicate(changeId: String) { Change already recorded. }
    }

    action recordReview(changeId: String, reviewer: String, commentCount: Int, substantiveComments: Int, defectsFound: Int, suggestionsAccepted: Int) {
      -> ok(review: V, turnaround: Float) {
        Record a review round. turnaround is hours from submission
        to this review.
      }
      -> changeNotFound(changeId: String) { No change with this ID. }
    }

    action complete(changeId: String) {
      -> ok(review: V, totalTurnaround: Float, totalRounds: Int) {
        Mark review as complete (merged or closed).
      }
      -> changeNotFound(changeId: String) { No change with this ID. }
    }

    action metrics(period: option String, targets: option list String) {
      -> ok(metrics: {
        coverageRate: Float,
        medianTurnaroundHours: Float,
        meanReviewDepth: Float,
        meanDefectsPerReview: Float,
        participationRate: Float,
        totalChanges: Int,
        totalReviewed: Int,
        unreviewed: list { changeId: String, target: String, ageHours: Float }
      }) {
        Review process metrics for a period/target set.
      }
    }

    action authorStats(author: String) {
      -> ok(stats: {
        changesSubmitted: Int,
        reviewsConducted: Int,
        avgTurnaroundAsReviewer: Float,
        avgCommentDepth: Float,
        defectsFoundAsReviewer: Int
      }) {
        Per-author review activity.
      }
    }
  }

  invariant {
    after record(changeId: "pr-142", target: "auth/login.ts", author: "alice", linesChanged: 150)
      -> ok(review: v)
    and recordReview(changeId: "pr-142", reviewer: "bob", commentCount: 4, substantiveComments: 2, defectsFound: 1, suggestionsAccepted: 1)
      -> ok(review: v, turnaround: _)
    and complete(changeId: "pr-142") -> ok(review: v, totalTurnaround: _, totalRounds: _)
    then metrics() -> ok(metrics: { coverageRate: 1.0 })
  }
}
```

#### 2.16 SemanticEvaluator *(NEW)*

```
@version(1)
concept SemanticEvaluator [E] {

  purpose {
    Assess contextual meaning, readability, and intent alignment
    of code using LLM-based evaluation. Detect semantic issues
    invisible to static analysis: misleading names, logic that
    doesn't match docstrings, architectural intent violations in
    AI-generated code. Providers perform LLM inference.
  }

  state {
    evaluations: set E
    specification {
      evaluationId: E -> String
      target: E -> String
      intentDescription: E -> option String
      persona: E -> option String
      evaluatedAt: E -> DateTime
    }
    result {
      overallRating: E -> Float
      intentAligned: E -> Bool
      readabilityScore: E -> Float
      rationale: E -> String
      issues: E -> list {
        location: String,
        issueType: String,
        description: String,
        severity: String,
        suggestion: option String
      }
    }
    configuration {
      defaultPersona: option String
      promptTemplate: option String
      confidenceThreshold: Float
    }
  }

  actions {
    action assess(target: String, intentDescription: option String, persona: option String) {
      -> ok(evaluation: E, overallRating: Float, issues: list {
        location: String,
        issueType: String,
        description: String,
        severity: String
      }) {
        Assess code semantics. intentDescription is a natural language
        specification of what the code should do. persona: "junior",
        "senior", "security", "performance", "architect". Default
        is "senior". overallRating: 0-10 scale. Issues include
        "misleading-name", "intent-mismatch", "missing-error-handling",
        "unnecessary-complexity", "documentation-drift",
        "hallucinated-feature" (for AI-generated code).
      }
      -> targetNotFound(target: String) { Target file not found. }
      -> providerUnavailable(message: String) { No LLM provider configured. }
    }

    action assessBatch(targets: list { target: String, intentDescription: option String }, persona: option String) {
      -> ok(results: list {
        target: String,
        overallRating: Float,
        issueCount: Int,
        intentAligned: Bool
      }) {
        Batch assessment for multiple targets.
      }
    }

    action configure(defaultPersona: option String, promptTemplate: option String, confidenceThreshold: option Float) {
      -> ok() {
        Configure evaluation defaults. confidenceThreshold (0-1)
        filters out low-confidence assessments. Default: 0.7.
      }
    }

    action compare(target: String, beforeVersion: String, afterVersion: String) {
      -> ok(evaluation: E, ratingDelta: Float, newIssues: list {
        location: String,
        issueType: String,
        description: String
      }, resolvedIssues: list String) {
        Compare semantic quality between two versions of a target.
        Detects semantic regressions in refactors or AI-generated changes.
      }
      -> targetNotFound(target: String) { Target not found. }
    }

    action query(targets: option list String, minRating: option Float) {
      -> ok(evaluations: list {
        evaluationId: String,
        target: String,
        overallRating: Float,
        intentAligned: Bool,
        issueCount: Int,
        evaluatedAt: DateTime
      }) {
        Query evaluation results with filtering.
      }
    }
  }

  invariant {
    after assess(target: "auth/login.ts", intentDescription: "Authenticate user with email and password, returning JWT on success", persona: "security")
      -> ok(evaluation: e, overallRating: r, issues: _)
    then query(targets: ["auth/login.ts"])
      -> ok(evaluations: [{ target: "auth/login.ts", overallRating: r }])
  }
}
```

**Provider interface:** SemanticEvaluator providers register via PluginRegistry with capability `quality.semantic.evaluate`. Providers include:
- **ClaudeEvaluator**: Uses Claude API with structured prompts for intent alignment, readability, and issue detection. Supports persona-based assessment via system prompts.
- **GPT4Evaluator**: Uses OpenAI API with similar prompting strategy.
- **CodeBERTScorer**: Uses CodeBERT contextual embeddings for semantic similarity scoring (CodeBERTScore). Good for detecting variable renaming, loop unrolling, and method decomposition quality.
- **LocalModelRunner**: Runs local open-weight models (CodeLlama, DeepSeek) for air-gapped environments.
- **HuCoSCEvaluator**: Implements the HuCoSC methodology (Pearson 0.753 correlation with human experts) using GPT-4 Turbo with calibrated prompting.

---

## §3 Cross-Suite Syncs

### 3.1 Measurement Foundation Syncs

```
sync ReportFindingsFromEvaluation [eager]
purpose { Convert rule violations into tracked findings. }
when {
  Rule/evaluate: [ ruleId: ?ruleId ]
    => ok(rule: ?r; violations: ?violations; clean: ?clean)
}
then {
  Finding/report: [
    ruleId: ?ruleId;
    target: ?violations.target;
    location: ?violations.location;
    message: ?violations.message;
    severity: ?r.severity;
    category: ?r.category;
    effort: ?r.effort;
    source: "static"
  ]
}
```

```
sync RetireDebtOnFindingResolution [eager]
purpose { Remove debt for resolved findings. }
when {
  Finding/resolve: [ finding: ?f ]
    => ok(finding: ?f)
}
where {
  Finding: { ?f ruleId: ?ruleId, target: ?target }
  bind(findingFingerprint(?ruleId, ?target) as ?ref)
}
then {
  TechnicalDebt/retire: [ findingRef: ?ref ]
}
```

```
sync AssessDebtForNewFindings [eventual]
purpose { Estimate technical debt for each new finding. }
when {
  Finding/report: []
    => new(finding: ?f)
}
where {
  Finding: { ?f ruleId: ?ruleId, target: ?target, effort: ?effort }
  bind(effortToHours(?effort) as ?principal)
  bind(estimateInterest(?target) as ?interest)
}
then {
  TechnicalDebt/assess: [
    findingRef: findingFingerprint(?ruleId, ?target);
    target: ?target;
    principal: ?principal;
    principalUnit: "hours";
    interest: ?interest;
    interestPeriod: "weekly"
  ]
}
```

### 3.2 Policy Syncs

```
sync EvaluateProfileRules [eager]
purpose { Run all rules in a profile against targets. }
when {
  QualityProfile/resolve: [ profile: ?p ]
    => ok(effectiveRules: ?rules)
}
then {
  Rule/evaluate: [
    ruleId: ?rules.ruleId;
    targets: profileTargets(?p)
  ]
}
```

```
sync EvaluateGateConditions [eager]
purpose { Gather metric and finding data for gate evaluation. }
when {
  QualityGate/evaluate: [ gate: ?g; baseline: ?baseline ]
    => []
}
then {
  Finding/summary: [ groupBy: "severity" ]
  Metric/summary: []
}
```

```
sync BlockDeployOnQualityGateFailure [eager]
purpose { Prevent deployment when quality gate fails. }
when {
  QualityGate/evaluate: [ gate: ?g ]
    => failed(gate: ?g; failures: ?failures)
}
then {
  DeployPlan/gate: [
    concept: gateContext(?g);
    reason: concat("Quality gate failed: ", ?failures.conditionId, " (", ?failures.actualValue, " vs ", ?failures.threshold, ")");
    severity: "error"
  ]
}
```

### 3.3 Analysis Syncs

```
sync EnrichHotspotWithMetrics [eager]
purpose { Supply complexity metrics for hotspot analysis. }
when {
  Hotspot/analyze: [ targets: ?targets; complexityMetric: ?metricName ]
    => []
}
then {
  Metric/query: [
    name: ?metricName;
    targets: ?targets
  ]
}
```

```
sync RecalculateInterestFromHotspot [eventual]
purpose { Update debt interest based on actual change frequency. }
when {
  Hotspot/analyze: [ targets: ?targets ]
    => ok(hotspots: ?hs)
}
then {
  TechnicalDebt/recalculateInterest: [
    findingRef: findingsForTarget(?hs.target);
    changeFrequency: ?hs.changeFrequency
  ]
}
```

```
sync ReportArchitecturalViolationsAsFindings [eager]
purpose { Convert architectural fitness violations into tracked findings. }
when {
  ArchitecturalFitness/verify: [ functionId: ?fid ]
    => violated(function: ?a; violations: ?violations)
}
where {
  ArchitecturalFitness: { ?a name: ?name }
}
then {
  Finding/report: [
    ruleId: concat("arch-fitness:", ?fid);
    target: ?violations.from;
    location: concat(?violations.from, " -> ", ?violations.to);
    message: ?violations.message;
    severity: "critical";
    category: "architecture";
    source: "architectural"
  ]
}
```

```
sync ReportEnergyAsMetrics [eventual]
purpose { Feed energy measurements into the metric system. }
when {
  EnergyProfile/measure: [ target: ?target ]
    => ok(profile: ?e; sciScore: ?sci)
}
where {
  EnergyProfile: { ?e energyJoules: ?energy }
}
then {
  Metric/record: [
    name: "carbon_intensity";
    target: ?target;
    value: ?sci;
    computedBy: "EnergyProfile"
  ]
  Metric/record: [
    name: "energy_per_request";
    target: ?target;
    value: ?energy;
    computedBy: "EnergyProfile"
  ]
}
```

```
sync ReportSupplyChainRisksAsFindings [eventual]
purpose { Convert supply chain risks into tracked findings. }
when {
  SupplyChainQuality/scan: [ ecosystem: ?eco ]
    => ok(assessments: ?as)
}
where {
  filter(?as.riskLevel in ["high", "critical"])
}
then {
  Finding/report: [
    ruleId: concat("supply-chain:", ?as.packageName);
    target: concat(?eco, "/", ?as.packageName, "@", ?as.packageVersion);
    location: "dependency-manifest";
    message: concat("Supply chain risk: ", ?as.riskLevel, " (", ?as.behavioralFlags, ")");
    severity: mapRiskToSeverity(?as.riskLevel);
    category: "supply-chain";
    source: "supply-chain"
  ]
}
```

```
sync ReportSupplyChainMetrics [eventual]
purpose { Feed supply chain scores into the metric system. }
when {
  SupplyChainQuality/summary: []
    => ok(overview: ?o)
}
then {
  Metric/record: [
    name: "openssf_scorecard";
    target: "project";
    value: ?o.meanOpenssfScore;
    computedBy: "SupplyChainQuality"
  ]
  Metric/record: [
    name: "dependency_vulnerability_density";
    target: "project";
    value: ?o.totalVulnerabilities;
    computedBy: "SupplyChainQuality"
  ]
}
```

### 3.4 Aggregation Syncs

```
sync GatherHealthSignals [eager]
purpose { Read all biomarker sources for health scoring. }
when {
  CodeHealth/assess: [ targets: ?targets ]
    => []
}
then {
  Metric/query: [ name: "cognitive_complexity"; targets: ?targets ]
  Metric/query: [ name: "test_coverage"; targets: ?targets ]
  Metric/query: [ name: "duplication_rate"; targets: ?targets ]
  Finding/summary: [ groupBy: "target" ]
  Hotspot/rank: [ limit: null ]
  ChangeCoupling/analyze: [ targets: ?targets ]
  KnowledgeMap/analyze: [ targets: ?targets ]
  ArchitecturalFitness/verifyAll: []
  EnergyProfile/query: [ targets: ?targets ]
  SupplyChainQuality/summary: []
}
```

```
sync SnapshotQualityState [eager]
purpose { Read current metrics and findings for baseline capture. }
when {
  Baseline/capture: [ name: ?name ]
    => []
}
then {
  Metric/summary: []
  Finding/summary: [ groupBy: "severity" ]
}
```

```
sync IncludeReviewInHealth [eventual]
purpose { Factor review coverage into code health signals. }
when {
  ReviewCoverage/metrics: []
    => ok(metrics: ?m)
}
then {
  Metric/record: [
    name: "review_coverage";
    target: "project";
    value: ?m.coverageRate
  ]
}
```

### 3.5 Review Syncs

```
sync ReportSemanticIssuesAsFindings [eventual]
purpose { Convert semantic evaluation issues into tracked findings. }
when {
  SemanticEvaluator/assess: [ target: ?target ]
    => ok(evaluation: ?e; overallRating: ?rating; issues: ?issues)
}
where {
  filter(?issues.severity in ["major", "critical", "blocker"])
}
then {
  Finding/report: [
    ruleId: concat("semantic:", ?issues.issueType);
    target: ?target;
    location: ?issues.location;
    message: ?issues.description;
    severity: ?issues.severity;
    category: "semantic";
    source: "semantic"
  ]
}
```

### 3.6 External Integration Syncs

```
sync EvaluateQualityAfterBuild [eventual]
purpose { Run quality analysis on freshly built code. }
when {
  Builder/build: [ concept: ?concept; language: ?lang ]
    => ok(build: ?b; artifactLocation: ?loc)
}
then {
  QualityProfile/resolve: [ profile: defaultProfileFor(?lang) ]
  Hotspot/analyze: [ targets: sourcesFor(?concept) ]
  CodeHealth/assess: [ targets: sourcesFor(?concept) ]
}
```

```
sync EvaluateGeneratedCodeQuality [eventual]
purpose { Run quality analysis on Clef-generated code. }
when {
  Emitter/writeBatch: []
    => ok(results: ?results)
}
then {
  Metric/record: [
    name: "cognitive_complexity";
    target: ?results.path;
    value: computeComplexity(?results.path)
  ]
  CodeHealth/assess: [
    targets: [?results.path]
  ]
  SemanticEvaluator/assess: [
    target: ?results.path;
    intentDescription: sourceIntentFor(?results.path)
  ]
}
```

```
sync NotifyOnQualityGateFailure [eventual]
purpose { Alert stakeholders when quality gate fails. }
when {
  QualityGate/evaluate: [ gate: ?g ]
    => failed(gate: ?g; failures: ?failures)
}
then {
  Notification/send: [
    channel: "quality";
    severity: "warning";
    message: concat("Quality gate '", ?g.name, "' failed: ", formatFailures(?failures))
  ]
}
```

### Sync Summary

| # | Sync Name | Tier | From | To |
|---|---|---|---|---|
| 1 | ReportFindingsFromEvaluation | required | Rule/evaluate | Finding/report |
| 2 | RetireDebtOnFindingResolution | required | Finding/resolve | TechnicalDebt/retire |
| 3 | AssessDebtForNewFindings | recommended | Finding/report→new | TechnicalDebt/assess |
| 4 | EvaluateProfileRules | required | QualityProfile/resolve | Rule/evaluate |
| 5 | EvaluateGateConditions | required | QualityGate/evaluate | Finding+Metric |
| 6 | BlockDeployOnQualityGateFailure | required | QualityGate→failed | DeployPlan/gate |
| 7 | EnrichHotspotWithMetrics | required | Hotspot/analyze | Metric/query |
| 8 | RecalculateInterestFromHotspot | recommended | Hotspot/analyze→ok | TechnicalDebt/recalculate |
| 9 | ReportArchitecturalViolationsAsFindings | required | ArchitecturalFitness→violated | Finding/report |
| 10 | ReportEnergyAsMetrics | recommended | EnergyProfile/measure | Metric/record |
| 11 | ReportSupplyChainRisksAsFindings | recommended | SupplyChainQuality/scan | Finding/report |
| 12 | ReportSupplyChainMetrics | recommended | SupplyChainQuality/summary | Metric/record |
| 13 | GatherHealthSignals | required | CodeHealth/assess | Metric+Finding+Hotspot+CC+KM+AF+EP+SCQ |
| 14 | SnapshotQualityState | required | Baseline/capture | Metric+Finding |
| 15 | IncludeReviewInHealth | recommended | ReviewCoverage/metrics | Metric/record |
| 16 | ReportSemanticIssuesAsFindings | recommended | SemanticEvaluator/assess | Finding/report |
| 17 | EvaluateQualityAfterBuild | integration | Builder/build | QualityProfile+Hotspot+CodeHealth |
| 18 | EvaluateGeneratedCodeQuality | integration | Emitter/writeBatch | Metric+CodeHealth+SemanticEvaluator |
| 19 | NotifyOnQualityGateFailure | recommended | QualityGate→failed | Notification/send |

**Totals: 7 required, 7 recommended, 2 integration, plus 3 syncs (20-21) connecting to existing suites.** Two integration syncs connect to the Deploy and Generation suites.

---

## §4 Derived Concepts

### 4.1 CleanAsYouCode

```
derived CleanAsYouCode [T] {

  purpose {
    Enforce quality standards on new and changed code only,
    allowing existing technical debt to be addressed incrementally
    without blocking development. Implements SonarQube's
    "Clean as You Code" philosophy as a named composition.
  }

  composes {
    Baseline [T]
    Finding [T]
    QualityGate [T]
  }

  syncs {
    required: [SnapshotQualityState, EvaluateGateConditions, BlockDeployOnQualityGateFailure]
  }

  surface {
    action setReference(name: String, strategy: String, reference: String) {
      matches: Baseline/capture(name: name, strategy: strategy, reference: reference)
    }

    action check(gate: String) {
      matches: QualityGate/evaluate(gate: gate, baseline: "current-reference")
    }

    query newFindings() -> Finding/query(statuses: ["open"])
  }

  principle {
    after setReference(name: "sprint-start", strategy: "date", reference: "2026-03-01")
    and check(gate: "release-ready")
    then only findings introduced since the reference are evaluated
  }
}
```

### 4.2 RefactoringAdvisor

```
derived RefactoringAdvisor [T] {

  purpose {
    Produce prioritized refactoring recommendations by combining
    hotspot risk, technical debt ROI, and knowledge availability.
    Answer: "where should we invest, what's the payoff, and who
    should do it?"
  }

  composes {
    Hotspot [T]
    TechnicalDebt [T]
    KnowledgeMap [T]
  }

  syncs {
    required: [RecalculateInterestFromHotspot, EnrichHotspotWithMetrics]
  }

  surface {
    action recommend(limit: option Int) {
      matches: derivedContext "RefactoringAdvisor"
    }

    query topTargets() -> Hotspot/rank(limit: 10)
    query experts(target: String) -> KnowledgeMap/experts(target: target)
    query payoff(target: String) -> TechnicalDebt/prioritize(targets: [target])
  }

  principle {
    after recommend(limit: 5)
    then topTargets returns ranked refactoring targets
    and for each target, experts identifies who can do the work
    and payoff shows the expected debt reduction
  }
}
```

### 4.3 AICodeGate *(NEW)*

```
derived AICodeGate [T] {

  purpose {
    Multi-dimensional validation pipeline for AI-generated code.
    Combats "Implementation Laziness" and semantic hallucination
    by orchestrating semantic evaluation, architectural fitness
    verification, and quality gate enforcement. Addresses the
    finding that AI-generated code produces 1.7× more issues
    than human-authored code.
  }

  composes {
    SemanticEvaluator [T]
    ArchitecturalFitness [T]
    QualityGate [T]
    Finding [T]
  }

  syncs {
    required: [ReportSemanticIssuesAsFindings, ReportArchitecturalViolationsAsFindings, EvaluateGateConditions, BlockDeployOnQualityGateFailure]
  }

  surface {
    action validate(target: String, intentDescription: String) {
      matches: derivedContext "AICodeGate"
    }

    query semanticReport(target: String) -> SemanticEvaluator/query(targets: [target])
    query architecturalReport() -> ArchitecturalFitness/verifyAll()
    query gateStatus(gate: String) -> QualityGate/evaluate(gate: gate)
    query issues(target: String) -> Finding/query(targets: [target], sources: ["semantic", "architectural"])
  }

  principle {
    after validate(target: "generated/service.ts", intentDescription: "Order processing microservice")
    then semanticReport verifies intent alignment
    and architecturalReport confirms no boundary violations
    and gateStatus confirms all quality thresholds met
    and if any check fails, the PR is rejected with specific remediation guidance
  }
}
```

### 4.4 SupplyChainAudit *(NEW)*

```
derived SupplyChainAudit [T] {

  purpose {
    Dependency audit workflow combining supply chain scanning,
    finding tracking, and quality gate enforcement. Provides
    a single entry point for answering "are our dependencies
    safe to ship?"
  }

  composes {
    SupplyChainQuality [T]
    Finding [T]
    QualityGate [T]
  }

  syncs {
    required: [ReportSupplyChainRisksAsFindings, EvaluateGateConditions]
  }

  surface {
    action audit(ecosystem: String) {
      matches: SupplyChainQuality/scan(ecosystem: ecosystem)
    }

    query risks() -> SupplyChainQuality/risks(minRiskLevel: "medium")
    query findings() -> Finding/query(sources: ["supply-chain"], statuses: ["open"])
    query gateStatus(gate: String) -> QualityGate/evaluate(gate: gate)
  }

  principle {
    after audit(ecosystem: "npm")
    then risks shows all dependencies at medium+ risk
    and findings shows tracked supply chain issues
    and gateStatus shows whether dependencies pass shipping criteria
  }
}
```

### 4.5 QualityDashboard

```
derived QualityDashboard [T] {

  purpose {
    Unified quality overview combining health scores, finding
    trends, gate status, review coverage, and quality evolution.
    The single entry point for "how is our codebase doing?"
  }

  composes {
    CodeHealth [T]
    Finding [T]
    Baseline [T]
    QualityGate [T]
    ReviewCoverage [T]
    EnergyProfile [T]
    SupplyChainQuality [T]
  }

  syncs {
    required: [GatherHealthSignals, EvaluateGateConditions, SnapshotQualityState, IncludeReviewInHealth]
  }

  surface {
    query overview() -> CodeHealth/dashboard()
    query findings() -> Finding/summary(groupBy: "severity")
    query gateStatus(gate: String) -> QualityGate/evaluate(gate: gate)
    query evolution(baseline: String) -> Baseline/compare(baseline: baseline)
    query reviewHealth() -> ReviewCoverage/metrics()
    query energyHealth() -> EnergyProfile/summary()
    query supplyChainHealth() -> SupplyChainQuality/summary()
  }

  principle {
    overview provides project-wide health score with biomarker transparency
    and findings shows current issue landscape across all sources
    and gateStatus shows deployment readiness
    and evolution shows quality trajectory since baseline
    and energyHealth shows sustainability posture
    and supplyChainHealth shows dependency risk profile
  }
}
```

---

## §5 Suite Manifests

### 5.1 Quality Measurement Suite

```yaml
suite:
  name: quality-measurement
  version: 1.0.0
  description: "Core quality data model: define metrics, evaluate rules, track findings, capture baselines."

concepts:
  Metric:
    spec: ./metric.concept
    params:
      M: { as: MetricRef, description: "Reference to a metric definition + measurement" }
  Rule:
    spec: ./rule.concept
    params:
      R: { as: RuleRef, description: "Reference to a quality rule" }
  Finding:
    spec: ./finding.concept
    params:
      F: { as: FindingRef, description: "Reference to a quality finding" }
  Baseline:
    spec: ./baseline.concept
    params:
      B: { as: BaselineRef, description: "Reference to a quality baseline" }

syncs:
  required:
    - ReportFindingsFromEvaluation
  recommended:
    - AssessDebtForNewFindings

uses:
  - suite: quality-policy
    optional: true
    concepts:
      - name: TechnicalDebt
```

### 5.2 Quality Policy Suite

```yaml
suite:
  name: quality-policy
  version: 1.0.0
  description: "Organizational quality standards: profiles, gates, and technical debt tracking."

concepts:
  QualityProfile:
    spec: ./quality-profile.concept
    params:
      P: { as: ProfileRef, description: "Reference to a quality profile" }
  QualityGate:
    spec: ./quality-gate.concept
    params:
      G: { as: GateRef, description: "Reference to a quality gate" }
  TechnicalDebt:
    spec: ./technical-debt.concept
    params:
      D: { as: DebtRef, description: "Reference to a debt assessment" }

syncs:
  required:
    - EvaluateProfileRules
    - EvaluateGateConditions
    - RetireDebtOnFindingResolution
    - BlockDeployOnQualityGateFailure
  recommended:
    - NotifyOnQualityGateFailure

uses:
  - suite: quality-measurement
    concepts:
      - name: Metric
      - name: Rule
      - name: Finding
  - suite: deploy
    optional: true
    concepts:
      - name: DeployPlan
  - suite: notification
    optional: true
    concepts:
      - name: Notification
```

### 5.3 Quality Analysis Suite

```yaml
suite:
  name: quality-analysis
  version: 1.0.0
  description: "Multi-dimensional code analysis: behavioral, architectural, energy, supply chain, and aggregate health."

concepts:
  Hotspot:
    spec: ./hotspot.concept
    params:
      H: { as: HotspotRef, description: "Reference to a hotspot analysis result" }
  ChangeCoupling:
    spec: ./change-coupling.concept
    params:
      C: { as: CouplingRef, description: "Reference to a coupling pair" }
  KnowledgeMap:
    spec: ./knowledge-map.concept
    params:
      K: { as: KnowledgeRef, description: "Reference to a knowledge entry" }
  ArchitecturalFitness:
    spec: ./architectural-fitness.concept
    params:
      A: { as: FitnessRef, description: "Reference to a fitness function" }
  EnergyProfile:
    spec: ./energy-profile.concept
    params:
      E: { as: EnergyRef, description: "Reference to an energy profile" }
  SupplyChainQuality:
    spec: ./supply-chain-quality.concept
    params:
      S: { as: SupplyChainRef, description: "Reference to a supply chain assessment" }
  CodeHealth:
    spec: ./code-health.concept
    params:
      H: { as: HealthRef, description: "Reference to a health score" }

syncs:
  required:
    - EnrichHotspotWithMetrics
    - GatherHealthSignals
    - ReportArchitecturalViolationsAsFindings
  recommended:
    - RecalculateInterestFromHotspot
    - ReportEnergyAsMetrics
    - ReportSupplyChainRisksAsFindings
    - ReportSupplyChainMetrics
    - IncludeReviewInHealth
  integration:
    - EvaluateQualityAfterBuild
    - EvaluateGeneratedCodeQuality

uses:
  - suite: quality-measurement
    concepts:
      - name: Metric
      - name: Finding
  - suite: quality-policy
    optional: true
    concepts:
      - name: TechnicalDebt
  - suite: quality-review
    optional: true
    concepts:
      - name: ReviewCoverage
  - suite: infrastructure
    concepts:
      - name: PluginRegistry
```

### 5.4 Quality Review Suite

```yaml
suite:
  name: quality-review
  version: 1.0.0
  description: "Code review process tracking and AI-powered semantic evaluation."

concepts:
  ReviewCoverage:
    spec: ./review-coverage.concept
    params:
      V: { as: ReviewRef, description: "Reference to a review record" }
  SemanticEvaluator:
    spec: ./semantic-evaluator.concept
    params:
      E: { as: SemanticRef, description: "Reference to a semantic evaluation" }

syncs:
  recommended:
    - ReportSemanticIssuesAsFindings

uses:
  - suite: quality-measurement
    concepts:
      - name: Finding
  - suite: infrastructure
    concepts:
      - name: PluginRegistry
```

---

## §6 Existing Concept Updates

### 6.1 DeployPlan (suites/deploy/)

**No concept changes.** QualityGate failure syncs to DeployPlan/gate using the same pattern as the test kit's gate syncs. The BlockDeployOnQualityGateFailure sync is the only integration point.

### 6.2 Notification (suites/notification/)

**No concept changes.** NotifyOnQualityGateFailure sync sends notifications through the existing Notification/send action.

### 6.3 PluginRegistry (suites/infrastructure/)

**No concept changes.** Quality providers register through PluginRegistry exactly as Builder, Runtime, and Target providers do. New capability namespaces:

| Capability | Purpose |
|---|---|
| `quality.metric.compute` | Metric computation providers |
| `quality.rule.evaluate` | Rule evaluation providers |
| `quality.vcs.parse` | VCS history parsing providers |
| `quality.fitness.verify` | Architectural fitness providers |
| `quality.semantic.evaluate` | LLM-based semantic evaluation providers |
| `quality.energy.measure` | Energy measurement providers |
| `quality.supply-chain.scan` | Supply chain scanning providers |

### 6.4 Scope Boundary Clarification

| Concept | Scope | Substrate | When |
|---|---|---|---|
| Validator (infrastructure) | Write-time constraints | CRUD/form data | On operations |
| DataQuality (data-integration) | Pipeline-level assessment | ETL data | During integration |
| Rule/Finding/Metric (quality) | Source code quality | Source code, VCS, deps | During dev/CI |
| ArchitecturalFitness (quality) | Structural invariants | Dependency graphs | During build/CI |
| SupplyChainQuality (quality) | Dependency quality | Package metadata | During build/CI |
| SemanticEvaluator (quality) | Semantic correctness | Code + intent specs | During review/CI |

No overlap — each operates on a different substrate at a different lifecycle stage.

---

## §7 Implementation Plan

### Phase 1: Measurement Foundation (Metric + Rule + Finding)

**Goal:** Define metrics, evaluate rules, track findings. Minimum viable quality pipeline.

**Tasks:**
1. Write Metric concept spec, generate handlers in TypeScript, Rust, Swift, Solidity.
2. Write Rule concept spec, generate handlers.
3. Write Finding concept spec, generate handlers.
4. Implement ReportFindingsFromEvaluation sync.
5. Register tree-sitter complexity analyzer as first Metric provider via PluginRegistry.
6. Register ESLint wrapper as first Rule provider via PluginRegistry.
7. Implement `clef quality metric`, `clef quality rule`, `clef quality finding` CLI commands (via Bind CLI target).
8. Seed built-in metric definitions (cyclomatic, cognitive, Halstead, CK, coverage, duplication).
9. Write Conformance tests for all three concepts.
10. Write ContractTest for the Rule→Finding sync chain.

**Acceptance:** `clef quality finding summary --group-by severity` shows per-severity breakdown.

**Provider implementation details:**

*Tree-sitter complexity provider (TypeScript):*
- Parse source files using tree-sitter with language-specific grammars.
- Walk CST counting branch points for cyclomatic complexity.
- Apply SonarSource's cognitive complexity algorithm: +1 per break in linear flow, additional +1 per nesting level for nested flow-breaks, +0 for shorthand operators.
- Return `(target, "cyclomatic_complexity"|"cognitive_complexity", value)` triples.

*ESLint wrapper provider (TypeScript):*
- Run ESLint programmatically with `@typescript-eslint/parser`.
- Map ESLint rule IDs to Clef Rule IDs via configuration.
- Convert ESLint `LintResult[]` to `(ruleId, target, location, message)` violation tuples.
- Support YAML rule configuration for Semgrep-style rules.

### Phase 2: Policy Layer (QualityProfile + QualityGate + TechnicalDebt)

**Goal:** Compose rules into profiles, evaluate gates for deployment decisions, track debt economics.

**Tasks:**
1. Write QualityProfile, QualityGate, TechnicalDebt concept specs, generate handlers.
2. Implement EvaluateProfileRules, EvaluateGateConditions, BlockDeployOnQualityGateFailure syncs.
3. Implement AssessDebtForNewFindings, RetireDebtOnFindingResolution syncs.
4. Implement `clef quality profile`, `clef quality gate`, `clef quality debt` CLI commands.
5. Create default profiles: "essential" (20 rules), "standard" (50 rules), "strict" (80 rules), "comprehensive" (all rules).
6. Create default gates: "release-ready" (no blockers, coverage > 80%), "security-clean" (no security findings), "pr-check" (no new critical findings on new code only).
7. Write Conformance and ContractTest for all three concepts.

**Acceptance:** `clef quality gate evaluate --gate release-ready` shows pass/fail with per-condition detail.

**Effort-to-hours mapping for debt assessment:**

| Effort Level | Hours | Use Case |
|---|---|---|
| trivial | 0.25 | Rename, formatting fix |
| easy | 1.0 | Single function refactor |
| medium | 4.0 | Extract class, reduce complexity |
| hard | 16.0 | Architectural restructuring |

**Interest estimation heuristic:** Base interest = 0.1 hours/week. Multiplied by Hotspot change frequency if available (via RecalculateInterestFromHotspot sync). A file touched 10×/month has 10× the interest of a file touched 1×/month.

### Phase 3: Temporal Tracking (Baseline)

**Goal:** Track quality evolution with named reference points.

**Tasks:**
1. Write Baseline concept spec, generate handlers.
2. Implement SnapshotQualityState sync.
3. Implement `clef quality baseline` CLI commands.
4. Write Conformance and ContractTest.

**Acceptance:** `clef quality baseline compare --name sprint-42` shows delta with per-metric and per-finding detail.

### Phase 4: Behavioral Analysis (Hotspot + ChangeCoupling + KnowledgeMap)

**Goal:** Add VCS-based analysis dimensions orthogonal to static analysis.

**Tasks:**
1. Write Hotspot, ChangeCoupling, KnowledgeMap concept specs, generate handlers.
2. Build git log parser as shared VCS provider via PluginRegistry (capability `quality.vcs.parse`).
3. Implement EnrichHotspotWithMetrics, RecalculateInterestFromHotspot syncs.
4. Implement `clef quality hotspot`, `clef quality coupling`, `clef quality knowledge` CLI commands.
5. Write Conformance and ContractTest.

**Acceptance:** `clef quality hotspot rank` shows risk-ranked files with complexity × churn.

**Git log parser implementation details:**

```
# Extract change frequency per file for a given period
git log --since="6 months ago" --pretty=format:"%H %ae %aI" --name-only

# For each file: count commits (change frequency), count unique authors, extract timestamps
# For co-change analysis: group files modified in the same commit
# For knowledge analysis: weight contributions by recency (exponential decay)

# Normalization: change frequency = commits / max(commits across all files)
# Risk score: normalized complexity × normalized change frequency
# Bus factor: minimum authors whose cumulative contribution ≥ 80%
# Knowledge concentration: Gini coefficient of author commit counts
```

### Phase 5: Architectural & Sustainability Analysis (ArchitecturalFitness + EnergyProfile + SupplyChainQuality)

**Goal:** Add fitness functions, energy profiling, and supply chain quality as new analysis dimensions.

**Tasks:**
1. Write ArchitecturalFitness, EnergyProfile, SupplyChainQuality concept specs, generate handlers.
2. Build ImportGraphAnalyzer as ArchitecturalFitness provider (TypeScript, parses import statements).
3. Build SyntheticBenchmark as EnergyProfile provider (wall-clock × TDP estimate).
4. Build OpenSSFScorecard bridge as SupplyChainQuality provider.
5. Implement ReportArchitecturalViolationsAsFindings, ReportEnergyAsMetrics, ReportSupplyChainRisksAsFindings, ReportSupplyChainMetrics syncs.
6. Implement CLI commands.
7. Write Conformance and ContractTest.

**Acceptance:** `clef quality` unified output includes architectural fitness, energy, and supply chain dimensions.

**ImportGraphAnalyzer implementation (TypeScript):**
- Parse TypeScript/JavaScript imports using tree-sitter or the TypeScript compiler API.
- Build directed graph: nodes = modules, edges = import dependencies.
- Check against registered boundary definitions: for each edge, verify that the source module's layer is allowed to depend on the target module's layer.
- Detect cycles using Tarjan's SCC algorithm.
- Return violations as `(from, to, violationType, message)` tuples.

**OpenSSF Scorecard bridge:**
- Shell out to `scorecard` CLI or use REST API (`api.securityscorecards.dev`).
- Parse JSON output into per-check scores.
- Map aggregate score to `openssf_scorecard` metric.
- Flag dependencies scoring below threshold as supply chain findings.

### Phase 6: Review & Semantic (ReviewCoverage + SemanticEvaluator)

**Goal:** Review process tracking and AI-powered semantic analysis.

**Tasks:**
1. Write ReviewCoverage, SemanticEvaluator concept specs, generate handlers.
2. Build ClaudeEvaluator as SemanticEvaluator provider.
3. Implement IncludeReviewInHealth, ReportSemanticIssuesAsFindings syncs.
4. Implement CLI commands.
5. Write Conformance and ContractTest.

**Acceptance:** `clef quality review metrics` and `clef quality semantic assess` produce meaningful output.

**ClaudeEvaluator implementation:**

```typescript
// System prompt template for semantic evaluation
const systemPrompt = `You are a ${persona} code reviewer evaluating code quality.
Assess the following code against the provided intent description.
Rate 0-10 on: intent alignment, readability, error handling, naming quality.
Return JSON: { overallRating, intentAligned, readabilityScore, issues: [{ location, issueType, description, severity, suggestion }] }
Issue types: misleading-name, intent-mismatch, missing-error-handling, unnecessary-complexity, documentation-drift, hallucinated-feature.
Severities: info, minor, major, critical.`;

// Invoke Claude API with code + intent, parse structured output
// Cache results keyed by (target, contentHash, persona) to avoid redundant calls
// Apply confidence threshold: discard issues where model uncertainty > (1 - threshold)
```

### Phase 7: Aggregation & Derived Concepts (CodeHealth + 5 derived concepts)

**Goal:** Unified health scoring, derived compositions, full pipeline integration.

**Tasks:**
1. Write CodeHealth concept spec with expanded biomarker set (10 signals), generate handlers.
2. Implement GatherHealthSignals sync (reads all 7 analysis concepts).
3. Implement CleanAsYouCode, RefactoringAdvisor, AICodeGate, SupplyChainAudit, QualityDashboard derived concepts.
4. Wire quality gates as Bind-generated API endpoints.
5. Implement EvaluateQualityAfterBuild, EvaluateGeneratedCodeQuality integration syncs.
6. Implement NotifyOnQualityGateFailure sync.
7. Implement `clef quality health`, `clef quality` unified CLI commands.
8. Write full end-to-end ContractTest: code change → metric computation → rule evaluation → finding tracking → gate evaluation → deploy decision.

**Acceptance:** `clef quality` produces unified output. `clef quality health dashboard` shows project-wide overview with all 10 biomarker dimensions.

**CodeHealth biomarker default weights:**

| Biomarker | Weight | Source | Rationale |
|---|---|---|---|
| cognitive_complexity | 0.15 | Metric/query | Primary maintainability signal |
| finding_density | 0.15 | Finding/summary | Direct issue indicator |
| hotspot_risk | 0.12 | Hotspot/rank | Change-weighted complexity |
| test_coverage | 0.12 | Metric/query | Safety net quality |
| duplication | 0.08 | Metric/query | DRY violation indicator |
| change_coupling | 0.08 | ChangeCoupling/neighbors | Hidden dependency indicator |
| knowledge_concentration | 0.08 | KnowledgeMap/analyze | Bus-factor risk |
| architectural_fitness | 0.08 | ArchitecturalFitness/verifyAll | Structural integrity |
| energy_efficiency | 0.07 | EnergyProfile/query | Sustainability posture |
| supply_chain_risk | 0.07 | SupplyChainQuality/summary | Dependency risk |

### Phase 8: Four-Language Implementation

**Goal:** Generate and implement handlers in TypeScript, Rust, Swift, and Solidity for all 16 concepts.

**TypeScript (primary target, all 16 concepts):**
- Full implementation using fp-ts for functional programming patterns.
- Storage via PostgreSQL (server) or SQLite (local/offline).
- All providers implemented as TypeScript packages.
- Full CLI via Bind CLI target.
- REST + GraphQL via Bind API targets.

**Rust (all 16 concepts):**
- Trait definitions generated by RustGen.
- Storage via SQLite (rusqlite) for embedded use.
- VCS providers (git2 crate) and tree-sitter providers (tree-sitter crate) are native Rust.
- Suitable for CLI tools, embedded analysis, and high-performance metric computation.

**Swift (10 concepts — measurement, policy, analysis minus energy/supply-chain):**
- Protocol definitions generated by SwiftGen.
- Storage via Core Data or SQLite.
- Suitable for macOS developer tools and Xcode integrations.
- EnergyProfile and SupplyChainQuality providers require server-side tooling not available on Apple platforms, so these concepts ship as stubs with remote provider delegation.

**Solidity (3 concepts — Metric, Finding, QualityGate):**
- Contract interfaces generated by SolidityGen.
- On-chain quality attestation for audited smart contract codebases.
- Metric stores immutable quality measurements as on-chain attestations.
- Finding records audit findings with on-chain lifecycle.
- QualityGate enforces deployment gates via on-chain governance.
- Other concepts (VCS analysis, LLM evaluation, energy profiling) are inherently off-chain and delegate through oracle patterns.

---

## §8 Concept Count Impact

| Category | Count |
|---|---|
| **New concepts** | 16 |
| Metric | 1 |
| Rule | 1 |
| Finding | 1 |
| Baseline | 1 |
| QualityProfile | 1 |
| QualityGate | 1 |
| TechnicalDebt | 1 |
| Hotspot | 1 |
| ChangeCoupling | 1 |
| KnowledgeMap | 1 |
| ArchitecturalFitness | 1 |
| EnergyProfile | 1 |
| SupplyChainQuality | 1 |
| CodeHealth | 1 |
| ReviewCoverage | 1 |
| SemanticEvaluator | 1 |
| **New syncs** | 19 |
| Required | 7 |
| Recommended | 7 |
| Integration | 2 |
| External (to Notification, DeployPlan) | 3 |
| **Derived concepts** | 5 |
| CleanAsYouCode | 1 |
| RefactoringAdvisor | 1 |
| AICodeGate | 1 |
| SupplyChainAudit | 1 |
| QualityDashboard | 1 |
| **Provider registrations** | 9 concept types with providers |
| **Existing concept changes** | 0 (syncs only) |
| **Suites** | 4 |

**Running total impact on Clef:** 16 new concepts added to the ~145 existing concepts across 23 suites, bringing the total to ~161 concepts across 27 suites (including 4 new quality suites).

---

## §9 Design Decisions Summary

### Why 16 concepts, not 7 (Source 2) or 12 (Source 3)?

Source 2's 7 concepts are too coarse — StaticGovernance conflates measurement, policy, and tracking. Source 3's 12 concepts are well-separated but miss four dimensions that the research shows are independently meaningful and practically important: architectural fitness, semantic evaluation, energy efficiency, and supply chain quality. Each of the 4 new concepts passes the concept test, has genuinely independent state, and operates on a different substrate or at a different lifecycle stage than existing concepts.

### Why composition beats inheritance for profiles?

Source 1's research on ESLint's flat config vs. SonarQube's profile inheritance shows that flat composition (JavaScript objects spread/merged) outperforms hierarchical inheritance in flexibility. However, QualityProfile keeps inheritance because progressive adoption ("essential" → "standard" → "strict") is the primary use case, and inheritance maps to this naturally. Teams extend a base profile, not merge arbitrary profile fragments. The resolve action flattens the inheritance chain into an effective ruleset, giving composition semantics at evaluation time.

### Why CodeHealth is a concept, not a derived concept?

CodeHealth has independent state: biomarker weights, assessment history, per-target trend data, and trajectory calculations. This state is not derivable from querying other concepts at evaluation time. QualityDashboard, by contrast, is a genuine derived concept — purely read-only composition with no independent state.

### Why four suites, not five?

A fifth suite for "sustainability" (EnergyProfile + SupplyChainQuality) was considered but rejected. Both concepts change when analysis capabilities improve, which is the same rate of change as the Quality Analysis suite. The substrate difference (energy telemetry vs. source code) is handled by the provider pattern, not by suite separation.

### Why SemanticEvaluator in Review, not Analysis?

SemanticEvaluator's primary use case is augmenting the code review process — it answers "is this code semantically correct and readable?" alongside ReviewCoverage's "was this code reviewed?" Both change when review process requirements shift (new LLM capabilities, new assessment strategies). Placing it in Analysis would make the suite's rate-of-change less uniform.

---

## §10 Automated LLM Development Flow Integration

The quality kit is not a passive measurement system — it becomes the critical feedback loop that makes autonomous coding viable. The research data is stark: AI-generated code produces 1.7× more issues, code cloning has quadrupled, structural refactoring has dropped from 25% to under 10%, and LLM success rates plummet from ~89% on benchmarks to ~30% on real-world class structures. DORA 2024 found AI adoption correlates with a −7.2% decrease in delivery stability even while increasing speed. Quality validation, not generation, is the current bottleneck.

The quality kit integrates with automated LLM development across three feedback timescales.

### 10.1 Inner Loop — Agent with Quality Feedback (Seconds)

This is the agent writing code in a tight generate→evaluate→revise cycle (Claude Code, Copilot workspace, autonomous coding agents).

```
┌──────────────────────────────────────────────────────────────┐
│  LLM Agent Session                                           │
│                                                              │
│  1. Agent receives task + intent description                  │
│  2. Agent generates code                                      │
│     │                                                         │
│     ▼                                                         │
│  3. Metric/record ← tree-sitter provider                      │
│     (cognitive complexity, cyclomatic, Halstead)               │
│     │                                                         │
│     ▼                                                         │
│  4. Rule/evaluate ← ESLint/Semgrep provider                   │
│     → ReportFindingsFromEvaluation sync                       │
│     → Finding/report (source: "static")                       │
│     │                                                         │
│     ▼                                                         │
│  5. ArchitecturalFitness/verify                               │
│     (Did the agent bypass interfaces? Circular deps?)         │
│     → ReportArchitecturalViolationsAsFindings sync             │
│     │                                                         │
│     ▼                                                         │
│  6. SemanticEvaluator/assess                                  │
│     (Does the code match the intent description?)             │
│     → ReportSemanticIssuesAsFindings sync                     │
│     │                                                         │
│     ▼                                                         │
│  7. Finding/query(statuses: ["open"])                         │
│     │                                                         │
│     ├── No findings → proceed to commit                       │
│     └── Findings exist → feed back to agent as context        │
│         │                                                     │
│         ▼                                                     │
│  8. Agent revises code with finding details                   │
│     (loop back to step 3, max N iterations)                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Step 6 (SemanticEvaluator) is critical for catching "Implementation Laziness" — the research shows LLMs under Hexagonal Architecture constraints frequently bypass interface adapters and create illegal dependencies to save tokens. ArchitecturalFitness catches the structural violation, but SemanticEvaluator catches the subtler problem: the agent claims it implemented the feature but actually hallucinated or omitted complex business logic to satisfy output length constraints.

The agent receives findings as structured data, not prose:

```
3 findings on generated/order-service.ts:
  [critical] arch-fitness:no-circular-deps — order-service.ts -> payment-adapter.ts
    creates circular dependency (domain layer importing infrastructure)
  [major] semantic:intent-mismatch — Refund handling described in intent spec
    but no refund logic implemented (lines 45-80 contain only happy path)
  [major] max-cognitive-complexity — processOrder() complexity 28 exceeds 15
```

The composability matters here. The inner loop does not need the full 16-concept pipeline. It uses Metric + Rule + Finding for fast feedback, adds ArchitecturalFitness and SemanticEvaluator when the agent is doing architectural work, and omits Hotspot/ChangeCoupling/KnowledgeMap/EnergyProfile/SupplyChainQuality (which require VCS history or production telemetry not available in a single-session context). Each concept is independently deployable, and the syncs wire them together progressively.

### 10.2 PR Gate — CI Pipeline with AICodeGate (Minutes)

When any PR is opened — whether by a human, Copilot, or an autonomous agent — the CI pipeline runs the full quality validation through the AICodeGate derived concept.

```
PR Opened (human or AI-authored)
  │
  ▼
EvaluateGeneratedCodeQuality sync fires
  ├── Metric/record (complexity, duplication, coverage)
  ├── CodeHealth/assess (full biomarker evaluation)
  └── SemanticEvaluator/assess (if intent description available)
  │
  ▼
QualityProfile/resolve (language-appropriate profile)
  │
  ▼
EvaluateProfileRules sync fires
  → Rule/evaluate for each effective rule
  → ReportFindingsFromEvaluation sync
  → Finding/report for each violation
  │
  ▼
ArchitecturalFitness/verifyAll
  → ReportArchitecturalViolationsAsFindings sync
  │
  ▼
SupplyChainQuality/scan (if dependencies changed)
  → ReportSupplyChainRisksAsFindings sync
  │
  ▼
QualityGate/evaluate(gate: "pr-check", baseline: "main")
  │
  ├── passed → PR decoration: "Quality gate passed ✓"
  │           Merge allowed
  │
  └── failed → PR decoration with per-condition detail
              BlockDeployOnQualityGateFailure sync
              │
              ├── If AI-authored: Feed findings back to agent
              │   for automatic remediation attempt
              │
              └── If human-authored: Standard review workflow
                  NotifyOnQualityGateFailure → Notification/send
```

The gate evaluates new code only (via Baseline) and distinguishes AI-authored from human-authored code through the `source` field on Finding. Following SonarQube 2025.1's approach of auto-detecting Copilot-generated code with stricter quality gates, the quality kit makes this a first-class pattern. Different gate configurations for different authorship contexts:

```yaml
# Standard human code gate
gate: pr-check
conditions:
  - conditionId: no-new-blockers
    findingQuery: { severities: [blocker], statuses: [open] }
    operator: eq
    threshold: 0
    onNewCodeOnly: true
  - conditionId: coverage
    metricName: test_coverage
    operator: gte
    threshold: 80
    onNewCodeOnly: false

# Stricter gate for AI-generated code
gate: ai-code-gate
conditions:
  - conditionId: no-new-critical
    findingQuery: { severities: [critical, blocker], statuses: [open] }
    operator: eq
    threshold: 0
    onNewCodeOnly: true
  - conditionId: coverage
    metricName: test_coverage
    operator: gte
    threshold: 90
    onNewCodeOnly: true
  - conditionId: no-semantic-issues
    findingQuery: { severities: [major, critical], statuses: [open] }
    operator: eq
    threshold: 0
    onNewCodeOnly: true
  - conditionId: architectural-fitness
    metricName: architectural_fitness_pass_rate
    operator: eq
    threshold: 100
    onNewCodeOnly: true
```

### 10.3 Outer Loop — Continuous Quality Intelligence (Days/Weeks)

The strategic layer tracks trends across hundreds or thousands of agent-generated changes and surfaces patterns that no individual PR gate would catch.

```
Weekly/Sprint Quality Intelligence
  │
  ├── CodeHealth/dashboard()
  │   "Project health: 6.4 [C], declining ↓ since AI adoption"
  │   "Limiting factor: duplication (4× increase in cloned blocks)"
  │
  ├── Hotspot/distribution()
  │   "12 hotspots (3.8%) — 8 are AI-generated modules"
  │   "AI-generated hotspots have 2.3× higher churn than human hotspots"
  │
  ├── ChangeCoupling/clusters()
  │   "New cluster: [ai-gen/service-a.ts, ai-gen/service-b.ts, shared/types.ts]"
  │   "Suggestion: extract-shared — agents are duplicating type definitions"
  │
  ├── KnowledgeMap/risks()
  │   "14 AI-generated files have bus-factor: 0 (no human has ever modified)"
  │
  ├── Finding/summary(groupBy: "source")
  │   "Static: 42 open | Semantic: 18 open | Architectural: 7 open"
  │   "AI-authored code: 67% of findings, 35% of codebase"
  │
  ├── EnergyProfile/summary()
  │   "AI-generated endpoints use 1.8× more energy per request"
  │   "SCI score worsening: 12.3 → 15.7 gCO2eq/request over 3 months"
  │
  └── TechnicalDebt/summary()
      "AI-generated debt: 89h principal, 12.4h/mo interest"
      "Top ROI: Refactor ai-gen/data-processor.ts (break-even: 8 days)"
```

The outer loop feeds back into agent prompt engineering and system configuration. If quality intelligence shows agents consistently produce high-duplication code, you adjust the system prompt or the rule profile. If agents create modules that no human ever touches (bus-factor: 0), you flag those for mandatory human review. This is the bridge between the quality kit and organizational AI adoption strategy.

### 10.4 Feedback Timescale Summary

| Timescale | Quality Kit Role | Concepts Used | What Feeds Back |
|---|---|---|---|
| **Seconds** (inner loop) | Fast structural + semantic validation | Metric, Rule, Finding, ArchitecturalFitness, SemanticEvaluator | Structured findings → agent revises code |
| **Minutes** (PR gate) | AICodeGate derived concept + full gate pipeline | All 16 + CleanAsYouCode, AICodeGate | Pass/fail with remediation guidance → agent retries or human reviews |
| **Days/weeks** (intelligence) | Trend analysis across agent-generated changes | CodeHealth, Hotspot, ChangeCoupling, KnowledgeMap, EnergyProfile, TechnicalDebt | Prompt engineering adjustments, profile tuning, agent config changes |

---

## §11 Quality OF Clef Artifacts — Per-Artifact Analysis

The quality kit has a dual relationship with Clef's artifact ecosystem. Direction 1: the kit analyzes every Clef artifact type — .concept specs, .sync files, .derived files, .widget specs, .theme files, suite.yaml manifests, generated handlers, and the sync topology itself. This is where Clef-specific providers live.

### 11.1 Quality of .concept Specs

Quality dimensions specific to concept specs that no general-purpose code quality tool would catch:

**Concept test compliance.** Does the concept have genuinely independent state, meaningful actions with domain-specific variants, and operational principles? A "concept" that fails the concept test should be either a derived concept or pre-conceptual infrastructure.

**Independence rule violations.** Does any state field, action parameter, or invariant reference another concept's types, state, or actions? Type parameters (`[T]`, `[E]`) must be opaque identifiers. If a concept's state says `user: T -> User` where `User` is another concept's type, that is a violation.

**Action completeness.** Does every action have at least an `ok` variant and at least one error/edge variant? Are variant tags domain-specific (not generic `error`/`success`)? Are prose descriptions present and meaningful?

**State coherence.** Are state fields grouped logically? Is there state that no action reads or writes (dead state)? Are there actions that do not touch state (should be queries, not actions)?

**Invariant coverage.** Do invariants exercise key operational principles? Is there at least one invariant per action? Do invariants test interesting edge cases, not just the happy path?

**Naming quality.** Does the concept name follow conventions? Are action names verbs? Are state field names nouns? Is the purpose statement a single clear sentence?

Clef-specific rules registered with Rule/define:

```
concept-test-compliance     [blocker]  architecture
  "Concept must have independent state, meaningful actions, and operational principles"

independence-violation      [blocker]  architecture
  "Concept must not reference another concept's state, types, or actions"

action-completeness         [major]    completeness
  "Every action must have ok + at least one error variant with prose"

dead-state                  [minor]    maintainability
  "State field not read or written by any action"

invariant-coverage          [major]    coverage
  "Every action should be exercised by at least one invariant"

purpose-clarity             [minor]    documentation
  "Purpose section should be a single clear sentence about why this concept exists"
```

**Provider:** ClefConceptSpecAnalyzer — parses .concept files using SpecParser (framework suite), walks ConceptAST, evaluates each rule. Registers with PluginRegistry under `quality.rule.evaluate` for language `"clef-concept"`. When the Code Representation suites (in-progress) are available, this provider reads ConceptEntity, ActionEntity, and StateField from the Semantic suite instead of re-parsing, gaining access to cross-file analysis (e.g., detecting independence violations that span multiple concept specs).

### 11.2 Quality of .sync Files

Sync quality concerns the topology, not just individual files:

**Dangling references.** Does the sync's `when` clause reference a concept/action that exists? Does the `then` clause? Are all `?variables` bound before use?

**Sync completeness.** If Concept A's action produces a completion that Concept B needs, is there a sync wiring them? This is the "missing sync" problem — two concepts that should be coordinated but are not.

**Circularity.** Does the sync topology contain cycles? A→B→C→A means an action completion triggers a chain that eventually re-triggers the original action. Some cycles are intentional (retry patterns with guards), but unintentional cycles cause infinite loops.

**Fan-out.** How many `then` actions does a single sync trigger? High fan-out syncs are fragile — a failure in any downstream action affects the whole chain.

**Tier appropriateness.** Is the sync marked `[eager]` when it should be `[eventual]`? Eager syncs block the action; eventual syncs are deferred. Heavy computation or external API calls in eager syncs cause latency.

**Orphaned syncs.** Syncs that reference concepts not loaded in any suite configuration.

These map to ArchitecturalFitness for topology checks and Rule for per-file checks:

```
# Fitness functions for sync topology
no-sync-cycles              [circularity]
  "Detect unintentional cycles in the sync dispatch graph"

sync-fan-out-limit          [coupling]
  "No sync should trigger more than 5 downstream actions"

# Rules for individual sync files
dangling-sync-reference     [blocker]  architecture
  "Sync references concept or action that does not exist"

unbound-variable            [blocker]  correctness
  "Variable used in then/where clause without binding in when clause"

eager-with-external-call    [major]    performance
  "Eager sync triggers action that invokes external provider"

orphaned-sync               [minor]    maintainability
  "Sync references concepts not loaded in any suite configuration"
```

**Provider:** ClefSyncTopologyAnalyzer — builds the sync dispatch graph from SyncEntity nodes (Semantic suite, in-progress) and runs topological analysis. Registers under `quality.fitness.verify`. Uses DependenceGraph (Analysis suite, in-progress) as the underlying graph infrastructure — the sync topology *is* a dependence graph where syncs are edges and concept actions are nodes.

### 11.3 Quality of .derived Files

Derived concepts deliberately fail the concept test, so they have different quality concerns:

**Composition validity.** Do all `composes` entries reference existing concepts or derived concepts? Is the composition graph a DAG (no circular derived-of-derived)?

**Surface coverage.** Does every composed concept have at least one surface action or surface query exposing it? A composed concept with no surface entry point is dead weight in the derivation.

**Sync claim correctness.** Do the `syncs.required` entries reference syncs that actually wire the composed concepts together? Does the derived concept claim syncs it should not own?

**Principle testability.** Is the operational principle specific enough to generate a ContractTest? Vague principles like "provides quality information" are not testable.

```
composition-dag-violation   [blocker]  architecture
  "Derived concept composition graph must be a DAG"

dead-composition            [major]    maintainability
  "Composed concept has no surface action or query exposing it"

unclaimed-sync              [major]    completeness
  "Required sync references sync not defined or not wiring composed concepts"

untestable-principle        [minor]    coverage
  "Operational principle too vague to generate ContractTest"
```

**Provider:** ClefDerivedSpecAnalyzer — parses .derived files, validates composition graph, checks surface entries against composed concepts, and evaluates principle specificity. Registers under `quality.rule.evaluate` for language `"clef-derived"`.

### 11.4 Quality of .widget Specs (Clef Surface)

Widget specs have quality dimensions tied to the COIF v0.4.0 architecture:

**Interactor classification completeness.** Does every widget declare which Interactor types it handles? A widget with no Affordance declarations cannot be matched by WidgetResolver.

**Accessibility coverage.** Does the widget spec include ARIA attributes, keyboard navigation, and screen reader annotations? Maps to ISO 25010 "Interaction Capability → Inclusivity" and the "Responsible" Clean Code attribute.

**State machine validity.** If the widget uses Machine (surface-component), is the state machine well-formed? No unreachable states, no dead-end states, all transitions labeled.

**Slot contract satisfaction.** Do parent widgets satisfy Slot contracts of children? A layout widget declaring a Slot expecting a "navigation" interactor but receiving a "data-display" interactor is a contract violation.

```
missing-affordance          [major]    completeness
  "Widget declares no Affordance — cannot be matched by WidgetResolver"

a11y-missing-aria           [major]    accessibility
  "Widget missing ARIA attribute declarations"

a11y-missing-keyboard       [major]    accessibility
  "Widget missing keyboard navigation specification"

unreachable-machine-state   [minor]    correctness
  "State machine contains states with no incoming transitions"

slot-contract-violation     [critical] architecture
  "Parent widget provides interactor type not accepted by child Slot"
```

**Provider:** ClefWidgetSpecAnalyzer — reads WidgetParser output (surface-spec suite), evaluates quality rules against widget ASTs. Registers under `quality.rule.evaluate` for language `"clef-widget"`.

### 11.5 Quality of .theme Files

**Token completeness.** Does the theme define all required DesignToken values? Missing tokens cause runtime fallbacks that break visual consistency.

**WCAG compliance.** Do color combinations meet contrast ratios? Does the typography scale maintain readability? Checkable statically from the theme definition.

**Inheritance chain integrity.** Does the StructuralMotif scope-aware resolution (from the ui-theme kit v1.0) produce valid values at every scope level? The five-step inheritance chain should never produce `undefined`.

```
missing-design-token        [major]    completeness
  "Theme missing required DesignToken value"

wcag-contrast-failure       [critical] accessibility
  "Color combination fails WCAG AA contrast ratio (4.5:1 for normal text)"

theme-inheritance-gap       [major]    correctness
  "StructuralMotif resolution produces undefined at scope level"
```

**Provider:** ClefThemeAnalyzer — reads ThemeParser output (surface-spec suite). Registers under `quality.rule.evaluate` for language `"clef-theme"`.

### 11.6 Quality of suite.yaml Manifests

**Dependency completeness.** Do `uses` declarations cover all concepts referenced in syncs? Missing `uses` entries cause runtime resolution failures.

**Param mapping consistency.** Are type parameter mappings consistent across suites? If Suite A maps `T` to `ContentNodeRef` and Suite B maps `T` to `ArticleRef`, syncs bridging them need explicit mapping.

**Version compatibility.** Are concept `@version` annotations consistent with suite semver? A concept version bump without a suite minor version bump is a compatibility risk.

```
missing-uses-declaration    [blocker]  architecture
  "Sync references concept from suite not declared in uses"

param-mapping-mismatch      [major]    correctness
  "Type parameter mapped to different concrete types across suites"

version-sync-mismatch       [major]    compatibility
  "Concept @version bumped without suite minor version bump"
```

**Provider:** ClefSuiteManifestAnalyzer — parses suite.yaml, cross-references with concept specs and sync files. Registers under `quality.rule.evaluate` for language `"clef-suite"`.

### 11.7 Quality of schema.yaml and composition.yaml

**Schema completeness.** Does the schema.yaml define all fields referenced by concept state? Are field types valid?

**Thing-schema vs. mixin-schema compliance.** Does the schema follow the thing/mixin pattern correctly? Do `includes` chains resolve without cycles?

**Composition validity.** Does composition.yaml correctly compose mixins into thing schemas? Are all required fields satisfied?

```
schema-field-type-invalid   [blocker]  correctness
  "Schema field references undefined type"

includes-cycle              [blocker]  architecture
  "Schema includes chain contains a cycle"

composition-incomplete      [major]    completeness
  "Composition does not satisfy all required fields from included mixins"
```

**Provider:** ClefSchemaAnalyzer — parses schema.yaml and composition.yaml, validates against the thing/mixin pattern. Registers under `quality.rule.evaluate` for language `"clef-schema"`.

### 11.8 Quality of .interface.yaml

**Projection completeness.** Does the interface manifest include all concepts that should be exposed? Are auth, pagination, and rate limit annotations present where needed?

**Target compatibility.** Are projected concepts compatible with all declared targets (REST, GraphQL, CLI, MCP)? Some action signatures may not map cleanly to all targets.

```
missing-projection          [minor]    completeness
  "Concept has public actions but no interface projection"

target-incompatibility      [major]    compatibility
  "Action signature incompatible with declared target"
```

**Provider:** ClefInterfaceManifestAnalyzer — parses .interface.yaml, cross-references with Bind's Projection and ApiSurface concepts. Registers under `quality.rule.evaluate` for language `"clef-interface"`.

### 11.9 Quality of Generated Code

When TypeScriptGen, RustGen, SwiftGen, or SolidityGen emit code through Emitter, the quality kit evaluates the output via the EvaluateGeneratedCodeQuality sync. The `sourceIntentFor()` helper resolves intent descriptions by tracing from generated file paths back through the Generation suite's KindSystem/Resource to find the source .concept spec, then extracts the purpose statement and action prose.

Language-specific quality rules:

**TypeScript generated handlers:**
```
fp-ts-correctness           [major]    correctness
  "Either/Option types used properly — no raw null/undefined in typed paths"

handler-variant-completeness [critical] completeness
  "Every declared action variant has a handler code path"

generated-import-hygiene    [major]    architecture
  "No circular imports between generated concept modules"

type-param-opacity          [blocker]  architecture
  "Type parameters are string on the wire, not leaked as concrete types"
```

**Rust generated handlers:**
```
trait-completeness          [critical] completeness
  "Every action variant mapped to a match arm in trait impl"

ownership-correctness       [major]    performance
  "No unnecessary clones in generated code paths"

error-type-alignment        [major]    correctness
  "Variant tags map to Rust enum variants without lossy conversion"
```

**Swift generated handlers:**
```
protocol-conformance        [critical] completeness
  "Every action declared in protocol has an implementation"

sendable-compliance         [major]    concurrency
  "Types used in concurrent contexts conform to Sendable"
```

**Solidity generated contracts:**
```
gas-efficiency              [major]    performance
  "No unnecessary storage writes in generated event handlers"

reentrancy-safety           [critical] security
  "Generated functions follow checks-effects-interactions pattern"
```

### 11.10 Complete Artifact → Quality Concept Map

```
Clef Artifact          Quality Concepts That Analyze It
─────────────          ─────────────────────────────────

.concept spec    ──→   Rule (concept-test, independence, action-completeness,
                       dead-state, naming, purpose-clarity)
                       Metric (invariant-coverage ratio, action-variant count,
                       state-field count)
                       ArchitecturalFitness (independence rule enforcement)
                       SemanticEvaluator (purpose clarity, prose quality)

.sync file       ──→   Rule (dangling-reference, variable-binding, tier-
                       appropriateness, orphaned-sync)
                       ArchitecturalFitness (sync-cycle detection, fan-out
                       limits, sync topology validation)
                       Metric (sync-chain-depth, fan-out count)

.derived file    ──→   Rule (composition-validity, surface-coverage,
                       sync-claim-correctness, principle-testability)
                       ArchitecturalFitness (DAG validation, no circular
                       derived-of-derived)

.widget spec     ──→   Rule (interactor-classification, a11y-coverage,
                       slot-contract-satisfaction)
                       Metric (a11y-coverage ratio, state-machine complexity)
                       ArchitecturalFitness (widget→interactor→affordance
                       pipeline completeness)

.theme file      ──→   Rule (token-completeness, wcag-contrast,
                       inheritance-chain-integrity)
                       Metric (token-coverage ratio, wcag-compliance-score)

suite.yaml       ──→   Rule (dependency-completeness, param-mapping-consistency,
                       version-compatibility)
                       ArchitecturalFitness (suite dependency graph,
                       no circular suite dependencies)

schema.yaml      ──→   Rule (schema-completeness, field-type-validity,
                       includes-cycle-detection)
                       ArchitecturalFitness (thing-schema vs mixin-schema
                       pattern compliance)

composition.yaml ──→   Rule (composition-completeness, mixin-resolution-validity)

.interface.yaml  ──→   Rule (projection-completeness, target-compatibility)
                       ArchitecturalFitness (API surface consistency across
                       REST/GraphQL/CLI/MCP targets)

Generated TS     ──→   Metric (complexity, duplication, coverage)
                       Rule (fp-ts-correctness, handler-completeness,
                       import-hygiene, type-param-opacity)
                       SemanticEvaluator (does handler match spec intent?)
                       Hotspot (generated file churn after regeneration)

Generated Rust   ──→   Metric (complexity, duplication)
                       Rule (trait-completeness, ownership-correctness,
                       error-type-alignment)
                       SemanticEvaluator (does handler match spec intent?)

Generated Swift  ──→   Metric (complexity)
                       Rule (protocol-conformance, sendable-compliance)
                       SemanticEvaluator (does handler match spec intent?)

Generated Sol    ──→   Metric (complexity)
                       Rule (gas-efficiency, reentrancy-safety)
                       ArchitecturalFitness (contract interaction graph,
                       no cross-contract storage access)
```

### 11.11 Clef-Specific Provider Summary

| Provider | Registers As | Analyzes | Reads From |
|---|---|---|---|
| ClefConceptSpecAnalyzer | `quality.rule.evaluate` (clef-concept) | .concept files | SpecParser → ConceptAST, or ConceptEntity (Semantic suite) |
| ClefSyncTopologyAnalyzer | `quality.fitness.verify` | .sync files + topology | SyncParser → SyncAST, or SyncEntity (Semantic suite), DependenceGraph (Analysis suite) |
| ClefDerivedSpecAnalyzer | `quality.rule.evaluate` (clef-derived) | .derived files | DerivedSpec parser, composition graph builder |
| ClefWidgetSpecAnalyzer | `quality.rule.evaluate` (clef-widget) | .widget files | WidgetParser (surface-spec suite) |
| ClefThemeAnalyzer | `quality.rule.evaluate` (clef-theme) | .theme files | ThemeParser (surface-spec suite) |
| ClefSuiteManifestAnalyzer | `quality.rule.evaluate` (clef-suite) | suite.yaml files | YAML parser, cross-reference with concept/sync specs |
| ClefSchemaAnalyzer | `quality.rule.evaluate` (clef-schema) | schema.yaml, composition.yaml | YAML parser, includes-chain resolver |
| ClefInterfaceManifestAnalyzer | `quality.rule.evaluate` (clef-interface) | .interface.yaml | YAML parser, cross-reference with Bind Projection/ApiSurface |

---

## §12 Quality THROUGH Existing Clef Infrastructure

Direction 2: the quality kit uses existing Clef concepts to do its work. Every dependency here is via syncs — the quality kit's concepts remain independent per the Clef architecture rules.

### 12.1 Infrastructure Suite Dependencies

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **PluginRegistry** | All 9 provider-backed quality concepts register providers here. Provider resolution for language-specific analyzers, VCS parsers, LLM evaluators, energy meters, supply chain scanners. New capability namespaces: `quality.metric.compute`, `quality.rule.evaluate`, `quality.vcs.parse`, `quality.fitness.verify`, `quality.semantic.evaluate`, `quality.energy.measure`, `quality.supply-chain.scan`. |
| **Validator** | Not used by quality kit directly. Scope boundary: Validator checks runtime data on CRUD/form operations. Quality kit checks source code during development/CI. DataQuality checks pipeline data during ETL. No overlap — different substrates, different lifecycle stages. |
| **Cache** | Quality evaluation results can be cached via Cache/set with TTL. Avoids re-running expensive SemanticEvaluator/assess calls on unchanged code. Cache key = `(target, contentHash, persona)`. |
| **EventBus** | Quality kit does not use EventBus directly. Quality events flow through syncs, not pub/sub. However, applications built with the quality kit may use EventBus for dynamic subscriber management — e.g., a custom dashboard subscribing to quality events at runtime. |

### 12.2 Generation Suite Dependencies

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **Emitter** | EvaluateGeneratedCodeQuality sync triggers on `Emitter/writeBatch` to analyze freshly generated code. This is how the quality kit is used *by* Clef — every time TypeScriptGen/RustGen/SwiftGen/SolidityGen emit code, quality analysis runs automatically. |
| **Resource** | Quality kit tracks .concept/.sync/.widget/.theme files as Resources for change detection. When a spec file changes, quality re-evaluates. Content hashing via Resource/upsert enables incremental analysis — only re-evaluate changed files. |
| **KindSystem** | Quality providers register as generation "kinds" so BuildCache can cache quality results and skip re-analysis on unchanged inputs. Quality evaluation is treated as a generation step that produces quality artifacts (finding reports, metric snapshots) from source inputs. |
| **BuildCache** | Quality evaluations are cached by input content hash. If a .concept file has not changed since last evaluation, BuildCache/check returns a cache hit and evaluation is skipped. This makes quality analysis incremental even for large projects. |
| **GenerationPlan** | Quality evaluation phases are recorded as steps in GenerationPlan, providing unified reporting of "what happened during this build" including both code generation and quality analysis. |

### 12.3 Deploy Suite Dependencies

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **DeployPlan** | `BlockDeployOnQualityGateFailure` sync prevents deployment when quality gates fail. Uses the same `DeployPlan/gate` action as the test kit's gate syncs — the deployment DAG has a quality gate node that must pass before execution proceeds. |
| **Builder** | `EvaluateQualityAfterBuild` sync triggers quality analysis on freshly built artifacts. When `Builder/build` completes for a concept, the sync resolves the appropriate QualityProfile and runs analysis on the source files. |
| **Health** | Quality kit does not extend or duplicate Health (deploy suite). Deploy Health checks runtime health of deployed services. CodeHealth checks development-time quality of source code. Different substrates, different lifecycles. |

### 12.4 Notification Suite Dependency

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **Notification** | `NotifyOnQualityGateFailure` sync sends alerts through configured channels when quality gates fail. Uses existing `Notification/send` action — no new notification concepts needed. Channel routing (Slack, email, webhook) is handled by Notification's existing provider system. |

### 12.5 Interface Suite (Bind) Dependencies

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **Projection** | All 16 quality concepts are projected through Bind for multi-target interface generation. Quality-specific annotations include pagination for Finding/query (potentially large result sets) and rate limits for SemanticEvaluator/assess (LLM API calls). |
| **Generator / Target** | `clef quality` CLI is Bind-generated from quality concept specs targeting the CLI target. REST endpoints for CI integration are generated from the REST target. GraphQL queries for dashboard UIs are generated from the GraphQL target. MCP tools for AI agent integration are generated from the MCP target. |
| **Grouping** | Quality concepts are grouped by suite for API organization: `/api/quality/measurement/metrics`, `/api/quality/policy/gates`, `/api/quality/analysis/hotspots`, `/api/quality/review/coverage`. Derived concepts become their own groups: `/api/quality/ai-code-gate/validate`. |

### 12.6 Test Suite Dependencies

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **Conformance** | Quality concepts themselves are tested via Conformance — verifying that each concept's implementation matches its spec contract. The quality kit tests itself using the same test infrastructure it helps other concepts use. |
| **ContractTest** | Cross-concept quality sync chains are tested via ContractTest. Key chains tested: Rule→Finding (ReportFindingsFromEvaluation), Finding→TechnicalDebt (AssessDebtForNewFindings + RetireDebtOnFindingResolution), QualityGate→DeployPlan (BlockDeployOnQualityGateFailure), CodeHealth→all signals (GatherHealthSignals). |

### 12.7 Code Representation Suite Dependencies (In-Progress)

These dependencies activate when the Code Representation suites ship:

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **SyntaxTree** (Parse suite) | Tree-sitter CSTs for generated code are available through SyntaxTree. Quality metric providers read these instead of re-parsing — avoiding duplicate tree-sitter invocations when both the quality kit and the parse suite analyze the same file. |
| **StructuralPattern** (Parse suite) | Quality rules that check code patterns (e.g., "no direct database access in handlers") use StructuralPattern with ast-grep/Comby/Regex providers. This replaces hand-written AST walkers in quality rule providers with declarative pattern definitions. |
| **ConceptEntity** (Semantic suite) | ClefConceptSpecAnalyzer provider reads parsed concept entities for deep analysis. ConceptEntity links parsed concept to generated artifacts and runtime behavior, enabling quality checks that span the full concept lifecycle. |
| **ActionEntity** (Semantic suite) | Quality kit traces action from spec → sync → implementation → interface for completeness checking. If an action is declared in a .concept spec but has no sync wiring, no handler implementation, and no interface projection, that is a quality finding. |
| **StateField** (Semantic suite) | Quality kit checks for dead state (declared but never read/written), type consistency across generation targets, and storage adapter coverage. |
| **SyncEntity** (Semantic suite) | ClefSyncTopologyAnalyzer reads compiled sync entities for topology analysis. SyncEntity provides the parsed-and-compiled sync rule as a queryable node, which is richer than raw SyncAST. |
| **DependenceGraph** (Analysis suite) | Sync topology analysis, concept dependency analysis, and import graph analysis all query DependenceGraph. The quality kit's ArchitecturalFitness providers build typed Graph instances (Clef concept graph, sync dispatch graph, generated import graph) and query them through DependenceGraph. |
| **DataFlowPath** (Analysis suite) | Quality rules checking for data flow violations — e.g., sensitive data flowing from a concept state field through a sync into a public API response without sanitization — use DataFlowPath for taint tracking. |
| **AnalysisRule** (Analysis suite) | Clef-specific quality rules can be expressed as AnalysisRule definitions for custom declarative queries. This is the bridge between the quality kit's Rule concept and the Code Representation suite's analysis infrastructure — complex quality checks that require graph queries are defined as AnalysisRules and their results flow into Rule/evaluate→Finding/report. |
| **SemanticEmbedding** (Discovery suite) | SemanticEvaluator can use SemanticEmbedding for CodeBERTScore-based similarity scoring as an alternative to full LLM evaluation. Embedding-based assessment is faster and cheaper for large-scale batch evaluation, with LLM-based assessment reserved for high-risk targets. |

### 12.8 Versioning Suite Dependencies (In-Progress)

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **ContentHash** (Versioning suite) | Quality baselines reference content-addressed versions rather than mutable file paths. `Baseline/capture` stores ContentHash references for reproducibility — a baseline captured at a specific ContentHash can be compared against regardless of subsequent file moves or renames. |
| **ChangeStream** (Versioning suite) | Hotspot and ChangeCoupling can subscribe to ChangeStream instead of parsing raw `git log`, receiving structured change events with proper typing. This is the preferred approach when the Versioning suite is loaded — the git log parser provider is the fallback for projects not using Clef's versioning infrastructure. |
| **TemporalVersion** (Versioning suite) | Quality baselines can reference TemporalVersion's bitemporal coordinates (system time + valid time) for compliance-grade quality audit trails. Relevant for regulated environments where "what was the quality state at time X as known at time Y?" is a required query. |
| **Patch** (Versioning suite) | Baseline/compare can use Patch for fine-grained delta computation — instead of comparing full metric snapshots, compare only the patches that produced the delta. This enables precise attribution: "this specific change introduced these specific quality regressions." |

### 12.9 Collaboration Suite Dependencies (In-Progress)

| Existing Concept | How Quality Kit Uses It |
|---|---|
| **Attribution** (Collaboration suite) | KnowledgeMap can use Attribution for content-region authorship instead of file-level git blame. This enables function-level and block-level bus factor analysis — knowing that Alice wrote the error handling in `processOrder()` while Bob wrote the happy path, not just that both contributed to the file. |

---

## §13 Recursive Self-Application

The quality kit analyzes Clef artifacts at three levels, and because the quality kit itself is implemented as Clef concepts, it analyzes *itself* at all three levels.

### 13.1 Level 1 — Spec Quality (Design Time)

The 16 quality concept .concept specs, 19 .sync files, 5 .derived files, and 4 suite.yaml manifests are analyzed by the Clef-specific providers (ClefConceptSpecAnalyzer, ClefSyncTopologyAnalyzer, etc.) before any code is generated. This catches design-level issues:

- Does TechnicalDebt's state have dead fields? (dead-state rule)
- Does the sync topology between QualityGate→DeployPlan→Notification contain unintentional cycles? (no-sync-cycles fitness function)
- Does the AICodeGate derived concept's composition graph form a valid DAG? (composition-dag-violation rule)
- Do all 4 suite.yaml files declare `uses` for every concept referenced in their syncs? (missing-uses-declaration rule)

### 13.2 Level 2 — Generated Code Quality (Build Time)

When TypeScriptGen/RustGen generate handlers for the quality concepts, the EvaluateGeneratedCodeQuality sync fires:

- Are the generated Metric handler's TypeScript types correct? (fp-ts-correctness rule)
- Does the generated Finding handler cover all 6 lifecycle actions × all variants? (handler-variant-completeness rule)
- Do the generated QualityGate handler imports avoid circular dependencies? (generated-import-hygiene rule)
- Does the generated SemanticEvaluator handler match the .concept spec's declared intent? (SemanticEvaluator/assess — the evaluator evaluating its own handler)

### 13.3 Level 3 — Runtime Quality (Operational Time)

As the quality kit is used in production Clef projects:

- Which quality concept handlers are hotspots (high complexity × high churn)? (Hotspot/analyze)
- Do any quality sync chains have hidden temporal coupling? (ChangeCoupling/analyze)
- Who on the team understands the CodeHealth aggregation algorithm? (KnowledgeMap/experts)
- What is the energy cost of running SemanticEvaluator/assess across 500 files? (EnergyProfile/measure)

### 13.4 Implications

This recursive self-application means:

1. **The quality kit is a forcing function on its own design quality.** When you add a new concept, the kit validates the spec before generation and the generated code after generation. Mistakes in concept design surface immediately.

2. **Dogfooding is structural, not cultural.** The quality kit does not rely on developers choosing to run it against itself — the EvaluateGeneratedCodeQuality sync fires automatically on every Emitter/writeBatch. Self-analysis is a sync-level guarantee, not a process-level aspiration.

3. **The quality kit's quality is measurable.** You can run `clef quality health assess --targets suites/quality-measurement/ suites/quality-policy/ suites/quality-analysis/ suites/quality-review/` and get a health score for the quality kit itself, with per-biomarker transparency showing which dimensions are strong and which are limiting.

4. **Evolution is tracked.** Baselines capture quality snapshots of the quality kit at each release. `clef quality baseline compare --name quality-kit-v1.0.0` shows whether the kit's own quality is improving, stable, or declining — exactly the workflow it provides for application code.

---

## §14 Updated Implementation Plan

The original 8-phase plan from §7 is extended with provider implementation for Clef-specific analyzers and integration with in-progress suites.

### Phase 1–7: Unchanged from §7

All tasks, acceptance criteria, and provider implementation details from the original plan remain. See §7.

### Phase 8: Four-Language Implementation — Extended

**TypeScript (all 16 concepts + all 8 Clef-specific providers):**
- Full implementation using fp-ts for functional programming patterns.
- Storage via PostgreSQL (server) or SQLite (local/offline).
- All 8 Clef-specific providers implemented as TypeScript packages.
- All general-purpose providers (tree-sitter, ESLint, git log parser) as TypeScript packages.
- Full CLI via Bind CLI target.
- REST + GraphQL + MCP via Bind API targets.

**Rust (all 16 concepts + 4 Clef-specific providers):**
- Trait definitions generated by RustGen.
- Storage via SQLite (rusqlite) for embedded use.
- ClefConceptSpecAnalyzer, ClefSyncTopologyAnalyzer, ClefSchemaAnalyzer, ClefSuiteManifestAnalyzer implemented in Rust (these parse text formats where Rust performance is advantageous).
- VCS providers native via git2 crate. Tree-sitter providers native via tree-sitter crate.
- Suitable for CLI tools, embedded analysis, high-performance metric computation.

**Swift (10 concepts + 2 Clef-specific providers):**
- Protocol definitions generated by SwiftGen.
- Storage via Core Data or SQLite.
- ClefConceptSpecAnalyzer and ClefWidgetSpecAnalyzer in Swift for Xcode integration.
- EnergyProfile and SupplyChainQuality ship as stubs with remote provider delegation.

**Solidity (3 concepts, no Clef-specific providers):**
- Contract interfaces for Metric, Finding, QualityGate.
- On-chain quality attestation for audited smart contract codebases.
- All Clef-specific analysis is inherently off-chain.

### Phase 9: Clef-Specific Providers *(NEW)*

**Goal:** Implement all 8 Clef-specific providers for self-analysis.

**Tasks:**
1. Implement ClefConceptSpecAnalyzer — parse .concept files, evaluate concept-test/independence/completeness/naming rules.
2. Implement ClefSyncTopologyAnalyzer — build sync dispatch graph, check cycles/fan-out/dangling references.
3. Implement ClefDerivedSpecAnalyzer — validate composition DAG, surface coverage, sync claims.
4. Implement ClefWidgetSpecAnalyzer — check interactor classification, a11y coverage, slot contracts.
5. Implement ClefThemeAnalyzer — check token completeness, WCAG contrast, inheritance chain.
6. Implement ClefSuiteManifestAnalyzer — validate uses declarations, param mappings, version compatibility.
7. Implement ClefSchemaAnalyzer — validate field types, includes chains, thing/mixin pattern.
8. Implement ClefInterfaceManifestAnalyzer — check projection completeness, target compatibility.
9. Register all 8 providers with PluginRegistry.
10. Create "clef-internal" QualityProfile containing all Clef-specific rules.
11. Create "clef-release" QualityGate with conditions for concept-test compliance, no independence violations, invariant coverage > 80%.
12. Write ContractTest: .concept spec change → quality analysis → findings tracked → gate evaluated.

**Acceptance:** `clef quality gate evaluate --gate clef-release` runs against the quality kit's own specs and passes.

### Phase 10: In-Progress Suite Integration *(NEW)*

**Goal:** Wire quality kit to Code Representation and Versioning suites when they ship.

**Tasks:**
1. Replace raw SpecParser calls in ClefConceptSpecAnalyzer with ConceptEntity/ActionEntity/StateField reads from Semantic suite.
2. Replace raw SyncParser calls in ClefSyncTopologyAnalyzer with SyncEntity/DependenceGraph reads from Analysis suite.
3. Add StructuralPattern-based quality rules replacing hand-written AST walkers.
4. Wire Hotspot/ChangeCoupling to ChangeStream (Versioning suite) as preferred data source, keeping git log parser as fallback.
5. Wire Baseline/capture to ContentHash (Versioning suite) for content-addressed baseline references.
6. Add DataFlowPath-based quality rules for taint tracking across sync chains.
7. Wire KnowledgeMap to Attribution (Collaboration suite) for function-level authorship analysis.
8. Add SemanticEmbedding-based scoring as fast-path provider for SemanticEvaluator.
9. Write integration tests for all new wiring.

**Acceptance:** Quality analysis produces richer results when Code Representation suites are loaded, and gracefully degrades to standalone providers when they are not.

---

## §15 Final Inventory

| Category | Count | Items |
|---|---|---|
| **Concepts** | 16 | Metric, Rule, Finding, Baseline, QualityProfile, QualityGate, TechnicalDebt, Hotspot, ChangeCoupling, KnowledgeMap, ArchitecturalFitness, EnergyProfile, SupplyChainQuality, CodeHealth, ReviewCoverage, SemanticEvaluator |
| **Suites** | 4 | quality-measurement, quality-policy, quality-analysis, quality-review |
| **Syncs** | 19 | 7 required, 7 recommended, 2 integration, 3 external |
| **Derived concepts** | 5 | CleanAsYouCode, RefactoringAdvisor, AICodeGate, SupplyChainAudit, QualityDashboard |
| **General providers** | 9 types | tree-sitter, ESLint/Semgrep, git log parser, ArchUnit/NetArchTest bridges, Claude/GPT-4/CodeBERT evaluators, PowerJoular/PowerAPI/Kepler meters, OpenSSF/Snyk/Socket.dev scanners |
| **Clef-specific providers** | 8 | ClefConceptSpecAnalyzer, ClefSyncTopologyAnalyzer, ClefDerivedSpecAnalyzer, ClefWidgetSpecAnalyzer, ClefThemeAnalyzer, ClefSuiteManifestAnalyzer, ClefSchemaAnalyzer, ClefInterfaceManifestAnalyzer |
| **Clef-specific rules** | ~35 | Across 8 Clef artifact types (see §11.10) |
| **Implementation phases** | 10 | Phases 1-7 (original), Phase 8 (four-language), Phase 9 (Clef providers), Phase 10 (in-progress suite integration) |
| **Implementation languages** | 4 | TypeScript (all 16), Rust (all 16), Swift (10), Solidity (3) |
| **Existing concept changes** | 0 | Syncs only — no existing concept modifications |
