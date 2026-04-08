# Deep Research Kit — Unified Implementation Plan

**Version:** 2.1.0  
**Date:** 2026-04-07  
**Status:** Implementation-ready (revised — content-native schemas, persona/process integration, further collapses)  
**New concepts:** 3 (Claim, Citation, ResearchProject)  
**Content-native schemas:** 4 (research-source, research-report, research-plan, research-project)  
**Derived concepts:** 5 (EvidenceChain, PlanApproval, CitationVerification, ResearchNotebook, DeepResearch)  
**Existing concepts leveraged:** ~35 across 12 suites (no new implementation needed)  
**Process:** Configurable ProcessSpec (editable via workflow-editor / process-map-graph)  
**Agent:** AgentPersona content-native pages with per-step persona dispatch  
**Languages:** TypeScript primary; Rust/Swift for 3 new concepts only

### Kanban Cards (Vibe Kanban)

| Card | PRD Sections | Blocked By | Blocks | Commit |
|---|---|---|---|---|
| **MAG-529** Content-Native Schemas + Seeds | §2.4 | — | MAG-530, MAG-531, MAG-532, MAG-533 | `1831088c` |
| **MAG-530** Concept Specs + Handlers | §3, §11 | ~~MAG-529~~ | MAG-531, MAG-534, MAG-536 | `0aab8238` |
| **MAG-531** Research Syncs | §4 | ~~MAG-529~~, ~~MAG-530~~ | MAG-534, MAG-535, MAG-536, MAG-538 | `fabb9dc6` |
| **MAG-532** Research Persona Seed | §2.5.1 | ~~MAG-529~~ | MAG-533, MAG-538 | `d7292602` |
| **MAG-533** Research ProcessSpec Seed | §2.5.2, §5 | ~~MAG-529~~, ~~MAG-532~~ | MAG-538 | `bc407ee6` |
| **MAG-534** Research Widgets | §7.2, §7.4 | ~~MAG-530~~, ~~MAG-531~~ | MAG-535, MAG-538 | `53b89076` |
| **MAG-535** Views, Layouts, Pages | §7.3–7.6, §2.5.5 | ~~MAG-531~~, ~~MAG-534~~ | MAG-538 | `aaaebe4a` |
| **MAG-536** Derived Concepts | §2.3 | ~~MAG-530~~, ~~MAG-531~~ | MAG-538 | `2dc82e20` |
| **MAG-537** Search + RAG Providers | §9 | — | — | `b256bddc` |
| **MAG-538** Integration Tests | §10 | ~~MAG-531–536~~ | — | `880289de` |

---

## 1. Synthesis Rationale

Three research documents were analyzed against the existing Clef architecture (~145 concepts across 23 suites, plus ~69 LLM/process concepts across 17 suites, plus Clef Base's 31 registered kernel concepts):

1. **Deep Research Report** (academic-grounded) — proposed SourceArtifact, Snippet, Claim, Citation, MemoryEntry, Report as ContentNode-level entities with evaluation gating.
2. **Compass Artifact** (landscape survey) — proposed ~50 concept categories across query, agent, retrieval, source, memory, synthesis, quality, reasoning, output, and lifecycle domains.
3. **Integration Plan** (architecture-mapped) — proposed InvestigationSpec, KnowledgeNode, CitationGraph, MemoryTier, DataFragmentEmbed, SynthesisReport with detailed sync wiring.

### What was collapsed and why

| Proposed concept | Disposition | Justification |
|---|---|---|
| **InvestigationSpec** (Integration Plan) | **Collapsed → seed ProcessSpec** | InvestigationSpec "extends ProcessSpec" — this violates concept independence. Research processes are ProcessSpec instances with research-specific step types (plan, gather, synthesize, verify). Seed a `deep-research-process.yaml` template instead. |
| **KnowledgeNode** (Integration Plan) | **Collapsed → ContentNode + Schema mixin** | KnowledgeNode "extends ContentNode" — violates independence. External sources become ContentNodes with a `Source` schema applied. Clef Base's multi-membership typing handles this natively. |
| **SynthesisReport** (Integration Plan) | **Collapsed → ContentNode + Schema mixin** | Same pattern. Reports are ContentNodes with a `ResearchReport` schema. The existing block editor, BlockEmbed, and SnippetEmbed handle structured content. |
| **CitationGraph** (Integration Plan) | **Collapsed → Citation concept + Relation** | The "graph" aspect is just typed Relations. The evaluation/scoring state needs a real concept (Citation), but graph traversal uses existing Relation/Reference/Backlink infrastructure. |
| **MemoryTier** (Integration Plan) | **Collapsed → AgentMemory (existing) + MemoryEntry (new)** | AgentMemory already has four tiers (working, episodic, semantic, procedural). What's genuinely new is *curated, user-owned, provenance-linked* knowledge entries. |
| **DataFragmentEmbed** (Integration Plan) | **Collapsed → SnippetEmbed (existing)** | Clef Base already has SnippetEmbed for embedded quotes/references in block content. The new Snippet concept provides the backing data; SnippetEmbed renders it. |
| **ResearchOrchestrator / ResearchWorker** (Compass) | **Collapsed → AgentLoop + AgentTeam + AgentRole** | All three already exist in llm-agent suite. Research orchestration is a *configuration* of existing agent infrastructure, not new concepts. |
| **QueryDecomposer / SubQuery / ComplexityEstimator / PerspectiveGenerator** (Compass) | **Collapsed → ResearchPlan actions** | These are actions within the ResearchPlan concept (decompose, estimateComplexity, generatePerspectives), not independent concepts. None has meaningful independent state. |
| **ThematicAnalyzer / SectionWriter / ContradictionDetector / InformationMerger** (Compass) | **Collapsed → LLMCall configurations** | These are LLM prompting patterns executed as ProcessSpec steps dispatched through LLMCall. No independent state. |
| **WorkingMemory / ArchivalMemory / EpisodicMemory** (Compass) | **Collapsed → AgentMemory tiers** | Already modeled as tiers within AgentMemory. |
| **AsyncTaskManager** (Compass) | **Collapsed → ProcessRun + [eventual] syncs** | ProcessRun already tracks status (pending→running→suspended→completed). Background execution uses `[eventual]` sync delivery. Resumability uses Checkpoint. |
| **HumanInTheLoop** (Compass) | **Collapsed → WorkItem + Approval** | Already exist in process-human suite. HITL gates are `approval` step types in ProcessSpec. |
| **BudgetManager** (Compass) | **Collapsed → ResearchProject budget state + LLMTrace cost tracking** | Budget constraints live in ResearchProject. Cost tracking uses existing LLMTrace. A sync enforces budget limits. |
| **QualityScorer / FactVerifier / StoppingCriterion** (Compass) | **Collapsed → EvaluationRun + QualityGate + QualityProfile** | These already exist. Citation-specific evaluators register as EvaluationRun evaluator types. |
| **ReActLoop / TreeOfThoughts / GraphOfThoughts / ReflexionLoop / SelfRefineLoop** (Compass) | **Already exist** | ReactStrategy, TreeOfThoughtStrategy, ReflectionStrategy, PlanAndExecuteStrategy, CodeActStrategy, ReWOOStrategy are all pluggable strategy providers in llm-agent. |
| **ResearchReport / ResearchCanvas / ProgressStream / ExportFormat** (Compass) | **Collapsed → ContentNode schemas + View/DisplayMode configs + ProcessEvent stream** | Output formats are Renderer concerns. Progress is the existing ProcessEvent stream. |

### Further collapses against existing repertoire (v2.0 revision)

The v1.0 plan proposed 8 new concepts. A deeper audit of existing repertoire suites reveals that 5 of these duplicate or substantially overlap with existing concepts. The following additional collapses reduce the new concept count from 8 to 3.

| Proposed concept (v1.0) | Disposition | Existing concepts used | Justification |
|---|---|---|---|
| **Source** | **Collapsed → Capture + DataSource + Provenance** | `data-integration/capture.concept` (ingestion via clip/import/subscribe), `data-integration/data-source.concept` (external system registration), `data-integration/provenance.concept` (full lineage DAG) | Source proposed: fetch URI, store content, compute hash, track retrieval metadata. **Capture** already does clip(url)/import(file) with mode and metadata. **DataSource** handles named registration of external systems. **Provenance** tracks the complete lineage chain. Source's `content_hash` is handled by `content-hash.concept` (content-addressed dedup). Source's `quarantine` action maps to **DataQuality/quarantine**. The "Source" concept was doing four existing concepts' jobs in one. Research sources are ContentNodes with a `research-source` Schema applied, ingested via Capture, registered via DataSource. |
| **Snippet** | **Collapsed → existing Snippet + TextSpan** | `content/snippet.concept` (excerpt entity wrapping TextSpan), `content/text-span.concept` (block-aware range selection) | A `Snippet` concept already exists in the content suite. It wraps a TextSpan ID, resolves text on demand, caches results, and tracks staleness (active/stale/broken). It has `kind` supporting "citation", "excerpt", "quote", "reference". The proposed Snippet's `locator_type` (page_sentence, char_offset, css_selector, etc.) maps directly to TextSpan/TextAnchor's block-aware addressing. The proposed `invalidate` action maps to existing `markStale`/`markBroken`. No new concept needed — use existing Snippet with kind="citation" or kind="excerpt". |
| **SourceCredibility** | **Collapsed → DataQuality + QualityProfile + QualitySignal** | `data-integration/data-quality.concept` (validation/quarantine), `quality-policy/quality-profile.concept` (composable rule profiles), `testing/quality-signal.concept` (normalized outcomes) | SourceCredibility proposed: domain tier rules, heuristic scoring, quarantine on low trust. **DataQuality** already has `validate(item, rulesetId)` with configurable rule sets and `quarantine`/`release` lifecycle. **QualityProfile** composes rules into named, inheritable profiles (essential→standard→strict) — domain tiers become rules in a `source-credibility` profile. **QualitySignal** normalizes outcomes into a single stream. The "evaluate" action becomes a DataQuality/validate call with a `source-credibility` ruleset. Seed a `source-credibility` QualityProfile with domain-match, content-analysis, freshness, and cross-reference rules. |
| **ResearchPlan** | **Collapsed → PlanAndExecuteStrategy + Approval** | `llm-agent/strategies/plan-and-execute.concept` (multi-step planning with replanning), `process-human/approval.concept` (human review gate) | ResearchPlan proposed: decompose query → sub-questions, assign strategies, approval lifecycle (draft→proposed→approved→rejected). **PlanAndExecuteStrategy** already does `plan(session, goal)` → `execute` → `replan(session, completed, remaining)` with full step tracking. The approval lifecycle (propose/approve/reject) maps to **Approval** from process-human suite, wired via syncs. Research-specific fields (perspectives, complexity estimation) become metadata on PlanAndExecuteStrategy sessions, not independent state. The PlanApproval derived concept composes PlanAndExecuteStrategy + Approval + WorkItem. |
| **MemoryEntry** | **Collapsed → AgentMemory semantic tier + Provenance syncs** | `llm-agent/agent-memory.concept` (four-tier memory with self-editing), `data-integration/provenance.concept` (lineage tracking) | The v1.0 plan already acknowledged overlap ("AgentMemory already has four tiers") but argued MemoryEntry adds "curated, user-owned, provenance-linked" knowledge. However: AgentMemory's `remember(content, "semantic", metadata)` already stores semantic facts with metadata. `recall(query, "semantic", k)` retrieves them. Adding provenance links is a sync from Provenance/record, not independent state. "User-approved" is an Approval gate. "Confidence" and "expiry" are metadata fields. "Supersede" is AgentMemory/editWorkingMemory. The curated notebook pattern becomes a derived concept composing AgentMemory + Provenance + Approval, not a new concept. |

### What was pulled out that no report explicitly proposed

| New element | Source signal | Why it's needed |
|---|---|---|
| **~~SourceCredibility concept~~** | ~~All three reports mention source trust/authority scoring~~ | **v2.0: Collapsed into DataQuality + QualityProfile + QualitySignal** (see further collapses table above). Domain trust rules become QualityProfile rules; scoring becomes DataQuality/validate; outcomes feed QualitySignal. |
| **PlanApproval derived concept** | Integration Plan mentions HITL plan approval; Compass mentions Gemini's "edit plan" UX | The plan-approve-execute pattern is universal. Composing PlanAndExecuteStrategy + Approval + WorkItem into a named derivation gives it a testable principle and clean Bind API surface. |
| **EvidenceChain derived concept** | Deep Research Report proposes snippet-first citations; Compass emphasizes source tracking | Capture → Snippet (existing) → Citation → Claim is a composition with its own principle ("every published claim traces to a captured source") that should be a named, testable derivation. |
| **CredibilityBadge widget** | Compass mentions source heuristics and SEO-farm avoidance | No report proposed a specific trust indicator widget, but every system needs one at the UI level. |
| **ContradictionFlag sync** | Integration Plan mentions multi-perspective disambiguation; Compass mentions ContradictionDetector | When multiple snippets supporting the same claim conflict, a sync should flag this for human review. This is a sync, not a concept. |

---

## 2. Suite Architecture

### 2.1 Research Evidence Suite (`suites/research-evidence/`)

Evidence claims, citations, and research orchestration. Leverages existing repertoire concepts for ingestion (Capture, DataSource), selection (Snippet, TextSpan), quality (DataQuality, QualityProfile), planning (PlanAndExecuteStrategy), and memory (AgentMemory).

**3 new concepts + many existing concept references, 0 derived (at suite level), ~26 syncs.**

| Concept | Type Param | New? | Purpose |
|---|---|---|---|
| **Capture** (data-integration) | — | Existing | Ingest content from URLs, files, feeds — replaces proposed "Source" ingestion. |
| **DataSource** (data-integration) | — | Existing | Register and name external systems — replaces proposed "Source" registration. |
| **Provenance** (data-integration) | — | Existing | Track lineage from capture to final report — replaces Source's retrieval metadata. |
| **Snippet** (content) | — | Existing | Referenceable excerpt wrapping TextSpan — replaces proposed "Snippet" entirely. |
| **TextSpan** (content) | — | Existing | Block-aware text range selection — the locator primitive underneath Snippet. |
| **DataQuality** (data-integration) | — | Existing | Validate and quarantine items — replaces proposed "SourceCredibility" scoring + quarantine. |
| **QualityProfile** (quality-policy) | — | Existing | Composable rule profiles — domain tier rules live here as a `source-credibility` profile. |
| **PlanAndExecuteStrategy** (llm-agent) | — | Existing | Multi-step planning with replanning — replaces proposed "ResearchPlan" decomposition. |
| **Approval** (process-human) | — | Existing | Human review gate — replaces ResearchPlan's approval lifecycle. |
| **AgentMemory** (llm-agent) | — | Existing | Multi-tier memory — replaces proposed "MemoryEntry" (use semantic tier + provenance syncs). |
| **Claim** | C | **New** | Represent assertable units of report content that require evidential grounding. |
| **Citation** | I | **New** | Assess and track the evidentiary link between a claim and its supporting snippet, with verification status and support scoring. |
| **ResearchProject** | P | **New** | Define the scope, constraints, allowed sources, perspective requirements, output format, and computational budget for a research investigation. |

### 2.2 Research Memory Suite (`suites/research-memory/`)

**Collapsed into research-evidence suite.** Curated memory is AgentMemory's semantic tier + Provenance syncs + Approval gate, composed as a derived concept (ResearchNotebook). No separate suite needed.

### 2.3 Derived Concepts <!-- MAG-536 -->

| Derived | Suite location | Composes | Purpose |
|---|---|---|---|
| **EvidenceChain** | `suites/research-evidence/` | Capture + Snippet (existing) + Citation + Claim | Every published claim traces through a citation to a snippet anchored in a captured source. |
| **PlanApproval** | `suites/research-evidence/` | PlanAndExecuteStrategy (llm-agent) + Approval (process-human) + WorkItem (process-human) | The plan-approve-execute pattern: generate plan, surface for human review, gate execution on approval. |
| **CitationVerification** | `suites/research-evidence/` | Citation + EvaluationRun (process-llm) + QualityGate (Clef Base) | Two-round citation quality checking: claim-support verification, then intermediate hallucination detection. |
| **DeepResearch** | `suites/research-evidence/` | EvidenceChain (derived) + PlanApproval (derived) + CitationVerification (derived) + ResearchProject + AgentMemory (semantic tier) | Root derivation representing the complete deep research capability. |
| **ResearchNotebook** | `suites/research-evidence/` | AgentMemory (semantic tier) + Provenance + Capture + Snippet (existing) | A curated notebook combining approved semantic memories with their evidential sources and provenance chains. |

---

## 2.4 Content-Native Schema Definitions <!-- MAG-529 -->

Research entity types are content-native — each gets a `.schema.yaml` with fields, child schema definitions, default block trees, and optional compilation providers. The general `content-native-schema.sync` infrastructure auto-wires everything: page promotion via PageAsRecord, Schema overlay, child block schema application, default block scaffolding via Template, ContentCompiler provider registration via PluginRegistry, and staleness tracking on block edits.

### 2.4.1 research-source.schema.yaml

A captured external artifact (web page, PDF, API response). No compilation provider needed — the content IS the source (like Constitution). Metadata properties track retrieval and credibility. Ingested via Capture/clip → general syncs promote to PageAsRecord → schema overlay applied → DataQuality/validate runs `source-credibility` ruleset.

```yaml
name: research-source
version: 1

fields:
  - name: uri
    type: string
    required: true
  - name: source_type
    type: string
    enum: [web_page, pdf, document, dataset, api_response, internal]
  - name: fetch_method
    type: string
    enum: [web_search, direct_fetch, upload, connector, mcp]
  - name: content_hash
    type: string
  - name: retrieved_by
    type: string
  - name: retrieved_at
    type: string
  - name: access_scope
    type: string
    default: "public"
    enum: [public, team, private]
  - name: license
    type: string
  - name: credibility_tier
    type: string
    enum: [authoritative, reliable, mixed, low_quality, quarantine]
  - name: status
    type: string
    default: "active"
    enum: [active, stale, unavailable, quarantined]

contentNative:
  displayWidget: schema-block-editor
  # No childSchema — source content is flat cleaned text, not structured blocks
  # No compilationProvider — the content IS the source
```

### 2.4.2 research-report.schema.yaml

A structured deep research report. Sections are Outline child blocks with the `report-section` child schema. ContentCompiler dispatches to a `ResearchReportCompiler` provider that walks the block tree, extracts claims via Claim/extract, and produces citation coverage metrics.

```yaml
name: research-report
version: 1

fields:
  - name: project_id
    type: string
    required: true
  - name: report_status
    type: string
    default: "draft"
    enum: [draft, verified, published]
  - name: citation_coverage
    type: number
  - name: overall_faithfulness
    type: number
  - name: perspective_count
    type: number

contentNative:
  childSchema: report-section
  defaultTemplate: standard-research-report
  compilationProvider: ResearchReportCompiler
  displayWidget: schema-block-editor

childSchemaDefinition:
  name: report-section
  isChildSchema: true
  fields:
    - name: section_type
      type: string
      enum: [executive_summary, methodology, findings, analysis, conclusion, appendix]
    - name: perspective
      type: string
    - name: claim_count
      type: number
      default: 0
    - name: citation_count
      type: number
      default: 0
    - name: verification_status
      type: string
      default: "unverified"
      enum: [unverified, partial, verified]

defaultBlocks:
  - sectionType: executive_summary
    section_type: executive_summary
    description: "High-level summary of findings"
    defaultContent: ""
  - sectionType: methodology
    section_type: methodology
    description: "Sources consulted, search strategy, perspectives applied"
    defaultContent: ""
  - sectionType: findings
    section_type: findings
    description: "Key findings with inline citations"
    defaultContent: ""
  - sectionType: analysis
    section_type: analysis
    description: "Cross-perspective analysis and contradictions"
    defaultContent: ""
  - sectionType: conclusion
    section_type: conclusion
    description: "Conclusions and confidence assessment"
    defaultContent: ""
```

### 2.4.3 research-plan.schema.yaml

A research plan is content-native with sub-questions as child blocks. The PlanAndExecuteStrategy agent generates the plan; the content-native schema lets users view and edit it in the block editor before approval. No compilation provider — PlanAndExecuteStrategy reads the block tree directly.

```yaml
name: research-plan
version: 1

fields:
  - name: project_id
    type: string
    required: true
  - name: estimated_complexity
    type: string
    enum: [simple, moderate, complex, expert]
  - name: approval_status
    type: string
    default: "draft"
    enum: [draft, proposed, approved, rejected, revised]
  - name: approved_by
    type: string
  - name: approved_at
    type: string

contentNative:
  childSchema: research-question
  defaultTemplate: standard-research-plan
  displayWidget: schema-block-editor

childSchemaDefinition:
  name: research-question
  isChildSchema: true
  fields:
    - name: strategy
      type: string
      enum: [web_search, academic_search, direct_analysis, expert_consultation, data_extraction]
    - name: priority
      type: number
      default: 50
    - name: status
      type: string
      default: "pending"
      enum: [pending, in_progress, completed, skipped]
    - name: dependencies
      type: string
      description: "Comma-separated question block IDs this depends on"
```

### 2.4.4 research-project.schema.yaml

The top-level research investigation container. Budget and source policy are properties on the page. No child blocks — the project page links to its plan and report pages via Relations.

```yaml
name: research-project
version: 1

fields:
  - name: deliverable_type
    type: string
    required: true
    enum: [report, comparison, literature_review, fact_check, data_extraction]
  - name: output_format
    type: string
    default: "structured_blocks"
    enum: [markdown, structured_blocks, table]
  - name: max_tokens
    type: number
  - name: max_search_calls
    type: number
  - name: max_duration_minutes
    type: number
  - name: tokens_used
    type: number
    default: 0
  - name: search_calls_used
    type: number
    default: 0
  - name: status
    type: string
    default: "draft"
    enum: [draft, planning, executing, reviewing, completed, cancelled]
  - name: require_credibility_tier
    type: string
    enum: [authoritative, reliable, mixed]
  - name: process_run_id
    type: string
  - name: report_page_id
    type: string
  - name: plan_page_id
    type: string

contentNative:
  displayWidget: schema-block-editor
  # Project page body is the user's query/brief — free text, no child schema needed
```

### 2.4.5 Content-Native Pipeline Flow

```
User creates ContentNode(type="research-project", body="Compare cloud GPU pricing...")
    ↓ [general sync: SchemaTypedNodePromotesToRecord]
PageAsRecord/fromContentNode → schema overlay applied
    ↓ [general sync: SchemaTypedNodeAppliesSchema]
Schema/applyTo(entity_id=pageId, schema="research-project")
    ↓ Properties set: deliverable_type, budget fields, etc.

Research plan generated by PlanAndExecuteStrategy:
    ↓
ContentNode/create(type="research-plan", body=decomposed_questions)
    ↓ [general syncs auto-wire]
Schema overlay "research-plan" applied
    ↓ [ChildBlockGetsSchema]
Each Outline child block gets "research-question" child schema
    ↓ Properties on each question block: strategy, priority, dependencies

Sources captured via Capture/clip:
    ↓
ContentNode/create(type="research-source", body=cleaned_content)
    ↓ [general syncs auto-wire]
Schema overlay "research-source" applied
    ↓ Properties set: uri, content_hash, credibility_tier, etc.
    ↓ [custom sync: source-triggers-quality-check]
DataQuality/validate(item=sourcePageId, rulesetId="source-credibility")

Snippets selected from source pages:
    ↓
TextSpan/create(entityRef=sourcePageId, kind="citation") → Snippet/create → VersionPin/create

Report compiled from research:
    ↓
ContentNode/create(type="research-report", body="")
    ↓ [general syncs: defaultTemplate scaffolds sections]
Template/instantiate → default report sections created as Outline children
    ↓ [ChildBlockGetsSchema]
Each section block gets "report-section" child schema
    ↓ LLM fills section blocks with synthesis + inline citation markers
    ↓ [SchemaBlockEditStalesCompilation]
ContentCompiler/markStale → ContentCompiler/compile
    ↓ ResearchReportCompiler walks block tree:
      - Extracts claims → Claim/extract per sentence with citations
      - Links citations → Citation/link(claim, snippet, key)
      - Computes coverage metrics → updates report properties
```

### 2.4.6 Init Syncs Required

Each schema needs a registration sync (like `constitution-schema-init.sync`):

| Init Sync | Registers | Properties Set |
|---|---|---|
| `research-source-schema-init.sync` | Schema "research-source" | displayWidget |
| `research-report-schema-init.sync` | Schema "research-report" | childSchema, defaultTemplate, compilationProvider, displayWidget |
| `research-plan-schema-init.sync` | Schema "research-plan" | childSchema, defaultTemplate, displayWidget |
| `research-project-schema-init.sync` | Schema "research-project" | displayWidget |

### 2.4.7 Seed Data Required

| Seed | Type | Purpose |
|---|---|---|
| `source-credibility` | QualityProfile | Domain-match, content-analysis, freshness, cross-reference rules |
| `standard-research-report` | Template | Default report sections (exec summary, methodology, findings, analysis, conclusion) |
| `standard-research-plan` | Template | Default plan structure |
| `deep-research-process` | ProcessSpec | Multi-step research template (unchanged from v1.0 §5) |
| `ResearchReportCompiler` | PluginRegistry provider | Walks report block tree, extracts claims, links citations, computes coverage |

---

## 2.5 Agent Persona + Process/Workflow Integration <!-- MAG-532, MAG-533 -->

Deep research is **not hardcoded** — it runs as a configurable **ProcessSpec + AgentPersona + AgentSession** pipeline. Users can change the research strategy, swap agents, add/remove/reorder steps, hand off between agents, and customize every aspect through the existing process/workflow infrastructure.

### 2.5.1 The Research Agent as a Persona Page

The deep research agent is an **AgentPersona content-native page** (llm-agent suite, already committed). It uses the same `agent-persona` Schema + `instruction-block` child schema as any other persona:

```
ContentNode(type="agent-persona", body="Deep Research Agent")
  ├── Outline child: instruction-block (role="system", content="You are a research analyst...")
  ├── Outline child: instruction-block (role="tools", content="{tool_bindings}")
  ├── Outline child: instruction-block (role="constitution", content="{principles}")
  └── Outline child: instruction-block (role="strategy", content="plan_and_execute")
```

Users edit this page in the **persona-editor widget** to customize:
- System prompt (research focus, tone, domain expertise)
- Tool bindings (which search providers, which capture methods)
- Constitution principles (citation requirements, source quality thresholds)
- Strategy selection (plan_and_execute, react, tree_of_thought, etc.)

When compiled via `ContentCompiler/compile`, this produces a `PromptAssembly` used by AgentLoop.

### 2.5.2 The Research Process as a Configurable ProcessSpec

The research workflow is a **ProcessSpec content-native page** (`process-spec.schema.yaml`, already committed). Steps are Outline child blocks with the `process-step` child schema. Each step has Properties: `step_type` (human/automation/llm/approval/subprocess/webhook_wait), `step_key`, `timeout_ms`, `retry_count`, `required_role`, routing conditions (`on_success`, `on_failure`, `condition_expr`).

ProcessSpec also stores **edges** — directed routing connections between steps with variant-based branching (`on_variant: "ok"`, `on_variant: "error"`) and conditional expressions evaluated against ProcessVariables. This is NOT a linear pipeline — it's a **directed graph** with parallel forks, joins, and conditional branches.

The `deep-research-process` seed provides a default template, but users can edit it through the **workflow-editor** widget (n8n-style node-graph canvas) or the **process-map-graph** widget (visual directed graph):

- **Add steps**: Drag new nodes from the palette onto the canvas, or insert Outline blocks in the block editor
- **Remove steps**: Delete nodes from the graph or blocks from the editor
- **Reorder/reroute**: Drag edges between step nodes to change flow; edit `on_success`/`on_failure` routing
- **Add parallel branches**: Fork flow with `routing="parallel"` via the parallel-fork/parallel-join syncs
- **Change step configuration**: Edit Properties on each step (timeout, retry, role, condition expressions)
- **Swap agents per step**: Each step's `required_role` Property can point to a different persona page ID
- **Add human gates**: Add steps with `step_type="approval"` — the **approval-stepper** widget handles the UX
- **Add conditional routing**: Set `condition_expr` on edges to branch based on ProcessVariable values
- **Fork the entire process**: Copy the ProcessSpec page → edit → publish as a new variant

```
ContentNode(type="process-spec", body="Deep Research Process")
  Steps (Outline children with process-step schema):
  ├── plan          (step_type="llm", role="deep-researcher", strategy="plan_and_execute")
  ├── approve_plan  (step_type="approval", required_role="human")
  ├── gather_sources(step_type="llm", role="deep-researcher", routing="parallel")
  ├── quality_gate  (step_type="automation", condition_expr="credibility_score >= 0.7")
  ├── synthesize    (step_type="llm", role="synthesis-writer")   ← different persona!
  ├── verify_cites  (step_type="llm", role="fact-checker")       ← different persona!
  ├── human_review  (step_type="approval", required_role="human")
  └── publish       (step_type="automation", role="deep-researcher")
  
  Edges (routing graph):
  ├── plan → approve_plan (on_variant="ok")
  ├── approve_plan → gather_sources (on_variant="ok")
  ├── approve_plan → plan (on_variant="rejected")          ← loop back for revision!
  ├── gather_sources → quality_gate (on_variant="ok")
  ├── quality_gate → synthesize (condition_expr="pass")
  ├── quality_gate → gather_sources (condition_expr="fail") ← retry with different sources!
  ├── synthesize → verify_cites (on_variant="ok")
  ├── verify_cites → human_review (on_variant="ok")
  ├── verify_cites → synthesize (on_variant="error")        ← re-synthesize on verification failure!
  ├── human_review → publish (on_variant="ok")
  └── human_review → synthesize (on_variant="rejected")     ← back to synthesis!
```

**ExecutionDispatch** resolves HOW each step executes based on step_type + actor_type. A step marked `step_type="llm"` with `actor_type="ai_autonomous"` resolves to `agent_loop` mode (→ AgentSession/spawn). The same step with `actor_type="human"` resolves to `work_item` mode. This means the same ProcessSpec can be executed by agents OR humans, or a mix.

### 2.5.3 Runtime Wiring: How It All Connects

```
User creates ResearchProject (content-native page)
    ↓ [sync: research-project-creates-process-run]
ProcessRun/start(processSpec="deep-research-process", context={project_id, query, budget})
    ↓ ProcessSpec walks step blocks in order:

Step 1: "plan"
    ↓ [sync: step-dispatches-to-persona]
    AgentSession/spawn(personaPageId=step.role, strategy=step.strategy)
        ↓ ContentCompiler/compile(persona page) → PromptAssembly
        ↓ AgentLoop/create(assembly, strategy=PlanAndExecuteStrategy)
        ↓ PlanAndExecuteStrategy/plan(session, goal=project.query)
        ↓ Creates research-plan content-native page with sub-question blocks
    ↓ [sync: plan-requires-approval]
    Approval/request(entity=planPageId, policy="one_of")
        ↓ User reviews in persona-editor / plan view, approves or edits

Step 2: "gather_sources" (routing="parallel")
    ↓ [sync: step-dispatches-to-persona]
    For each sub-question (parallel via routing="parallel"):
        AgentSession/spawn → AgentLoop with search tools
        ↓ ToolBinding/invoke(tool="web_search") → Capture/clip results
        ↓ Each captured source becomes a research-source content-native page
        ↓ DataQuality/validate runs source-credibility rules

Step 3–7: Each step similarly dispatches to the persona named in step.role
    ↓ Different personas can have different tools, constitutions, strategies
    ↓ AgentHandoff passes context between sessions when personas change
```

### 2.5.4 Customization Points (Nothing Hardcoded)

| What to change | How | Widget / Concept |
|---|---|---|
| Research flow (add/remove/reorder steps) | Drag nodes in workflow-editor canvas or edit blocks in schema-block-editor | **workflow-editor** widget, ProcessSpec content-native page |
| Routing between steps | Draw/edit edges in process-map-graph or workflow-editor | ProcessSpec edges, `on_variant`/`condition_expr` Properties |
| Add parallel branches | Fork/join nodes in workflow-editor | FlowToken + parallel-fork/parallel-join syncs |
| Research strategy per step | Edit step's `strategy` Property | PlanAndExecuteStrategy → any registered strategy via PluginRegistry |
| Which agent runs a step | Edit step's `required_role` Property (persona page ID) | ExecutionDispatch resolves mode, AgentSession/spawn dispatches |
| Add human review gate | Add node with `step_type="approval"` | **approval-stepper** widget, Approval concept |
| Change search tools | Edit persona's tool-binding instruction block | **persona-editor** widget, ToolBinding, PluginRegistry |
| Change quality thresholds | Edit source-credibility QualityProfile rules | QualityProfile/addRule, QualityProfile/removeRule |
| Change citation requirements | Edit persona's constitution instruction block | **persona-editor** widget, Constitution principles |
| Hand off to different agent | Different `required_role` per step, or use AgentHandoff | AgentHandoff/package → AgentSession/spawn |
| Auto-trigger research | Create AgentTrigger (schedule, webhook, content_event) | **agent-trigger-config** widget, AgentTrigger/fire |
| Fork the entire process | Copy ProcessSpec page, edit in workflow-editor | Content system copy + workflow-editor |
| Monitor running process | View execution-overlay on process-map-graph | **execution-overlay** widget (status-colored nodes) |
| Inspect process variables | Open variable-inspector panel | **variable-inspector** widget |
| View run history | Open run-list-table | **run-list-table** widget |
| Debug step failures | Click failed node → execution-overlay shows error + FlowTrace | **execution-overlay** + **trace-tree** widgets |

### 2.5.5 Frontend: Persona + Process + Research Views

Three widget families compose together — all already exist except the research-specific ones in §7.2:

**Agent/Persona widgets (llm-agent suite, committed):**

| Widget | Research usage |
|---|---|
| **persona-editor** | Customize the deep research agent's instructions, tools, constitution |
| **agent-session-panel** | Watch live research session: conversation feed, tool calls, reasoning trace |
| **agent-dashboard** | Overview of all research sessions (active, completed, failed) |
| **agent-trigger-config** | Set up automated research triggers (e.g., "research new topics weekly") |
| **persona-card** | Compact card showing research agent in agent library grid |
| **trace-tree** | Hierarchical execution trace for debugging research runs |
| **hitl-interrupt** | Approval banner when plan needs human review |
| **task-plan-list** | Shows research plan sub-questions as a task list with status |
| **memory-inspector** | Browse agent's accumulated research memories |

**Process/Workflow widgets (process-foundation + automation suites, committed):**

| Widget | Research usage |
|---|---|
| **workflow-editor** | n8n-style node-graph canvas for editing the deep research ProcessSpec — drag steps, draw edges, configure routing |
| **process-map-graph** | Visual directed graph of research process steps + connections (read-only or editable) |
| **execution-overlay** | Overlays on process-map-graph showing live step execution status (running, completed, failed) with color-coded nodes |
| **variable-inspector** | Inspect ProcessVariables during a research run (budget counters, source counts, coverage metrics) |
| **run-list-table** | Table of research ProcessRuns with status, duration, step progress |
| **approval-stepper** | Multi-step approval UX for plan review gates |
| **sla-timer** | Timer showing time remaining against budget constraints |
| **eval-results-table** | Table of EvaluationRun results (citation quality scores) |
| **workflow-node** | Individual node in workflow-editor — shows step type icon, persona avatar, status badge |

**Research-specific widgets (new, §7.2)** compose alongside these in layouts:

| Layout | Left/Main | Right/Sidebar |
|---|---|---|
| **ResearchWorkspaceLayout** | ReportBuilderView (block editor with citations) | CitationInspector + EvidenceTable + persona-editor (collapsed) |
| **ResearchMonitorLayout** | agent-session-panel (live session) | RunTimeline + BudgetDashboard + task-plan-list |
| **ResearchProcessLayout** | workflow-editor or process-map-graph with execution-overlay | variable-inspector + run-list-table + agent-session-panel |

---

## 3. Concept Specifications <!-- MAG-530 -->

> **v2.0 note:** Only 3 new concept specs remain. Source, Snippet, SourceCredibility, ResearchPlan, and MemoryEntry have been collapsed into existing repertoire concepts (see §1 further collapses table). Their domain-specific fields now live in content-native schema definitions (§2.4). The original v1.0 specs are preserved below struck-through for reference.

### 3.1 ~~Source [S]~~ — COLLAPSED

**Replaced by:** Capture (data-integration) + DataSource (data-integration) + Provenance (data-integration) + content-native schema `research-source.schema.yaml` (§2.4.1).

- Ingestion: `Capture/clip(url, mode="research", metadata={...})`
- Registration: `DataSource/register(name=uri, uri=uri)`
- Lineage: `Provenance/record(entity, activity="capture", agent, inputs)`
- Quarantine: `DataQuality/quarantine(itemId, violations)`
- Content hash: `content-hash.concept` (existing)
- Schema fields (uri, source_type, fetch_method, credibility_tier, etc.): Properties on the content-native `research-source` schema page
- Refetch/staleness: VersionPin freshness tracking on the source page

<details><summary>Original v1.0 Source spec (collapsed)</summary>

### ~~3.1 Source [S]~~

```
@version(1)
@category("research")
concept Source [S] {

  purpose {
    Track fetched external artifacts with retrieval lifecycle, content hashing,
    licensing, and access scope, enabling durable evidence anchoring and
    deduplication across research investigations.
  }

  state {
    sources: set S
    identity {
      uri: S -> String
      content_hash: S -> option String
      title: S -> option String
      source_type: S -> "web_page" | "pdf" | "document" | "dataset" | "api_response" | "internal"
    }
    retrieval {
      retrieved_at: S -> DateTime
      retrieved_by: S -> String
      fetch_method: S -> "web_search" | "direct_fetch" | "upload" | "connector" | "mcp"
      raw_content: S -> option Bytes
      cleaned_content: S -> option String
    }
    access {
      access_scope: S -> "public" | "team" | "private"
      license: S -> option String
      terms_url: S -> option String
    }
    status: S -> "active" | "stale" | "unavailable" | "quarantined"
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action capture(uri: String, fetch_method: String, retrieved_by: String) {
      -> ok(source: S) {
        Fetch the artifact at the given URI, compute its content hash,
        store raw and cleaned representations, and return the new source.
      }
      -> duplicate(existing: S) {
        A source with the same content hash already exists.
      }
      -> error(message: String) {
        The URI was unreachable, returned an error, or produced
        an unsupported content type.
      }
      fixture web_capture { uri: "https://example.com/article", fetch_method: "web_search", retrieved_by: "agent-1" }
      fixture pdf_upload { uri: "file:///uploads/paper.pdf", fetch_method: "upload", retrieved_by: "user-1" }
      fixture unreachable { uri: "https://does-not-exist.invalid/page", fetch_method: "direct_fetch", retrieved_by: "agent-1" } -> error
    }

    action refetch(source: S) {
      -> ok(source: S) {
        Re-retrieve the artifact, update content hash, mark as active
        if content is unchanged or update cleaned_content if changed.
      }
      -> changed(source: S, previous_hash: String) {
        The artifact's content has changed since the last retrieval.
      }
      -> unavailable(source: S) {
        The artifact is no longer accessible at its URI.
      }
      -> notfound(message: String) {
        No source exists with this identifier.
      }
      fixture refetch_ok { source: $web_capture.source } after web_capture
    }

    action quarantine(source: S, reason: String) {
      -> ok(source: S) {
        Mark the source as quarantined, preventing it from being
        used in new citations until reviewed.
      }
      -> notfound(message: String) {
        No source exists with this identifier.
      }
      fixture quarantine_ok { source: $web_capture.source, reason: "suspected prompt injection" } after web_capture
    }

    action setAccess(source: S, access_scope: String, license: String) {
      -> ok(source: S) {
        Update the access scope and license metadata.
      }
      -> notfound(message: String) {
        No source exists with this identifier.
      }
    }

    action get(source: S) {
      -> ok(source: S, uri: String, content_hash: String, title: String,
            source_type: String, status: String) {
        Return the source and its current metadata.
      }
      -> notfound(message: String) {
        No source exists with this identifier.
      }
      fixture get_ok { source: $web_capture.source } after web_capture
      fixture get_missing { source: "nonexistent" } -> notfound
    }

    action list(filters: { source_type: option String, status: option String,
                           access_scope: option String }) {
      -> ok(sources: list S) {
        Return sources matching the given filters.
      }
    }

    action search(query: String) {
      -> ok(sources: list S) {
        Search sources by URI, title, or cleaned content.
      }
    }
  }

  example "capture then retrieve": {
    after capture(uri: "https://example.com/doc", fetch_method: "web_search",
                  retrieved_by: "agent-1") -> ok(source: s)
    then get(source: s) -> ok(uri: "https://example.com/doc", status: "active")
  }

  example "quarantine prevents citation": {
    after quarantine(source: s, reason: "poisoned") -> ok(source: s)
    then get(source: s) -> ok(status: "quarantined")
  }

  always "content hash on active sources": {
    forall s in sources: status(s) = "active" implies content_hash(s) != null
  }
}
```

</details>

### 3.2 ~~Snippet [N]~~ — COLLAPSED

**Replaced by:** existing Snippet (content suite) + TextSpan (content suite) + VersionPin (content suite).

- Excerpt creation: `TextSpan/create(entityRef=sourcePageId, kind="citation")` → `Snippet/create(textSpan=spanId, sourceEntity=sourcePageId, kind="citation")`
- Locator addressing: TextAnchor's block-aware (blockId + offset + context) addressing covers all proposed locator types (page_sentence, char_offset, css_selector, block_index)
- Staleness: VersionPin tracks freshness; Snippet/markStale called automatically by existing syncs
- Annotation: Snippet/setLabel + AnnotationLayer for editorial layers
- Resolution: Snippet/resolve walks TextSpan → block tree → returns cached excerpt text

<details><summary>Original v1.0 Snippet spec (collapsed)</summary>

### ~~3.2 Snippet [N]~~

```
@version(1)
@category("research")
concept Snippet [N] {

  purpose {
    Anchor precise selections within sources using type-specific locators,
    preserving the exact excerpt text and provenance metadata needed for
    citation verification and human audit.
  }

  state {
    snippets: set N
    anchoring {
      source_id: N -> String
      locator_type: N -> "page_sentence" | "char_offset" | "block_index" | "css_selector" | "xpath" | "timestamp"
      locator_value: N -> String
      excerpt: N -> String
    }
    provenance {
      captured_by: N -> String
      captured_at: N -> DateTime
      capture_method: N -> "manual" | "agent" | "extraction"
      annotation: N -> option String
    }
    status: N -> "active" | "invalidated" | "orphaned"
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action capture(source_id: String, locator_type: String, locator_value: String,
                   excerpt: String, captured_by: String, capture_method: String) {
      -> ok(snippet: N) {
        Create a new snippet anchored to the specified source at the
        given locator position, storing the excerpt text.
      }
      -> invalid_locator(message: String) {
        The locator type or value is malformed for the source type.
      }
      fixture web_snippet { source_id: "src-1", locator_type: "css_selector", locator_value: "p:nth-child(3)", excerpt: "AI systems demonstrate emergent capabilities.", captured_by: "agent-1", capture_method: "agent" }
      fixture pdf_snippet { source_id: "src-2", locator_type: "page_sentence", locator_value: "5:12", excerpt: "The study found a 40% improvement.", captured_by: "user-1", capture_method: "manual" }
    }

    action annotate(snippet: N, annotation: String) {
      -> ok(snippet: N) {
        Attach or update a human-authored annotation to the snippet.
      }
      -> notfound(message: String) {
        No snippet exists with this identifier.
      }
    }

    action invalidate(snippet: N, reason: String) {
      -> ok(snippet: N) {
        Mark the snippet as invalidated because the source content
        has changed and the locator no longer resolves.
      }
      -> notfound(message: String) {
        No snippet exists with this identifier.
      }
    }

    action get(snippet: N) {
      -> ok(snippet: N, source_id: String, locator_type: String,
            locator_value: String, excerpt: String, status: String) {
        Return the snippet and all its anchoring and provenance metadata.
      }
      -> notfound(message: String) {
        No snippet exists with this identifier.
      }
      fixture get_ok { snippet: $web_snippet.snippet } after web_snippet
    }

    action listBySource(source_id: String) {
      -> ok(snippets: list N) {
        Return all active snippets anchored to the given source.
      }
    }
  }

  example "capture then retrieve": {
    after capture(source_id: "s1", locator_type: "page_sentence", locator_value: "3:7",
                  excerpt: "Key finding.", captured_by: "agent", capture_method: "agent")
          -> ok(snippet: n)
    then get(snippet: n) -> ok(source_id: "s1", status: "active")
  }

  always "every snippet has a source": {
    forall n in snippets: source_id(n) != null
  }
}
```

</details>

### 3.3 Claim [C] — NEW

```
@version(1)
@category("research")
concept Claim [C] {

  purpose {
    Represent assertable units of report content that require evidential
    grounding, enabling per-claim verification status tracking and
    citation coverage measurement.
  }

  state {
    claims: set C
    content {
      report_entity_id: C -> String
      block_id: C -> String
      claim_text: C -> String
    }
    verification {
      status: C -> "unverified" | "supported" | "partial" | "unsupported" | "contested"
      support_score: C -> option Float
      verified_at: C -> option DateTime
      verified_by: C -> option String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action extract(report_entity_id: String, block_id: String, claim_text: String) {
      -> ok(claim: C) {
        Extract a new claim from a report block for verification tracking.
      }
      fixture basic_claim { report_entity_id: "report-1", block_id: "block-3", claim_text: "LLMs achieve 95% accuracy on factual QA tasks." }
    }

    action updateVerification(claim: C, status: String, support_score: Float,
                              verified_by: String) {
      -> ok(claim: C) {
        Update the verification status and support score after evaluation.
      }
      -> notfound(message: String) {
        No claim exists with this identifier.
      }
      fixture verify_ok { claim: $basic_claim.claim, status: "supported", support_score: 0.92, verified_by: "citation-evaluator" } after basic_claim
    }

    action get(claim: C) {
      -> ok(claim: C, claim_text: String, status: String,
            support_score: Float, report_entity_id: String) {
        Return the claim and its current verification state.
      }
      -> notfound(message: String) {
        No claim exists with this identifier.
      }
    }

    action listByReport(report_entity_id: String) {
      -> ok(claims: list C) {
        Return all claims extracted from the given report entity.
      }
    }

    action listUnsupported(report_entity_id: String) {
      -> ok(claims: list C) {
        Return claims that are unverified, partial, unsupported, or contested.
      }
    }
  }

  example "extract then verify": {
    after extract(report_entity_id: "r1", block_id: "b1", claim_text: "X is true.")
          -> ok(claim: c)
    then get(claim: c) -> ok(status: "unverified")
    and  updateVerification(claim: c, status: "supported", support_score: 0.95,
                            verified_by: "evaluator") -> ok()
    then get(claim: c) -> ok(status: "supported")
  }

  always "score range": {
    forall c in claims: support_score(c) = null or
      (support_score(c) >= 0.0 and support_score(c) <= 1.0)
  }
}
```

### 3.4 Citation [I] — NEW

```
@version(1)
@category("research")
concept Citation [I] {

  purpose {
    Assess and track the evidentiary link between a claim and its
    supporting snippet, with verification status, support scoring,
    and verification method metadata enabling ALCE-style citation
    quality measurement.
  }

  state {
    citations: set I
    link {
      claim_id: I -> String
      snippet_id: I -> String
    }
    assessment {
      support_score: I -> Float
      verification_status: I -> "pending" | "verified" | "weak" | "refuted" | "manual_override"
      verification_method: I -> "nli_cascade" | "llm_judge" | "embedding_similarity" | "manual"
      verified_at: I -> option DateTime
    }
    rendering {
      citation_key: I -> String
      display_format: I -> option String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action link(claim_id: String, snippet_id: String, citation_key: String) {
      -> ok(citation: I) {
        Create a citation linking a claim to a supporting snippet.
      }
      -> duplicate(existing: I) {
        A citation already exists between this claim and snippet.
      }
      fixture basic_link { claim_id: "claim-1", snippet_id: "snip-1", citation_key: "[1]" }
    }

    action verify(citation: I, support_score: Float, verification_method: String) {
      -> ok(citation: I) {
        Record the verification assessment for this citation.
      }
      -> notfound(message: String) {
        No citation exists with this identifier.
      }
      fixture verify_strong { citation: $basic_link.citation, support_score: 0.95, verification_method: "nli_cascade" } after basic_link
    }

    action override(citation: I, verification_status: String, reason: String) {
      -> ok(citation: I) {
        Manually override the verification status with justification.
      }
      -> notfound(message: String) {
        No citation exists with this identifier.
      }
    }

    action get(citation: I) {
      -> ok(citation: I, claim_id: String, snippet_id: String,
            support_score: Float, verification_status: String) {
        Return the citation and its assessment metadata.
      }
      -> notfound(message: String) {
        No citation exists with this identifier.
      }
    }

    action listByClaim(claim_id: String) {
      -> ok(citations: list I) {
        Return all citations supporting the given claim.
      }
    }

    action listBySnippet(snippet_id: String) {
      -> ok(citations: list I) {
        Return all citations referencing the given snippet.
      }
    }
  }

  example "link then verify": {
    after link(claim_id: "c1", snippet_id: "s1", citation_key: "[1]") -> ok(citation: i)
    then verify(citation: i, support_score: 0.88, verification_method: "nli_cascade") -> ok()
    then get(citation: i) -> ok(verification_status: "verified")
  }

  never "citation without endpoints": {
    exists i in citations: claim_id(i) = null or snippet_id(i) = null
  }
}
```

### 3.5 ~~SourceCredibility [D]~~ — COLLAPSED

**Replaced by:** DataQuality (data-integration) + QualityProfile (quality-policy) + QualitySignal (testing).

- Evaluation: `DataQuality/validate(item=sourcePageId, rulesetId="source-credibility")`
- Domain tier rules: Rules in `source-credibility` QualityProfile (essential tier: domain-match, freshness; standard tier: content-analysis, cross-reference)
- Quarantine: `DataQuality/quarantine(itemId, violations)` → `QualitySignal/record(target, dimension="credibility", status="fail")`
- Custom rules: Additional QualityProfile rules via `QualityProfile/addRule`
- Historical scores: QualitySignal stream for the source ContentNode

<details><summary>Original v1.0 SourceCredibility spec (collapsed)</summary>

*(See git history for full spec — omitted for brevity)*

</details>

### 3.6 ResearchProject [P] — NEW (content-native: `research-project.schema.yaml` §2.4.4)

```
@version(1)
@gate
@category("research")
concept ResearchProject [P] {

  purpose {
    Define the scope, constraints, allowed sources, perspective requirements,
    output format, and computational budget for a research investigation,
    serving as the durable container that ties together plans, runs,
    evidence, and reports.
  }

  state {
    projects: set P
    definition {
      query: P -> String
      deliverable_type: P -> "report" | "comparison" | "literature_review" | "fact_check" | "data_extraction"
      constraints: P -> option String
      output_format: P -> "markdown" | "structured_blocks" | "table"
    }
    perspectives {
      required_perspectives: P -> list String
      perspective_count: P -> Int
    }
    budget {
      max_tokens: P -> option Int
      max_search_calls: P -> option Int
      max_duration_minutes: P -> option Int
      tokens_used: P -> Int
      search_calls_used: P -> Int
    }
    source_policy {
      allowed_source_types: P -> list String
      allowed_domains: P -> option list String
      blocked_domains: P -> option list String
      require_credibility_tier: P -> option String
    }
    lifecycle {
      status: P -> "draft" | "planning" | "executing" | "reviewing" | "completed" | "cancelled"
      created_at: P -> DateTime
      completed_at: P -> option DateTime
      process_run_id: P -> option String
      report_entity_id: P -> option String
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(query: String, deliverable_type: String, constraints: String,
                  perspectives: list String, budget: { max_tokens: Int,
                  max_search_calls: Int, max_duration_minutes: Int }) {
      -> ok(project: P) {
        Create a new research project in draft status.
      }
      -> error(message: String) {
        The query is empty or budget values are invalid.
      }
      fixture market_analysis { query: "Compare cloud GPU pricing across AWS, GCP, and Azure for LLM fine-tuning workloads", deliverable_type: "comparison", constraints: "Focus on H100 and A100 instances, include spot pricing", perspectives: ["cost analyst", "ML engineer", "infrastructure architect"], budget: { max_tokens: 500000, max_search_calls: 80, max_duration_minutes: 30 } }
    }

    action updateBudgetUsage(project: P, tokens_delta: Int, search_calls_delta: Int) {
      -> ok(project: P) {
        Increment the token and search call usage counters.
      }
      -> budget_exceeded(resource: String, limit: Int, current: Int) {
        A budget limit has been reached or exceeded.
      }
      -> notfound(message: String) {
        No project exists with this identifier.
      }
    }

    action transition(project: P, new_status: String) {
      -> ok(project: P) {
        Advance the project lifecycle to the new status.
      }
      -> invalid_transition(current: String, requested: String) {
        The requested status transition is not valid from the current status.
      }
      -> notfound(message: String) {
        No project exists with this identifier.
      }
    }

    action linkReport(project: P, report_entity_id: String) {
      -> ok(project: P) {
        Associate the final report ContentNode with this project.
      }
      -> notfound(message: String) {
        No project exists with this identifier.
      }
    }

    action get(project: P) {
      -> ok(project: P, query: String, status: String, tokens_used: Int,
            search_calls_used: Int) {
        Return the project and its current state.
      }
      -> notfound(message: String) {
        No project exists with this identifier.
      }
    }

    action list(status_filter: option String) {
      -> ok(projects: list P) {
        Return projects matching the optional status filter.
      }
    }
  }

  example "full lifecycle": {
    after create(query: "Compare X vs Y", deliverable_type: "comparison",
                 constraints: "", perspectives: ["analyst"],
                 budget: { max_tokens: 100000, max_search_calls: 50,
                           max_duration_minutes: 15 }) -> ok(project: p)
    then transition(project: p, new_status: "planning") -> ok()
    then transition(project: p, new_status: "executing") -> ok()
    then transition(project: p, new_status: "completed") -> ok()
  }
}
```

### 3.7 ~~ResearchPlan [L]~~ — COLLAPSED

**Replaced by:** PlanAndExecuteStrategy (llm-agent) + Approval (process-human) + content-native schema `research-plan.schema.yaml` (§2.4.3).

- Plan generation: `PlanAndExecuteStrategy/plan(session, goal)` decomposes the query into sub-steps
- Sub-questions: Outline child blocks with `research-question` child schema (strategy, priority, dependencies as Properties)
- Approval lifecycle: `Approval/request(entity=planPageId, policy="one_of")` → `Approval/approve`/`Approval/reject`
- Revision: Users edit sub-question blocks directly in the block editor; `SchemaBlockEditStalesCompilation` propagates changes
- Step advancement: `PlanAndExecuteStrategy/execute(session)` → `PlanAndExecuteStrategy/replan(session, completed, remaining)`
- Perspectives: Properties on the plan page (perspective names, roles, focus areas)
- The `PlanApproval` derived concept (§2.3) composes these into a named, testable unit

<details><summary>Original v1.0 ResearchPlan spec (collapsed)</summary>

*(See git history for full spec — omitted for brevity)*

</details>

### 3.8 ~~MemoryEntry [M]~~ — COLLAPSED

**Replaced by:** AgentMemory semantic tier (llm-agent) + Provenance (data-integration) + Approval (process-human).

- Create: `AgentMemory/remember(content, "semantic", metadata={project_id, snippet_ids, confidence})`
- Approve: `Approval/request(entity=memoryId, policy="one_of")` → `Approval/approve`
- Recall: `AgentMemory/recall(query, "semantic", k)` — already supports semantic search
- Supersede: `AgentMemory/editWorkingMemory` or `AgentMemory/consolidate`
- Retract: `AgentMemory/forget(memoryId)`
- Provenance: `Provenance/record(entity=memoryId, activity="research_consolidation", inputs=[reportId, snippetIds])`
- Category/tags: `Tag/apply` from classification suite
- Confidence/expiry: Properties on the memory entity
- The `ResearchNotebook` derived concept (§2.3) composes AgentMemory + Provenance + Approval + Capture + Snippet

<details><summary>Original v1.0 MemoryEntry spec (collapsed)</summary>

*(See git history for full spec — omitted for brevity)*

</details>

---

## 4. Sync Specifications <!-- MAG-531 -->

### 4.1 Research Evidence Suite — Internal Syncs (required: 14)

```
sync source-captures-create-snippets [eventual]
when { Source/capture => [source: ?src] -> ok }
then { -- no auto-action; snippet creation is explicit }
-- Placeholder: connects Source lifecycle to downstream processing.

sync snippet-invalidation-on-source-change [eventual]
when { Source/refetch => [source: ?src] -> changed }
where { Snippet: { ?snip source_id: ?src } }
then { Snippet/invalidate: [snippet: ?snip; reason: "source content changed"] }

sync quarantine-propagates-to-citations [eventual]
when { Source/quarantine => [source: ?src] -> ok }
where {
  Snippet: { ?snip source_id: ?src }
  Citation: { ?cit snippet_id: ?snip }
}
then { Citation/verify: [citation: ?cit; support_score: 0.0; verification_method: "manual"] }

sync credibility-evaluation-on-capture [eventual]
when { Source/capture => [source: ?src, uri: ?uri] -> ok }
where { Source: { ?src cleaned_content: ?content } }
then { SourceCredibility/evaluate: [source_id: ?src; uri: ?uri; content_sample: ?content] }

sync low-credibility-triggers-quarantine [eventual]
when { SourceCredibility/evaluate => [evaluation: ?e, tier: ?t, score: ?s] -> ok }
where { filter(?t = "quarantine") }
where { SourceCredibility: { ?e source_id: ?src } }
then { Source/quarantine: [source: ?src; reason: "credibility score below quarantine threshold"] }

sync citation-links-create-relations [eager]
when { Citation/link => [citation: ?cit, claim_id: ?claim, snippet_id: ?snip] -> ok }
then { Reference/addRef: [source: ?claim; target: ?snip] }

sync claim-extraction-logs-event [eventual]
when { Claim/extract => [claim: ?c, report_entity_id: ?rep] -> ok }
then { ProcessEvent/emit: [type: "claim_extracted"; payload: ?c] }

sync citation-verified-updates-claim [eager]
when { Citation/verify => [citation: ?cit] -> ok }
where { Citation: { ?cit claim_id: ?claim, support_score: ?score, verification_status: ?vs } }
then { Claim/updateVerification: [claim: ?claim; status: ?vs; support_score: ?score; verified_by: "citation-verifier"] }

sync plan-generation-dispatches-llm [eventual]
when { ResearchPlan/generate => [plan: ?pl, query: ?q, perspectives: ?p, constraints: ?c] -> ok }
-- Wired to LLMCall for plan generation; see process-llm integration syncs.

sync plan-approval-gates-execution [eager]
when { ResearchPlan/approve => [plan: ?pl] -> ok }
where { ResearchPlan: { ?pl project_id: ?proj } }
then { ResearchProject/transition: [project: ?proj; new_status: "executing"] }

sync plan-rejection-suspends-project [eager]
when { ResearchPlan/reject => [plan: ?pl] -> ok }
where { ResearchPlan: { ?pl project_id: ?proj } }
then { ResearchProject/transition: [project: ?proj; new_status: "planning"] }

sync project-budget-tracking [eager]
when { LLMTrace/addMetric => [span_id: ?span, metric_name: "token_count", value: ?tokens] -> ok }
where {
  LLMTrace: { ?span metadata_project_id: ?proj }
  filter(?proj != null)
}
then { ResearchProject/updateBudgetUsage: [project: ?proj; tokens_delta: ?tokens; search_calls_delta: 0] }

sync budget-exceeded-halts-run [eager]
when { ResearchProject/updateBudgetUsage => [project: ?proj] -> budget_exceeded }
where { ResearchProject: { ?proj process_run_id: ?run } }
then { ProcessRun/suspend: [run: ?run; reason: "budget_exceeded"] }

sync contradiction-flag [eventual]
when { Citation/link => [citation: ?cit, claim_id: ?claim, snippet_id: ?snip] -> ok }
where {
  Citation: { ?existing claim_id: ?claim, snippet_id: ?other_snip }
  filter(?other_snip != ?snip)
  Snippet: { ?snip excerpt: ?text1 }
  Snippet: { ?other_snip excerpt: ?text2 }
}
then { Flag/create: [entity: ?claim; reason: "potential_contradiction"; metadata: "Multiple snippets support this claim — verify consistency"] }
```

### 4.2 Cross-Suite Integration Syncs (required: 12)

```
-- Process integration: deep research as ProcessSpec steps

sync research-project-creates-process-run [eager]
when { ResearchProject/transition => [project: ?proj, new_status: "planning"] -> ok }
then { ProcessRun/start: [spec: "deep-research-process"; input: ?proj] }

sync process-run-links-back [eager]
when { ProcessRun/start => [run: ?run, spec: "deep-research-process", input: ?proj] -> ok }
then { ResearchProject/linkProcessRun: [project: ?proj; run: ?run] }

sync step-plan-dispatches-plan-generation [eventual]
when { StepRun/start => [step: ?s, step_type: "research_plan"] -> ok }
where { StepRun: { ?s input_project_id: ?proj } }
where { ResearchProject: { ?proj query: ?q, required_perspectives: ?p, constraints: ?c } }
then { ResearchPlan/generate: [project_id: ?proj; query: ?q; perspectives: ?p; constraints: ?c] }

sync step-gather-dispatches-retrieval [eventual]
when { StepRun/start => [step: ?s, step_type: "source_gathering"] -> ok }
where { StepRun: { ?s input_plan_id: ?plan } }
-- Triggers agent-based retrieval via AgentLoop

sync step-synthesize-dispatches-drafting [eventual]
when { StepRun/start => [step: ?s, step_type: "synthesis_drafting"] -> ok }
-- Triggers LLMCall-based section drafting

sync step-verify-dispatches-evaluation [eventual]
when { StepRun/start => [step: ?s, step_type: "citation_verification"] -> ok }
-- Triggers EvaluationRun with citation-quality evaluator

sync evaluation-gates-report-publish [eager]
when { EvaluationRun/complete => [run: ?ev, pass: ?passed] -> ok }
where {
  filter(?passed = false)
  EvaluationRun: { ?ev evaluator_type: "citation_quality" }
}
then { QualityGate/block: [entity: ?ev; reason: "citation quality gate failed"] }

sync memory-promotion-from-report [eventual]
when { ResearchProject/transition => [project: ?proj, new_status: "completed"] -> ok }
-- Triggers MemoryEntry creation workflow from report findings

-- RAG integration

sync source-indexes-for-retrieval [eventual]
when { Source/capture => [source: ?src] -> ok }
where { Source: { ?src cleaned_content: ?content, uri: ?uri } }
then { DocumentChunk/chunk: [document_id: ?src; content: ?content; metadata: ?uri] }

sync chunks-vectorize [eventual]
when { DocumentChunk/chunk => [document_id: ?doc, chunks: ?chunks] -> ok }
then { VectorIndex/index: [items: ?chunks] }

-- Agent integration

sync research-agent-discovers-tools [eventual]
when { ResearchProject/create => [project: ?proj] -> ok }
then { ToolBinding/register: [name: "capture_source"; schema: "{ uri: string, fetch_method: string }"; tool_type: "concept_action"; target: "Source/capture"] }

sync agent-memory-recalls-entries [eventual]
when { AgentLoop/run => [loop: ?l, context: ?ctx] -> ok }
where { AgentLoop: { ?l metadata_project_id: ?proj } }
then { MemoryEntry/recall: [query: ?ctx] }
```

### 4.3 Sync Tiers Summary

| Tier | Count | Examples |
|---|---|---|
| **Required** | 26 | snippet-invalidation-on-source-change, citation-links-create-relations, budget-exceeded-halts-run, evaluation-gates-report-publish |
| **Recommended** | 10 | credibility-evaluation-on-capture, contradiction-flag, memory-promotion-from-report, source-indexes-for-retrieval |
| **Integration** | 6 | agent-memory-recalls-entries, research-agent-discovers-tools, chunks-vectorize |
| **Total** | **42** | |

---

## 5. Seed ProcessSpec: Deep Research Process Template <!-- MAG-533 -->

```yaml
# seeds/research/deep-research-process.yaml
kind: ProcessSpec
id: deep-research-process
name: Deep Research Process
version: 1
status: active
steps:
  - id: intake
    name: Intake & Scoping
    type: human
    description: User defines deliverable, constraints, allowed sources, perspectives.
    next: [plan_generation]

  - id: plan_generation
    name: Plan Generation
    type: llm
    description: Decompose query into sub-questions with strategies and dependencies.
    next: [plan_review]

  - id: plan_review
    name: Plan Review & Approval
    type: approval
    description: Human reviews and approves or revises the research plan.
    policy: one_of
    next: [source_gathering]

  - id: source_gathering
    name: Source Gathering
    type: llm
    actor_type: ai_autonomous
    description: Web search, file ingestion, connector retrieval. Deduplication and credibility checks.
    next: [snippet_extraction]

  - id: snippet_extraction
    name: Snippet Extraction
    type: llm
    description: Capture key passages with precise locators from gathered sources.
    next: [synthesis_drafting]

  - id: synthesis_drafting
    name: Synthesis & Drafting
    type: llm
    description: Generate report outline, then sections with inline citations to snippets.
    next: [citation_verification]

  - id: citation_verification
    name: Citation Verification & QA
    type: llm
    description: Two-round verification. Round 1 - claim-support NLI. Round 2 - intermediate hallucination detection.
    next: [human_review]

  - id: human_review
    name: Human Review Gate
    type: approval
    description: Human reviews report, resolves unsupported claims, approves for publish.
    policy: one_of
    next: [publish]

  - id: publish
    name: Publish & Memory Consolidation
    type: automation
    description: Finalize report, promote key findings to MemoryEntries.
```

---

## 6. Evaluation Provider Registrations

These register as `evaluator_type` values within the existing **EvaluationRun** concept.

| Evaluator Type | What It Measures | Method | Metric |
|---|---|---|---|
| `citation_coverage` | Every claim has ≥1 citation | Count claims with zero citations | coverage_ratio (0.0–1.0) |
| `citation_faithfulness` | Claim text is supported by cited snippet excerpt | NLI-then-LLM cascade (RAGAS faithfulness) | faithfulness_score (0.0–1.0) |
| `retrieval_relevance` | Retrieved sources match the research query | Embedding similarity + reranking score | context_precision (0.0–1.0) |
| `retrieval_recall` | Retrieved sources cover the query's information need | RAGAS context recall | context_recall (0.0–1.0) |
| `intermediate_hallucination` | Plans, syntheses, and citations don't drift from sources | Round-2 verification: regenerate from sources, compare | drift_score (0.0–1.0) |
| `source_credibility_gate` | All cited sources meet minimum credibility tier | Check SourceCredibility evaluations | min_tier_met (boolean) |

---

## 7. UI Surface: Widgets, Views, Controls, Layouts, Pages <!-- MAG-534, MAG-535 -->

### 7.1 New Schema Seeds (ContentNode type mixins)

```yaml
# seeds/schemas/research-report.yaml
kind: Schema
id: research-report
name: Research Report
description: A structured deep research report with claims and citations.
fields:
  - name: project_id
    type: string
    required: true
  - name: report_status
    type: enum
    values: [draft, verified, published]
  - name: citation_coverage
    type: number
  - name: overall_faithfulness
    type: number
  - name: perspective_summary
    type: list

# seeds/schemas/research-source.yaml
kind: Schema
id: research-source
name: Research Source
description: An externally fetched artifact tracked for evidence anchoring.
fields:
  - name: source_concept_id
    type: string
    required: true
  - name: credibility_tier
    type: enum
    values: [authoritative, reliable, mixed, low_quality, quarantine]
```

### 7.2 Widgets (`.widget` specs)

| Widget | Interactor Type | Purpose | Key Props |
|---|---|---|---|
| **SourceCaptureWidget** | `action-trigger` | Clip a web page or PDF selection into a Source + Snippet pair. Rendered in QuickCapture bar and as a browser-extension-style affordance. | `uri`, `selection_text`, `locator` |
| **SpanToSnippetWidget** | `inline-action` | Convert a text-span highlight in the block editor into a Snippet reference. Piggybacks on Clef Base's existing span addressing + SpanToolbar. | `entity_id`, `block_id`, `offset_start`, `offset_end` |
| **CitationInspectorWidget** | `detail-popover` | Click a citation marker → see exact snippet excerpt, source title, retrieval timestamp, credibility badge, support score. | `citation_id` |
| **CoverageMeterWidget** | `status-indicator` | Per-report coverage gauge showing supported/partial/unsupported claim counts. Driven by Claim.listByReport + Claim.listUnsupported. | `report_entity_id` |
| **CredibilityBadgeWidget** | `badge` | Compact trust-tier indicator (icon + color) for sources. Authoritative=green-shield, Reliable=blue, Mixed=yellow, Low=red, Quarantine=skull. | `source_id`, `tier` |
| **RunTimelineWidget** | `timeline` | Horizontal timeline of orchestrator steps with status icons, duration, tool calls, retries, and human intervention markers. Reads from ProcessEvent stream. | `process_run_id` |
| **ResearchProgressWidget** | `progress-panel` | Overall research progress with current step, time elapsed, tokens/searches used vs budget, expandable reasoning log. | `project_id` |
| **PlanApprovalWidget** | `approval-form` | Interactive plan review: shows sub-questions, allows reordering/editing/adding, approve/reject buttons. | `plan_id` |
| **EvidenceTableWidget** | `data-table` | Claims × citations matrix. Each cell is a citation link; clicking reveals the snippet. Unsupported cells highlighted. | `report_entity_id` |
| **MemoryCardWidget** | `card` | Compact card for a MemoryEntry: text preview, category badge, confidence meter, provenance link. | `entry_id` |

### 7.3 Views (Clef Base View entities)

| View | DataSourceSpec | DisplayMode | Description |
|---|---|---|---|
| **ResearchProjectsView** | `ResearchProject/list` | `card-grid` | Project cards with status, progress bar, quality score, last updated. Filters: status, deliverable type. |
| **SourceLibraryView** | `Source/list` | `table` | Filterable table of all sources. Columns: title, URI, type, credibility badge, snippet count, captured date. |
| **EvidenceGraphView** | Custom graph query: Report → Claims → Citations → Snippets → Sources | `graph` | Force-directed graph showing the full evidence chain. Node colors by entity type. Edge labels show support scores. |
| **ReportBuilderView** | `ContentNode/get` (report entity) | `detail` | Triple-zone: Header (project title + status + coverage meter), Body (block editor with citation markers), Sidebar (CitationInspector, source list, evidence table). |
| **MemoryNotebookView** | `MemoryEntry/recall` | `card-grid` | Grid of memory cards. Filters: category, tags, confidence threshold. Actions: approve, retract, supersede. |
| **ResearchPlanView** | `ResearchPlan/get` | `detail` | Plan outline with sub-questions, dependency arrows, PlanApprovalWidget, perspective assignments. |
| **SourceDetailView** | `Source/get` + `Snippet/listBySource` | `detail` (EntityDetailView) | Triple-zone: Header (source metadata + credibility badge), Body (cleaned content with highlighted snippets), Sidebar (snippet list + credibility evaluation history). |

### 7.4 Controls

| Control | Type | Description |
|---|---|---|
| **SourceFilterControl** | `toggle-group` | Filter sources by: type (web, pdf, document, api), credibility tier, date range, access scope. |
| **CitationFormatControl** | `select` | Choose citation rendering format: inline numbered `[1]`, footnote, APA, IEEE, Chicago. Applied at report level. |
| **BudgetDashboardControl** | `stat-cards` | Three gauges: tokens used/max, search calls used/max, time elapsed/max. Color changes at 80% and 100%. |
| **PerspectiveSelector** | `multi-select` | Choose or define perspectives for the research plan: pre-populated suggestions + free text entry. |
| **VerificationStatusFilter** | `toggle-group` | Filter claims by verification status: all, supported, partial, unsupported, contested. |

### 7.5 Layouts

| Layout | Type | Zones | Usage |
|---|---|---|---|
| **ResearchWorkspaceLayout** | `sidebar` | Main: ReportBuilderView, Sidebar: CitationInspectorWidget + EvidenceTableWidget + SourceFilterControl | Primary research workspace — the "analyst desk." |
| **SplitReviewLayout** | `split` | Left: Report body (read-only), Right: Source detail with highlighted snippet | Side-by-side claim verification. |
| **ResearchDashboardLayout** | `grid` | TopRow: ResearchProgressWidget + BudgetDashboardControl, BottomLeft: RunTimelineWidget, BottomRight: CoverageMeterWidget | At-a-glance research monitoring. |

### 7.6 Pages (DestinationCatalog entries)

| Page | Group | Path | Layout | Description |
|---|---|---|---|---|
| **Research** | Content | `/admin/research` | Grid: ResearchProjectsView | Research projects hub. |
| **Sources** | Content | `/admin/sources` | Stack: SourceLibraryView | Source library with credibility indicators. |
| **Memory** | Content | `/admin/memory` | Stack: MemoryNotebookView | Curated research memory. |
| **Evidence** | Advanced | `/admin/evidence` | Stack: EvidenceGraphView | Evidence chain visualization. |

---

## 8. Concepts Requiring Updates in Existing Suites

| Existing Concept | Change | Reason |
|---|---|---|
| **EvaluationRun** (process-llm) | Add evaluator types: `citation_coverage`, `citation_faithfulness`, `retrieval_relevance`, `retrieval_recall`, `intermediate_hallucination`, `source_credibility_gate` | Research-specific evaluation metrics. No state schema change — these are new enum values for the existing `evaluator_type` field. |
| **ProcessSpec** (process-foundation) | Add step types: `research_plan`, `source_gathering`, `snippet_extraction`, `synthesis_drafting`, `citation_verification` | Research-specific step types in the existing step type enum. |
| **ToolBinding** (llm-agent) | Register research tools at project creation: `capture_source`, `capture_snippet`, `search_web`, `evaluate_credibility` | Agents need research-specific tools. Registration via sync, no concept change. |
| **AgentMemory** (llm-agent) | Add sync to inject MemoryEntry recalls into agent context during research runs | Bridges curated user memory to agent working memory. Sync only, no concept change. |
| **QualityProfile** (Clef Base) | Seed a `research-citation-quality` profile with citation coverage and faithfulness thresholds | Configuration data, no concept change. |
| **SearchIndex** (query-retrieval) | Register web search providers (Tavily, Exa, Google) as SearchIndex providers | Provider registration via PluginRegistry, no concept change. |

---

## 9. Provider Concepts (Coordination + Provider Pattern) <!-- MAG-537 -->

The following use the coordination + provider pattern (concepts with `optional: true` in suite.yaml):

| Coordination Concept | New Provider | Purpose |
|---|---|---|
| **SearchIndex** (existing) | **WebSearchProvider** | Routes web search queries to Tavily, Exa, or Google Search APIs. |
| **SearchIndex** (existing) | **ScholarSearchProvider** | Routes academic search queries to Semantic Scholar, Crossref, or PubMed. |
| **Retriever** (existing, llm-rag) | **CrossEncoderRerankerProvider** | Cross-encoder reranking for fine-grained semantic relevance scoring. |
| **Retriever** (existing, llm-rag) | **MMRDiversityProvider** | Maximal Marginal Relevance selection for informationally diverse retrieval. |
| **DataQuality** (existing, data-integration) | **(seed rules in source-credibility QualityProfile)** | Domain-match, content-analysis, freshness, cross-reference rules — not separate provider concepts, just QualityProfile rule configurations. |
| **ContentCompiler** (existing, foundation) | **ResearchReportCompiler** | Compilation provider for research-report schema: walks block tree, extracts claims, links citations, computes coverage. Registered via PluginRegistry. |

Provider concepts follow the standard pattern: independent state (configuration, credentials, metrics), registered via PluginRegistry, dispatched via routing syncs.

---

## 10. Implementation Plan <!-- MAG-538 -->

> **v2.0 note:** Radically simplified from v1.0. Only 3 new concepts to implement (Claim, Citation, ResearchProject). Everything else uses existing concepts + content-native schemas + syncs + seeds. No multi-language implementation needed for collapsed concepts.

### Card: Content-Native Schemas + Seeds

**Goal:** Define content-native schema YAMLs, init syncs, and seed data for research entity types. Create the deep-research ProcessSpec template. Seed the source-credibility QualityProfile.

| Deliverable |
|---|
| `research-source.schema.yaml` + init sync (§2.4.1) |
| `research-report.schema.yaml` + init sync (§2.4.2) |
| `research-plan.schema.yaml` + init sync (§2.4.3) |
| `research-project.schema.yaml` + init sync (§2.4.4) |
| `deep-research-process` ProcessSpec seed (§5) — configurable step graph, not hardcoded |
| `source-credibility` QualityProfile seed (domain-match, content-analysis, freshness, cross-reference rules) |
| `research-citation-quality` QualityProfile seed (citation coverage + faithfulness thresholds) |
| `standard-research-report` Template seed (default report section blocks) |
| `standard-research-plan` Template seed (default plan structure) |
| `deep-researcher` AgentPersona page seed (default research agent with tools + constitution) |

### Card: New Concept Specs + Handlers

**Goal:** Implement the 3 genuinely new concepts (Claim, Citation, ResearchProject) with TypeScript handlers + conformance tests.

| Deliverable |
|---|
| Claim `.concept` spec (§3.3) + `claim.handler.ts` (functional StorageProgram) + conformance tests |
| Citation `.concept` spec (§3.4) + `citation.handler.ts` (functional StorageProgram) + conformance tests |
| ResearchProject `.concept` spec (§3.6) + `research-project.handler.ts` (functional StorageProgram) + conformance tests |
| ResearchReportCompiler — ContentCompiler provider (walks report block tree → Claim/extract + Citation/link + coverage metrics) |

### Card: Research Syncs

**Goal:** Wire the 3 new concepts into the existing ecosystem through syncs (§4).

| Deliverable |
|---|
| Internal evidence syncs: snippet-invalidation, citation-links-create-relations, citation-verified-updates-claim, quarantine-propagates-to-citations |
| Orchestration syncs: research-project-creates-process-run, budget-exceeded-halts-run, plan-approval-gates-execution |
| Quality syncs: credibility-evaluation-on-capture, evaluation-gates-report-publish, contradiction-flag |
| Memory syncs: memory-promotion-from-report, agent-memory-recalls-entries |
| Persona dispatch syncs: step-dispatches-to-persona (ProcessSpec step → AgentSession/spawn via required_role) |

### Card: Research Widgets + Views

**Goal:** Build the research-specific UI widgets (§7.2) and register Views/Layouts/Pages (§7.3–7.6).

| Deliverable |
|---|
| SourceCaptureWidget, SpanToSnippetWidget, CredibilityBadgeWidget, CitationInspectorWidget |
| CoverageMeterWidget, EvidenceTableWidget, RunTimelineWidget, ResearchProgressWidget |
| PlanApprovalWidget, MemoryCardWidget, BudgetDashboardControl |
| Views: ResearchProjectsView, SourceLibraryView, EvidenceGraphView, ReportBuilderView, MemoryNotebookView, SourceDetailView, ResearchPlanView |
| Layouts: ResearchWorkspaceLayout, SplitReviewLayout, ResearchDashboardLayout, ResearchProcessLayout, ResearchMonitorLayout |
| Pages: Research, Sources, Memory, Evidence (DestinationCatalog entries) |

### Card: Derived Concepts + Integration Tests

**Goal:** Compose derived concepts (§2.3), write operational principle tests, run end-to-end integration.

| Deliverable |
|---|
| EvidenceChain derived concept + operational principle test |
| PlanApproval derived concept + operational principle test |
| CitationVerification derived concept + operational principle test |
| ResearchNotebook derived concept + operational principle test |
| DeepResearch root derived concept + operational principle test |
| End-to-end: project creation → plan generation → approval → source capture → synthesis → citation verification → human review → publish → memory consolidation |
| Performance: 50+ sources, 200+ snippets, full quality pipeline |

---

## 11. Implementation Details

### TypeScript (Primary — Clef Base runtime)

Only 3 new concepts need handler implementations, all functional StorageProgram style in `handlers/ts/`:

- **Claim**: Extract claims from report blocks. `extract` walks report ContentNode block tree via Outline, creates Claim entities per assertable sentence. `link` wires to Citation.
- **Citation**: Link claims to evidence snippets. `verify` dispatches NLI cascade via LLMCall (premise=snippet excerpt, hypothesis=claim text) → if entailment > 0.8, mark verified; else LLM judge fallback.
- **ResearchProject**: Lifecycle management. `create` sets up content-native page + Properties. `transition` enforces status FSM. Budget tracking via `trackUsage` accumulating against max limits.
- **ResearchReportCompiler**: ContentCompiler provider registered via PluginRegistry. `compile` walks report block tree (Outline children with report-section schema), extracts claims via Claim/extract, links citations, computes coverage percentage and faithfulness score.

### Multi-Language (Rust, Swift, Solidity)

The 5 collapsed concepts (Source, Snippet, SourceCredibility, ResearchPlan, MemoryEntry) do NOT need new language implementations — they use existing concepts that already have multi-language handlers. Only the 3 new concepts need Rust/Swift implementations if those targets are prioritized.

---

## 12. Concept Count Summary (v2.0)

| Suite | New Concepts | New Derived | New Syncs | New Schemas | New Providers |
|---|---|---|---|---|---|
| research-evidence | 3 (Claim, Citation, ResearchProject) | 5 | ~26 | 4 (.schema.yaml) | 1 (ResearchReportCompiler) |
| llm-rag (additions) | — | — | 2 | — | 2 (Reranker, MMR) |
| query-retrieval (additions) | — | — | 2 | — | 2 (WebSearch, ScholarSearch) |
| process-llm (additions) | — | — | 2 | — | — |
| **Total new** | **3** | **5** | **~32** | **4** | **5** |

**vs. v1.0:** Reduced from 8 new concepts to 3 by collapsing 5 into existing repertoire concepts + content-native schemas. The 5 collapsed concepts (Source, Snippet, SourceCredibility, ResearchPlan, MemoryEntry) are satisfied by Capture, DataSource, Provenance, existing Snippet, TextSpan, DataQuality, QualityProfile, PlanAndExecuteStrategy, Approval, AgentMemory — all already implemented with handlers.

**Existing concepts leveraged (no new implementation needed):**

| Suite | Concepts Used | Role in Deep Research |
|---|---|---|
| data-integration | Capture, DataSource, Provenance, DataQuality | Source ingestion, registration, lineage, quality gating |
| content | Snippet, TextSpan, VersionPin | Excerpt anchoring, selection, freshness tracking |
| quality-policy | QualityProfile | Source credibility rules as composable profiles |
| testing | QualitySignal | Normalized quality outcome stream |
| llm-agent | AgentSession, AgentTrigger, AgentLoop, AgentMemory, PlanAndExecuteStrategy, Constitution, ToolBinding | Agent execution, triggers, planning, memory, alignment |
| foundation | ContentCompiler, ContentNode, PageAsRecord, Schema, Property, Outline, Template | Content-native infrastructure |
| process-foundation | ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable, ProcessEvent, ExecutionDispatch | Configurable research workflow |
| process-human | Approval, WorkItem | Human-in-the-loop gates |
| process-llm | EvaluationRun, LLMCall | Citation verification, LLM dispatch |
| linking | Reference, Relation, Backlink | Evidence graph structure |
| classification | Schema, Tag | Type overlays, categorization |
| infrastructure | PluginRegistry | Provider dispatch for strategies, compilers, search |

---

## 13. suite.yaml

```yaml
# suites/research-evidence/suite.yaml (v2.0 — 3 new concepts + content-native schemas)
suite:
  name: research-evidence
  version: 0.2.0
  description: >
    Evidence claims, citations, and research orchestration for deep research.
    Uses existing concepts for ingestion (Capture, DataSource), selection
    (Snippet, TextSpan), quality (DataQuality, QualityProfile), planning
    (PlanAndExecuteStrategy), memory (AgentMemory), and process orchestration
    (ProcessSpec, ProcessRun). Only Claim, Citation, and ResearchProject are new.

concepts:
  Claim:
    spec: ./claim.concept
    params:
      C: { as: claim-id, description: "Assertable unit of report content" }
  Citation:
    spec: ./citation.concept
    params:
      I: { as: citation-id, description: "Evidentiary link between claim and snippet" }
  ResearchProject:
    spec: ./research-project.concept
    params:
      P: { as: project-id, description: "Research investigation container" }

schemas:
  - path: ./schemas/research-source.schema.yaml
    description: "Content-native schema for captured research sources"
  - path: ./schemas/research-report.schema.yaml
    description: "Content-native schema for structured research reports with sections"
  - path: ./schemas/research-plan.schema.yaml
    description: "Content-native schema for research plans with sub-question blocks"
  - path: ./schemas/research-project.schema.yaml
    description: "Content-native schema for research project pages"

syncs:
  required:
    - path: ./syncs/research-source-schema-init.sync
    - path: ./syncs/research-report-schema-init.sync
    - path: ./syncs/research-plan-schema-init.sync
    - path: ./syncs/research-project-schema-init.sync
    - path: ./syncs/citation-links-create-relations.sync
    - path: ./syncs/citation-verified-updates-claim.sync
    - path: ./syncs/budget-exceeded-halts-run.sync
    - path: ./syncs/evaluation-gates-report-publish.sync
    - path: ./syncs/research-project-creates-process-run.sync
    - path: ./syncs/step-dispatches-to-persona.sync
      description: "ProcessSpec step → AgentSession/spawn via required_role"
    - path: ./syncs/plan-approval-gates-execution.sync
    - path: ./syncs/report-compilation-provider.sync
      description: "Registers ResearchReportCompiler via PluginRegistry"
  recommended:
    - path: ./syncs/credibility-evaluation-on-capture.sync
    - path: ./syncs/low-credibility-triggers-quarantine.sync
    - path: ./syncs/contradiction-flag.sync
    - path: ./syncs/memory-promotion-from-report.sync
    - path: ./syncs/source-indexes-for-retrieval.sync
  integration:
    - path: ./syncs/agent-memory-recalls-entries.sync
    - path: ./syncs/research-agent-discovers-tools.sync

widgets:
  - path: ./widgets/source-capture.widget
  - path: ./widgets/span-to-snippet.widget
  - path: ./widgets/credibility-badge.widget
  - path: ./widgets/citation-inspector.widget
  - path: ./widgets/coverage-meter.widget
  - path: ./widgets/evidence-table.widget
  - path: ./widgets/run-timeline.widget
  - path: ./widgets/research-progress.widget
  - path: ./widgets/plan-approval.widget
  - path: ./widgets/memory-card.widget
  - path: ./widgets/budget-dashboard.widget

uses:
  - suite: process-foundation
    concepts: [ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable, ProcessEvent, ExecutionDispatch]
  - suite: process-llm
    concepts: [EvaluationRun, LLMCall]
  - suite: process-human
    concepts: [Approval, WorkItem]
  - suite: llm-agent
    concepts: [AgentSession, AgentTrigger, AgentLoop, AgentMemory, PlanAndExecuteStrategy, Constitution, ToolBinding]
  - suite: foundation
    concepts: [ContentCompiler, ContentNode, PageAsRecord, Schema, Property, Outline, Template]
  - suite: data-integration
    concepts: [Capture, DataSource, Provenance, DataQuality]
  - suite: content
    concepts: [Snippet, TextSpan, VersionPin, SyncedContent]
  - suite: quality-policy
    concepts: [QualityProfile]
  - suite: testing
    concepts: [QualitySignal]
  - suite: linking
    concepts: [Reference, Relation, Backlink]
  - suite: classification
    concepts: [Schema, Tag]
  - suite: llm-rag
    optional: true
  - suite: query-retrieval
    optional: true
    concepts: [SearchIndex]
  - suite: infrastructure
    concepts: [PluginRegistry]
  - suite: collaboration
    optional: true
    concepts: [Flag]
```

> **Note:** The `research-memory` suite from v1.0 has been absorbed into research-evidence. Curated memory is the `ResearchNotebook` derived concept (§2.3) composing AgentMemory + Provenance + Approval + Capture + Snippet — no separate suite needed.
