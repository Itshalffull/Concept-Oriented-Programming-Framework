---
name: create-derived-concept
description: Design and create a derived concept — a named composition of existing concepts and syncs that produces emergent behavior without independent state. Use when a meaningful user-facing abstraction (like Trash, Registration, or a TaskBoard) is really a wiring of independent concepts.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<derived-concept-name>"
---

# Create a Derived Concept

Design and create a derived concept named **$ARGUMENTS** — a named composition of existing concepts and syncs with its own purpose, surface, and operational principle, but no independent state.

## What is a Derived Concept?

Daniel Jackson's work shows that concept compositions create emergent abstractions meaningful to users but without independent state. Facebook's "Like" is really Upvote + Recommendation + Reaction + Profile wired through syncs. The Mac Trash is Folder + Label with synergistic synchronization. These compositions have names, purposes, and operational principles — but no state of their own.

A derived concept names these compositions, giving them:
- A **purpose** (the emergent purpose of the composition)
- A **surface** (actions and queries exposed to users)
- An **operational principle** (archetypal scenario)
- A **boundary** (which syncs are "inside" the derived concept)

### What a Derived Concept Is and Isn't

**Is:**
- A named composition of existing concepts (or other derived concepts) + specific syncs
- A first-class node in Score's static dependency graphs and runtime flow traces
- A semantically motivated grouping for Bind's interface generation
- A declared boundary: only the syncs it claims are "inside"

**Isn't:**
- A concept (deliberately fails the concept test — no independent state)
- A thing with its own handler implementations or storage
- A suite (suites are organizational packaging; derived concepts are semantic composition)

## Step-by-Step Design Process

### Step 1: Identify the Composition

Ask: "What user-facing abstraction am I building?" The answer should be a noun that users understand — Trash, Registration, TaskBoard, SearchableContent.

Then ask: "Which independent concepts participate in this abstraction?"

List them:
```
Trash:
  - Folder [T]  (provides move/organize)
  - Label [T]   (provides tagging/filtering)
```

**Key test:** Each composed concept must pass the standard concept test independently. If it doesn't exist yet, create it first with `/create-concept`.

### Step 2: Identify the Syncs

Ask: "Which sync files wire these concepts together for this specific purpose?"

Only list syncs that are semantically *inside* the derived concept's boundary. If a sync is triggered by this composition but serves a different purpose (e.g., search indexing, audit logging), it's *outside*.

```
Inside Trash:    trash-delete, trash-restore, trash-empty
Outside Trash:   search-index-update, audit-log-record
```

The boundary determines derivedContext propagation — tags only flow through syncs claimed by the derived concept.

### Step 3: Design the Surface

The surface is the user-facing API of the derived concept. Two kinds:

**Actions** — entry points that match on invocation input fields:
```
action moveToTrash(item: T) {
  matches: Folder/move(destination: "trash")
}
```

**Queries** — read routes that delegate to a constituent concept:
```
query trashedItems() -> Label/find(label: trashed)
```

For derived-of-derived composition, actions can match on `derivedContext` tags instead:
```
action createTask(task: T) {
  matches: derivedContext "TaskBoard/addTask"
}
```

### Step 4: Write the Purpose

The purpose describes why this composition exists — the emergent value, not the mechanics.

```
purpose {
  Allow users to safely delete items with the ability to recover them
  before permanent removal.
}
```

### Step 5: Write the Operational Principle

The principle is the archetypal scenario written in terms of surface actions and queries:

```
principle {
  after moveToTrash(item: x)
  then trashedItems() includes x
  and  restore(item: x)
  then trashedItems() excludes x
}
```

### Step 6: Check Against Anti-Patterns

- [ ] **Not a concept in disguise:** Does it have independent state? If yes, it should be a concept, not a derived concept.
- [ ] **Not just organizational:** Does it have a purpose and principle? If it's just grouping concepts, use a suite.
- [ ] **Boundary is precise:** Every claimed sync belongs semantically to this composition. No over-claiming.
- [ ] **Surface matches are valid:** Each action's `matches` clause references a real concept/action with correct field names.
- [ ] **Type params unify:** Same letter means same domain across all composed concepts.

### Step 7: Write the .derived File

Use the `/derived-scaffold-gen` skill or write it manually:

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

    query trashedItems() -> Label/find(label: trashed)
  }

  principle {
    after moveToTrash(item: x)
    then trashedItems() includes x
    and  restore(item: x)
    then trashedItems() excludes x
  }
}
```

### Step 8: Validate

```bash
npx vitest run tests/derived-concepts.test.ts
```

Validation checks:
- Entry patterns match real action signatures with correct field names/types
- `derivedContext` match patterns reference surface actions that exist
- Tags propagate through claimed syncs and stop at the boundary
- The composition graph is a DAG (no cycles in derived-of-derived)
- Type parameters used in composes are declared on the derived concept

## Composing Derived Concepts (Hierarchical Derivation)

Derived concepts can compose other derived concepts. Use the `derived` keyword in the composes section:

```
derived ProjectManagement [T] {
  composes {
    derived TaskBoard [T]    // <-- another derived concept
    Timeline [T]
    ResourceAllocation [T]
  }
  ...
}
```

When composing derived concepts:
- Surface actions can match on `derivedContext` tags from the inner derived concept
- derivedContext propagation is hierarchical — each layer controls its own boundary
- The composition graph must be a DAG (no cycles)

See the `/derive-app` skill for the full pattern of building an app as a hierarchy of derived concepts.

## Versioning

No `@version` on `.derived` files — derived concepts have no state to migrate.

- **In a kit:** Kit semver covers breaking changes to surface declarations
- **App-level:** `clef check` validates all references at compile time

## Bind Integration

Derived concepts map naturally to interface groupings:
- Actions become endpoints (POST /trash/{item})
- Queries become read routes (GET /trash/items)
- In REST: a **resource**. In GraphQL: a **namespace**. In CLI: a **subcommand group**. In MCP: a **tool group**.

## Score Integration

Derived concepts appear as composite nodes in concept dependency graphs:
- **Impact analysis:** "If I change Label, which derived concepts are affected?"
- **Concept maps:** Composite nodes, zoomable to see constituents
- **Runtime traces:** Steps grouped under derivedContext tags with hierarchical nesting

## Quick Reference

| Section | Purpose |
|---------|---------|
| `purpose` | Why this composition exists (prose) |
| `composes` | Which concepts participate (with optional `derived` keyword) |
| `syncs` | Which .sync files are "inside" the boundary |
| `surface action` | Entry point matching on invocation input fields |
| `surface query` | Read route delegating to a constituent concept |
| `principle` | Operational principle in terms of surface actions/queries |

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Create the independent concepts that a derived concept composes |
| `/create-sync` | Write the sync rules claimed by a derived concept |
| `/derive-app` | Build an entire app as a hierarchy of derived concepts |
| `/decompose-feature` | Decompose a feature into concepts — then identify derived compositions |
| `/derived-scaffold-gen` | Generate a .derived file scaffold from configuration |
