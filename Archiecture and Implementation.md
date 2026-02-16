# Concept-Oriented Programming Framework (COPF)

## Architecture & Implementation Specification

**Version:** 0.1.0-draft
**Date:** 2025-02-15

---

## 1. Overview

COPF is a framework for building software systems as compositions of fully independent, spec-driven services called **concepts**, coordinated by declarative **synchronizations**. It is language-agnostic, spec-first, and designed for distributed deployment — a concept may run on a server, a phone, an embedded device, or in-browser.

### 1.1 Design Principles

1. **Spec-first.** Every concept begins as a `.concept` specification. Code is generated from or validated against the spec, never the reverse.
2. **Total independence.** No concept references the state, types, or actions of any other concept. All inter-concept coordination is expressed in synchronizations.
3. **Sovereign storage.** Each concept owns its data. No shared database. The concept chooses its own persistence strategy — Postgres, SQLite, Core Data, in-memory, a file — as an implementation detail.
4. **Uniform protocol.** Every concept exposes the same three capabilities regardless of language or runtime: accept action invocations, return action completions, answer GraphQL queries against its state.
5. **Self-hosting.** The framework itself — including the spec compiler, sync engine, and code generators — is implemented as concepts within the framework, bootstrapped from a minimal kernel.

### 1.2 System Anatomy

```
┌──────────────────────────────────────────────────┐
│                  .concept specs                  │
│         (source of truth for everything)         │
└────────────────────┬─────────────────────────────┘
                     │ compiles to
         ┌───────────┼───────────────┐
         ▼           ▼               ▼
   ┌──────────┐ ┌──────────┐  ┌───────────┐
   │ GraphQL  │ │  JSON    │  │ Language  │
   │ Schema   │ │ Schemas  │  │ Stubs +   │
   │ Fragment │ │ (IR)     │  │ Tests     │
   └────┬─────┘ └────┬─────┘  └─────┬─────┘
        │             │              │
        ▼             ▼              ▼
   ┌──────────────────────────────────────────┐
   │            Sync Engine                    │
   │  ┌──────┐  ┌───────┐  ┌──────────────┐  │
   │  │ When │→ │ Where │→ │    Then      │  │
   │  │match │  │ query │  │   invoke     │  │
   │  └──────┘  └───────┘  └──────────────┘  │
   │       ↕           ↕           ↕          │
   │  ┌─────────────────────────────────────┐ │
   │  │     Transport Layer (adapters)      │ │
   │  └──────┬──────────┬──────────┬────────┘ │
   └─────────┼──────────┼──────────┼──────────┘
             ▼          ▼          ▼
        ┌────────┐ ┌────────┐ ┌────────┐
        │Concept │ │Concept │ │Concept │
        │  (TS)  │ │ (Rust) │ │(Swift) │
        │ SQLite │ │Postgres│ │CoreData│
        └────────┘ └────────┘ └────────┘
```

---

## 2. The Specification Language

### 2.1 File Format

Each concept is defined in a `.concept` file. The language uses **explicit delimiters** (braces) for all blocks. **Statement terminators** are flexible: both newlines and semicolons are accepted, and consecutive separators are collapsed (blank lines and trailing semicolons are fine). Prose bodies inside `{ }` for action variant descriptions are captured as raw strings — the parser does not interpret their content.

The language is designed to be parseable by both machines and LLMs, readable by humans, and precise enough to generate typed code and schemas. A hand-written recursive descent parser with a standard tokenizer is the intended implementation.

### 2.2 Tokenizer Rules

The tokenizer produces the following token types:

```
KEYWORD     = "concept" | "purpose" | "state" | "actions" | "action"
            | "invariant" | "capabilities" | "requires" | "after"
            | "then" | "and" | "set" | "list" | "option"
PRIMITIVE   = "String" | "Int" | "Float" | "Bool" | "Bytes"
            | "DateTime" | "ID"
IDENT       = [A-Za-z_][A-Za-z0-9_]*
VARIABLE    = [a-z][A-Za-z0-9_]*          -- in invariant context only
STRING_LIT  = '"' [^"]* '"'
INT_LIT     = [0-9]+
FLOAT_LIT   = [0-9]+ '.' [0-9]+
BOOL_LIT    = "true" | "false"
ARROW       = "->"
COLON       = ":"
COMMA       = ","
LBRACE      = "{"
RBRACE      = "}"
LBRACKET    = "["
RBRACKET    = "]"
LPAREN      = "("
RPAREN      = ")"
SEP         = "\n" | ";"               -- statement separator
PROSE       = <raw text between { and matching } in prose context>
```

Tokenizer behavior:

- Whitespace (spaces, tabs) is ignored except as token boundary.
- Newlines and semicolons both produce `SEP` tokens.
- Consecutive `SEP` tokens are collapsed to one.
- `SEP` tokens adjacent to `LBRACE` or `RBRACE` are discarded (so `{ \n` and `\n }` don't produce separators).
- When the parser enters a **prose context** (after `->` variant tag and params, inside braces), the tokenizer switches to raw capture mode: everything between `{` and the matching `}` is returned as a single `PROSE` token. Brace nesting within prose is not supported (prose must not contain unmatched braces).

### 2.3 Grammar

```
ConceptFile     = ConceptDecl

ConceptDecl     = "concept" IDENT TypeParams? "{" Section* "}"

TypeParams      = "[" IDENT ("," IDENT)* "]"

Section         = PurposeSection
                | StateSection
                | ActionSection
                | InvariantSection
                | CapabilitySection

-- Purpose --

PurposeSection  = "purpose" "{" PROSE "}"

-- State --

StateSection    = "state" "{" StateEntry* "}"

StateEntry      = StateGroup | StateComponent

StateGroup      = IDENT "{" StateComponent+ "}"

StateComponent  = IDENT ":" TypeExpr SEP?

TypeExpr        = PrimitiveType
                | IDENT                          -- type parameter ref
                | "set" TypeExpr                 -- set of values
                | "list" TypeExpr                -- ordered list
                | "option" TypeExpr              -- nullable
                | TypeExpr "->" TypeExpr         -- relation / mapping
                | "{" FieldList "}"              -- inline record type

PrimitiveType   = "String" | "Int" | "Float" | "Bool"
                | "Bytes" | "DateTime" | "ID"

FieldList       = Field (("," | SEP) Field)*
Field           = IDENT ":" TypeExpr

-- Actions --

ActionSection   = "actions" "{" ActionDecl* "}"

ActionDecl      = "action" IDENT "(" ParamList? ")" "{" ReturnVariant+ "}"

ParamList       = Param ("," Param)*
Param           = IDENT ":" TypeExpr

ReturnVariant   = "->" IDENT "(" ParamList? ")" ("{" PROSE "}")?

-- Invariants --

InvariantSection = "invariant" "{" InvariantDecl* "}"

InvariantDecl   = "after" ActionPattern SEP
                  "then" ActionPattern
                  (SEP "and" ActionPattern)*

ActionPattern   = IDENT "(" ArgPatterns? ")" "->" IDENT "(" ArgPatterns? ")"

ArgPatterns     = ArgPattern ("," ArgPattern)*
ArgPattern      = IDENT ":" (STRING_LIT | INT_LIT | FLOAT_LIT | BOOL_LIT | VARIABLE)

-- Capabilities --

CapabilitySection = "capabilities" "{" CapabilityDecl* "}"

CapabilityDecl  = "requires" IDENT SEP?
```

### 2.4 State Grouping and Relation Mapping

The `state` section declares the concept's persistent data as typed relations. The compiler maps state declarations to **storage relations** (see Section 6A) using these rules:

**Default merge rule:** State components that share the same domain type (left side of `->`) and are scalar-valued (not `set` or `list`) are merged into a single storage relation. The relation is named after the concept (lowercased). The key field takes the name of the type parameter (lowercased).

Example — these two lines:
```
hash: U -> Bytes
salt: U -> Bytes
```
Both map from `U` and are scalar, so they merge into one relation: `password(user, hash, salt)`.

**Set/list-valued relations** remain separate. `followers: U -> set U` becomes its own relation: `followers(user, follower)`.

**Explicit grouping** overrides the default. Wrapping state components in a named block forces them into a named relation:

```
state {
  credentials {
    hash: U -> Bytes
    salt: U -> Bytes
  }
  resetToken: U -> option String
}
```

This produces two relations: `credentials(user, hash, salt)` and `resetToken(user, value)`.

**Ungrouped components with different domain types** each become their own relation, named after the component.

The compiler emits the relation mapping as part of the concept manifest. The storage interface, lite query layer, and GraphQL schema are all generated from this mapping.

### 2.5 Complete Example

```
concept Password [U] {

  purpose {
    Securely store and validate user credentials using
    salted hashing. Does not handle reset flows — those
    are composed via synchronization with a token concept.
  }

  state {
    hash: U -> Bytes
    salt: U -> Bytes
  }

  capabilities {
    requires crypto
    requires persistent-storage
  }

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

    action validate(password: String) {
      -> ok(valid: Bool) {
        Check that the password meets strength requirements
        without storing anything.
      }
    }
  }

  invariant {
    after set(user: x, password: "secret") -> ok(user: x)
    then check(user: x, password: "secret") -> ok(valid: true)
    and  check(user: x, password: "wrong")  -> ok(valid: false)
  }
}
```

### 2.6 Design Notes

**Type parameters** are always opaque identifiers on the wire (serialized as strings). A concept that declares `[U]` is saying "I work with references to things of type U, but I know nothing about them." This is what guarantees independence.

**Return variants** replace exceptions. Every action explicitly enumerates its possible outcomes. The variant tag (`ok`, `error`, `notfound`, `invalid`, etc.) is freeform — the spec author names them. This is critical for synchronization pattern matching: a sync can fire specifically on `-> invalid(...)` completions.

**Action bodies** are deliberately informal. They describe behavior in natural language, enough for a human to implement or an LLM to generate code from. The formal contract is the combination of the signature and the invariants. The parser captures them as raw strings.

**Capabilities** are not enforced at the spec level — they're metadata for deployment validation. A phone runtime knows it has `persistent-storage` and `crypto` but not `network` (when offline), so it can flag a deployment mismatch.

**Semicolons** are optional everywhere. Both `hash: U -> Bytes\n` and `hash: U -> Bytes;` are valid. This allows single-line compact specs (`state { hash: U -> Bytes; salt: U -> Bytes }`) without requiring semicolons in the more common multi-line format.

---

## 3. Intermediate Representation (Action Messages)

### 3.1 Message Envelope

All action messages — invocations and completions — share a single JSON envelope format. This is the wire protocol between the sync engine and any concept, regardless of language.

```typescript
// Invocation: engine -> concept
interface ActionInvocation {
  id: string;            // unique ID for this invocation
  concept: string;       // concept URI, e.g. "urn:app/Password"
  action: string;        // action name, e.g. "check"
  input: Record<string, unknown>;  // named arguments
  flow: string;          // flow token for causal tracking
  sync?: string;         // which synchronization produced this
  timestamp: string;     // ISO 8601
}

// Completion: concept -> engine
interface ActionCompletion {
  id: string;            // same ID as the invocation (or new for origin actions)
  concept: string;
  action: string;
  input: Record<string, unknown>;   // echo of the input
  variant: string;       // which return variant, e.g. "ok", "error"
  output: Record<string, unknown>;  // named return values
  flow: string;
  timestamp: string;
}
```

### 3.2 Schema Generation

For each action in a concept spec, the compiler produces JSON Schemas for:

- The invocation message (validating `input` fields and types)
- One completion message per return variant (validating `output` fields)

Example for `Password.check`:

```json
{
  "$id": "urn:app/Password/check/invocation",
  "type": "object",
  "properties": {
    "concept": { "const": "urn:app/Password" },
    "action": { "const": "check" },
    "input": {
      "type": "object",
      "properties": {
        "user": { "type": "string" },
        "password": { "type": "string" }
      },
      "required": ["user", "password"]
    }
  }
}
```

### 3.3 Type Mapping

| Spec Type    | JSON          | TypeScript     | Rust            | Swift          |
|-------------|---------------|----------------|-----------------|----------------|
| `String`    | `string`      | `string`       | `String`        | `String`       |
| `Int`       | `number`      | `number`       | `i64`           | `Int`          |
| `Float`     | `number`      | `number`       | `f64`           | `Double`       |
| `Bool`      | `boolean`     | `boolean`      | `bool`          | `Bool`         |
| `Bytes`     | `string` (b64)| `Buffer`       | `Vec<u8>`       | `Data`         |
| `DateTime`  | `string` (ISO)| `Date`         | `DateTime<Utc>` | `Date`         |
| `ID`        | `string`      | `string`       | `String`        | `String`       |
| `option T`  | `T \| null`   | `T \| null`    | `Option<T>`     | `T?`           |
| `set T`     | `array`       | `Set<T>`       | `HashSet<T>`    | `Set<T>`       |
| `list T`    | `array`       | `T[]`          | `Vec<T>`        | `[T]`          |
| `A -> B`    | `object`      | `Map<A, B>`    | `HashMap<A,B>`  | `[A: B]`       |
| Type param  | `string`      | `string`       | `String`        | `String`       |

---

## 4. GraphQL State Interface

### 4.1 Schema Generation from Spec

Each concept's state section compiles to a GraphQL type and query root. The compiler generates a schema fragment that the engine federates.

From the Password concept:

```graphql
type PasswordState {
  """All users who have credentials"""
  users: [ID!]!
}

type PasswordEntry {
  user: ID!
  hash: String!    # Base64-encoded bytes
  salt: String!    # Base64-encoded bytes
}

extend type Query {
  password_entry(user: ID!): PasswordEntry
  password_entries: [PasswordEntry!]!
}
```

### 4.2 Query Modes

Concepts expose their state for `where` clause evaluation. The engine always speaks GraphQL internally — it's the federation and query language — but concepts can satisfy that contract at two levels of complexity. The choice is per-concept and declared in the deployment manifest.

#### Mode A: Full GraphQL (default for server concepts)

The concept runs its own GraphQL endpoint. The framework generates resolvers backed by the concept's storage abstraction:

- **TypeScript:** Generated resolvers using graphql-js or Yoga, backed by the concept's storage
- **Rust:** Generated async-graphql schema with resolver trait
- **Swift:** Generated schema with resolver protocol

The generated code handles the mapping from internal storage representation to the GraphQL schema. The concept implementor only touches the storage layer.

This mode is appropriate when the concept has complex state, runs on a runtime with good GraphQL library support, and the concept author wants full control over query performance (custom resolvers, indexes, pagination).

#### Mode B: Lite Query Protocol (for phones, embedded, lightweight concepts)

The concept does not run a GraphQL server. Instead, it implements a minimal **state snapshot protocol** — a single function that returns its state (or a filtered slice of it) as a JSON object conforming to the spec's state schema. The engine-side adapter translates this into GraphQL-compatible responses.

The protocol has three operations, from simplest to most expressive. A concept must implement at least `snapshot`, and may optionally implement `lookup` and `filter` for better performance:

```typescript
interface LiteQueryProtocol {
  /**
   * Return the full state as a JSON object matching the
   * concept's state schema. The engine indexes and queries
   * this in-memory.
   *
   * For a Password concept with state { hash: U -> Bytes, salt: U -> Bytes }
   * this returns something like:
   * {
   *   "entries": [
   *     { "user": "u-123", "hash": "...", "salt": "..." },
   *     { "user": "u-456", "hash": "...", "salt": "..." }
   *   ]
   * }
   */
  snapshot(): Promise<ConceptStateSnapshot>;

  /**
   * Optional. Return the state slice for a single entity
   * identified by its key. Avoids transferring full state
   * when the engine only needs one record.
   *
   * lookup("user", "u-123") returns:
   * { "user": "u-123", "hash": "...", "salt": "..." }
   */
  lookup?(relation: string, key: string): Promise<Record<string, unknown> | null>;

  /**
   * Optional. Return state entries matching a simple filter.
   * Covers the common case of where-clause queries without
   * requiring a full query engine on the concept side.
   *
   * filter({ field: "user", op: "eq", value: "u-123" })
   * filter({ field: "karma", op: "gte", value: 10 })
   */
  filter?(criteria: LiteFilter[]): Promise<Record<string, unknown>[]>;
}

interface LiteFilter {
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}

interface ConceptStateSnapshot {
  /** ISO 8601 timestamp of when this snapshot was taken */
  asOf: string;
  /** State data organized by relation name from the spec */
  relations: Record<string, Record<string, unknown>[]>;
}
```

The engine handles all the complexity:

1. The compiler generates the state schema shape from the `.concept` spec, so the engine knows what structure `snapshot()` returns.
2. On the engine side, a **LiteQueryAdapter** wraps the lite protocol and presents it as a standard GraphQL-compatible query source.
3. When a `where` clause references a lite-mode concept, the adapter calls `lookup` or `filter` if available for the query pattern, falling back to `snapshot` + in-engine filtering.
4. For concepts that change infrequently (e.g., a user's profile on their phone), the engine can cache snapshots and invalidate on action completions from that concept.

```typescript
/**
 * Engine-side adapter that wraps a LiteQueryProtocol concept
 * and makes it queryable as if it were a GraphQL endpoint.
 * Generated from the concept spec — the schema shape is known
 * at compile time.
 */
class LiteQueryAdapter {
  private cache: ConceptStateSnapshot | null = null;
  private cacheValidUntil: number = 0;

  constructor(
    private lite: LiteQueryProtocol,
    private schema: ConceptStateSchema,  // from compiled spec
    private cacheTtlMs: number = 5000,
  ) {}

  /**
   * Resolve a GraphQL-shaped query against the lite protocol.
   * Called by the engine when evaluating where clauses.
   */
  async resolve(
    relation: string,
    args?: Record<string, unknown>
  ): Promise<Record<string, unknown>[]> {
    // Fast path: single-key lookup
    if (args && Object.keys(args).length === 1 && this.lite.lookup) {
      const [field, value] = Object.entries(args)[0];
      const result = await this.lite.lookup(field, String(value));
      return result ? [result] : [];
    }

    // Medium path: simple filter
    if (args && this.lite.filter) {
      const criteria: LiteFilter[] = Object.entries(args).map(
        ([field, value]) => ({ field, op: "eq" as const, value })
      );
      return this.lite.filter(criteria);
    }

    // Slow path: full snapshot + in-engine filter
    const snapshot = await this.getSnapshot();
    const entries = snapshot.relations[relation] ?? [];
    if (!args) return entries;
    return entries.filter(entry =>
      Object.entries(args).every(([k, v]) => entry[k] === v)
    );
  }

  /** Invalidate cache when the concept reports a state change */
  invalidate(): void {
    this.cache = null;
  }

  private async getSnapshot(): Promise<ConceptStateSnapshot> {
    if (this.cache && Date.now() < this.cacheValidUntil) {
      return this.cache;
    }
    this.cache = await this.lite.snapshot();
    this.cacheValidUntil = Date.now() + this.cacheTtlMs;
    return this.cache;
  }
}
```

**When to use which mode:**

| Factor | Full GraphQL | Lite Query |
|--------|-------------|------------|
| Runtime | Server, beefy client | Phone, embedded, WASM, CLI tool |
| State size | Large (many users, many records) | Small (single user, bounded data) |
| Query complexity | Complex joins, pagination, aggregation | Key lookups, simple filters |
| Library overhead | Needs GraphQL server library | Zero dependencies beyond JSON |
| Performance control | Concept controls indexing and resolution | Engine handles query execution |
| Offline capability | Requires GraphQL server running | Snapshot can be cached engine-side for offline where-clause evaluation |

**The key invariant:** the engine doesn't care which mode a concept uses. The `ConceptTransport` interface (Section 6.4) abstracts over both. The `where` clause compiler emits the same logical query regardless — the transport adapter decides whether to issue a GraphQL request or call the lite protocol.

### 4.3 Engine-Side Federation

The sync engine runs a federated query layer. When evaluating a `where` clause, the engine:

1. Parses the `where` clause into sub-queries scoped to individual concepts
2. For each concept, dispatches via the transport adapter:
   - **Full GraphQL concepts:** issues a GraphQL sub-query directly
   - **Lite query concepts:** routes through the LiteQueryAdapter, which calls `lookup`/`filter`/`snapshot` as appropriate
3. Joins results in-engine using variable bindings
4. Produces the set of bindings for the `then` clause

For co-located concepts (same process), queries are direct function calls regardless of mode. For remote concepts, full-GraphQL concepts receive HTTP/WebSocket GraphQL requests; lite concepts receive simple JSON-RPC calls to `snapshot`/`lookup`/`filter`.

The engine also exposes the federated state of all concepts as a unified GraphQL API for external consumers (dashboards, debugging tools, admin interfaces). For lite-mode concepts, the engine generates resolvers from their specs that delegate to the LiteQueryAdapter.

### 4.4 Subscription for Live State

Concepts may optionally support state change notifications. The mechanism differs by query mode:

- **Full GraphQL concepts** may implement GraphQL subscriptions natively.
- **Lite query concepts** emit invalidation signals on every action completion. The engine automatically wires this: whenever a lite concept returns an action completion, the engine invalidates its cached snapshot. No additional implementation required from the concept.

Both modes feed into the same engine-side cache, allowing the engine to maintain a local materialized view of frequently-queried state and receive push invalidations, reducing query latency for eager synchronizations.

---

## 5. Synchronization Language

### 5.1 Syntax

Synchronizations are defined in `.sync` files. Multiple syncs can live in one file. The language is a superset of the paper's notation, extended for deployment annotations.

```
SyncFile        = (SyncDecl NL)*

SyncDecl        = "sync" Name Annotation* NL
                  WhenClause
                  WhereClause?
                  ThenClause

Annotation      = "[" AnnotationName "]"
AnnotationName  = "eager" | "eventual" | "local" | "idempotent"

WhenClause      = "when" "{" NL
                  (ActionMatch NL)+
                  "}" NL

ActionMatch     = ConceptAction ":" "[" FieldPattern* "]"
                  "=>" "[" FieldPattern* "]"

ConceptAction   = ConceptName "/" ActionName

FieldPattern    = Name ":" (Literal | Variable | "_") ";"?
Variable        = "?" Name

WhereClause     = "where" "{" NL
                  (WhereExpr NL)+
                  "}" NL

WhereExpr       = BindExpr | ConceptQuery | FilterExpr

BindExpr        = "bind" "(" Expr "as" Variable ")"
ConceptQuery    = ConceptName ":" "{" QueryPattern "}"
FilterExpr      = "filter" "(" BoolExpr ")"

ThenClause      = "then" "{" NL
                  (ActionInvoke NL)+
                  "}" NL

ActionInvoke    = ConceptAction ":" "[" FieldAssign* "]"
FieldAssign     = Name ":" (Literal | Variable | Expr) ";"?
```

### 5.2 Annotations

| Annotation    | Meaning |
|--------------|---------|
| `eager`      | Default. Evaluated synchronously within the flow. All referenced concepts must be reachable. |
| `eventual`   | Deferred. The engine records the pending sync and evaluates it when all referenced concepts become available. |
| `local`      | Must execute on the same runtime as its `when` concept. Used for latency-sensitive or offline-capable flows. |
| `idempotent` | Safe to re-execute. Allows the engine to retry without side-effect concerns. |

### 5.3 Extended Example

```
sync CreateArticle [eager]
when {
  Web/request: [
    method: "create_article";
    title: ?title;
    description: ?desc;
    body: ?body;
    token: ?token ]
  => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}

sync PerformCreateArticle [eager]
when {
  Web/request: [
    method: "create_article";
    title: ?title;
    description: ?desc;
    body: ?body ]
  => []
  JWT/verify: []
  => [ user: ?author ]
}
where {
  bind(uuid() as ?article)
}
then {
  Article/create: [
    article: ?article;
    title: ?title;
    description: ?desc;
    body: ?body;
    author: ?author ]
}

sync CascadeDeleteComments [eager]
when {
  Article/delete: [ article: ?article ]
  => [ article: ?article ]
}
where {
  Comment: { ?comment target: ?article }
}
then {
  Comment/delete: [ comment: ?comment ]
}

sync ReplicateProfile [eventual]
when {
  Phone.Profile/update: []
  => [ user: ?user; bio: ?bio; image: ?image ]
}
then {
  Server.Profile/replicate: [
    user: ?user;
    bio: ?bio;
    image: ?image ]
}
```

### 5.4 Scoping Rules

- Variables are scoped to the entire synchronization. A `?user` bound in `when` is available in `where` and `then`.
- Multiple actions in `when` must share the same flow token (implicit).
- `where` queries may introduce new variables via concept state queries.
- If a `where` query returns multiple bindings (e.g., all comments for an article), the `then` clause executes once per binding.
- All field names are resolved against concept specs at compile time.

---

## 6. Sync Engine Architecture

### 6.1 Core Data Model

The engine maintains an append-only **action log** — a record of every invocation and completion in the system. This log is the source of truth for `when` clause evaluation and provenance tracking.

```typescript
interface ActionRecord {
  id: string;
  type: "invocation" | "completion";
  concept: string;
  action: string;
  input: Record<string, unknown>;
  variant?: string;          // only on completions
  output?: Record<string, unknown>;  // only on completions
  flow: string;
  sync?: string;             // which sync produced this invocation
  parent?: string;           // ID of the completion that triggered this
  timestamp: string;
}
```

### 6.2 Evaluation Loop and Matching Algorithm

#### Overview

The engine's core loop is: receive a completion, find all syncs that should fire, evaluate their `where` clauses, and emit invocations. The critical piece is the **matching algorithm** — how the engine determines which syncs fire for a given completion.

**Semantics:** A sync fires once per unique combination of variable bindings drawn from its `when` clause. The provenance edge guard prevents duplicate firings. This means `when` clause matching behaves like a relational join over the flow's action log.

#### Index Structure

The engine maintains an index from `(concept, action)` pairs to the set of syncs that reference that pair in their `when` clause. When a completion arrives for `(concept: "urn:app/Password", action: "check")`, the engine only considers syncs indexed under that pair — not all registered syncs.

```typescript
// Built at sync registration time
type SyncIndex = Map<string, Set<CompiledSync>>;
// key = "concept:action", e.g. "urn:app/Password:check"

function indexKey(concept: string, action: string): string {
  return `${concept}:${action}`;
}
```

#### Matching Algorithm

```typescript
async function onCompletion(
  completion: ActionCompletion,
  log: ActionLog,
  index: SyncIndex,
  registry: ConceptRegistry,
): Promise<ActionInvocation[]> {
  // 1. Append completion to the action log
  log.append(completion);

  // 2. Find candidate syncs — those that reference this (concept, action)
  const key = indexKey(completion.concept, completion.action);
  const candidates = index.get(key);
  if (!candidates) return [];

  const allInvocations: ActionInvocation[] = [];

  // 3. For each candidate sync
  for (const sync of candidates) {

    // 4. Gather all completions in this flow
    const flowCompletions = log.getCompletionsForFlow(completion.flow);

    // 5. Find all valid binding combinations for the when clause
    const whenBindings = matchWhenClause(sync.when, flowCompletions, completion);

    // 6. For each binding set, check firing guard and evaluate
    for (const binding of whenBindings) {
      // 6a. Firing guard: has this sync already fired for this
      //     exact set of matched completions?
      const matchedIds = binding.__matchedCompletionIds;
      if (log.hasSyncEdge(matchedIds, sync.name)) continue;

      // 6b. Evaluate where clause (GraphQL or lite queries)
      const whereBindings = await evaluateWhere(
        sync.where, binding, registry
      );

      // 6c. For each where result, produce invocations
      for (const fullBinding of whereBindings) {
        const invocations = buildInvocations(
          sync.then, fullBinding, completion.flow, sync.name
        );

        // 6d. Record provenance edges
        for (const inv of invocations) {
          log.appendInvocation(inv);
          for (const completionId of matchedIds) {
            log.addSyncEdge(completionId, inv.id, sync.name);
          }
        }

        allInvocations.push(...invocations);
      }
    }
  }

  return allInvocations;
}
```

#### When-Clause Pattern Matching

The `when` clause contains one or more action patterns. Each pattern specifies a `concept/action` pair plus optional field constraints on input and output. The matching algorithm finds all combinations of completions in the flow that satisfy all patterns with consistent variable bindings.

```typescript
interface WhenPattern {
  concept: string;
  action: string;
  inputFields: FieldPattern[];   // field name -> literal or variable
  outputFields: FieldPattern[];
}

interface FieldPattern {
  name: string;
  match: { type: "literal"; value: unknown }
       | { type: "variable"; name: string }
       | { type: "wildcard" };
}

interface Binding {
  [variableName: string]: unknown;
  __matchedCompletionIds: string[];  // which completions produced this binding
}

/**
 * Find all valid binding combinations for a when clause.
 *
 * @param patterns - The action patterns from the sync's when clause
 * @param completions - All completions in the current flow
 * @param trigger - The completion that just arrived (must appear in at least one match)
 * @returns Array of variable bindings, one per unique combination
 */
function matchWhenClause(
  patterns: WhenPattern[],
  completions: ActionCompletion[],
  trigger: ActionCompletion,
): Binding[] {
  // For each pattern, find all completions that match its concept/action
  // and field constraints. Then compute the cross product of matches
  // across all patterns, keeping only combinations where:
  //   a) variable bindings are consistent (same variable = same value)
  //   b) the trigger completion appears in at least one position

  // Step 1: For each pattern, find candidate completions
  const candidatesPerPattern: ActionCompletion[][] = patterns.map(pattern =>
    completions.filter(c =>
      c.concept === pattern.concept && c.action === pattern.action
    )
  );

  // Step 2: Enumerate combinations (cross product)
  const combinations = crossProduct(candidatesPerPattern);

  // Step 3: Filter and bind
  const results: Binding[] = [];

  for (const combo of combinations) {
    // combo is an array of completions, one per pattern

    // Must include the trigger
    if (!combo.some(c => c.id === trigger.id)) continue;

    // Try to build a consistent binding
    const binding: Binding = { __matchedCompletionIds: combo.map(c => c.id) };
    let consistent = true;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const completion = combo[i];

      // Match input fields
      for (const field of pattern.inputFields) {
        const value = completion.input[field.name];
        if (!matchField(field, value, binding)) {
          consistent = false;
          break;
        }
      }
      if (!consistent) break;

      // Match output fields
      for (const field of pattern.outputFields) {
        const value = completion.output?.[field.name];
        if (!matchField(field, value, binding)) {
          consistent = false;
          break;
        }
      }
      if (!consistent) break;
    }

    if (consistent) {
      // Deduplicate: only add if this binding set is unique
      const isDuplicate = results.some(existing =>
        binding.__matchedCompletionIds.every(
          (id, i) => id === existing.__matchedCompletionIds[i]
        )
      );
      if (!isDuplicate) results.push(binding);
    }
  }

  return results;
}

/**
 * Try to match a field pattern against a value, updating bindings.
 * Returns false if inconsistent.
 */
function matchField(
  field: FieldPattern,
  value: unknown,
  binding: Binding,
): boolean {
  switch (field.match.type) {
    case "wildcard":
      return true;
    case "literal":
      return value === field.match.value;
    case "variable":
      const varName = field.match.name;
      if (varName in binding) {
        return binding[varName] === value;  // consistency check
      } else {
        binding[varName] = value;           // new binding
        return true;
      }
  }
}
```

#### Performance Notes

The cross product in `matchWhenClause` is potentially expensive, but in practice:

- Most flows have fewer than 50 completions.
- Most patterns match only 1-3 completions per pattern.
- The sync index ensures only relevant syncs are considered.
- The trigger filter eliminates most combinations early.

For the rare case of a flow with many matching completions (e.g., a batch import producing hundreds of `Tag/add` completions), the engine can apply the provenance edge check incrementally — skipping combinations where edges already exist — rather than computing the full cross product first.

### 6.3 Flow Management

A **flow** is a directed acyclic graph of action records sharing a flow token, rooted at an external stimulus (e.g., an HTTP request, a user gesture, a timer). The engine:

- Assigns a new flow token to each external stimulus
- Propagates the token through all synchronizations
- Tracks the DAG via parent pointers
- Considers a flow complete when no pending invocations remain

### 6.4 Transport Layer

The engine communicates with concepts through **transport adapters**. Each adapter implements a common interface that abstracts over both query modes:

```typescript
interface ConceptTransport {
  /** Execute an action on the concept */
  invoke(invocation: ActionInvocation): Promise<ActionCompletion>;

  /** Query the concept's state — dispatches to the appropriate mode */
  query(request: ConceptQuery): Promise<Record<string, unknown>[]>;

  /** Optional: receive push completions from the concept */
  subscribe?(channel: string): AsyncIterable<ActionCompletion>;

  /** Health check for availability tracking */
  health(): Promise<{ available: boolean; latency: number }>;

  /** Which query mode this concept uses */
  queryMode: "graphql" | "lite";
}

/**
 * Unified query request — the engine always produces these.
 * The transport adapter translates to the appropriate protocol.
 */
interface ConceptQuery {
  /** The state relation to query (from the concept spec) */
  relation: string;
  /** Field-value filters (from where clause variable bindings) */
  args?: Record<string, unknown>;
  /** For full-GraphQL mode: the raw GraphQL query string */
  graphql?: string;
  /** For full-GraphQL mode: query variables */
  graphqlVariables?: Record<string, unknown>;
}
```

The engine never calls GraphQL or lite protocol methods directly — it always goes through `ConceptTransport.query()`. This means syncs and the engine evaluation loop are completely agnostic to the query mode.

Provided adapters:

| Adapter        | Query Mode | Use Case |
|---------------|------------|----------|
| `InProcessGraphQLAdapter` | Full GraphQL | Concept runs in same process with a GraphQL schema. |
| `InProcessLiteAdapter` | Lite | Concept runs in same process, exposes snapshot/lookup/filter. |
| `HttpGraphQLAdapter` | Full GraphQL | Remote concept with a GraphQL HTTP endpoint. |
| `HttpLiteAdapter` | Lite | Remote concept with JSON-RPC for snapshot/lookup/filter. |
| `WebSocketAdapter` | Either | Persistent connection. Negotiates mode on handshake. |
| `WorkerAdapter` | Either | Concept runs in a Web Worker or Node worker thread. |

The engine's concept registry maps concept URIs to transport adapters:

```typescript
interface ConceptRegistry {
  register(uri: string, transport: ConceptTransport): void;
  resolve(uri: string): ConceptTransport;
  available(uri: string): boolean;
}
```

### 6.5 Where-Clause Evaluation

The `where` clause is the point where the engine queries concept state. The sync compiler translates each `where` clause into a **query plan** — a set of `ConceptQuery` objects (Section 6.4) plus a join strategy.

Consider this sync:

```
sync CascadeDeleteComments [eager]
when {
  Article/delete: [ article: ?article ] => []
}
where {
  Comment: { ?comment target: ?article }
  User: { ?comment author: ?author }
}
then {
  Comment/delete: [ comment: ?comment ]
  Notify/send: [ user: ?author; message: "Your comment was removed" ]
}
```

The compiler produces a query plan with two steps:

1. Query the Comment concept for all entries where `target = ?article` (binding `?comment` for each result)
2. For each `?comment`, query the User concept for `author` (binding `?author`)

The plan is expressed as `ConceptQuery` objects, which are agnostic to query mode:

```typescript
// Step 1: issued to Comment concept's transport adapter
{
  relation: "comments",
  args: { target: bindings["?article"] }
}

// Step 2: issued to User concept's transport adapter (once per result from step 1)
{
  relation: "authors",
  args: { comment: bindings["?comment"] }
}
```

The transport adapter for each concept routes these queries appropriately:

- **Full-GraphQL concepts** translate the `ConceptQuery` into a GraphQL query string using the generated schema (e.g., `query { comments(target: "a-123") { comment, target, author } }`) and execute it against the concept's GraphQL endpoint.
- **Lite-query concepts** call `lookup` for single-key queries, `filter` for simple predicates, or `snapshot` + in-engine filtering for anything more complex. The LiteQueryAdapter (Section 4.2) handles this dispatch.

The sync compiler can optimize across both modes:

- **Batching:** When the engine knows a concept is in lite mode and a query will hit all entries, it fetches a single snapshot and filters locally, rather than issuing N individual lookups.
- **Caching:** For lite-mode concepts, the engine reuses cached snapshots within the same flow (snapshots are invalidated only by action completions from the concept).
- **Join pushdown:** When two relations being joined belong to the same full-GraphQL concept, the compiler can emit a single nested GraphQL query instead of two round-trips.

### 6.6 Eventual Synchronization Queue

For `[eventual]` syncs, when a referenced concept is unavailable:

1. The engine records the pending sync with its current bindings in a durable queue.
2. The registry emits availability events when concepts come online.
3. On availability change, the engine re-evaluates all pending syncs that reference the newly available concept.
4. Idempotency is guaranteed by the provenance edge check (Section 6.2, step 2b).

### 6.7 Provenance Graph

Every action record is connected to its causal predecessors. The full provenance graph for a flow can be queried to answer:

- "What actions led to this outcome?"
- "Which synchronization caused this invocation?"
- "What was the full causal chain from the initial request to the final response?"

This graph is itself exposed as a concept (see Section 9, bootstrapping) and queryable via GraphQL.

### 6.8 Concept Storage Interface

Every concept implementation receives a `ConceptStorage` instance. This is the concept's interface to its own persistent data. The storage is **document-oriented, organized by relation** — the relations are derived from the concept's state section using the grouping rules in Section 2.4.

```typescript
/**
 * Storage interface passed to every concept action handler.
 * Each concept gets its own isolated storage instance.
 * The relation names come from the compiled concept manifest.
 */
interface ConceptStorage {
  /**
   * Write a record to a relation. If a record with this key
   * already exists, it is overwritten.
   *
   * @param relation - Relation name from the concept manifest
   * @param key - Primary key (typically a type parameter value, e.g. user ID)
   * @param value - Record fields (must conform to the relation schema)
   */
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;

  /**
   * Get a single record by its primary key.
   * Returns null if no record exists for this key.
   */
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;

  /**
   * Find all records in a relation matching the given field criteria.
   * Criteria are ANDed: all specified fields must match.
   * If no criteria, returns all records in the relation.
   *
   * For set-valued relations (e.g., followers: U -> set U),
   * each element in the set is a separate record.
   */
  find(
    relation: string,
    criteria?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]>;

  /**
   * Delete a single record by its primary key.
   * No-op if the record does not exist.
   */
  del(relation: string, key: string): Promise<void>;

  /**
   * Delete all records matching the given criteria.
   * Returns the number of records deleted.
   */
  delMany(relation: string, criteria: Record<string, unknown>): Promise<number>;
}
```

#### Provided Implementations

The framework ships with storage backends. Each implements `ConceptStorage`:

```typescript
/**
 * In-memory storage. Used for tests and lightweight concepts.
 * Data is lost on process restart.
 */
function createInMemoryStorage(): ConceptStorage;

/**
 * SQLite storage. Each relation becomes a table.
 * Columns are derived from the concept manifest's relation schema.
 * Suitable for phones, CLI tools, and small server concepts.
 */
function createSQLiteStorage(dbPath: string, manifest: ConceptManifest): ConceptStorage;

/**
 * PostgreSQL storage. Each relation becomes a table.
 * Suitable for server concepts with large state.
 */
function createPostgresStorage(connectionUrl: string, manifest: ConceptManifest): ConceptStorage;
```

#### Storage and the Query Layer

The lite query protocol (Section 4.2, Mode B) is **auto-generated** as a thin wrapper over `ConceptStorage`. The compiler generates the `snapshot`, `lookup`, and `filter` implementations directly from the storage calls:

```typescript
// Auto-generated lite query protocol for Password concept
function createPasswordLiteQuery(storage: ConceptStorage): LiteQueryProtocol {
  return {
    async snapshot() {
      const entries = await storage.find("password");
      return {
        asOf: new Date().toISOString(),
        relations: { password: entries },
      };
    },

    async lookup(relation, key) {
      if (relation !== "password") return null;
      return storage.get("password", key);
    },

    async filter(criteria) {
      const storeCriteria: Record<string, unknown> = {};
      for (const c of criteria) {
        if (c.op === "eq") storeCriteria[c.field] = c.value;
        // other ops handled by post-filtering
      }
      const results = await storage.find("password", storeCriteria);
      // post-filter for non-eq operators
      return results.filter(r =>
        criteria.every(c => applyFilter(r, c))
      );
    },
  };
}
```

This means the concept implementor writes **zero query code**. The storage interface is the only data access layer they touch. Both the lite query protocol and the full GraphQL resolvers (when used) delegate to the same `ConceptStorage` methods.

#### Relation Schema in the Concept Manifest

The compiler produces a `ConceptManifest` that includes the relation schema. Storage backends use this to create tables/collections with the right structure:

```typescript
interface ConceptManifest {
  uri: string;
  name: string;
  typeParams: string[];
  relations: RelationSchema[];
  actions: ActionSchema[];
}

interface RelationSchema {
  name: string;           // e.g. "password" (from merge rule or explicit group)
  keyField: string;       // e.g. "user" (from the domain type param)
  keyType: string;        // always "string" for type params
  fields: FieldSchema[];  // e.g. [{ name: "hash", type: "bytes" }, ...]
  source: "merged" | "explicit" | "set-valued";
}

interface FieldSchema {
  name: string;
  type: string;           // JSON-compatible type name
  optional: boolean;
}
```

---

## 7. Compiler Pipeline

### 7.1 Inputs and Outputs

```
Input:  .concept files
        .sync files
        target language config
        deployment manifest

Output: Per concept:
          - GraphQL schema fragment (.graphql)
          - JSON Schemas for each action (.schema.json)
          - Language-specific skeleton code
          - Conformance test suite

        Per sync file:
          - Compiled sync registration module
          - Sync validation report

        System-wide:
          - Federated GraphQL schema
          - Engine configuration
          - Deployment validation report
```

### 7.2 Compilation Phases

**Phase 1: Parse.** Read `.concept` files into an AST. Validate grammar, check for name collisions, resolve type parameter references.

**Phase 2: Validate.** Check that all type expressions are well-formed. Verify that invariant action patterns reference declared actions with correct argument names. Check that return variants in invariants match declared variants. Produce warnings for informal spec sections that may be ambiguous.

**Phase 3: Schema Generation.**

- Emit GraphQL type definitions from state components.
- Emit JSON Schema for each action's invocation and completion variants.
- Emit a concept manifest (URI, actions, state components, type parameters, capabilities).

**Phase 4: Sync Compilation.**

- Parse `.sync` files.
- Resolve all concept and action references against concept manifests.
- Validate that field patterns in `when` match declared action signatures.
- Validate that field assignments in `then` match declared action input signatures.
- Validate that concept references in `where` match declared state components.
- Compile `where` clauses into GraphQL query templates with variable placeholders.
- Emit compiled sync modules (TypeScript) that register with the engine.

**Phase 5: Code Generation.**

For the target language, emit:

- **Type definitions** for all state components, action inputs, and action outputs.
- **Action handler interface/trait** with one method per action, one overload per return variant.
- **Query layer** — mode-dependent, selected by deployment manifest:
  - *Full GraphQL mode:* GraphQL resolver skeleton that reads from the concept's storage and maps to the generated GraphQL schema.
  - *Lite query mode:* Generated `snapshot`/`lookup`/`filter` implementations that read from the concept's storage using the state schema. No GraphQL library dependency.
- **Transport adapter** that deserializes invocations, dispatches to the handler, serializes completions, and routes queries to the appropriate query layer.
- **Conformance tests** from invariants: set up state via action sequences, assert outcomes.
- **Storage interface** — an abstract trait/interface for persistence, with an in-memory implementation for testing.

**Phase 6: Deployment Validation.**

- Read deployment manifest.
- Check that each concept's declared capabilities are satisfied by the target runtime.
- Check that all concepts referenced by syncs have deployment entries.
- Warn about `[eager]` syncs that span runtimes with high latency or unreliable connectivity.
- Produce a deployment plan showing which concepts run where and which syncs are evaluated by which engine instance.

### 7.3 Generated TypeScript Skeleton Example

For the Password concept:

```typescript
// generated: password.types.ts
export interface PasswordSetInput {
  user: string;
  password: string;
}

export type PasswordSetOutput =
  | { variant: "ok"; user: string }
  | { variant: "invalid"; message: string };

export interface PasswordCheckInput {
  user: string;
  password: string;
}

export type PasswordCheckOutput =
  | { variant: "ok"; valid: boolean }
  | { variant: "notfound"; message: string };

export interface PasswordValidateInput {
  password: string;
}

export type PasswordValidateOutput =
  | { variant: "ok"; valid: boolean };

// generated: password.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./password.types";

export interface PasswordHandler {
  set(input: T.PasswordSetInput, storage: ConceptStorage):
    Promise<T.PasswordSetOutput>;
  check(input: T.PasswordCheckInput, storage: ConceptStorage):
    Promise<T.PasswordCheckOutput>;
  validate(input: T.PasswordValidateInput, storage: ConceptStorage):
    Promise<T.PasswordValidateOutput>;
}

// generated: password.adapter.ts
import type {
  ActionInvocation, ActionCompletion,
  ConceptTransport, ConceptQuery
} from "@copf/runtime";
import type { PasswordHandler } from "./password.handler";

/**
 * Full-mode adapter: concept serves its own GraphQL resolvers.
 * Used when queryMode: "graphql" in the deployment manifest.
 */
export function createPasswordGraphQLAdapter(
  handler: PasswordHandler,
  storage: ConceptStorage,
  resolvers: PasswordResolvers,  // generated GraphQL resolvers
): ConceptTransport {
  return {
    queryMode: "graphql",
    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const result = await handler[invocation.action](
        invocation.input,
        storage
      );
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant: result.variant,
        output: result,
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    },
    async query(request: ConceptQuery) {
      // dispatch to generated GraphQL resolvers
      return resolvers.resolve(request.graphql!, request.graphqlVariables);
    },
    async health() {
      return { available: true, latency: 0 };
    },
  };
}

/**
 * Lite-mode adapter: concept exposes snapshot/lookup/filter.
 * Used when queryMode: "lite" in the deployment manifest.
 * No GraphQL library needed on the concept side.
 */
export function createPasswordLiteAdapter(
  handler: PasswordHandler,
  storage: ConceptStorage,
): ConceptTransport {
  return {
    queryMode: "lite",
    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      // identical to GraphQL adapter — action dispatch is mode-agnostic
      const result = await handler[invocation.action](
        invocation.input,
        storage
      );
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant: result.variant,
        output: result,
        flow: invocation.flow,
        timestamp: new Date().toISOString(),
      };
    },
    async query(request: ConceptQuery) {
      // Lite path: read directly from storage using generated accessors
      if (request.args && "user" in request.args) {
        // lookup path
        const user = String(request.args.user);
        const hash = await storage.get(`hash:${user}`);
        const salt = await storage.get(`salt:${user}`);
        if (!hash) return [];
        return [{ user, hash: encode(hash), salt: encode(salt) }];
      }
      // snapshot path: return all entries
      const keys = await storage.keys("hash:*");
      return Promise.all(keys.map(async (k) => {
        const user = k.replace("hash:", "");
        return {
          user,
          hash: encode(await storage.get(k)),
          salt: encode(await storage.get(`salt:${user}`)),
        };
      }));
    },
    async health() {
      return { available: true, latency: 0 };
    },
  };
}
```

Note that the lite-mode query implementation is also **generated from the spec**. The compiler knows the state schema (`hash: U -> Bytes`, `salt: U -> Bytes`) and generates the appropriate storage access patterns. The concept implementor writes only the action handler — the query layer is fully derived.

For **cross-language lite-mode concepts** (e.g., Swift on iOS), the generated code is even simpler, since the concept just implements the `LiteQueryProtocol` (Section 4.2, Mode B) natively:

```swift
// generated: PasswordLiteQuery.swift
// Concept implementor fills in storage access

protocol PasswordLiteQuery {
  func snapshot() async throws -> ConceptStateSnapshot
  func lookup(relation: String, key: String) async throws -> [String: Any]?
}

// generated default implementation using the spec's state schema
extension PasswordLiteQuery {
  func snapshot() async throws -> ConceptStateSnapshot {
    let entries = try await self.allEntries()  // implementor provides this
    return ConceptStateSnapshot(
      asOf: ISO8601DateFormatter().string(from: Date()),
      relations: ["entries": entries]
    )
  }

  func lookup(relation: String, key: String) async throws -> [String: Any]? {
    guard relation == "entries" else { return nil }
    return try await self.entryForUser(key)    // implementor provides this
  }
}
```
```

The implementor writes only:

```typescript
// user-written: password.impl.ts
import type { PasswordHandler } from "./generated/password.handler";
import { createHash, randomBytes } from "crypto";

export const passwordHandler: PasswordHandler = {
  async set(input, storage) {
    if (input.password.length < 8) {
      return { variant: "invalid", message: "Password must be at least 8 characters" };
    }
    const salt = randomBytes(16);
    const hash = createHash("sha256").update(input.password).update(salt).digest();
    await storage.put(`hash:${input.user}`, hash);
    await storage.put(`salt:${input.user}`, salt);
    return { variant: "ok", user: input.user };
  },

  async check(input, storage) {
    const salt = await storage.get(`salt:${input.user}`);
    if (!salt) return { variant: "notfound", message: "No credentials for user" };
    const hash = createHash("sha256").update(input.password).update(salt).digest();
    const stored = await storage.get(`hash:${input.user}`);
    return { variant: "ok", valid: hash.equals(stored) };
  },

  async validate(input, _storage) {
    return { variant: "ok", valid: input.password.length >= 8 };
  },
};
```

### 7.4 Conformance Test Generation

The compiler generates conformance tests from the `invariant` section of each concept spec. Each invariant becomes a test case that exercises the concept's action handler against a fresh storage instance.

#### Generation Rules

1. **Free variables** in invariants (e.g., `x` in `set(user: x, ...)`) are assigned deterministic test IDs: `"u-test-invariant-001"`, `"u-test-invariant-002"`, etc. Variables are numbered in order of first appearance.

2. **The `after` clause** becomes a sequence of action calls. Each call asserts the expected return variant. If the `after` clause has multiple actions (separated by `and`), they execute in order — each must succeed before the next.

3. **The `then` clause** becomes assertion calls. Each `then`/`and` action is called and its output is asserted against the expected variant and field values.

4. **Literal values** in patterns are asserted exactly. Variables are checked for consistency — if `x` appears in both `after` and `then`, the test asserts the same concrete value flows through.

5. **Multiple invariants** in a spec produce multiple test cases, each with isolated storage.

#### Generated Test Template

For the Password concept:

```
invariant {
  after set(user: x, password: "secret") -> ok(user: x)
  then check(user: x, password: "secret") -> ok(valid: true)
  and  check(user: x, password: "wrong")  -> ok(valid: false)
}
```

The compiler generates:

```typescript
// generated: password.conformance.test.ts
import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "@copf/runtime";
// The handler import path comes from the deployment manifest
// or a default convention: ./<concept>.impl
import { passwordHandler } from "./password.impl";

describe("Password conformance", () => {

  it("invariant 1: after set, check returns true for correct password and false for wrong", async () => {
    const storage = createInMemoryStorage();

    // Free variable bindings
    const x = "u-test-invariant-001";

    // --- AFTER clause ---
    // set(user: x, password: "secret") -> ok(user: x)
    const step1 = await passwordHandler.set(
      { user: x, password: "secret" },
      storage,
    );
    expect(step1.variant).toBe("ok");
    expect((step1 as any).user).toBe(x);

    // --- THEN clause ---
    // check(user: x, password: "secret") -> ok(valid: true)
    const step2 = await passwordHandler.check(
      { user: x, password: "secret" },
      storage,
    );
    expect(step2.variant).toBe("ok");
    expect((step2 as any).valid).toBe(true);

    // check(user: x, password: "wrong") -> ok(valid: false)
    const step3 = await passwordHandler.check(
      { user: x, password: "wrong" },
      storage,
    );
    expect(step3.variant).toBe("ok");
    expect((step3 as any).valid).toBe(false);
  });

});
```

#### Edge Cases

- **Invariants that test error variants:** If an `after` clause expects `-> invalid(...)`, the test asserts that variant and continues. This validates that the concept correctly rejects invalid input.

- **Multi-step `after` clauses:** `after register(...) -> ok(...) and update(...) -> ok(...)` generates two sequential calls, both asserted.

- **Invariants referencing type parameters:** All type parameter values are opaque strings in tests. The test doesn't need to know what a "user" is — it just uses string IDs.

---

## 8. Deployment Manifest

### 8.1 Format

```yaml
# app.deploy.yaml
app:
  name: conduit
  version: 0.1.0
  uri: urn:conduit

runtimes:
  server:
    type: node
    engine: true           # runs a sync engine instance
    transport: in-process
  ios:
    type: swift
    engine: true           # local engine for offline syncs
    transport: websocket
    upstream: server       # coordinates with server engine

concepts:
  Password:
    spec: ./specs/password.concept
    implementations:
      - language: typescript
        path: ./server/concepts/password
        runtime: server
        storage: sqlite
        queryMode: graphql      # full GraphQL resolvers

  Profile:
    spec: ./specs/profile.concept
    implementations:
      - language: typescript
        path: ./server/concepts/profile
        runtime: server
        storage: postgres
        queryMode: graphql
      - language: swift
        path: ./ios/concepts/profile
        runtime: ios
        storage: coredata
        queryMode: lite          # snapshot/lookup/filter only
        cacheTtl: 10000          # engine caches snapshots for 10s

syncs:
  - path: ./syncs/auth.sync
    engine: server

  - path: ./syncs/articles.sync
    engine: server

  - path: ./syncs/profile-sync.sync
    engine: server
    annotations:
      - eventual

  - path: ./syncs/local-profile.sync
    engine: ios
    annotations:
      - local
```

### 8.2 Engine Hierarchy

When multiple runtimes have `engine: true`, the system forms an engine hierarchy:

- Each engine instance evaluates syncs assigned to it.
- Engines assigned syncs referencing concepts on other runtimes issue cross-runtime transport calls.
- The `upstream` field on a runtime establishes a coordination relationship: the downstream engine forwards completions upstream so the coordinating engine can evaluate cross-runtime syncs.
- When the downstream runtime is offline, it evaluates `[local]` syncs independently and queues `[eventual]` syncs for later upstream forwarding.

---

## 9. Concept Kits

Some concepts are naturally designed to work together — they form a coherent system only when connected by syncs. A **kit** is a package of concepts, their standard syncs, and a type parameter mapping that declares how the concepts relate to each other.

Kits are a packaging convention, not a language construct. The framework does not have first-class knowledge of kits — it loads the specs and syncs like any others. The kit manifest is metadata for humans, LLMs, package managers, and the compiler's validation tooling. A language construct may be added in the future once real usage patterns emerge.

### 9.1 Kit Manifest Format

A kit is a directory with a `kit.yaml` manifest:

```yaml
# kits/content-management/kit.yaml
kit:
  name: content-management
  version: 0.1.0
  description: >
    Drupal-style entity/field/relation system for structured content.
    Provides typed entities with attachable fields and inter-entity
    relationships, with cascade lifecycle management.

# Concepts included in this kit and how their type parameters align.
# The 'as' field declares a shared type identity across concepts.
concepts:
  Entity:
    spec: ./entity.concept
    params:
      E: { as: entity-ref, description: "Reference to an entity" }

  Field:
    spec: ./field.concept
    params:
      F: { as: field-ref, description: "Reference to a field instance" }
      T: { as: entity-ref }    # same as Entity's E

  Relation:
    spec: ./relation.concept
    params:
      R: { as: relation-ref, description: "Reference to a relation" }
      T: { as: entity-ref }    # same as Entity's E

  Node:
    spec: ./node.concept
    params:
      N: { as: entity-ref }    # Node IS an entity

# Syncs bundled with the kit, with tier annotations.
syncs:
  # Required syncs: removing these causes data corruption or
  # violates invariants that the concepts depend on. Apps cannot
  # override or disable these.
  required:
    - path: ./syncs/cascade-delete-fields.sync
      description: >
        When an entity is deleted, all attached fields are detached
        and deleted. Without this, the Field concept accumulates
        orphaned records.

    - path: ./syncs/cascade-delete-relations.sync
      description: >
        When an entity is deleted, all relations sourced from or
        targeting it are unlinked. Without this, the Relation concept
        holds dangling references.

    - path: ./syncs/entity-lifecycle.sync
      description: >
        Sets created/updated timestamps on entity create and field
        attach. Without this, entity timestamps are never populated.

  # Recommended syncs: useful defaults that most apps will want.
  # Apps can override (replace) or disable these.
  recommended:
    - path: ./syncs/default-title-field.sync
      name: DefaultTitleField
      description: >
        When a node is created, automatically attach a title field.
        Override if your app uses a different title convention.

    - path: ./syncs/node-create-entity.sync
      name: NodeCreateEntity
      description: >
        When a node is created, create the underlying entity first.
        Override if you need custom entity initialization logic.

    - path: ./syncs/update-timestamp-on-field-change.sync
      name: UpdateTimestamp
      description: >
        When a field is attached or updated, touch the entity's
        updated timestamp. Disable if you manage timestamps differently.

# Optional: concepts from other kits that this kit works with.
# These are not dependencies — the kit functions without them —
# but if present, additional syncs activate.
integrations:
  - kit: auth
    syncs:
      - path: ./syncs/entity-ownership.sync
        description: >
          When a user creates an entity, record ownership. Requires
          the auth kit's User concept.
```

### 9.2 Type Parameter Alignment

The `params` section declares a shared identity namespace across concepts using `as` tags. In the example above, Entity's `E`, Field's `T`, Relation's `T`, and Node's `N` all share `as: entity-ref`. This means:

- They all carry the same kind of opaque identifier at runtime.
- Syncs within the kit can safely pass values between them (a UUID from Entity/create flows into Field/attach as the target).
- The compiler can validate that kit syncs respect these alignments — if a sync passes a `field-ref` where an `entity-ref` is expected, that's a warning.

This validation is **advisory, not enforcing**. At runtime, all type parameters are strings. But the alignment metadata lets the compiler catch likely mistakes in syncs, and it documents the intended relationships for humans and LLMs writing new syncs against the kit.

### 9.3 Sync Tiers

Kit syncs are divided into two tiers:

**Required syncs** enforce structural invariants that the kit's concepts depend on. If removed, concept state becomes inconsistent — orphaned records, dangling references, unpopulated fields. These are loaded automatically when the kit is used, and the compiler emits an error if an app attempts to disable them.

Required syncs should be kept to a minimum — only syncs where removal causes data corruption. "Cascade delete fields when entity is deleted" is required because without it, the Field concept silently accumulates garbage. "Send a notification when an entity is created" is not required — nothing breaks if you remove it, it's just a nice feature.

**Recommended syncs** are loaded by default but can be overridden or disabled by the app. To override, the app declares a sync with the same `name` as the kit sync — the app's version replaces the kit's version. To disable, the app lists the sync name in a `disable` block in the deployment manifest.

```yaml
# In the app's deploy.yaml
kits:
  - name: content-management
    version: 0.1.0
    overrides:
      # Replace the default title field sync with a custom one
      DefaultTitleField: ./syncs/custom-title.sync
    disable:
      # Don't auto-update timestamps — we handle this in a custom sync
      - UpdateTimestamp
```

**Enforcement:**

- **At compile time:** The compiler warns if a required sync is missing from the final sync set. It errors if an app explicitly disables a required sync.
- **At runtime:** The engine has no concept of tiers — all syncs are evaluated equally. The distinction is purely a compile-time and packaging concern.

### 9.4 Kit Syncs — The Content Management Example

Here are the key syncs for the content management kit:

**Required: Cascade Delete Fields**

```
sync CascadeDeleteFields [required] {
  when {
    Entity/delete: [ entity: ?entity ]
      => [ entity: ?entity ]
  }
  where {
    Field: { ?field target: ?entity }
  }
  then {
    Field/detach: [ field: ?field ]
  }
}
```

**Required: Cascade Delete Relations**

```
sync CascadeDeleteRelations [required] {
  when {
    Entity/delete: [ entity: ?entity ]
      => [ entity: ?entity ]
  }
  where {
    Relation: { ?rel source: ?entity }
    Relation: { ?rel2 target: ?entity }
  }
  then {
    Relation/unlink: [ rel: ?rel ]
    Relation/unlink: [ rel: ?rel2 ]
  }
}
```

**Recommended: Node Creates Entity**

```
sync NodeCreateEntity [recommended] {
  when {
    Web/request: [
      method: "create_node";
      bundle: ?bundle;
      title: ?title ]
      => []
  }
  where {
    bind(uuid() as ?entity)
  }
  then {
    Entity/create: [ entity: ?entity; bundle: ?bundle ]
  }
}
```

**Recommended: Default Title Field**

```
sync DefaultTitleField [recommended] {
  when {
    Web/request: [
      method: "create_node";
      title: ?title ]
      => []
    Entity/create: [ entity: ?entity ]
      => [ entity: ?entity ]
  }
  where {
    bind(uuid() as ?field)
  }
  then {
    Field/attach: [
      field: ?field;
      target: ?entity;
      name: "title";
      value: ?title ]
  }
}
```

### 9.5 Using a Kit in an App

An app references kits in its deployment manifest. The compiler resolves kit paths, loads all concept specs and syncs, applies overrides and disables, validates type parameter alignment, and produces the final set of specs and syncs for compilation.

```yaml
# app.deploy.yaml
app:
  name: my-cms
  version: 1.0.0

kits:
  - name: content-management
    path: ./kits/content-management  # or a registry reference
    overrides:
      DefaultTitleField: ./syncs/my-custom-title.sync
    disable:
      - UpdateTimestamp

  - name: auth
    path: ./kits/auth

# App-specific concepts (not from any kit)
concepts:
  Theme:
    spec: ./specs/theme.concept
    implementations:
      - language: typescript
        path: ./server/concepts/theme
        runtime: server
        storage: sqlite
        queryMode: lite

# App-specific syncs
syncs:
  - path: ./syncs/apply-theme.sync
    engine: server
  - path: ./syncs/custom-timestamps.sync
    engine: server
```

### 9.6 Kit Directory Structure

```
kits/
└── content-management/
    ├── kit.yaml                # Kit manifest
    ├── entity.concept          # Concept specs
    ├── field.concept
    ├── relation.concept
    ├── node.concept
    ├── syncs/
    │   ├── cascade-delete-fields.sync       # Required
    │   ├── cascade-delete-relations.sync    # Required
    │   ├── entity-lifecycle.sync            # Required
    │   ├── default-title-field.sync         # Recommended
    │   ├── node-create-entity.sync          # Recommended
    │   ├── update-timestamp-on-field-change.sync  # Recommended
    │   └── entity-ownership.sync            # Integration (auth)
    ├── implementations/
    │   └── typescript/         # Default implementations
    │       ├── entity.impl.ts
    │       ├── field.impl.ts
    │       ├── relation.impl.ts
    │       └── node.impl.ts
    └── tests/
        ├── conformance/        # Generated from invariants
        └── integration/        # Kit-level integration tests
```

### 9.7 Kit Design Guidelines

**Keep required syncs minimal.** A sync is required only if removing it causes data corruption — orphaned records, dangling references, violated uniqueness constraints. Behavioral preferences (notifications, defaults, formatting) are always recommended.

**One purpose per concept, even within a kit.** A kit doesn't change the concept design rules. Entity handles lifecycle, Field handles attachment, Relation handles linking. Don't create a "Node" concept that combines all three — that defeats the modularity that makes kits composable.

**Design for override at the recommended level.** When writing a recommended sync, ask: "What would an app replace this with?" If the answer is "nothing, they'd just remove it," use `disable`. If the answer is "a different version of the same behavior," use `override` with a named sync.

**Ship implementations, not just specs.** A kit should include default implementations for all its concepts. Apps can use them as-is, or provide their own implementations that conform to the same specs. The kit's integration tests validate that the default implementations work with the kit's syncs.

**Type parameter alignment is documentation, not enforcement.** The `as` tags help the compiler catch mistakes, but they don't prevent creative uses. An app might intentionally pass a User ID where an entity-ref is expected — if they've thought it through, the framework shouldn't stop them.

---

## 10. Bootstrapping Plan

The framework is self-hosting: the compiler, engine, and tooling are themselves implemented as concepts. This requires a staged bootstrap.

### 10.1 Bootstrap Stages

**Stage 0: The Kernel (hand-written TypeScript)**

A minimal, non-concept implementation that provides just enough to run the first concepts:

- A `.concept` file parser (AST only, no validation)
- A minimal sync engine (in-process, eager only, no persistence)
- A minimal transport layer (in-process function calls only)
- A minimal concept runtime (handler dispatch, in-memory storage)

This is ~1,000-2,000 lines of TypeScript. It does not use concepts or syncs internally. It is the only code in the system that is not spec-driven.

Target: can load a `.concept` file, register a hand-written concept handler, register a sync, and execute a flow.

**Stage 1: Core Concepts (specs + generated code, run on kernel)**

Define the framework's own functionality as concepts:

```
concept SpecParser [S]
purpose
  Parse .concept files into structured ASTs

state
  specs: set S
  ast: S -> AST

actions
  action parse(source: String)
    -> ok(spec: S, ast: AST)
    -> error(message: String, line: Int)
```

```
concept SchemaGen [S]
purpose
  Generate GraphQL and JSON schemas from parsed concept specs

state
  schemas: S -> { graphql: String; jsonSchemas: list String }

actions
  action generate(spec: S, ast: AST)
    -> ok(graphql: String, jsonSchemas: list String)
    -> error(message: String)
```

```
concept CodeGen [S]
purpose
  Generate language-specific skeleton code from concept specs

state
  outputs: S -> list { path: String; content: String }

actions
  action generate(spec: S, ast: AST, language: String)
    -> ok(files: list { path: String; content: String })
    -> error(message: String)
```

```
concept SyncParser [Y]
purpose
  Parse .sync files into structured ASTs and validate
  against concept manifests

state
  syncs: set Y
  ast: Y -> SyncAST

actions
  action parse(source: String, manifests: list Manifest)
    -> ok(sync: Y, ast: SyncAST)
    -> error(message: String, line: Int)
```

```
concept SyncCompiler [Y]
purpose
  Compile parsed synchronizations into executable registrations

state
  compiled: Y -> CompiledSync

actions
  action compile(sync: Y, ast: SyncAST)
    -> ok(compiled: CompiledSync)
    -> error(message: String)
```

```
concept ActionLog [R]
purpose
  Append-only log of all action invocations and completions.
  The engine's memory.

state
  records: set R
  record: R -> ActionRecord
  edges: R -> list { target: R; sync: String }

actions
  action append(record: ActionRecord)
    -> ok(id: R)
  action addEdge(from: R, to: R, sync: String)
    -> ok()
  action query(flow: String)
    -> ok(records: list ActionRecord)
```

```
concept Registry [C]
purpose
  Track deployed concepts, their locations, and availability

state
  concepts: set C
  uri: C -> String
  transport: C -> TransportConfig
  available: C -> Bool

actions
  action register(uri: String, transport: TransportConfig)
    -> ok(concept: C)
    -> error(message: String)
  action deregister(uri: String)
    -> ok()
  action heartbeat(uri: String)
    -> ok(available: Bool)
```

**Synchronizations for Stage 1:**

```
# When a spec is parsed, generate schemas
sync GenerateSchemas
when {
  SpecParser/parse: [] => [ spec: ?spec; ast: ?ast ]
}
then {
  SchemaGen/generate: [ spec: ?spec; ast: ?ast ]
}

# When schemas are generated, generate code
sync GenerateCode
when {
  SpecParser/parse: [] => [ spec: ?spec; ast: ?ast ]
  SchemaGen/generate: [ spec: ?spec ] => []
}
then {
  CodeGen/generate: [ spec: ?spec; ast: ?ast; language: "typescript" ]
}

# When a concept is registered, log it
sync LogRegistration
when {
  Registry/register: [] => [ concept: ?c ]
}
then {
  ActionLog/append: [ record: { type: "registration"; concept: ?c } ]
}
```

These concepts are implemented against the Stage 0 kernel. Their implementations are hand-written TypeScript (but conforming to specs). The specs exist primarily to validate the architecture and generate tests.

**Stage 2: Self-Compilation**

Use the Stage 1 concepts to compile themselves:

1. Feed the Stage 1 `.concept` files to the SpecParser concept.
2. Feed the parsed ASTs to SchemaGen — verify the output matches the hand-written schemas.
3. Feed the parsed ASTs to CodeGen — verify the generated skeletons match the hand-written handler interfaces.
4. Feed the `.sync` files to SyncParser and SyncCompiler — verify the compiled syncs match the hand-registered syncs from Stage 1.

At this point, the framework can generate its own type definitions and schemas from its own specs. The hand-written implementations of Stage 1 concepts are now validated against generated interfaces.

**Stage 3: Engine Self-Hosting**

Replace the Stage 0 kernel engine with a concept-based engine:

```
concept SyncEngine [F]
purpose
  Evaluate synchronizations by matching completions,
  querying state, and producing invocations

state
  syncs: set SyncRegistration
  pendingFlows: set F

actions
  action registerSync(sync: CompiledSync)
    -> ok()
  action onCompletion(completion: ActionCompletion)
    -> ok(invocations: list ActionInvocation)
  action evaluateWhere(bindings: Bindings, queries: list GraphQLQuery)
    -> ok(results: list Bindings)
    -> error(message: String)
```

The SyncEngine concept is itself run by the kernel engine. This is the key bootstrapping moment: the SyncEngine concept processes completions and emits invocations, while the kernel merely dispatches between it and the other concepts. The kernel's role shrinks to:

- Process startup
- Loading concept handlers and transport adapters
- Routing messages between the SyncEngine concept and other concepts

Eventually, even these responsibilities could be modeled as concepts (a Loader concept, a Router concept), but the kernel remains as the minimal trusted base.

**Stage 4: Multi-Target**

Once the compiler pipeline is self-hosting in TypeScript:

1. Write a Rust code generator (as a CodeGen concept variant, or as a new concept).
2. Re-implement one concept (e.g., Password) in Rust.
3. Deploy it with an HttpAdapter.
4. Verify interop: the TypeScript sync engine invokes the Rust concept, receives completions, evaluates syncs, queries state via GraphQL.

This validates the full cross-language story.

### 10.2 Bootstrap Dependency Graph

```
Stage 0 (hand-written kernel)
  │
  ├── minimal parser
  ├── minimal engine (eval loop)
  ├── minimal transport (in-process)
  └── minimal runtime (handler dispatch)
        │
Stage 1 (concept specs + hand-written impls on kernel)
  │
  ├── SpecParser concept
  ├── SchemaGen concept
  ├── CodeGen concept
  ├── SyncParser concept
  ├── SyncCompiler concept
  ├── ActionLog concept
  └── Registry concept
        │
Stage 2 (self-compilation)
  │
  ├── specs compile via own SpecParser
  ├── schemas generated via own SchemaGen
  ├── skeletons generated via own CodeGen
  └── syncs compiled via own SyncParser + SyncCompiler
        │
Stage 3 (engine self-hosting)
  │
  ├── SyncEngine concept replaces kernel eval loop
  ├── kernel reduced to process bootstrap + message routing
  └── all framework logic expressed as concepts + syncs
        │
Stage 4 (multi-target)
  │
  ├── additional CodeGen targets (Rust, Swift, etc.)
  ├── cross-language concept deployment
  └── distributed engine hierarchy
```

### 10.3 What Stays in the Kernel Forever

Some things cannot be concepts without infinite regress:

- **Process entry point.** Something has to start the engine.
- **Message dispatch.** The act of routing a completion to the SyncEngine concept and routing its output invocations to target concepts is pre-conceptual.
- **Transport adapter instantiation.** Creating the in-process, HTTP, or WebSocket connections that concepts communicate over.

These form the **trusted kernel** — perhaps 500 lines of TypeScript that never changes once stable. Everything above is spec-driven and self-hosting.

---

## 11. Project Structure

```
copf/
├── kernel/                     # Stage 0: hand-written minimal runtime
│   ├── src/
│   │   ├── parser.ts           # minimal .concept parser
│   │   ├── engine.ts           # minimal sync evaluation loop
│   │   ├── transport.ts        # in-process adapter
│   │   ├── runtime.ts          # handler dispatch
│   │   ├── storage.ts          # in-memory storage
│   │   └── index.ts            # process entry point
│   ├── package.json
│   └── tsconfig.json
│
├── specs/                      # All concept specifications
│   ├── framework/              # Stage 1: framework's own concepts
│   │   ├── spec-parser.concept
│   │   ├── schema-gen.concept
│   │   ├── code-gen.concept
│   │   ├── sync-parser.concept
│   │   ├── sync-compiler.concept
│   │   ├── action-log.concept
│   │   ├── registry.concept
│   │   └── sync-engine.concept
│   └── app/                    # Application concepts
│       ├── password.concept
│       ├── user.concept
│       ├── profile.concept
│       └── ...
│
├── syncs/                      # Synchronization definitions
│   ├── framework/              # Framework's own syncs
│   │   ├── compiler-pipeline.sync
│   │   └── engine-bootstrap.sync
│   └── app/                    # Application syncs
│       ├── auth.sync
│       ├── articles.sync
│       └── ...
│
├── generated/                  # Compiler output (gitignored or committed)
│   ├── schemas/
│   │   ├── graphql/
│   │   └── json/
│   ├── typescript/
│   ├── rust/
│   └── swift/
│
├── implementations/            # Hand-written action implementations
│   ├── typescript/
│   │   ├── framework/
│   │   │   ├── spec-parser.impl.ts
│   │   │   ├── schema-gen.impl.ts
│   │   │   └── ...
│   │   └── app/
│   │       ├── password.impl.ts
│   │       └── ...
│   └── rust/
│       └── app/
│           └── password/
│               └── src/lib.rs
│
├── deploy/
│   └── app.deploy.yaml
│
├── kits/                       # Concept kits (bundled concepts + syncs)
│   ├── auth/                   # Auth kit
│   │   ├── kit.yaml
│   │   ├── user.concept
│   │   ├── password.concept
│   │   ├── jwt.concept
│   │   ├── syncs/
│   │   │   ├── registration.sync        # recommended
│   │   │   └── token-refresh.sync       # recommended
│   │   ├── implementations/
│   │   │   └── typescript/
│   │   │       ├── user.impl.ts
│   │   │       ├── password.impl.ts
│   │   │       └── jwt.impl.ts
│   │   └── tests/
│   └── content-management/     # Content management kit
│       ├── kit.yaml
│       ├── entity.concept
│       ├── field.concept
│       ├── relation.concept
│       ├── node.concept
│       ├── syncs/
│       │   ├── cascade-delete-fields.sync     # required
│       │   ├── cascade-delete-relations.sync   # required
│       │   ├── entity-lifecycle.sync           # required
│       │   ├── default-title-field.sync        # recommended
│       │   └── node-create-entity.sync         # recommended
│       ├── implementations/
│       │   └── typescript/
│       └── tests/
│
├── tests/
│   ├── conformance/            # Generated from invariants
│   └── integration/            # Flow-level tests
│
└── tools/
    └── copf-cli/               # CLI wrapping the compiler pipeline
        ├── src/
        │   ├── commands/
        │   │   ├── init.ts
        │   │   ├── compile.ts
        │   │   ├── generate.ts
        │   │   ├── test.ts
        │   │   ├── deploy.ts
        │   │   └── kit.ts          # kit init, validate, test, list
        │   └── index.ts
        └── package.json
```

---

## 12. CLI Interface

```bash
# Initialize a new COPF project
copf init myapp

# Parse and validate all specs
copf check

# Generate schemas + code for all concepts
copf generate --target typescript
copf generate --target rust --concept Password

# Run conformance tests for a concept
copf test password

# Run full integration test (start engine, register concepts, run flows)
copf test --integration

# Compile syncs and validate against concept manifests
copf compile-syncs

# Start the development server (engine + all local concepts)
copf dev

# Deploy according to manifest
copf deploy --manifest deploy/app.deploy.yaml

# Kit management
copf kit init my-kit                    # scaffold a new kit directory
copf kit validate ./kits/content-mgmt   # validate kit manifest, type alignment, sync tiers
copf kit test ./kits/content-mgmt       # run kit's conformance + integration tests
copf kit list                           # show kits used by the current app
copf kit check-overrides                # verify app overrides reference valid sync names
```

---

## 13. Implementation Roadmap

### Phase 1: Kernel + First Concept (Weeks 1-3)

- [ ] Implement the Stage 0 kernel in TypeScript
  - [ ] `.concept` file parser (grammar from Section 2.2)
  - [ ] Minimal sync engine (eager only, in-process)
  - [ ] In-memory storage adapter
  - [ ] In-process transport adapter
- [ ] Write the Password concept spec
- [ ] Hand-write the Password concept implementation
- [ ] Write a registration sync (Web → User → Password)
- [ ] Demonstrate a complete flow: HTTP request → sync engine → concept actions → response

### Phase 2: Query Layer — Both Modes (Weeks 4-6)

- [ ] Implement GraphQL schema generation from concept specs
- [ ] Implement concept-side GraphQL resolvers (generated) for full-mode concepts
- [ ] Implement the Lite Query Protocol interfaces (`snapshot`, `lookup`, `filter`)
- [ ] Implement the engine-side `LiteQueryAdapter` with caching
- [ ] Implement engine-side federated query layer (dispatches to full-GraphQL or lite adapters)
- [ ] Implement `where` clause evaluation via the unified `ConceptQuery` interface
- [ ] Demonstrate cross-concept queries in syncs using both modes
- [ ] Test: one concept in full-GraphQL mode, one in lite mode, sync spanning both

### Phase 3: Compiler Pipeline (Weeks 6-8)

- [ ] Implement JSON Schema generation from action signatures
- [ ] Implement TypeScript code generation (types, handler interface, adapter)
- [ ] Implement conformance test generation from invariants
- [ ] Implement `.sync` file parser and validator
- [ ] Build `copf` CLI with `check`, `generate`, `compile-syncs`, `test` commands

### Phase 4: RealWorld Benchmark (Weeks 9-11)

- [ ] Implement all RealWorld concepts (User, Password, Profile, Article, Comment, Tag, Favorite, JWT, Follow)
- [ ] Implement all RealWorld syncs
- [ ] Pass the RealWorld Postman test suite
- [ ] Document design rules and compare with conventional implementations
- [ ] Package the auth-related concepts (User, Password, JWT) as a first kit

### Phase 5: Concept Kits (Weeks 12-13)

- [ ] Implement kit.yaml manifest parser and loader
- [ ] Implement type parameter alignment validation (advisory warnings)
- [ ] Implement sync tier enforcement (required vs recommended, compile-time checks)
- [ ] Implement override and disable mechanics in the deployment manifest
- [ ] Build a content-management kit (Entity, Field, Relation, Node) as the reference kit
- [ ] Build an auth kit (User, Password, JWT, Session) extracted from Phase 4
- [ ] Add `copf kit init`, `copf kit validate`, `copf kit test` CLI commands
- [ ] Test: app using two kits together with overrides and integration syncs

### Phase 6: Self-Hosting (Weeks 14-16)

- [ ] Write specs for framework concepts (SpecParser, SchemaGen, CodeGen, etc.)
- [ ] Implement framework concepts
- [ ] Achieve Stage 2: framework compiles its own specs
- [ ] Achieve Stage 3: SyncEngine concept replaces kernel eval loop

### Phase 7: Multi-Target (Weeks 17-20)

- [ ] Implement Rust code generator
- [ ] Implement HTTP transport adapter
- [ ] Re-implement one concept in Rust
- [ ] Demonstrate cross-language interop
- [ ] Implement deployment manifest and validation

### Phase 8: Distribution + Eventual Consistency (Weeks 21-24)

- [ ] Implement eventual sync queue
- [ ] Implement engine hierarchy (upstream/downstream)
- [ ] Implement WebSocket transport adapter
- [ ] Prototype a phone concept (React Native or Swift) using lite query mode
- [ ] Implement HTTP lite adapter (JSON-RPC for snapshot/lookup/filter over the wire)
- [ ] Demonstrate offline-capable sync with eventual convergence
- [ ] Validate: phone concept with Core Data storage, lite query mode, cached engine-side, eventual sync to server

---

## 14. Stage 0 Acceptance Tests

These tests define the concrete pass/fail targets for the Stage 0 kernel implementation. If both tests pass, the kernel is complete and Stage 1 can begin.

### 14.1 Test A: Minimal — Echo Concept

This test validates the bare machinery: spec parsing, concept registration, sync registration, flow execution, and response assembly. One custom concept, two syncs, one flow.

#### Spec: `echo.concept`

```
concept Echo [M] {

  purpose {
    Accept a message and echo it back, optionally transformed.
  }

  state {
    messages: set M
    text: M -> String
  }

  actions {
    action send(id: M, text: String) {
      -> ok(id: M, echo: String) {
        Store the message. Return the text as-is.
      }
    }
  }

  invariant {
    after send(id: m, text: "hello") -> ok(id: m, echo: "hello")
    then send(id: m, text: "hello") -> ok(id: m, echo: "hello")
  }
}
```

#### Implementation: `echo.impl.ts`

```typescript
import type { EchoHandler } from "./generated/echo.handler";

export const echoHandler: EchoHandler = {
  async send(input, storage) {
    await storage.put("echo", input.id, { text: input.text });
    return { variant: "ok", id: input.id, echo: input.text };
  },
};
```

#### Syncs: `echo.sync`

```
sync HandleEcho {
  when {
    Web/request: [ method: "echo"; text: ?text ]
      => [ request: ?request ]
  }
  where {
    bind(uuid() as ?id)
  }
  then {
    Echo/send: [ id: ?id; text: ?text ]
  }
}

sync EchoResponse {
  when {
    Web/request: [ method: "echo" ]
      => [ request: ?request ]
    Echo/send: []
      => [ echo: ?echo ]
  }
  then {
    Web/respond: [
      request: ?request;
      body: [ echo: ?echo ] ]
  }
}
```

#### Test Script: `test-a-echo.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { createKernel } from "@copf/kernel";
import { echoHandler } from "./echo.impl";

describe("Stage 0 — Test A: Echo", () => {

  it("processes a complete echo flow", async () => {
    // 1. Boot the kernel
    const kernel = createKernel();

    // 2. Register the Echo concept with in-memory storage
    kernel.registerConcept("urn:test/Echo", echoHandler);

    // 3. Register syncs (parsed from the .sync file or inline)
    kernel.registerSync({
      name: "HandleEcho",
      when: [
        {
          concept: "urn:copf/Web", action: "request",
          inputFields: [
            { name: "method", match: { type: "literal", value: "echo" } },
            { name: "text", match: { type: "variable", name: "text" } },
          ],
          outputFields: [
            { name: "request", match: { type: "variable", name: "request" } },
          ],
        },
      ],
      where: [{ type: "bind", expr: "uuid()", as: "id" }],
      then: [
        {
          concept: "urn:test/Echo", action: "send",
          fields: [
            { name: "id", value: { type: "variable", name: "id" } },
            { name: "text", value: { type: "variable", name: "text" } },
          ],
        },
      ],
    });

    kernel.registerSync({
      name: "EchoResponse",
      when: [
        {
          concept: "urn:copf/Web", action: "request",
          inputFields: [
            { name: "method", match: { type: "literal", value: "echo" } },
          ],
          outputFields: [
            { name: "request", match: { type: "variable", name: "request" } },
          ],
        },
        {
          concept: "urn:test/Echo", action: "send",
          inputFields: [],
          outputFields: [
            { name: "echo", match: { type: "variable", name: "echo" } },
          ],
        },
      ],
      where: [],
      then: [
        {
          concept: "urn:copf/Web", action: "respond",
          fields: [
            { name: "request", value: { type: "variable", name: "request" } },
            { name: "body", value: {
              type: "literal",
              value: { echo: "{{echo}}" },  // template resolved from bindings
            }},
          ],
        },
      ],
    });

    // 4. Simulate an incoming web request
    const response = await kernel.handleRequest({
      method: "echo",
      text: "hello world",
    });

    // 5. Assert the response
    expect(response.body).toEqual({ echo: "hello world" });

    // 6. Assert provenance — the action log should show the full flow
    const flow = kernel.getFlowLog(response.flowId);
    expect(flow).toHaveLength(4); // request completion, send invocation, send completion, respond invocation
    expect(flow.map(r => `${r.concept}/${r.action}`)).toEqual([
      "urn:copf/Web/request",
      "urn:test/Echo/send",
      "urn:test/Echo/send",    // completion
      "urn:copf/Web/respond",
    ]);
  });
});
```

#### What This Validates

- Kernel boots and accepts concept + sync registrations
- Web bootstrap concept produces request completions
- Sync engine matches a single-action `when` clause
- `where` clause `bind(uuid())` produces a new binding
- Concept receives invocation, executes, returns completion
- Multi-action `when` clause matches (both request and send completion in same flow)
- `then` clause produces a Web/respond invocation with assembled data
- Flow completes and provenance log is queryable

### 14.2 Test B: Registration Flow — Multi-Concept

This test validates the full multi-concept coordination path: four concepts, multiple syncs firing in sequence, error handling, and response assembly from multiple concept states.

#### Specs

**`user.concept`**

```
concept User [U] {
  purpose { Associate identifying information with users. }

  state {
    users: set U
    name: U -> String
    email: U -> String
  }

  actions {
    action register(user: U, name: String, email: String) {
      -> ok(user: U) {
        Add user to users set. Store name and email.
        Return user reference.
      }
      -> error(message: String) {
        If name or email is not unique, return error.
      }
    }
  }

  invariant {
    after register(user: x, name: "alice", email: "a@b.com") -> ok(user: x)
    then register(user: y, name: "alice", email: "c@d.com") -> error(message: "name already taken")
  }
}
```

**`password.concept`** — as in Section 2.5

**`jwt.concept`**

```
concept JWT [U] {
  purpose { Generate and verify JSON Web Tokens for user sessions. }

  state {
    tokens: U -> String
  }

  actions {
    action generate(user: U) {
      -> ok(token: String) {
        Create a JWT containing the user reference. Store and return it.
      }
    }

    action verify(token: String) {
      -> ok(user: U) {
        Decode the token. Return the user reference.
      }
      -> error(message: String) {
        If the token is invalid or expired, return error.
      }
    }
  }

  invariant {
    after generate(user: x) -> ok(token: t)
    then verify(token: t) -> ok(user: x)
  }
}
```

#### Syncs: `registration.sync`

```
sync ValidatePassword {
  when {
    Web/request: [ method: "register"; password: ?password ]
      => [ request: ?request ]
  }
  then {
    Password/validate: [ password: ?password ]
  }
}

sync ValidatePasswordError {
  when {
    Web/request: [ method: "register" ]
      => [ request: ?request ]
    Password/validate: [ password: ?password ]
      => [ valid: false ]
  }
  then {
    Web/respond: [
      request: ?request;
      error: "Password does not meet requirements";
      code: 422 ]
  }
}

sync RegisterUser {
  when {
    Web/request: [
      method: "register";
      username: ?username;
      email: ?email ]
      => []
    Password/validate: []
      => [ valid: true ]
  }
  where {
    bind(uuid() as ?user)
  }
  then {
    User/register: [ user: ?user; name: ?username; email: ?email ]
  }
}

sync SetPassword {
  when {
    Web/request: [ method: "register"; password: ?password ]
      => []
    User/register: []
      => [ user: ?user ]
  }
  then {
    Password/set: [ user: ?user; password: ?password ]
  }
}

sync GenerateToken {
  when {
    User/register: []
      => [ user: ?user ]
  }
  then {
    JWT/generate: [ user: ?user ]
  }
}

sync RegistrationResponse {
  when {
    Web/request: [ method: "register" ]
      => [ request: ?request ]
    User/register: []
      => [ user: ?user ]
    Password/set: []
      => [ user: ?user ]
    JWT/generate: []
      => [ token: ?token ]
  }
  where {
    User: { ?user name: ?username; email: ?email }
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
}

sync RegistrationError {
  when {
    Web/request: [ method: "register" ]
      => [ request: ?request ]
    User/register: []
      => [ error: ?error ]
  }
  then {
    Web/respond: [
      request: ?request;
      error: ?error;
      code: 422 ]
  }
}
```

#### Test Script: `test-b-registration.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { createKernel } from "@copf/kernel";
import { userHandler } from "./user.impl";
import { passwordHandler } from "./password.impl";
import { jwtHandler } from "./jwt.impl";

describe("Stage 0 — Test B: Registration Flow", () => {

  it("registers a new user with valid credentials", async () => {
    const kernel = createKernel();
    kernel.registerConcept("urn:app/User", userHandler);
    kernel.registerConcept("urn:app/Password", passwordHandler);
    kernel.registerConcept("urn:app/JWT", jwtHandler);

    // Load syncs from registration.sync (parsed)
    await kernel.loadSyncs("./syncs/registration.sync");

    const response = await kernel.handleRequest({
      method: "register",
      username: "alice",
      email: "alice@example.com",
      password: "secure-password-123",
    });

    // Should succeed with user data + token
    expect(response.code).toBeUndefined();  // no error code
    expect(response.body.user.username).toBe("alice");
    expect(response.body.user.email).toBe("alice@example.com");
    expect(response.body.user.token).toBeDefined();
    expect(typeof response.body.user.token).toBe("string");

    // The JWT should be verifiable
    const verifyResult = await kernel.invokeConcept(
      "urn:app/JWT", "verify",
      { token: response.body.user.token },
    );
    expect(verifyResult.variant).toBe("ok");
  });

  it("rejects registration with a weak password", async () => {
    const kernel = createKernel();
    kernel.registerConcept("urn:app/User", userHandler);
    kernel.registerConcept("urn:app/Password", passwordHandler);
    kernel.registerConcept("urn:app/JWT", jwtHandler);
    await kernel.loadSyncs("./syncs/registration.sync");

    const response = await kernel.handleRequest({
      method: "register",
      username: "bob",
      email: "bob@example.com",
      password: "short",
    });

    // Should fail with 422
    expect(response.code).toBe(422);
    expect(response.error).toBeDefined();

    // User should NOT have been created
    const userQuery = await kernel.queryConcept(
      "urn:app/User", "user", { name: "bob" }
    );
    expect(userQuery).toHaveLength(0);
  });

  it("rejects registration with a duplicate username", async () => {
    const kernel = createKernel();
    kernel.registerConcept("urn:app/User", userHandler);
    kernel.registerConcept("urn:app/Password", passwordHandler);
    kernel.registerConcept("urn:app/JWT", jwtHandler);
    await kernel.loadSyncs("./syncs/registration.sync");

    // First registration succeeds
    const first = await kernel.handleRequest({
      method: "register",
      username: "charlie",
      email: "charlie@example.com",
      password: "strong-password-456",
    });
    expect(first.code).toBeUndefined();

    // Second registration with same username fails
    const second = await kernel.handleRequest({
      method: "register",
      username: "charlie",
      email: "charlie2@example.com",
      password: "strong-password-789",
    });
    expect(second.code).toBe(422);
    expect(second.error).toContain("already taken");
  });

  it("produces a complete provenance graph for a successful registration", async () => {
    const kernel = createKernel();
    kernel.registerConcept("urn:app/User", userHandler);
    kernel.registerConcept("urn:app/Password", passwordHandler);
    kernel.registerConcept("urn:app/JWT", jwtHandler);
    await kernel.loadSyncs("./syncs/registration.sync");

    const response = await kernel.handleRequest({
      method: "register",
      username: "diana",
      email: "diana@example.com",
      password: "strong-password-000",
    });

    // Get the full flow
    const flow = kernel.getFlowLog(response.flowId);

    // Should contain all expected actions (invocations + completions)
    const actionNames = flow
      .filter(r => r.type === "completion")
      .map(r => `${r.concept}/${r.action}:${r.variant}`);

    expect(actionNames).toContain("urn:copf/Web/request:ok");
    expect(actionNames).toContain("urn:app/Password/validate:ok");
    expect(actionNames).toContain("urn:app/User/register:ok");
    expect(actionNames).toContain("urn:app/Password/set:ok");
    expect(actionNames).toContain("urn:app/JWT/generate:ok");
    expect(actionNames).toContain("urn:copf/Web/respond:ok");

    // Every action should have a sync edge back to its cause
    const invocations = flow.filter(r => r.type === "invocation" && r.sync);
    for (const inv of invocations) {
      expect(inv.sync).toBeDefined();
      expect(inv.parent).toBeDefined();
    }
  });
});
```

#### What This Validates (Beyond Test A)

- Multiple concepts registered and interacting via syncs
- Sync chaining: one completion triggers a sync whose invocation triggers another concept whose completion triggers another sync, etc.
- Password validation happens *before* user registration (sync ordering via data dependencies)
- Error path: Password/validate returning `valid: false` triggers the error response sync, and no subsequent syncs (RegisterUser, SetPassword, GenerateToken) fire
- `where` clause querying concept state (User concept queried for username/email in RegistrationResponse)
- Duplicate detection: second registration with same username fails at User/register, which triggers RegistrationError sync
- Provenance graph completeness: every action in the flow is traceable to its cause

---

## 15. Open Questions

1. **Ordering guarantees.** When multiple syncs fire from the same completion, what is the execution order? Does it matter? The paper's approach is transactional; ours is not. Need to define semantics clearly.

2. **Conflict resolution for eventual syncs.** When a phone concept and a server concept both modify the same logical entity while disconnected, how are conflicts resolved? Options: last-writer-wins, concept-specific merge functions, or explicit conflict concepts.

3. **Sync composition.** Can syncs reference other syncs? The current design says no — syncs only reference concept actions. But patterns may emerge where a "meta-sync" that enables/disables other syncs would be useful.

4. **Hot reloading.** Can syncs be added/removed/modified at runtime without restarting the engine? The provenance edge mechanism (Section 6.6) should support this, but needs careful design.

5. **Testing syncs in isolation.** How do you unit-test a sync without standing up all referenced concepts? Probably mock concepts that satisfy the spec's action signatures.

6. **Schema migration.** When a concept's state schema changes across versions, how is migration handled? Each concept owns its storage, so migration is concept-internal, but the GraphQL schema federation needs to handle version skew gracefully.

7. **Authorization model.** The paper handles auth via syncs (check JWT before performing action). Is this sufficient for all auth patterns, or does the engine need a first-class authorization layer?

8. **Lite query mode boundaries.** The lite protocol covers key lookups and simple filters. What happens when a `where` clause requires a join across two relations within the same lite-mode concept? Current design: the engine fetches a full snapshot and joins in-memory. For concepts with large state on constrained devices, this may need a richer filter protocol or a way to signal "this concept's state is too large for lite mode."

9. **Observability.** The action log and provenance graph provide excellent debugging. How do we expose this as standard observability (OpenTelemetry traces, metrics)?

---

## Appendix A: Comparison with the Paper

| Aspect | Paper (Meng & Jackson 2025) | COPF |
|--------|---------------------------|------|
| Spec language | Semi-formal, Alloy-style state | Formal grammar, machine-parseable |
| IR | RDF triples, Turtle format | JSON with JSON Schema validation |
| Query layer | SPARQL | GraphQL (full) or Lite Query Protocol (snapshot/lookup/filter) |
| State ownership | Concept-owned but RDF store | Concept-owned, any storage backend, any query mode |
| Transport | In-process only | In-process, HTTP, WebSocket, Workers |
| Sync annotations | None | eager, eventual, local, idempotent |
| Multi-language | Not addressed | First-class: spec compiles to any target |
| Distribution | Not addressed | Engine hierarchy with eventual consistency |
| Self-hosting | No | Full bootstrap from minimal kernel |
| Code generation | LLM-driven | Deterministic compiler + optional LLM for action bodies |
