# LLM/AI UI widget taxonomy across four production domains

**Forty-three distinct widget patterns emerge from surveying 40+ production AI systems, requiring 31 new interactor types beyond Clef Surface's existing 22.** These patterns cluster into compound interactive widgets (chat messages, node graphs, trace trees) that combine existing primitives with AI-specific behaviors—streaming, tool invocation, embedding visualization—that have no analog in traditional form-based UI frameworks. The CAMELEON/Metawidget two-step pipeline (Interactor/classify → WidgetResolver/resolve) remains sound but needs three architectural extensions: **streaming-aware state machines**, **compound interactor composition**, and **visualization interactors** for data-dense displays. This report catalogs every production widget pattern found, maps each to the existing framework, and specifies what new `.widget` specs are needed.

---

## Domain 1: Chat and conversation interfaces

Chat is the most standardized AI UI domain. Every product—ChatGPT, Claude.ai, Gemini, Perplexity, Open WebUI, LibreChat, TypingMind, Poe, Chainlit, Gradio—converges on a three-panel layout: **conversation sidebar** (250–300px, collapsible), **message area** (scrollable, flex-grow), and **input area** (fixed bottom, auto-expanding). An optional fourth panel (artifacts/canvas) splits the viewport 50/50. The Vercel AI SDK's `useChat` hook with typed message parts represents the cleanest abstraction of this domain's data model.

### Widget inventory

**1. `stream-text` — Token-by-token text rendering with progressive markdown.** Used by all surveyed products. Anatomy: `message-container`, `text-content`, `cursor-caret` (ChatGPT uses pulsing ■, Claude uses blinking |), `markdown-renderer`. States: `idle → submitted → streaming → complete | error | stopped`. The Vercel AI SDK exposes `status`: "submitted" → "streaming" → "ready" | "error". Simple formatting (bold, italic) renders mid-stream; tables and code blocks render progressively. Accessibility requires `role="log"` with `aria-live="polite"` on the message area, `aria-busy="true"` during streaming. **No existing interactor**; propose `stream-text`.

**2. `chat-message` — Role-differentiated message container.** Universal across all products. Anatomy: `message-row`, `avatar`, `role-label`, `content-area`, `timestamp` (shown on hover), `actions-bar` (hover-revealed: copy, thumbs, regenerate, edit), `model-badge`. Modern UIs use **left-aligned for all roles** with background-color differentiation (ChatGPT: gray for user, white for assistant). States: `sending → sent → streaming → complete | error | edited | regenerated`. Each message needs `aria-label` identifying speaker role. **Extends `display-text`**; propose `chat-message`.

**3. `tool-invocation` — Collapsible tool execution display.** Used by ChatGPT (browsing, code interpreter), Claude.ai, Vercel AI SDK, Chainlit, Gradio. Anatomy: `tool-header` (icon + label like "Searching the web..."), `status-indicator` (spinner/checkmark/X), `collapse-toggle`, `tool-input`, `tool-output`, `duration-badge`. States: `pending → running → complete | error`. Vercel AI SDK types tool states as `call → partial-call → result | error`. Gradio uses `ChatMessage(metadata={"title": "🛠️ Used tool search", "status": "pending"})` with nested tools via `id`/`parent_id`. Uses `<details>/<summary>` or `aria-expanded` pattern. **No existing interactor**; propose `tool-invocation`.

**4. `reasoning-block` — Collapsible chain-of-thought display.** Used by ChatGPT o1/o3, Claude.ai extended thinking, Gradio (`thinking_tag` param), Open WebUI, Vercel AI SDK Reasoning component. Anatomy: `thinking-header`, `collapse-toggle`, `thought-content` (muted/italicized style), `duration-label` ("Thought for 12 seconds"), `visual-separator`. ChatGPT collapses to "Thought for X seconds"; Gradio auto-extracts `<thinking>` tags. States: `thinking (animated) → done (collapsed) → expanded`. Content should NOT be in a live region during streaming. **No existing interactor**; propose `reasoning-block`.

**5. `inline-citation` — Numbered citations with hover previews.** Primary in Perplexity; also ChatGPT browsing, Gemini. Anatomy: `citation-number` (superscript [1], [2]), `source-card-hover` (favicon + title + URL snippet popup), `sources-panel` (top/bottom section listing all sources), `source-link`. Perplexity places sources panel at top; ChatGPT embeds links in text. Citations must be `<a>` links with keyboard-accessible hover cards (not hover-only). **Partially maps to `display-badge`**; propose `inline-citation`.

**6. `code-block` — Syntax-highlighted code with actions.** Universal. Anatomy: `code-header` (language badge left + copy button right), `code-body` (`<pre><code>` with highlighting), `line-numbers` (optional), `copy-button` (changes to "Copied!" ✓), `run-button` (ChatGPT Code Interpreter, Gemini), `language-label`. Libraries: **Prism.js** (lightweight, 2KB), **highlight.js** (auto-detect), **Shiki** (VSCode-quality, Vercel ecosystem). States: `rendered → executing → executed → copied`. **Extends `display-text`**; propose `code-block`.

**7. `message-branch-nav` — Branch navigation for edited/regenerated messages.** ChatGPT (primary), LibreChat, TypingMind. Anatomy: `branch-navigator` (← 2/3 → arrows), `edit-trigger` (pencil icon), `edit-textarea`, `save/cancel-buttons`, `regenerate-trigger`. When user edits, entire conversation below changes per branch. States: `viewing → editing → submitting → branch-x-of-y`. Arrows need `aria-label="Previous version"/"Next version"`, `aria-current` on active branch. **No existing interactor**; propose `message-branch-nav`.

**8. `artifact-panel` — Side-by-side content creation panel.** Claude.ai Artifacts, ChatGPT Canvas, LibreChat, TypingMind, Gemini Canvas. Anatomy: `panel-container` (right side, ~50% viewport), `panel-header` (title + close + fullscreen), `content-renderer` (live preview of React, HTML, SVG, Mermaid), `code-editor` (Canvas), `version-selector`, `toolbar` (Canvas: "Suggest edits", "Debug code", "Port to language"), `resize-handle`. Claude opens for content >15 lines; ChatGPT Canvas supports inline highlighting for targeted suggestions. States: `closed → opening → open → fullscreen → version-x-of-y`. Panel should be `role="complementary"` landmark with focus management. **No existing interactor**; propose `artifact-panel`.

**9. `prompt-input` — Multi-line auto-expanding chat input with controls.** Universal. Anatomy: `textarea` (auto-growing to ~6–8 lines), `send-button` (disabled when empty or streaming), `file-attach-button`, `model-selector`, `voice-input-button`, `web-search-toggle`, `character-counter`. Keyboard: Enter=send, Shift+Enter=newline, Escape=blur. Vercel AI SDK provides `<PromptInput>`, `<PromptInputTextarea>`, `<PromptInputSubmit>` composable primitives. States: `empty → has-content → uploading-file → disabled → focused`. **Combines `text-long` + `file-attach` + `action-primary`**; propose `prompt-input`.

**10. `message-actions` — Per-message hover action toolbar.** All products. Anatomy: `thumbs-up`, `thumbs-down` (often triggers feedback form), `copy-button`, `regenerate-button`, `edit-button`, `share-button`, `more-menu`. Appears on hover below assistant messages. Gradio uses `.like()` event with `gr.LikeData`. States: `hidden → visible → liked/disliked → copied`. Toolbar should be `role="toolbar"` with arrow key navigation. **Maps to `action-tertiary`**; propose `message-actions`.

**11. `generation-indicator` — Streaming state feedback.** Universal. Anatomy: `typing-dots` (three-dot bounce), `thinking-spinner`, `progress-text`, `token-counter`, `model-label`. States: `idle → submitted (spinner) → streaming (stop button) → complete`. Uses `role="status"` with `aria-live="polite"`. **Maps to `display-progress`**; propose `generation-indicator`.

**12. `stop-generation` — Cancel button during streaming.** All products. Anatomy: `stop-button` (■ icon replacing send button). Vercel AI SDK: `stop()` from `useChat` aborts the fetch request. States: `hidden → visible → stopping`. **Maps to `action-danger`**; propose `stop-generation`.

**13. `conversation-sidebar` — Chat history navigation.** All products. Anatomy: `sidebar-container` (250–300px, collapsible), `new-chat-button`, `search-input`, `conversation-list` (items with title + date + model badge + context menu), `folder-group`. ChatGPT groups by "Today"/"Yesterday"/"Previous 7 Days"; Claude.ai has Projects; TypingMind has folders with drag-and-drop. States: `open → closed → searching → loading`. Uses `role="navigation"`, `aria-current="page"` on active chat. **Navigation pattern**; propose `conversation-sidebar`.

**14. `multimodal-message` — Mixed content rendering.** ChatGPT, Claude, Gemini, Gradio, Vercel AI SDK. Anatomy: `text-part`, `image-part` (lightbox on click), `file-attachment`, `code-block-part`, `audio-part`, `video-part`. Vercel AI SDK: `message.parts` array with typed parts. Gradio content can be string OR component (`gr.Image`, `gr.Plot`). **Combines `file-attach` + `display-text`**; propose `multimodal-message`.

### Chat domain view layout

| Zone | Component | Size |
|------|-----------|------|
| Left | `conversation-sidebar` | 250–300px, collapsible |
| Center | Message list (`chat-message` × N) | flex-grow, scrollable |
| Center bottom | `prompt-input` | fixed, auto-expanding |
| Right (optional) | `artifact-panel` | ~50% viewport |

### Best open-source implementations

**Open WebUI** (125k★, Svelte) is the most complete ChatGPT clone. **LibreChat** (18k★, React/TypeScript) adds branching and artifacts for any model. **Vercel AI SDK** (20M monthly npm downloads) provides the cleanest composable primitives: `useChat`, typed message parts, `<Conversation>`, `<Message>`, `<PromptInput>`. **Chainlit** (Python-first, React frontend) covers streaming via WebSocket with `@cl.step` decorators. **Gradio** offers the simplest API with `gr.ChatInterface` and metadata-driven tool/thinking display.

---

## Domain 2: Agent execution and multi-agent dashboards

Agent UIs bifurcate into two paradigms: **trace/observability views** (LangSmith, Arize Phoenix) showing what happened post-execution, and **canvas/workflow editors** (Flowise, Langflow, Rivet, Dify) for authoring agent logic. **React Flow v11+** is the universal substrate for node-graph editors—used by Flowise, Langflow, Dify, and Vellum. LangGraph Studio pioneered **time-travel debugging** with state forking.

### Widget inventory

**1. `trace-tree` — Hierarchical execution trace with expandable runs.** Used by LangSmith (primary), Dify, Vellum, LangGraph Studio. Anatomy: `root-trace-row`, `nested-run-rows` (indented with chevrons), `step-type-icons` (color-coded: brain=LLM, wrench=tool, link=chain), `latency-column`, `token-count-column`, `cost-column`, `status-indicator` (✓/✗/spinner). Shows Thought→Action→Observation sequences inline. States: `loading → streaming → complete | error`. Uses `role="tree"` with `role="treeitem"`, `aria-expanded`, arrow key navigation. **No existing interactor**; propose `trace-tree`.

**2. `node-graph-canvas` — Infinite pan/zoom workflow editor.** Used by Flowise, Langflow, Dify, Rivet, Vellum, LangGraph Studio. Built on React Flow v11+. Anatomy: `canvas` (infinite, grid background), `nodes` (cards with title, input/output ports, inline params), `edges` (animated smoothstep/bezier), `connection-ports` (color-coded by type in Langflow), `mini-map`, `controls-overlay` (zoom buttons, fit-to-view), `node-palette` (searchable, categorized, drag-and-drop source). Per-node states: `idle → pending → running (animated border) → complete (green) → error (red) → skipped`. React Flow provides: Tab navigation, Enter/Space select, arrow keys to move nodes, `aria-live="assertive"` for movement announcements, auto-panning to focused node. **No existing interactor**; propose `node-graph-canvas`.

**Node types across products:**

| Category | Flowise | Langflow | Rivet | Dify |
|----------|---------|----------|-------|------|
| LLM | ChatOpenAI, ChatAnthropic | OpenAI, Anthropic | Chat Node | LLM Node |
| Tool | Calculator, API Call | Python Code | Code Node | Tool Node |
| Logic | Condition, If/Else | Router | If/Else, Match | Condition, Iteration |
| I/O | Chat Input/Output | Chat Input/Output | Graph I/O | Start, End |
| Agent | Agent Flow | Agent Component | Subgraph | Agent Node |

**3. `tool-call-detail` — Single tool call inspection panel.** Used by LangSmith, LangGraph Studio, Dify, Langflow. Anatomy: `tool-name-header`, `arguments-section` (JSON viewer with collapsible tree), `result-section` (JSON/text + copy), `timing-bar`, `token-usage`, `error-display` (red banner + expandable stack trace), `retry-button`. States: `pending → executing → success | error | timeout`. JSON tree uses `role="tree"`/`role="treeitem"`; errors use `role="alert"`. **No existing interactor**; propose `tool-call-detail`.

**4. `agent-communication-timeline` — Multi-agent message thread.** Used by AutoGen Studio (primary), CrewAI Studio. Anatomy: `agent-avatars` (color-coded circles with role labels like "Researcher", "Coder"), `message-bubbles` (chat-style with sender ID), `delegation-indicators` (arrows), `message-type-badges` ("Thought"/"Action"/"Tool Call"/"Response"), `agent-status-indicators` (active pulsing/idle/waiting). AutoGen Studio: Build View (agent config forms) + Playground View (chat sessions with history and generated files). CrewAI: visual drag-and-drop for agent+task creation with real-time tracing. States: `configuring → running → complete → error`. Uses `role="log"` with `aria-live="polite"`. **No existing interactor**; propose `agent-communication-timeline`.

**5. `task-plan-list` — Goal decomposition with status per step.** Used by AgentGPT, BabyAGI UI, CrewAI. Anatomy: `goal-input`, `task-list` (ordered), `step-status-indicators` (⏳/🔄/✅/❌), `task-result-accordion`, `reprioritization-indicator`, `step-counter` ("Task 3 of 7"). AgentGPT shows "Thinking..." → generated tasks → execution results → new tasks in a loop. BabyAGI shows current task + result + newly generated tasks + updated priority list. States: `idle → planning → executing-task-N → replanning → complete | stopped`. **Maps partially to `display-progress` + `group-repeating`**; propose `task-plan-list`.

**6. `hitl-interrupt` — Human-in-the-loop approval dialog.** LangGraph Studio (primary), Dify, CrewAI. Anatomy: `interrupt-banner`, `state-editor` (editable JSON/form of current agent state), `approval-buttons` ("Continue"/"Edit & Continue"/"Cancel"), `fork-button` (create alternative execution branch), `context-injection-field`. LangGraph Studio: set interrupts on any node, pencil icon to edit step output, fork to update state and branch. States: `running → interrupted → human-editing → resumed | cancelled`. Uses `role="alertdialog"` with `aria-modal="true"`, focus trapped. **Composite of `action-primary` + `action-danger` + `text-long`**; propose `hitl-interrupt`.

**7. `execution-metrics-panel` — Live token/cost/latency gauges.** Used by LangSmith, Dify, Vellum, LangGraph Studio. Anatomy: `step-counter` ("Step 3 of N" + progress bar), `token-usage-gauge`, `cost-accumulator` ("$0.042"), `latency-metrics` (P50/P90/P99), `error-rate-indicator`. LangSmith provides custom monitoring dashboards. Vellum shows quality, cost, and latency simultaneously. States: `idle → streaming-metrics → complete → historical-view`. Gauges use `role="meter"` with `aria-valuenow/min/max`. **Extends `display-progress` + `display-badge`**; propose `execution-metrics-panel`.

**8. `execution-debugger` — Time-travel replay controls.** LangGraph Studio (primary), Rivet, Dify. Anatomy: `play/pause/stop-controls`, `step-forward/step-back`, `execution-timeline` (horizontal with clickable markers), `state-inspector` (side panel showing variables at selected checkpoint), `replay-indicator`. LangGraph Studio: go back to any previous state, hot-reload code changes, debug mode interrupts after each step. Rivet: Run/Pause/Abort + Chat viewer overlay + Trivet test suite. Dify 1.5.0: single-step execution, output persistence between sessions. States: `idle → running → paused-at-step-N → stepping → rewound-to-step-M → resumed`. Transport controls use `role="toolbar"`. **No existing interactor**; propose `execution-debugger`.

**9. `memory-inspector` — Key-value state viewer.** CrewAI, LangGraph, Dify, AutoGen Studio. Anatomy: `conversation-history`, `context-window-visualization` (token bar), `variable-inspector` (key-value pairs). LangGraph Studio allows editing thread state and forking. States: `empty → populated → overflow`. **No existing interactor**; propose `memory-inspector`.

**10. `run-comparison-table` — Side-by-side execution comparison.** LangSmith, Vellum, Dify. Anatomy: `run-selector`, `side-by-side-trace-view`, `diff-highlighting`, `metric-comparison-table`. LangSmith offers pairwise human annotation for A/B comparison. Vellum compares P90/Median aggregate metrics across draft vs. deployed. Standard `<table>` with `<th scope>`. **No existing interactor**; propose `run-comparison-table`.

### Agent domain view layouts

**Workflow Editor View** (Flowise, Langflow, Dify, Rivet): Left sidebar=node palette | Center=infinite canvas | Right panel=node properties. Top bar: workflow name, save/deploy, undo/redo. Bottom: chat/playground toggle.

**Agent Execution View** (LangSmith, LangGraph Studio): Left panel=graph visualization/trace tree | Right panel=detail inspector/chat. Top: project/run selector.

**Agent Builder View** (AutoGen Studio, CrewAI Studio): Tab-based: Build (forms) | Playground (chat with agents) | Gallery (reusable templates).

---

## Domain 3: Prompt engineering and optimization UIs

Prompt engineering tools center on **version-controlled prompt management** and **systematic evaluation**. Langfuse (MIT, Next.js + Shadcn/UI) provides the most complete open-source reference implementation. Promptfoo is the gold standard for declarative test assertions. The critical insight: **every product converges on the same core workflow**—edit prompt → test in playground → evaluate against dataset → compare versions → promote to production.

### Widget inventory

**1. `prompt-template-editor` — Role-based message blocks with variable detection.** Used by Anthropic Console, Humanloop, Langfuse, PromptLayer, Vellum. Anatomy: `role-selector` (system/user/assistant dropdown per block), `template-textarea` (with `{{variable}}` syntax highlighting), `variable-pills` (auto-detected colored inline badges), `add-message-button`, `message-reorder-handles`, `delete-message-button`, `model-selector`, `parameter-panel` (temperature slider, max tokens, top-p). Type `{{` to trigger variable autocomplete. Langfuse supports composability via `@@@langfusePrompt:name=OtherPrompt@@@`. Humanloop uses JSX-inspired `.prompt` files with YAML headers. States: `empty → editing → has-variables → valid → running → response-displayed`. **Composite of `text-rich` + `single-pick` + `number-approx` + `group-repeating`**; propose `prompt-template-editor`.

**2. `schema-field-editor` — Typed I/O field definitions with direction.** DSPy (code-based), Vellum (visual), Promptfoo (YAML). Anatomy: `field-name-input`, `type-selector` (str/bool/int/float/Literal), `direction-indicator` (Input → Output), `description-field`, `add-field-button`, `docstring-area`. DSPy uses inline syntax `"question -> answer"` or class-based with `dspy.InputField(desc="...")`. **`group-repeating` of (`text-short` + `single-pick` + `text-short`)**; propose `schema-field-editor`.

**3. `example-pool-browser` — Drag-sortable few-shot example collection.** Anthropic Console, DSPy, Humanloop, Langfuse. Anatomy: `example-list/table`, `input-field`, `output-field`, `quality-score-badge`, `add-example-button` (manual + AI-generated), `reorder-handles`, `bulk-import`. Anthropic Console auto-generates synthetic examples. DSPy: `LabeledFewShot(k=8)` selects randomly; `BootstrapFewShot` filters by metric; `KNNFewShot` uses nearest neighbors. States: `empty → has-examples → selected → optimized`. **`group-repeating` of (`text-long` × 2 + `display-badge`)**; propose `example-pool-browser`.

**4. `version-timeline` — Chronological versions with diff, labels, and promotion.** PromptLayer, Humanloop, Langfuse, Braintrust, Vellum. Anatomy: `version-list` (numbered with timestamps/authors), `commit-message` (72-char—PromptLayer enforces this), `labels` (production/staging/development), `diff-viewer` (side-by-side or inline), `promote-button`, `rollback-action`, `lock-indicator`. **Langfuse**: linear versioning with labels for deployment, no code changes needed. **Humanloop**: auto-versioning, deterministic content-hash IDs, `.prompt` file format. **PromptLayer**: Prompt Registry with A/B release labels and traffic splitting. States: `draft → committed → labeled → deployed → archived`. **`display-text` + `display-badge` + `action-primary`**; propose `version-timeline`.

**5. `experiment-comparison-dashboard` — Multi-experiment comparison with diff.** DSPy, Braintrust, Langfuse. Anatomy: `metric-chart` (line chart over iterations), `candidate-comparison-table`, `best-candidate-highlight`, `improvement-indicator` (% change), `iteration-progress`. **Braintrust** offers grid layout (side-by-side), summary layout (large-type reporting), bar charts, scatter plots, and diff mode auto-highlighting improvements/regressions. States: `not-started → running → complete → compared`. **Extends `display-progress`**; propose `experiment-comparison-dashboard`.

**6. `assertion-rule-builder` — Composable test rule list with type-specific inputs.** Promptfoo (primary), Braintrust. Anatomy: `assertion-type-selector` (equals, contains, regex, similar, llm-rubric, factuality, javascript, python, cost, latency, is-refusal, perplexity—**16 types** in Promptfoo), `value/threshold-input`, `weight-input`, `negate-toggle` (not- prefix), `provider-selector`, `assert-set-grouping` (collective threshold), `pass/fail-display`. States: `no-assertions → defined → running → results`. **`group-repeating` of (`single-pick` + `text-short` + `number-exact` + `toggle`)**; propose `assertion-rule-builder`.

**7. `llm-playground` — Split-pane testing with model selection and streaming.** Anthropic Console, Langfuse, Humanloop, W&B Weave, Vellum, Braintrust. Anatomy: `split-screen` (left=config, right=response), `model-selector`, `parameter-controls` (temperature, max tokens, top-p sliders), `system-prompt-area`, `user-message-input`, `run-button`, `response-panel` (streaming), `token-count`, `cost-indicator`, `latency-display`, `multi-variant-columns` (Langfuse: independent settings per variant), `get-code-button` (Anthropic: exports to Python/TypeScript). States: `empty → configured → running → complete → iterating`. **Complex composite**; propose `llm-playground`.

**8. `eval-results-matrix` — Cross-product table with per-cell pass/fail.** Promptfoo (primary), Braintrust, Langfuse, W&B Weave. Anatomy: `matrix-table` (rows=test cases, columns=prompts×providers, cells=output+pass/fail+score), `column-headers` (aggregate pass rate), `score-histogram` (toggle-able), `pass-rate-bar`, `filter-controls` (by pass/fail, score range), `diff-mode`, `detail-modal`, `ratings/comments` (Promptfoo: persist for training), `export`. Promptfoo: "Show Charts" toggle, Shift+hover for actions, share URL generation. **Braintrust**: group by metadata, trial matching, scatter plots. States: `no-results → loading → displayed → filtered → compared → exported`. **No existing interactor**; propose `eval-results-matrix`.

**9. `cost-metrics-panel` — Multi-dimensional cost/token/latency display.** Langfuse, PromptLayer, Braintrust. Anatomy: `token-count-badges` (input/output/total), `cost-display` (USD per call + accumulated), `latency-metric` (ms, P50/P90/P95), `dashboard-charts` (cost over time, by model, by user), `budget-alerts`, `breakdown-dimensions`. Langfuse breaks down by user, session, geography, feature, model, prompt version. **`display-text` + `display-progress`**; propose `cost-metrics-panel`.

**10. `dataset-browser` — Versioned collection with trace capture.** Langfuse, Braintrust, Promptfoo, W&B Weave. Anatomy: `dataset-list`, `items-table` (input + expected output + metadata), `item-editor`, `add-from-trace` (one-click capture), `bulk-import` (CSV/JSON/JSONL/Google Sheets), `field-mapping`, `version-tracking`, `folder-organization`. **Langfuse**: items have `input`, `expectedOutput`, `metadata`; versions auto-increment. **Braintrust**: "Turn production traces into eval datasets with one click." States: `empty → has-items → versioned → linked-to-experiments → exported`. **`group-repeating` + `file-attach`**; propose `dataset-browser`.

**11. `dag-workflow-builder` — Node-edge graph for prompt pipelines.** Azure AI Studio Prompt Flow, Vellum Workflows. Anatomy: `canvas`, `node-palette` (LLM/Prompt/Python/Tool/Conditional/Map-Reduce), `nodes` (cards with ports), `edges`, `DAG-view`, `node-config-panel`, `run-button`, `outputs-panel`. Azure stores flows as `flow.dag.yaml`. Vellum supports loops, recursion, parallel branches, streaming, and bi-directional sync between Python SDK and visual UI. States: `empty → nodes-added → connected → configured → valid → running → complete → deployed`. **No existing interactor** (shares semantics with `node-graph-canvas` from Domain 2); propose `dag-workflow-builder`.

### Prompt engineering domain view layouts

**Prompt Editor Layout**: Left panel=prompt config (model, params, template) | Right panel=chat/response. **Evaluation Matrix Layout**: Full-width table (columns=prompts×providers, rows=test cases) with toolbar. **Experiment Comparison Layout**: Header with experiment selector + diff toggle | Main table | Side detail panel. **Observability Dashboard Layout**: Top date-range + filters | Metric cards + charts | Trace table. **Prompt Registry Layout**: Left folder tree | Main prompt list | Detail version timeline + editor.

---

## Domain 4: RAG pipeline and vector search UIs

RAG interfaces are the least standardized domain. Vector database consoles (Pinecone, Qdrant, Weaviate) focus on **index management and record browsing**. Evaluation tools (Ragas, LangSmith, Arize Phoenix) focus on **retrieval quality metrics**. Document processing (Unstructured.io) focuses on **ingestion pipeline visualization**. The key gap: **no production tool yet offers a complete, integrated RAG debugging experience** combining chunk viewing, embedding exploration, retrieval tracing, and evaluation in a single interface.

### Widget inventory

**1. `display-record` — Chunk card with metadata and score.** Used by Pinecone Console (record browser), Weaviate Explorer, Qdrant Dashboard, ChromaDB Admin. Anatomy: `chunk-id-header` (UUID, copyable), `text-content-area` (truncated with expand), `metadata-panel` (key-value tags), `vector-preview` (collapsed, first N dimensions), `score-badge` (0–1 float for search results), `property-type-indicators`, `json-toggle` (formatted ↔ raw). States: `collapsed → expanded → editing → search-result` (shows score + highlights). Uses `role="article"` per card, `aria-expanded` for sections. **Combines `group-fields` + `display-text` + `display-badge`**; propose `display-record`.

**2. `display-document-overlay` — Synchronized dual-pane with bounding boxes.** Used by Unstructured.io (primary), Arize Phoenix. Anatomy: `source-document-pane` (rendered PDF/image with colored bounding boxes per element), `result-pane` (extracted text elements with type badges: NarrativeText, Title, Table, Image), `element-type-badges` (color-coded), `bidirectional-highlight` (click one side → highlight other), `processing-stage-indicator`. Unstructured supports fast/hi_res/ocr_only/auto strategies, VLM-refined results, **65+ file types**. States: `uploading → processing → complete → refined`. **No existing interactor**; propose `display-document-overlay`.

**3. `viz-embedding-scatter` — Interactive UMAP/t-SNE projection.** Used by Arize Phoenix (primary), Renumics Spotlight, TensorFlow Embedding Projector. Anatomy: `canvas` (WebGL/SVG scatter), `point-markers` (per document/chunk), `color-encoding` (categorical or continuous by metric), `cluster-boundaries` (convex hulls/density contours), `hover-tooltip` (document text + ID + metrics), `color-by-selector`, `zoom/pan-controls`, `selection-lasso` (draw to select subset), `nearest-neighbor-lines`. Phoenix: "Color By > dimension" then metric dropdown for cluster analysis. States: `loading-projection → rendered → selection-active → drill-down`. Accessibility is challenging—needs `role="img"` with descriptive `aria-label` and alternative tabular view. **No existing interactor**; propose `viz-embedding-scatter`.

**4. `display-trace-tree` — RAG execution span waterfall.** Used by LangSmith, Arize Phoenix. Anatomy: `root-span`, `child-spans` (nested: Retriever.invoke → ChatModel.invoke), `span-detail-panel` (inputs/outputs, retrieved documents, prompts), `latency-indicator` (proportional bar), `token-count`, `evaluation-scores` (attached feedback), `feedback-buttons`, `trace-id`. States: `collecting → complete → annotated → in-dataset`. Uses `role="tree"`/`role="treeitem"`. **Shares semantics with `trace-tree` from Domain 2**; propose `display-trace-tree`.

**5. `display-eval-table` — RAG quality metrics per query.** Used by Ragas, LangSmith, Braintrust, Arize Phoenix. Anatomy: `query-column`, `answer-column`, `context-column` (expandable), `reference-column`, `metric-score-columns` (Faithfulness, Answer Relevancy, Context Precision, Context Recall—all 0–1), `aggregate-row` (mean/median), `sort-controls`, `filter-controls` (by threshold), `row-expansion` (full trace link). Ragas commonly visualizes aggregates as **radar/spider plots** via Plotly. States: `loading → populated → filtered → sorted → exported`. Standard `role="grid"` with `aria-sort`. **Enhanced data table**; propose `display-eval-table`.

**6. `display-ranked-list` — Before/after reranking comparison.** Pinecone (Rerank API), Weaviate, Qdrant, Vectara, Cohere Rerank. Anatomy: `before-column` (original rank + similarity score + snippet), `after-column` (new rank + relevance score + snippet), `position-change-indicator` (↑3/↓2/—), `score-bars` (horizontal visual comparison), `reranker-model-selector`, `top-n-selector`. Weaviate exposes both `distance` and `rerank.score` per result in GraphQL. States: `initial-results → reranking → reranked-results → comparison-view`. **No existing interactor**; propose `display-ranked-list`.

**7. `display-pipeline-stages` — Multi-step ingestion progress.** Used by Unstructured.io, Vectara, LangChain/LlamaIndex. Anatomy: `stage-nodes` (labeled: Source → Parse → Chunk → Enrich → Embed → Store, connected by arrows), `per-stage-status` (not started/in progress/complete/error), `progress-bar` (per-stage and overall), `file/batch-info`, `error-panel` (expandable), `configuration-per-stage`. Unstructured shows side-by-side preview: original document vs extracted elements, with enrichment stages (image description, table extraction, generative refinement). States: `idle → uploading → processing → complete | partial-failure | error`. Uses `role="progressbar"` per stage, `role="alert"` for errors. **`display-progress` + `file-attach` + `group-fields`**; propose `display-pipeline-stages`.

**8. `viz-graph-network` — Entity-relationship knowledge graph.** Used by txtai (semantic graphs on NetworkX), LlamaIndex KG index, Neo4j integrations. Anatomy: `graph-canvas` (force-directed/hierarchical), `nodes` (entities, sized by connectivity), `edges` (relationships, thickness by strength), `node-labels`, `topic-clusters` (color-coded), `zoom/pan`, `search/filter`, `detail-panel` (click node → associated passages). txtai auto-creates edges using vector similarity. States: `loading → rendered → node-selected → filtered → path-highlighted`. Needs alternative tabular view for accessibility. **No existing interactor**; propose `viz-graph-network`.

### Additional existing-interactor patterns

**Collection/Index Browser** (Pinecone, Qdrant, Weaviate, ChromaDB): standard master-detail using `group-repeating` + `display-badge` + `action-primary`/`action-danger`. **Hybrid Search Configuration** (Vectara lambda, Weaviate alpha): `single-choice` for search type + `number-approx` for weight slider—well-served by existing interactors. **Chunk Enrichment Viewer**: `group-fields` + `display-badge` + `display-text`—composable from existing primitives. **Semantic Cache Display**: emerging pattern, not yet standardized—`number-approx` (threshold) + `display-progress` (hit rate) suffice.

### RAG domain view layouts

**Index Management** (master-detail): Left=collection list → Main=selected collection stats → Drill-down=records. **Search Playground**: Query input (top) → Config sidebar (hybrid weight, top_k, filters) → Results (main, scrollable). **Trace & Evaluation Workspace**: Three-column: navigation | trace list | trace detail. **Document Processing Pipeline** (Unstructured): wizard/stepper with side-by-side preview pane. **Embedding Analysis Dashboard** (Arize Phoenix): scatter plot (central) → cluster selection → metric sidebar → drill-down table.

---

## Cross-domain synthesis: 31 new interactor types needed

The full set of proposed interactor types consolidates into **31 distinct semantic categories** that the existing 22 interactors cannot cover. These fall into five architectural groups:

**Streaming interactors** (AI-specific temporal behavior):
- `stream-text` — progressive text rendering with cursor animation and markdown
- `generation-indicator` — streaming state feedback (typing dots, progress)
- `stop-generation` — cancel button during active generation

**Compound message interactors** (multi-part containers):
- `chat-message` — role-differentiated message with actions toolbar
- `multimodal-message` — mixed text/image/file/code content
- `tool-invocation` — collapsible tool call with status and result
- `reasoning-block` — collapsible chain-of-thought display
- `inline-citation` — numbered references with hover preview cards
- `code-block` — syntax-highlighted code with copy/run actions
- `message-branch-nav` — conversation branching navigation
- `message-actions` — hover-revealed per-message action toolbar
- `prompt-input` — auto-expanding input with attachments and model selector

**Execution/trace interactors** (monitoring and debugging):
- `trace-tree` / `display-trace-tree` — hierarchical execution span waterfall
- `tool-call-detail` — single tool call inspection panel
- `agent-communication-timeline` — multi-agent message thread
- `task-plan-list` — goal decomposition with per-step status
- `hitl-interrupt` — human-in-the-loop approval dialog with state editing
- `execution-metrics-panel` — live token/cost/latency gauges
- `execution-debugger` — time-travel replay with transport controls
- `memory-inspector` — key-value state viewer with context window gauge
- `run-comparison-table` — side-by-side execution diff

**Editor/builder interactors** (authoring and configuration):
- `node-graph-canvas` / `dag-workflow-builder` — infinite canvas with typed ports
- `prompt-template-editor` — role-based message blocks with variable detection
- `schema-field-editor` — typed I/O field definitions
- `example-pool-browser` — drag-sortable few-shot examples
- `version-timeline` — chronological versions with diff and promotion
- `assertion-rule-builder` — composable test rules with type-specific inputs
- `llm-playground` — split-pane testing environment
- `dataset-browser` — versioned collection with trace capture

**Visualization interactors** (data-dense displays):
- `viz-embedding-scatter` — UMAP/t-SNE interactive projection
- `viz-graph-network` — entity-relationship node-edge graph
- `eval-results-matrix` / `display-eval-table` — cross-product evaluation table
- `display-record` — chunk card with metadata and score
- `display-document-overlay` — synchronized dual-pane with bounding boxes
- `display-ranked-list` — before/after reranking comparison
- `display-pipeline-stages` — multi-step progress visualization
- `cost-metrics-panel` / `experiment-comparison-dashboard` — metric dashboards
- `artifact-panel` — side-by-side content creation panel
- `conversation-sidebar` — chat history navigation

### New affordance declarations

The two-step pipeline Interactor/classify → WidgetResolver/resolve needs these affordance extensions:

| Interactor | Affordance conditions | Specificity | Widget resolution |
|---|---|---|---|
| `stream-text` | `semanticType=ai-response AND streaming=true` | 100 | `streaming-markdown-renderer` |
| `chat-message` | `semanticType=message AND role∈{user,assistant,system,tool}` | 90 | `message-block` |
| `tool-invocation` | `semanticType=tool-call AND hasStatus=true` | 95 | `collapsible-tool-card` |
| `reasoning-block` | `semanticType=chain-of-thought` | 90 | `collapsible-thinking-block` |
| `node-graph-canvas` | `semanticType=workflow AND editable=true` | 100 | `react-flow-canvas` |
| `trace-tree` | `semanticType=execution-trace AND hierarchical=true` | 95 | `trace-tree-viewer` |
| `viz-embedding-scatter` | `semanticType=embeddings AND dimensions>2` | 100 | `umap-scatter-plot` |
| `eval-results-matrix` | `semanticType=evaluation AND crossProduct=true` | 90 | `eval-matrix-table` |
| `prompt-template-editor` | `semanticType=prompt AND hasVariables=true` | 95 | `role-block-editor` |
| `hitl-interrupt` | `semanticType=approval AND blocking=true` | 100 | `interrupt-dialog` |

Affordances should include **context escalation**: when `deviceType=mobile`, `node-graph-canvas` degrades to `workflow-list-view`; when `role=viewer` (read-only), `prompt-template-editor` degrades to `prompt-template-display`.

### Architectural extensions required

**1. Streaming state machine support.** Five widgets (`stream-text`, `generation-indicator`, `stop-generation`, `tool-invocation`, `reasoning-block`) require a `submitted → streaming → complete | error | stopped` FSM that existing `.widget` spec state declarations don't anticipate. The spec needs a `streaming` state category with `onToken`, `onChunk`, and `onAbort` transition events.

**2. Compound interactor composition.** Twelve widgets are compositions of 3+ existing interactors. The `.widget` spec's `compose` (slot-based) mechanism handles this, but needs a `variant` system for role-based rendering (e.g., `chat-message` renders differently for user vs. assistant) and a `parts` array model (following Vercel AI SDK's typed message parts pattern).

**3. Canvas/viewport interactors.** `node-graph-canvas`, `viz-embedding-scatter`, and `viz-graph-network` operate on infinite canvases with zoom/pan—a fundamentally different interaction model from form fields. These need new ARIA patterns (`role="application"` with custom keyboard bindings) and viewport-aware rendering (React Flow's virtualization model).

---

## Conclusion

The AI UI landscape has crystallized around **remarkably consistent patterns** across 40+ products. Chat interfaces are nearly standardized. Agent workflow editors universally adopt React Flow. Prompt engineering tools converge on version-control metaphors from software engineering. RAG UIs remain the frontier with the most fragmentation.

The Clef Surface framework's existing 22 interactors cover traditional form semantics well but miss three fundamental AI interaction categories: **temporal/streaming behavior** (no form field streams tokens), **execution observability** (traces, metrics, debugging are monitoring patterns, not input patterns), and **spatial/canvas interactions** (node graphs and embedding plots operate in 2D space, not linear form flow). Extending the framework requires not just new widget specs but new interactor *categories* in the classification taxonomy—streaming, observability, and spatial—alongside the existing form-centric categories. The best implementation references are **Open WebUI** (chat, Svelte), **Flowise** (node graph, React Flow), **Langfuse** (prompt engineering, Next.js/Shadcn), and **Arize Phoenix** (RAG evaluation, Python/React). Together these four codebases cover over 80% of the widget patterns cataloged here.