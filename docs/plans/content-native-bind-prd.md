# Content-Native Bind

## Problem

Bind generates external interfaces (REST, GraphQL, CLI, MCP, SDK skills) from concept specs. Each generated binding maps directly to a concept action — `POST /canvas/create`, `canvas.create(...)`, `Canvas/create` tool. But in Clef Base's content-native architecture, every entity lives in the content pool as a ContentNode with a schema overlay. A client calling `Canvas/create` directly bypasses the content pool and creates an orphaned Canvas record.

We added a bidirectional sync (`ConceptCreateMaterializesContentNode`) that catches direct concept calls and materializes ContentNodes after-the-fact. This works as a safety net but isn't ideal:

- The caller sees two variants (concept's ok + sync's follow-up create) in the flow trace — confusing.
- The concept handler writes to its own storage unnecessarily; the content pool is the source of truth.
- Authorization, versioning, provenance, and multi-tenancy all key on ContentNode; calling concept handlers directly skips those hooks.
- Content-native concepts like Workflow have no "create" semantics independent of their content — defineState/addTransition are mutations on existing workflow content, not creation primitives.

## Design

**Content-Native Bind** generates interfaces that route every entity operation through the content pool. For schema-backed concepts:

- `POST /canvas` → `ContentNode/createWithSchema { schema: 'Canvas', ... }`
- `GET /canvas/:id` → `ContentNode/get { node: 'canvas:' + id }`
- `PATCH /canvas/:id` → `ContentNode/update { node, content }`
- `DELETE /canvas/:id` → `ContentNode/remove { node }`
- `GET /canvas` → `ContentNode/listBySchema { schema: 'Canvas' }`

Concept-specific action endpoints remain for domain mutations:
- `POST /workflow/:id/transition` → `Workflow/addTransition { workflow, ... }` (domain-specific, operates on existing workflow content)

For non-content-native concepts (infrastructure like RuntimeRegistry, ScoreApi), generated bindings stay as-is.

### Per-Target Adaptations

- **REST**: resource URLs use schema names as collection paths. CRUD maps to content pool. Domain actions stay as concept endpoints.
- **GraphQL**: root types mirror schemas; mutations route through content pool.
- **CLI**: `clef create canvas "My Map"` hits ContentNode/createWithSchema; `clef canvas:transition ...` hits concept action.
- **MCP**: tools named after content entities use ContentNode actions; tools named after concept domain logic keep concept actions.
- **SDK skills**: methods generated per schema + per non-CRUD concept action.

### Manifest

`interface.yaml` gets a new field per target: `contentNative: true|false`. When true, the generator emits CRUD bindings through ContentNode; when false (default for infra concepts), direct concept dispatch.

### Implementation Strategy

1. Identify content-native concepts: those with a registered schema whose `type` matches the concept name.
2. Generator per target: when emitting CRUD bindings for a content-native concept, rewrite the target concept/action pair to `ContentNode/createWithSchema|get|update|remove|listBySchema` with `schema` set to the concept name.
3. Keep non-CRUD concept actions as-is — they're domain logic, not entity lifecycle.
4. Generated code includes a small runtime shim that constructs the correct ContentNode payload from the user-facing request shape.

## Deliverables

| Deliverable | Agent | Blocked by |
|---|---|---|
| CNB-1: `contentNative` target flag in interface.yaml schema | interface-scaffold-gen | — |
| CNB-2: Helper that enumerates content-native concepts at generation time | general-purpose | CNB-1 |
| CNB-3: REST target rewrite for content-native concepts | general-purpose | CNB-2 |
| CNB-4: GraphQL target rewrite | general-purpose | CNB-2 |
| CNB-5: CLI target rewrite | general-purpose | CNB-2 |
| CNB-6: MCP target rewrite | general-purpose | CNB-2 |
| CNB-7: Skills target rewrite | general-purpose | CNB-2 |
| CNB-8: Regenerate all existing bindings with new flag, verify no regressions | general-purpose | CNB-3..7 |

## Kanban Table

| Card | Subject | Status | Commit |
|------|---------|--------|--------|
| CNB-1 | interface.yaml contentNative flag | done | 8af267f3 |
| CNB-2 | content-native concept enumeration helper | done | 45318631 |
| CNB-3 | REST target rewrite | done | d57da518 |
| CNB-4 | GraphQL target rewrite | done | d68a2515 |
| CNB-5 | CLI target rewrite | done | 68d25866 |
| CNB-6 | MCP target rewrite | done | b221e2e9 |
| CNB-7 | Skills target rewrite | done | PENDING-CNB7 |
| CNB-8 | Regenerate + verify | pending | — |
