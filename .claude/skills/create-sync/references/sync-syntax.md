# Sync Syntax Reference

Complete formal grammar for `.sync` files, with examples for every construct.

## Formal Grammar

```
SyncFile        = (SyncDecl NL)*

SyncDecl        = "sync" Name Annotation* NL
                  WhenClause
                  WhereClause?
                  ThenClause

Annotation      = "[" AnnotationName "]"
AnnotationName  = "eager" | "eventual" | "local" | "idempotent"
                | "required" | "recommended"

WhenClause      = "when" "{" NL
                  (ActionMatch NL)+
                  "}" NL

ActionMatch     = ConceptAction ":" "[" FieldPattern* "]"
                  "=>" "[" FieldPattern* "]"

ConceptAction   = ConceptName "/" ActionName
                | Runtime "." ConceptName "/" ActionName

FieldPattern    = Name ":" (Literal | Variable | "_") ";"?
Variable        = "?" Name
Literal         = StringLit | IntLit | FloatLit | BoolLit

WhereClause     = "where" "{" NL
                  (WhereExpr NL)+
                  "}" NL

WhereExpr       = BindExpr | ConceptQuery | FilterExpr

BindExpr        = "bind" "(" Expr "as" Variable ")"
ConceptQuery    = ConceptName ":" "{" QueryPattern "}"
FilterExpr      = "filter" "(" BoolExpr ")"

QueryPattern    = Variable (Name ":" (Variable | Literal))* ";"?

ThenClause      = "then" "{" NL
                  (ActionInvoke NL)+
                  "}" NL

ActionInvoke    = ConceptAction ":" "[" FieldAssign* "]"
FieldAssign     = Name ":" (Literal | Variable | NestedObj) ";"?
NestedObj       = "[" FieldAssign* "]"
                | "{" (Name ":" (Literal | TemplateVar | NestedObj) ";"?)* "}"
TemplateVar     = "{{" Name "}}"
```

## Comments

Two styles, both supported anywhere:

```
// Line comment (C-style)
# Line comment (shell-style)
```

Comments are ignored by the parser.

## Sync Declaration

```
sync SyncName [annotation1] [annotation2]
when { ... }
where { ... }    // optional
then { ... }
```

- **Name**: PascalCase identifier. Must be unique within the application.
- **Annotations**: Zero or more bracketed keywords.
- **When**: Required. At least one action pattern.
- **Where**: Optional. Zero or more bind/query/filter expressions.
- **Then**: Required. At least one action invocation.

## Annotations

| Annotation | Purpose | Default? |
|------------|---------|----------|
| `[eager]` | Synchronous evaluation. All concepts must be available. | Yes (implicit) |
| `[eventual]` | Deferred. Queued if concepts unavailable, retried on availability. | No |
| `[local]` | Same runtime only. Used for latency-sensitive or offline-capable flows. | No |
| `[idempotent]` | Safe to re-execute. Engine may retry without side-effect concerns. | No |
| `[required]` | Kit tier: removal causes data corruption. Can't override/disable. | No (kit syncs only) |
| `[recommended]` | Kit tier: useful default, overridable/disableable by apps. | No (kit syncs only) |

Multiple annotations are allowed:

```
sync ReplicateProfile [eventual] [idempotent]
```

## When Clause

### Action Match Pattern

```
Concept/action: [ input-patterns ] => [ output-patterns ]
```

**Left side** (before `=>`): Matches against the action's **invocation** arguments.
**Right side** (after `=>`): Matches against the action's **completion** result.

### Field Patterns

| Syntax | Meaning | Binds? | Example |
|--------|---------|--------|---------|
| `?name` | Variable — binds field value | Yes | `email: ?email` |
| `"string"` | String literal — exact match | No | `method: "login"` |
| `123` | Integer literal — exact match | No | `code: 200` |
| `3.14` | Float literal — exact match | No | `rate: 3.14` |
| `true` / `false` | Boolean literal — exact match | No | `valid: true` |
| `_` | Wildcard — matches anything | No | `extra: _` |

Fields are separated by optional semicolons:

```
[ method: "login"; email: ?email; password: ?password ]
```

### Empty Brackets

- `[]` for input means "don't care about invocation arguments" (match any)
- `=> []` for output means "don't care about completion result" (match any)

```
// Match any JWT/verify completion that has a user in its output
JWT/verify: [] => [ user: ?user ]

// Match any User/register completion (output doesn't matter for triggering)
User/register: [] => []
```

### Multiple Patterns

All patterns must match completions **in the same flow**:

```
when {
  Web/request: [ method: "register" ] => [ request: ?request ]
  User/register: [] => [ user: ?user ]
  Password/set: [] => [ user: ?user ]
  JWT/generate: [] => [ token: ?token ]
}
```

The engine computes the **cross-product** of matching completions and filters for consistent variable bindings. This behaves like a relational join over the flow's action log.

### Runtime-Qualified Concepts

For cross-runtime syncs, prefix with runtime name:

```
when {
  Phone.Profile/update: [] => [ user: ?user; bio: ?bio ]
}
then {
  Server.Profile/replicate: [ user: ?user; bio: ?bio ]
}
```

## Where Clause

### bind()

Generate a value and bind it to a variable:

```
where {
  bind(uuid() as ?article)
  bind(now() as ?timestamp)
}
```

The expression between `bind(` and `as` is evaluated as-is. Special functions:
- `uuid()` — generates a new UUID (most common)
- `now()` — current timestamp
- Any other expression is evaluated by the runtime

### Concept Query

Look up records in a concept's state:

```
where {
  User: { ?user email: ?email; name: ?username }
}
```

- `?user` — the record key (bound from `when` or newly bound from query)
- `email: ?email` — field bindings/filters

**If a variable is already bound** (from `when`), the query filters by that value:

```
when {
  Web/request: [ method: "login"; email: ?email ] => []
}
where {
  // ?email is already bound → query filters for matching email
  User: { ?user email: ?email }
}
```

**If a variable is unbound**, the query binds it from the result:

```
where {
  // ?username is unbound → bound from query result
  User: { ?u name: ?username; email: ?email }
}
```

**Multiple results**: If the query returns N records, the `then` clause executes N times (once per record with different bindings). This is how cascade deletes work:

```
where {
  // Returns all comments targeting this article
  Comment: { ?comment target: ?article }
}
then {
  // Executes once per comment
  Comment/delete: [ comment: ?comment ]
}
```

### filter()

Boolean filter on current bindings:

```
where {
  filter(?count > 0)
}
```

Rarely used — most filtering is done via literal matching in `when` (e.g., `valid: true`).

## Then Clause

### Action Invocation

```
Concept/action: [ field: value; field: value; ... ]
```

### Field Values

| Syntax | Meaning | Example |
|--------|---------|---------|
| `?var` | Bound variable value | `user: ?user` |
| `"string"` | String literal | `error: "Not found"` |
| `123` | Integer literal | `code: 401` |
| `true` / `false` | Boolean literal | `favorited: true` |
| `[ ... ]` | Nested object (bracket syntax) | `body: [ user: [ name: ?name ] ]` |
| `{ ... }` | Nested object (brace syntax) | `record: { type: "log"; concept: ?c }` |

### Nested Objects

Bracket syntax (used for response bodies):

```
then {
  Web/respond: [
    request: ?request;
    body: [
      user: [
        username: ?username;
        email: ?email;
        token: ?token ] ] ]
}
```

Brace syntax with template variables (used for structured data):

```
then {
  ActionLog/append: [ record: { type: "registration"; concept: ?c } ]
}
```

Template variables use `{{name}}` inside brace objects:

```
then {
  Audit/log: [ entry: { user: {{user}}; action: "delete"; target: {{article}} } ]
}
```

### Multiple Actions

```
then {
  Relation/unlink: [ rel: ?rel ]
  Relation/unlink: [ rel: ?rel2 ]
}
```

All actions in `then` are dispatched (they don't depend on each other within the same `then` block).

## Complete Examples

### Minimal Sync

```
sync GenerateToken [eager]
when {
  User/register: [] => [ user: ?user ]
}
then {
  JWT/generate: [ user: ?user ]
}
```

### Full Sync with All Blocks

```
sync RegistrationResponse [eager]
when {
  Web/request: [ method: "register" ] => [ request: ?request ]
  User/register: [] => [ user: ?user ]
  Password/set: [] => [ user: ?user ]
  JWT/generate: [] => [ token: ?token ]
}
where {
  User: { ?u name: ?username; email: ?email }
}
then {
  Web/respond: [
    request: ?request;
    body: [
      user: [
        username: ?username;
        email: ?email;
        token: ?token ] ] ]
}
```

### Eventual Cross-Runtime Sync

```
sync ReplicateProfile [eventual]
when {
  Phone.Profile/update: [] => [ user: ?user; bio: ?bio; image: ?image ]
}
then {
  Server.Profile/replicate: [ user: ?user; bio: ?bio; image: ?image ]
}
```

### Kit Sync with Tier Annotation

```
sync CascadeDeleteFields [required]
when {
  Entity/delete: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  Field: { ?field target: ?entity }
}
then {
  Field/detach: [ field: ?field ]
}
```
