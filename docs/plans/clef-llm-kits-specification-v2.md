# Clef LLM Suites — Complete Specification v2

**Version:** 0.2.0
**Date:** 2026-02-28
**Status:** Implementation-Ready Reference

---

## 1. Overview

This document defines **24 concepts** (16 core + 8 coordination/provider), **19 provider/plugin extensions** to existing Clef concepts, **6 strategy providers**, **35+ syncs**, and **3 composite suites** for full LLM integration into the Clef framework.

### 1.1 Changes from v0.1.0

**Removed (failed concept test):**
- TokenBudget → absorbed into PromptAssembly
- ChatMessage → ContentNode + ChatMessageNodeProvider
- Embedding → LLMProvider.embed + config on VectorIndex/Retriever
- Persona → Template + ChatPromptProvider
- StructuredOutput → Schema (OutputSchemaProvider) + Validator (OutputValidatorProvider) + Assertion
- RewardModel → LLMTrace evaluator plugin + Collection provider

**Added (missing coverage):**
- StateGraph — graph-based orchestration with typed state, conditional edges, cycles, checkpoints
- AgentTeam — multi-agent group coordination with topology patterns
- AgentRole — capability declaration, bidding, task-agent matching
- Blackboard — shared async knowledge repository for multi-agent work
- AgentHandoff — structured transfer of control between agents
- Consensus — multi-agent voting, confidence-based resolution, iterative refinement
- TrainingRun — fine-tuning job lifecycle
- Adapter — LoRA/QLoRA weight management
- EvaluationDataset — golden datasets for continuous behavioral testing
- 6 AgentLoop strategy providers (React, PlanAndExecute, TreeOfThought, Reflection, CodeAct, ReWOO)

**Restructured:**
- AgentLoop becomes a coordination concept dispatching to strategy providers via PluginRegistry

### 1.2 Suite Inventory

| Suite | Location | Core Concepts | Coordination Concepts | Providers |
|-------|----------|--------------|----------------------|-----------|
| LLM Core | `suites/llm-core/` | LLMProvider, ModelRouter | — | — |
| LLM Conversation | `suites/llm-conversation/` | Conversation | — | — |
| LLM Prompt | `suites/llm-prompt/` | Signature, PromptAssembly, FewShotExample, PromptOptimizer, Assertion | — | — |
| LLM Agent | `suites/llm-agent/` | StateGraph, AgentMemory, ToolBinding, AgentTeam, AgentRole, Blackboard, AgentHandoff, Consensus, Constitution | AgentLoop | React, PlanAndExecute, TreeOfThought, Reflection, CodeAct, ReWOO |
| LLM RAG | `suites/llm-rag/` | VectorIndex, Retriever, DocumentChunk | — | — |
| LLM Safety | `suites/llm-safety/` | Guardrail, LLMTrace, SemanticRouter | — | — |
| LLM Training | `suites/llm-training/` | TrainingRun, Adapter, EvaluationDataset | — | — |

### 1.3 Composite Suites

| Composite Suite | Included Suites | Purpose |
|----------------|-----------------|---------|
| Constitutional Alignment Suite | LLM Agent + LLM Safety + LLM Training | RLAIF / Critique-Revision alignment pipelines |
| Canary Deployment & Evaluation Suite | LLM Training + LLM Safety + Deploy Suite | Shadow mode, A/B prompt testing, continuous evaluation |
| Multi-Agent Topology Suite | LLM Agent + LLM Conversation + Automation Suite | Pre-configured patterns: Hierarchical, Pipeline, Peer-to-Peer, Hub-and-Spoke, Blackboard |

### 1.4 Provider Extensions to Existing Concepts

19 existing Clef concepts gain LLM capabilities through new provider registrations. See Section 10.

### 1.5 Architectural Principles

All concepts follow Clef's core rules:
- **Total independence** — No concept references another's state, types, or actions
- **Sync-only coordination** — All inter-concept wiring is in `.sync` files
- **Sovereign storage** — Each concept owns its data
- **Spec-first** — Every concept begins as a `.concept` spec
- **Return variants** — Every action enumerates all outcomes explicitly
- **Coordination + Provider** — Strategy-varying concepts dispatch via PluginRegistry; providers register themselves; coordination concepts hold no awareness of which providers exist

---

## 2. LLM Core Suite

### 2.1 Suite Manifest

```yaml
suite:
  name: llm-core
  version: 0.1.0
  description: "Foundation primitives for LLM model interaction: provider abstraction and intelligent model routing."

concepts:
  LLMProvider:
    spec: ./llm-provider.concept
    params:
      P: { as: provider-id, description: "Provider instance identifier" }
  ModelRouter:
    spec: ./model-router.concept
    params:
      R: { as: route-id, description: "Route definition identifier" }

syncs:
  required:
    - router-selects-provider.sync
    - generation-records-usage.sync
  recommended:
    - router-circuit-breaker.sync
    - cost-threshold-alert.sync
  integration:
    - provider-registers-in-plugin-registry.sync
    - provider-health-to-eventbus.sync

uses:
  - suite: infrastructure
    optional: true
    concepts:
      - name: PluginRegistry
      - name: EventBus
      - name: Cache
      - name: Queue
  - suite: automation
    optional: true
    concepts:
      - name: AutomationRule
```

### 2.2 Concept: LLMProvider

```
@version(1)
concept LLMProvider [P] {

  purpose {
    Atomic gateway to any large language model. Wraps provider-specific
    APIs behind a uniform interface for completion, streaming, embedding,
    and token counting. Stateless per-call: holds configuration and
    credentials but no conversation history.
  }

  state {
    providers: set P
    provider_id: P -> String
    model_id: P -> String
    api_credentials: P -> Bytes
    default_config: P -> {
      temperature: Float,
      top_p: Float,
      max_tokens: Int,
      stop_sequences: list String
    }
    capabilities: P -> set String
    pricing: P -> {
      input_cost_per_token: Float,
      output_cost_per_token: Float,
      cached_cost_per_token: option Float
    }
    rate_limits: P -> {
      requests_per_minute: Int,
      tokens_per_minute: Int
    }
    status: P -> String
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action register(provider_id: String, model_id: String,
                    credentials: Bytes,
                    config: {temperature: Float, top_p: Float,
                             max_tokens: Int, stop_sequences: list String},
                    capabilities: set String) {
      -> ok(provider: P) {
        Creates a new provider instance. Encrypts credentials at rest.
        Sets status to "available". Validates model_id is recognized.
        Capabilities include: chat, completion, embedding, vision,
        tool_calling, structured_output, streaming.
      }
      -> invalid(message: String) {
        Model ID not recognized or credentials fail validation.
      }
    }

    action generate(provider: P,
                    messages: list {role: String, content: String},
                    config: option {temperature: Float, top_p: Float,
                                   max_tokens: Int}) {
      -> ok(response: {content: String, model: String,
            prompt_tokens: Int, completion_tokens: Int,
            finish_reason: String, cost: Float}) {
        Sends messages to the LLM. Applies provider-specific format
        translation internally. Merges call-level config over defaults.
        Calculates cost from pricing. Normalizes response across providers.
      }
      -> rate_limited(retry_after_ms: Int) {
        Provider returned 429.
      }
      -> context_overflow(max_tokens: Int, requested_tokens: Int) {
        Input exceeds model context window.
      }
      -> auth_failure(message: String) {
        Credentials expired or invalid.
      }
      -> content_filtered(message: String) {
        Provider safety filter blocked the request.
      }
      -> unavailable(message: String) {
        Provider is degraded or unreachable.
      }
    }

    action stream(provider: P,
                  messages: list {role: String, content: String},
                  config: option {temperature: Float, top_p: Float,
                                 max_tokens: Int}) {
      -> ok(stream_id: String) {
        Initiates streaming generation. Returns a stream identifier.
        Events emitted: text_delta, tool_call_start, tool_call_delta,
        tool_call_end, reasoning_delta, message_complete, error.
      }
      -> rate_limited(retry_after_ms: Int) {
        Provider returned 429.
      }
      -> unavailable(message: String) {
        Provider unreachable.
      }
    }

    action embed(provider: P, texts: list String) {
      -> ok(vectors: list {vector: list Float, dimensions: Int}) {
        Generates embedding vectors using the provider's embedding model.
        Batches internally for efficiency. Handles model-specific concerns:
        different dimension sizes, query vs. document input types.
      }
      -> error(message: String) {
        Embedding model unavailable or input too long.
      }
    }

    action countTokens(provider: P, content: String) {
      -> ok(count: Int, tokenizer: String) {
        Counts tokens using the model-specific tokenizer (cl100k_base
        for GPT-4, o200k_base for GPT-4o, approximate BPE for others).
      }
      -> error(message: String) {
        Tokenizer unavailable for this provider.
      }
    }

    action healthCheck(provider: P) {
      -> ok(status: String, latency_ms: Int) {
        Pings the provider API. Updates status state field.
      }
      -> degraded(message: String, latency_ms: Int) {
        Elevated latency or partial failures.
      }
      -> unavailable(message: String) {
        Not responding.
      }
    }

    action updateConfig(provider: P,
                        config: {temperature: Float, top_p: Float,
                                 max_tokens: Int,
                                 stop_sequences: list String}) {
      -> ok(provider: P) {
        Updates default configuration.
      }
      -> notfound(message: String) {
        Provider not registered.
      }
    }
  }

  invariant {
    after register(provider_id: "test", model_id: "gpt-4",
                   credentials: c, config: cfg, capabilities: caps)
      -> ok(provider: p)
    then healthCheck(provider: p) -> ok(status: "available", latency_ms: _)
  }
}
```

### 2.3 Concept: ModelRouter

```
@version(1)
concept ModelRouter [R] {

  purpose {
    Decides which LLM handles each request based on quality requirements,
    cost constraints, latency needs, and current availability. Separates
    model selection from model invocation. Supports rule-based, semantic,
    classifier, and cascade routing. Tracks per-model performance and
    manages circuit breakers for failing models.
  }

  state {
    routes: set R
    route_name: R -> String
    model_id: R -> String
    conditions: R -> {
      task_types: list String,
      complexity_threshold: option Float,
      max_cost_per_call: option Float,
      max_latency_ms: option Int
    }
    priority: R -> Int
    weight: R -> Float
    fallback_chain: list String
    routing_strategy: String
    performance_log: R -> {
      success_rate: Float,
      avg_latency_ms: Float,
      avg_cost: Float,
      total_calls: Int
    }
    circuit_breakers: R -> {
      failure_count: Int,
      cooldown_until: option DateTime,
      threshold: Int
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action addRoute(name: String, model_id: String,
                    conditions: {task_types: list String,
                                 complexity_threshold: option Float,
                                 max_cost_per_call: option Float,
                                 max_latency_ms: option Int},
                    priority: Int, weight: Float) {
      -> ok(route: R) {
        Registers a new route. Evaluated in priority order. Weight
        used for probabilistic load balancing among equal-priority routes.
      }
      -> duplicate(message: String) {
        Route name already exists.
      }
    }

    action route(task_type: String, complexity: option Float,
                 cost_limit: option Float, latency_limit: option Int) {
      -> ok(model_id: String, route: R) {
        Selects optimal model. Evaluates routes in priority order.
        Skips circuit-broken routes. For cascade: starts cheapest,
        escalates on quality check failure.
      }
      -> no_route(message: String) {
        No route matches or all are circuit-broken.
      }
    }

    action fallback(failed_model_id: String, error_type: String) {
      -> ok(next_model_id: String) {
        Returns next model in fallback chain. Increments failure_count.
        Activates circuit breaker if threshold exceeded.
      }
      -> exhausted(message: String) {
        All fallback models tried or circuit-broken.
      }
    }

    action recordOutcome(route: R, success: Bool, latency_ms: Int,
                         tokens: Int, cost: Float) {
      -> ok(route: R) {
        Updates performance_log. Resets circuit breaker on success.
      }
      -> notfound(message: String) {
        Route not found.
      }
    }

    action getHealth() {
      -> ok(statuses: list {route: String, model_id: String,
            status: String, circuit_breaker_active: Bool,
            success_rate: Float}) {
        Health status of all routes and models.
      }
    }
  }

  invariant {
    after addRoute(name: "fast", model_id: "gpt-4o-mini",
                   conditions: c, priority: 1, weight: 1.0) -> ok(route: r)
    then route(task_type: "chat", complexity: _, cost_limit: _,
               latency_limit: _) -> ok(model_id: "gpt-4o-mini", route: r)
  }
}
```

---

## 3. LLM Conversation Suite

### 3.1 Suite Manifest

```yaml
suite:
  name: llm-conversation
  version: 0.1.0
  description: "Multi-turn LLM dialogue management with multiversal branching, context window strategies, and automatic summarization."

concepts:
  Conversation:
    spec: ./conversation.concept
    params:
      C: { as: conversation-id, description: "Conversation thread identifier" }

syncs:
  required:
    - conversation-counts-tokens.sync
  recommended:
    - conversation-auto-summarize.sync
  integration:
    - conversation-collection-provider.sync

uses:
  - suite: llm-core
    concepts:
      - name: LLMProvider
  - suite: foundation
    optional: true
    concepts:
      - name: ContentNode
```

### 3.2 Concept: Conversation

```
@version(1)
concept Conversation [C] {

  purpose {
    Persistent, branching sequence of messages representing a dialogue
    thread. Manages appending, forking for exploration (Loom/multiversal
    branching), truncating to fit context windows, and summarizing old
    context. The session manager for LLM interactions. Tree/DAG structure
    eliminates context pollution by scoping each branch to its own lineage.
  }

  state {
    conversations: set C
    messages: C -> list {id: String, role: String, content: String,
                         parts: option list {type: String, data: String},
                         tool_calls: option list {id: String,
                           function_name: String, arguments: String},
                         metadata: option {model: String, tokens: Int,
                           cost: Float, finish_reason: String},
                         timestamp: DateTime}
    branches: C -> list {branch_id: String, parent_message_id: String,
                         message_ids: list String}
    active_branch: C -> option String
    context_strategy: C -> String
    summary: C -> option String
    node_metadata: C -> list {message_id: String,
                              model_params: option String,
                              logprobs: option String}
    metadata {
      created_at: C -> DateTime
      updated_at: C -> DateTime
      participant_ids: C -> list String
      tags: C -> list String
    }
    token_count: C -> Int
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(context_strategy: String) {
      -> ok(conversation: C) {
        Creates a conversation. Strategy: sliding_window (most recent N
        messages that fit), summary_buffer (summary + recent messages),
        vector_retrieval (semantically relevant past messages), hybrid.
      }
      -> invalid(message: String) {
        Unknown context strategy.
      }
    }

    action append(conversation: C, role: String, content: String,
                  parts: option list {type: String, data: String},
                  tool_calls: option list {id: String,
                    function_name: String, arguments: String},
                  metadata: option {model: String, tokens: Int,
                    cost: Float, finish_reason: String}) {
      -> ok(message_id: String) {
        Adds message to active branch. Role: system, user, assistant,
        tool, developer. Parts support multi-modal content: text,
        image, audio, tool_call, tool_result, thinking, file_citation.
        Increments token_count. Updates timestamps.
      }
      -> notfound(message: String) {
        Conversation not found.
      }
    }

    action fork(conversation: C, from_message_id: String) {
      -> ok(branch_id: String) {
        Creates a new branch from the specified message. New branch
        inherits lineage from root to from_message_id. Subsequent
        appends go to this branch. The new lineage ignores context
        from abandoned paths — eliminates context pollution.
      }
      -> notfound(message: String) {
        Conversation or message not found.
      }
    }

    action switchBranch(conversation: C, branch_id: String) {
      -> ok(conversation: C) {
        Changes active branch. Future appends and context window
        calculations use this branch's lineage.
      }
      -> notfound(message: String) {
        Branch not found.
      }
    }

    action merge(conversation: C, branch_ids: list String,
                 strategy: String) {
      -> ok(conversation: C) {
        Combines branches. Strategy: interleave (chronological),
        concatenate (sequential), summarize (LLM synthesis of both).
      }
      -> conflict(message: String) {
        Contradictory context cannot be auto-merged.
      }
    }

    action prune(conversation: C, branch_id: String) {
      -> ok(conversation: C) {
        Removes a branch and all its messages.
      }
      -> notfound(message: String) {
        Branch not found.
      }
    }

    action getContextWindow(conversation: C, max_tokens: Int) {
      -> ok(messages: list {role: String, content: String},
            total_tokens: Int) {
        Selects messages for the next LLM call within budget.
        Applies context_strategy. Always includes system message.
        Uses only active branch lineage.
      }
      -> empty(message: String) {
        Conversation has no messages.
      }
    }

    action summarize(conversation: C, message_ids: list String) {
      -> ok(summary: String, tokens_saved: Int) {
        Compresses specified messages into a summary. Original
        messages retained but excluded from future context windows.
      }
      -> notfound(message: String) {
        Conversation not found.
      }
    }

    action getLineage(conversation: C, message_id: String) {
      -> ok(ancestry: list String) {
        Ordered message IDs from root to the specified message,
        following the branch path. This is the context the LLM sees.
      }
      -> notfound(message: String) {
        Message not found in tree.
      }
    }

    action serialize(conversation: C, format: String) {
      -> ok(serialized: String) {
        Converts active lineage to provider-specific format.
        Format: openai, anthropic, vercel, generic.
      }
      -> notfound(message: String) {
        Conversation not found.
      }
    }
  }

  invariant {
    after create(context_strategy: "sliding_window") -> ok(conversation: c)
    and  append(conversation: c, role: "user", content: "hello",
                parts: _, tool_calls: _, metadata: _) -> ok(message_id: m)
    then getContextWindow(conversation: c, max_tokens: 1000)
         -> ok(messages: _, total_tokens: _)
  }
}
```

---

## 4. LLM Prompt Suite

### 4.1 Suite Manifest

```yaml
suite:
  name: llm-prompt
  version: 0.1.0
  description: "Prompt construction, declarative I/O signatures, dynamic few-shot selection, automatic prompt optimization, and computational constraints."

concepts:
  Signature:
    spec: ./signature.concept
    params:
      G: { as: signature-id, description: "Signature definition identifier" }
  PromptAssembly:
    spec: ./prompt-assembly.concept
    params:
      P: { as: assembly-id, description: "Prompt assembly identifier" }
  FewShotExample:
    spec: ./few-shot-example.concept
    params:
      F: { as: example-id, description: "Example pool identifier" }
  PromptOptimizer:
    spec: ./prompt-optimizer.concept
    params:
      O: { as: optimizer-id, description: "Optimizer run identifier" }
  Assertion:
    spec: ./assertion.concept
    params:
      T: { as: assertion-id, description: "Assertion rule identifier" }

syncs:
  required:
    - assembly-checks-budget.sync
    - assembly-selects-examples.sync
    - signature-compiles-to-assembly.sync
  recommended:
    - optimizer-evaluates-via-trace.sync
    - assertion-triggers-retry.sync
  integration:
    - prompt-version-tracking.sync

uses:
  - suite: llm-core
    concepts:
      - name: LLMProvider
  - suite: content
    optional: true
    concepts:
      - name: Template
```

### 4.2 Concept: Signature

```
@version(1)
concept Signature [G] {

  purpose {
    Declarative definition of an input-output transformation schema for
    LLM calls. Replaces raw string prompts as the foundational unit of
    model instruction. Developer specifies WHAT (input/output fields,
    optional instruction); the compilation engine discovers the optimal
    prompt formulation for the target model. Recompile for model portability.
  }

  state {
    signatures: set G
    name: G -> String
    input_fields: G -> list {name: String, type: String,
                             description: option String}
    output_fields: G -> list {name: String, type: String,
                              description: option String}
    instruction: G -> option String
    module_type: G -> String
    compiled_prompts: G -> list {model_id: String, prompt: String}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action define(name: String,
                  input_fields: list {name: String, type: String,
                                     description: option String},
                  output_fields: list {name: String, type: String,
                                      description: option String},
                  instruction: option String, module_type: String) {
      -> ok(signature: G) {
        Module type: predict (simple I/O), chain_of_thought (rationale
        before answer), react (reasoning + tool actions), program_of_thought
        (generates code to compute answer).
      }
      -> invalid(message: String) {
        Missing input or output fields.
      }
    }

    action compile(signature: G, model_id: String,
                   examples: option list {input: String, output: String}) {
      -> ok(compiled_prompt: String) {
        Compiles to optimized prompt for target model. Includes generated
        instruction (if absent), field descriptions, format directives,
        and demonstrations. Stores in compiled_prompts.
      }
      -> error(message: String) {
        Compilation failed.
      }
    }

    action execute(signature: G, model_id: String,
                   inputs: list {field: String, value: String}) {
      -> ok(outputs: list {field: String, value: String}) {
        Executes compiled signature. Chain_of_thought outputs include
        rationale field. React outputs include action_trace.
      }
      -> validation_error(field: String, message: String) {
        Output field failed type validation.
      }
      -> not_compiled(message: String) {
        No compiled prompt for this model_id.
      }
    }

    action recompile(signature: G, target_model: String) {
      -> ok(compiled_prompt: String) {
        Recompiles for a different model without changing the definition.
      }
      -> error(message: String) {
        Recompilation failed.
      }
    }
  }

  invariant {
    after define(name: "QA", input_fields: [{name: "context", type: "String",
                 description: _}, {name: "question", type: "String",
                 description: _}],
                 output_fields: [{name: "answer", type: "String",
                 description: _}],
                 instruction: _, module_type: "chain_of_thought")
      -> ok(signature: g)
    then compile(signature: g, model_id: "gpt-4o", examples: _)
      -> ok(compiled_prompt: _)
  }
}
```

### 4.3 Concept: PromptAssembly

```
@version(1)
concept PromptAssembly [P] {

  purpose {
    Composes a complete LLM prompt from independent sections: system
    instructions, persona directives, few-shot examples, retrieved context,
    user input, and output format directives. The layout manager — handles
    structural semantics, section ordering, token allocation per section,
    priority-based truncation under budget pressure, and the rendering
    pipeline. Absorbs token budget management: each section has a
    max_tokens allocation and priority; when total exceeds the context
    window, lowest-priority sections are truncated first.
  }

  state {
    assemblies: set P
    sections: P -> list {name: String, role: String,
                         template_ref: option String, priority: Int,
                         max_tokens: Int, required: Bool,
                         content: option String}
    assembly_strategy: P -> String
    format: P -> String
    variables: P -> list {name: String, value: String}
    output_directive: P -> option String
    tokenizer_id: P -> String
    context_window: P -> Int
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(strategy: String, format: String,
                  tokenizer_id: String, context_window: Int) {
      -> ok(assembly: P) {
        Strategy: sequential, priority_weighted, adaptive.
        Format: chat_messages, single_string, structured.
        Tokenizer: cl100k_base, o200k_base, etc.
        Context_window: max tokens for target model.
        Auto-creates a response_reserve section at 20% of context_window
        with highest priority.
      }
      -> invalid(message: String) {
        Unknown strategy, format, or tokenizer.
      }
    }

    action addSection(assembly: P, name: String, role: String,
                      priority: Int, max_tokens: Int, required: Bool,
                      content: option String,
                      template_ref: option String) {
      -> ok(assembly: P) {
        Registers a prompt section. Higher priority preserved during
        budget truncation. Required sections always appear.
      }
      -> notfound(message: String) {
        Assembly not found.
      }
    }

    action setVariable(assembly: P, name: String, value: String) {
      -> ok(assembly: P) {
        Sets a variable for template rendering.
      }
      -> notfound(message: String) {
        Assembly not found.
      }
    }

    action assemble(assembly: P) {
      -> ok(prompt: String, sections_included: list String,
            sections_truncated: list String, total_tokens: Int,
            estimated_cost: Float) {
        Renders all sections within context_window. Pipeline: resolve
        variables, render each section, count tokens per section,
        truncate lowest-priority sections first until total fits.
        System instructions (highest) always preserved. Few-shot
        examples reduced first, then retrieved context compressed.
        Calculates estimated cost based on token count.
      }
      -> over_budget(minimum_tokens: Int, available_tokens: Int) {
        Required-only sections exceed context_window.
      }
    }

    action toMessages(assembly: P) {
      -> ok(messages: list {role: String, content: String}) {
        Assembles and converts to provider message format.
        Each section becomes a message with its assigned role.
      }
      -> over_budget(minimum_tokens: Int, available_tokens: Int) {
        Required sections exceed budget.
      }
    }

    action estimateTokens(assembly: P) {
      -> ok(total: Int, per_section: list {name: String, tokens: Int}) {
        Predicts prompt size before assembly.
      }
      -> notfound(message: String) {
        Assembly not found.
      }
    }

    action removeSection(assembly: P, name: String) {
      -> ok(assembly: P) {
        Removes section by name.
      }
      -> notfound(message: String) {
        Section not found.
      }
    }
  }

  invariant {
    after create(strategy: "priority_weighted", format: "chat_messages",
                 tokenizer_id: "cl100k_base", context_window: 128000)
      -> ok(assembly: p)
    and  addSection(assembly: p, name: "system", role: "system",
                    priority: 100, max_tokens: 500, required: true,
                    content: "You are helpful.", template_ref: _)
      -> ok(assembly: p)
    then assemble(assembly: p) -> ok(prompt: _, sections_included: _,
                  sections_truncated: _, total_tokens: _, estimated_cost: _)
  }
}
```

### 4.4 Concept: FewShotExample

```
@version(1)
concept FewShotExample [F] {

  purpose {
    Manages pools of input-output examples and selects the most effective
    subset for each prompt at runtime. Supports semantic similarity, maximal
    marginal relevance, bootstrapped, and length-based selection. 2-5
    examples is optimal; beyond 5 returns diminish. Last example weighted
    most heavily due to recency bias.
  }

  state {
    pools: set F
    examples: F -> list {id: String, input: String, output: String,
                         metadata: option String, embedding: option list Float}
    selection_strategy: F -> String
    k: F -> Int
    diversity_weight: F -> Float
    quality_scores: F -> list {id: String, score: Float}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action createPool(strategy: String, k: Int, diversity_weight: Float) {
      -> ok(pool: F) {
        Strategy: semantic_similarity, mmr, ngram_overlap, length_based,
        random, bootstrapped. k: number to select. diversity_weight:
        lambda 0-1 for MMR relevance/diversity balance.
      }
      -> invalid(message: String) {
        Unknown strategy.
      }
    }

    action add(pool: F, input: String, output: String,
               metadata: option String) {
      -> ok(example_id: String) {
        Adds example. Embedding computed lazily on first select.
      }
      -> notfound(message: String) {
        Pool not found.
      }
    }

    action select(pool: F, input: String, k: option Int) {
      -> ok(examples: list {input: String, output: String, score: Float}) {
        Chooses best examples. Ordered by relevance, last weighted most.
      }
      -> empty(message: String) {
        Pool has no examples.
      }
    }

    action optimize(pool: F, metric: String,
                    training_set: list {input: String, expected: String}) {
      -> ok(optimized_count: Int, avg_score: Float) {
        DSPy-style bootstrapping: teacher model generates examples,
        validates against metric, retains highest-quality. Updates
        quality_scores.
      }
      -> error(message: String) {
        Optimization failed.
      }
    }

    action embed(pool: F, model_id: String) {
      -> ok(embedded_count: Int) {
        Pre-computes embeddings for all examples.
      }
      -> error(message: String) {
        Embedding model unavailable.
      }
    }

    action remove(pool: F, example_id: String) {
      -> ok(pool: F) {
        Removes example.
      }
      -> notfound(message: String) {
        Example not found.
      }
    }
  }

  invariant {
    after createPool(strategy: "semantic_similarity", k: 3,
                     diversity_weight: 0.5) -> ok(pool: f)
    and  add(pool: f, input: "What is 2+2?", output: "4", metadata: _)
      -> ok(example_id: _)
    then select(pool: f, input: "What is 3+3?", k: _) -> ok(examples: _)
  }
}
```

### 4.5 Concept: PromptOptimizer

```
@version(1)
concept PromptOptimizer [O] {

  purpose {
    Automatically improves prompts using LLM-driven optimization, treating
    prompt text as a learnable parameter. DSPy paradigm: programming, not
    prompting. Supports BootstrapFewShot, MIPROv2, COPRO, OPRO, and
    evolutionary strategies.
  }

  state {
    runs: set O
    target_program: O -> String
    metric: O -> String
    training_set: O -> list {input: String, expected: String}
    strategy: O -> String
    history: O -> list {candidate: String, score: Float, iteration: Int}
    best_candidate: O -> option {prompt: String, score: Float}
    budget: O -> {max_llm_calls: Int, used_calls: Int}
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action create(target: String, metric: String,
                  training_set: list {input: String, expected: String},
                  strategy: String, max_llm_calls: Int) {
      -> ok(optimizer: O) {
        Strategy: bootstrap_few_shot, mipro_v2, copro, opro, evolutionary.
      }
      -> invalid(message: String) {
        Unknown strategy or empty training set.
      }
    }

    action optimize(optimizer: O) {
      -> ok(best_prompt: String, score: Float, iterations: Int) {
        Runs optimization loop. Records all candidates in history.
      }
      -> budget_exceeded(best_so_far: String, score: Float) {
        Hit max_llm_calls before convergence.
      }
      -> error(message: String) {
        Optimization failed.
      }
    }

    action evaluate(optimizer: O, program: String,
                    dataset: list {input: String, expected: String}) {
      -> ok(score: Float, per_example: list {input: String, score: Float}) {
        Measures quality against dataset using configured metric.
      }
      -> error(message: String) {
        Evaluation failed.
      }
    }

    action compare(optimizer: O, programs: list String,
                   dataset: list {input: String, expected: String}) {
      -> ok(ranked: list {program: String, score: Float}) {
        A/B tests multiple prompt variants.
      }
      -> error(message: String) {
        Comparison failed.
      }
    }

    action rollback(optimizer: O, iteration: Int) {
      -> ok(prompt: String, score: Float) {
        Reverts to a previous candidate.
      }
      -> notfound(message: String) {
        Iteration not found.
      }
    }
  }

  invariant {
    after create(target: t, metric: "accuracy", training_set: ts,
                 strategy: "mipro_v2", max_llm_calls: 100) -> ok(optimizer: o)
    then optimize(optimizer: o) -> ok(best_prompt: _, score: _, iterations: _)
  }
}
```

### 4.6 Concept: Assertion

```
@version(1)
concept Assertion [T] {

  purpose {
    Computational constraints embedded in the LLM execution lifecycle.
    On violation, triggers automatic backtracking: failing output and error
    message are injected into the prompt for self-refinement retry. Hard
    assertions halt the pipeline on max retries. Soft suggestions log and
    continue. Also covers output schema validation via retry (replaces
    StructuredOutput's repair loop).
  }

  state {
    assertions: set T
    name: T -> String
    constraint: T -> String
    severity: T -> String
    error_message: T -> String
    max_retries: T -> Int
    retry_count: T -> Int
    attached_to: T -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action define(name: String, constraint: String, severity: String,
                  error_message: String, max_retries: Int) {
      -> ok(assertion: T) {
        Severity: hard (halts on max retries) or soft (logs and continues).
        Constraint: predicate expression evaluated against LLM output.
        Examples: "output.is_valid_json", "output.length > 100",
        "output.matches_schema(schema_ref)", "output.contains_no_pii".
      }
      -> invalid(message: String) {
        Invalid constraint expression.
      }
    }

    action attach(assertion: T, target: String) {
      -> ok(assertion: T) {
        Attaches to a pipeline node / signature / assembly by ID.
      }
      -> notfound(message: String) {
        Assertion not found.
      }
    }

    action evaluate(assertion: T, output: String) {
      -> pass() {
        Output satisfies constraint. Resets retry_count.
      }
      -> fail(retry_prompt: String, attempt: Int, max: Int) {
        Violation. Returns retry prompt with original output, error_message,
        and specific failure context. Caller should re-generate.
      }
      -> halt(message: String, attempts: Int) {
        Hard assertion exceeded max_retries. Pipeline must stop.
      }
      -> warn(message: String, attempts: Int) {
        Soft assertion exceeded max_retries. Logs, continues with last output.
      }
    }

    action reset(assertion: T) {
      -> ok(assertion: T) {
        Resets retry_count to 0.
      }
      -> notfound(message: String) {
        Assertion not found.
      }
    }
  }

  invariant {
    after define(name: "json_valid", constraint: "output.is_valid_json",
                 severity: "hard", error_message: "Must be valid JSON",
                 max_retries: 3) -> ok(assertion: t)
    and  evaluate(assertion: t, output: "not json")
      -> fail(retry_prompt: _, attempt: 1, max: 3)
    then evaluate(assertion: t, output: "{\"valid\": true}") -> pass()
  }
}
```

---

## 5. LLM Agent Suite

### 5.1 Suite Manifest

```yaml
suite:
  name: llm-agent
  version: 0.1.0
  description: "Autonomous LLM agent reasoning, multi-agent coordination, memory, tool use, and alignment. AgentLoop is a coordination concept — strategy providers register via PluginRegistry."

concepts:
  # Core concepts
  StateGraph:
    spec: ./state-graph.concept
    params:
      H: { as: graph-id, description: "Execution graph identifier" }
  AgentMemory:
    spec: ./agent-memory.concept
    params:
      E: { as: memory-id, description: "Memory entry identifier" }
  ToolBinding:
    spec: ./tool-binding.concept
    params:
      T: { as: tool-id, description: "Tool definition identifier" }
  AgentTeam:
    spec: ./agent-team.concept
    params:
      M: { as: team-id, description: "Agent team identifier" }
  AgentRole:
    spec: ./agent-role.concept
    params:
      K: { as: role-id, description: "Agent role identifier" }
  Blackboard:
    spec: ./blackboard.concept
    params:
      B: { as: board-id, description: "Blackboard identifier" }
  AgentHandoff:
    spec: ./agent-handoff.concept
    params:
      D: { as: handoff-id, description: "Handoff identifier" }
  Consensus:
    spec: ./consensus.concept
    params:
      N: { as: consensus-id, description: "Consensus session identifier" }
  Constitution:
    spec: ./constitution.concept
    params:
      W: { as: constitution-id, description: "Constitution identifier" }

  # Coordination concept
  AgentLoop:
    spec: ./agent-loop.concept
    params:
      L: { as: agent-id, description: "Agent instance identifier" }

  # Strategy providers (register themselves via PluginRegistry)
  ReactStrategy:
    spec: ./strategies/react.concept
    optional: true
  PlanAndExecuteStrategy:
    spec: ./strategies/plan-and-execute.concept
    optional: true
  TreeOfThoughtStrategy:
    spec: ./strategies/tree-of-thought.concept
    optional: true
  ReflectionStrategy:
    spec: ./strategies/reflection.concept
    optional: true
  CodeActStrategy:
    spec: ./strategies/code-act.concept
    optional: true
  ReWOOStrategy:
    spec: ./strategies/rewoo.concept
    optional: true

syncs:
  required:
    - agent-invokes-tool.sync
    - agent-remembers-step.sync
    - tool-result-feeds-agent.sync
    - agent-loop-dispatches-to-strategy.sync
  recommended:
    - agent-recalls-memory.sync
    - constitution-critiques-output.sync
    - team-delegates-via-role.sync
    - blackboard-notifies-subscribers.sync
    - consensus-resolves-conflict.sync
    - handoff-packages-context.sync
  integration:
    - agent-workflow-provider.sync
    - hitl-notification.sync
    - multi-agent-message-passing.sync
    - react-routes.sync
    - plan-execute-routes.sync
    - tree-of-thought-routes.sync
    - reflection-routes.sync
    - code-act-routes.sync
    - rewoo-routes.sync

uses:
  - suite: llm-core
    concepts:
      - name: LLMProvider
      - name: ModelRouter
  - suite: llm-conversation
    concepts:
      - name: Conversation
  - suite: llm-safety
    optional: true
    concepts:
      - name: Guardrail
  - suite: infrastructure
    concepts:
      - name: PluginRegistry
  - suite: automation
    optional: true
    concepts:
      - name: Workflow
  - suite: notification
    optional: true
    concepts:
      - name: Notification
```

### 5.2 Concept: AgentLoop (Coordination)

```
@version(1)
@gate
concept AgentLoop [L] {

  purpose {
    Coordination concept for agent reasoning cycles. Defines the interface
    contract for agent execution: create, run, step, observe, interrupt,
    resume. Strategy providers (React, PlanAndExecute, etc.) register
    themselves with PluginRegistry independently. AgentLoop has zero
    awareness of which providers exist — routing syncs resolve a strategy
    string to the correct provider at call time via PluginRegistry.
  }

  state {
    agents: set L
    available_tools: L -> list String
    max_iterations: L -> Int
    current_step: L -> Int
    status: L -> String
    goal: L -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(available_tools: list String, max_iterations: Int) {
      -> ok(agent: L) {
        Creates an agent instance with tool access and iteration limit.
        Status set to "idle". No strategy specified here — strategy is
        selected at run time and resolved externally via routing sync.
      }
      -> invalid(message: String) {
        Invalid configuration.
      }
    }

    action run(agent: L, goal: String, context: String,
               strategy: String) {
      -> ok(result: String, steps: Int, tool_calls: Int) {
        Initiates a reasoning cycle. The strategy parameter is an opaque
        string passed through to the routing sync, which resolves it
        via PluginRegistry to the appropriate strategy provider. AgentLoop
        does not validate or interpret this string — if no provider
        matches, the routing sync fails. AgentLoop tracks current_step
        and status but delegates all strategy-specific logic to the
        resolved provider.
      }
      -> max_iterations(partial_result: String, steps: Int) {
        Hit iteration limit.
      }
      -> error(message: String, step: Int) {
        Unrecoverable error (including strategy resolution failure).
      }
      -> waiting_for_human(question: String, step: Int) {
        Agent needs human input. Status: "waiting_for_human".
      }
    }

    action step(agent: L) {
      -> thought(reasoning: String, step: Int) {
        Strategy produced a reasoning step. Needs to continue.
      }
      -> action_request(tool_name: String, arguments: String, step: Int) {
        Strategy decided to call a tool. Syncs route to ToolBinding.
      }
      -> final_answer(result: String, step: Int) {
        Strategy decided it has enough information.
      }
      -> error(message: String, step: Int) {
        Step failed.
      }
    }

    action observe(agent: L, observation: String) {
      -> ok(agent: L) {
        Feeds tool result or external observation back into the
        active strategy provider's execution loop.
      }
      -> notfound(message: String) {
        Agent not found.
      }
    }

    action interrupt(agent: L) {
      -> ok(state_snapshot: String, step: Int) {
        Pauses execution. The active strategy provider serializes
        its own state into the snapshot.
      }
      -> notfound(message: String) {
        Agent not found or not running.
      }
    }

    action resume(agent: L, human_input: String) {
      -> ok(agent: L) {
        Continues after human input or interruption.
      }
      -> notfound(message: String) {
        Agent not found or not paused.
      }
    }
  }

  invariant {
    after create(available_tools: ["search"], max_iterations: 10)
      -> ok(agent: a)
    then run(agent: a, goal: "Find X", context: "", strategy: "react")
      -> ok(result: _, steps: _, tool_calls: _)
  }
}
```

### 5.3 Strategy Providers

Each provider registers itself via PluginRegistry. It owns its own state and implements the strategy-specific logic that AgentLoop delegates to.

#### 5.3.1 ReactStrategy

```
@version(1)
concept ReactStrategy [S] {

  purpose {
    ReAct (Reasoning + Acting) strategy provider for AgentLoop. Implements
    the greedy think-act-observe cycle with an interleaved scratchpad.
    Good for simple tasks requiring sequential tool use. Registers itself
    with PluginRegistry under strategy_id "react".
  }

  state {
    sessions: set S
    scratchpad: S -> list {type: String, content: String, step: Int}
    agent_ref: S -> String
  }

  actions {
    action execute(agent_ref: String, goal: String, context: String,
                   available_tools: list String, max_iterations: Int) {
      -> ok(result: String, steps: Int, tool_calls: Int,
            scratchpad: list {type: String, content: String}) {
        Runs the ReAct loop: (1) Think — generate reasoning about what
        to do next. (2) Act — choose a tool and arguments, or produce
        final answer. (3) Observe — receive tool result. Loop until
        final answer or max_iterations. Scratchpad accumulates
        Thought/Action/Observation triples.
      }
      -> max_iterations(partial: String, steps: Int) {
        Hit limit without final answer.
      }
      -> error(message: String) {
        Execution failed.
      }
    }

    action stepOnce(session: S) {
      -> thought(reasoning: String) {
        Generated a thought. Awaiting action decision.
      }
      -> action_request(tool_name: String, arguments: String) {
        Chose a tool.
      }
      -> final_answer(result: String) {
        Reached conclusion.
      }
    }

    action addObservation(session: S, observation: String) {
      -> ok(session: S) {
        Adds tool result to scratchpad.
      }
    }

    action getState(session: S) {
      -> ok(scratchpad: list {type: String, content: String, step: Int}) {
        Returns current scratchpad for serialization.
      }
    }
  }
}
```

#### 5.3.2 PlanAndExecuteStrategy

```
@version(1)
concept PlanAndExecuteStrategy [S] {

  purpose {
    Plan-and-Execute strategy provider. Generates an upfront multi-step
    plan, then executes each step (potentially with a cheaper model),
    replanning after each step if needed. More robust than ReAct for
    complex multi-step tasks. Registers under strategy_id "plan_and_execute".
  }

  state {
    sessions: set S
    plan: S -> list {step_id: String, description: String, status: String,
                     result: option String}
    executor_model: S -> option String
    agent_ref: S -> String
  }

  actions {
    action execute(agent_ref: String, goal: String, context: String,
                   available_tools: list String, max_iterations: Int) {
      -> ok(result: String, steps: Int, tool_calls: Int,
            plan_history: list {plan_version: Int,
              steps: list {description: String, status: String}}) {
        (1) Plan — generate ordered steps for the goal.
        (2) Execute — run each step, potentially with a cheaper executor model.
        (3) Replan — after each step, evaluate whether the remaining plan
        still makes sense given results so far. May add, remove, or
        reorder remaining steps.
        (4) Synthesize — combine step results into final answer.
      }
      -> max_iterations(partial: String, completed_steps: Int) {
        Hit limit mid-plan.
      }
      -> error(message: String) {
        Execution failed.
      }
    }

    action plan(session: S, goal: String) {
      -> ok(steps: list {step_id: String, description: String}) {
        Generates initial plan.
      }
    }

    action replan(session: S, completed: list String,
                  remaining: list String) {
      -> ok(updated_plan: list {step_id: String, description: String}) {
        Revises plan based on execution so far.
      }
      -> no_change() {
        Plan still valid.
      }
    }

    action getState(session: S) {
      -> ok(plan: list {step_id: String, description: String,
            status: String, result: option String}) {
        Returns current plan state.
      }
    }
  }
}
```

#### 5.3.3 TreeOfThoughtStrategy

```
@version(1)
concept TreeOfThoughtStrategy [S] {

  purpose {
    Tree-of-Thought strategy provider. Explores multiple reasoning paths
    in parallel, evaluates each branch, prunes unpromising paths, and
    selects the best. Good for problems requiring exploration and
    backtracking. Registers under strategy_id "tree_of_thought".
  }

  state {
    sessions: set S
    thought_tree: S -> list {node_id: String, parent_id: option String,
                             thought: String, score: option Float,
                             status: String}
    beam_width: S -> Int
    evaluation_prompt: S -> option String
    agent_ref: S -> String
  }

  actions {
    action execute(agent_ref: String, goal: String, context: String,
                   available_tools: list String, max_iterations: Int) {
      -> ok(result: String, branches_explored: Int,
            best_path: list {thought: String, score: Float}) {
        (1) Branch — generate multiple candidate next-thoughts.
        (2) Evaluate — score each candidate using an evaluation prompt.
        (3) Prune — keep only the top beam_width branches.
        (4) Select — when a branch reaches a final answer, return
        the highest-scoring complete path.
      }
      -> max_iterations(best_so_far: String, branches: Int) {
        Hit limit.
      }
      -> error(message: String) {
        Execution failed.
      }
    }

    action branch(session: S, parent_id: String, num_candidates: Int) {
      -> ok(candidates: list {node_id: String, thought: String}) {
        Generates num_candidates alternative continuations.
      }
    }

    action evaluate(session: S, node_ids: list String) {
      -> ok(scores: list {node_id: String, score: Float}) {
        Scores each node. Can use LLM-as-judge or heuristic evaluation.
      }
    }

    action prune(session: S) {
      -> ok(pruned: Int, remaining: Int) {
        Removes branches below beam_width threshold.
      }
    }

    action getState(session: S) {
      -> ok(tree: list {node_id: String, parent_id: option String,
            thought: String, score: option Float, status: String}) {
        Returns full thought tree.
      }
    }
  }
}
```

#### 5.3.4 ReflectionStrategy

```
@version(1)
concept ReflectionStrategy [S] {

  purpose {
    Reflection strategy provider. Iterative self-critique and revision:
    generate a draft, critique it, revise, repeat until satisfactory or
    max rounds. Improves output quality at the cost of latency.
    Registers under strategy_id "reflection".
  }

  state {
    sessions: set S
    draft_history: S -> list {draft: String, critique: String, round: Int}
    max_rounds: S -> Int
    agent_ref: S -> String
  }

  actions {
    action execute(agent_ref: String, goal: String, context: String,
                   available_tools: list String, max_iterations: Int) {
      -> ok(result: String, rounds: Int,
            history: list {draft: String, critique: String}) {
        (1) Draft — generate initial response.
        (2) Critique — self-evaluate against goal and quality criteria.
        (3) Revise — generate improved version addressing critique.
        (4) Repeat until critique finds no issues or max_rounds reached.
      }
      -> max_rounds(best_draft: String, rounds: Int) {
        Could not achieve satisfactory quality.
      }
    }

    action critique(session: S, draft: String) {
      -> ok(critique: String, satisfactory: Bool) {
        Self-evaluates the draft. If satisfactory, no revision needed.
      }
    }

    action revise(session: S, draft: String, critique: String) {
      -> ok(revised: String) {
        Generates improved version addressing critique points.
      }
    }

    action getState(session: S) {
      -> ok(history: list {draft: String, critique: String, round: Int}) {
        Returns draft/critique history.
      }
    }
  }
}
```

#### 5.3.5 CodeActStrategy

```
@version(1)
concept CodeActStrategy [S] {

  purpose {
    CodeAct strategy provider. Agent generates executable code to solve
    problems, runs it in a sandbox, observes output, iterates. Useful for
    computational tasks, data analysis, and tool composition via code.
    Registers under strategy_id "code_act".
  }

  state {
    sessions: set S
    code_history: S -> list {code: String, output: String,
                             error: option String, step: Int}
    runtime_env: S -> String
    sandbox_config: S -> {timeout_ms: Int, memory_limit_mb: Int}
    agent_ref: S -> String
  }

  actions {
    action execute(agent_ref: String, goal: String, context: String,
                   available_tools: list String, max_iterations: Int) {
      -> ok(result: String, code_runs: Int,
            final_code: String) {
        (1) Generate code to solve the problem.
        (2) Execute in sandbox.
        (3) Observe stdout/stderr.
        (4) If error or incomplete, revise code and re-run.
        (5) Extract final answer from output.
      }
      -> max_iterations(partial: String, code_runs: Int) {
        Could not produce working code.
      }
      -> sandbox_error(message: String) {
        Sandbox unavailable or security violation.
      }
    }

    action generateCode(session: S, goal: String, previous_error: option String) {
      -> ok(code: String, language: String) {
        Generates code. If previous_error provided, fixes the issue.
      }
    }

    action executeCode(session: S, code: String) {
      -> ok(output: String) {
        Runs code in sandbox, returns stdout.
      }
      -> error(stderr: String, exit_code: Int) {
        Code failed.
      }
      -> timeout() {
        Exceeded timeout_ms.
      }
    }

    action getState(session: S) {
      -> ok(history: list {code: String, output: String,
            error: option String, step: Int}) {
        Returns code execution history.
      }
    }
  }
}
```

#### 5.3.6 ReWOOStrategy

```
@version(1)
concept ReWOOStrategy [S] {

  purpose {
    ReWOO (Reasoning Without Observation) strategy provider. Plans ALL
    tool calls upfront before executing any, then batch-executes and
    synthesizes. Avoids interleaving reasoning with tool results, reducing
    total LLM calls. Good for predictable multi-tool tasks where tool
    results don't influence which tools to call next.
    Registers under strategy_id "rewoo".
  }

  state {
    sessions: set S
    planned_calls: S -> list {step_id: String, tool_name: String,
                              arguments: String, depends_on: list String}
    execution_results: S -> list {step_id: String, result: String}
    agent_ref: S -> String
  }

  actions {
    action execute(agent_ref: String, goal: String, context: String,
                   available_tools: list String, max_iterations: Int) {
      -> ok(result: String, planned_calls: Int, executed_calls: Int) {
        (1) Plan — generate ALL tool calls with dependency ordering.
        Tool arguments can reference results of earlier steps via
        placeholders (#step_id).
        (2) Execute — run all tool calls in dependency order, substituting
        placeholders with actual results.
        (3) Synthesize — combine all results into final answer with
        a single LLM call.
      }
      -> error(message: String) {
        Planning or execution failed.
      }
    }

    action planCalls(session: S, goal: String,
                     available_tools: list String) {
      -> ok(calls: list {step_id: String, tool_name: String,
            arguments: String, depends_on: list String}) {
        Generates the full execution plan in one LLM call.
      }
    }

    action executeBatch(session: S) {
      -> ok(results: list {step_id: String, result: String}) {
        Executes all planned calls in dependency order.
      }
      -> partial(completed: Int, failed_step: String, error: String) {
        Some calls failed.
      }
    }

    action synthesize(session: S, goal: String) {
      -> ok(result: String) {
        Single LLM call to combine all results into final answer.
      }
    }

    action getState(session: S) {
      -> ok(planned: list {step_id: String, tool_name: String,
            status: String}, results: list {step_id: String, result: String}) {
        Returns plan and execution state.
      }
    }
  }
}
```

### 5.4 Concept: StateGraph

```
@version(1)
@gate
concept StateGraph [H] {

  purpose {
    Graph-based orchestration with typed state flowing through nodes,
    conditional edges evaluated by LLMs, first-class cycles, durable
    checkpoints, and time-travel. The industry standard for agent workflow
    orchestration. Fundamentally different from Workflow (which is an
    acyclic state machine): StateGraph has typed flowing state mutated
    by each node, LLM-evaluated conditional edges, explicit support for
    cycles, state reducers for concurrent merging, and subgraph nesting.
  }

  state {
    graphs: set H
    nodes: H -> list {id: String, type: String, handler: String}
    edges: H -> list {source: String, target: String, condition: option String}
    state_schema: H -> String
    entry_point: H -> String
    finish_points: H -> list String
    execution_state: H -> option String
    checkpoints: H -> list {id: String, state: String, timestamp: DateTime,
                            node_id: String}
    reducers: H -> list {field: String, reducer: String}
    subgraphs: H -> list {node_id: String, graph_ref: String}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(state_schema: String) {
      -> ok(graph: H) {
        Creates a graph with a typed state schema (JSON Schema). The
        state flows through nodes and gets mutated by each one.
      }
      -> invalid(message: String) {
        Invalid state schema.
      }
    }

    action addNode(graph: H, id: String, type: String, handler: String) {
      -> ok(graph: H) {
        Adds a node. Type: agent (LLM reasoning), tool (tool execution),
        conditional (routing decision), subgraph (nested graph),
        human (HITL checkpoint). Handler references the execution function.
      }
      -> duplicate(message: String) {
        Node ID already exists.
      }
    }

    action addEdge(graph: H, source: String, target: String) {
      -> ok(graph: H) {
        Adds an unconditional edge.
      }
      -> notfound(message: String) {
        Source or target node not found.
      }
    }

    action addConditionalEdge(graph: H, source: String,
                              targets: list {condition: String,
                                            target: String}) {
      -> ok(graph: H) {
        Adds conditional edges. At runtime, an evaluator (typically LLM)
        examines the current state and selects which target to transition
        to. Conditions are predicate expressions on the state.
      }
      -> notfound(message: String) {
        Source or target nodes not found.
      }
    }

    action setEntryPoint(graph: H, node_id: String) {
      -> ok(graph: H) {
        Sets where execution begins.
      }
      -> notfound(message: String) {
        Node not found.
      }
    }

    action setFinishPoint(graph: H, node_ids: list String) {
      -> ok(graph: H) {
        Sets terminal nodes. Execution completes when reaching any.
      }
      -> notfound(message: String) {
        Node not found.
      }
    }

    action addReducer(graph: H, field: String, reducer: String) {
      -> ok(graph: H) {
        Defines how concurrent node outputs merge for a state field.
        Reducer: overwrite (last wins), append (list concat),
        merge (deep merge), custom (expression-based).
      }
      -> invalid(message: String) {
        Unknown reducer type.
      }
    }

    action addSubgraph(graph: H, node_id: String, subgraph: H) {
      -> ok(graph: H) {
        Nests an entire graph as a single node. Subgraph receives
        parent's state, returns modified state on completion.
      }
      -> notfound(message: String) {
        Node not found.
      }
    }

    action compile(graph: H) {
      -> ok(graph: H) {
        Validates the graph: all edges reference existing nodes,
        entry/finish points set, no unreachable nodes, state schema
        is valid. Optimizes execution plan.
      }
      -> invalid(errors: list {type: String, message: String}) {
        Validation errors (dangling edges, no entry point, etc.).
      }
    }

    action execute(graph: H, initial_state: String) {
      -> ok(final_state: String, nodes_visited: list String,
            execution_ms: Int) {
        Runs the graph from entry point with initial state. Each node
        receives current state, mutates it, returns updated state.
        Conditional edges evaluate against state to determine next node.
        Cycles are allowed — a node can loop back to a previous node.
        Creates checkpoints at each node transition.
      }
      -> error(node_id: String, message: String) {
        Execution failed at a specific node.
      }
      -> waiting_for_human(node_id: String, state: String) {
        Reached a human node. Execution paused.
      }
    }

    action checkpoint(graph: H) {
      -> ok(checkpoint_id: String, state: String) {
        Captures current execution state. Enables pause/resume.
      }
      -> not_executing(message: String) {
        Graph is not currently executing.
      }
    }

    action restore(graph: H, checkpoint_id: String) {
      -> ok(graph: H, state: String, node_id: String) {
        Resumes execution from a checkpoint.
      }
      -> notfound(message: String) {
        Checkpoint not found.
      }
    }

    action timeTravel(graph: H, checkpoint_id: String) {
      -> ok(state: String, node_id: String,
            subsequent_checkpoints: list String) {
        Inspects a historical state without resuming. Shows what
        state looked like at that point and what happened after.
      }
      -> notfound(message: String) {
        Checkpoint not found.
      }
    }

    action fork(graph: H, checkpoint_id: String) {
      -> ok(new_graph: H) {
        Creates a new execution branch from a checkpoint. Both the
        original and forked graph can continue independently.
      }
      -> notfound(message: String) {
        Checkpoint not found.
      }
    }
  }

  invariant {
    after create(state_schema: s) -> ok(graph: h)
    and  addNode(graph: h, id: "start", type: "agent", handler: _)
      -> ok(graph: h)
    and  addNode(graph: h, id: "end", type: "agent", handler: _)
      -> ok(graph: h)
    and  addEdge(graph: h, source: "start", target: "end") -> ok(graph: h)
    and  setEntryPoint(graph: h, node_id: "start") -> ok(graph: h)
    and  setFinishPoint(graph: h, node_ids: ["end"]) -> ok(graph: h)
    and  compile(graph: h) -> ok(graph: h)
    then execute(graph: h, initial_state: "{}") -> ok(final_state: _,
                 nodes_visited: _, execution_ms: _)
  }
}
```

### 5.5 Concept: AgentMemory

```
@version(1)
concept AgentMemory [E] {

  purpose {
    Persistent, multi-tier memory modeled after cognitive science. Four
    tiers: working memory (always in context, like CPU registers), episodic
    (timestamped interactions, answers "what happened?"), semantic (facts
    as embeddings, answers "what do I know?"), procedural (learned skills,
    answers "how do I do this?"). The agent actively manages its own memory
    via tool calls — self-editing memory, not passive storage.
  }

  state {
    entries: set E
    memory_type: E -> String
    content: E -> String
    embedding: E -> option list Float
    timestamp: E -> DateTime
    metadata: E -> option String
    working_memory: list {label: String, content: String, max_tokens: Int}
    consolidation_queue: list String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action remember(content: String, memory_type: String,
                    metadata: option String) {
      -> ok(entry: E) {
        Stores information. Type: working, episodic, semantic, procedural.
        Episodic gets timestamps. Semantic queued for embedding.
        Procedural stored as executable patterns.
      }
      -> invalid(message: String) {
        Unknown memory type.
      }
    }

    action recall(query: String, memory_type: String, k: Int) {
      -> ok(memories: list {entry: E, content: String,
            relevance: Float, timestamp: DateTime}) {
        Retrieves k most relevant memories. Episodic: content + date search.
        Semantic: vector similarity. Procedural: pattern matching.
      }
      -> empty(message: String) {
        No matching memories.
      }
    }

    action editWorkingMemory(label: String, new_content: String) {
      -> ok(previous: String) {
        Updates an always-in-context block. Labels: "persona", "human",
        "task", "context". Returns previous content. This is the
        self-editing memory pattern — agent manages its own working
        memory via tool calls.
      }
      -> notfound(message: String) {
        Label not found.
      }
    }

    action forget(entry: E) {
      -> ok() {
        Explicitly removes a memory. Irreversible.
      }
      -> notfound(message: String) {
        Entry not found.
      }
    }

    action consolidate() {
      -> ok(merged: Int, pruned: Int, updated: Int) {
        Background processing: merge related memories, update summaries,
        prune stale entries. Compresses repeated episodic patterns into
        procedural memory. "Sleep-time compute" during idle periods.
      }
      -> empty(message: String) {
        Nothing to consolidate.
      }
    }

    action search(query: String,
                  filters: option {memory_type: option String,
                    after: option DateTime, before: option DateTime}) {
      -> ok(results: list {entry: E, content: String,
            memory_type: String, relevance: Float}) {
        Cross-tier search.
      }
      -> empty(message: String) {
        No results.
      }
    }

    action getWorkingMemory() {
      -> ok(blocks: list {label: String, content: String, tokens: Int}) {
        Returns all working memory blocks with token counts.
      }
    }
  }

  invariant {
    after remember(content: "User prefers Python", memory_type: "semantic",
                   metadata: _) -> ok(entry: e)
    then recall(query: "programming preference", memory_type: "semantic",
                k: 1) -> ok(memories: _)
  }
}
```

### 5.6 Concept: ToolBinding

```
@version(1)
concept ToolBinding [T] {

  purpose {
    Callable tools/functions that LLMs can invoke. Unifies OpenAI function
    calling, Anthropic tool use, and MCP tool primitive. Full lifecycle:
    schema definition, provider format translation, argument validation,
    execution, result formatting, error handling. Supports dynamic tool
    selection for large tool sets and safety annotations per MCP spec.
  }

  state {
    tools: set T
    name: T -> String
    description: T -> String
    input_schema: T -> String
    output_schema: T -> option String
    handler: T -> String
    annotations: T -> {
      audience: String,
      destructive: Bool,
      idempotent: Bool,
      open_world: Bool
    }
    timeout_ms: T -> Int
    retry_policy: T -> {max_retries: Int, backoff_ms: Int}
    requires_approval: T -> Bool
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action define(name: String, description: String, input_schema: String,
                  output_schema: option String, handler: String,
                  annotations: {audience: String, destructive: Bool,
                               idempotent: Bool, open_world: Bool},
                  timeout_ms: Int, requires_approval: Bool) {
      -> ok(tool: T) {
        Registers a tool. Annotations follow MCP spec.
      }
      -> invalid(message: String) {
        Invalid schema or missing fields.
      }
    }

    action invoke(tool: T, arguments: String) {
      -> ok(result: String, execution_ms: Int) {
        Validates arguments, executes handler, returns result.
      }
      -> validation_error(errors: list {path: String, message: String}) {
        Arguments don't match input_schema.
      }
      -> timeout(elapsed_ms: Int) {
        Execution exceeded timeout.
      }
      -> execution_error(message: String) {
        Handler threw an error.
      }
      -> approval_required(tool: T, arguments: String) {
        requires_approval=true. Emits approval request via sync.
      }
    }

    action toProviderFormat(tool: T, provider: String) {
      -> ok(formatted: String) {
        Serializes for: openai, anthropic, mcp, generic.
      }
      -> notfound(message: String) {
        Tool not found.
      }
    }

    action discover(filter: option {audience: option String,
                    destructive: option Bool}) {
      -> ok(tools: list {name: String, description: String,
            input_schema: String, annotations: String}) {
        Lists available tools, optionally filtered.
      }
    }

    action search(query: String, k: Int) {
      -> ok(tools: list {name: String, description: String,
            relevance: Float}) {
        Semantic search for large tool sets.
      }
      -> empty(message: String) {
        No matches.
      }
    }
  }

  invariant {
    after define(name: "search", description: "Search the web",
                 input_schema: s, output_schema: _, handler: h,
                 annotations: a, timeout_ms: 5000, requires_approval: false)
      -> ok(tool: t)
    then invoke(tool: t, arguments: "{\"query\": \"test\"}")
      -> ok(result: _, execution_ms: _)
  }
}
```

### 5.7 Concept: AgentTeam

```
@version(1)
@gate
concept AgentTeam [M] {

  purpose {
    Multi-agent group coordination. Manages topology selection, task
    delegation, result synthesis, and conflict escalation. Five topologies:
    hierarchical (supervisor delegates to specialists), pipeline
    (sequential processing chain), peer_to_peer (decentralized), hub_and_spoke
    (router without authority), blackboard (shared knowledge board).
    Delegates task-agent matching to AgentRole and conflict resolution
    to Consensus.
  }

  state {
    teams: set M
    name: M -> String
    members: M -> list {agent_id: String, role_id: String}
    topology: M -> String
    protocol: M -> String
    task_queue: M -> list {task_id: String, description: String,
                           assigned_to: option String, status: String}
    results: M -> list {task_id: String, agent_id: String, result: String}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action assemble(name: String,
                    members: list {agent_id: String, role_id: String},
                    topology: String, protocol: String) {
      -> ok(team: M) {
        Forms a team. Topology: hierarchical, pipeline, peer_to_peer,
        hub_and_spoke, blackboard. Protocol: contract_net, voting,
        confidence_based, round_robin.
      }
      -> invalid(message: String) {
        Unknown topology or protocol.
      }
    }

    action delegate(team: M, task: String) {
      -> ok(assignment: {agent_id: String, task_id: String}) {
        Assigns task based on topology:
        - Hierarchical: supervisor breaks down and assigns to specialists.
        - Pipeline: sends to first agent in chain.
        - Contract Net: broadcasts, collects bids via AgentRole, awards.
        - Hub-and-Spoke: routes to best-fit specialist.
        - Blackboard: posts task to board, agents self-select.
      }
      -> no_capable_agent(message: String) {
        No team member can handle this task.
      }
    }

    action synthesize(team: M, task_id: String) {
      -> ok(result: String, contributors: list String) {
        Aggregates results from all agents that worked on the task.
        For pipeline: returns final agent's output.
        For others: merges partial results.
      }
      -> incomplete(pending_agents: list String) {
        Some agents haven't completed yet.
      }
    }

    action resolveConflict(team: M, task_id: String) {
      -> ok(resolution: String, method: String) {
        Escalates to Consensus when agents produce contradictory results.
        Returns resolved answer and the method used.
      }
      -> deadlock(message: String) {
        Consensus could not be reached.
      }
    }

    action addMember(team: M, agent_id: String, role_id: String) {
      -> ok(team: M) {
        Adds a member to the team.
      }
      -> notfound(message: String) {
        Team not found.
      }
    }

    action removeMember(team: M, agent_id: String) {
      -> ok(team: M) {
        Removes a member. Reassigns their pending tasks.
      }
      -> notfound(message: String) {
        Agent not in team.
      }
    }

    action getStatus(team: M) {
      -> ok(members: list {agent_id: String, role: String, current_task: option String},
            pending_tasks: Int, completed_tasks: Int) {
        Returns team status.
      }
    }
  }

  invariant {
    after assemble(name: "research", members: [{agent_id: "a1",
                   role_id: "researcher"}, {agent_id: "a2",
                   role_id: "writer"}],
                   topology: "pipeline", protocol: "round_robin")
      -> ok(team: m)
    then delegate(team: m, task: "Write a report on X")
      -> ok(assignment: _)
  }
}
```

### 5.8 Concept: AgentRole

```
@version(1)
concept AgentRole [K] {

  purpose {
    Capability declaration for agents enabling task-agent matching in
    multi-agent systems. Agents declare what they can do so orchestrators
    and Contract Net protocols can match tasks to capable agents. Tracks
    performance history per task type for weighted delegation.
  }

  state {
    roles: set K
    name: K -> String
    capabilities: K -> list {task_type: String, proficiency: Float}
    constraints: K -> {
      max_concurrent: Int,
      required_tools: list String,
      expertise_domains: list String
    }
    current_load: K -> Int
    performance: K -> list {task_type: String, success_rate: Float,
                            avg_latency_ms: Float, avg_cost: Float,
                            total_tasks: Int}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action define(name: String,
                  capabilities: list {task_type: String, proficiency: Float},
                  constraints: {max_concurrent: Int,
                               required_tools: list String,
                               expertise_domains: list String}) {
      -> ok(role: K) {
        Creates a role definition. Proficiency 0.0-1.0 per task type.
      }
      -> invalid(message: String) {
        Missing capabilities.
      }
    }

    action bid(role: K, task_description: String, task_type: String) {
      -> ok(bid: {role: K, estimated_quality: Float,
            estimated_latency_ms: Int, estimated_cost: Float}) {
        Agent evaluates task against capabilities and current load.
        Returns a competitive bid. This is the Contract Net bid response.
      }
      -> decline(reason: String) {
        Cannot handle this task (wrong type, at capacity, missing tools).
      }
    }

    action match(task_type: String) {
      -> ok(ranked: list {role: K, score: Float}) {
        Returns roles capable of this task, ranked by historical
        performance (success_rate * proficiency, adjusted for load).
      }
      -> no_match(message: String) {
        No role handles this task type.
      }
    }

    action recordOutcome(role: K, task_type: String, success: Bool,
                         latency_ms: Int, cost: Float) {
      -> ok(role: K) {
        Updates performance history.
      }
      -> notfound(message: String) {
        Role not found.
      }
    }

    action getAvailability(role: K) {
      -> ok(available: Bool, current_load: Int, max: Int) {
        Whether the role can accept new tasks.
      }
      -> notfound(message: String) {
        Role not found.
      }
    }
  }

  invariant {
    after define(name: "researcher", capabilities: [{task_type: "search",
                 proficiency: 0.9}], constraints: {max_concurrent: 3,
                 required_tools: ["web_search"], expertise_domains: ["science"]})
      -> ok(role: k)
    then bid(role: k, task_description: "Find papers on X",
             task_type: "search")
      -> ok(bid: _)
  }
}
```

### 5.9 Concept: Blackboard

```
@version(1)
concept Blackboard [B] {

  purpose {
    Shared knowledge repository for asynchronous multi-agent collaboration.
    Agents communicate exclusively by reading from and writing to the board.
    Eliminates redundant message passing — all agents share one context.
    Agents subscribe to entry types and get notified when relevant data
    appears. Exceptional token efficiency compared to message-passing
    topologies. Includes conflict resolution for contradictory posts.
  }

  state {
    boards: set B
    entries: B -> list {id: String, agent_id: String, entry_type: String,
                        content: String, confidence: Float,
                        timestamp: DateTime, status: String}
    entry_schema: B -> list {entry_type: String, schema: String}
    subscriptions: B -> list {agent_id: String, entry_types: list String,
                              condition: option String}
    access_log: B -> list {agent_id: String, action: String,
                           entry_id: String, timestamp: DateTime}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(entry_schema: list {entry_type: String, schema: String}) {
      -> ok(board: B) {
        Creates a blackboard with typed entry schemas.
      }
      -> invalid(message: String) {
        Invalid schema definitions.
      }
    }

    action post(board: B, agent_id: String, entry_type: String,
                content: String, confidence: Float) {
      -> ok(entry_id: String) {
        Agent posts a finding. Validates against entry_schema.
        Notifies subscribers watching this entry_type.
        Confidence 0.0-1.0.
      }
      -> schema_violation(errors: list {path: String, message: String}) {
        Content doesn't match entry_type schema.
      }
    }

    action query(board: B, entry_type: option String,
                 filters: option String) {
      -> ok(entries: list {id: String, agent_id: String,
            content: String, confidence: Float, timestamp: DateTime}) {
        Reads the board. Optionally filters by type and custom predicates.
      }
      -> empty(message: String) {
        No matching entries.
      }
    }

    action subscribe(board: B, agent_id: String,
                     entry_types: list String,
                     condition: option String) {
      -> ok(subscription_id: String) {
        Registers interest. Agent gets notified via sync when new
        matching entries appear.
      }
      -> notfound(message: String) {
        Board not found.
      }
    }

    action challenge(board: B, entry_id: String,
                     challenger_agent_id: String,
                     counter_evidence: String) {
      -> ok(entry_id: String) {
        Challenges a posted finding. Sets entry status to "challenged".
        Posts the counter-evidence as a linked entry.
      }
      -> notfound(message: String) {
        Entry not found.
      }
    }

    action resolve(board: B, entry_ids: list String, strategy: String) {
      -> ok(resolved_entry_id: String) {
        Resolves contradictory entries. Strategy: latest_wins,
        highest_confidence, merge, escalate_to_consensus.
      }
      -> unresolvable(message: String) {
        Cannot resolve automatically.
      }
    }

    action snapshot(board: B) {
      -> ok(state: String, entry_count: Int) {
        Full board state for context injection into agent prompts.
      }
    }
  }

  invariant {
    after create(entry_schema: [{entry_type: "finding",
                 schema: "{\"type\": \"object\"}"}]) -> ok(board: b)
    and  post(board: b, agent_id: "a1", entry_type: "finding",
              content: "{\"fact\": \"X\"}", confidence: 0.9)
      -> ok(entry_id: _)
    then query(board: b, entry_type: "finding", filters: _)
      -> ok(entries: _)
  }
}
```

### 5.10 Concept: AgentHandoff

```
@version(1)
concept AgentHandoff [D] {

  purpose {
    Structured transfer of control between agents with context packaging.
    Different from message passing (appending to conversation) because
    handoff involves context summarization, tool state transfer,
    responsibility transfer, and acceptance/rejection protocol.
  }

  state {
    handoffs: set D
    source_agent: D -> String
    target_agent: D -> String
    context_summary: D -> String
    transferred_tools: D -> list String
    transferred_state: D -> option String
    reason: D -> String
    status: D -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action prepare(source: String, target: String, reason: String) {
      -> ok(handoff: D, context_package: String) {
        Summarizes source agent's context, identifies tools and state
        to transfer. Creates a context package for the target.
      }
      -> error(message: String) {
        Cannot prepare (source agent not found or no context).
      }
    }

    action execute(handoff: D) {
      -> ok(handoff: D) {
        Target agent accepts. Tools and state transferred.
        Source agent's status set to idle.
      }
      -> rejected(reason: String) {
        Target agent cannot accept (incompatible capabilities,
        at capacity, etc.).
      }
    }

    action escalate(source: String, reason: String) {
      -> ok(handoff: D) {
        Special case: agent admits it can't handle the task and
        escalates to a more capable agent or human.
      }
      -> no_target(message: String) {
        No suitable escalation target.
      }
    }

    action getHistory(task_id: String) {
      -> ok(chain: list {from: String, to: String, reason: String,
            timestamp: DateTime}) {
        Full handoff chain for a task.
      }
      -> empty(message: String) {
        No handoff history for this task.
      }
    }
  }

  invariant {
    after prepare(source: "agent_a", target: "agent_b",
                  reason: "Task requires coding expertise")
      -> ok(handoff: d, context_package: _)
    then execute(handoff: d) -> ok(handoff: d)
  }
}
```

### 5.11 Concept: Consensus

```
@version(1)
@gate
concept Consensus [N] {

  purpose {
    Multi-agent decision-making when agents produce contradictory results
    or propose incompatible strategies. Supports voting (simple majority,
    weighted, unanimous), confidence-based resolution (with overconfidence
    discounting), and iterative refinement (agents debate until convergence).
  }

  state {
    sessions: set N
    proposal: N -> String
    votes: N -> list {agent_id: String, position: String,
                      confidence: Float, reasoning: String}
    method: N -> String
    max_rounds: N -> Int
    current_round: N -> Int
    agent_weights: N -> list {agent_id: String, weight: Float}
    outcome: N -> option {decision: String, method: String, round: Int}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(proposal: String, method: String, max_rounds: Int) {
      -> ok(session: N) {
        Creates a consensus session. Method: simple_majority, weighted
        (by historical accuracy), unanimous, supermajority,
        confidence_based, iterative_refinement.
      }
      -> invalid(message: String) {
        Unknown method.
      }
    }

    action vote(session: N, agent_id: String, position: String,
                confidence: Float, reasoning: String) {
      -> ok(session: N) {
        Records a vote. Position is the agent's answer or choice.
        Confidence 0.0-1.0. For confidence_based: chronically
        overconfident agents get dynamically discounted.
      }
      -> already_voted(message: String) {
        Agent already voted this round.
      }
    }

    action tally(session: N) {
      -> ok(decision: String, vote_count: Int,
            breakdown: list {position: String, votes: Int,
                            weighted_score: Float}) {
        Computes outcome based on method.
      }
      -> deadlock(positions: list {position: String, votes: Int}) {
        No clear winner. May need another round or escalation.
      }
    }

    action challenge(session: N, agent_id: String,
                     counter_argument: String) {
      -> ok(new_round: Int) {
        Starts a new round. For iterative_refinement: dissenting
        agents share reasoning, all agents re-vote. Increments
        current_round.
      }
      -> max_rounds_exceeded(best_position: String) {
        Hit max_rounds without convergence.
      }
    }

    action resolve(session: N) {
      -> ok(decision: String, confidence: Float, method: String) {
        Forces a final decision. Uses the highest-confidence position
        if tally produced a deadlock.
      }
      -> unresolvable(positions: list String) {
        Cannot determine a winner by any fallback method.
        Should escalate to human.
      }
    }

    action setWeight(session: N, agent_id: String, weight: Float) {
      -> ok(session: N) {
        Adjusts agent influence. Based on historical accuracy.
      }
      -> notfound(message: String) {
        Agent not participating.
      }
    }
  }

  invariant {
    after create(proposal: "Which approach to use?",
                 method: "weighted", max_rounds: 3) -> ok(session: n)
    and  vote(session: n, agent_id: "a1", position: "approach_A",
              confidence: 0.8, reasoning: "Better coverage")
      -> ok(session: n)
    and  vote(session: n, agent_id: "a2", position: "approach_B",
              confidence: 0.6, reasoning: "Lower cost")
      -> ok(session: n)
    then tally(session: n) -> ok(decision: _, vote_count: 2, breakdown: _)
  }
}
```

### 5.12 Concept: Constitution

```
@version(1)
concept Constitution [W] {

  purpose {
    Formalized list of ethical, stylistic, or business-logic axioms used
    during Critique-Revision loops to align model behavior. Enables
    Constitutional AI (CAI) and RLAIF. Model critiques its own output
    against principles, then revises. Transparent, scalable rule sets
    replacing subjective human ratings.
  }

  state {
    constitutions: set W
    name: W -> String
    principles: W -> list {id: String, text: String, category: String,
                           priority: Int}
    revision_config: W -> {max_revisions: Int,
                           critique_model: option String}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(name: String,
                  principles: list {text: String, category: String,
                                   priority: Int}) {
      -> ok(constitution: W) {
        Categories: ethical, stylistic, safety, business_logic,
        factual_grounding.
      }
      -> invalid(message: String) {
        No principles provided.
      }
    }

    action critique(constitution: W, response: String, prompt: String) {
      -> ok(critique: String, violations: list {principle_id: String,
            explanation: String, severity: String}) {
        Evaluates response against principles.
      }
      -> compliant(message: String) {
        Response satisfies all principles.
      }
    }

    action revise(constitution: W, response: String, critique: String) {
      -> ok(revised: String, changes: list {principle_id: String,
            original: String, revised: String}) {
        Generates revised response addressing critique.
      }
      -> error(message: String) {
        Revision failed.
      }
    }

    action critiqueAndRevise(constitution: W, response: String,
                             prompt: String) {
      -> ok(final: String, rounds: Int,
            history: list {critique: String, revision: String}) {
        Full Critique-Revision loop up to max_revisions.
      }
      -> max_revisions(best: String, rounds: Int) {
        Could not achieve full compliance.
      }
    }

    action addPrinciple(constitution: W, text: String, category: String,
                        priority: Int) {
      -> ok(principle_id: String) {
        Adds a principle.
      }
      -> notfound(message: String) {
        Constitution not found.
      }
    }

    action removePrinciple(constitution: W, principle_id: String) {
      -> ok(constitution: W) {
        Removes a principle.
      }
      -> notfound(message: String) {
        Principle not found.
      }
    }
  }

  invariant {
    after create(name: "safety", principles: [{text: "Never generate harmful content",
                 category: "safety", priority: 1}]) -> ok(constitution: w)
    then critique(constitution: w, response: "safe response", prompt: "test")
         -> compliant(message: _)
  }
}
```

---

## 6. LLM RAG Suite

### 6.1 Suite Manifest

```yaml
suite:
  name: llm-rag
  version: 0.1.0
  description: "Retrieval-augmented generation: vector storage and search, multi-stage retrieval with reranking, and intelligent document chunking."

concepts:
  VectorIndex:
    spec: ./vector-index.concept
    params:
      X: { as: index-id, description: "Vector index identifier" }
  Retriever:
    spec: ./retriever.concept
    params:
      R: { as: retriever-id, description: "Retriever instance identifier" }
  DocumentChunk:
    spec: ./document-chunk.concept
    params:
      D: { as: chunk-id, description: "Document chunk identifier" }

syncs:
  required:
    - retriever-embeds-query.sync
    - retriever-searches-index.sync
    - chunk-embeds-and-indexes.sync
  recommended:
    - retriever-reranks-results.sync
    - retriever-injects-into-assembly.sync
  integration:
    - vector-store-provider.sync
    - knowledge-graph-provider.sync

uses:
  - suite: llm-core
    concepts:
      - name: LLMProvider
  - suite: llm-prompt
    optional: true
    concepts:
      - name: PromptAssembly
  - suite: foundation
    optional: true
    concepts:
      - name: ContentNode
  - suite: data-organization
    optional: true
    concepts:
      - name: Graph
```

### 6.2 Concept: VectorIndex

```
@version(1)
concept VectorIndex [X] {

  purpose {
    Stores embedding vectors with metadata and provides similarity search.
    The database of the RAG stack. Abstracts over backends from in-process
    FAISS to managed Pinecone to pgvector. Supports hybrid search combining
    vector similarity with keyword search via reciprocal rank fusion.
    Manages its own embedding configuration (model, dimensions) since
    Embedding was absorbed here.
  }

  state {
    indexes: set X
    dimensions: X -> Int
    distance_metric: X -> String
    index_type: X -> String
    backend: X -> String
    embedding_model: X -> String
    collections: X -> list String
    document_count: X -> Int
    index_config: X -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(dimensions: Int, distance_metric: String,
                  index_type: String, backend: String,
                  embedding_model: String) {
      -> ok(index: X) {
        Distance: cosine, dot_product, euclidean.
        Index type: hnsw, ivf_flat, flat.
        Backend: pinecone, qdrant, chromadb, pgvector, faiss, weaviate.
        Embedding_model: model ID for embed calls.
      }
      -> invalid(message: String) {
        Incompatible settings.
      }
    }

    action embed(index: X, text: String) {
      -> ok(vector: list Float) {
        Generates embedding using the index's configured embedding_model.
        Calls LLMProvider.embed via sync.
      }
      -> error(message: String) {
        Embedding model unavailable.
      }
    }

    action embedBatch(index: X, texts: list String) {
      -> ok(vectors: list {text: String, vector: list Float}, count: Int) {
        Batch embedding via configured model.
      }
      -> partial(completed: Int, failed: Int) {
        Some embeddings failed.
      }
    }

    action add(index: X, id: String, vector: list Float,
               metadata: option String) {
      -> ok() {
        Inserts vector with optional JSON metadata.
      }
      -> dimension_mismatch(expected: Int, got: Int) {
        Vector dimensions don't match.
      }
    }

    action addBatch(index: X, items: list {id: String, vector: list Float,
                    metadata: option String}) {
      -> ok(count: Int) {
        Bulk insert.
      }
      -> partial(added: Int, failed: Int, errors: list String) {
        Some inserts failed.
      }
    }

    action search(index: X, query_vector: list Float, k: Int,
                  filters: option String) {
      -> ok(results: list {id: String, score: Float,
            metadata: option String}) {
        Top-k similarity search with optional metadata filters.
      }
      -> empty(message: String) {
        No results.
      }
    }

    action hybridSearch(index: X, query_vector: list Float,
                        keyword_query: String, vector_weight: Float,
                        k: Int) {
      -> ok(results: list {id: String, score: Float,
            metadata: option String}) {
        Combines vector + BM25 via reciprocal rank fusion.
        vector_weight 0=BM25 only, 1=vector only.
      }
      -> empty(message: String) {
        No results.
      }
    }

    action mmrSearch(index: X, query_vector: list Float, k: Int,
                     diversity: Float) {
      -> ok(results: list {id: String, score: Float,
            metadata: option String}) {
        Maximal marginal relevance. Diversity 0-1.
      }
      -> empty(message: String) {
        No results.
      }
    }

    action delete(index: X, ids: list String) {
      -> ok(deleted: Int) {
        Removes vectors by ID.
      }
      -> notfound(message: String) {
        Some IDs not found.
      }
    }
  }

  invariant {
    after create(dimensions: 1536, distance_metric: "cosine",
                 index_type: "hnsw", backend: "qdrant",
                 embedding_model: "text-embedding-3-small") -> ok(index: x)
    and  add(index: x, id: "doc1", vector: v, metadata: _) -> ok()
    then search(index: x, query_vector: v, k: 1, filters: _)
         -> ok(results: _)
  }
}
```

### 6.3 Concept: Retriever

```
@version(1)
concept Retriever [R] {

  purpose {
    RAG orchestration layer. Takes natural-language query, finds relevant
    content, prepares for LLM consumption. Multi-stage pipeline:
    first-stage retrieval (fast, high-recall) then re-ranking (accurate)
    then compression. Supports multi-query expansion, self-query metadata
    filtering, contextual compression, and hierarchical retrieval.
  }

  state {
    retrievers: set R
    retriever_type: R -> String
    source_ids: R -> list String
    top_k: R -> Int
    reranker_config: R -> option {model: String, top_n: Int}
    filters: R -> option String
    score_threshold: R -> option Float
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(retriever_type: String, source_ids: list String,
                  top_k: Int, score_threshold: option Float) {
      -> ok(retriever: R) {
        Type: vector, multi_query, self_query, parent_document,
        ensemble, contextual_compression, recursive.
      }
      -> invalid(message: String) {
        Unknown type.
      }
    }

    action retrieve(retriever: R, query: String) {
      -> ok(documents: list {id: String, content: String, score: Float,
            metadata: option String}) {
        Core retrieval.
      }
      -> empty(message: String) {
        No relevant documents.
      }
    }

    action multiQueryRetrieve(retriever: R, query: String) {
      -> ok(documents: list {id: String, content: String, score: Float}) {
        RAG-Fusion: generates multiple query variations via LLM,
        retrieves for each, deduplicates via reciprocal rank fusion.
      }
      -> empty(message: String) {
        No results.
      }
    }

    action selfQueryRetrieve(retriever: R, query: String) {
      -> ok(documents: list {id: String, content: String, score: Float},
            extracted_filters: String) {
        LLM extracts structured filters from natural language.
        Applies semantic + metadata filtering.
      }
      -> empty(message: String) {
        No results.
      }
    }

    action rerank(retriever: R, query: String,
                  documents: list {id: String, content: String}) {
      -> ok(reranked: list {id: String, content: String, score: Float}) {
        Cross-encoder scoring. Returns top reranker_config.top_n.
      }
      -> error(message: String) {
        Reranker unavailable.
      }
    }

    action compress(retriever: R, query: String,
                    documents: list {id: String, content: String}) {
      -> ok(compressed: list {id: String, content: String,
            original_length: Int, compressed_length: Int}) {
        Extracts only query-relevant portions.
      }
      -> error(message: String) {
        Compression failed.
      }
    }

    action setReranker(retriever: R, model: String, top_n: Int) {
      -> ok(retriever: R) {
        Configures reranking model.
      }
      -> invalid(message: String) {
        Unknown model.
      }
    }
  }

  invariant {
    after create(retriever_type: "vector", source_ids: ["idx1"],
                 top_k: 5, score_threshold: _) -> ok(retriever: r)
    then retrieve(retriever: r, query: "test") -> ok(documents: _)
  }
}
```

### 6.4 Concept: DocumentChunk

```
@version(1)
concept DocumentChunk [D] {

  purpose {
    Segment of a larger document with metadata, embeddings, and relationship
    links. Bridge between raw content and vector search. Encapsulates
    chunking strategies central to RAG quality: recursive, semantic,
    sentence, fixed-size, structural, agentic.
  }

  state {
    chunks: set D
    text: D -> String
    metadata: D -> {source_document_id: String, position: Int,
                    page_number: option Int, section_title: option String}
    embedding: D -> option list Float
    relationships: D -> {
      parent_document_id: String,
      prev_chunk_id: option String,
      next_chunk_id: option String,
      child_chunk_ids: list String
    }
    chunk_strategy: D -> String
    token_count: D -> Int
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action split(document_id: String, content: String, strategy: String,
                 config: {chunk_size: Int, chunk_overlap: Int}) {
      -> ok(chunks: list D, count: Int) {
        Strategy: recursive (hierarchical separators, default
        chunk_size=512 overlap=50), semantic (embedding similarity
        grouping), sentence, fixed_size, structural (markdown/HTML),
        agentic (LLM-based, highest quality/cost).
        Sets prev/next relationships.
      }
      -> error(message: String) {
        Unknown strategy.
      }
    }

    action enrich(chunk: D, extractors: list String) {
      -> ok(chunk: D) {
        Adds metadata: entities, keywords, summary, questions.
      }
      -> notfound(message: String) {
        Chunk not found.
      }
    }

    action getContext(chunk: D, window_size: Int) {
      -> ok(chunks: list {chunk: D, text: String, position: String}) {
        Returns surrounding chunks via prev/next relationships.
      }
      -> notfound(message: String) {
        Chunk not found.
      }
    }

    action getParent(chunk: D) {
      -> ok(parent_text: String, parent_id: String) {
        Returns full parent document. For parent_document retrieval
        pattern: search small chunks, return full parent for context.
      }
      -> notfound(message: String) {
        Parent not found.
      }
    }
  }

  invariant {
    after split(document_id: "doc1", content: "long text",
                strategy: "recursive", config: {chunk_size: 512,
                chunk_overlap: 50}) -> ok(chunks: _, count: _)
    then getContext(chunk: _, window_size: 1) -> ok(chunks: _)
  }
}
```

---

## 7. LLM Safety & Observability Suite

### 7.1 Suite Manifest

```yaml
suite:
  name: llm-safety
  version: 0.1.0
  description: "Safety enforcement, execution tracing with cost tracking, and semantic intent routing."

concepts:
  Guardrail:
    spec: ./guardrail.concept
    params:
      G: { as: guardrail-id, description: "Guardrail rule identifier" }
  LLMTrace:
    spec: ./llm-trace.concept
    params:
      Z: { as: trace-id, description: "Trace identifier" }
  SemanticRouter:
    spec: ./semantic-router.concept
    params:
      S: { as: route-id, description: "Semantic route identifier" }

syncs:
  required:
    - generation-creates-trace-span.sync
    - guardrail-checks-input.sync
    - guardrail-checks-output.sync
  recommended:
    - trace-records-cost.sync
    - guardrail-escalates-to-notification.sync
    - router-selects-pipeline.sync
  integration:
    - trace-exports-opentelemetry.sync

uses:
  - suite: llm-core
    concepts:
      - name: LLMProvider
  - suite: notification
    optional: true
    concepts:
      - name: Notification
  - suite: infrastructure
    optional: true
    concepts:
      - name: EventBus
```

*(Guardrail, LLMTrace, and SemanticRouter concept specs remain unchanged from v0.1.0 — omitted for brevity but included in the full file. See Section 7.2-7.4 of v0.1.0.)*

---

## 8. LLM Training Suite

### 8.1 Suite Manifest

```yaml
suite:
  name: llm-training
  version: 0.1.0
  description: "Fine-tuning lifecycle management, parameter-efficient adaptation (LoRA/QLoRA), and golden evaluation datasets for continuous behavioral testing."

concepts:
  TrainingRun:
    spec: ./training-run.concept
    params:
      J: { as: run-id, description: "Training run identifier" }
  Adapter:
    spec: ./adapter.concept
    params:
      A: { as: adapter-id, description: "LoRA adapter identifier" }
  EvaluationDataset:
    spec: ./evaluation-dataset.concept
    params:
      V: { as: dataset-id, description: "Evaluation dataset identifier" }

syncs:
  required:
    - training-evaluates-on-dataset.sync
    - adapter-attaches-to-provider.sync
  recommended:
    - training-tracks-cost.sync
    - dataset-detects-drift.sync
  integration:
    - adapter-registers-with-router.sync

uses:
  - suite: llm-core
    concepts:
      - name: LLMProvider
      - name: ModelRouter
  - suite: llm-safety
    optional: true
    concepts:
      - name: LLMTrace
```

### 8.2 Concept: TrainingRun

```
@version(1)
@gate
concept TrainingRun [J] {

  purpose {
    Manages fine-tuning job lifecycle: dataset preparation, hyperparameter
    configuration, training execution, checkpoint management, evaluation,
    and model export. Supports both full fine-tuning and parameter-efficient
    methods (via sync to Adapter). Tracks cost and resource usage.
  }

  state {
    runs: set J
    name: J -> String
    base_model: J -> String
    dataset_ref: J -> String
    hyperparameters: J -> {
      learning_rate: Float,
      epochs: Int,
      batch_size: Int,
      warmup_steps: Int
    }
    status: J -> String
    checkpoints: J -> list {epoch: Int, loss: Float, path: String,
                            timestamp: DateTime}
    evaluation_scores: J -> list {metric: String, score: Float}
    cost: J -> Float
    duration_ms: J -> Int
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action create(name: String, base_model: String, dataset_ref: String,
                  hyperparameters: {learning_rate: Float, epochs: Int,
                                   batch_size: Int, warmup_steps: Int}) {
      -> ok(run: J) {
        Creates a training run. Status: "created".
      }
      -> invalid(message: String) {
        Missing parameters or unknown base model.
      }
    }

    action start(run: J) {
      -> ok(run: J) {
        Begins training. Status: "training". Checkpoints saved
        per epoch. This action may complete asynchronously (@gate).
      }
      -> insufficient_data(count: Int, minimum: Int) {
        Dataset too small.
      }
      -> error(message: String) {
        Training infrastructure unavailable.
      }
    }

    action pause(run: J) {
      -> ok(run: J, checkpoint: String) {
        Pauses at current epoch. Status: "paused".
      }
      -> not_running(message: String) {
        Run is not in "training" status.
      }
    }

    action resume(run: J) {
      -> ok(run: J) {
        Resumes from last checkpoint.
      }
      -> not_paused(message: String) {
        Run is not paused.
      }
    }

    action evaluate(run: J, dataset_ref: String) {
      -> ok(scores: list {metric: String, score: Float}) {
        Evaluates the latest checkpoint against a dataset.
        Metrics: accuracy, perplexity, SemanticF1, answer_relevancy.
      }
      -> not_ready(message: String) {
        No checkpoint available yet.
      }
    }

    action export(run: J, format: String) {
      -> ok(artifact_path: String, model_id: String) {
        Exports the trained model. Format: safetensors, gguf,
        provider_api (upload to provider's fine-tuning API).
      }
      -> not_complete(message: String) {
        Training not finished.
      }
    }

    action cancel(run: J) {
      -> ok(run: J) {
        Cancels training. Status: "cancelled".
      }
      -> not_running(message: String) {
        Run not active.
      }
    }

    action getStatus(run: J) {
      -> ok(status: String, current_epoch: Int, total_epochs: Int,
            current_loss: Float, elapsed_ms: Int, cost: Float) {
        Returns current training progress.
      }
      -> notfound(message: String) {
        Run not found.
      }
    }
  }

  invariant {
    after create(name: "domain_ft", base_model: "llama-3", dataset_ref: "ds1",
                 hyperparameters: {learning_rate: 0.0001, epochs: 3,
                 batch_size: 8, warmup_steps: 100}) -> ok(run: j)
    then start(run: j) -> ok(run: j)
  }
}
```

### 8.3 Concept: Adapter

```
@version(1)
concept Adapter [A] {

  purpose {
    LoRA/QLoRA weight management for parameter-efficient fine-tuning.
    Injects trainable low-rank decomposition matrices into frozen base
    model layers. Supports training (typically <0.2% of total parameters),
    merging into base weights (zero inference latency), hot-swapping at
    inference time, and composing multiple adapters.
  }

  state {
    adapters: set A
    name: A -> String
    base_model_id: A -> String
    rank: A -> Int
    target_modules: A -> list String
    quantization: A -> String
    weights: A -> option Bytes
    training_status: A -> String
    merged: A -> Bool
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(name: String, base_model_id: String, rank: Int,
                  target_modules: list String, quantization: String) {
      -> ok(adapter: A) {
        Creates adapter config. Rank: typically 8-64 (lower = fewer
        params, less expressive). Target_modules: query, value, key,
        output (projection matrices to inject into). Quantization:
        none, 4bit (QLoRA), 8bit. Training_status: "untrained".
      }
      -> invalid(message: String) {
        Invalid rank or unknown target modules.
      }
    }

    action train(adapter: A, dataset_ref: String,
                 config: {learning_rate: Float, epochs: Int,
                         batch_size: Int}) {
      -> ok(adapter: A, trainable_params: Int, total_params: Int,
            trainable_pct: Float) {
        Trains the adapter weights. Reports parameter efficiency.
        Typical: trainable_pct < 0.2%. Training_status: "trained".
      }
      -> error(message: String) {
        Training failed.
      }
    }

    action merge(adapter: A) {
      -> ok(merged_model_id: String) {
        Folds adapter weights into base model weights. Results in zero
        additional inference latency. Sets merged=true. The merged model
        can be registered as a new LLMProvider.
      }
      -> not_trained(message: String) {
        Adapter not trained yet.
      }
    }

    action swap(adapter: A, active: Bool) {
      -> ok(adapter: A) {
        Hot-swaps adapter at inference time. When active=true, adapter
        weights are applied on top of frozen base model for each forward
        pass. Multiple adapters can be swapped without reloading the
        base model.
      }
      -> not_trained(message: String) {
        Adapter not trained.
      }
    }

    action compose(adapter_a: A, adapter_b: A) {
      -> ok(combined: A) {
        Stacks two adapters. Combined effect applied at inference.
        Useful for combining domain adaptation + task specialization.
      }
      -> incompatible(message: String) {
        Adapters target different base models or incompatible modules.
      }
    }

    action export(adapter: A, format: String) {
      -> ok(path: String) {
        Exports adapter weights. Format: safetensors, peft_checkpoint.
      }
      -> not_trained(message: String) {
        Nothing to export.
      }
    }
  }

  invariant {
    after create(name: "domain_lora", base_model_id: "llama-3", rank: 16,
                 target_modules: ["query", "value"], quantization: "4bit")
      -> ok(adapter: a)
    then train(adapter: a, dataset_ref: "ds1",
               config: {learning_rate: 0.0002, epochs: 3, batch_size: 4})
      -> ok(adapter: a, trainable_params: _, total_params: _,
            trainable_pct: _)
  }
}
```

### 8.4 Concept: EvaluationDataset

```
@version(1)
concept EvaluationDataset [V] {

  purpose {
    Golden datasets for continuous behavioral testing of LLM systems.
    Curated collections of reference inputs and expected outcomes. Detects
    prompt drift (silent degradation when models update). Supports
    LLM-as-judge evaluation, semantic scoring, and statistical comparison
    between versions.
  }

  state {
    datasets: set V
    name: V -> String
    examples: V -> list {id: String, input: String, expected: String,
                         rubric: option String, tags: list String}
    version: V -> Int
    evaluation_history: V -> list {run_id: String, timestamp: DateTime,
                                   program: String, scores: list {metric: String,
                                   score: Float}}
    drift_baseline: V -> option {program: String,
                                  scores: list {metric: String, score: Float}}
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(name: String,
                  examples: list {input: String, expected: String,
                                 rubric: option String,
                                 tags: list String}) {
      -> ok(dataset: V) {
        Creates a golden dataset. Version starts at 1.
      }
      -> invalid(message: String) {
        Empty examples.
      }
    }

    action addExample(dataset: V, input: String, expected: String,
                      rubric: option String, tags: list String) {
      -> ok(example_id: String, dataset: V) {
        Adds an example. Increments version.
      }
      -> notfound(message: String) {
        Dataset not found.
      }
    }

    action evaluate(dataset: V, program: String, metrics: list String) {
      -> ok(overall: Float,
            per_example: list {example_id: String, score: Float},
            per_metric: list {metric: String, score: Float}) {
        Evaluates a program (prompt/pipeline) against the dataset.
        Metrics: accuracy, SemanticF1, answer_relevancy, groundedness,
        tool_correctness. Records in evaluation_history.
      }
      -> error(message: String) {
        Evaluation failed.
      }
    }

    action detectDrift(dataset: V, current_program: String) {
      -> ok(drifted: Bool, drift_magnitude: Float,
            degraded_examples: list {id: String, baseline_score: Float,
                                    current_score: Float}) {
        Compares current performance against drift_baseline.
        drift_magnitude is the absolute score difference.
        Lists examples that degraded most.
      }
      -> no_baseline(message: String) {
        No drift baseline set. Call setBaseline first.
      }
    }

    action setBaseline(dataset: V, program: String) {
      -> ok(dataset: V) {
        Sets the drift detection baseline to current program's scores.
      }
      -> notfound(message: String) {
        Dataset not found.
      }
    }

    action compare(dataset: V, program_a: String, program_b: String) {
      -> ok(winner: String, score_a: Float, score_b: Float,
            confidence: Float,
            per_example: list {id: String, score_a: Float, score_b: Float}) {
        Statistical comparison (paired t-test or bootstrap).
        Confidence: statistical significance of the difference.
      }
      -> error(message: String) {
        Comparison failed.
      }
    }

    action curate(dataset: V, filter_tags: list String) {
      -> ok(subset: list {id: String, input: String, expected: String},
            count: Int) {
        Filters dataset by tags. Returns subset for focused evaluation.
      }
      -> empty(message: String) {
        No examples match tags.
      }
    }
  }

  invariant {
    after create(name: "qa_golden", examples: [{input: "What is 2+2?",
                 expected: "4", rubric: _, tags: ["math"]}]) -> ok(dataset: v)
    then evaluate(dataset: v, program: "gpt-4o + default prompt",
                  metrics: ["accuracy"]) -> ok(overall: _, per_example: _,
                  per_metric: _)
  }
}
```

---

## 9. Sync Catalog

### 9.1 Generation Pipeline

```
sync RouterSelectsProvider [eager]
when { ModelRouter/route => [model_id: ?model] }
then { LLMProvider/generate: [provider: ?model] }

sync GuardrailChecksInput [eager]
when { Conversation/append => [message_id: ?m] }
where { filter(?role = "user") }
then { Guardrail/checkInput: [message: ?content] }

sync GuardrailChecksOutput [eager]
when { LLMProvider/generate => [response: ?resp] }
then { Guardrail/checkOutput: [response: ?resp] }

sync GenerationCreatesTraceSpan [eager]
when { LLMProvider/generate => [response: ?resp] }
then { LLMTrace/endSpan: [status: "ok"; metrics: ?resp] }

sync AssertionTriggersRetry [eager]
when { Assertion/evaluate => [retry_prompt: ?prompt; attempt: ?a; max: ?m] }
then { LLMProvider/generate: [messages: ?prompt] }

sync RouterCircuitBreaker [recommended]
when { LLMProvider/generate => [unavailable: ?msg] }
then { ModelRouter/fallback: [failed_model_id: ?p; error_type: "unavailable"] }
```

### 9.2 Assembly Pipeline

```
sync AssemblyChecksBudget [eager]
when { PromptAssembly/assemble => [total_tokens: ?t] }
where { filter(?t > ?context_window) }
then { PromptAssembly/removeSection: [name: "few_shot_examples"] }

sync AssemblySelectsExamples [eager]
when { PromptAssembly/assemble => _ }
then { FewShotExample/select: [input: ?user_input] }

sync SignatureCompilesToAssembly [eager]
when { Signature/compile => [compiled_prompt: ?prompt] }
then { PromptAssembly/addSection: [name: "compiled_signature"; role: "system"; priority: 90; max_tokens: 2000; required: true; content: ?prompt] }

sync ConversationAutoSummarize [recommended]
when { PromptAssembly/assemble => [sections_truncated: ?trunc] }
where { filter(?trunc contains "conversation_history") }
then { Conversation/summarize: [message_ids: _] }
```

### 9.3 RAG Pipeline

```
sync RetrieverEmbedsQuery [eager]
when { Retriever/retrieve: [query: ?q] => _ }
then { VectorIndex/embed: [text: ?q] }

sync RetrieverSearchesIndex [eager]
when { VectorIndex/embed => [vector: ?v] }
then { VectorIndex/search: [query_vector: ?v; k: 10] }

sync ChunkEmbedsAndIndexes [eager]
when { DocumentChunk/split => [chunks: ?chunks] }
then { VectorIndex/embedBatch: [texts: ?chunks] }

sync EmbeddedChunksIndex [eager]
when { VectorIndex/embedBatch => [vectors: ?vectors] }
then { VectorIndex/addBatch: [items: ?vectors] }

sync RetrieverInjectsIntoAssembly [eager]
when { Retriever/retrieve => [documents: ?docs] }
then { PromptAssembly/addSection: [name: "retrieved_context"; role: "user"; priority: 50; max_tokens: 2000; required: false; content: ?docs] }

sync RetrieverReranksResults [recommended]
when { VectorIndex/search => [results: ?results] }
then { Retriever/rerank: [documents: ?results] }
```

### 9.4 Agent Pipeline

```
sync AgentLoopDispatchesToStrategy [eager]
when { AgentLoop/run: [agent: ?a; goal: ?g; context: ?c; strategy: ?strategy] => _ }
then { PluginRegistry/resolve: [plugin_type: "agent_strategy"; plugin_id: ?strategy] }

sync AgentInvokesTool [eager]
when { AgentLoop/step => [action_request: true; tool_name: ?tool; arguments: ?args] }
then { ToolBinding/invoke: [tool: ?tool; arguments: ?args] }

sync ToolResultFeedsAgent [eager]
when { ToolBinding/invoke => [result: ?result] }
then { AgentLoop/observe: [observation: ?result] }

sync AgentRemembersStep [recommended]
when { AgentLoop/step => [reasoning: ?r; step: ?s] }
then { AgentMemory/remember: [content: ?r; memory_type: "episodic"] }

sync AgentRecallsMemory [recommended]
when { AgentLoop/run: [goal: ?g] => _ }
then { AgentMemory/recall: [query: ?g; memory_type: "semantic"; k: 5] }

sync ConstitutionCritiquesOutput [recommended]
when { AgentLoop/run => [result: ?result] }
then { Constitution/critiqueAndRevise: [response: ?result; prompt: ?goal] }

sync HITLNotification [integration]
when { ToolBinding/invoke => [approval_required: true; tool: ?t; arguments: ?args] }
then { Notification/send: [channel: "hitl"; message: ?args] }
```

### 9.5 Multi-Agent Pipeline

```
sync TeamDelegatesViaRole [eager]
when { AgentTeam/delegate: [team: ?m; task: ?t] => _ }
then { AgentRole/match: [task_type: ?t] }

sync BlackboardNotifiesSubscribers [eager]
when { Blackboard/post: [board: ?b; entry_type: ?et] => [entry_id: ?id] }
then { Blackboard/query: [board: ?b; entry_type: ?et] }

sync ConsensusResolvesConflict [eager]
when { AgentTeam/resolveConflict: [team: ?m; task_id: ?t] => _ }
then { Consensus/tally: [session: _] }

sync HandoffPackagesContext [eager]
when { AgentHandoff/prepare => [handoff: ?d; context_package: ?pkg] }
then { AgentLoop/run: [context: ?pkg] }

sync MultiAgentMessagePassing [integration]
when { AgentLoop/run => [result: ?result] }
then { Conversation/append: [content: ?result] }
```

### 9.6 Training Pipeline

```
sync TrainingEvaluatesOnDataset [eager]
when { TrainingRun/evaluate: [run: ?j; dataset_ref: ?ds] => _ }
then { EvaluationDataset/evaluate: [dataset: ?ds] }

sync AdapterAttachesToProvider [eager]
when { Adapter/merge => [merged_model_id: ?model] }
then { LLMProvider/register: [model_id: ?model] }

sync AdapterRegistersWithRouter [integration]
when { Adapter/swap: [adapter: ?a; active: true] => _ }
then { ModelRouter/addRoute: [model_id: ?a] }

sync TrainingTracksCost [recommended]
when { TrainingRun/start => [run: ?j] }
then { LLMTrace/startTrace: [tags: [{key: "training_run", value: ?j}]] }

sync DatasetDetectsDrift [recommended]
when { EvaluationDataset/detectDrift => [drifted: true; drift_magnitude: ?d] }
where { filter(?d > 0.1) }
then { Notification/send: [channel: "alerts"; message: "Prompt drift detected"] }
```

### 9.7 Strategy Provider Registration

Strategy providers register themselves with PluginRegistry on concept load, consistent with all coordination+provider patterns in Clef. The `optional: true` declaration in suite.yaml triggers framework-level registration. Integration syncs activate when the provider concept is present:

```
sync ReactRoutes [integration]
when { PluginRegistry/resolve: [plugin_type: "agent_strategy"; plugin_id: "react"] => _ }
then { ReactStrategy/execute: [agent_ref: ?a; goal: ?g; context: ?c] }

sync PlanAndExecuteRoutes [integration]
when { PluginRegistry/resolve: [plugin_type: "agent_strategy"; plugin_id: "plan_and_execute"] => _ }
then { PlanAndExecuteStrategy/execute: [agent_ref: ?a; goal: ?g; context: ?c] }

sync TreeOfThoughtRoutes [integration]
when { PluginRegistry/resolve: [plugin_type: "agent_strategy"; plugin_id: "tree_of_thought"] => _ }
then { TreeOfThoughtStrategy/execute: [agent_ref: ?a; goal: ?g; context: ?c] }

sync ReflectionRoutes [integration]
when { PluginRegistry/resolve: [plugin_type: "agent_strategy"; plugin_id: "reflection"] => _ }
then { ReflectionStrategy/execute: [agent_ref: ?a; goal: ?g; context: ?c] }

sync CodeActRoutes [integration]
when { PluginRegistry/resolve: [plugin_type: "agent_strategy"; plugin_id: "code_act"] => _ }
then { CodeActStrategy/execute: [agent_ref: ?a; goal: ?g; context: ?c] }

sync ReWOORoutes [integration]
when { PluginRegistry/resolve: [plugin_type: "agent_strategy"; plugin_id: "rewoo"] => _ }
then { ReWOOStrategy/execute: [agent_ref: ?a; goal: ?g; context: ?c] }
```

### 9.8 Memory & Consolidation

```
sync EpisodicMemoryArchive [recommended]
when { LLMTrace/endSpan: [status: "ok"; metrics: ?m] => _ }
then { AgentMemory/remember: [content: ?m; memory_type: "episodic"] }

sync ProceduralMemoryUpdate [recommended]
when { AgentLoop/run => [result: ?r; steps: ?s] }
where { filter(?s < 3) }
then { AgentMemory/remember: [content: ?r; memory_type: "procedural"] }

sync MemoryConsolidation [eventual]
when { AgentMemory/remember => [entry: ?e] }
then { AgentMemory/consolidate: [] }

sync CostThresholdAlert [recommended]
when { LLMTrace/getCost => [total: ?total] }
where { filter(?total > 100.0) }
then { AutomationRule/trigger: [rule: "cost_threshold"; data: ?total] }
```

---

## 10. Provider Extensions to Existing Concepts

| Existing Concept | Provider Name | Capability Added |
|-----------------|---------------|-----------------|
| **Template** | ChatPromptProvider | Role-based message templates, persona directives, MessagesPlaceholder, multi-modal parts |
| **ExpressionLanguage** | LCELProvider | Pipe-based composition (`prompt \| model \| parser`), RunnableParallel/Branch |
| **Schema** | ToolSchemaProvider | JSON Schema tool/function definitions (MCP, OpenAI, Anthropic formats) |
| **Schema** | OutputSchemaProvider | Structured output schemas with Pydantic-compatible types |
| **Validator** | GuardrailValidatorProvider | Toxicity scoring, PII detection, jailbreak patterns |
| **Validator** | OutputValidatorProvider | LLM response format validation with retry semantics |
| **SearchIndex** | VectorSearchProvider | Embedding-based similarity, ANN, hybrid search with RRF |
| **ContentNode** | ChatMessageNodeProvider | LLM messages as content nodes with role/parts/tool_calls metadata |
| **ContentNode** | DocumentChunkNodeProvider | RAG chunks with parent-child-sibling relationships and embeddings |
| **ContentStorage** | VectorStoreProvider (×6) | Pinecone, Qdrant, ChromaDB, pgvector, Weaviate, FAISS |
| **Queue** | LLMRequestQueueProvider | Token-aware rate limiting (TPM/RPM), priority, multi-key round-robin |
| **Cache** | SemanticCacheProvider | Embed query → vector match cached → return if similarity > 0.85. 40-60% cost reduction |
| **Version** | PromptVersionProvider | Prompt diffs, dev/staging/prod labels, A/B testing, rollback, eval history |
| **EventBus** | StreamEventProvider | text_delta, tool_call_start/delta/end, reasoning_delta, message_complete |
| **PluginRegistry** | MCPServerRegistry | Discover/connect MCP servers, register tools/resources/prompts |
| **PluginRegistry** | ModelProviderRegistry | Register/discover LLMProvider instances by model family and capability |
| **Workflow** | AgentWorkflowProvider | Map agent phases to workflow states, conditional edges, HITL checkpoints |
| **AutomationRule** | ModelFallbackRuleProvider | Fallback chains: model X fails → try Y → try Z |
| **AutomationRule** | CostThresholdRuleProvider | When daily spend > $X → switch to cheaper model |
| **Graph** | KnowledgeGraphProvider | GraphRAG: segment → extract entities → build graph → cluster → summarize |
| **Notification** | HITLNotificationProvider | Approval requests for destructive tools or flagged content |
| **FormBuilder** | SlotFillingProvider | LLM-guided conversational form completion |
| **Renderer** | ChatRendererProvider | Streaming chat UI, tool visualization, thinking blocks |
| **Collection** | ConversationCollectionProvider | Conversation sets with search, filtering, clustering |
| **Collection** | PreferenceDataProvider | RLHF/RLAIF preference pair collection and management |
| **LLMTrace** | RewardEvaluatorProvider | LLM-as-judge scoring (helpfulness, correctness, safety) replacing RewardModel |

---

## 11. Implementation Plan

### Phase 1: Core Foundation (Weeks 1-4)
LLMProvider, ModelRouter, Conversation — minimum viable LLM interaction.

### Phase 2: Prompt Engineering (Weeks 5-7)
Signature, PromptAssembly, FewShotExample, Assertion, PromptOptimizer.

### Phase 3: RAG Pipeline (Weeks 8-10)
VectorIndex, Retriever, DocumentChunk + provider extensions.

### Phase 4: Agent Core (Weeks 11-14)
AgentLoop (coordination) + ReactStrategy + PlanAndExecuteStrategy, ToolBinding, AgentMemory, StateGraph.

### Phase 5: Multi-Agent (Weeks 15-17)
AgentTeam, AgentRole, Blackboard, Consensus, AgentHandoff, Constitution. Remaining strategy providers (TreeOfThought, Reflection, CodeAct, ReWOO).

### Phase 6: Safety & Training (Weeks 18-20)
Guardrail, LLMTrace, SemanticRouter, TrainingRun, Adapter, EvaluationDataset.

### Phase 7: Integration & Composite Suites (Weeks 21-23)
All provider extensions. Constitutional Alignment Suite. Canary Deployment Suite. Multi-Agent Topology Suite. MCP integration via Clef Bind.

### Per-Language Scope

| Language | Scope |
|----------|-------|
| **TypeScript** | Full implementation of all 24 concepts, all 6 strategy providers, all provider extensions |
| **Rust** | Full core + agent + RAG. Strategy providers: React + PlanAndExecute + CodeAct. Training: TrainingRun + Adapter |
| **Swift** | Core + Conversation + RAG (core). Agent: AgentLoop + React + ToolBinding. No training concepts |
| **Solidity** | SDK generation only via Clef Bind. No direct concept implementations (requires network) |

---

## 12. Concept Count Summary

| Category | Count |
|----------|-------|
| Core concepts (independent state + actions + syncs) | 18 |
| Coordination concepts (dispatch via PluginRegistry) | 1 (AgentLoop) |
| Strategy providers (register with PluginRegistry) | 6 |
| Provider extensions to existing concepts | 25 |
| Syncs | 38 |
| Suites | 7 + 3 composite |
| **Total new concept specs** | **25** |
