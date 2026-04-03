# .concept File Grammar Reference

The `.concept` file format is parsed by a recursive descent parser at `handlers/ts/framework/parser.ts`. This document describes the complete grammar.

## Top-Level Structure

```
[@version(N)]
[@gate]
[@category("name")]
[@visibility("level")]
concept <Name> [<TypeParam>, ...] {
  purpose { ... }
  state { ... }
  capabilities { ... }     // optional
  actions { ... }
  invariant { ... }         // zero or more

  // Named invariant constructs (alternative to invariant {} blocks):
  example "name" { ... }
  forall "name" { ... }
  always "name" { ... }
  never "name" { ... }
  eventually "name" { ... }

  // Action contracts (Hoare-logic style):
  action <Name> { requires: ... ensures: ... }
}
```

Sections must appear in this order: purpose, state, capabilities (optional), actions, invariant(s). Named invariant constructs and action contracts can appear at the concept body level alongside or instead of `invariant {}` blocks.

## Top-Level Annotations

Annotations appear **before** the `concept` keyword and configure metadata for the concept:

```
@version(2)
@gate
@category("infrastructure")
@visibility("internal")
concept DeploymentValidator [D] {
  ...
}
```

| Annotation | Syntax | Description |
|-----------|--------|-------------|
| `@version(N)` | `@version(1)` | Schema version integer. Can also appear inside the concept body. |
| `@gate` | `@gate` | Marks the concept as using the async gate convention. Sets `annotations.gate = true` on the AST. |
| `@category("name")` | `@category("infrastructure")` | Concept category for grouping (e.g., `"domain"`, `"infrastructure"`, `"framework"`). |
| `@visibility("level")` | `@visibility("internal")` | Concept visibility level (e.g., `"public"`, `"internal"`, `"framework"`). |

Annotations can also appear **inside** the concept body (after the opening `{`), using the same `@name` or `@name(value)` syntax. When placed inside, they apply identically to when placed before `concept`.

## Concept Header

```
concept Password [U] {
```

- **Name**: PascalCase identifier (e.g., `Password`, `SchemaGen`, `DeploymentValidator`)
- **Type parameters**: One or more single uppercase letters in square brackets, comma-separated
- Most concepts use exactly one type parameter

## Purpose Section

```
purpose {
  Securely store and validate user credentials using
  salted hashing. Does not handle reset flows — those
  are composed via synchronization with a token concept.
}
```

- Free-form prose text inside braces
- No special syntax — just descriptive text
- Can span multiple lines and paragraphs
- Should state what the concept is *for*, not how it works

## State Section

```
state {
  articles: set A
  slug: A -> String
  title: A -> String
  body: A -> String
  author: A -> String
  tags: A -> list String
  createdAt: A -> DateTime
  updatedAt: A -> DateTime
}
```

### State Entry Types

| Syntax | Meaning | Example |
|--------|---------|---------|
| `field: Type` | Simple typed field | `records: set R` |
| `field: T -> Type` | Relation from T to Type | `title: A -> String` |
| `field: T -> set Type` | Relation to a set | `following: U -> set String` |
| `field: T -> list Type` | Relation to a list | `tags: A -> list String` |
| `field: T -> option Type` | Relation to optional | `bio: U -> option String` |

### Primitive Types

| Type | Description |
|------|-------------|
| `String` | UTF-8 text |
| `Int` | 64-bit integer |
| `Float` | 64-bit floating point |
| `Bool` | Boolean |
| `Bytes` | Binary data (base64 on wire) |
| `DateTime` | ISO 8601 timestamp |
| `ID` | Opaque identifier |

### Type Expressions

```
TypeExpr =
  | PRIMITIVE              // String, Int, Float, Bool, Bytes, DateTime, ID
  | IDENT                  // Type parameter reference (e.g., U, A, T)
  | "set" TypeExpr         // set String, set U
  | "list" TypeExpr        // list String
  | "option" TypeExpr      // option String
  | TypeExpr "->" TypeExpr // U -> String (relation/map)
  | "{" FieldList "}"      // { path: String, content: String }
  | "{" FieldList "}" "->" TypeExpr  // { id: T, name: String } -> Status
  | "{" EnumValues "}"     // { Active | Inactive | Pending }
  | "{" EnumValues "}" "->" TypeExpr // { Active | Inactive } -> Config
  | STRING_LIT ("|" STRING_LIT)+     // "a" | "b" | "c"
```

Inline records use braces with comma-separated or semicolon-separated fields:
```
outputs: S -> list { path: String, content: String }
```

### Enum Types

The parser supports two enum type syntaxes:

**String literal union** — pipe-separated string literals (can span multiple lines):
```
state {
  status: T -> "draft" | "published" | "archived"
  protocol: T -> "http" | "grpc"
    | "websocket"
    | "mqtt"
}
```

**Identifier union in braces** — pipe-separated identifiers inside braces:
```
state {
  phase: T -> { Active | Inactive | Pending }
}
```

Both produce `{ kind: 'enum', values: [...] }` in the AST.

### Record Types with Arrow Relations

Record types can be followed by an arrow to create a relation from a record key to a value type:

```
state {
  endpoints: { host: String, port: Int } -> Status
  configs: { env: String, region: String } -> { timeout: Int, retries: Int }
}
```

This produces a `{ kind: 'relation', from: { kind: 'record', ... }, to: ... }` type expression.

### State Groups

Fields can be grouped under a name for logical organization:
```
state {
  credentials {
    hash: U -> Bytes
    salt: U -> Bytes
  }
  metadata {
    createdAt: U -> DateTime
    updatedAt: U -> DateTime
  }
}
```

Groups are flattened during parsing — each field gets a `group` property set to the group name in the AST. The field names themselves are preserved as-is (the group name is **not** used as a prefix in the field name).

## Capabilities Section (Optional)

```
capabilities {
  requires crypto
  requires persistent-storage
}
```

- Declares external runtime requirements
- Each line: `requires <capability-name>`
- Most concepts don't need this section
- Used only by Password (requires crypto) in the current codebase

## Actions Section

```
actions {
  action set(user: U, password: String) {
    -> ok(user: U) {
      Generate a random salt. Hash the password with the salt.
      Store both. Return the user reference.
    }
    -> invalid(message: String) {
      If the password does not meet strength requirements,
      return a description of the violation.
    }
  }

  action check(user: U, password: String) {
    -> ok(valid: Bool) {
      Retrieve the salt for the user. Hash the provided
      password with it. Return true if hashes match.
    }
    -> notfound(message: String) {
      If the user has no stored credentials, return an error.
    }
  }
}
```

### Action Structure

```
action <name>(<param>: <Type>, ...) {
  [description { <prose> }]
  -> <variant>(<field>: <Type>, ...) { <prose> }
  -> <variant>(<field>: <Type>, ...) { <prose> }
  [fixture <name> { ... } [after ...] [-> variant]]
}
```

- **Action name**: camelCase verb (e.g., `create`, `get`, `delete`, `register`, `isFollowing`)
- **Parameters**: typed inputs to the action
- **Description block** (optional): free-form prose describing the action, before variants
- **Variants**: the possible return shapes (discriminated union)
- **Prose**: free-form description inside variant braces
- **Fixtures**: named input examples after variants

**CRITICAL: `requires`/`ensures` do NOT go inside action blocks.**
Action blocks contain ONLY: description, variants, and fixtures.
The `requires:` and `ensures:` clauses belong in **action contract blocks**
at concept body level (after the `actions { }` section). See the
"Action Contracts" section below. Placing `requires:` before variants
inside an action block causes a parse error:

```
// WRONG — causes parse error
action define(name: String) {
  requires: name.length > 0     // ← PARSE ERROR
  -> ok(field: F) { ... }
}

// CORRECT — contract at concept body level
action define(name: String) {
  -> ok(field: F) { ... }
  -> error(message: String) { ... }
}

action define {
  requires: name != ""
  ensures ok: field != none
}
```

### Action Description Block

An optional `description { ... }` block can appear at the top of the action body, before any variants. It provides a high-level description of the action separate from the per-variant prose:

```
actions {
  action reconcile(source: String, target: String) {
    description {
      Compare the source and target data stores and produce a
      reconciliation report. Handles both full and incremental modes.
    }
    -> ok(report: R) {
      Reconciliation completed. The report contains all differences found.
    }
    -> error(message: String) {
      Source or target is unreachable or returned invalid data.
    }
  }
}
```

The description is stored on the `ActionDecl` as `description?: string`.

### Variant Naming Conventions

| Variant | When to use | Return fields |
|---------|-------------|---------------|
| `ok` | Success (always first) | Entity ID for mutations, data for queries |
| `notfound` | Entity lookup failed | `message: String` |
| `error` | General failure | `message: String` |
| `invalid` | Validation failed | `message: String` |
| `warning` | Success with issues | Result + `issues: list String` |

**Convention: success is always `ok`.** Domain context comes from the output
fields, not the variant name. Do NOT use domain-specific success names like
`created`, `configured`, `registered`, `updated` — these must all be `ok`.

**Exception — multiple distinct success outcomes.** When an action genuinely
has two or more success branches that syncs need to distinguish, use
domain-specific variant names. Examples:
- Cache lookup: `ok` (hit) vs `miss` (not cached, not an error)
- Merge: `clean` (no conflicts) vs `conflicts` (needs resolution)
- Diff: `identical` (no changes) vs `diffed` (changes found)
- Verification: `valid` vs `invalid` (both are expected outcomes)

### Fixtures

Fixtures are named input examples that serve as test seeds and documentation. They appear inside the action block, after variants:

```
action record(stepKey: String, inputHash: String, outputHash: String, deterministic: Bool) {
  -> ok(entry: S)
  -> error(message: String)
  fixture valid { stepKey: "build:main", inputHash: "abc123", outputHash: "def456", deterministic: true }
  fixture minimal { stepKey: "x", inputHash: "h", outputHash: "o", deterministic: false }
  fixture missingHash { stepKey: "test" } -> error
}
```

**Syntax**: `fixture <name> { <key>: <value>, ... } [after <dep>, <dep>, ...] [-> <variant>]`

- **name**: camelCase identifier describing the scenario
- **input object**: `{ key: value, ... }` with JSON-like values (strings, numbers, booleans, arrays, nested objects)
- **after** (optional): comma-separated list of fixture names that must run first to seed storage. Used when a reader action needs data created by a prior action (e.g., `get` needs `create` to run first). Supports **multiple dependencies**: `after fixture_a, fixture_b`
- **expected variant** (optional): `-> error`, `-> invalid`, etc. Defaults to `ok` if omitted
- Fixtures appear after variants but before the action's closing `}`

**Examples with `after` (multiple dependencies) and output references**:
```
action register(concept: String, sourceFile: String) {
  -> ok(id: H)
  -> error(message: String)
  fixture register_article { concept: "Article", sourceFile: "article.handler.ts" }
  fixture register_user { concept: "User", sourceFile: "user.handler.ts" }
}

action get(entity: H) {
  -> ok(name: String)
  -> notfound(message: String)
  fixture get_article { entity: $register_article.id } after register_article
  fixture get_missing { entity: "nonexistent-id" } -> notfound
}

action compare(left: H, right: H) {
  -> ok(diff: String)
  -> notfound(message: String)
  fixture compare_both { left: $register_article.id, right: $register_user.id } after register_article, register_user
}
```

The test generator resolves the `after` chain transitively — if `fixture_c after fixture_b` and `fixture_b after fixture_a`, all three run in order.

**Output references** (`$fixture.field`): When a fixture uses `after`, its input values can reference output fields from the dependency fixture using `$fixtureName.field` syntax. At test time, the after-chain fixture runs first and its output is captured; the `$ref` is then resolved to the actual runtime value (e.g., a generated UUID). This replaces hardcoded placeholder IDs and ensures reader fixtures always find the data their after-chain created.

```
action create(title: String) {
  -> ok(id: T, slug: String)
  fixture create_post { title: "Hello World" }
}

action get(id: T) {
  -> ok(title: String)
  -> notfound()
  fixture get_existing { id: $create_post.id } after create_post
  fixture get_missing { id: "no-such-id" } -> notfound
}

action getBySlug(slug: String) {
  -> ok(title: String)
  -> notfound()
  fixture slug_lookup { slug: $create_post.slug } after create_post
}
```

**Fixture values**:

| Syntax | Type | Example |
|--------|------|---------|
| `"text"` | String | `name: "hello"` |
| `42`, `-1`, `3.14` | Number | `count: 42` |
| `true`, `false` | Boolean | `deterministic: true` |
| `[1, 2, 3]` | Array | `ids: [1, 2, 3]` |
| `{ k: "v" }` | Nested object | `config: { timeout: 30 }` |
| `none` | Null | `optional: none` |
| `$fixture.field` | Output ref | `id: $register_ok.id` |

**Guidelines**:
- Every action should have at least one `ok` fixture with realistic inputs
- Add `-> error` or `-> invalid` fixtures to test negative paths
- Use `after` to declare dependencies when a fixture needs data from a prior action's fixture (e.g., `get` after `create`, `update` after `register`)
- **Use `$fixture.field` to reference output fields** from after-chain fixtures instead of hardcoded placeholder IDs. This ensures tests find the actual data seeded by the after-chain
- Use fixture values that match what the handler actually expects (e.g., JSON strings for params that get `JSON.parse()`d)
- Fixtures are used by the test generator as seeds for both deterministic and property-based tests

### Custom Types in Action Parameters

Actions can reference types not defined in the concept. The parser accepts any identifier as a type. Custom types like `ConceptManifest`, `ActionRecord`, `CompiledSync` are used by framework concepts.

## Invariant Section

Invariants express **operational principles** — defining stories that prove the concept fulfills its purpose. They are the primary mechanism for machine-verifiable behavioral contracts and conformance test generation.

**Design goal**: Invariants should comprehensively cover all qualities you want to prove about the concept — not just the happy path, but boundary conditions, error handling, state transitions, constraint enforcement, and composition behavior.

### Basic Structure

```
invariant {
  after <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
  then <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
  and  <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
}
```

- **after**: Setup steps that establish state (one or more, joined by `and`)
- **then**: First verification step
- **and**: Additional verification steps (zero or more)
- Multiple `invariant` blocks are allowed — use one per scenario

### Named Invariants Inside `invariant {}`

A single `invariant {}` block can contain multiple named sub-invariants instead of bare after/then steps:

```
invariant {
  example "create and retrieve" {
    after create(name: "test") -> ok(id: x)
    then get(id: x) -> ok(name: "test")
  }

  always "non-negative counts" {
    forall r in records:
    r.count >= 0
  }

  action validate {
    requires: input != none
    ensures ok: result.valid = true
  }
}
```

The parser detects named sub-invariants when the first token inside `invariant {` is one of: `example`, `forall`, `always`, `never`, `eventually`, or `action`.

### Named Bare Invariants with Labels

Bare invariant blocks support an optional name label using `"name":` syntax before the `after` keyword:

```
invariant {
  "roundtrip persistence":
  after create(item: x, title: "hello") -> ok(item: x)
  then get(item: x) -> ok(title: "hello")
}
```

### Action Invocation Steps

Each step invokes an action and asserts its return variant:
```
action_name(param: value, ...) -> variant_name(field: value, ...)
```

Input parameters are optional — `action_name -> variant` is valid. The arrow and variant are also optional — `action_name(param: value)` is valid for fire-and-forget steps.

### Action-Dot-Variant Steps

In then-chains, you can use `action.variant(args)` syntax as an alternative to the standard step format:

```
invariant {
  after register(name: "test") -> ok(id: x)
  then resolve.ok(id: x, name: "test")
}
```

This is parsed as `{ kind: 'action', actionName, variantName, inputArgs: [], outputArgs }`.

### Property Assertion Steps

Then-chains can also contain **property assertions** that test state directly:
```
invariant {
  after configure(endpoint: "api", threshold: 5) -> ok(breaker: b)
  and  recordFailure(endpoint: "api") -> ok(breaker: b, status: s)
  then b.failureCount = 1
  and  s != "open"
}
```

Assertions support dot-access into bound variables and comparison against literals or other variables.

### Supported Assertion Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Equality | `d.status = "complete"` |
| `!=` | Inequality | `s != "open"` |
| `>` | Greater than | `i.generation > 0` |
| `<` | Less than | `c.failureCount < 5` |
| `>=` | Greater or equal | `r.tokens >= 0` |
| `<=` | Less or equal | `t.attempts <= 3` |
| `in` | Membership | `p.protocol in ["http", "grpc"]` |
| `not in` | Non-membership | `s.status not in ["deleted", "expired"]` |

### Assertion Expression Types

| Syntax | Meaning | Example |
|--------|---------|---------|
| `var.field` | Dot-access on bound variable | `b.status`, `r.count` |
| `var` | Bare variable reference | `s`, `count` |
| `"text"` | String literal | `"complete"` |
| `123`, `-1` | Integer literal | `0`, `42`, `-1` |
| `3.14` | Float literal | `3.14`, `-0.5` |
| `true`/`false` | Boolean literal | `true` |
| `none` | Null/absent value | `none` |
| `[a, b, c]` | List literal | `["http", "grpc"]` |

### `when` Guard Clauses

Invariants can include a `when` clause that specifies preconditions:
```
invariant {
  when f1.module_id = f2.module_id
  after fetch(module: f1) -> ok(download: d1)
  and   fetch(module: f2) -> cached()
  then d1.status = "complete"
}
```

The `when` clause can appear before `after` or after the `then` chain. Conditions are joined by `and`:
```
invariant {
  when r.runtime = "onnx" and r.device = "cpu"
  after register(name: "model", runtime: "onnx", device: "cpu") -> ok(instance: r)
  then resolve(name: "model") -> ok(instance: r, runtime: "onnx", config: _)
}
```

### Argument Values

| Syntax | Meaning | Example |
|--------|---------|---------|
| `param: variable` | Free variable binding | `user: x` |
| `param: "literal"` | String literal | `password: "secret"` |
| `param: 123` | Numeric literal | `count: 0` |
| `param: 3.14` | Float literal | `ratio: 3.14` |
| `param: true/false` | Boolean literal | `valid: true` |
| `param: none` | Null/absent value | `error: none` |
| `param: _` | Wildcard (any value) | `headers: _` |
| `param: { f: "v", g: 42 }` | Record literal | `manifest: { name: "Ping" }` |
| `param: ["a", "b"]` | List literal | `items: ["x", "y"]` |
| `param: []` | Empty list | `manifests: []` |
| `param: var.field` | Dot-access on variable | `hash: b.hash` |
| `...` | Spread (wildcard rest) | `create(name: "x", ...)` |

Record and list literals can be nested arbitrarily:
```
param: {
  name: "Ping",
  actions: [{ name: "ping", params: [],
    variants: [{ tag: "ok", fields: [] }] }]
}
```

Multi-line record/list literals are supported — newlines inside `{ }` and `[ ]` are ignored by the parser.

Free variables (like `x`, `y`) are bound on first use and reused across steps. They receive deterministic test values during conformance test generation (e.g., `"u-test-invariant-001"`).

## Named Invariant Constructs

Beyond the standard `invariant {}` block, the parser supports five named invariant construct keywords. These can appear either at the **concept body level** (alongside `purpose`, `state`, `actions`) or **inside** an `invariant {}` block as named sub-invariants.

### `example` — Named Scenario

An `example` is identical to a bare invariant but with a descriptive name:

```
example "create and retrieve" {
  after create(name: "test", value: "hello") -> ok(id: x)
  then get(id: x) -> ok(name: "test", value: "hello")
}
```

The body is the same as a bare invariant: `after`/`then`/`and` steps with optional `when` guard.

### `forall` — Universal Quantification

Expresses a property that must hold for all elements in a domain:

```
forall "unique slugs" {
  given a in {articles}
  given b in {articles}
  after getSlug(article: a) -> ok(slug: s1)
  and   getSlug(article: b) -> ok(slug: s2)
  then s1 != s2
}
```

**Syntax**: `forall "name" { given <var> in <domain> [where <condition>] ... after ... then ... }`

The `given` keyword introduces quantifier bindings. Multiple `given` clauses are allowed.

### `always` — State Invariant

Expresses a property that must hold in every reachable state:

```
always "non-negative balance" {
  forall u in users:
  u.balance >= 0
}
```

**Syntax**: `always "name" { forall <var> in <domain>: <predicate> }`

The body contains a `forall` quantifier followed by a colon and assertion predicates. Multiple predicates can be joined with `and`.

### `never` — Prohibited State

Expresses a property that must never hold — the negation of an invariant:

```
never "double-spend" {
  exists t in transactions:
  t.status = "committed" and t.spent = true
}
```

**Syntax**: `never "name" { exists <var> in <domain>: <predicate> }`

The `exists` keyword (or `forall`) introduces quantifier bindings, followed by a colon and the prohibited condition.

### `eventually` — Liveness Property

Expresses a property that must eventually become true:

```
eventually "all pending requests resolve" {
  forall r in requests:
  r.status != "pending"
}
```

**Syntax**: `eventually "name" { forall <var> in <domain> [where <condition>]: <predicate> }`

### Quantifier Syntax

Quantifier bindings (`given`, `forall`, `exists`) share a common syntax:

```
<variable> in <domain> [where <condition>]
```

**Domain types**:

| Domain Syntax | Meaning | Example |
|---------------|---------|---------|
| `{value1, value2, ...}` | Set literal (strings or identifiers) | `given x in {"a", "b", "c"}` |
| `state_field` | State field reference (lowercase) | `forall u in users` |
| `TypeName` | Type reference (uppercase first letter) | `forall r in Request` |

**Optional `where` clause** — filters the domain with a condition:
```
forall "overdue tasks" {
  given t in tasks where t.status = "open"
  after check(task: t) -> ok(overdue: o)
  then o = true
}
```

The `where` condition is parsed as a standard assertion (left operator right).

## Action Contracts (Hoare-Logic Style)

Action contracts express preconditions (`requires`) and postconditions (`ensures`) for actions. They can appear at concept body level or inside `invariant {}` blocks.

### Structured Contract Syntax

```
action validate {
  requires: input != none
  ensures ok: result.valid = true
  ensures error: result.message != ""
}
```

- **`requires:`** — Precondition that must hold before the action runs. Parsed as an assertion.
- **`ensures [variant]:`** — Postcondition that must hold after the action completes with the given variant. The variant name is optional; if omitted, the ensures applies to all variants.

Multiple `requires` and `ensures` clauses are allowed in a single contract block.

### Prose-Style Contract Syntax

The parser also accepts a prose-style syntax where `requires` and `ensures` keywords are followed by brace-delimited prose blocks (no colon):

```
action transfer requires {
  The sender must have sufficient balance to cover the amount.
} ensures {
  The sender's balance is decremented and the receiver's balance
  is incremented by exactly the transfer amount.
}
```

This form is stored as an empty contracts list (the prose is consumed but not structurally parsed).

### AST Representation

Action contracts produce `InvariantDecl` nodes with:
- `kind: 'requires_ensures'`
- `targetAction: string` — the action name
- `contracts: ActionContract[]` — array of `{ kind: 'requires'|'ensures', predicate, variant? }`

## Comprehensive Invariant Coverage

Every concept should have invariants covering **all qualities worth proving**:

| Quality | What to test | Example pattern |
|---------|-------------|-----------------|
| Core purpose | The defining operational principle | Create -> Query returns same data |
| State correctness | Fields stored accurately | Create -> Get, check each field |
| Constraint enforcement | Uniqueness, bounds, rules | Register -> Register duplicate -> error |
| Error handling | Invalid inputs rejected properly | Bad input -> error variant with message |
| State transitions | FSM correctness | Configure (closed) -> failures -> tripped (open) |
| Idempotency | Repeated calls are safe | Register -> Register same -> exists (not error) |
| Boundary conditions | Edge cases, empty inputs, limits | Zero tokens -> limited, max capacity -> ok |
| Reversibility | Undo operations work | Follow -> Unfollow -> isFollowing = false |
| Composition readiness | Works when composed via syncs | Register -> resolve returns correct metadata |

Aim for 2-5 invariants per concept. A concept with only 1 invariant testing the happy path has weak guarantees.

## Comments

The parser supports two comment styles:

```
// Line comment (C-style)
# Line comment (shell-style)
```

Both styles cause the rest of the line to be ignored.

## Complete Example

```
@version(1)
@category("domain")
concept Favorite [U] {

  purpose {
    Track which articles each user has favorited
    and provide counts.
  }

  state {
    favorites: U -> set String
  }

  actions {
    action favorite(user: U, article: String) {
      -> ok(user: U, article: String) {
        Add article to user's favorites set.
      }
    }

    action unfavorite(user: U, article: String) {
      -> ok(user: U, article: String) {
        Remove article from user's favorites set.
      }
    }

    action isFavorited(user: U, article: String) {
      -> ok(favorited: Bool) {
        Check if user has favorited article.
      }
    }

    action count(article: String) {
      -> ok(count: Int) {
        Return number of users who favorited article.
      }
    }
  }

  // Standard invariant block
  invariant {
    after favorite(user: u, article: "a1") -> ok(user: u, article: "a1")
    then isFavorited(user: u, article: "a1") -> ok(favorited: true)
    and  unfavorite(user: u, article: "a1") -> ok(user: u, article: "a1")
  }

  // Named invariant at concept body level
  always "favorites are consistent" {
    forall u in users:
    u.count >= 0
  }
}
```

## Parser Error Messages

Common parse errors and their causes:

| Error | Cause |
|-------|-------|
| `Expected 'concept'` | File doesn't start with `concept` keyword (or missing annotations) |
| `Unknown top-level annotation @foo` | Unrecognized annotation before `concept` (only `@version`, `@gate`, `@category`, `@visibility` are valid) |
| `Expected '['` | Missing type parameter brackets |
| `Expected '{'` | Missing opening brace for a section |
| `Unknown section` | Section name not recognized (typo in `purpose`/`state`/`actions`) |
| `Expected '->'` | Missing arrow in action variant |
| `Unexpected token` | General syntax error — check for missing commas, braces, or parentheses |
| `Expected comparison operator` | Assertion missing `=`, `!=`, `>`, `<`, `>=`, `<=`, `in`, or `not in` |
