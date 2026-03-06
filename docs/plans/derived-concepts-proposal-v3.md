# Derived Concepts in Clef — Proposal v3

## The Idea

Daniel Jackson's work repeatedly shows that concept compositions create emergent abstractions that are meaningful to users but don't have independent state. Facebook's "Like" is really Upvote + Recommendation + Reaction + Profile wired through syncs. The Mac Trash is Folder + Label with synergistic synchronization. Yellkey is Shorthand + ExpiringResource. These compositions have names, purposes, and operational principles — but no state of their own.

Clef currently has no formal way to name these compositions. Suites group related concepts organizationally, but a suite is a *bag of parts*, not a *semantic whole*. A derived concept is the inverse: a named whole whose behavior emerges entirely from its constituent concepts and their syncs.

## What a Derived Concept Is (and Isn't)

**Is:**
- A named composition of existing concepts (or other derived concepts) + specific syncs
- Has a purpose (the emergent purpose of the composition)
- Has an operational principle (the archetypal scenario)
- Has a surface — actions (entry patterns) and queries (read routes)
- A first-class node in Score's static dependency graphs AND runtime flow traces
- A semantically motivated grouping for Bind's interface generation
- A declared boundary: only the syncs it claims are "inside" the derived concept

**Isn't:**
- A concept that passes the standard concept test (deliberately fails — no independent state)
- A thing with its own handler implementations or storage
- A runtime participant that dispatches actions or emits completions
- A suite (suites are organizational packaging; derived concepts are semantic composition)

## File Format: `.derived`

```
derived Trash [T] {

  purpose {
    Allow users to safely delete items with the ability to recover them
    before permanent removal.
  }

  composes {
    Folder [T]
    Label [T]
  }

  syncs {
    required: [trash-delete, trash-restore, trash-empty]
  }

  surface {
    action moveToTrash(item: T) {
      matches: Folder/move(destination: "trash")
    }

    action restore(item: T) {
      matches: Folder/move(source: "trash")
    }

    action empty() {
      matches: Label/bulkRemove(label: "trashed")
    }

    query trashedItems() -> Label/find(label: "trashed")
    query trashedAt(item: T) -> Label/getMetadata(item: item, label: "trashed")
  }

  principle {
    after moveToTrash(item: x)
    then trashedItems() includes x
    and  restore(item: x)
    then trashedItems() excludes x
  }
}
```

### Section semantics

**`purpose`** — Why this composition exists, in prose.

**`composes`** — Which concepts (or derived concepts) participate. Type parameters on the derived concept are shared across constituents — same letter means same domain. No unify blocks or param mapping needed.

**`syncs`** — Which `.sync` files are "inside" this derived concept. This defines the runtime boundary. `derivedContext` tags propagate through these syncs and stop at syncs not listed here.

**`surface`** — The user-facing interface. Two kinds of declaration:
- **`action`** — Generates an `on_invoke` annotation sync. Participates in Score runtime traces. Entry pattern matches on invocation input fields.
- **`query`** — Static read route for Bind. Appears in Score's static graph. No runtime machinery — just declares which constituent concept query to call.

**`principle`** — Operational principle of the composition. Written in terms of surface actions and queries. Used by ContractTest to generate integration tests.

### Composing derived concepts

Derived concepts can compose other derived concepts. The `composes` section uses the `derived` keyword to distinguish:

```
derived TaskBoard [T] {

  purpose {
    Organize tasks into columns with drag-and-drop reordering.
  }

  composes {
    Task [T]
    Column [T]
    DragDrop [T]
  }

  syncs {
    required: [task-column-assignment, drag-reorder]
  }

  surface {
    action addTask(task: T) {
      matches: Task/create
    }

    action moveTask(task: T, column: T) {
      matches: DragDrop/drop
    }
  }

  principle {
    after addTask(task: x)
    then task x appears in default column
    and  moveTask(task: x, column: c)
    then task x appears in column c
  }
}

derived ProjectManagement [T] {

  purpose {
    Coordinate task tracking, scheduling, and resource allocation
    for project delivery.
  }

  composes {
    derived TaskBoard [T]
    Timeline [T]
    ResourceAllocation [T]
  }

  syncs {
    required: [task-timeline-sync, resource-task-binding]
  }

  surface {
    action createTask(task: T) {
      matches: derivedContext "TaskBoard/addTask"
    }

    action scheduleTask(task: T, start: DateTime, end: DateTime) {
      matches: Timeline/schedule
    }

    action assignResource(task: T, resource: T) {
      matches: ResourceAllocation/assign
    }
  }

  principle {
    after createTask(task: x) and scheduleTask(task: x, start: s, end: e)
    then task x appears on timeline between s and e
    and  assignResource(task: x, resource: r)
    then resource r's availability reflects the assignment
  }
}
```

Entry patterns at higher levels can match on `derivedContext` tags rather than primitive actions. ProjectManagement says `matches: derivedContext "TaskBoard/addTask"` — it doesn't need to know that TaskBoard's entry point is ultimately `Task/create`. If TaskBoard's internals change, ProjectManagement's match still works as long as TaskBoard still produces the `TaskBoard/addTask` tag.

## Runtime Model

### Annotation Syncs

Derived concepts participate in runtime through **annotation syncs** — auto-generated from the surface action declarations. Annotation syncs use `on_invoke` (matching invocation input fields) rather than `when` (matching completion output fields).

Generated from the Trash example:

```
sync Trash_moveToTrash_context [eager]
on_invoke {
  Folder/move: [ destination: "trash" ]
}
annotate {
  derivedContext: "Trash/moveToTrash"
}

sync Trash_restore_context [eager]
on_invoke {
  Folder/move: [ source: "trash" ]
}
annotate {
  derivedContext: "Trash/restore"
}

sync Trash_empty_context [eager]
on_invoke {
  Label/bulkRemove: [ label: "trashed" ]
}
annotate {
  derivedContext: "Trash/empty"
}
```

For derived-of-derived composition, annotation syncs match on `derivedContext` instead of invocation fields:

```
sync ProjectManagement_createTask_context [eager]
on_invoke {
  derivedContext: "TaskBoard/addTask"
}
annotate {
  derivedContext: "ProjectManagement/createTask"
}
```

### Evaluation Order

1. **Invocation arrives** (e.g., `Folder/move(item: x, destination: "trash")`)
2. **Annotation round 1:** `on_invoke` syncs matching on invocation input fields fire. Trash's annotation sync matches `destination: "trash"` and tags the flow with `Trash/moveToTrash`.
3. **Annotation round 2+:** `on_invoke` syncs matching on `derivedContext` tags fire. ProjectManagement's annotation sync sees `TaskBoard/addTask` (if present) and adds its tag. Continue until no new tags (fixed-point).
4. **Dispatch:** Invocation dispatched to handler with full `derivedContext` stack.
5. **Completion returns.**
6. **Normal syncs evaluate** (`when`/`where`/`then`), producing new invocations.
7. **New invocations enter at step 1,** inheriting `derivedContext` from the parent flow — but only if the sync that produced them is claimed by a derived concept in the current flow (see Scoped Propagation below).

### Scoped Propagation

`derivedContext` tags do not blindly inherit from parent to child. Propagation is scoped to the derived concept's declared boundary:

- When a sync produces a new invocation, the engine checks: does any active derived concept in this flow claim this sync?
- **If yes:** the new invocation inherits the `derivedContext` tag(s) of the claiming derived concept(s).
- **If no:** the new invocation does NOT inherit the tag. It's outside the derived concept's boundary.

Example: `Folder/move → ok` triggers both `trash-delete.sync` (inside Trash) and `search-index-update.sync` (outside Trash).

- `Label/apply` (produced by trash-delete.sync) carries `Trash/moveToTrash` — trash-delete is in Trash's syncs list.
- `SearchIndex/update` (produced by search-index-update.sync) does NOT carry `Trash/moveToTrash` — search-index-update is not in Trash's syncs list.

The engine maintains an index: for each sync, which derived concepts claim it. This index is built at compile time from `.derived` files.

A single sync can be claimed by multiple derived concepts. If `trash-delete.sync` is claimed by both Trash and FileLifecycle, invocations it produces carry both tags.

### Hierarchical Scoping

Each layer of derived concept composition controls its own boundary. ProjectManagement's tags propagate through syncs that ProjectManagement claims (`task-timeline-sync`, `resource-task-binding`). TaskBoard's tags propagate through syncs that TaskBoard claims (`task-column-assignment`, `drag-reorder`). They don't interfere.

Score renders this as nested groupings:

```
ProjectManagement/createTask
  └── TaskBoard/addTask
        ├── Task/create → ok
        ├── Column/assign → ok          (via task-column-assignment — inside TaskBoard)
        └── DragDrop/register → ok      (via drag-reorder — inside TaskBoard)
  Timeline/schedule → ok                (via task-timeline-sync — inside ProjectManagement)
SearchIndex/update → ok                 (outside all derived concepts)
```

## Engine Changes

Five additions to the sync engine:

### 1. `on_invoke` clause type

Annotation syncs match on invocation input fields, not completion output fields. Fires when an invocation is received, before dispatch to handler.

### 2. `annotate` clause type

Sets `derivedContext` flow metadata instead of invoking actions. Auto-generated from `.derived` surface action declarations.

### 3. `derivedContext` as a matchable field

`on_invoke` clauses can match on `derivedContext` presence in addition to invocation input fields. Used for derived-of-derived composition.

### 4. Multi-round annotation evaluation

After invocation-level annotation syncs fire, the engine re-evaluates annotation syncs that match on `derivedContext` tags until the tag set stabilizes (fixed-point). Terminates because the composition graph is a DAG.

### 5. Scoped `derivedContext` propagation

When a sync produces a new invocation, the engine consults the sync-to-derived-concept index. Tags propagate only through syncs claimed by a derived concept. The index is built at compile time from `.derived` files.

## Score Integration

### Static Analysis

Derived concepts are composite nodes in the concept dependency graph:

```
derived Trash
  ├── composes: Folder, Label
  ├── syncs: trash-delete, trash-restore, trash-empty
  ├── surface actions: moveToTrash, restore, empty
  └── surface queries: trashedItems, trashedAt
```

Enables:
- **Impact analysis:** "If I change Label, which derived concepts are affected?" → Trash
- **Concept maps:** Derived concepts render as composite nodes, zoomable to see constituents
- **Completeness checking:** All declared syncs exist, surface patterns match real actions, type params unify
- **Overlap detection:** Two derived concepts composing the same concepts with overlapping syncs
- **Query edges:** Surface queries create read-dependency edges to constituent concepts

### Runtime Traces

FlowTrace groups steps under derived concept nodes using `derivedContext` tags. Scoped propagation ensures only relevant steps are grouped:

```
Trash/moveToTrash
  ├── Folder/move → ok
  └── Label/apply → ok          (via trash-delete.sync — inside Trash)
AuditLog/record → ok            (via audit-log.sync — outside Trash)
```

Hierarchical composition produces nested groups, zoomable at each level.

## Bind Integration

Derived concepts provide semantically motivated API groupings. The surface section gives Bind:
- **Actions** as endpoints (POST /trash/{item}, DELETE /trash, etc.)
- **Queries** as read routes (GET /trash/items, GET /trash/{item}/metadata)
- **Purpose and principle** for generated documentation

A derived concept in Bind becomes a **resource** in REST, a **namespace** in GraphQL, a **subcommand group** in CLI, a **tool group** in MCP.

```yaml
# interface.yaml
derived:
  - ProjectManagement
  - Trash
```

Bind reads surface queries as routing instructions: `GET /trash/items` calls `Label/find(label: "trashed")` directly. No annotation sync needed for reads.

## Versioning

**No `@version` on `.derived` files.** Derived concepts have no state to migrate.

- **In a suite:** Suite semver covers breaking changes to surface declarations. Major bump for removed/renamed surface actions. Minor bump for new surface actions. Patch for internal entry pattern changes that don't affect the surface.
- **App-level (no suite):** `clef check` validates all references. If a surface action name changes and a composing derived concept matches on its `derivedContext` tag, `clef check` catches the broken reference at compile time.
- **Deprecation:** Use the existing Annotation concept from the interface suite to mark surface actions as deprecated.

## Concept Library Tracking

Derived concepts are tracked separately from primitive concepts. The library description becomes:

> "54 concepts and N derived concepts across M suites."

In the reference doc, each suite section lists primitive concepts in the main table and derived concepts in a separate subsection underneath.

## Suites Relationship: Two-Tier Model

Suites (suites) are organizational packaging — dependency management, versioning, distribution. Derived concepts are semantic composition — naming, analysis, interface generation. They're orthogonal.

- A suite can export both primitive concepts and derived concepts.
- Derived concepts can compose concepts from multiple suites.
- The suite handles logistics; the derived concept handles meaning.

## Testing

### Principle Tests (ContractTest extension)

ContractTest reads `.derived` files and generates integration tests from principle sections. The principle's `after` clause becomes the test action, `then` becomes the assertion, `and` chains steps.

Generated test for Trash:

```typescript
test("Trash operational principle", async () => {
  const flow = await invoke("Folder", "move", { item: "doc-1", destination: "trash" });
  await waitForSyncChain(flow);
  
  const trashed = await query("Label", "find", { label: "trashed" });
  expect(trashed).toContain("doc-1");
  
  const flow2 = await invoke("Folder", "move", { item: "doc-1", source: "trash" });
  await waitForSyncChain(flow2);
  
  const trashedAfter = await query("Label", "find", { label: "trashed" });
  expect(trashedAfter).not.toContain("doc-1");
});
```

### Annotation Tests (`clef check` extension)

`clef check` validates derived concept machinery:
- Entry patterns match real action signatures with correct field names/types
- `derivedContext` match patterns reference surface actions that exist
- Tags propagate through claimed syncs and stop at the boundary
- The composition graph is a DAG (no cycles in derived-of-derived)

No new test concept needed. ContractTest extends for principles, `clef check` extends for annotation correctness and boundary validation.

## Concept Test

The concept test is not weakened. Derived concepts are a **different kind of entity** — pass-by-composition rather than pass-by-independence. The `.derived` file extension makes this distinction syntactically clear. The concept test remains binary: does it have independent state, meaningful actions with domain-specific variants, and operational principles that compose via syncs? If yes, it's a concept. If no, it might be a derived concept (if it's a named composition) or pre-conceptual infrastructure (if it's not).

## Implementation Phases

### Phase 1: File format + static analysis
- Define `.derived` grammar
- Add `DerivedAST` to kernel type system
- Parser: parse `.derived` files, validate references, check DAG property
- Score: add derived concepts as composite nodes in concept graph (static only)
- `clef check`: validate composition references, surface action patterns, type param unification

### Phase 2: Annotation syncs + runtime tagging
- Add `on_invoke` clause type to sync grammar and compiler
- Add `annotate` clause type to sync grammar and compiler
- Add `derivedContext` field to `ActionInvocation`
- Build sync-to-derived-concept index at compile time
- Engine: evaluate `on_invoke` annotation syncs on invocation arrival
- Engine: scoped `derivedContext` propagation through claimed syncs only
- Auto-generate annotation syncs from `.derived` surface action declarations
- FlowTrace: group steps by `derivedContext` tags

### Phase 3: Hierarchical composition
- `on_invoke` clauses can match on `derivedContext` field
- Engine: multi-round annotation evaluation with fixed-point termination
- `derivedContext` becomes a stack (ordered list of tags)
- Compile-time DAG validation for derived-of-derived composition

### Phase 4: Bind integration
- Interface manifests reference derived concepts
- Surface actions become endpoints/commands/tools
- Surface queries become read routes
- Purpose and principle feed into generated documentation
- Grouping concept defers to derived concepts when available

### Phase 5: Testing
- ContractTest reads `.derived` principle sections and generates integration tests
- `clef check` extended with annotation correctness and boundary validation

## Concrete Examples from Existing Clef

### Registration (from app concepts)
```
derived Registration [U] {
  purpose {
    Allow new users to create accounts with secure credentials
    and receive an authentication token.
  }

  composes {
    User [U]
    Password [U]
    JWT [U]
    Profile [U]
  }

  syncs {
    required: [registration-flow, login-flow, token-generation]
  }

  surface {
    action register(username: String, password: String, email: String) {
      matches: User/register
    }

    action login(username: String, password: String) {
      matches: Password/check
    }

    query currentUser(token: String) -> JWT/verify(token: token)
    query profile(user: U) -> Profile/get(user: user)
  }

  principle {
    after register(username: "alice", password: "s3cret", email: "a@b.com")
    then login(username: "alice", password: "s3cret") succeeds
    and  currentUser(token: t) returns user alice
  }
}
```

### IncrementalBuild (from generation suite)
```
derived IncrementalBuild [R] {
  purpose {
    Rebuild only what changed since the last generation run.
  }

  composes {
    Resource [R]
    BuildCache [R]
    GenerationPlan [R]
    Emitter [R]
  }

  syncs {
    required: [incremental-generation-pipeline, cache-invalidation]
  }

  surface {
    action build(sources: list String) {
      matches: Resource/upsert
    }

    query changed() -> Resource/changed
    query plan() -> GenerationPlan/current
  }

  principle {
    after build(sources: ["a.concept"])
    then changed() reflects content changes since last build
    and  only changed sources trigger generation steps
  }
}
```

### SemanticWidgetSelection (from Clef Surface)
```
derived SemanticWidgetSelection [I] {
  purpose {
    Automatically select the best widget for a field based on
    its interaction semantics and runtime context.
  }

  composes {
    Interactor [I]
    Affordance [I]
    WidgetResolver [I]
  }

  syncs {
    required: [classify-then-resolve]
  }

  surface {
    action resolve(field: I, context: String) {
      matches: WidgetResolver/resolve
    }

    query candidates(field: I) -> Affordance/match(field: field)
    query classification(field: I) -> Interactor/classify(field: field)
  }

  principle {
    after resolve(field: f, context: "mobile")
    then the resolved widget satisfies all affordance constraints
    and  the interactor classification matches the field's semantic type
  }
}
```

### App-Level Composition
```
derived ToolForThought [T] {
  purpose {
    A personal knowledge management environment combining
    structured content, linked references, and incremental computation.
  }

  composes {
    derived Registration [T]
    derived IncrementalBuild [T]
    ContentNode [T]
    Canvas [T]
    Reference [T]
    Backlink [T]
    Formula [T]
    DailyNote [T]
    SearchIndex [T]
  }

  syncs {
    required: [
      bidirectional-links,
      formula-recompute,
      daily-note-creation,
      content-search-indexing
    ]
  }

  surface {
    action createPage(title: String) {
      matches: ContentNode/create
    }

    action linkTo(source: T, target: T) {
      matches: Reference/addRef
    }

    action openDaily() {
      matches: DailyNote/open
    }

    query backlinks(node: T) -> Backlink/getBacklinks(target: node)
    query search(q: String) -> SearchIndex/search(query: q)
  }

  principle {
    after createPage(title: "Ideas") and linkTo(source: ideas, target: projects)
    then backlinks(node: projects) includes ideas
    and  search(q: "Ideas") returns the Ideas page
  }
}
```
