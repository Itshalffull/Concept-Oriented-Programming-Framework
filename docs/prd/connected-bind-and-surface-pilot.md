# Connected Bind & Surface Pilot — PRD

## Status: Draft
## Date: 2026-04-03
## Epic: `MAG-311` — Epic: Connected Bind & Surface Pilot

---

## Card Index

| PRD Section | Card ID | Title |
|------------|---------|-------|
| 10 Phase A | `MAG-312` | Phase A: Connection & Credential |
| 3.1 Connection | `MAG-317` | Concept: Connection [K] |
| 3.1 Connection | `MAG-318` | Handler: Connection |
| 3.3 Credential | `MAG-319` | Concept: Credential [C] |
| 3.3 Credential | `MAG-320` | Handler: Credential |
| 3.1 Transport Adapters | `MAG-321` | WebSocket Transport Adapter |
| 3.1 Transport Adapters | `MAG-322` | HTTP Transport Adapter |
| 6.1 CLI | `MAG-323` | CLI: auth commands |
| 6.1 CLI | `MAG-324` | CLI: connect command |
| 3.1 Connection | `MAG-325` | Conformance Tests: Connection |
| 3.3 Credential | `MAG-326` | Conformance Tests: Credential |
| 10 Phase B | `MAG-313` | Phase B: Bind Target Wiring |
| 6.1 CLI | `MAG-327` | Wire CLI commands through Connection |
| 6.2 MCP | `MAG-328` | Wire MCP server through Connection |
| 6.3 REST | `MAG-329` | Wire REST routes through Connection |
| 6.4 GraphQL | `MAG-330` | Wire GraphQL resolvers through Connection |
| 3.1, 6.1 Discovery | `MAG-331` | Discovery: discover + describe commands |
| 10 Phase C | `MAG-314` | Phase C: PageMap & Pilot |
| 3.2 PageMap | `MAG-332` | Concept: PageMap [P] |
| 3.2 PageMap | `MAG-333` | Handler: PageMap |
| 4.1 Binding | `MAG-334` | Binding: writeField action |
| 5 Pilot | `MAG-335` | Derived: Pilot |
| 5.5 Syncs | `MAG-336` | Sync: host-ready-captures-page |
| 5.5 Syncs | `MAG-337` | Sync: machine-spawn-registers-element |
| 5.5 Syncs | `MAG-338` | Sync: machine-send-updates-element |
| 5.5 Syncs | `MAG-339` | Sync: host-unmount-clears-page |
| 5.5 Syncs | `MAG-340` | Sync: interact-sends-to-machine |
| 5.5 Syncs | `MAG-341` | Sync: fill-writes-field |
| 5.5 Syncs | `MAG-342` | Sync: submit-invokes-action |
| 3.2 PageMap | `MAG-343` | Conformance Tests: PageMap |
| 10 Phase D | `MAG-315` | Phase D: Pilot Bind Targets |
| 6.2 MCP | `MAG-344` | Generate MCP tools from Pilot |
| 6.1 CLI | `MAG-345` | Generate CLI commands from Pilot |
| 10 Phase D | `MAG-346` | Integration Test: AI agent navigates via MCP |
| 10 Phase D | `MAG-347` | Integration Test: CLI operates running app |
| 10 Phase E | `MAG-316` | Phase E: Enhanced Discovery |
| 3.1 discover | `MAG-348` | Score integration for discover depth:full |
| 6.1 CLI | `MAG-349` | clef describe --full with syncs/affordances/widgets |

---

## 1. Problem Statement

Bind generates typed interfaces (REST routes, CLI commands, MCP tools, GraphQL schemas) from concept specs, but the generated artifacts are static code that must be manually wired to a running kernel. An API route file is generated, but nothing connects it to the kernel that actually executes `Task/create`. Each deployment reinvents this wiring.

Meanwhile, Surface renders apps with rich semantic metadata — widgets with FSMs, affordances binding widgets to concepts, navigation with full destination catalogs, layouts with spatial zones — but none of this is exposed to external agents. An AI agent can invoke `Task/create` via a Bind-generated MCP tool, but it cannot:

- Navigate to the tasks page
- See what widgets are on screen
- Click a button or fill a form field
- Read the data a table is displaying
- Observe where the user currently is to offer contextual help

The gap: Bind generates interfaces but doesn't connect them to running apps. Surface has everything needed for semantic UI navigation but doesn't expose it.

---

## 2. Solution Overview

Two changes:

1. **Connection concept** — a transport-agnostic session with a live kernel. All Bind targets (REST, CLI, MCP, GraphQL, SDKs) wire their generated interfaces through Connection at runtime. Generated code stays fully typed from specs; Connection provides the runtime bridge.

2. **Pilot derived concept** — composes existing Surface runtime concepts (Navigator, Host, Shell, Machine, PageMap, Binding) into an agent-friendly interface for navigating and operating a running Surface app. Bind generates MCP/CLI tools from Pilot like any other concept.

Supporting pieces:
- **PageMap concept** — labeled registry of interactive elements on a page, addressable by semantic label, role, or concept binding
- **Credential concept** — client-side connection profile and credential management
- **Binding/writeField action** — new action on existing Binding concept for field-level signal writes

---

## 3. New Concepts

### 3.1 Connection [K]

#### Purpose

Establish and manage a session with a running Clef kernel instance, providing discovery, invocation, and observation of registered concepts. Transport-agnostic — the same concept works over WebSocket, HTTP, IPC, or in-process.

#### State

| Field | Type | Description |
|-------|------|-------------|
| `endpoint` | String | Kernel address (e.g., `ws://localhost:3000/kernel`) |
| `status` | String | `connecting`, `connected`, `disconnected`, `error` |
| `session` | option String | Session token from kernel (carries identity/auth context) |
| `registeredConcepts` | set String | Concept names available on this kernel |
| `transportAdapter` | String | Wire protocol: `websocket`, `http`, `ipc`, `in-process` |
| `errorInfo` | option String | Last connection error details |

#### Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `connect` | ok, unreachable, unauthorized | Connect to kernel at endpoint with optional credentials. On success, discover registered concepts and establish session. Auth credentials pass through to the kernel's identity concepts (Authentication/authenticate, Session/create). |
| `discover` | ok, disconnected | Return registered concepts with varying depth. `list` → concept names only. `manifest` → names + actions + input types + variants. `full` → manifest + syncs involving each concept + affordances + widgets (requires Score). |
| `invoke` | ok, not_found, unauthorized, error | Call a concept action with typed input. Returns completion variant + output. AccessControl/check is evaluated server-side before execution. |
| `observe` | ok, not_supported, disconnected | Subscribe to a completion stream for a concept/action. Returns an observable stream of completions. Used for async updates, streaming results, and reactive UI. |
| `disconnect` | ok | End session, close transport. |

#### Operational Principle

After connecting to a kernel, the caller can discover what concepts are registered, invoke their actions, and observe completion streams. Each connection carries a session identity (user, agent, service) that the kernel's existing auth concepts (Authentication, Authorization, AccessControl) evaluate on every invocation. Multiple connections can share a kernel — each gets its own session.

#### Invariants

- A connected session always has a non-empty `registeredConcepts` set
- `invoke` and `observe` require `status = "connected"`
- `disconnect` invalidates the session token

#### Transport Adapters

Connection declares the protocol but delegates wire format to transport adapters, which already exist in the deployment layer:

| Adapter | Best for | Bidirectional | Notes |
|---------|----------|---------------|-------|
| WebSocket | CLI, MCP, browser | Yes | Natural for observe/streaming |
| HTTP | REST targets, serverless | No (SSE for observe) | Simplest deployment |
| IPC / Unix socket | Same-machine CLI | Yes | Lowest latency |
| In-process | Tests, embedded | Yes | No serialization overhead |

---

### 3.2 PageMap [P]

#### Purpose

Maintain a labeled inventory of interactive elements within a hosted view, addressable by semantic label, role, or concept binding. Independently useful for accessibility auditing, integration testing, dev tools, and agent-driven UI navigation.

#### State

| Field | Type | Description |
|-------|------|-------------|
| `entries` | set P | All registered elements |
| `label` | P -> String | Human-readable label (from widget purpose or anatomy description) |
| `role` | P -> String | Semantic role: `button`, `form`, `table`, `dialog`, `input`, etc. |
| `machineRef` | P -> String | Machine instance ID |
| `widgetName` | P -> String | Widget spec name (e.g., `"task-card"`, `"create-form"`) |
| `currentState` | P -> String | Machine's current FSM state |
| `validEvents` | P -> list String | Events valid from current state (available transitions) |
| `conceptBinding` | P -> option String | Which concept this widget serves (from affordance `when.concept`) |
| `affordanceServes` | P -> option String | What UI pattern this widget fulfills (from affordance `serves`) |
| `hostRef` | P -> String | Which Host instance this element belongs to |

#### Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `register` | ok, duplicate | Register an interactive element with its label, role, machine ref, widget metadata, and concept binding. |
| `update` | ok, notfound | Update an entry's currentState and validEvents (after a Machine/send). |
| `find` | ok, notfound | Find an entry by label (fuzzy match). |
| `findByRole` | ok | All entries matching a given role. |
| `findByConcept` | ok | All entries bound to a given concept. |
| `findByWidget` | ok | All entries for a given widget name. |
| `list` | ok | All entries for a given host. |
| `clear` | ok | Remove all entries for a host (on unmount). |

#### Operational Principle

When a Host becomes interactive, syncs populate PageMap with labeled entries by joining each tracked Machine with its Widget AST metadata (purpose, anatomy descriptions, affordance bindings). When a Machine transitions state, syncs update the entry's currentState and validEvents. When the Host unmounts, syncs clear its entries. External agents query PageMap to discover what's on screen and address elements by semantic label rather than opaque machine IDs.

#### Invariants

- Every entry has a non-empty label and role
- Every entry's machineRef points to a live Machine instance (cleared on unmount)
- No two entries in the same host share the same label

#### Concept Independence Verification

| Principle | PageMap |
|-----------|---------|
| **Independent purpose** | Labeled inventory of interactive elements |
| **Own state** | entries with labels, roles, states, events |
| **No concept coupling** | Doesn't import Machine, Widget, or Host |
| **Sync-only composition** | Populated by syncs that fire on Host/ready and Machine/spawn |
| **Useful alone** | Accessibility auditing, test harnesses, dev tools |

---

### 3.3 Credential [C]

#### Purpose

Manage named client-side connection profiles, each binding a kernel endpoint to stored authentication credentials. Supports multiple profiles for different environments (local, staging, production) and multiple auth methods (API key, OAuth token, session token).

#### State

| Field | Type | Description |
|-------|------|-------------|
| `profiles` | set C | All stored profiles |
| `name` | C -> String | Profile name: `"default"`, `"staging"`, `"prod"`, `"agent-helpbot"` |
| `endpoint` | C -> String | Kernel address |
| `method` | C -> String | Auth method: `"apikey"`, `"oauth"`, `"token"` |
| `token` | C -> option String | Stored credential (encrypted at rest) |
| `expiresAt` | C -> option String | Token expiration timestamp |
| `status` | C -> String | `"valid"`, `"expired"`, `"unset"` |

#### Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `create` | ok, duplicate | Create a named profile with endpoint and auth method. |
| `store` | ok, notfound | Store a credential (token) after an auth flow completes. Sets status to `"valid"`. |
| `load` | ok, notfound, expired | Retrieve the token and endpoint for Connection/connect. Returns `expired` if past expiresAt. |
| `refresh` | ok, notfound, error | Trigger credential refresh (e.g., OAuth token refresh). Updates token and expiresAt. |
| `remove` | ok, notfound | Delete a profile and its stored credential. |
| `list` | ok | All profiles with name, endpoint, method, status (never exposes token). |

#### Operational Principle

A user or agent creates a profile (`clef auth add staging --endpoint wss://staging.example.com --method oauth`), authenticates (`clef auth login staging` → opens browser → OAuth callback → `store`), and then connects (`clef connect staging` → `load` → `Connection/connect`). Multiple profiles enable switching between environments. Expired credentials trigger re-authentication.

#### Invariants

- Profile names are unique
- `list` never returns token values
- A profile with `status = "unset"` has no token stored

---

## 4. Modified Concepts

### 4.1 Binding — New Action: writeField

**Existing state used**: `signalMap: B -> String` (JSON mapping field names to signal IDs, already part of Binding).

| Action | Variants | Description |
|--------|----------|-------------|
| `writeField` | ok, notfound, invalid | Resolve `field` name to its signal ID via the Binding's own `signalMap`, then write `value` to that signal. Returns `notfound` if the field doesn't exist in the signal map. Returns `invalid` if the value doesn't match the field's type. |

**Why this belongs on Binding**: Binding already owns the signalMap that maps field names to signal IDs. This action uses only Binding's own state for the lookup. The actual signal write is a completion that triggers a sync to Signal/write — Binding doesn't import or depend on Signal directly.

---

## 5. Pilot — Derived Concept

### 5.1 Purpose

Provide a unified agent interface over a running Surface application, composing navigation, page inspection, widget interaction, and data operations into a coherent session.

### 5.2 Composition

```
derived Pilot
  composes Navigator, DestinationCatalog, Host, Shell,
           Machine, PageMap, Binding, View
```

### 5.3 Surface Actions (Entry Points / Triggers)

| Action | Maps to | Description |
|--------|---------|-------------|
| `navigate` | Navigator/go | Navigate to a destination by name or href. Syncs handle Host mount chain. Agent can target its own Navigator instance (independent navigation) or the user's instance (drives their screen). |
| `back` | Navigator/back | Go back in navigation history. |
| `forward` | Navigator/forward | Go forward in navigation history. |
| `interact` | Machine/send | Send an FSM event to a machine identified by PageMap label. |
| `fill` | Binding/writeField | Write a value to a form field, resolved by PageMap label + field name. |
| `submit` | Binding/invoke | Invoke the concept action bound to a form widget. Sync chain collects current signal values and assembles input. |
| `dismiss` | Shell/popOverlay | Dismiss the topmost overlay. |

### 5.4 Surface Queries (Reads)

| Query | Sources | Description |
|-------|---------|-------------|
| `where` | Navigator + Host | Current destination name, href, params, Host status. |
| `destinations` | DestinationCatalog | All destinations with name, href, group, icon. |
| `snapshot` | PageMap | All interactive elements on the current page with labels, roles, FSM states, valid events, concept bindings. |
| `read` | Machine/connect + View/resolve | Read a specific widget's connected props (structure/state) or the View's resolved data (what's displayed). |
| `overlays` | Shell | Current overlay stack. |

### 5.5 Syncs

#### Required — Core Pipeline

| Sync | Trigger | Effect | Purpose |
|------|---------|--------|---------|
| `host-ready-captures-page` | Host/ready -> ok | PageMap/register (for each tracked machine) | Populate PageMap when a page becomes interactive. Joins Machine state with Widget AST metadata to produce labels. |
| `machine-spawn-registers-element` | Machine/spawn -> ok | PageMap/register | Register new widget in PageMap when spawned mid-page (e.g., dialog opened). |
| `machine-send-updates-element` | Machine/send -> ok | PageMap/update | Refresh currentState and validEvents after FSM transition. |
| `host-unmount-clears-page` | Host/unmount -> ok | PageMap/clear | Clear PageMap entries when navigating away. |
| `interact-sends-to-machine` | Pilot/interact | PageMap/find → Machine/send | Resolve label to machine ref, then send event. |
| `fill-writes-field` | Pilot/fill | PageMap/find → Binding/writeField | Resolve label to binding, then write field value. |
| `submit-invokes-action` | Pilot/submit | PageMap/find → Binding/invoke | Resolve label to binding, collect signal values, invoke bound action. |

#### Recommended — Enhanced Experience

| Sync | Trigger | Effect | Purpose |
|------|---------|--------|---------|
| `navigate-waits-for-ready` | Navigator/go -> ok | Observe Host/ready | For agent targets: block the navigate response until Host reaches interactive status. |
| `interact-refreshes-snapshot` | Machine/send -> ok | PageMap/update | Keep snapshot current after interactions. |

### 5.6 Navigator Instance Modes

Pilot takes a Navigator instance (`N`) as a parameter. No special "modes" — Navigator already supports multiple instances with independent state:

| Pattern | Navigator Instance | Effect |
|---------|-------------------|--------|
| **Independent agent** | Agent's own `N` | Agent navigates freely. User's screen unaffected. |
| **Drive user's screen** | User's `N` (read-write) | Agent navigates, user's browser follows. |
| **Observe user** | User's `N` (read-only via auth) | Agent sees where user is, offers contextual help. User navigates normally. |

Read-only vs read-write is enforced by the kernel's existing auth layer (Authorization + AccessControl), not by Navigator or Pilot.

---

## 6. Bind Target Integration

All existing Bind targets get Connection integration. Generated interfaces remain fully typed from concept specs — Connection provides the runtime bridge.

### 6.1 CLI

```bash
# Credential management
clef auth add prod --endpoint wss://app.example.com/kernel --method oauth
clef auth login prod                    # Opens browser, OAuth flow, stores token
clef auth add agent --endpoint wss://app.example.com/kernel --method apikey
clef auth store agent --token sk-abc123 # Store API key directly
clef auth list                          # Show profiles (no tokens)

# Connection
clef connect prod                       # Establish session

# Discovery
clef discover                           # List all concepts
clef describe Task                      # Actions, inputs, variants
clef describe Task/create --full        # Full manifest + syncs + affordances

# Invocation (through generated typed commands)
clef task create --title "New task"      # Generated CLI command, wired through Connection
clef task list --filter status=active

# Surface Pilot
clef pilot navigate tasks               # Go to tasks page
clef pilot snapshot                     # What's on screen
clef pilot interact "Create button" CLICK
clef pilot fill "Create form" title "New task"
clef pilot submit "Create form"
clef pilot where                        # Current page + status
```

### 6.2 MCP

MCP server configuration includes a kernel endpoint. On startup, the server connects via Connection and exposes registered concepts as tools:

```json
{
  "mcpServers": {
    "my-app": {
      "command": "clef",
      "args": ["mcp", "--profile", "prod"],
      "tools": ["task/*", "user/*", "pilot/*"]
    }
  }
}
```

An AI agent gets both backend tools (`task/create`, `task/list`) and Surface Pilot tools (`pilot/navigate`, `pilot/snapshot`, `pilot/interact`, `pilot/fill`) through the same MCP server, over the same Connection.

### 6.3 REST

Generated REST routes invoke actions through Connection. The REST server connects to the kernel on startup:

```
POST /api/task          → Connection/invoke("Task", "create", body)
GET  /api/task          → Connection/invoke("Task", "list", query)
GET  /api/task/:id      → Connection/invoke("Task", "get", {id})
DELETE /api/task/:id    → Connection/invoke("Task", "delete", {id})
```

Route generation from specs unchanged. Runtime wiring goes through Connection.

### 6.4 GraphQL

Generated resolvers invoke through Connection. Subscriptions map to Connection/observe:

```graphql
type Mutation {
  createTask(title: String!): Task    # → Connection/invoke
}
type Subscription {
  taskCompleted: Task                  # → Connection/observe
}
```

---

## 7. Auth Integration

No new auth concepts are needed. The existing identity suite provides the full server-side stack:

| Concern | Existing Concept | How Connection Uses It |
|---------|-----------------|----------------------|
| Credential validation | Authentication | `connect` passes credentials → kernel calls Authentication/authenticate |
| Session lifecycle | Session | Kernel creates Session on connect, validates on each invoke |
| Role-based permissions | Authorization | Roles assigned to agent/user identities, permissions checked per action |
| Per-action access control | AccessControl | `invoke` triggers AccessControl/check(concept, action, session context) |
| Resource-level policies | ResourceGrantPolicy | Fine-grained policies: agent X can Task/list but not Task/delete |

Client-side credential management is handled by the new Credential concept (Section 3.3).

### 7.1 Agent Permission Example

```
# Server-side setup
Authorization/grantPermission(role: "help-agent", permission: "read")
Authorization/grantPermission(role: "help-agent", permission: "pilot.where")
Authorization/grantPermission(role: "help-agent", permission: "pilot.snapshot")
Authorization/assignRole(user: "agent-helpbot", role: "help-agent")

# Client-side
clef auth add helpbot --endpoint wss://app.example.com/kernel --method apikey
clef auth store helpbot --token sk-helpbot-readonly

# Agent connects → can read + observe, cannot write or navigate
```

---

## 8. Architecture

```
┌──────────────────────────────────────────────────────┐
│  Pilot (derived concept)                             │
│  navigate, snapshot, interact, fill, submit           │
│  Composes: Navigator, Host, Shell, Machine,           │
│            PageMap, Binding, View, DestinationCatalog  │
├──────────────────────────────────────────────────────┤
│  Bind Targets                                         │
│  CLI commands, MCP tools, REST routes, GraphQL schema │
│  (generated from concept specs, fully typed)          │
├──────────────────────────────────────────────────────┤
│  Connection                                           │
│  connect, discover, invoke, observe, disconnect       │
│  + Credential (client-side profile/token management)  │
├──────────────────────────────────────────────────────┤
│  Kernel                                               │
│  Concept registry, storage, transport                 │
│  + Identity suite (auth, session, access control)     │
└──────────────────────────────────────────────────────┘
```

---

## 9. Concept Independence Verification

| Principle | Connection | PageMap | Credential |
|-----------|-----------|---------|------------|
| **Independent purpose** | Session with live kernel | Labeled element inventory | Client credential management |
| **Own state** | endpoint, session, registeredConcepts | entries with labels, roles, states | profiles with tokens, endpoints |
| **No concept coupling** | Doesn't import Authentication, Session, or any domain concept | Doesn't import Machine, Widget, or Host | Doesn't import Connection |
| **Sync-only composition** | Auth validated via syncs to identity suite | Populated by syncs on Host/Machine events | `load` output feeds Connection/connect input via syncs |
| **Useful alone** | Generic service client | A11y audit, test harness, dev tools | Multi-environment config manager |

---

## 10. Implementation Sequence

### Phase A: Connection & Credential

- Connection concept spec + handler
- Credential concept spec + handler
- WebSocket transport adapter (primary)
- HTTP transport adapter (fallback)
- CLI `auth` and `connect` commands
- Conformance tests

### Phase B: Bind Target Wiring

- Wire CLI generated commands through Connection/invoke
- Wire MCP server through Connection (connect on startup, tools invoke through it)
- Wire REST generated routes through Connection/invoke
- Wire GraphQL resolvers through Connection/invoke, subscriptions through Connection/observe
- Discovery integration: `clef discover`, `clef describe`

### Phase C: PageMap & Pilot

- PageMap concept spec + handler
- Pilot derived concept spec
- Syncs: host-ready-captures-page, machine-spawn-registers-element, machine-send-updates-element, host-unmount-clears-page
- Syncs: interact-sends-to-machine, fill-writes-field, submit-invokes-action
- Binding/writeField action
- Conformance tests

### Phase D: Pilot Bind Targets

- Generate MCP tools from Pilot (pilot/navigate, pilot/snapshot, etc.)
- Generate CLI commands from Pilot (clef pilot navigate, clef pilot snapshot, etc.)
- Integration tests: AI agent navigates running app via MCP
- Integration tests: CLI operates running app

### Phase E: Enhanced Discovery

- `discover` with `depth: "full"` — requires Score integration
- Sync/affordance/widget metadata in discovery responses
- `clef describe Task/create --full` shows syncs triggered, widgets serving Task, etc.

---

## 11. Open Questions

None currently identified. All design questions resolved during design discussion:

- Session isolation → Navigator already per-instance (`N`), no changes needed
- Widget addressing → PageMap concept, populated by syncs
- Pilot scope → Derived concept composing existing concepts
- Auth → Existing identity suite covers server-side; new Credential concept covers client-side
- Agent permissions → Authorization + AccessControl already support per-action granularity
- Agent read/write on user's Navigator → Just which `N` you point at, auth controls read vs write
