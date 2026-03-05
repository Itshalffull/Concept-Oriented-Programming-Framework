# UI Library Reference

> Auto-generated from `repertoire/` by UILibraryTarget

## Table of Contents

- [Themes](#themes)
- [formal-verification](#formal-verification) — 8 widgets
- [governance-decision](#governance-decision) — 3 widgets
- [governance-execution](#governance-execution) — 3 widgets
- [governance-structure](#governance-structure) — 3 widgets
- [llm-agent](#llm-agent) — 7 widgets
- [llm-conversation](#llm-conversation) — 7 widgets
- [llm-core](#llm-core) — 1 widgets
- [llm-prompt](#llm-prompt) — 1 widgets
- [llm-safety](#llm-safety) — 3 widgets
- [package](#package) — 3 widgets
- [process-automation](#process-automation) — 1 widgets
- [process-foundation](#process-foundation) — 3 widgets
- [process-human](#process-human) — 2 widgets
- [process-llm](#process-llm) — 2 widgets
- [Affordance Index](#affordance-index)
- [Accessibility Summary](#accessibility-summary)

## Themes

### for _(base)_


### light _(base)_


### with _(base)_


## Widgets by Suite

### formal-verification

#### coverage-source-view

> Source code overlay showing formal verification coverage data. Each line has a coverage gutter indicator (covered, uncovered, partial) and hovering reveals the property or contract that covers that line. Supports filtering by coverage status and jumping to uncovered regions.

**Anatomy**: root:          container → lineNumbers:   container → coverageGutter: container → sourceText:    container → hoverTooltip:  container → filterBar:     container → summary:       container

**States**:
- `idle` _(initial)_: HOVER_LINE → lineHovered, FILTER → idle, JUMP_UNCOVERED → idle
- `lineHovered`: LEAVE → idle

**Accessibility**:
- Role: `document`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - sourceText: target_symbol
  - coverageData: dependencies

**Props**:
- `language: String`
- `showLineNumbers: Bool`
- `filterStatus: option`

#### dag-viewer

> Directed acyclic graph viewer for dependency relationships between formal properties, contracts, and composition chains. Renders nodes with status badges and labels connected by directed edges. Supports zoom, pan, layout computation, and node selection for detail inspection.

**Anatomy**: root:        container → canvas:      container → node:        container → nodeLabel:   text → nodeBadge:   container → edge:        container → edgeLabel:   text → controls:    container → detailPanel: container

**States**:
- `idle` _(initial)_: SELECT_NODE → nodeSelected, ZOOM → idle, PAN → idle, LAYOUT → computing
- `nodeSelected`: DESELECT → idle, SELECT_NODE → nodeSelected
- `computing`: LAYOUT_COMPLETE → idle

**Accessibility**:
- Role: `application`
- Focus: roving

**Affordance**:
- Serves: `entity-graph`
- Specificity: 20
- Binds:
  - nodes: dependencies
  - edges: dependencies

**Props**:
- `layout: union`
- `zoom: Float`
- `panX: Float`
- `panY: Float`
- `selectedNodeId: option`

#### formula-display

> Read-only renderer for formal logic expressions with syntax highlighting and semantic coloring. Supports multiple formal languages (SMT-LIB, TLA+, Alloy, Lean, Dafny, CVL) and optional LaTeX rendering for mathematical notation. Used in detail and card views for FormalProperty concepts.

**Anatomy**: root:       container → codeBlock:  container → langBadge:  container → scopeBadge: container → copyButton: action

**States**:
- `idle` _(initial)_: COPY → copied, RENDER_LATEX → rendering
- `copied`: TIMEOUT → idle
- `rendering`: RENDER_COMPLETE → idle

**Accessibility**:
- Role: `figure`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - formula: property_text
  - language: formal_language
  - scope: scope

**Props**:
- `formula: String`
- `language: union`
- `scope: option`
- `renderLatex: Bool`

#### proof-session-tree

> Hierarchical tree view displaying proof obligations organized by verification session. Each tree node shows a verification status badge, property label, and progress indicator. Supports expand/collapse, keyboard navigation, and selection to drill into individual proof details.

**Anatomy**: root:           container → treeItem:       container → expandTrigger:  action → statusBadge:    widget → itemLabel:      text → progressBar:    widget → children:       container

**States**:
- `tree`: SELECT → selected, EXPAND → idle, COLLAPSE → idle, DESELECT → idle, SELECT → selected
- `idle` _(initial)_: SELECT → selected, EXPAND → idle, COLLAPSE → idle
- `selected`: DESELECT → idle, SELECT → selected
- `ready` _(initial)_: LOAD_CHILDREN → fetching
- `fetching`: LOAD_COMPLETE → ready, LOAD_ERROR → ready

**Accessibility**:
- Role: `tree`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - items: results
  - itemLabel: target_symbol
  - itemStatus: status

**Props**:
- `items: list`
- `selectedId: option`
- `expandedIds: list`

#### status-grid

> Matrix grid displaying verification status across multiple dimensions. Row headers represent properties or contracts, column headers represent solvers or targets, and cells show status indicators with optional numeric values. Supports cell hover for detail, row/column aggregation, and filtering.

**Anatomy**: root:          container → columnHeaders: container → columnHeader:  container → rowHeaders:    container → rowHeader:     container → grid:          container → cell:          container → cellTooltip:   container → aggregateRow:  container → aggregateCol:  container

**States**:
- `idle` _(initial)_: HOVER_CELL → cellHovered, CLICK_CELL → cellSelected, SORT → idle, FILTER → idle
- `cellHovered`: LEAVE_CELL → idle, CLICK_CELL → cellSelected
- `cellSelected`: DESELECT → idle, CLICK_CELL → cellSelected

**Accessibility**:
- Role: `grid`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - rows: supported_kinds
  - columns: supported_languages
  - cells: capabilities

**Props**:
- `showAggregates: Bool`
- `sortBy: option`
- `filterStatus: option`

#### trace-step-controls

> Playback control toolbar for navigating verification trace steps. Provides step-forward, step-backward, play/pause, jump-to-start, jump-to-end buttons, a step counter display, and playback speed control. Used alongside trace-timeline-viewer for counterexample exploration.

**Anatomy**: root:          container → jumpStart:     action → stepBack:      action → playPause:     action → stepFwd:       action → jumpEnd:       action → stepCounter:   text → speedControl:  widget

**States**:
- `paused` _(initial)_: PLAY → playing, STEP_FWD → paused, STEP_BACK → paused, JUMP_START → paused, JUMP_END → paused
- `playing`: PAUSE → paused, REACH_END → paused

**Accessibility**:
- Role: `toolbar`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - currentStep: confidence_score
  - totalSteps: solver_metadata

**Props**:
- `speed: Float`
- `showSpeed: Bool`

#### trace-timeline-viewer

> Horizontal timeline visualization of verification trace data showing variable states across discrete time steps. Each variable occupies a lane with cells showing values and change highlighting. Includes a step cursor for navigation, zoom/pan controls, and playback mode for stepping through counterexample traces.

**Anatomy**: root:        container → timeAxis:    container → lanes:       container → lane:        container → laneLabel:   text → cell:        container → stepCursor:  container → controls:    container → zoomControl: container

**States**:
- `idle` _(initial)_: PLAY → playing, STEP_FORWARD → idle, STEP_BACKWARD → idle, SELECT_CELL → cellSelected, ZOOM → idle
- `playing`: PAUSE → idle, STEP_END → idle
- `cellSelected`: DESELECT → idle, SELECT_CELL → cellSelected

**Accessibility**:
- Role: `grid`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - steps: solver_metadata
  - variables: content_path
  - currentStep: confidence_score

**Props**:
- `playbackSpeed: Float`
- `showChangesOnly: Bool`
- `zoom: Float`

#### verification-status-badge

> Compact status indicator for formal verification outcomes. Renders an icon and label reflecting the verification status of a property or run (proved, refuted, unknown, timeout, running). Includes an optional tooltip with timing and solver details.

**Anatomy**: root:    container → icon:    container → label:   text → tooltip: container

**States**:
- `idle` _(initial)_: HOVER → hovered, STATUS_CHANGE → animating
- `hovered`: LEAVE → idle
- `animating`: ANIMATION_END → idle

**Accessibility**:
- Role: `status`

**Affordance**:
- Serves: `entity-inline`
- Specificity: 20
- Binds:
  - status: status
  - label: kind

**Props**:
- `status: union`
- `label: String`
- `duration: option`
- `solver: option`
- `size: union`

### governance-decision

#### deliberation-thread

> Threaded discussion view for governance deliberation. Shows a chronological list of contributions with author, timestamp, and content. Supports inline replies (threading), argument tagging (for/against/question/amendment), and sentiment summary.

**Anatomy**: root:          container → header:        container → entryList:     container → entry:         container → entryAvatar:   container → entryAuthor:   text → entryContent:  container → entryTag:      container → entryTimestamp: text → replyButton:   action → replies:       container → sentimentBar:  container → composeBox:    widget

**States**:
- `viewing` _(initial)_: REPLY_TO → composing, SELECT_ENTRY → entrySelected
- `composing`: SEND → viewing, CANCEL → viewing
- `entrySelected`: DESELECT → viewing

**Accessibility**:
- Role: `feed`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - status: status

**Props**:
- `showSentiment: Bool`
- `showTags: Bool`
- `maxNesting: Int`

#### proposal-card

> Compact navigation card summarizing a governance proposal. Displays the proposal status badge, title, description excerpt, proposer identity, vote result bar (if voting is active), quorum gauge (if applicable), time remaining, and primary action button. Supports full, compact, and minimal layout variants.

**Anatomy**: root:          container → statusBadge:   container → title:         text → description:   text → proposer:      container → voteBar:       widget → quorumGauge:   widget → timeRemaining: text → action:        action

**States**:
- `idle` _(initial)_: HOVER → hovered, FOCUS → focused, CLICK → navigating
- `hovered`: UNHOVER → idle
- `focused`: BLUR → idle, CLICK → navigating, ENTER → navigating
- `navigating`: NAVIGATE_COMPLETE → idle

**Accessibility**:
- Role: `article`

**Affordance**:
- Serves: `entity-card`
- Specificity: 20
- Binds:
  - title: title
  - description: description
  - author: proposer
  - status: status
  - timestamp: createdAt

**Props**:
- `variant: union`
- `showVoteBar: Bool`
- `showQuorum: Bool`
- `truncateDescription: Int`

#### vote-result-bar

> Horizontal segmented bar visualizing vote distribution across choices. Each segment is proportionally sized and color-coded by choice, with labels showing count and percentage. Supports binary (for/against), multi-choice, and weighted voting displays. Optional quorum marker line indicates the participation threshold.

**Anatomy**: root:          container → bar:           container → segment:       container → segmentLabel:  text → quorumMarker:  container → totalLabel:    text

**States**:
- `idle` _(initial)_: HOVER_SEGMENT → segmentHovered, ANIMATE_IN → animating
- `animating`: ANIMATION_END → idle
- `segmentHovered`: UNHOVER → idle

**Accessibility**:
- Role: `img`

**Affordance**:
- Serves: `entity-inline`
- Specificity: 18
- Binds:
  - segments: votes
  - total: votes.length

**Props**:
- `variant: union`
- `showLabels: Bool`
- `showQuorum: Bool`
- `quorumThreshold: Float`
- `animate: Bool`
- `size: union`

### governance-execution

#### execution-pipeline

> Horizontal pipeline visualization showing the execution lifecycle stages: Proposal Passed -> Timelock Queued -> Guards Checked -> Execution Ready -> Executed/Failed. Each stage shows status, timing, and relevant metadata. Active stage pulses, completed stages show checkmarks, and failed stages show error details.

**Anatomy**: root:          container → pipeline:      container → stage:         container → stageIcon:     container → stageLabel:    text → stageDetail:   text → connector:     container → timelockTimer: widget → actionBar:     container

**States**:
- `idle` _(initial)_: ADVANCE → idle, SELECT_STAGE → stageSelected, FAIL → failed
- `stageSelected`: DESELECT → idle
- `failed`: RETRY → idle, RESET → idle

**Accessibility**:
- Role: `list`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 22
- Binds:
  - currentStage: status
  - status: status

**Props**:
- `showTimer: Bool`
- `showActions: Bool`
- `compact: Bool`

#### guard-status-panel

> Panel displaying all active guards for an execution with their current status (active, tripped, bypassed), condition description, and trip history. Guards that would block execution are highlighted with warning styling.

**Anatomy**: root:         container → header:       container → guardList:    container → guardItem:    container → guardIcon:    container → guardName:    text → guardCondition: text → guardStatus:  container → blockingBanner: container

**States**:
- `idle` _(initial)_: SELECT_GUARD → guardSelected, GUARD_TRIP → idle
- `guardSelected`: DESELECT → idle

**Accessibility**:
- Role: `region`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - executionStatus: status

**Props**:
- `showConditions: Bool`

#### timelock-countdown

> Countdown timer for governance timelock periods. Shows the current phase label, remaining time in days/hours/minutes/seconds, a progress bar indicating elapsed time, and action buttons that activate when the timelock expires. Supports challenge actions during the delay period and visual urgency escalation as deadline approaches.

**Anatomy**: root:            container → phaseLabel:      text → countdownText:   text → targetDate:      text → progressBar:     container → executeButton:   action → challengeButton: action

**States**:
- `running` _(initial)_: TICK → running, WARNING_THRESHOLD → warning, EXPIRE → expired, PAUSE → paused
- `warning`: TICK → warning, CRITICAL_THRESHOLD → critical, EXPIRE → expired
- `critical`: TICK → critical, EXPIRE → expired
- `expired`: EXECUTE → executing, RESET → running
- `executing`: EXECUTE_COMPLETE → completed, EXECUTE_ERROR → expired
- `completed`
- `paused`: RESUME → running

**Accessibility**:
- Role: `timer`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - phase: status
  - deadline: executedAt

**Props**:
- `showChallenge: Bool`
- `warningThreshold: Float`
- `criticalThreshold: Float`
- `variant: union`

### governance-structure

#### circle-org-chart

> Hierarchical organization chart showing governance circles as nested containers with member avatars, policy badges, and jurisdiction labels. Supports expand/collapse of circles, member detail on hover, and jurisdiction boundary highlighting. Used for visualizing sociocratic and holacratic governance structures.

**Anatomy**: root:           container → circleNode:     container → circleLabel:    text → memberAvatars:  container → policyBadges:   container → jurisdictionTag: text → children:       container → detailPanel:    container

**States**:
- `idle` _(initial)_: SELECT_CIRCLE → circleSelected, EXPAND → idle, COLLAPSE → idle
- `circleSelected`: DESELECT → idle, SELECT_CIRCLE → circleSelected

**Accessibility**:
- Role: `tree`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - circles: circles

**Props**:
- `layout: union`
- `showPolicies: Bool`
- `showJurisdiction: Bool`
- `maxAvatars: Int`

#### delegation-graph

> Interactive visualization of delegation relationships and voting power flow within a governance domain. Displays delegates as a searchable list with avatars, names, voting power, participation rates, and statements. Supports list and network-graph view modes, delegation actions, and power flow visualization.

**Anatomy**: root:           container → searchInput:    widget → sortControl:    widget → viewToggle:     widget → delegateList:   container → delegateItem:   container → avatar:         container → delegateName:   text → votingPower:    text → participation:  text → delegateAction: action → currentInfo:    container → graphView:      container

**States**:
- `browsing` _(initial)_: SEARCH → searching, SELECT_DELEGATE → selected, SWITCH_VIEW → browsing
- `searching`: CLEAR_SEARCH → browsing, SELECT_DELEGATE → selected
- `selected`: DESELECT → browsing, DELEGATE → delegating, UNDELEGATE → undelegating
- `delegating`: DELEGATE_COMPLETE → browsing, DELEGATE_ERROR → selected
- `undelegating`: UNDELEGATE_COMPLETE → browsing, UNDELEGATE_ERROR → selected

**Accessibility**:
- Role: `region`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - delegator: delegator
  - delegatee: delegatee
  - weight: graph.effectiveWeight
  - transitive: transitive

**Props**:
- `viewMode: union`
- `sortBy: union`
- `showCurrentDelegation: Bool`

#### weight-breakdown

> Stacked bar or donut chart showing the composition of a participant's voting weight by source (token balance, reputation, stake, delegation, quadratic). Each segment is color-coded by source type with hover detail showing exact values.

**Anatomy**: root:          container → chart:         container → segment:       container → legend:        container → legendItem:    container → totalDisplay:  text → tooltip:       container

**States**:
- `idle` _(initial)_: HOVER_SEGMENT → segmentHovered
- `segmentHovered`: LEAVE → idle

**Accessibility**:
- Role: `img`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - totalWeight: effective_value
  - participant: participant

**Props**:
- `variant: union`
- `showLegend: Bool`
- `showTotal: Bool`

### llm-agent

#### agent-timeline

> Multi-agent communication timeline displaying messages between agents with delegation indicators, message type badges (request, response, observation, action), and threading. Each message shows the agent name, role, timestamp, and content with tool call details when applicable.

**Anatomy**: root:          container → header:        container → timeline:      container → entry:         container → agentBadge:    container → typeBadge:     container → content:       container → timestamp:     text → delegation:    container → interruptButton: action

**States**:
- `idle` _(initial)_: NEW_ENTRY → idle, SELECT_ENTRY → entrySelected, INTERRUPT → interrupted
- `entrySelected`: DESELECT → idle, SELECT_ENTRY → entrySelected
- `interrupted`: RESUME → idle
- `inactive` _(initial)_: STREAM_START → active
- `active`: STREAM_END → inactive

**Accessibility**:
- Role: `log`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - agentName: goal
  - status: status
  - entries: available_tools

**Props**:
- `showDelegations: Bool`
- `autoScroll: Bool`
- `maxEntries: Int`

#### hitl-interrupt

> Human-in-the-loop interrupt banner for agent execution. Displays the interrupt reason, current state editor (JSON or form), approval buttons (approve, reject, modify), fork option, and context injection input. Appears when a tool requires human approval or when the agent requests guidance.

**Anatomy**: root:           container → header:         container → reasonText:     text → stateEditor:    container → contextInput:   widget → actionBar:      container → approveButton:  action → rejectButton:   action → modifyButton:   action → forkButton:     action

**States**:
- `pending` _(initial)_: APPROVE → approving, REJECT → rejecting, MODIFY → editing, FORK → forking
- `editing`: SAVE → pending, CANCEL → pending
- `approving`: COMPLETE → resolved, ERROR → pending
- `rejecting`: COMPLETE → resolved
- `forking`: COMPLETE → resolved
- `resolved`

**Accessibility**:
- Role: `alertdialog`
- Focus: trapped

**Affordance**:
- Serves: `entity-editor`
- Specificity: 22
- Binds:
  - status: status
  - reason: goal

**Props**:
- `showFork: Bool`
- `showStateEditor: Bool`
- `editorMode: union`

#### memory-inspector

> Inspector panel for viewing and managing agent memory state. Displays working memory as a key-value list, episodic memories as a timeline, and semantic memories as searchable entries. Includes a context window visualization showing token allocation.

**Anatomy**: root:          container → tabs:          widget → workingView:   container → entryItem:     container → entryLabel:    text → entryContent:  text → entryMeta:     text → searchBar:     widget → contextBar:    container → deleteButton:  action

**States**:
- `viewing` _(initial)_: SWITCH_TAB → viewing, SEARCH → searching, SELECT_ENTRY → entrySelected
- `searching`: CLEAR → viewing, SELECT_ENTRY → entrySelected
- `entrySelected`: DESELECT → viewing, DELETE → deleting
- `deleting`: CONFIRM → viewing, CANCEL → entrySelected

**Accessibility**:
- Role: `region`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - memoryType: memory_type
  - entries: content
  - workingMemory: working_memory

**Props**:
- `activeTab: union`
- `showContext: Bool`

#### reasoning-block

> Collapsible display for LLM chain-of-thought or reasoning content (thinking tags). Shows a summary header when collapsed and the full reasoning text when expanded. Supports streaming mode where content appears token-by-token. Visually distinguished from regular message content with a muted style.

**Anatomy**: root:       container → header:     container → headerIcon: container → headerText: text → body:       container → duration:   text

**States**:
- `collapsed` _(initial)_: EXPAND → expanded, STREAM_START → streaming
- `expanded`: COLLAPSE → collapsed
- `streaming`: TOKEN → streaming, STREAM_END → collapsed

**Accessibility**:
- Role: `group`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - content: goal
  - collapsed: status

**Props**:
- `defaultExpanded: Bool`
- `showDuration: Bool`
- `streaming: Bool`

#### task-plan-list

> Goal decomposition display showing a hierarchical task list with status indicators, completion progress, and result accordions. Each task shows its description, status (pending, running, complete, failed), and can be expanded to reveal subtasks and results. Supports reprioritization via drag-and-drop.

**Anatomy**: root:          container → goalHeader:    container → progressBar:   container → taskList:      container → taskItem:      container → taskStatus:    container → taskLabel:     text → taskResult:    container → subtasks:      container → dragHandle:    container

**States**:
- `idle` _(initial)_: EXPAND_TASK → idle, COLLAPSE_TASK → idle, SELECT_TASK → taskSelected, DRAG_START → reordering
- `taskSelected`: DESELECT → idle, SELECT_TASK → taskSelected
- `reordering`: DROP → idle, CANCEL_DRAG → idle

**Accessibility**:
- Role: `list`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - goalLabel: goal
  - tasks: available_tools
  - progress: current_step

**Props**:
- `showProgress: Bool`
- `allowReorder: Bool`
- `expandedTasks: list`

#### tool-invocation

> Collapsible card displaying an LLM tool call execution. Shows the tool name, serialized arguments, execution status, result output, and timing information. Supports expand/collapse to reveal full argument and result payloads. Flags destructive or approval-required tools with warning indicators.

**Anatomy**: root:           container → header:         container → toolIcon:       container → toolName:       text → statusIcon:     container → durationLabel:  text → body:           container → argumentsBlock: container → resultBlock:    container → warningBadge:   container → retryButton:    action

**States**:
- `collapsed` _(initial)_: EXPAND → expanded, HOVER → hoveredCollapsed
- `hoveredCollapsed`: LEAVE → collapsed, EXPAND → expanded
- `expanded`: COLLAPSE → collapsed
- `pending` _(initial)_: INVOKE → running
- `running`: SUCCESS → succeeded, FAILURE → failed
- `succeeded`: RESET → pending
- `failed`: RETRY → running, RESET → pending

**Accessibility**:
- Role: `article`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - toolName: name
  - arguments: input_schema
  - result: output_schema
  - status: handler

**Props**:
- `showArguments: Bool`
- `showResult: Bool`
- `defaultExpanded: Bool`

#### trace-tree

> Hierarchical execution trace viewer displaying agent loop iterations, tool invocations, and LLM calls as a tree structure. Each node shows the operation type, duration, token usage, cost, and status. Supports expand/collapse, filtering by node type, and selection for detail inspection. Shared between LLM agent and formal verification domains.

**Anatomy**: root:          container → header:        container → filterBar:     container → tree:          container → spanNode:      container → spanIcon:      container → spanLabel:     text → spanDuration:  text → spanTokens:    text → spanStatus:    container → spanChildren:  container → detailPanel:   container

**States**:
- `idle` _(initial)_: SELECT_SPAN → spanSelected, EXPAND → idle, COLLAPSE → idle, FILTER → idle
- `spanSelected`: DESELECT → idle, SELECT_SPAN → spanSelected
- `ready` _(initial)_: LOAD → fetching
- `fetching`: LOAD_COMPLETE → ready

**Accessibility**:
- Role: `tree`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - rootLabel: goal
  - spans: available_tools

**Props**:
- `spans: list`
- `selectedSpanId: option`
- `expandedIds: list`
- `visibleTypes: list`
- `showMetrics: Bool`

### llm-conversation

#### artifact-panel

> Side panel for displaying and interacting with generated artifacts (code, documents, diagrams, applications). Shows artifact content with appropriate rendering (syntax highlighting for code, preview for HTML/React, markdown rendering for text). Supports version history, copy, download, and full-screen editing.

**Anatomy**: root:          container → header:        container → titleText:     text → typeBadge:     container → toolbar:       container → contentArea:   container → versionBar:    container → copyButton:    action → downloadButton: action → closeButton:   action

**States**:
- `open` _(initial)_: COPY → copied, FULLSCREEN → fullscreen, CLOSE → closed, VERSION_CHANGE → open
- `copied`: COPY_TIMEOUT → open
- `fullscreen`: EXIT_FULLSCREEN → open, CLOSE → closed
- `closed`: OPEN → open

**Accessibility**:
- Role: `complementary`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - content: messages.content
  - title: metadata.tags

**Props**:
- `showVersions: Bool`
- `defaultWidth: String`
- `resizable: Bool`

#### chat-message

> Role-differentiated message container for LLM conversations. Renders user, assistant, system, and tool messages with distinct visual treatments including avatar, role label, markdown content, timestamp, and an actions toolbar. Supports streaming state for assistant messages with animated cursor.

**Anatomy**: root:       container → avatar:     container → roleLabel:  text → body:       container → timestamp:  text → actions:    container → copyButton: action

**States**:
- `idle` _(initial)_: HOVER → hovered, STREAM_START → streaming, COPY → copied
- `hovered`: LEAVE → idle
- `streaming`: STREAM_END → idle
- `copied`: COPY_TIMEOUT → idle

**Accessibility**:
- Role: `article`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - role: messages.role
  - content: messages.content
  - timestamp: messages.timestamp

**Props**:
- `variant: union`
- `showAvatar: Bool`
- `showTimestamp: Bool`
- `isStreaming: Bool`

#### conversation-sidebar

> Sidebar panel listing conversation history with search, folder grouping (by date, tags, or custom folders), and context menu actions (rename, delete, archive, share). Each entry shows title, preview text, timestamp, and model badge.

**Anatomy**: root:           container → searchInput:    widget → newButton:      action → groupList:      container → groupHeader:    text → conversationItem: container → itemTitle:      text → itemPreview:    text → itemTimestamp:  text → itemModel:      container

**States**:
- `idle` _(initial)_: SEARCH → searching, SELECT → idle, CONTEXT_MENU → contextOpen
- `searching`: CLEAR_SEARCH → idle, SELECT → idle
- `contextOpen`: CLOSE_CONTEXT → idle, ACTION → idle

**Accessibility**:
- Role: `navigation`
- Focus: roving

**Affordance**:
- Serves: `entity-card`
- Specificity: 18
- Binds:
  - conversations: metadata
  - selectedId: metadata.tags

**Props**:
- `groupBy: union`
- `showPreview: Bool`
- `showModel: Bool`

#### inline-citation

> Numbered inline citation reference rendered as a superscript badge within message text. Hovering reveals a preview tooltip with the source title, URL, and relevant excerpt. Clicking navigates to the source. Used for RAG-augmented responses with source attribution.

**Anatomy**: root:     container → badge:    container → tooltip:  container → title:    text → excerpt:  text → link:     action

**States**:
- `idle` _(initial)_: HOVER → previewing, CLICK → navigating
- `previewing`: LEAVE → idle, CLICK → navigating
- `navigating`: NAVIGATE_COMPLETE → idle

**Accessibility**:
- Role: `link`

**Affordance**:
- Serves: `entity-inline`
- Specificity: 20

**Props**:
- `size: union`
- `showPreviewOnHover: Bool`

#### message-branch-nav

> Navigation control for conversation branches showing the current branch position (e.g., "2 of 3"), with left/right arrows to switch between branches. Includes edit button to create a new branch from the current message, and save/cancel for edit mode.

**Anatomy**: root:        container → prevButton:  action → indicator:   text → nextButton:  action → editButton:  action

**States**:
- `viewing` _(initial)_: PREV → viewing, NEXT → viewing, EDIT → editing
- `editing`: SAVE → viewing, CANCEL → viewing

**Accessibility**:
- Role: `navigation`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - currentIndex: active_branch
  - totalBranches: branches

**Props**:
- `showEdit: Bool`
- `compact: Bool`

#### prompt-input

> Auto-expanding textarea for composing LLM prompts with file attachment support, model selector dropdown, character/token counter, and submit action. Supports voice input toggle and web search toggle. Expands vertically as content grows up to a maximum height, then scrolls.

**Anatomy**: root:           container → textarea:       widget → attachButton:   action → modelSelector:  widget → counter:        text → submitButton:   action → toolbar:        container

**States**:
- `empty` _(initial)_: INPUT → composing, PASTE → composing, ATTACH → composing
- `composing`: CLEAR → empty, SUBMIT → submitting
- `submitting`: SUBMIT_COMPLETE → empty, SUBMIT_ERROR → composing

**Accessibility**:
- Role: `group`

**Affordance**:
- Serves: `entity-editor`
- Specificity: 20
- Binds:
  - value: messages.content

**Props**:
- `placeholder: String`
- `maxLength: option`
- `showModelSelector: Bool`
- `showAttach: Bool`
- `disabled: Bool`

#### stream-text

> Token-by-token text renderer for streaming LLM responses. Displays content as it arrives with an animated cursor, smooth text insertion, and progressive markdown rendering. Shows a generation indicator during active streaming and supports stop/cancel actions.

**Anatomy**: root:       container → textBlock:  container → cursor:     container → stopButton: action

**States**:
- `idle` _(initial)_: STREAM_START → streaming
- `streaming`: TOKEN → streaming, STREAM_END → complete, STOP → stopped
- `complete`: STREAM_START → streaming
- `stopped`: STREAM_START → streaming

**Accessibility**:
- Role: `region`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 22
- Binds:
  - content: messages.content
  - streaming: metadata.streaming

**Props**:
- `renderMarkdown: Bool`
- `cursorStyle: union`
- `smoothScroll: Bool`

### llm-core

#### generation-indicator

> Status indicator for LLM generation in progress. Displays an animated typing indicator, optional token counter, model badge, and elapsed time. Transitions between waiting, generating, and complete states with appropriate animations.

**Anatomy**: root:         container → spinner:      container → statusText:   text → modelBadge:   container → tokenCounter: text → elapsed:      text

**States**:
- `idle` _(initial)_: START → generating
- `generating`: TOKEN → generating, COMPLETE → complete, ERROR → error
- `complete`: RESET → idle, START → generating
- `error`: RESET → idle, RETRY → generating

**Accessibility**:
- Role: `status`

**Affordance**:
- Serves: `entity-inline`
- Specificity: 20
- Binds:
  - status: status
  - model: model_id

**Props**:
- `showTokens: Bool`
- `showModel: Bool`
- `showElapsed: Bool`
- `variant: union`

### llm-prompt

#### prompt-template-editor

> Multi-message prompt template editor with role selection (system, user, assistant), template textarea with variable syntax ({{variable}}) highlighting, auto-detected variable pills, message reordering, and a parameter panel for model selection and generation settings.

**Anatomy**: root:           container → messageList:    container → messageBlock:   container → roleSelector:   widget → templateInput:  widget → variablePills:  container → addButton:      action → reorderHandle:  container → deleteButton:   action → parameterPanel: container → tokenCount:     text

**States**:
- `editing` _(initial)_: ADD_MESSAGE → editing, REMOVE_MESSAGE → editing, REORDER → editing, COMPILE → compiling, SELECT_MESSAGE → messageSelected
- `messageSelected`: DESELECT → editing, SELECT_MESSAGE → messageSelected
- `compiling`: COMPILE_COMPLETE → editing, COMPILE_ERROR → editing

**Accessibility**:
- Role: `form`
- Focus: roving

**Affordance**:
- Serves: `entity-editor`
- Specificity: 20
- Binds:
  - messages: compiled_prompts
  - variables: input_fields
  - modelId: module_type

**Props**:
- `showParameters: Bool`
- `showTokenCount: Bool`
- `maxMessages: Int`

### llm-safety

#### execution-metrics-panel

> Dashboard panel displaying LLM execution metrics including step count, token usage gauge, accumulated cost, latency percentiles, and error rate. Supports real-time updates during agent execution and historical comparison.

**Anatomy**: root:        container → stepCounter: container → tokenGauge:  container → costDisplay: container → latencyCard: container → errorRate:   container

**States**:
- `idle` _(initial)_: UPDATE → updating
- `updating`: UPDATE_COMPLETE → idle

**Accessibility**:
- Role: `region`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - totalTokens: config.threshold
  - errorRate: violation_log

**Props**:
- `tokenLimit: option`
- `showLatency: Bool`
- `compact: Bool`

#### guardrail-config

> Configuration panel for safety guardrails showing rule list with enable/disable toggles, severity levels, violation history chart, and test input field for validating rules. Supports adding custom rules and importing rule sets.

**Anatomy**: root:          container → header:        container → ruleList:      container → ruleItem:      container → ruleToggle:    widget → ruleName:      text → ruleSeverity:  container → ruleHistory:   container → addButton:     action → testPanel:     container → testInput:     widget → testResult:    container

**States**:
- `viewing` _(initial)_: SELECT_RULE → ruleSelected, TEST → testing, ADD_RULE → adding
- `ruleSelected`: DESELECT → viewing
- `testing`: TEST_COMPLETE → viewing
- `adding`: SAVE → viewing, CANCEL → viewing

**Accessibility**:
- Role: `form`
- Focus: roving

**Affordance**:
- Serves: `entity-editor`
- Specificity: 20
- Binds:
  - name: name
  - guardrailType: guardrail_type
  - rules: rules

**Props**:
- `showHistory: Bool`
- `showTest: Bool`

#### tool-call-detail

> Detailed view of a single tool call within an LLM execution trace. Shows tool name, formatted arguments panel, result section, timing breakdown, token usage, error display with stack trace, and retry action. Used in trace drill-down views.

**Anatomy**: root:           container → header:         container → toolName:       text → statusBadge:    container → argumentsPanel: container → resultPanel:    container → timingBar:      container → tokenBadge:     container → errorPanel:     container → retryButton:    action

**States**:
- `idle` _(initial)_: EXPAND_ARGS → idle, EXPAND_RESULT → idle, RETRY → retrying
- `retrying`: RETRY_COMPLETE → idle, RETRY_ERROR → idle

**Accessibility**:
- Role: `article`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18

**Props**:
- `showTiming: Bool`
- `showTokens: Bool`

### package

#### audit-report

> Security audit report panel showing vulnerability counts by severity (critical, high, medium, low), affected packages list, remediation recommendations, and a severity distribution chart. Supports filtering by severity and expand/collapse for vulnerability details.

**Anatomy**: root:            container → header:          container → severityChart:   container → criticalCount:   container → highCount:       container → mediumCount:     container → lowCount:        container → vulnList:        container → vulnItem:        container → vulnTitle:       text → vulnPackage:     text → vulnSeverity:    container → vulnRemediation: container

**States**:
- `idle` _(initial)_: FILTER → filtering, SELECT_VULN → vulnSelected
- `filtering`: CLEAR → idle
- `vulnSelected`: DESELECT → idle

**Accessibility**:
- Role: `region`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - vulnerabilities: vulnerabilities
  - severityCounts: severity_counts
  - lastScan: last_scan
  - status: status

**Props**:
- `filterSeverity: option`
- `showRemediation: Bool`

#### dependency-tree

> Interactive dependency tree viewer for package manifests. Displays the resolved dependency graph as a collapsible tree with version badges, conflict indicators, duplicate detection, and vulnerability markers. Supports search, filter by scope (runtime, dev, optional), and detail panel for selected packages.

**Anatomy**: root:          container → searchBar:     widget → scopeFilter:   widget → tree:          container → treeNode:      container → packageName:   text → versionBadge:  container → conflictIcon:  container → vulnIcon:      container → dupBadge:      container → detailPanel:   container

**States**:
- `idle` _(initial)_: SELECT → nodeSelected, EXPAND → idle, COLLAPSE → idle, SEARCH → filtering, FILTER_SCOPE → idle
- `nodeSelected`: DESELECT → idle, SELECT → nodeSelected
- `filtering`: CLEAR → idle

**Accessibility**:
- Role: `tree`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - rootPackage: name
  - dependencies: dependencies

**Props**:
- `expandDepth: Int`
- `showDevDeps: Bool`
- `showVulnerabilities: Bool`
- `selectedPackage: option`

#### registry-search

> Search interface for the package registry with type-ahead suggestions, result cards showing package name, description, version, downloads, keywords, and publish date. Supports filtering by keyword, sorting by relevance/downloads/date, and pagination.

**Anatomy**: root:          container → searchInput:   widget → suggestions:   container → filterBar:     container → resultList:    container → resultCard:    container → cardName:      text → cardVersion:   text → cardDesc:      text → cardKeywords:  container → cardDownloads: text → cardDate:      text → pagination:    widget → emptyState:    container

**States**:
- `idle` _(initial)_: INPUT → searching, SELECT_RESULT → idle
- `searching`: RESULTS → idle, CLEAR → idle

**Accessibility**:
- Role: `search`

**Affordance**:
- Serves: `entity-card`
- Specificity: 20
- Binds:
  - results: versions

**Props**:
- `sortBy: union`
- `pageSize: Int`

### process-automation

#### expression-toggle-input

> Dual-mode input field that switches between a fixed-value form widget and an expression/code editor. In fixed mode, renders the appropriate field widget (text, number, boolean, etc.). In expression mode, shows a CodeMirror editor with variable autocomplete and live preview of the evaluated result.

**Anatomy**: root:          container → modeToggle:    widget → fixedInput:    widget → expressionInput: widget → autocomplete:  container → preview:       container

**States**:
- `fixed` _(initial)_: TOGGLE → expression, INPUT → fixed
- `expression`: TOGGLE → fixed, INPUT → expression, SHOW_AC → autocompleting
- `autocompleting`: SELECT → expression, DISMISS → expression

**Accessibility**:
- Role: `group`

**Affordance**:
- Serves: `entity-editor`
- Specificity: 20
- Binds:
  - value: input
  - mode: connector_type

**Props**:
- `fieldType: union`
- `variables: list`

### process-foundation

#### execution-overlay

> Runtime state overlay for process execution. Renders on top of a process diagram to show the current execution state with status-colored node highlights, active step indicator, token position markers, item count badges, and animated flow edges. Supports live, replay, and static display modes.

**Anatomy**: root:           container → nodeOverlay:    container → activeMarker:   container → flowAnimation:  container → statusBar:      container → controlButtons: container → elapsedTime:    text → errorBanner:    container

**States**:
- `idle` _(initial)_: START → live, LOAD_REPLAY → replay
- `live`: STEP_ADVANCE → live, COMPLETE → completed, FAIL → failed, SUSPEND → suspended, CANCEL → cancelled
- `suspended`: RESUME → live, CANCEL → cancelled
- `completed`: RESET → idle
- `failed`: RESET → idle, RETRY → live
- `cancelled`: RESET → idle
- `replay`: REPLAY_STEP → replay, REPLAY_END → idle

**Accessibility**:
- Role: `group`

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - status: status
  - activeStep: parent_run
  - startedAt: started_at
  - endedAt: ended_at

**Props**:
- `mode: union`
- `showControls: Bool`
- `showElapsed: Bool`
- `animateFlow: Bool`

#### run-list-table

> Table listing process runs with columns for status, process name, start time, duration, and outcome. Supports sorting, filtering by status, pagination, and row selection for drill-down into run details.

**Anatomy**: root:        container → filterBar:   container → table:       container → headerRow:   container → dataRow:     container → statusCell:  container → nameCell:    text → startCell:   text → durationCell: text → outcomeCell: container → pagination:  widget

**States**:
- `idle` _(initial)_: SELECT_ROW → rowSelected, SORT → idle, FILTER → idle, PAGE → idle
- `rowSelected`: DESELECT → idle, SELECT_ROW → rowSelected

**Accessibility**:
- Role: `table`
- Focus: roving

**Affordance**:
- Serves: `entity-card`
- Specificity: 18
- Binds:
  - runs: status

**Props**:
- `pageSize: Int`
- `sortBy: String`
- `sortOrder: union`
- `filterStatus: option`

#### variable-inspector

> Key-value inspector panel for process run variables. Displays variable names, types, current values, and change history. Supports JSON tree expansion for complex values, search/filter, and watch expressions for monitoring specific variables.

**Anatomy**: root:          container → searchBar:     widget → variableList:  container → variableItem:  container → varName:       text → varType:       text → varValue:      container → watchList:     container

**States**:
- `idle` _(initial)_: SEARCH → filtering, SELECT_VAR → varSelected, ADD_WATCH → idle
- `filtering`: CLEAR → idle
- `varSelected`: DESELECT → idle

**Accessibility**:
- Role: `region`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 18
- Binds:
  - runStatus: status

**Props**:
- `showTypes: Bool`
- `showWatch: Bool`
- `expandDepth: Int`

### process-human

#### approval-stepper

> Multi-step approval flow visualization showing sequential or parallel approval stages. Each step displays the assignee, status, timestamp, and optional form data. Supports M-of-N quorum display for parallel approvals and SLA countdown for time-sensitive approvals.

**Anatomy**: root:           container → stepList:       container → step:           container → stepIndicator:  container → stepLabel:      text → stepAssignee:   container → stepStatus:     container → stepTimestamp:  text → connector:      container → actionBar:      container → slaIndicator:   container

**States**:
- `viewing` _(initial)_: FOCUS_STEP → stepFocused, START_ACTION → acting
- `stepFocused`: BLUR → viewing, START_ACTION → acting
- `acting`: COMPLETE → viewing, CANCEL → viewing

**Accessibility**:
- Role: `list`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - currentStep: step_ref
  - status: status
  - assignee: assignee
  - dueAt: due_at

**Props**:
- `variant: union`
- `orientation: union`
- `showSLA: Bool`
- `showAssignee: Bool`

#### sla-timer

> Five-state countdown timer for service level agreement tracking. Displays remaining time with color-coded urgency phases: on-track (green), warning (yellow), critical (orange), breached (red), and paused (gray). Shows a progress bar, phase label, and elapsed time.

**Anatomy**: root:          container → countdownText: text → phaseLabel:    text → progressBar:   container → elapsedText:   text

**States**:
- `onTrack` _(initial)_: TICK → onTrack, WARNING_THRESHOLD → warning, PAUSE → paused
- `warning`: TICK → warning, CRITICAL_THRESHOLD → critical, PAUSE → paused
- `critical`: TICK → critical, BREACH → breached, PAUSE → paused
- `breached`: TICK → breached
- `paused`: RESUME → onTrack

**Accessibility**:
- Role: `timer`

**Affordance**:
- Serves: `entity-inline`
- Specificity: 20
- Binds:
  - dueAt: due_at
  - status: status

**Props**:
- `warningThreshold: Float`
- `criticalThreshold: Float`
- `showElapsed: Bool`

### process-llm

#### eval-results-table

> Results table for LLM evaluation runs showing test cases with pass/fail status, model output, expected output, score, and per-metric breakdowns. Supports sorting by score, filtering by pass/fail, and detail expansion for individual test cases.

**Anatomy**: root:          container → summaryBar:    container → scoreDisplay:  text → passFailBar:   container → table:         container → headerRow:     container → dataRow:       container → statusCell:    container → inputCell:     container → outputCell:    container → expectedCell:  container → scoreCell:     text → detailPanel:   container

**States**:
- `idle` _(initial)_: SELECT_ROW → rowSelected, SORT → idle, FILTER → idle
- `rowSelected`: DESELECT → idle, SELECT_ROW → rowSelected

**Accessibility**:
- Role: `table`
- Focus: roving

**Affordance**:
- Serves: `entity-detail`
- Specificity: 20
- Binds:
  - testCases: test_cases
  - overallScore: score
  - passCount: passed
  - failCount: failed

**Props**:
- `sortBy: String`
- `sortOrder: union`
- `filterStatus: option`
- `showExpected: Bool`

#### prompt-editor

> Multi-message prompt template editor for LLM steps in process workflows. Supports role-based message blocks (system, user, assistant), template variables with {{syntax}} highlighting, auto-detected variable pills, token count estimation, and a test panel for previewing prompt output.

**Anatomy**: root:          container → systemBlock:   container → userBlock:     container → variablePills: container → modelBadge:    container → tokenCount:    text → testButton:    action → testPanel:     container → toolList:      container

**States**:
- `editing` _(initial)_: TEST → testing, INPUT → editing
- `testing`: TEST_COMPLETE → viewing, TEST_ERROR → editing
- `viewing`: EDIT → editing, TEST → testing

**Accessibility**:
- Role: `form`

**Affordance**:
- Serves: `entity-editor`
- Specificity: 20
- Binds:
  - systemPrompt: system_prompt
  - userPrompt: user_prompt
  - model: model
  - tools: tools

**Props**:
- `showTest: Bool`
- `showTools: Bool`
- `showTokenCount: Bool`

---

## Affordance Index

| Widget | Suite | Serves | Specificity | Binds To |
|--------|-------|--------|-------------|----------|
| coverage-source-view | formal-verification | entity-detail | 18 | sourceText, coverageData |
| dag-viewer | formal-verification | entity-graph | 20 | nodes, edges |
| formula-display | formal-verification | entity-detail | 20 | formula, language, scope |
| proof-session-tree | formal-verification | entity-detail | 20 | items, itemLabel, itemStatus |
| status-grid | formal-verification | entity-detail | 18 | rows, columns, cells |
| trace-step-controls | formal-verification | entity-detail | 18 | currentStep, totalSteps |
| trace-timeline-viewer | formal-verification | entity-detail | 20 | steps, variables, currentStep |
| verification-status-badge | formal-verification | entity-inline | 20 | status, label |
| deliberation-thread | governance-decision | entity-detail | 20 | status |
| proposal-card | governance-decision | entity-card | 20 | title, description, author, status, timestamp |
| vote-result-bar | governance-decision | entity-inline | 18 | segments, total |
| execution-pipeline | governance-execution | entity-detail | 22 | currentStage, status |
| guard-status-panel | governance-execution | entity-detail | 18 | executionStatus |
| timelock-countdown | governance-execution | entity-detail | 20 | phase, deadline |
| circle-org-chart | governance-structure | entity-detail | 20 | circles |
| delegation-graph | governance-structure | entity-detail | 20 | delegator, delegatee, weight, transitive |
| weight-breakdown | governance-structure | entity-detail | 20 | totalWeight, participant |
| agent-timeline | llm-agent | entity-detail | 18 | agentName, status, entries |
| hitl-interrupt | llm-agent | entity-editor | 22 | status, reason |
| memory-inspector | llm-agent | entity-detail | 20 | memoryType, entries, workingMemory |
| reasoning-block | llm-agent | entity-detail | 20 | content, collapsed |
| task-plan-list | llm-agent | entity-detail | 18 | goalLabel, tasks, progress |
| tool-invocation | llm-agent | entity-detail | 20 | toolName, arguments, result, status |
| trace-tree | llm-agent | entity-detail | 20 | rootLabel, spans |
| artifact-panel | llm-conversation | entity-detail | 18 | content, title |
| chat-message | llm-conversation | entity-detail | 20 | role, content, timestamp |
| conversation-sidebar | llm-conversation | entity-card | 18 | conversations, selectedId |
| inline-citation | llm-conversation | entity-inline | 20 | — |
| message-branch-nav | llm-conversation | entity-detail | 18 | currentIndex, totalBranches |
| prompt-input | llm-conversation | entity-editor | 20 | value |
| stream-text | llm-conversation | entity-detail | 22 | content, streaming |
| generation-indicator | llm-core | entity-inline | 20 | status, model |
| prompt-template-editor | llm-prompt | entity-editor | 20 | messages, variables, modelId |
| execution-metrics-panel | llm-safety | entity-detail | 18 | totalTokens, errorRate |
| guardrail-config | llm-safety | entity-editor | 20 | name, guardrailType, rules |
| tool-call-detail | llm-safety | entity-detail | 18 | — |
| audit-report | package | entity-detail | 20 | vulnerabilities, severityCounts, lastScan, status |
| dependency-tree | package | entity-detail | 20 | rootPackage, dependencies |
| registry-search | package | entity-card | 20 | results |
| expression-toggle-input | process-automation | entity-editor | 20 | value, mode |
| execution-overlay | process-foundation | entity-detail | 20 | status, activeStep, startedAt, endedAt |
| run-list-table | process-foundation | entity-card | 18 | runs |
| variable-inspector | process-foundation | entity-detail | 18 | runStatus |
| approval-stepper | process-human | entity-detail | 20 | currentStep, status, assignee, dueAt |
| sla-timer | process-human | entity-inline | 20 | dueAt, status |
| eval-results-table | process-llm | entity-detail | 20 | testCases, overallScore, passCount, failCount |
| prompt-editor | process-llm | entity-editor | 20 | systemPrompt, userPrompt, model, tools |

## Accessibility Summary

### Roles

| Role | Widgets |
|------|---------|
| alertdialog | hitl-interrupt |
| application | dag-viewer |
| article | proposal-card, tool-invocation, chat-message, tool-call-detail |
| complementary | artifact-panel |
| document | coverage-source-view |
| feed | deliberation-thread |
| figure | formula-display |
| form | prompt-template-editor, guardrail-config, prompt-editor |
| grid | status-grid, trace-timeline-viewer |
| group | reasoning-block, prompt-input, expression-toggle-input, execution-overlay |
| img | vote-result-bar, weight-breakdown |
| link | inline-citation |
| list | execution-pipeline, task-plan-list, approval-stepper |
| log | agent-timeline |
| navigation | conversation-sidebar, message-branch-nav |
| region | guard-status-panel, delegation-graph, memory-inspector, stream-text, execution-metrics-panel, audit-report, variable-inspector |
| search | registry-search |
| status | verification-status-badge, generation-indicator |
| table | run-list-table, eval-results-table |
| timer | timelock-countdown, sla-timer |
| toolbar | trace-step-controls |
| tree | proof-session-tree, circle-org-chart, trace-tree, dependency-tree |
