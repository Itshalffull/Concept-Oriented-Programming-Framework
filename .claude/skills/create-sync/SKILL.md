---
name: create-sync
description: Write a COPF synchronization rule that connects two or more concepts through pattern matching on completions, variable bindings, where-clause queries, and action invocations. Use when you need to wire concepts together in a flow.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<sync-name>"
---

# Create a COPF Synchronization

Write a sync rule named **$ARGUMENTS** that connects concepts through completion chaining.

## What is a Sync?

A **synchronization** (sync) is the only coordination mechanism between concepts in COPF. Syncs observe completions from concept actions (`when`), optionally query concept state or generate values (`where`), and invoke actions on other concepts (`then`). Concepts never reference each other directly — syncs are the glue.

```
sync SyncName [eager]
when {
  Concept/action: [ input-fields ] => [ output-fields ]
}
where {
  bind(expr as ?var)
  OtherConcept: { ?key field: ?value }
}
then {
  Target/action: [ field: ?var; field: "literal" ]
}
```

Syncs compose through **completion chaining**: Sync A's `then` invokes an action whose completion triggers Sync B's `when`. This creates flat, independently testable chains — no sync references another sync.

## Step-by-Step Process

### Step 1: Identify the Trigger and Target

Every sync answers: "When **this** happens, do **that**."

- **Trigger**: Which concept action completion(s) should activate this sync?
- **Target**: Which concept action(s) should this sync invoke?

Think in terms of completions, not requests. A sync fires when an action **completes** (returns a result), not when it's invoked.

```
Trigger: JWT/verify completes with [ user: ?user ]
Target:  Article/create with the user as author
```

### Step 2: Identify the Flow Pattern

Read [examples/realworld-syncs.md](examples/realworld-syncs.md) for all common patterns.

Most syncs follow one of these patterns:

| Pattern | When | Where | Then | Example |
|---------|------|-------|------|---------|
| **Auth gate** | Web/request with token | — | JWT/verify | `CreateArticleAuth` |
| **Perform action** | Web/request + auth completion | bind(uuid()) | Concept/create | `PerformCreateArticle` |
| **Success response** | Web/request + action completion | Query for display data | Web/respond with body | `CreateArticleResponse` |
| **Error response** | Web/request + action error output | — | Web/respond with error | `LoginFailure` |
| **Cascade** | Parent/delete completion | Query children | Child/delete | `CascadeDeleteComments` |
| **Side effect** | Any completion | — | Another concept action | `GenerateToken` |
| **Pipeline stage** | Prior stage completion | — | Next stage action | `GenerateTypeScript` |
| **Cross-runtime** | Local completion | — | Remote action | `ReplicateProfile` |

### Step 3: Write the When Clause

Read [references/pattern-matching.md](references/pattern-matching.md) for the full matching system.

The `when` block lists one or more **action completion patterns**. ALL patterns must match within the same flow for the sync to fire.

```
when {
  // Pattern: Concept/action: [ input-fields ] => [ output-fields ]
  Web/request: [ method: "login"; email: ?email; password: ?password ]
    => [ request: ?request ]
  Password/check: [ user: ?user ]
    => [ valid: true ]
}
```

**Field pattern types:**

| Pattern | Meaning | Example |
|---------|---------|---------|
| `?variable` | Bind the field's value to this variable | `email: ?email` |
| `"literal"` | Match exact string value | `method: "login"` |
| `123` / `true` / `false` | Match exact number/boolean | `valid: true` |
| `_` | Match anything (wildcard, no binding) | `extra: _` |
| (omitted) | Don't match on this field at all | — |

**Key rules:**
- Input fields (before `=>`) match against the invocation's arguments
- Output fields (after `=>`) match against the completion's result
- The same variable name in multiple patterns must bind to the same value (consistency)
- Multiple patterns = all must match in the same flow (cross-product join)
- `=> []` means "match any completion output" (don't care about specific fields)

### Step 4: Write the Where Clause (if needed)

Read [references/variable-binding.md](references/variable-binding.md) for the full binding system.

The `where` block is **optional**. Use it when you need to:

1. **Generate a new ID**: `bind(uuid() as ?id)`
2. **Query concept state**: `Concept: { ?key field: ?value }`
3. **Filter bindings**: `filter(expr)`

```
where {
  // Generate a new UUID for the article
  bind(uuid() as ?article)

  // Query User concept state to get display fields
  User: { ?u email: ?email; name: ?username }
}
```

**Concept queries** look up records in a concept's state. If a variable is already bound (from `when`), it acts as a filter. If unbound, it gets bound from the query result. If the query returns multiple records, `then` executes once per record.

### Step 5: Write the Then Clause

The `then` block lists one or more **action invocations**. All variables used must be bound in `when` or `where`.

```
then {
  Article/create: [
    article: ?article;
    title: ?title;
    description: ?desc;
    body: ?body;
    author: ?author ]
}
```

**Field value types:**

| Value | Meaning | Example |
|-------|---------|---------|
| `?variable` | Insert the bound variable's value | `user: ?user` |
| `"literal"` | Insert a string literal | `error: "Not found"` |
| `123` / `true` | Insert a number/boolean literal | `code: 401` |
| `[ ... ]` | Nested object (supports `{{var}}` templates) | `body: [ user: [ name: ?name ] ]` |
| `{ ... }` | Alternate nested object syntax | `record: { type: "log" }` |

### Step 6: Choose Annotations

```
sync SyncName [eager]       // Default: synchronous, all concepts must be available
sync SyncName [eventual]    // Deferred: queued if concepts unavailable, retried on availability
sync SyncName [local]       // Same runtime only (latency-sensitive)
sync SyncName [idempotent]  // Safe to re-execute (engine may retry)
```

| Annotation | When to use |
|------------|-------------|
| `[eager]` | Default. Most syncs. All concepts reachable. |
| `[eventual]` | Cross-runtime syncs where remote may be offline. Queued and retried. |
| `[local]` | Must execute on same runtime (e.g., offline-first mobile). |
| `[idempotent]` | Safe to retry — no side effects beyond the first execution. |

Multiple annotations allowed: `sync MySync [eager] [idempotent]`

For kit syncs, also add tier annotations: `[required]` or `[recommended]`. See the `create-concept-kit` skill.

### Step 7: Place the Sync File

```
syncs/
├── app/           # Application-specific syncs
│   ├── login.sync
│   ├── articles.sync
│   └── social.sync
├── framework/     # Framework syncs (compiler pipeline, etc.)
│   └── compiler-pipeline.sync
```

- Group related syncs in one `.sync` file (e.g., all article CRUD syncs)
- Use `//` or `#` for comments
- Kit syncs go under `kits/<kit-name>/syncs/`
- Multiple syncs per file is normal and encouraged for related flows

### Step 8: Validate

```bash
# Parse and validate all sync files against concept specs
npx tsx tools/copf-cli/src/index.ts compile-syncs

# For kit syncs
npx tsx tools/copf-cli/src/index.ts kit validate kits/<kit-name>
```

The compiler checks:
- Parse validity (syntax)
- `when` has at least one pattern
- `then` has at least one action
- All variables in `then` are bound in `when` or `where`
- Concept/action references exist in loaded specs (advisory warnings)

## Completion Chaining

Syncs compose through completions, not through references. A typical authenticated CRUD flow chains like this:

```
Web/request arrives
  → Auth sync: when Web/request → then JWT/verify
    → JWT/verify completes
      → Perform sync: when Web/request + JWT/verify → then Article/create
        → Article/create completes
          → Response sync: when Web/request + Article/create → then Web/respond
```

Each sync is independent and testable. Inject a synthetic completion → observe the invocations it produces.

**Key principle**: If you find yourself wanting Sync A to "call" Sync B, stop. Instead, have Sync A invoke a concept action whose completion naturally triggers Sync B. The sync engine handles the chaining automatically.

## Design Guidelines

- **One logical step per sync** — don't combine auth + action + response in one sync
- **Name syncs for what they do** — `CreateArticleAuth`, `PerformCreateArticle`, `CreateArticleResponse`
- **Match on completion outputs for branching** — `=> [ valid: true ]` vs `=> [ valid: false ]` for success/error paths
- **Use `bind(uuid())` for new entity IDs** — never hardcode IDs
- **Prefer flat chains** — if a flow has 5 steps, write 5 small syncs, not 1 complex one
- **Group related syncs by file** — all article syncs in `articles.sync`, all login syncs in `login.sync`

## Quick Reference

See [references/sync-syntax.md](references/sync-syntax.md) for the formal grammar.
See [references/pattern-matching.md](references/pattern-matching.md) for when-clause matching rules.
See [references/variable-binding.md](references/variable-binding.md) for variable scoping and binding.
See [examples/realworld-syncs.md](examples/realworld-syncs.md) for all patterns from the RealWorld implementation.
See [templates/sync-scaffold.md](templates/sync-scaffold.md) for copy-paste templates.

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design the concepts that syncs connect |
| `/create-concept-kit` | Bundle concepts and their syncs into a reusable kit |
| `/create-implementation` | Write the implementation that handles actions syncs invoke |
| `/configure-deployment` | Assign syncs to engines in deployment manifests |
