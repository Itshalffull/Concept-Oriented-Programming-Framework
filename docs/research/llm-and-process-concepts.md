# LLM & Process Concepts — Architecture Reference

How Clef's LLM, process, and automation concepts compose into a unified workflow execution system.

---

## Suite Map

```
                          ┌──────────────┐
                          │  automation   │  Event-condition-action rules
                          │  providers    │  Pluggable dispatch backends
                          └──────┬───────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
   ┌──────────▼────────┐ ┌──────▼───────┐ ┌────────▼────────┐
   │ process-foundation │ │   llm-core   │ │   automation    │
   │ (execution kernel) │ │  (providers) │ │ (workflow/rules)│
   └──┬──┬──┬──┬──┬────┘ └──────┬───────┘ └────────┬────────┘
      │  │  │  │  │              │                   │
      │  │  │  │  │    ┌────────┼────────┐          │
      │  │  │  │  │    │        │        │          │
      │  │  │  │  ▼    ▼        ▼        ▼          │
      │  │  │  │ llm- llm-   llm-    llm-          │
      │  │  │  │ agent prompt safety  rag           │
      │  │  │  │                                    │
      │  │  │  ▼                                    │
      │  │  │ process-conversation                  │
      │  │  ▼                                       │
      │  │ process-llm ◄───────────────────────────┘
      │  ▼
      │ process-human
      ▼
   process-automation   process-reliability   process-observability
                        process-verification
```

---

## 1. Process Foundation — The Execution Kernel

**8 concepts** that model how any multi-step process runs.

| Concept | Purpose |
|---------|---------|
| **ProcessSpec [P]** | Versioned process template. Steps have a `type` (human, automation, llm, approval, subprocess, webhook_wait) and edges route between them with conditions and priorities. Lifecycle: draft → active → deprecated. |
| **ProcessRun [R]** | Running instance of a ProcessSpec. Tracks status (pending → running → suspended → completed/failed/cancelled), parent-child for subprocesses, input/output data. |
| **StepRun [S]** | Per-step execution state. Tracks attempts, step type, input/output. Status: pending → ready → active → completed/failed/cancelled/skipped. |
| **FlowToken [K]** | Control-flow position marker enabling parallel branching and join synchronization. A token sits at a step; fork creates multiple tokens; join consumes them. |
| **ProcessVariable [V]** | Typed, scoped data within a run. Steps read/write variables. Merge strategies (replace, append, sum, max, min, custom) handle parallel branch convergence. |
| **ProcessEvent [E]** | Append-only audit stream. Every state change emits an event with type, actor, payload, monotonic sequence number. Enables replay and process mining. |
| **ExecutionDispatch [ED]** | Resolves how a step actually executes. Maps (spec_mode, actor_type) → resolved_mode (work_item, llm_call, agent_loop, chat, approval, subprocess, automation, webhook_wait). |

### Key syncs (22 total)

| Sync | What it does |
|------|-------------|
| `token-activates-step` | FlowToken arrives at step → StepRun/start |
| `parallel-fork` | StepRun completes with multiple outgoing edges → emit multiple FlowTokens |
| `parallel-join` | All tokens at join point consumed → single token continues |
| `subprocess-step-dispatch` | Step type=subprocess → ProcessRun/start_child |
| `child-run-completes` | Child ProcessRun/complete → parent StepRun/complete |
| `run-completion` | All terminal steps done → ProcessRun/complete |
| `data-route` | StepRun output → ProcessVariable writes via edge mappings |
| `execution-mode-resolver` | StepRun/start → ExecutionDispatch/resolve (determines handler) |

---

## 2. Process-LLM — LLM Steps in Workflows

**3 concepts** that make LLM calls first-class process steps.

| Concept | Purpose |
|---------|---------|
| **LLMCall [M]** | Single LLM execution with structured output validation and self-repair. Tracks model, prompts, tools, output_schema, validation_errors, attempt_count, token_usage. Status: pending → requesting → validating → accepted/rejected/repairing. |
| **ToolRegistry [G]** | Registers versioned tool schemas for LLM function calling. Gates which models and processes may invoke which tools via allowed_models/allowed_processes. |
| **EvaluationRun [N]** | Quality evaluation against step outputs. Evaluator types: schema, rubric, llm_judge, regex, custom. Tracks score, threshold, pass/fail. |

### Key syncs (9 total)

```
StepRun/start (type=llm)
    │
    ▼  llm-step-dispatch
LLMCall/request
    │
    ▼  llm-provider-dispatch
LLMProvider/generate  ◄── routes via ModelRouter
    │
    ▼  (completion)
LLMCall/record_response
    │
    ▼  llm-response-validation
LLMCall/validate
    │
    ├── valid   → LLMCall/accept → StepRun/complete
    │
    └── invalid → LLMCall/repair  (feeds errors back as repair prompt)
                     │
                     ▼  llm-repair (loop until max_attempts)
                  LLMCall/request  (retry)
                     │
                     └── exhausted → LLMCall/reject → StepRun/fail
```

The **repair loop** is the defining pattern: validation errors become a repair prompt, the LLM retries with that context, and validation runs again — up to `max_attempts`.

---

## 3. LLM Core — Provider Abstraction

**3 concepts** that abstract over LLM backends.

| Concept | Purpose |
|---------|---------|
| **LLMProvider [P]** | Atomic gateway to any LLM (OpenAI, Anthropic, etc.). Wraps completion, streaming, embedding, token counting. Tracks credentials, default config (temperature, top_p, max_tokens), capabilities, pricing (input/output/cached cost per token), rate limits, status. |
| **ModelRouter [R]** | Routes requests to providers based on quality, cost, latency, availability. Strategies: rule_based, semantic, classifier, cascade. Maintains per-model performance_log and circuit_breakers (failure_count, cooldown_until, threshold). |
| **LLMAutomationProvider** | Registers LLM dispatch as an automation provider. |

### Key syncs

| Sync | What it does |
|------|-------------|
| `router-selects-provider` | Incoming generate request → ModelRouter picks best provider |
| `generation-records-usage` | LLMProvider/generate completion → token/cost metrics recorded |
| `router-circuit-breaker` | Provider failures trip circuit breaker → routes around it |
| `cost-threshold-alert` | Cumulative cost exceeds threshold → notification |

---

## 4. LLM Agent — Autonomous Reasoning

**16 concepts** (6 are pluggable strategy providers) for agent loops, tools, memory, and multi-agent coordination.

### Core agent concepts

| Concept | Purpose |
|---------|---------|
| **AgentLoop [L]** | Coordination for reasoning cycles. Strategy-agnostic — routing syncs resolve strategy string via PluginRegistry at runtime. Actions: create, run, step, observe, interrupt, resume. |
| **ToolBinding [T]** | Callable tool/function registry for LLM invocation. Unifies OpenAI function calling, Anthropic tool use, MCP tools. Safety annotations: audience, destructive, idempotent, open_world. |
| **AgentMemory [E]** | Multi-tier cognitive memory. Working (in-context), episodic (timestamped events), semantic (embeddings), procedural (executable patterns). Agent self-edits memory via tool calls. Consolidation runs during idle. |
| **AgentRole [K]** | Capability declarations for task-agent matching. Supports Contract Net protocol and weighted delegation. |
| **AgentTeam [M]** | Multi-agent coordination. Topologies: hierarchical, pipeline, peer_to_peer, hub_and_spoke, blackboard. Delegation protocols: contract_net, voting, confidence_based, round_robin. |
| **AgentHandoff [D]** | Structured control transfer between agents. Context packaging + tool state transfer + acceptance/rejection. |
| **Blackboard [B]** | Shared communication space for agent teams. |
| **Consensus [N]** | Multi-agent conflict resolution. |
| **Constitution [W]** | Behavioral alignment critiques on agent output. |
| **StateGraph [H]** | Execution graph for complex agent state. |

### Strategy providers (pluggable via PluginRegistry)

| Strategy | Pattern |
|----------|---------|
| **ReactStrategy** | Reason → Act → Observe loop |
| **PlanAndExecuteStrategy** | Plan all steps, then execute sequentially |
| **TreeOfThoughtStrategy** | Explore multiple reasoning branches |
| **ReflectionStrategy** | Self-critique and revise |
| **CodeActStrategy** | Generate and execute code as actions |
| **ReWOOStrategy** | Reason Without Observation (plan tool calls upfront) |

### Key syncs (24 total)

| Sync | What it does |
|------|-------------|
| `agent-loop-dispatches-to-strategy` | AgentLoop/run → PluginRegistry resolves strategy → strategy provider runs |
| `agent-invokes-tool` | AgentLoop/step (action_request variant) → ToolBinding/invoke |
| `tool-result-feeds-agent` | ToolBinding/invoke completion → AgentLoop/observe |
| `agent-remembers-step` | AgentLoop reasoning → AgentMemory/remember |
| `agent-recalls-memory` | AgentLoop/run → AgentMemory/recall |
| `constitution-critiques-output` | Agent output → Constitution/critique → feedback loop |
| `agent-discovers-available-processes` | ProcessSpecs registered as callable tools in ToolBinding |
| `multi-agent-message-passing` | Inter-agent communication in teams |

---

## 5. LLM Prompt — Prompt Engineering Pipeline

**5 concepts** for composing, optimizing, and validating prompts.

| Concept | Purpose |
|---------|---------|
| **Signature [G]** | Declarative I/O signature for prompt templates. |
| **PromptAssembly [P]** | Composes prompts from prioritized sections with token budget. Lowest-priority sections truncated first when over budget. |
| **FewShotExample [F]** | Dynamic few-shot example selection from pools. |
| **PromptOptimizer [O]** | Automatic prompt optimization (DSPy paradigm). Strategies: bootstrap_few_shot, mipro_v2, copro, opro, evolutionary. Tracks training_set, history, best_candidate, budget. |
| **Assertion [T]** | Computational constraints and validation rules for prompts. |

### Derived: PromptPipeline

Composes PromptAssembly + FewShotExample + PromptOptimizer + LLMProvider into an end-to-end prompt engineering pipeline.

---

## 6. LLM Safety — Guardrails and Tracing

**3 concepts** for safety enforcement and observability.

| Concept | Purpose |
|---------|---------|
| **Guardrail [G]** | Safety layer validating LLM inputs and outputs. Types: content_filter, topic_restriction, pii_detection, prompt_injection, format_validation, custom_predicate. Actions: block, warn, redact, escalate. |
| **LLMTrace [Z]** | Hierarchical trace spans for every LLM call, tool invocation, retrieval, agent step. Tracks latency, token_usage, cost, quality metrics. Parent-child spans. OpenTelemetry export. |
| **SemanticRouter [S]** | Routes inputs to appropriate safety/processing pipelines by semantic intent. |

### Derived: SafeAgent

Wraps AgentLoop + ToolBinding + Guardrail + LLMTrace. Every tool invocation passes guardrail check; violations recorded in trace.

---

## 7. LLM RAG — Retrieval-Augmented Generation

**3 concepts** for document retrieval.

| Concept | Purpose |
|---------|---------|
| **DocumentChunk [D]** | Intelligent document chunking strategies. |
| **VectorIndex [X]** | Vector storage and similarity search. |
| **Retriever [R]** | Multi-stage retrieval with reranking. |

### Derived: RAGPipeline

Composes DocumentChunk → VectorIndex → Retriever. Surface actions: indexDocument, search, retrieve.

### Derived: ConversationalRAG

Combines RAGPipeline + Conversation + PromptPipeline for dialogue grounded in documents.

---

## 8. LLM Conversation — Dialogue Management

| Concept | Purpose |
|---------|---------|
| **Conversation [C]** | Persistent, branching message sequence. Supports forking (multiversal branching), truncation for context windows, auto-summarization. Tree/DAG structure eliminates context pollution. Tracks participants, token_count, tags. |

---

## 9. LLM Training — Fine-tuning Lifecycle

| Concept | Purpose |
|---------|---------|
| **TrainingRun [J]** | Fine-tuning lifecycle management. |
| **Adapter [A]** | Parameter-efficient adaptation (LoRA/QLoRA) with merge and provider registration. |
| **EvaluationDataset [V]** | Golden datasets for behavioral testing with drift detection. |

---

## 10. Process-Human — Human Task Lifecycle

**3 concepts** for human-in-the-loop steps.

| Concept | Purpose |
|---------|---------|
| **WorkItem [W]** | Human task lifecycle. Status: offered → claimed → active → completed/rejected/delegated/released. Tracks assignee, candidate_pool, form_schema, priority, due_at. |
| **Approval [A]** | Multi-party authorization gate. Policies: one_of, all_of, n_of_m. Tracks decisions (approve, deny, request_changes). |
| **Escalation [L]** | Redirects work when normal handling fails. Trigger types: timeout, condition, manual, retry_exhausted. |

---

## 11. Process-Automation — External Integration

**5 concepts** for calling external systems and handling inbound events.

| Concept | Purpose |
|---------|---------|
| **ConnectorCall [C]** | Outbound call to external systems (http, grpc, database, mq, fs) with idempotency keys. |
| **WebhookInbox [H]** | Inbound event correlation. Matches incoming webhooks to waiting process steps via correlation keys. |
| **Timer [T]** | Time-based triggers (date, duration, cycle per ISO 8601). |

---

## 12. Process-Reliability — Fault Tolerance

| Concept | Purpose |
|---------|---------|
| **RetryPolicy [Y]** | Retry/backoff rules for failed steps. Configures max_attempts, backoff_coefficient, non_retryable_errors. |
| **CompensationPlan [X]** | Saga-style rollback. Compensating actions registered during execution, run in reverse on failure. |
| **Checkpoint [Z]** | Full state snapshots for recovery and time-travel debugging. |

---

## 13. Process-Observability — Monitoring

| Concept | Purpose |
|---------|---------|
| **Milestone [I]** | Declarative goal tracking. Evaluates condition_expr against process variables. |
| **ProcessMetric [Q]** | Aggregated performance metrics (durations, retry counts) for dashboards and SLA monitoring. |

---

## 14. Process-Verification — Quality Checks

| Concept | Purpose |
|---------|---------|
| **CheckVerification [CV]** | Evaluation of checks attached to steps. Mode: automated, human, llm, rollup. Supports hierarchical rollup where parent checks aggregate child results. |

---

## 15. Process-Conversation — Chat-Driven Processes

| Concept | Purpose |
|---------|---------|
| **ProcessConversation [PC]** | Bridges a Conversation to a ProcessRun. Chat messages drive step transitions. Mode: guided (structured) or freeform. Supports rewinding via checkpoint + version space forking. |

---

## 16. Automation — Rules and Workflows

| Concept | Purpose |
|---------|---------|
| **Workflow** | Finite state machine with guarded transitions. |
| **AutomationRule** | Event-condition-action rules that fire automatically. |
| **Queue** | Queued action execution. |
| **Control** | UI controls for event-driven automation. |

### Derived: ScheduledJob

Combines AutomationRule + Queue + Control for recurring automated tasks.

---

## 17. Automation Providers — Pluggable Dispatch

| Concept | Purpose |
|---------|---------|
| **AutomationDispatch [AD]** | Routes automation actions to the correct provider. |
| **AutomationScope [AS]** | Allowlist/denylist gating for what automation can do. |
| **ManifestAutomationProvider** | Build-time manifest-based provider. |
| **SyncAutomationProvider** | Runtime user-defined sync provider. |

---

## Cross-Cutting Interaction Patterns

### Pattern 1: Step-Type Dispatch

Every step in a ProcessSpec has a `step_type`. When a StepRun starts, **ExecutionDispatch** resolves the concrete execution mode by cross-referencing the spec's step_type with the actor_type:

**Resolution matrix** (spec_mode × actor_type → resolved_mode):

| spec_mode \ actor_type | human | ai_autonomous | ai_triggered | ai_conversational |
|------------------------|-------|---------------|--------------|-------------------|
| human | work_item | agent_loop | llm_call | chat |
| automation | automation | agent_loop | llm_call | chat |
| llm | llm_call | agent_loop | llm_call | chat |
| approval | approval | approval | approval | approval |
| subprocess | subprocess | subprocess | subprocess | subprocess |
| webhook_wait | webhook_wait | webhook_wait | webhook_wait | webhook_wait |

The resolved_mode then routes to the handler concept:

```
StepRun/start
    │
    ▼  execution-mode-resolver
ExecutionDispatch/resolve(step, actor, spec_mode, actor_type)
    │
    ├── resolved=llm_call    → LLMCall/request         (process-llm)
    ├── resolved=work_item   → WorkItem/create          (process-human)
    ├── resolved=approval    → Approval/request         (process-human)
    ├── resolved=automation  → ConnectorCall/invoke      (process-automation)
    ├── resolved=subprocess  → ProcessRun/start_child    (process-foundation)
    ├── resolved=webhook_wait→ WebhookInbox/wait        (process-automation)
    ├── resolved=chat        → ProcessConversation/start (process-conversation)
    └── resolved=agent_loop  → AgentLoop/create          (llm-agent)
```

An `override` action allows manually replacing the resolved mode with justification (audit trail).

### Pattern 2: Agent as Process Participant

Agents discover and invoke processes:

```
ProcessSpec/publish
    │
    ▼  agent-discovers-available-processes
ToolBinding/register  (process becomes a callable tool)
    │
    ... later ...
    │
AgentLoop/step  (action_request: invoke process)
    │
    ▼  agent-invokes-tool
ToolBinding/invoke
    │
    ▼  (tool is a process)
ProcessRun/start
```

### Pattern 3: LLM Validation-Repair Loop

```
LLMCall/request → LLMProvider/generate → LLMCall/record_response
    │
    ▼
LLMCall/validate
    │
    ├── pass → LLMCall/accept → StepRun/complete
    │
    └── fail → LLMCall/repair (error context added to prompt)
                 │
                 ▼
              LLMCall/request  (retry, attempt_count < max_attempts)
                 │
                 └── exhausted → LLMCall/reject → StepRun/fail
```

### Pattern 4: Conversational Process Execution

```
ProcessRun/start
    │
    ▼  process-start-creates-conversation
ProcessConversation/start  +  Conversation/create
    │
    ▼  (user sends message)
Conversation/append
    │
    ▼  conversation-step-advance
StepRun/complete  →  next step activated
    │
    ├── type=llm  → LLMCall handles it
    ├── type=chat → continues conversation
    └── type=human → WorkItem created
```

### Pattern 5: Safety Wrapping

```
User input
    │
    ▼  guardrail-checks-input
Guardrail/check (content_filter, pii_detection, prompt_injection)
    │
    ├── pass → LLMProvider/generate
    │              │
    │              ▼  guardrail-checks-output
    │         Guardrail/check (output validation)
    │              │
    │              ├── pass → return to caller
    │              └── fail → block/redact/escalate
    │
    └── fail → block/redact/escalate
```

### Pattern 6: Observability Chain

Every LLM interaction traces through LLMTrace:

```
LLMProvider/generate
    │
    ▼  generation-creates-trace-span
LLMTrace/startSpan → endSpan (with latency, tokens, cost)
    │
    ▼  trace-records-cost
LLMTrace/addMetric (cumulative cost tracking)
    │
    ▼  trace-exports-opentelemetry
External observability platform
```

### Pattern 7: Multi-Agent Delegation

```
AgentTeam/delegate (topology: hierarchical)
    │
    ▼  team-delegates-via-role
AgentRole/bid  (agents bid on subtask)
    │
    ▼  (best match selected)
AgentHandoff/prepare  →  execute
    │
    ▼  handoff-packages-context
Target AgentLoop/create  (with transferred context + tools)
    │
    ... work done ...
    │
    ▼  multi-agent-message-passing
AgentTeam/synthesize  (merge results)
```

---

## Concept Count Summary

| Suite | Concepts | Syncs | Derived |
|-------|----------|-------|---------|
| process-foundation | 8 | 22 | — |
| process-llm | 3 | 9 | — |
| process-human | 3 | 7 | — |
| process-automation | 5 | 12 | — |
| process-reliability | 3 | 5 | — |
| process-observability | 2 | 2 | — |
| process-verification | 1 | 4 | — |
| process-conversation | 2 | 7 | — |
| llm-core | 3 | 4 | — |
| llm-agent | 16 | 24 | SafeAgent |
| llm-prompt | 5 | 5 | PromptPipeline |
| llm-safety | 3 | 6 | — |
| llm-rag | 3 | 6 | RAGPipeline, ConversationalRAG |
| llm-training | 3 | 3 | — |
| llm-conversation | 1 | 3 | — |
| automation | 4 | 8 | ScheduledJob |
| automation-providers | 4 | 6 | — |
| **Total** | **~69** | **~133** | **6** |
