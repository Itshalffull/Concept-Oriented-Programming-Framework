# Concept-Oriented Programming Framework (COPF)

## Architecture & Implementation Specification

**Version:** 0.18.0
**Date:** 2026-02-18

### Changelog

| Version | Date | Summary |
|---------|------|---------|
| 0.18.0 | 2026-02-18 | Marked phases 1-18 complete, all bootstrap stages complete. Added §16.11 Engine/Concept Boundary Principle, §16.12 Async Gate Convention. `@gate` annotation in grammar. Domain kit directory structure with `infrastructure/` for pre-conceptual code. `copf check --pattern` and `copf trace --gates` CLI. Gate-aware `TraceNode`/`TraceSyncNode` interfaces. Phase 19 (async gate implementation) added as next. Version changelog added. |
| 0.17.0 | 2026-02-18 | Kernel shrinkage architecture: §17 with 6 subsections. FlowTrace, DeploymentValidator, Migration concept specs. SyncEngine eventual queue fold (§17.4). Stage 3.5 pre-compilation design (§17.5). Kernel target state table (§17.6). Phases 14-18 (kernel extraction through barrel cleanup). Bootstrap §10 updated with new concepts, syncs, Stage 3.5. Dependency graph updated. |
| 0.16.0 | 2026-02-18 | Operational architecture integration across all sections. §16 added with 10 subsections (error tracing, observability, hot reloading, test helpers, schema migration, conflict resolution, lite query diagnostics, ordering, sync composition, authorization). Grammar extended with `@version(N)` annotation. Storage interface extended (`getMeta`, `getVersion`, `onConflict`). Telemetry concept + sync. Registry reload/deregister actions. Deploy manifest `engine:` config. Phases 10-13 added. §15 open questions all resolved. |
| 0.9.0 | 2026-02-17 | CodeGen refactor pattern: SchemaGen → ConceptManifest → per-language generators. `ConceptManifest` interface defined. TypeScriptGen/RustGen concept specs. Compiler pipeline syncs updated. Stage 4/4.5 migration plan. Operational design decisions documented (appendix-style, later integrated into §16). |
| 0.6.0 | 2026-02-16 | Phases 1-6 complete. Self-hosting achieved (Stage 3). Concept kits (§9) with kit manifest, type alignment, sync tiers. RealWorld benchmark validated. Distribution architecture (Phase 9 design). Web3 kit manifest example added to §9.1. |
| 0.1.0 | 2025-02-15 | Initial draft. Sections 1-15: spec language, IR, GraphQL, sync language, sync engine, compiler pipeline, deployment manifest, bootstrapping plan, project structure, CLI, roadmap (phases 1-9), Stage 0 acceptance tests, open questions. |

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
ANNOTATION  = "@" IDENT ("(" INT_LIT ")")?  -- e.g. @version(3), @gate
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

ConceptDecl     = Annotation* "concept" IDENT TypeParams? "{" Section* "}"

Annotation      = "@" IDENT ("(" INT_LIT ")")?

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
@version(1)
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

**`@version(N)`** is an annotation on the concept declaration. It is an integer that increments when the state schema changes in a way that requires data migration (adding, removing, or renaming relations or fields). Non-breaking changes (new actions, new variants) do not require a version bump. The framework uses this at startup to detect version mismatches and block the concept until migration runs — see Section 16.5 for the full migration design.

**`@gate`** marks a concept as an async gate — a concept whose actions may complete asynchronously after an arbitrarily long wait. The annotation is metadata for tooling: `copf check --pattern async-gate` validates the convention, and `copf trace` annotates gate steps with ⏳ icons and progress reporting. The engine ignores it entirely. See Section 16.12 for the full convention.

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

> **Diagnostic warning:** When the slow path's `snapshot()` returns more than a configurable threshold of entries (default 1,000), the engine emits a warning nudging the developer to implement `lookup`/`filter` or switch to GraphQL mode. See Section 16.7 for details. The threshold is set via `engine.liteQueryWarnThreshold` in the deploy manifest (Section 8.1).

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

#### Runtime Sync Management

The sync index supports hot reloading and concept lifecycle changes (see Section 16.3 for full design):

```typescript
interface SyncRuntime {
  /**
   * Atomically replace the entire sync index. In-flight flows
   * continue using the old index; new completions use the new one.
   */
  reloadSyncs(syncs: CompiledSync[]): void;

  /**
   * Mark all syncs referencing the given concept as degraded.
   * Degraded syncs are skipped during matching with a warning log.
   * If the concept re-registers, its syncs automatically un-degrade.
   */
  degradeSyncsForConcept(conceptUri: string): string[];  // returns degraded sync names

  /**
   * Un-degrade syncs when a concept becomes available again.
   */
  restoreSyncsForConcept(conceptUri: string): void;
}
```

Degraded syncs remain in the index but carry a `degraded: true` flag. The matching algorithm (below) checks this flag and skips degraded syncs, emitting a warning per skip.
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
5. When replaying queued writes to concepts that were modified while disconnected, the storage layer's `onConflict` hook (if set) detects concurrent modifications. The default behavior is last-writer-wins using `lastWrittenAt` timestamps. See Section 16.6 for the full conflict resolution design.

### 6.7 Provenance Graph

Every action record is connected to its causal predecessors. The full provenance graph for a flow can be queried to answer:

- "What actions led to this outcome?"
- "Which synchronization caused this invocation?"
- "What was the full causal chain from the initial request to the final response?"

This graph is itself exposed as a concept (see Section 10, bootstrapping) and queryable via GraphQL. The `FlowTrace` API (Section 16.1) provides a structured, annotated view of the provenance graph for debugging — including timing, failed branches, and syncs that did not fire. The `copf trace <flow-id>` CLI command renders this as a human-readable tree.

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
   * Automatically stores a `_meta.lastWrittenAt` timestamp.
   * If onConflict is set and an existing entry has a more recent
   * timestamp, the conflict handler is invoked (see Section 16.6).
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
   * Retrieve write metadata for a specific entry.
   * Returns null if no record exists for this key.
   */
  getMeta(relation: string, key: string): Promise<{ lastWrittenAt: string } | null>;

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

  /**
   * Read/write the concept's version metadata. Used by the
   * framework for schema migration detection (Section 16.5).
   */
  getVersion(): Promise<number | null>;
  setVersion(version: number): Promise<void>;

  /**
   * Optional conflict handler for distributed deployments.
   * Called by `put` when the incoming write conflicts with an existing
   * entry (see Section 16.6 for conflict resolution design).
   * If not set, the default is last-writer-wins.
   */
  onConflict?: (
    relation: string,
    key: string,
    existing: { fields: Record<string, unknown>; writtenAt: string },
    incoming: { fields: Record<string, unknown>; writtenAt: string },
  ) => ConflictResolution;
}

type ConflictResolution =
  | { action: "keep-existing" }
  | { action: "accept-incoming" }
  | { action: "merge"; merged: Record<string, unknown> }
  | { action: "escalate" };  // surface as a -> conflict(...) completion
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
  version?: number;          // from @version(N) annotation
  gate?: boolean;            // from @gate annotation
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

engine:
  liteQueryWarnThreshold: 1000   # warn on snapshot > N entries (Section 16.7)
  telemetry:
    enabled: true                # enable ExportTelemetry sync
    exporter: stdout             # stdout | otlp | jaeger
    otlpEndpoint: http://localhost:4317  # if exporter is otlp
  hotReload:
    enabled: true                # watch files and reload (dev only)
    watchPaths:
      - ./specs/
      - ./syncs/
      - ./implementations/
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

A kit is a directory with a `kit.yaml` manifest. Kits bundle concepts, syncs, implementations, and optionally **infrastructure** — transport adapters, storage backends, and deploy templates that the kit's concepts require.

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

# Optional: infrastructure that the kit's concepts require.
# Transports and storage adapters are pre-conceptual (Section 10.3)
# but belong in the kit because the concepts can't function without them.
# infrastructure:
#   transports:
#     - name: evm
#       path: ./transports/evm-transport.ts
#       description: EVM JSON-RPC transport adapter
#   storage:
#     - name: ipfs
#       path: ./storage/ipfs-storage.ts
#       description: IPFS content-addressed storage adapter
#   deployTemplates:
#     - path: ./deploy-templates/mainnet.deploy.yaml
```

Kits that introduce a new deployment target — a new chain, a new edge runtime, a new device class — bundle the pre-conceptual infrastructure alongside their concepts. The infrastructure section is optional; most kits (auth, content-management) only need concepts and syncs.

**Example: web3 kit manifest**

```yaml
# kits/web3/kit.yaml
kit:
  name: web3
  version: 0.1.0
  description: >
    Blockchain integration for COPF. Chain monitoring with
    finality-aware gating, IPFS content storage with pinning,
    and wallet-based authentication via signature verification.

concepts:
  ChainMonitor:
    spec: ./chain-monitor.concept
    params:
      B: { as: block-ref, description: "Reference to a tracked block" }

  Content:
    spec: ./content.concept
    params:
      C: { as: content-ref, description: "Reference to stored content (CID)" }

  Wallet:
    spec: ./wallet.concept
    params:
      W: { as: wallet-ref, description: "Reference to a wallet/address" }

syncs:
  required:
    - path: ./syncs/finality-gate.sync
      description: >
        Pattern sync for finality-aware gating. When a chain action
        completes, route through ChainMonitor/awaitFinality before
        triggering downstream cross-chain actions. Apps clone and
        customize this for their specific cross-chain flows.

  recommended:
    - path: ./syncs/reorg-compensation.sync
      name: ReorgCompensation
      description: >
        When ChainMonitor detects a reorg, freeze or flag any
        downstream actions that were triggered by the reorged
        completion. Override with app-specific compensation logic.

    - path: ./syncs/content-pinning.sync
      name: ContentPinning
      description: >
        When Content/store completes, automatically pin the CID
        via the configured pinning service. Disable if managing
        pinning manually.

integrations:
  - kit: auth
    syncs:
      - path: ./syncs/wallet-auth.sync
        description: >
          Wire Wallet/verify into the auth kit's JWT flow.
          Wallet signature verification as an auth method.

infrastructure:
  transports:
    - name: evm
      path: ./transports/evm-transport.ts
      description: >
        EVM JSON-RPC transport adapter. Maps concept invoke() to
        contract calls via ethers.js/viem, query() to storage reads.
        Handles gas estimation, nonce management, receipt polling.

    - name: starknet
      path: ./transports/starknet-transport.ts
      description: >
        StarkNet transport adapter for Cairo VM chains.

  storage:
    - name: ipfs
      path: ./storage/ipfs-storage.ts
      description: >
        IPFS content-addressed storage adapter. Maintains a mutable
        index (key → CID) on top of immutable content storage.
        Supports Pinata, web3.storage, and self-hosted IPFS nodes.

  deployTemplates:
    - path: ./deploy-templates/ethereum-mainnet.deploy.yaml
    - path: ./deploy-templates/arbitrum.deploy.yaml
    - path: ./deploy-templates/multi-chain.deploy.yaml

chainConfigs:
  ethereum:
    chainId: 1
    finality:
      type: confirmations
      threshold: 12
  arbitrum:
    chainId: 42161
    finality:
      type: l1-batch
      softFinality: sequencer
  optimism:
    chainId: 10
    finality:
      type: l1-batch
      softFinality: sequencer
  base:
    chainId: 8453
    finality:
      type: l1-batch
      softFinality: sequencer
  starknet:
    chainId: "SN_MAIN"
    finality:
      type: validity-proof
    transport: starknet
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

**Framework kits** (concepts + syncs only):

```
kits/
├── auth/
│   ├── kit.yaml
│   ├── user.concept
│   ├── password.concept
│   ├── jwt.concept
│   ├── syncs/
│   │   ├── registration.sync          # recommended
│   │   └── token-refresh.sync         # recommended
│   ├── implementations/
│   │   └── typescript/
│   │       ├── user.impl.ts
│   │       ├── password.impl.ts
│   │       └── jwt.impl.ts
│   └── tests/
│       ├── conformance/
│       └── integration/
│
├── rate-limiting/
│   ├── kit.yaml
│   ├── rate-limiter.concept           # cross-domain, async gate pattern
│   ├── syncs/
│   │   └── rate-limit-check.sync      # recommended
│   ├── implementations/
│   │   └── typescript/
│   │       └── rate-limiter.impl.ts   # token bucket algorithm
│   └── tests/
```

**Domain kits** (concepts + syncs + infrastructure):

Domain kits that introduce new deployment targets bundle pre-conceptual code (transport adapters, storage backends, deploy templates) alongside their concepts. The infrastructure section groups code that is below the concept abstraction but domain-specific — it doesn't belong in the framework kernel because it's useless outside the kit's domain.

```
kits/
├── web3/
│   ├── kit.yaml
│   ├── chain-monitor.concept          # async gate: finality, reorgs
│   ├── contract.concept               # on-chain concept wrapper
│   ├── content.concept                # IPFS content management
│   ├── wallet.concept                 # signature verification
│   ├── syncs/
│   │   ├── finality-gate.sync         # required
│   │   ├── reorg-compensation.sync    # recommended
│   │   ├── content-pinning.sync       # recommended
│   │   └── wallet-auth.sync           # integration (auth kit)
│   ├── implementations/
│   │   └── typescript/
│   │       ├── chain-monitor.impl.ts
│   │       ├── contract.impl.ts
│   │       ├── content.impl.ts
│   │       └── wallet.impl.ts
│   ├── infrastructure/                # pre-conceptual, domain-specific
│   │   ├── transports/
│   │   │   ├── evm-transport.ts       # EVM JSON-RPC adapter
│   │   │   └── starknet-transport.ts  # StarkNet adapter
│   │   ├── storage/
│   │   │   └── ipfs-storage.ts        # IPFS content-addressed adapter
│   │   └── deploy-templates/
│   │       ├── ethereum-mainnet.deploy.yaml
│   │       ├── arbitrum.deploy.yaml
│   │       └── multi-chain.deploy.yaml
│   └── tests/
│
├── iot/
│   ├── kit.yaml
│   ├── freshness-gate.concept         # async gate: TTL, staleness
│   ├── device.concept                 # device registration, heartbeat
│   ├── telemetry-ingest.concept       # sensor data collection
│   ├── syncs/
│   │   ├── check-freshness.sync       # required
│   │   ├── device-heartbeat.sync      # required
│   │   └── stale-alert.sync           # recommended
│   ├── implementations/
│   │   └── typescript/
│   ├── infrastructure/
│   │   ├── transports/
│   │   │   └── mqtt-transport.ts      # MQTT adapter for devices
│   │   └── deploy-templates/
│   │       └── edge-gateway.deploy.yaml
│   └── tests/
│
├── workflow/
│   ├── kit.yaml
│   ├── approval-queue.concept         # async gate: human approval
│   ├── escalation.concept             # timeout → escalate
│   ├── notification.concept           # email/slack on pending
│   ├── syncs/
│   │   ├── request-approval.sync      # required
│   │   ├── escalate-timeout.sync      # required
│   │   └── notify-approver.sync       # recommended
│   ├── implementations/
│   │   └── typescript/
│   └── tests/
```

The `infrastructure/` directory is reserved for pre-conceptual code per Section 10.3. It contains only transport adapters, storage backends, and deploy templates — never concepts, syncs, or implementations. The kit installer copies infrastructure into the appropriate kernel extension paths; the `copf kit validate` command verifies that infrastructure code implements the correct interfaces (`ConceptTransport`, `ConceptStorage`).

### 9.7 Kit Design Guidelines

**Keep required syncs minimal.** A sync is required only if removing it causes data corruption — orphaned records, dangling references, violated uniqueness constraints. Behavioral preferences (notifications, defaults, formatting) are always recommended.

**One purpose per concept, even within a kit.** A kit doesn't change the concept design rules. Entity handles lifecycle, Field handles attachment, Relation handles linking. Don't create a "Node" concept that combines all three — that defeats the modularity that makes kits composable.

**Design for override at the recommended level.** When writing a recommended sync, ask: "What would an app replace this with?" If the answer is "nothing, they'd just remove it," use `disable`. If the answer is "a different version of the same behavior," use `override` with a named sync.

**Ship implementations, not just specs.** A kit should include default implementations for all its concepts. Apps can use them as-is, or provide their own implementations that conform to the same specs. The kit's integration tests validate that the default implementations work with the kit's syncs.

**Type parameter alignment is documentation, not enforcement.** The `as` tags help the compiler catch mistakes, but they don't prevent creative uses. An app might intentionally pass a User ID where an entity-ref is expected — if they've thought it through, the framework shouldn't stop them.

**Bundle infrastructure when introducing new deployment targets.** If a kit's concepts require a transport adapter (EVM, StarkNet) or a storage backend (IPFS, CloudflareKV) that doesn't ship with the framework, include it in the kit's `infrastructure` section. Pre-conceptual code belongs in the kit when it's domain-specific — the EVM transport adapter is useless outside web3, so it ships with the web3 kit, not the framework kernel.

**Domain gating is a concept, not an engine extension.** If your kit needs "wait for condition X before proceeding" (finality, batch size, approval, TTL), model X as a concept with a long-running action that completes when the condition is met. Don't add annotations to the sync engine. The engine handles delivery semantics (eager, eventual, local, idempotent). Domain semantics belong in concepts. See Section 16.11 for the full rationale.

---

## 10. Bootstrapping Plan

The framework is self-hosting: the compiler, engine, and tooling are themselves implemented as concepts. This requires a staged bootstrap.

### 10.1 Bootstrap Stages

> **Implementation note:** All bootstrap stages (0 through 5, including 3.5) are complete. The framework initially used a single `CodeGen` concept accepting a `language` parameter. This was refactored in Stages 4/4.5 to split `CodeGen` into `SchemaGen` (producing a rich, language-neutral `ConceptManifest`) plus independent per-language generator concepts (`TypeScriptGen`, `RustGen`, etc.) — see the concept specs below. Stage 3.5 eliminated the bootstrap chain, bringing the kernel down to ~584 LOC. The concept specs below reflect the final architecture.

**Stage 0: The Kernel (hand-written TypeScript)** ✅ Complete

A minimal, non-concept implementation that provides just enough to run the first concepts:

- A `.concept` file parser (AST only, no validation)
- A minimal sync engine (in-process, eager only, no persistence)
- A minimal transport layer (in-process function calls only)
- A minimal concept runtime (handler dispatch, in-memory storage)

This is ~1,000-2,000 lines of TypeScript. It does not use concepts or syncs internally. It is the only code in the system that is not spec-driven.

Target: can load a `.concept` file, register a hand-written concept handler, register a sync, and execute a flow.

**Stage 1: Core Concepts (specs + hand-written impls on kernel)** ✅ Complete

Define the framework's own functionality as concepts. The current implementation uses the original concept definitions (single `CodeGen` with a `language` parameter). The target architecture below reflects the refined split into `SchemaGen` + per-language generators:

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
concept SchemaGen [S] {
  purpose {
    Transform parsed concept ASTs into rich, language-neutral
    ConceptManifests. The manifest contains everything a code
    generator needs: relation schemas (after merge/grouping),
    fully typed action signatures, structured invariants with
    test values, GraphQL schema fragments, and JSON Schemas.
  }

  state {
    manifests: S -> ConceptManifest
  }

  actions {
    action generate(spec: S, ast: AST) {
      -> ok(manifest: ConceptManifest) {
        Apply state grouping/merge rules to produce relation schemas.
        Resolve all types into ResolvedType trees.
        Transform invariants into structured test scenarios with
        deterministic test IDs for free variables.
        Generate GraphQL schema fragment from relation schemas.
        Generate JSON Schemas for each action invocation/completion.
        Package everything into a ConceptManifest.
      }
      -> error(message: String) {
        If the AST contains unresolvable types or inconsistencies.
      }
    }
  }
}
```

The **ConceptManifest** is the central artifact of the compiler pipeline. It is language-neutral and contains all decisions made by SchemaGen. Language generators consume it without needing the original AST or spec:

```typescript
interface ConceptManifest {
  // Identity
  uri: string;
  name: string;
  version?: number;          // from @version(N) annotation, if present
  gate?: boolean;            // from @gate annotation, if present
  typeParams: TypeParamInfo[];

  // State → Storage mapping (result of merge/grouping rules)
  relations: RelationSchema[];

  // Actions with full type information
  actions: ActionSchema[];

  // Invariants as structured test scenarios
  invariants: InvariantSchema[];

  // Pre-generated GraphQL schema fragment
  graphqlSchema: string;

  // Pre-generated JSON Schemas for wire validation
  jsonSchemas: {
    invocations: Record<string, object>;
    completions: Record<string, Record<string, object>>;
  };

  // Capabilities and purpose
  capabilities: string[];
  purpose: string;
}

interface TypeParamInfo {
  name: string;
  wireType: "string";
  description?: string;
}

interface RelationSchema {
  name: string;
  source: "merged" | "explicit" | "set-valued";
  keyField: { name: string; paramRef: string };
  fields: FieldSchema[];
}

interface FieldSchema {
  name: string;
  type: ResolvedType;
  optional: boolean;
}

// Recursive type tree — each generator maps this to its own type system
interface ResolvedType {
  kind: "primitive" | "param" | "set" | "list" | "option" | "record";
  primitive?: "String" | "Int" | "Float" | "Bool"
            | "Bytes" | "DateTime" | "ID";
  paramRef?: string;
  inner?: ResolvedType;
  fields?: FieldSchema[];
}

interface ActionSchema {
  name: string;
  params: ActionParamSchema[];
  variants: VariantSchema[];
}

interface ActionParamSchema {
  name: string;
  type: ResolvedType;
}

interface VariantSchema {
  tag: string;
  fields: ActionParamSchema[];
  prose?: string;
}

interface InvariantSchema {
  description: string;
  setup: InvariantStep[];     // "after" clause
  assertions: InvariantStep[];  // "then" clause
  freeVariables: {
    name: string;
    testValue: string;         // e.g. "u-test-invariant-001"
  }[];
}

interface InvariantStep {
  action: string;
  inputs: { name: string; value: InvariantValue }[];
  expectedVariant: string;
  expectedOutputs: { name: string; value: InvariantValue }[];
}

type InvariantValue =
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "variable"; name: string };
```

**Language-specific generators** are each independent concepts. They consume a `ConceptManifest` and produce files. Each carries its own type mapping table — a simple recursive function that maps `ResolvedType` to target language syntax. Adding a new language means adding a new concept and a sync. No existing concept is modified.

```
concept TypeScriptGen [S] {
  purpose {
    Generate TypeScript skeleton code from a ConceptManifest.
    Produces type definitions, handler interface, transport adapter,
    lite query implementation, and conformance tests.
  }

  state {
    outputs: S -> list { path: String; content: String }
  }

  actions {
    action generate(spec: S, manifest: ConceptManifest) {
      -> ok(files: list { path: String; content: String }) {
        Map ResolvedTypes to TypeScript types.
        Emit type definitions for action inputs/outputs.
        Emit handler interface with one method per action.
        Emit transport adapter (invocation dispatch, serialization).
        Emit lite query protocol implementation over ConceptStorage.
        Emit conformance tests from invariants.
      }
      -> error(message: String) {
        If the manifest contains types not mappable to TypeScript.
      }
    }
  }
}
```

```
concept RustGen [S] {
  purpose {
    Generate Rust skeleton code from a ConceptManifest.
    Produces type definitions, handler trait, transport adapter,
    and conformance tests.
  }

  state {
    outputs: S -> list { path: String; content: String }
  }

  actions {
    action generate(spec: S, manifest: ConceptManifest) {
      -> ok(files: list { path: String; content: String }) {
        Map ResolvedTypes to Rust types (String, i64, Vec, Option, etc.).
        Emit struct definitions for action inputs/outputs.
        Emit handler trait with async methods per action.
        Emit transport adapter.
        Emit conformance tests.
      }
      -> error(message: String) {
        If the manifest contains types not mappable to Rust.
      }
    }
  }
}
```

Additional generators (SwiftGen, GoGen, PythonGen, etc.) follow the same pattern. Each is ~200-400 lines of template logic plus a ~15-line type mapping function.

```
concept SyncParser [Y] {
  purpose {
    Parse .sync files into structured ASTs and validate
    against concept manifests.
  }

  state {
    syncs: set Y
    ast: Y -> SyncAST
  }

  actions {
    action parse(source: String, manifests: list ConceptManifest) {
      -> ok(sync: Y, ast: SyncAST) {
        Parse the sync file. Resolve concept/action references
        against the provided manifests. Validate field patterns
        against action signatures.
      }
      -> error(message: String, line: Int) {
        If syntax is invalid or references unresolvable.
      }
    }
  }
}
```

```
concept SyncCompiler [Y] {
  purpose {
    Compile parsed synchronizations into executable registrations.
  }

  state {
    compiled: Y -> CompiledSync
  }

  actions {
    action compile(sync: Y, ast: SyncAST) {
      -> ok(compiled: CompiledSync) {
        Translate where clauses into ConceptQuery plans.
        Compile when patterns into matchable structures.
        Produce a CompiledSync ready for engine registration.
      }
      -> error(message: String) {
        If the sync references inconsistent types or
        unresolvable state components.
      }
    }
  }
}
```

```
concept ActionLog [R] {
  purpose {
    Append-only log of all action invocations and completions.
    The engine's memory.
  }

  state {
    records: set R
    record: R -> ActionRecord
    edges: R -> list { target: R; sync: String }
  }

  actions {
    action append(record: ActionRecord) {
      -> ok(id: R) { Append to the log and return the record ID. }
    }
    action addEdge(from: R, to: R, sync: String) {
      -> ok() { Record a provenance edge. }
    }
    action query(flow: String) {
      -> ok(records: list ActionRecord) { Return all records for a flow. }
    }
  }
}
```

```
concept Registry [C] {
  purpose {
    Track deployed concepts, their locations, and availability.
  }

  state {
    concepts: set C
    uri: C -> String
    transport: C -> TransportConfig
    available: C -> Bool
  }

  actions {
    action register(uri: String, transport: TransportConfig) {
      -> ok(concept: C) { Register concept and return reference. }
      -> error(message: String) { If URI is already registered. }
    }
    action reload(uri: String, transport: TransportConfig) {
      -> ok(concept: C) {
        Update transport config for an existing concept.
        In-flight invocations to the old transport drain naturally.
        New invocations route to the new transport.
        See Section 16.3 Scenario B.
      }
      -> notfound(message: String) { If URI is not registered. }
    }
    action deregister(uri: String) {
      -> ok(degradedSyncs: list String) {
        Remove concept from registry. All syncs referencing this
        concept are marked degraded and skipped during matching
        with a warning log. Returns list of affected sync names.
        If the concept re-registers, syncs automatically un-degrade.
        See Section 16.3 Scenario C.
      }
    }
    action heartbeat(uri: String) {
      -> ok(available: Bool) { Update and return availability status. }
    }
  }
}
```

```
concept Telemetry [S] {
  purpose {
    Export action records as structured telemetry.
    Maps to OpenTelemetry spans: each flow is a trace,
    each action is a span, provenance edges are span links.
    See Section 16.2 for the full observability design.
  }

  state {
    spans: set S
    exported: S -> Bool
  }

  actions {
    action export(record: ActionRecord, flowTrace: FlowTrace) {
      -> ok(spanId: String) {
        Transform the action record into an OTel-compatible span.
        Push to configured exporter. Non-fatal on failure.
      }
      -> error(message: String) {
        If the exporter is unreachable.
      }
    }

    action configure(exporter: ExporterConfig) {
      -> ok() { Set or update the export target. }
    }
  }
}
```

```
concept FlowTrace [F] {
  purpose {
    Build and render interactive debug traces from action log records.
    See Section 17.1 for the full spec.
  }
  state {
    traces: set F
    tree: F -> FlowTree
    rendered: F -> String
  }
  actions {
    action build(flowId: String) {
      -> ok(trace: F, tree: FlowTree) { Walk provenance edges, build tree. }
      -> error(message: String) { If flowId not found. }
    }
    action render(trace: F, options: RenderOptions) {
      -> ok(output: String) { Render tree as text or JSON. }
    }
  }
}
```

```
concept DeploymentValidator [M] {
  purpose {
    Parse and validate deployment manifests against compiled
    concepts and syncs. See Section 17.2 for the full spec.
  }
  state {
    manifests: set M
    plan: M -> DeploymentPlan
    issues: M -> list ValidationIssue
  }
  actions {
    action parse(raw: String) {
      -> ok(manifest: M) { Parse YAML manifest. }
      -> error(message: String) { If malformed. }
    }
    action validate(manifest: M, concepts: list ConceptManifest, syncs: list CompiledSync) {
      -> ok(plan: DeploymentPlan) { Valid deployment plan. }
      -> warning(plan: DeploymentPlan, issues: list String) { Non-fatal issues. }
      -> error(issues: list String) { Fatal validation failures. }
    }
  }
}
```

```
concept Migration [C] {
  purpose {
    Track concept schema versions and gate concept startup.
    See Section 17.3 for the full spec.
  }
  state {
    versions: C -> Int
    pending: set C
  }
  actions {
    action check(concept: C, specVersion: Int) {
      -> ok() { Version matches. }
      -> needsMigration(from: Int, to: Int) { Storage behind spec. }
    }
    action complete(concept: C, version: Int) {
      -> ok() { Record migration complete. }
    }
  }
}
```

**Synchronizations for Stage 1:**

```
# When a spec is parsed, generate the manifest
sync GenerateManifest {
  when {
    SpecParser/parse: [] => [ spec: ?spec; ast: ?ast ]
  }
  then {
    SchemaGen/generate: [ spec: ?spec; ast: ?ast ]
  }
}

# When a manifest is generated, generate TypeScript code
sync GenerateTypeScript {
  when {
    SchemaGen/generate: [ spec: ?spec ]
      => [ manifest: ?manifest ]
  }
  then {
    TypeScriptGen/generate: [ spec: ?spec; manifest: ?manifest ]
  }
}

# To add Rust generation, add ONE sync — no existing code changes:
# sync GenerateRust {
#   when {
#     SchemaGen/generate: [ spec: ?spec ]
#       => [ manifest: ?manifest ]
#   }
#   then {
#     RustGen/generate: [ spec: ?spec; manifest: ?manifest ]
#   }
# }

# When a concept is registered, log it
sync LogRegistration {
  when {
    Registry/register: [] => [ concept: ?c ]
  }
  then {
    ActionLog/append: [ record: { type: "registration"; concept: ?c } ]
  }
}

# Export all action records as telemetry (recommended, overridable)
sync ExportTelemetry {
  when {
    ActionLog/append: [] => [ id: ?id; record: ?record ]
  }
  then {
    Telemetry/export: [ record: ?record ]
  }
}

# Check migration status when a concept registers
sync CheckMigrationOnRegister {
  when {
    Registry/register: [ uri: ?uri ] => [ concept: ?c ]
  }
  where {
    SchemaGen { manifest(?uri).version as ?specVersion }
  }
  then {
    Migration/check: [ concept: ?c; specVersion: ?specVersion ]
  }
}

# Validate deployment after manifest generation
sync ValidateDeployment {
  when {
    SchemaGen/generate: [ spec: ?spec ] => [ manifest: ?manifest ]
  }
  then {
    DeploymentValidator/validate: [ manifest: ?deployManifest;
      concepts: [?manifest]; syncs: [] ]
  }
}
```

Note the key property: **adding a new target language requires zero modifications to any existing concept or sync.** You write a new generator concept (e.g., `SwiftGen`), implement it, and add one sync that wires `SchemaGen/generate` to `SwiftGen/generate`. This is the framework proving its own extensibility model.

The concept specs above reflect the implemented architecture. The original single `CodeGen` concept was refactored in Stage 4/4.5 into `SchemaGen` + per-language generators.

**Stage 2: Self-Compilation** ✅ Complete

The Stage 1 concepts compile themselves:

1. Stage 1 `.concept` files are fed to the SpecParser concept.
2. Parsed ASTs are fed to SchemaGen — output matches the hand-written schemas.
3. Parsed ASTs are fed to CodeGen — generated skeletons match the hand-written handler interfaces.
4. `.sync` files are fed to SyncParser and SyncCompiler — compiled syncs match the hand-registered syncs from Stage 1.

At this point, the framework generates its own type definitions and schemas from its own specs. The hand-written implementations of Stage 1 concepts are validated against generated interfaces.

**Stage 3: Engine Self-Hosting** ✅ Complete

The Stage 0 kernel eval loop has been replaced with a concept-based engine:

```
concept SyncEngine [F] {
  purpose {
    Evaluate synchronizations by matching completions,
    querying state, and producing invocations.
  }

  state {
    syncs: set SyncRegistration
    pendingFlows: set F
  }

  actions {
    action registerSync(sync: CompiledSync) {
      -> ok() { Add sync to the registry and update the index. }
    }
    action onCompletion(completion: ActionCompletion) {
      -> ok(invocations: list ActionInvocation) {
        Run the matching algorithm (Section 6.2) against
        all indexed syncs. Return produced invocations.
      }
    }
    action evaluateWhere(bindings: Bindings, queries: list ConceptQuery) {
      -> ok(results: list Bindings) {
        Issue queries to concept transports and join results.
      }
      -> error(message: String) {
        If a referenced concept is unavailable.
      }
    }

    // Eventual queue extensions (Section 17.4)
    action queueSync(sync: CompiledSync, bindings: Bindings, flow: String) {
      -> ok(pendingId: String) {
        Queue an [eventual] sync for later execution when the target
        concept becomes available.
      }
    }
    action onAvailabilityChange(conceptUri: String, available: Bool) {
      -> ok(drained: list ActionInvocation) {
        Re-evaluate pending syncs referencing the concept.
        Return produced invocations for dispatch.
      }
    }
    action drainConflicts() {
      -> ok(conflicts: list ActionCompletion) {
        Return conflict completions from eventual sync replay.
      }
    }
  }
}
```

The SyncEngine concept is itself run by the kernel engine. This is the key bootstrapping moment: the SyncEngine concept processes completions and emits invocations, while the kernel merely dispatches between it and the other concepts. The kernel's role shrinks to:

- Process startup
- Loading concept handlers and transport adapters
- Routing messages between the SyncEngine concept and other concepts

Eventually, even these responsibilities could be modeled as concepts (a Loader concept, a Router concept), but the kernel remains as the minimal trusted base.

**Stage 3.5: Eliminate Bootstrap Chain** ✅ Complete

> The kernel currently carries ~1,523 LOC of Stage 0 scaffolding (parsers, engine, action-log, registry) that is load-bearing — it runs on every startup even though concept implementations exist. `createKernel()` directly instantiates Stage 0 classes; even `createSelfHostedKernel()` still uses Stage 0 parsers to load files.

This stage introduces a pre-compilation step. Instead of re-parsing specs at every boot, the kernel loads pre-compiled artifacts from a `.copf-cache/` directory. See Section 17.5 for full design.

1. `copf compile --cache` runs the full pipeline through concept implementations and writes compiled artifacts to `.copf-cache/`.
2. On startup, the kernel loads pre-compiled `CompiledSync` objects and concept registrations directly — no parsing.
3. `createSelfHostedKernel()` becomes the default (and only) boot path.
4. All Stage 0 scaffolding (parser.ts, sync-parser.ts, Stage 0 SyncEngine/ActionLog classes) is deleted from the kernel.

This is Phase 17 in the roadmap. After this stage, the kernel drops from ~4,254 LOC to ~584 LOC, matching the Section 10.3 target.

**Stage 4: CodeGen Refactor** ✅ Complete

The existing implementation has a single `CodeGen` concept that accepts a `language` parameter and produces files for any target. This works, but has a structural problem: adding a new language requires modifying CodeGen's internals, and the concept grows linearly with every target. The refined architecture (specified in the concept definitions above) splits this into:

1. **SchemaGen** produces a rich `ConceptManifest` — a language-neutral intermediate representation containing relation schemas (after merge/grouping), fully typed action signatures, structured invariants, GraphQL fragments, and JSON Schemas. All design decisions are encoded here.

2. **Per-language generators** (`TypeScriptGen`, `RustGen`, etc.) are independent concepts that consume a `ConceptManifest` and produce files. Each carries its own type mapping table — a ~15-line recursive function that maps `ResolvedType` to target language syntax.

3. **Syncs wire them together.** `SchemaGen/generate => TypeScriptGen/generate`. Adding a new language: write a new concept, add one sync. No existing code modified.

Migration steps:

1. Define and validate the `ConceptManifest` interface (specified above in this section).
2. Refactor the existing `SchemaGen` to produce a full `ConceptManifest` instead of just GraphQL/JSON schemas. The GraphQL and JSON schemas become fields on the manifest rather than standalone outputs.
3. Extract the TypeScript-specific logic from the existing `CodeGen` into a new `TypeScriptGen` concept. This is mostly moving code — the template logic stays the same, it just reads from `ConceptManifest` instead of raw ASTs.
4. Update the compiler pipeline syncs: replace `GenerateCode` with `GenerateManifest` + `GenerateTypeScript`.
5. Delete the old `CodeGen` concept.
6. Verify self-compilation still passes: the framework compiles its own specs through the new pipeline and produces identical output.

The key constraint is that this refactor must be behavior-preserving. The generated TypeScript output should be identical before and after, since the same decisions are being made — they're just encoded in a manifest rather than computed inline during codegen.

**Stage 5: Multi-Target** ✅ Complete

With the refactored pipeline, adding the first non-TypeScript target:

1. Write `RustGen` as a new concept — implement the Rust type mapping and template logic.
2. Add one sync: `SchemaGen/generate => RustGen/generate`.
3. Re-implement one concept (e.g., Password) in the generated Rust skeleton.
4. Deploy it with an HttpAdapter.
5. Verify interop: the TypeScript sync engine invokes the Rust concept, receives completions, evaluates syncs, queries state via GraphQL or lite protocol.

This validates both the cross-language story and the extensibility of the codegen pipeline. No existing concept or sync was modified — only new ones were added.

### 10.2 Bootstrap Dependency Graph

```
Stage 0 (hand-written kernel) ✅
  │
  ├── minimal parser
  ├── minimal engine (eval loop)
  ├── minimal transport (in-process)
  └── minimal runtime (handler dispatch)
        │
Stage 1 (concept specs + hand-written impls on kernel) ✅
  │
  ├── SpecParser concept
  ├── SchemaGen concept (current: GraphQL/JSON only)
  ├── CodeGen concept (current: single concept, language param)
  ├── SyncParser concept
  ├── SyncCompiler concept
  ├── ActionLog concept
  ├── Registry concept
  ├── Telemetry concept
  ├── FlowTrace concept
  ├── DeploymentValidator concept
  └── Migration concept
        │
Stage 2 (self-compilation) ✅
  │
  ├── specs compile via own SpecParser
  ├── schemas generated via own SchemaGen
  ├── skeletons generated via own CodeGen
  └── syncs compiled via own SyncParser + SyncCompiler
        │
Stage 3 (engine self-hosting) ✅
  │
  ├── SyncEngine concept replaces kernel eval loop
  ├── eventual queue folded into SyncEngine (Section 17.4)
  ├── kernel reduced to process bootstrap + message routing
  └── all framework logic expressed as concepts + syncs
        │
Stage 3.5 (eliminate bootstrap chain) ✅
  │
  ├── .copf-cache/ pre-compiled artifact format
  ├── copf compile --cache writes compiled artifacts
  ├── kernel boots from cache (no parsing at startup)
  ├── Stage 0 scaffolding deleted (~1,523 LOC)
  └── kernel reaches ~584 LOC target
        │
Stage 4 (codegen refactor) ✅
  │
  ├── SchemaGen → produces ConceptManifest (rich, language-neutral IR)
  ├── CodeGen → split into TypeScriptGen (+ future per-language concepts)
  ├── pipeline syncs updated
  └── self-compilation verified through new pipeline
        │
Stage 5 (multi-target) ✅
  │
  ├── RustGen concept + one sync
  ├── cross-language concept deployment
  └── distributed engine hierarchy
        │
Stage 6 (operational architecture) ✅
  │
  ├── FlowTrace API + copf trace CLI
  ├── createMockHandler test utility
  ├── Telemetry concept wired via ExportTelemetry sync
  ├── Hot reloading (reloadSyncs, reloadConcept, degraded marking)
  ├── Schema migration (@version, startup check, copf migrate)
  ├── Conflict resolution (LWW timestamps → onConflict hooks)
  └── Lite query diagnostics (snapshot size warnings)
```

### 10.3 What Stays in the Kernel Forever

Some things cannot be concepts without infinite regress:

- **Process entry point.** Something has to start the engine.
- **Message dispatch.** The act of routing a completion to the SyncEngine concept and routing its output invocations to target concepts is pre-conceptual.
- **Transport adapter instantiation.** Creating the in-process, HTTP, or WebSocket connections that concepts communicate over.

These form the **trusted kernel** — ~584 lines of TypeScript (see Section 17.6 for the module breakdown). Everything above is spec-driven and self-hosting.

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
│   │   ├── schema-gen.concept       # current: GraphQL/JSON only; Phase 7: full ConceptManifest
│   │   ├── code-gen.concept          # Phase 7: replaced by typescript-gen.concept
│   │   ├── sync-parser.concept
│   │   ├── sync-compiler.concept
│   │   ├── action-log.concept
│   │   ├── registry.concept
│   │   ├── sync-engine.concept
│   │   └── telemetry.concept        # observability (Section 16.2)
│   └── app/                    # Application concepts
│       ├── password.concept
│       ├── user.concept
│       ├── profile.concept
│       └── ...
│
├── syncs/                      # Synchronization definitions
│   ├── framework/              # Framework's own syncs
│   │   ├── compiler-pipeline.sync
│   │   ├── engine-bootstrap.sync
│   │   └── telemetry-export.sync    # recommended, overridable (Section 16.2)
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
│   │   │   ├── telemetry.impl.ts       # OTel exporter adapter
│   │   │   ├── flow-trace.ts           # FlowTrace builder (Section 16.1)
│   │   │   ├── mock-handler.ts         # createMockHandler utility (Section 16.4)
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
        │   │   ├── check.ts        # copf check + --pattern validation (Section 16.12)
        │   │   ├── compile.ts
        │   │   ├── generate.ts
        │   │   ├── test.ts
        │   │   ├── deploy.ts
        │   │   ├── kit.ts          # kit init, validate, test, list
        │   │   ├── trace.ts        # copf trace <flow-id> (Section 16.1)
        │   │   └── migrate.ts      # copf migrate (Section 16.5)
        │   ├── patterns/           # Convention validators for copf check --pattern
        │   │   └── async-gate.ts   # validates @gate convention (Section 16.12)
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

# Validate a concept against a known pattern (Section 16.12)
copf check --pattern async-gate chain-monitor.concept

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
# Watches .concept, .sync, and implementation files for changes.
# On .concept/.sync change: re-compiles via pipeline, calls reloadSyncs.
# On implementation change: calls reloadConcept with new transport.
# Shows compiler errors inline on failure; old sync set remains active.
copf dev

# Deploy according to manifest
copf deploy --manifest deploy/app.deploy.yaml

# Kit management
copf kit init my-kit                    # scaffold a new kit directory
copf kit validate ./kits/content-mgmt   # validate kit manifest, type alignment, sync tiers
copf kit test ./kits/content-mgmt       # run kit's conformance + integration tests
copf kit list                           # show kits used by the current app
copf kit check-overrides                # verify app overrides reference valid sync names

# Flow tracing and debugging
copf trace <flow-id>                    # render provenance graph with status per node
copf trace <flow-id> --failed           # show only failed branches
copf trace <flow-id> --gates            # highlight async gate steps with progress
copf trace <flow-id> --json             # machine-readable trace output

# Schema migration
copf migrate <concept>                  # run pending migrations for a concept
copf migrate --check                    # detect version mismatches without running
copf migrate --all                      # run all pending migrations
```

---

## 13. Implementation Roadmap

### Phase 1: Kernel + First Concept (Weeks 1-3) ✅ Complete

- [x] Implement the Stage 0 kernel in TypeScript
  - [x] `.concept` file parser (grammar from Section 2.2)
  - [x] Minimal sync engine (eager only, in-process)
  - [x] In-memory storage adapter
  - [x] In-process transport adapter
- [x] Write the Password concept spec
- [x] Hand-write the Password concept implementation
- [x] Write a registration sync (Web → User → Password)
- [x] Demonstrate a complete flow: HTTP request → sync engine → concept actions → response

### Phase 2: Query Layer — Both Modes (Weeks 4-6) ✅ Complete

- [x] Implement GraphQL schema generation from concept specs
- [x] Implement concept-side GraphQL resolvers (generated) for full-mode concepts
- [x] Implement the Lite Query Protocol interfaces (`snapshot`, `lookup`, `filter`)
- [x] Implement the engine-side `LiteQueryAdapter` with caching
- [x] Implement engine-side federated query layer (dispatches to full-GraphQL or lite adapters)
- [x] Implement `where` clause evaluation via the unified `ConceptQuery` interface
- [x] Demonstrate cross-concept queries in syncs using both modes
- [x] Test: one concept in full-GraphQL mode, one in lite mode, sync spanning both

### Phase 3: Compiler Pipeline (Weeks 6-8) ✅ Complete

- [x] Implement JSON Schema generation from action signatures
- [x] Implement TypeScript code generation (types, handler interface, adapter)
- [x] Implement conformance test generation from invariants
- [x] Implement `.sync` file parser and validator
- [x] Build `copf` CLI with `check`, `generate`, `compile-syncs`, `test` commands

### Phase 4: RealWorld Benchmark (Weeks 9-11) ✅ Complete

- [x] Implement all RealWorld concepts (User, Password, Profile, Article, Comment, Tag, Favorite, JWT, Follow)
- [x] Implement all RealWorld syncs
- [x] Pass the RealWorld Postman test suite
- [x] Document design rules and compare with conventional implementations
- [x] Package the auth-related concepts (User, Password, JWT) as a first kit

### Phase 5: Concept Kits (Weeks 12-13) ✅ Complete

- [x] Implement kit.yaml manifest parser and loader
- [x] Implement type parameter alignment validation (advisory warnings)
- [x] Implement sync tier enforcement (required vs recommended, compile-time checks)
- [x] Implement override and disable mechanics in the deployment manifest
- [x] Build a content-management kit (Entity, Field, Relation, Node) as the reference kit
- [x] Build an auth kit (User, Password, JWT, Session) extracted from Phase 4
- [x] Add `copf kit init`, `copf kit validate`, `copf kit test` CLI commands
- [x] Test: app using two kits together with overrides and integration syncs

### Phase 6: Self-Hosting (Weeks 14-16) ✅ Complete

- [x] Write specs for framework concepts (SpecParser, SchemaGen, CodeGen, etc.)
- [x] Implement framework concepts
- [x] Achieve Stage 2: framework compiles its own specs
- [x] Achieve Stage 3: SyncEngine concept replaces kernel eval loop

### Phase 7: CodeGen Refactor (Weeks 17-18) ✅ Complete

This phase restructures the compiler pipeline from a single `CodeGen` concept to the `SchemaGen` + per-language generator architecture described in Section 10.1, Stage 4. The refactor is behavior-preserving — generated TypeScript output must be identical before and after.

- [x] Define and validate the `ConceptManifest` TypeScript interface
- [x] Refactor `SchemaGen` to produce a full `ConceptManifest`
  - [x] Add relation schemas (with merge/grouping decisions encoded)
  - [x] Add fully typed action signatures with `ResolvedType` trees
  - [x] Add structured invariants with deterministic test values
  - [x] Fold existing GraphQL/JSON schema generation into manifest fields
- [x] Extract `TypeScriptGen` from `CodeGen`
  - [x] Move TypeScript type mapping into `TypeScriptGen` (~15-line `mapType` function)
  - [x] Move template logic, converting from AST reads to `ConceptManifest` reads
  - [x] Write the `TypeScriptGen` concept spec
- [x] Update compiler pipeline syncs
  - [x] Replace `GenerateCode` sync with `GenerateManifest` + `GenerateTypeScript`
  - [x] Verify sync engine routes correctly through the new two-step pipeline
- [x] Delete the old `CodeGen` concept (spec, implementation, tests)
- [x] Self-compilation verification
  - [x] Framework compiles its own specs through the new pipeline
  - [x] Generated output is byte-identical to pre-refactor output
  - [x] All existing conformance tests pass without modification

### Phase 8: Multi-Target (Weeks 19-22) ✅ Complete

With the refactored pipeline, adding new language targets is now straightforward:

- [x] Implement `RustGen` concept
  - [x] Rust type mapping function (`ResolvedType` → Rust syntax)
  - [x] Templates: struct definitions, handler trait, transport adapter, conformance tests
  - [x] Write the `RustGen` concept spec
- [x] Add one sync: `SchemaGen/generate => RustGen/generate`
- [x] Implement HTTP transport adapter
- [x] Re-implement one concept (e.g., Password) in Rust using the generated skeleton
- [x] Demonstrate cross-language interop
  - [x] TypeScript sync engine invokes Rust concept via HTTP
  - [x] Completions flow back through sync evaluation
  - [x] State queries work via lite protocol over HTTP
- [x] Implement deployment manifest and validation

### Phase 9: Distribution + Eventual Consistency (Weeks 23-26) ✅ Complete

- [x] Implement eventual sync queue
- [x] Implement engine hierarchy (upstream/downstream)
- [x] Implement WebSocket transport adapter
- [x] Prototype a phone concept (React Native or Swift) using lite query mode
- [x] Implement HTTP lite adapter (JSON-RPC for snapshot/lookup/filter over the wire)
- [x] Demonstrate offline-capable sync with eventual convergence
- [x] Validate: phone concept with Core Data storage, lite query mode, cached engine-side, eventual sync to server

### Phase 10: Flow Tracing & Test Helpers (Weeks 27-28) ✅ Complete

This phase addresses the highest-impact developer experience gaps. See Section 16.1 and 16.4 for full design.

- [x] Implement `FlowTrace` builder
  - [x] Walk ActionLog provenance edges from flow root
  - [x] For each completion, check sync index for candidate syncs and mark unfired ones
  - [x] Compute per-action timing from ActionLog timestamps
  - [x] Build `FlowTrace` / `TraceNode` / `TraceSyncNode` tree
- [x] Implement `copf trace <flow-id>` CLI renderer
  - [x] Tree-formatted output with status icons, timing, sync names
  - [x] `--failed` flag: filter to only failed/unfired branches
  - [x] `--json` flag: output `FlowTrace` as JSON for tooling
- [x] Implement `createMockHandler(ast, overrides)` test utility
  - [x] Generate default ok responses from concept AST action signatures
  - [x] Use deterministic test values matching conformance test generator
  - [x] Merge in caller-provided overrides per action
- [x] Add `kernel.getFlowTrace(flowId)` programmatic API
- [x] Retrofit existing test suites to use `createMockHandler` (validate DX improvement)

### Phase 11: Observability & Hot Reloading (Weeks 29-31) ✅ Complete

See Section 16.2 and 16.3 for full design.

- [x] Implement Telemetry concept
  - [x] Write `telemetry.concept` spec
  - [x] Implement reference exporter (stdout for dev, OTLP for production)
  - [x] Map ActionLog records to OpenTelemetry spans (flow → trace, action → span, provenance → parent)
- [x] Wire `ExportTelemetry` sync (`ActionLog/append → Telemetry/export`)
- [x] Add Telemetry to default concept kit (recommended sync, overridable/disableable)
- [x] Implement hot reloading
  - [x] `SyncEngine.reloadSyncs(syncs[])` — atomic index swap, in-flight flows use old set
  - [x] `Registry.reloadConcept(uri, transport)` — transport swap with drain
  - [x] `Registry.deregisterConcept(uri)` — mark dependent syncs as degraded with warning log
  - [x] Un-degrade syncs automatically when concept re-registers
- [x] Implement `copf dev` file watcher
  - [x] Watch `.concept` and `.sync` files
  - [x] Re-compile on change via compiler pipeline
  - [x] Call `reloadSyncs` on success, show compiler errors on failure
  - [x] Call `reloadConcept` when implementation files change

### Phase 12: Schema Migration (Weeks 32-33) ✅ Complete

See Section 16.5 for full design.

- [x] Add `@version(N)` annotation to spec language grammar (Section 2.2)
- [x] Update spec parser to extract version number into AST
- [x] Implement startup version check
  - [x] On concept load, compare spec `@version` against `_meta.version` in storage
  - [x] If mismatch, set concept to migration-required state
  - [x] Reject all invocations except `migrate` with `→ needsMigration` error
- [x] Implement `copf migrate` CLI
  - [x] `copf migrate <concept>` — invoke concept's `migrate` action, update `_meta.version`
  - [x] `copf migrate --check` — report version status for all concepts
  - [x] `copf migrate --all` — run pending migrations in dependency order
- [x] Add `migrate` action convention to documentation and concept kit templates
- [x] Test: bump a concept version, verify startup blocks, migrate, verify service resumes

### Phase 13: Conflict Resolution (Weeks 34-35) ✅ Complete

See Section 16.6 for full design. Phase 1 can begin immediately; Phase 2 depends on Phase 9 (Distribution).

- [x] Phase 1: Explicit LWW
  - [x] Add `lastWrittenAt` timestamp to all `ConceptStorage.put` calls
  - [x] Add `getMeta(relation, key)` to `ConceptStorage` interface
  - [x] Update in-memory, SQLite, and Postgres backends to store/retrieve timestamps
  - [x] Log warning when a write overwrites an entry with a more recent timestamp
- [x] Phase 2: Conflict detection hooks (requires Phase 9)
  - [x] Add optional `onConflict` callback to `ConceptStorage`
  - [x] Implement conflict detection in eventual sync queue replay
  - [x] Support four resolution strategies: keep-existing, accept-incoming, merge, escalate
  - [x] `escalate` produces `→ conflict(...)` completion routable by syncs
  - [x] Test: simulate concurrent writes from phone + server, verify conflict detection and merge
- [x] Add lite query diagnostics (Section 16.7)
  - [x] Warn when snapshot returns > threshold entries (default 1,000)
  - [x] Make threshold configurable in deploy manifest (`engine.liteQueryWarnThreshold`)

### Phase 14: Kernel Extraction — Tooling (Weeks 36) ✅ Complete

Move non-concept, non-kernel code out of the kernel into its proper location. These modules are dev tooling or transport plumbing, not runtime kernel code. See Section 17.

- [x] Move `kernel/src/test-helpers.ts` → `implementations/typescript/framework/mock-handler.ts`
  - [x] Update all test imports
  - [x] Verify `createMockHandler` works from new location
- [x] Move `kernel/src/lite-query.ts` → `implementations/typescript/framework/lite-query-adapter.ts`
  - [x] `LiteQueryProtocol` interface stays in shared types
  - [x] Adapter caching logic moves to implementation
  - [x] Update transport layer imports
- [x] Verify kernel LOC reduced by ~248 lines
- [x] All existing tests pass from new import paths

### Phase 15: Kernel Extraction — New Concepts (Weeks 37-38) ✅ Complete

Extract three kernel modules into proper concept specs + implementations. See Section 17 for concept specs and rationale.

- [x] Implement `FlowTrace` concept
  - [x] Write `flow-trace.concept` spec (Section 17.1)
  - [x] Move `kernel/src/flow-trace.ts` logic into `flow-trace.impl.ts`
  - [x] Wire sync: `ActionLog/query → ok ⟹ FlowTrace/build`
  - [x] Verify `copf trace` CLI works through the concept (not direct kernel calls)
  - [x] Delete `kernel/src/flow-trace.ts`
- [x] Implement `DeploymentValidator` concept
  - [x] Write `deployment-validator.concept` spec (Section 17.2)
  - [x] Move `kernel/src/deploy.ts` logic into `deployment-validator.impl.ts`
  - [x] Wire sync: `SchemaGen/generate → ok ⟹ DeploymentValidator/validate`
  - [x] Verify `copf deploy` CLI works through the concept
  - [x] Delete `kernel/src/deploy.ts`
- [x] Implement `Migration` concept
  - [x] Write `migration.concept` spec (Section 17.3)
  - [x] Move `kernel/src/migration.ts` logic into `migration.impl.ts`
  - [x] Wire sync: `Registry/register → ok ⟹ Migration/check`
  - [x] Verify `copf migrate` CLI works through the concept
  - [x] Delete `kernel/src/migration.ts`
- [x] Verify kernel LOC reduced by ~722 lines
- [x] All conformance and integration tests pass

### Phase 16: Kernel Extraction — Eventual Queue Fold (Weeks 39) ✅ Complete

Fold the `DistributedSyncEngine` into the `SyncEngine` concept rather than keeping it as a separate module. See Section 17.4 for rationale.

- [x] Extend `sync-engine.concept` spec with eventual queue actions
  - [x] `queueSync(sync, bindings, flow) → ok(pendingId)`
  - [x] `onAvailabilityChange(conceptUri, available) → ok(drained: list ActionInvocation)`
  - [x] `drainConflicts() → ok(conflicts: list ActionCompletion)`
- [x] Merge `kernel/src/eventual-queue.ts` logic into `sync-engine.impl.ts`
  - [x] Eliminate duplicated matching/evaluation code (~60% overlap)
  - [x] Annotation-aware routing (`[eventual]`, `[local]`, `[eager]`) handled inside `onCompletion`
  - [x] Pending sync queue becomes SyncEngine state, not a separate module
- [x] Delete `kernel/src/eventual-queue.ts`
- [x] Verify all distributed sync tests pass (including offline/eventual convergence)
- [x] Verify kernel LOC reduced by ~299 lines

### Phase 17: Stage 3.5 — Eliminate Bootstrap Chain (Weeks 40-42) ✅ Complete

The largest single kernel shrinkage step. The kernel currently carries ~1,523 LOC of Stage 0 scaffolding (parsers, engine, action-log, registry) that is load-bearing — it runs on every startup even though concept implementations exist. This phase introduces a pre-compilation step so the kernel boots from compiled artifacts instead of re-parsing specs.

- [x] Design `.copf-cache/` pre-compiled artifact format
  - [x] Serialized `CompiledSync` objects (JSON or binary)
  - [x] Concept registrations with transport configs
  - [x] ConceptManifest snapshots for each loaded concept
  - [x] Cache invalidation: hash of source `.concept` + `.sync` files
- [x] Implement `copf compile --cache` command
  - [x] Runs full compile pipeline (parse → schema → codegen → sync compile)
  - [x] Writes compiled artifacts to `.copf-cache/`
  - [x] Records source file hashes for staleness detection
- [x] Implement cached boot path in kernel
  - [x] On startup, check for `.copf-cache/` with valid hashes
  - [x] If valid: load pre-compiled syncs and registrations directly (no parsing)
  - [x] If stale or missing: fall back to full compile (with deprecation warning)
  - [x] `createSelfHostedKernel()` becomes the default (and only) path
- [x] Remove Stage 0 scaffolding from kernel
  - [x] Delete `kernel/src/parser.ts` (579 LOC)
  - [x] Delete `kernel/src/sync-parser.ts` (500 LOC)
  - [x] Remove Stage 0 `SyncEngine` class from `kernel/src/engine.ts` (~300 LOC)
  - [x] Remove Stage 0 `ActionLog` class from `kernel/src/engine.ts` (~100 LOC)
  - [x] Remove inline registry from `kernel/src/transport.ts` (~40 LOC)
- [x] Verify all startup paths work through cached boot
  - [x] `copf dev` uses cached boot with file watcher for incremental recompile
  - [x] `copf deploy` uses cached boot
  - [x] Integration tests use cached boot
- [x] Verify kernel LOC reduced by ~1,523 lines

### Phase 18: Kernel Cleanup — Barrel Exports (Weeks 42) ✅ Complete

Final cleanup after Stage 3.5. The kernel's `index.ts` shrinks from ~411 LOC to ~40 LOC of pre-conceptual dispatch code plus minimal exports.

- [x] Remove all Stage 0 factory functions (`createKernel`, etc.)
- [x] Remove all re-exports of concept interfaces now served by concept implementations
- [x] Retain only: `processFlow` dispatch, cached boot loader, transport factory
- [x] Verify kernel total is ≤600 LOC (target: ~584 LOC matching Section 10.3)
- [x] Update architecture doc Section 10.3 with final measured LOC

### Phase 19: Async Gate Convention & Pattern Validation (Weeks 43-44) ← Next

Implements the engine/concept boundary principle (Section 16.11) and async gate convention (Section 16.12). Depends on Phase 10 (FlowTrace exists) and Phase 15 (FlowTrace is a concept).

- [ ] `@gate` annotation support
  - [ ] Update spec parser to recognize `@gate` (no-arg annotation)
  - [ ] Store in ConceptAST as `annotations: { gate: boolean, version?: number }`
  - [ ] Propagate to `ConceptManifest.gate` field in SchemaGen output
  - [ ] Verify round-trip: parse → manifest → generated skeleton includes `@gate` metadata
- [ ] Pattern validator framework
  - [ ] Implement `copf check --pattern <name> <concept>` CLI command
  - [ ] Pattern validators are pluggable: each is a function `(ast: ConceptAST) → ValidationResult`
  - [ ] `ValidationResult` contains errors, warnings, and info-level messages
  - [ ] Pattern validators live in `tools/copf-cli/src/patterns/`
  - [ ] `copf check` (no flags) runs structural validation only; `--pattern` runs convention checks
- [ ] `async-gate` pattern validator
  - [ ] Check: concept has `@gate` annotation
  - [ ] Check: at least one action has an `ok` variant (proceed signal)
  - [ ] Check: at least one action has a non-ok variant (domain-specific failure)
  - [ ] Check: state section tracks pending items (heuristic: has a `set` type or a mapping)
  - [ ] Warn: actions without a `timeout` variant (long-running actions should have explicit timeout)
  - [ ] Warn: no `@gate` annotation but concept shape matches gate pattern (suggest adding it)
- [ ] Gate-aware FlowTrace builder
  - [ ] When building `TraceNode`, check if target concept has `gate: true` in manifest
  - [ ] Populate `TraceNode.gate` field: `pending` (no completion yet), `waitDescription`, `progress`
  - [ ] `waitDescription` extracted from completion fields (convention: gate impls include a `description` field)
  - [ ] `progress` extracted from completion fields (convention: `progressCurrent`, `progressTarget`, `progressUnit`)
  - [ ] Populate `TraceSyncNode.blocked` when a sync's `when` references an incomplete gate action
- [ ] Gate-aware trace renderer
  - [ ] ⏳ icon for gate actions (replacing ✅/❌) with "(async gate)" label
  - [ ] ⏸ icon + "blocked" for syncs waiting on incomplete gates (distinct from ⚠ "did not fire")
  - [ ] Human-friendly duration for gate actions (`14m 18s` instead of `858000ms`)
  - [ ] "waited for:" line showing `waitDescription` when gate completes
  - [ ] Progress bar or fraction when `progress` data available on pending gates
  - [ ] `copf trace --gates` flag: filter output to show only gate steps and their downstream chains
- [ ] Tests
  - [ ] Pattern validator: validate conforming gate concept passes, non-gate concept fails gracefully
  - [ ] FlowTrace: synthetic flow with a gate action, verify `TraceNode.gate` populated correctly
  - [ ] Trace renderer: snapshot test of gate-annotated output (completed, pending, failed)

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

## 15. Open Questions (Resolved)

All nine original open questions have been addressed by implementation review and the design decisions in Section 16. This section is retained for traceability.

1. **Ordering guarantees.** ✅ Resolved — Section 16.8. Sync-registration order with breadth-first flow processing. The firing guard makes order irrelevant for correctness.

2. **Conflict resolution for eventual syncs.** ✅ Resolved — Section 16.6. Phase 1: explicit LWW with `lastWrittenAt` timestamps in `ConceptStorage`. Phase 2 (with Distribution): optional `onConflict` hook with merge/escalate options, surfaced as `→ conflict(...)` completions for sync-level handling.

3. **Sync composition.** ✅ Resolved — Section 16.9. No meta-syncs. Composition through completion chaining. Validated by RealWorld implementation.

4. **Hot reloading.** ✅ Resolved — Section 16.3. Four scenarios: (A) `reloadSyncs` with atomic index swap, (B) `reloadConcept` for transport updates with drain, (C) `deregisterConcept` with degraded sync marking, (D) spec changes go through compiler pipeline — `copf dev` watches files and re-compiles.

5. **Testing syncs in isolation.** ✅ Resolved — Section 16.4. `createMockHandler(ast, overrides)` utility generates default ok responses from concept ASTs. ~20 lines, eliminates test boilerplate.

6. **Schema migration.** ✅ Resolved — Section 16.5. `@version(N)` on concept specs. Convention: `migrate` action on versioned concepts. Framework: startup version check, refuse-to-serve until migrated, `copf migrate` CLI.

7. **Authorization model.** ✅ Resolved — Section 16.10. Syncs are sufficient. JWT/RBAC/OAuth/API-key patterns all work as concepts + syncs. No engine-level auth layer needed.

8. **Lite query mode boundaries.** ✅ Resolved — Section 16.7. Diagnostic warning when snapshot returns >1,000 entries. Configurable threshold. Nudges developer to implement lookup/filter or switch to GraphQL mode.

9. **Observability.** ✅ Resolved — Section 16.2. Telemetry concept + sync (not observer hooks). ActionLog completions trigger `Telemetry/export` via sync. Override/disable in deploy manifest. Maps 1:1 to OpenTelemetry spans.

**Additionally identified and resolved:**

10. **Error propagation DX.** Section 16.1. `copf trace <flow-id>` renders provenance graph as annotated tree with timing, failed branches, and unfired syncs. Programmatic `FlowTrace` interface for tooling.

---

## 16. Operational Architecture

This section addresses runtime concerns beyond the core spec/sync/engine loop: how developers debug flows, observe production systems, hot-reload during development, test syncs, migrate schemas, handle conflicts in distributed deployments, and monitor query performance. Each subsection captures a design decision that was left open in earlier sections of this document.

### 16.1 Error Propagation & Flow Tracing

When a sync chain fails partway through — action A completes ok, triggers Sync B, whose `then` action returns an error variant — the developer needs to understand what happened. The ActionLog already captures the full provenance graph, but raw log entries are not a debugging tool.

**Design: `copf trace`**

The `copf trace <flow-id>` CLI command renders the provenance graph as a tree, annotated with status and timing:

```
$ copf trace flow-abc-123

flow-abc-123  Registration Flow  (142ms total, FAILED)
│
├─ ✅ Web/request → ok                          0ms
│  ├─ [ValidatePassword] →
│  │  └─ ✅ Password/validate → ok              12ms
│  │     ├─ [RegisterUser] →
│  │     │  └─ ✅ User/register → ok            34ms
│  │     │     ├─ [SetPassword] →
│  │     │     │  └─ ✅ Password/set → ok       18ms
│  │     │     └─ [GenerateToken] →
│  │     │        └─ ❌ JWT/generate → error    78ms
│  │     │           message: "signing key not configured"
│  │     │
│  │     │  ⚠ [RegistrationResponse] did not fire
│  │     │    (waiting on: JWT/generate → ok)
│  │     └─ [RegistrationError] →
│  │        └─ ✅ Web/respond → ok               0ms
│  │           body: { code: 500, error: "token generation failed" }
```

The trace shows:

- Every action invocation and completion in the flow, nested by causal chain
- Which sync triggered each invocation (in brackets)
- Timing per action (human-friendly units for long-running gate actions — `14m 18s` instead of `858000ms`)
- Failed actions with their error variant fields
- Syncs that **did not fire** because their `when` pattern was unsatisfied, with the specific missing completion shown (⚠ icon)
- Syncs that are **blocked** because an upstream async gate hasn't completed yet (⏸ icon) — distinct from pattern mismatches
- Async gate actions annotated with ⏳ icon, "(async gate)" label, optional wait description and progress — see Section 16.12 for full rendering spec
- The total flow duration and aggregate status

**Implementation:** The trace renderer walks the ActionLog's provenance edges starting from the flow's root invocation. For each completion, it checks which syncs *could have* fired (via the sync index) and marks unfired ones with the unsatisfied pattern. This is a read-only operation over existing data structures — no new runtime machinery needed.

**Programmatic access:**

```typescript
interface FlowTrace {
  flowId: string;
  status: "ok" | "failed" | "partial";
  durationMs: number;
  root: TraceNode;
}

interface TraceNode {
  action: string;          // e.g. "User/register"
  variant: string;         // e.g. "ok" or "error"
  durationMs: number;
  fields: Record<string, unknown>;  // completion fields
  children: TraceSyncNode[];

  // Present only for actions on @gate concepts (Section 16.12)
  gate?: {
    pending: boolean;          // true if action hasn't completed yet
    waitDescription?: string;  // human-readable, from concept impl
    progress?: {               // optional progress reporting
      current: number;
      target: number;
      unit: string;            // e.g. "blocks", "items", "approvals"
    };
  };
}

interface TraceSyncNode {
  syncName: string;
  fired: boolean;
  blocked: boolean;           // true if waiting on an incomplete gate
  missingPattern?: string;    // human-readable: "waiting on JWT/generate → ok"
  child?: TraceNode;          // the invocation this sync produced
}
```

The `FlowTrace` is available via `kernel.getFlowTrace(flowId)` for programmatic use in tests, observability pipelines, and custom tooling.

### 16.2 Observability

Observability is modeled as coordination between concepts — which is exactly what syncs are for. Rather than adding `addObserver(callback)` hooks to the ActionLog (which would couple observability to a specific concept's internals), observability uses the framework's own primitives.

**Design: Telemetry concept + sync**

```
concept Telemetry [S] {
  purpose {
    Export action records as structured telemetry.
    Maps naturally to OpenTelemetry spans: each flow is a trace,
    each action is a span, provenance edges are span links.
  }

  state {
    spans: set S
    exported: S -> Bool
  }

  actions {
    action export(record: ActionRecord, flowTrace: FlowTrace) {
      -> ok(spanId: String) {
        Transform the action record into an OTel-compatible span.
        Attach flow context as trace ID, provenance as parent span.
        Push to configured exporter (stdout, OTLP, Jaeger, etc.).
      }
      -> error(message: String) {
        If the exporter is unreachable. Non-fatal — telemetry
        failures must never break application flows.
      }
    }

    action configure(exporter: ExporterConfig) {
      -> ok() { Set or update the export target. }
    }
  }
}
```

**Wiring:**

```
sync ExportTelemetry {
  when {
    ActionLog/append: [] => [ id: ?id; record: ?record ]
  }
  then {
    Telemetry/export: [ record: ?record ]
  }
}
```

**DX properties:**

- Developers override or disable the `ExportTelemetry` sync in their deploy manifest — observability is opt-in per environment
- Swap export targets by swapping the Telemetry implementation (stdout for dev, OTLP for production)
- Zero new API surface — this is just another concept + sync
- Telemetry failures are isolated: if `Telemetry/export → error`, the error path fires (or doesn't). Application flows continue unaffected because the sync engine processes syncs independently

**ActionLog → OpenTelemetry mapping:**

| ActionLog | OpenTelemetry |
|-----------|---------------|
| flow ID | trace ID |
| action record ID | span ID |
| provenance parent edge | parent span ID |
| concept URI + action name | span name |
| completion variant | span status (ok → OK, error → ERROR) |
| completion fields | span attributes |
| action duration | span start/end time |
| sync name (on provenance edge) | span link annotation |

The Telemetry concept implementation is a thin adapter over whatever export SDK is configured. The reference implementation uses `@opentelemetry/sdk-trace-base` for Node.js environments.

### 16.3 Hot Reloading

During development, developers need to modify concepts and syncs without restarting the engine. There are three distinct reload scenarios, each with different semantics.

**Scenario A: Sync reload (sync definitions modified)**

The developer changes a `.sync` file. The engine needs to swap the sync index atomically.

```typescript
interface SyncEngine {
  // ... existing methods ...

  reloadSyncs(syncs: CompiledSync[]): void;
  // Atomically replaces the sync index.
  // In-flight flows (already mid-evaluation) continue using the
  // old sync set — they have captured references to the syncs
  // that matched their completions.
  // New completions arriving after the swap use the new index.
}
```

Implementation: the sync index (the `Map<string, SyncRegistration[]>` from Section 6.2) is replaced by a new `Map` built from the new sync set. The old map is not mutated — in-flight references remain valid. This is ~10 lines of code.

**Scenario B: Concept updated (same spec, new implementation)**

The developer redeploys a concept with a new implementation (bug fix, new logic) but the spec hasn't changed. The Registry receives a new `register` call with the same URI but potentially new transport config (different port, different process).

```typescript
interface Registry {
  // ... existing methods ...

  reloadConcept(uri: string, transport: TransportConfig): void;
  // Updates the transport for an existing concept.
  // In-flight invocations to the old transport drain naturally —
  // the engine doesn't cancel them.
  // New invocations route to the new transport.
}
```

This is a transport-level concern. The engine doesn't care which process answers, just that completions come back with the right shape. The old transport connection is left to drain (pending responses complete), while new invocations go to the new transport.

**Scenario C: Concept deleted**

A concept is removed from the deployment. Syncs referencing it become unfireable.

```typescript
interface Registry {
  // ... existing methods ...

  deregisterConcept(uri: string): { degradedSyncs: string[] };
  // Removes the concept from the registry.
  // Returns a list of syncs that are now degraded.
  // Degraded syncs are skipped during matching with a warning log.
}
```

Design choice: syncs referencing a deregistered concept are marked **degraded**, not deleted. This means:

- The sync engine skips degraded syncs during matching and emits a warning log per skip
- If the concept is re-registered, syncs automatically un-degrade
- The developer sees the warning and can decide whether to also remove the sync
- Silent failures in sync chains (the worst debugging experience) are avoided

**Scenario D: Concept spec changed**

If someone changes an action's signature, existing syncs may have stale field patterns. This is NOT a runtime hot-reload scenario — it's a compile-time error. Changing a spec requires re-running `copf compile-syncs`, which will fail if any sync references fields that no longer exist. Hot reload of specs should go through the compiler pipeline, not bypass it.

The `copf dev` command handles this by watching `.concept` and `.sync` files, re-compiling on change, and calling `reloadSyncs` with the new compiled set. If a spec change breaks a sync, the compiler error is shown in the terminal and the old sync set remains active.

### 16.4 Test Helpers

Two patterns exist for testing syncs: inline mock handlers and direct engine testing with synthetic completions. Both work, but involve boilerplate. A `createMockHandler` utility eliminates this.

**Design:**

```typescript
function createMockHandler(
  ast: ConceptAST,
  overrides?: Partial<Record<string, ActionHandler>>
): ConceptHandler {
  // Generates a handler from the concept AST where:
  // - Every action returns its first (ok) variant by default
  // - Output fields are populated with deterministic test values
  //   (same logic as conformance test generation — Section 7.4)
  // - Overrides let you customize specific actions for your test
  //
  // Example:
  //   const mockJwt = createMockHandler(jwtAst, {
  //     verify: async (input) => ({
  //       variant: "expired",
  //       fields: { message: "token expired" }
  //     })
  //   });
}
```

This is ~20 lines of code. It reads the concept AST's action signatures, generates default ok responses with test values for each action, and merges in any overrides. The test values match the conformance test generator's deterministic IDs, so mock outputs are consistent and predictable.

**Usage in sync tests:**

```typescript
describe("GenerateToken sync", () => {
  it("fires when User/register → ok", async () => {
    const engine = createTestEngine();

    // Mock concepts — only override what matters for this sync
    engine.register("urn:app/User", createMockHandler(userAst));
    engine.register("urn:app/JWT", createMockHandler(jwtAst));

    // Load only the sync under test
    engine.loadSync(generateTokenSync);

    // Inject synthetic completion
    const result = await engine.processCompletion({
      concept: "urn:app/User",
      action: "register",
      variant: "ok",
      fields: { user: "u-test-001" },
    });

    // Assert the sync fired and invoked JWT/generate
    expect(result.invocations).toHaveLength(1);
    expect(result.invocations[0].concept).toBe("urn:app/JWT");
    expect(result.invocations[0].action).toBe("generate");
  });
});
```

### 16.5 Schema Migration

Each concept owns its storage (sovereign storage principle), so migration logic belongs in the concept, not the framework. But the framework provides the scaffolding to make migrations safe and discoverable.

**Design:**

**Spec-level version declaration:**

```
concept User [U] {
  @version(3)

  purpose { ... }
  state { ... }
  actions { ... }
}
```

The `@version(N)` annotation is an integer that increments whenever the state schema changes in a way that requires migration (adding/removing/renaming relations or fields). Non-breaking additions (new actions, new variants) do not require a version bump.

**Migration action convention:**

Every concept that uses `@version` should declare a `migrate` action:

```
actions {
  action migrate(fromVersion: Int, toVersion: Int) {
    -> ok(migratedEntries: Int) {
      Transform stored data from fromVersion schema to toVersion schema.
      This is concept-internal logic — the concept knows its own schema history.
    }
    -> error(message: String) {
      If migration fails. The concept's storage should be left unchanged
      (migration is transactional within the concept's own storage).
    }
  }
}
```

**Framework behavior:**

1. **Startup version check.** When the engine loads a concept, it compares the spec's `@version(N)` against a `_meta.version` entry in the concept's storage. If the stored version is lower, the concept is in **migration-required** state.

2. **Refuse to serve until migrated.** A concept in migration-required state rejects all action invocations except `migrate` with a `-> needsMigration(currentVersion: Int, requiredVersion: Int)` error. This is fail-safe — no silent data corruption from schema mismatch.

3. **`copf migrate` CLI.** The CLI command calls the concept's `migrate` action and updates `_meta.version` on success:

```
$ copf migrate User
User: migrating from version 2 → 3...
User: migrated 1,247 entries. Version now 3.

$ copf migrate --check
User: version 3 (current) ✅
Password: version 1 → needs migration to version 2 ⚠
JWT: version 1 (current) ✅
```

4. **`copf migrate --all`** runs migrations for all concepts with version mismatches, in dependency order (concepts referenced in syncs are migrated before concepts that depend on their state).

**What the framework does NOT do:**

- Auto-generate migration logic. The concept author writes the `migrate` implementation because only they know the semantic mapping between schema versions.
- Track migration history. Each concept stores only its current version. If you need rollback, that's a concept-internal concern (version the migration logic, keep backups).
- Handle cross-concept migrations. If two concepts need coordinated schema changes, that's a sync — write a migration sync that calls both concepts' `migrate` actions in sequence.

### 16.6 Conflict Resolution for Eventual Syncs

When a phone concept and a server concept both modify the same logical entity while disconnected, the framework needs a conflict resolution strategy. The current implementation uses implicit last-writer-wins (LWW). This section formalizes LWW as the default and defines the path to richer conflict handling.

**Phase 1: Explicit LWW with timestamps**

The `ConceptStorage` interface adds a `lastWrittenAt` timestamp to all relation entries:

```typescript
interface ConceptStorage {
  // ... existing methods ...

  put(relation: string, key: string, fields: Record<string, unknown>): Promise<void>;
  // Now also stores: _meta: { lastWrittenAt: ISO8601 timestamp }
  // On conflict (two writes to same key), higher timestamp wins.

  getMeta(relation: string, key: string): Promise<{ lastWrittenAt: string } | null>;
  // Retrieve the write timestamp for a specific entry.
}
```

This is already implicit in most storage backends (SQLite has `datetime('now')`, Postgres has `now()`). Making it explicit in the interface means:

- Developers can inspect when an entry was last written
- The engine can log when a write overwrites a more recent entry (which is a conflict signal)
- The eventual sync queue can use timestamps for ordering

**Phase 2: Conflict detection hooks (with Distribution phase)**

When the eventual sync queue replays writes from a disconnected concept, it may encounter entries where the incoming write's timestamp is close to (within a configurable epsilon of) the existing entry's timestamp — indicating concurrent modification.

```typescript
interface ConceptStorage {
  // ... existing methods ...

  onConflict?: (
    relation: string,
    key: string,
    existing: { fields: Record<string, unknown>; writtenAt: string },
    incoming: { fields: Record<string, unknown>; writtenAt: string }
  ) => ConflictResolution;
}

type ConflictResolution =
  | { action: "keep-existing" }
  | { action: "accept-incoming" }
  | { action: "merge"; merged: Record<string, unknown> }
  | { action: "escalate" };  // surface as a -> conflict(...) completion
```

If `onConflict` is not set, the default is LWW (accept-incoming if newer, keep-existing if older). If set, the handler can implement concept-specific merge logic.

The `"escalate"` resolution produces a completion that syncs can react to:

```
sync HandleArticleConflict {
  when {
    Article/write: [] => conflict(
      key: ?id,
      existing: ?old,
      incoming: ?new
    )
  }
  then {
    Article/merge: [ id: ?id; versions: [?old, ?new] ]
  }
}
```

This keeps conflict resolution in the sync layer where it belongs — the storage layer detects conflicts, the concept (via syncs) decides what to do about them.

### 16.7 Lite Query Diagnostics

The lite query protocol's three-tier fallback (lookup → filter → snapshot) works, but the slow path can silently fetch unbounded data. A snapshot of a concept with 100k entries will transfer all of them to the engine for in-memory filtering.

**Design: diagnostic warning**

When `snapshot` returns more than 1,000 entries for a single query, the engine emits a warning:

```
⚠ Lite query slow path: snapshot of "Article" returned 12,847 entries.
  Consider implementing `lookup` or `filter` for this query pattern,
  or switching to GraphQL mode for this concept.
  Query: { relation: "article", filter: { status: "published" } }
```

This is a one-line check in the `LiteQueryAdapter`:

```typescript
if (entries.length > LITE_QUERY_WARN_THRESHOLD) {
  logger.warn(`Lite query slow path: snapshot of "${concept}" returned ${entries.length} entries...`);
}
```

The threshold defaults to 1,000 and is configurable in the deploy manifest:

```yaml
engine:
  liteQueryWarnThreshold: 5000  # or 0 to disable
```

No runtime behavior changes — this is purely a developer signal. The query still executes; the developer just gets a nudge to optimize.

### 16.8 Ordering Guarantees

When multiple syncs fire from the same completion, the engine uses **sync-registration order** with **breadth-first flow processing** (see engine.ts). The firing guard (provenance edge check, Section 6.2) makes order mostly irrelevant for correctness — if a sync could fire, it will fire exactly once regardless of order.

However, developers should understand the semantics:

- **Within a single completion:** syncs fire in registration order. If Sync A and Sync B both match the same completion, A's `then` invocation is dispatched before B's.
- **Across a flow:** breadth-first. All syncs triggered by completion C₁ fire before any syncs triggered by completions resulting from C₁'s invocations.
- **No ordering dependency between sibling syncs.** If Sync A and Sync B both fire from the same completion, neither should depend on the other's side effects. If they do, they should be a single sync or chained via an intermediate action.

The firing guard ensures that even if the implementation order changes (e.g., concurrent execution in a future version), the set of syncs that fire remains the same. Order affects latency, not correctness.

### 16.9 Sync Composition

Syncs do not reference other syncs. All composition happens through **completion chaining**: Sync A's output action produces a completion, which triggers Sync B. This was validated by the RealWorld implementation (Phase 4), where the login flow chains through five syncs without any sync referencing another.

The advantages of flat syncs over meta-syncs:

- Every sync is independently testable (inject a synthetic completion, observe the output)
- The provenance graph is a flat trace of actions, not a nested tree of sync activations
- Debugging uses `copf trace`, which shows the causal chain without needing to recurse into sync definitions
- There is no need for a "sync lifecycle" (enable/disable/pause) — syncs are either registered or not

If a pattern emerges where a group of syncs always activate together, that's a concept kit (Section 9) with required syncs, not a meta-sync.

### 16.10 Authorization Model

Authorization is modeled as syncs. The RealWorld implementation (Phase 4) proves a complete JWT auth pattern:

- `JWT/verify` is called in sync chains before protected actions
- Pattern-matching on `verify → ok` extracts user IDs into sync variable bindings
- Pattern-matching on `verify → expired` or `verify → invalid` triggers error response syncs

This is sufficient for all common auth patterns:

- **RBAC:** A `Role` concept tracks user→role mappings. Syncs check `Role/check` before protected actions.
- **OAuth:** An `OAuth` concept handles token exchange. Syncs chain `OAuth/validate → ok` into application flows.
- **API keys:** A `Key` concept validates keys. Same sync pattern as JWT.

No first-class authorization layer is needed in the engine. Authorization is coordination between concepts, which is what syncs express. Adding an engine-level auth layer would violate the "syncs are the only coordination mechanism" principle.

### 16.11 Engine/Concept Boundary Principle

The sync engine has exactly one job: receive completions, match syncs, evaluate `where` clauses, emit invocations. Every other concern — whether it's authorization, observability, finality, batching, rate limiting, approval workflows, or schema migration — is a concept wired by syncs.

**The boundary test:** should this behavior change how the engine *evaluates syncs*, or should it change *what happens in a sync chain*? If the former, it might belong in the engine. If the latter, it's a concept.

In practice, the engine owns only **delivery semantics** — the mechanics of getting messages between concepts:

| Engine annotation | What it controls |
|-------------------|-----------------|
| `[eager]` | Process immediately on completion |
| `[eventual]` | Queue if target unavailable, retry when available |
| `[local]` | Evaluate only on local engine, don't forward upstream |
| `[idempotent]` | Safe to retry without side effects |

Everything else is a **domain concern** that belongs in concepts:

| Domain concern | Concept, not annotation | Why |
|---------------|------------------------|-----|
| Chain finality | `ChainMonitor/awaitFinality` | Finality rules are chain-specific (confirmations, L1-batch, validity-proof) |
| Batch accumulation | `BatchAccumulator/add` | Batch size and flush strategy are app-specific |
| TTL / freshness | `FreshnessGate/check` | Staleness thresholds vary by data type |
| Human approval | `ApprovalQueue/submit` | Approval workflows have domain-specific escalation |
| Rate limiting | `RateLimiter/check` | Quotas and windows are per-client or per-endpoint |
| Authorization | `JWT/verify`, `Wallet/verify` | Auth rules are app-specific |

**The "gating concept" pattern:** when a sync chain needs "wait for X before proceeding," insert a gating concept as a step in the chain. The gating concept receives an invocation, holds it, and completes later when its condition is met (or fails with a domain-specific error variant). The engine doesn't know or care that the action takes milliseconds or days to complete — it just processes the completion when it arrives.

Example — finality gating without engine extensions:

```
# Step 1: chain action completes → route through gate
sync WaitForFinality {
  when {
    ArbitrumVault/lock: [] => ok(txHash: ?tx)
  }
  then {
    ChainMonitor/awaitFinality: [ txHash: ?tx; level: "l1-batch" ]
  }
}

# Step 2: gate completes → proceed with downstream action
sync BridgeAfterFinality {
  when {
    ChainMonitor/awaitFinality: [ txHash: ?tx ]
      => ok(chain: ?chain; block: ?block)
  }
  then {
    OptimismVault/mint: [ proof: ?tx ]
  }
}
```

No new annotations, no engine changes, no special handling. The engine processes `ChainMonitor/awaitFinality → ok` the same way it processes any other completion. The chain monitor's implementation decides when to send that completion — after 12 confirmations, after L1 batch posting, after validity proof, whatever the chain config specifies.

**Why not add domain annotations?** Consider `[confirmations: 12]` as a sync annotation. This would require the engine to:

1. Know what "confirmations" means (blockchain domain knowledge)
2. Know how to check confirmation count (depends on RPC provider, chain type)
3. Hold matched syncs in a pending state until confirmations reach threshold
4. Handle reorgs that reduce confirmation count

That's 200+ lines of blockchain-specific code in the engine — code that helps nobody who isn't building on blockchains. The engine grows with every domain. By contrast, a `ChainMonitor` concept encapsulates all of this, and apps that don't use blockchains never load it.

**The rule:** if you find yourself wanting a new engine annotation to change sync evaluation behavior, write a concept instead and put it in a sync chain. The engine stays at ~584 LOC forever.

### 16.12 Async Gate Convention

Kits that include gating concepts should follow a consistent pattern so the framework tooling can recognize and annotate them. This is a convention, not a language construct — the engine doesn't know about async gates. But the CLI can validate the pattern and the trace renderer can annotate gating steps specially.

**Convention: an async gate concept has:**

1. **At least one action that may complete asynchronously** — the invocation is received now, the completion arrives later (possibly much later). The concept's implementation holds the request and sends the completion when its condition is met.

2. **An `ok` variant meaning "condition met, proceed"** — downstream syncs pattern-match on this to continue the chain.

3. **At least one non-ok variant with domain-specific semantics** — `reorged`, `stale`, `rejected`, `throttled`, `timeout`, etc. These trigger compensating or error-handling sync chains.

4. **State tracking pending requests** — the concept must know what it's waiting on, so it can complete requests when conditions change, or time them out.

**Spec-level annotation:**

Gate concepts declare themselves with `@gate` so tooling can identify them:

```
@gate
concept ChainMonitor [B] {
  ...
  actions {
    action awaitFinality(txHash: String, level: String) {
      -> ok(chain: String, block: Int, confirmations: Int) { ... }
      -> reorged(txHash: String, depth: Int) { ... }
      -> timeout(txHash: String) { ... }
    }
  }
}
```

The `@gate` annotation is metadata — the engine ignores it entirely. It enables two pieces of tooling:

**`copf check --pattern async-gate <concept>`**

Validates that a concept follows the async gate convention:

```
$ copf check --pattern async-gate chain-monitor.concept

chain-monitor.concept: async-gate pattern validation
  ✅ Has @gate annotation
  ✅ Has at least one action with ok variant (awaitFinality)
  ✅ Has at least one non-ok variant (reorged, timeout)
  ✅ Has state tracking pending requests (subscriptions: set B)
  ⚠  Consider adding a timeout variant to 'subscribe' action
     (gate actions should have explicit timeout handling)

1 warning, 0 errors
```

The checker validates structural conformance: presence of `@gate`, at least one ok and one non-ok variant on a gate action, state for tracking pending items. It does not enforce specific variant names — `reorged` and `stale` and `throttled` are all valid non-ok variants. The warning about timeouts is a heuristic: long-running actions without explicit timeout handling are a common source of stuck flows.

**`copf trace` — async gate annotation in output**

When the trace renderer encounters an action on a `@gate` concept, it annotates the output differently from normal actions:

```
$ copf trace flow-bridge-001

flow-bridge-001  Cross-Chain Bridge  (14m 23s total, OK)
│
├─ ✅ ArbitrumVault/lock → ok                   2.3s
│  ├─ [WaitForFinality] →
│  │  └─ ⏳ ChainMonitor/awaitFinality → ok     14m 18s  (async gate)
│  │     level: "l1-batch"
│  │     waited for: Arbitrum batch #4891 posted to L1
│  │     ├─ [BridgeAfterFinality] →
│  │     │  └─ ✅ OptimismVault/mint → ok        4.7s
│  │     └─ [LogBridge] →
│  │        └─ ✅ ActionLog/append → ok          0ms
```

Key differences from normal trace output:

- **⏳ icon** instead of ✅ or ❌ for gate actions (indicates async wait, not instant execution)
- **"(async gate)" label** after timing, so developers immediately see this was a gating step
- **"waited for:" line** showing what condition was met (from the completion's fields)
- **Duration in human-friendly units** — gate actions can take minutes, hours, or days, so the renderer uses `14m 18s` instead of `858000ms`

For pending (not yet completed) gate actions:

```
$ copf trace flow-bridge-002

flow-bridge-002  Cross-Chain Bridge  (3m 12s elapsed, IN PROGRESS)
│
├─ ✅ ArbitrumVault/lock → ok                   2.1s
│  ├─ [WaitForFinality] →
│  │  └─ ⏳ ChainMonitor/awaitFinality           3m 10s  (async gate, pending)
│  │     level: "l1-batch"
│  │     status: 847/~900 blocks until batch post
│  │
│  │  ⏸ [BridgeAfterFinality] blocked
│  │    (waiting on: ChainMonitor/awaitFinality → ok)
```

The ⏸ icon and "blocked" label distinguish "sync hasn't fired because the gate hasn't completed yet" from "sync didn't fire because of a pattern mismatch" (which uses ⚠). The status line comes from the gate concept's implementation reporting progress — this is optional and concept-specific.

For failed gates:

```
│  ├─ [WaitForFinality] →
│  │  └─ ⏳ ChainMonitor/awaitFinality → reorged  7m 45s  (async gate, FAILED)
│  │     txHash: "0xabc..."
│  │     depth: 3
│  │     ├─ [HandleReorg] →
│  │     │  └─ ✅ ArbitrumVault/unlock → ok      1.2s
```

The gate's non-ok variant triggers compensating syncs, which appear as children in the trace — same as any other sync chain.

**Programmatic access:**

The `TraceNode` interface (Section 16.1) gains an optional gate annotation:

```typescript
interface TraceNode {
  action: string;
  variant: string;
  durationMs: number;
  fields: Record<string, unknown>;
  children: TraceSyncNode[];

  // Present only for actions on @gate concepts
  gate?: {
    pending: boolean;          // true if action hasn't completed yet
    waitDescription?: string;  // human-readable, from concept impl
    progress?: {               // optional progress reporting
      current: number;
      target: number;
      unit: string;            // e.g. "blocks", "items", "approvals"
    };
  };
}
```

The `gate` field is populated by the trace builder when it detects the target concept has `@gate` in its AST. The `waitDescription` and `progress` are optional fields that gate concept implementations can include in their completion or in-progress reporting — they're not required by the convention.

---

## 17. Kernel Shrinkage Architecture

The kernel is currently ~4,254 code LOC across 16 files — roughly 7-8x the ~500 LOC target from Section 10.3. This section defines the concept specs, extraction paths, and the Stage 3.5 pre-compilation design needed to reach that target. See Phases 14-18 in the roadmap for implementation order.

### 17.1 FlowTrace Concept (from `kernel/src/flow-trace.ts`, 353 LOC)

The architecture doc (Section 16.1) already designs FlowTrace as a concept-level concern — it reads from ActionLog (a concept) and produces debug trees. It has clear state and meaningful action variants.

```
concept FlowTrace [F] {
  purpose {
    Build and render interactive debug traces from action log records.
    Each flow becomes a navigable tree showing the causal chain of
    actions, syncs, and completions with timing and failure status.
  }

  state {
    traces: set F
    tree: F -> FlowTree
    rendered: F -> String
  }

  actions {
    action build(flowId: String) {
      -> ok(trace: F, tree: FlowTree) {
        Walk the ActionLog's provenance edges from the flow's root.
        For each completion, check the sync index for candidate syncs
        and mark unfired ones. Compute per-action timing.
        Build a FlowTree (TraceNode / TraceSyncNode structure from
        Section 16.1).
      }
      -> error(message: String) {
        If the flowId does not exist in the ActionLog.
      }
    }

    action render(trace: F, options: RenderOptions) {
      -> ok(output: String) {
        Render the FlowTree as a human-readable annotated tree.
        Options control: format (text/json), filter (failed-only,
        gates-only), verbosity (show/hide completion fields).
        Actions on @gate concepts render with ⏳ icon, async gate
        label, and optional progress reporting (Section 16.12).
        Blocked syncs (waiting on incomplete gates) render with
        ⏸ icon, distinct from unfired syncs (⚠).
      }
    }
  }
}
```

**Sync wiring:**

```
sync BuildFlowTrace {
  when {
    ActionLog/query: [ flow: ?flowId ] => [ records: ?records ]
  }
  then {
    FlowTrace/build: [ flowId: ?flowId ]
  }
}
```

The `copf trace <flow-id>` CLI calls `FlowTrace/build` then `FlowTrace/render` through the concept transport, not via direct kernel function calls.

### 17.2 DeploymentValidator Concept (from `kernel/src/deploy.ts`, 254 LOC)

Build/deploy-time tooling with zero runtime coupling. Has clear state (parsed manifests, validation results, deployment plans) and meaningful action variants.

```
concept DeploymentValidator [M] {
  purpose {
    Parse and validate deployment manifests against compiled concepts
    and syncs. Produce deployment plans with transport assignments,
    runtime mappings, and sync-to-engine bindings.
  }

  state {
    manifests: set M
    plan: M -> DeploymentPlan
    issues: M -> list ValidationIssue
  }

  actions {
    action parse(raw: String) {
      -> ok(manifest: M) {
        Parse YAML deployment manifest into structured form.
        Validate basic structure (required fields, known runtime types).
      }
      -> error(message: String) {
        If YAML is malformed or required fields are missing.
      }
    }

    action validate(manifest: M, concepts: list ConceptManifest, syncs: list CompiledSync) {
      -> ok(plan: DeploymentPlan) {
        Cross-reference manifest against compiled concepts and syncs.
        Check: all referenced concepts have specs, all syncs reference
        valid concepts, capability requirements met by runtimes,
        transport configs are valid, engine hierarchy is acyclic.
        Produce a DeploymentPlan with concrete transport assignments.
      }
      -> warning(plan: DeploymentPlan, issues: list String) {
        Validation passed but with non-fatal issues (e.g., a concept
        declared in manifest but not referenced by any sync).
      }
      -> error(issues: list String) {
        Fatal validation failures (missing concepts, broken references).
      }
    }
  }
}
```

**Sync wiring:**

```
sync ValidateDeployment {
  when {
    SchemaGen/generate: [ spec: ?spec ] => [ manifest: ?manifest ]
  }
  then {
    DeploymentValidator/validate: [ manifest: ?deployManifest;
      concepts: [?manifest]; syncs: [] ]
  }
}
```

### 17.3 Migration Concept (from `kernel/src/migration.ts`, 115 LOC)

Schema migration tracking is a genuine domain concern with state (version per concept, pending set), actions (check, complete), and meaningful variants (ok vs needsMigration). Complements the `@version(N)` spec annotation and the per-concept `migrate` action convention from Section 16.5.

```
concept Migration [C] {
  purpose {
    Track concept schema versions and gate concept startup.
    Detect when a concept's deployed storage schema differs from
    its current spec version and coordinate migration steps.
  }

  state {
    versions: C -> Int
    pending: set C
  }

  actions {
    action check(concept: C, specVersion: Int) {
      -> ok() {
        The concept's storage version matches the spec version.
        Concept is clear to serve requests.
      }
      -> needsMigration(from: Int, to: Int) {
        Storage version is behind spec version. Concept should
        reject all non-migrate requests until migration completes.
        Returns the version gap for the concept's migrate action.
      }
    }

    action complete(concept: C, version: Int) {
      -> ok() {
        Record that the concept has been migrated to the given version.
        Remove from pending set. Concept can now serve requests.
      }
    }
  }
}
```

**Sync wiring:**

```
sync CheckMigrationOnRegister {
  when {
    Registry/register: [ uri: ?uri ] => [ concept: ?c ]
  }
  where {
    SchemaGen { manifest(?uri).version as ?specVersion }
  }
  then {
    Migration/check: [ concept: ?c; specVersion: ?specVersion ]
  }
}
```

This sync fires every time a concept registers, automatically checking whether its storage version matches its spec version. If `Migration/check → needsMigration`, the concept enters migration-required state (Section 16.5).

### 17.4 SyncEngine Eventual Queue Extensions

The `DistributedSyncEngine` (`kernel/src/eventual-queue.ts`, 299 LOC) is tightly coupled to engine internals — it imports `matchWhenClause()`, `evaluateWhere()`, `buildInvocations()`, and duplicates ~60% of `SyncEngine.onCompletion()` logic. Making it a separate concept would require leaking internal matching abstractions across concept boundaries.

Instead, annotation-aware routing and queuing fold into the existing `sync-engine.concept` as additional actions:

```
// Extensions to sync-engine.concept (Section 10.1)

action queueSync(sync: CompiledSync, bindings: Bindings, flow: String) {
  -> ok(pendingId: String) {
    Queue an [eventual] sync for later execution when the target
    concept becomes available. Store bindings and flow context.
  }
}

action onAvailabilityChange(conceptUri: String, available: Bool) {
  -> ok(drained: list ActionInvocation) {
    When a concept comes online, re-evaluate all pending syncs
    that reference it. Return produced invocations for dispatch.
  }
}

action drainConflicts() {
  -> ok(conflicts: list ActionCompletion) {
    Return all conflict completions accumulated during eventual
    sync replay, for downstream handling via conflict resolution
    syncs (Section 16.6).
  }
}
```

The `onCompletion` action gains annotation-aware routing:

- `[eager]` syncs (default): evaluate immediately, as before.
- `[eventual]` syncs: if target concept is unavailable, call `queueSync` instead of dispatching. If available, evaluate normally.
- `[local]` syncs: evaluate only on the local engine instance, never forward upstream.

This eliminates the 60% code duplication because evaluation logic is shared within the concept, not reimplemented in a separate module.

### 17.5 Stage 3.5: Pre-Compilation Boot Path

The kernel currently re-parses all `.concept` and `.sync` files on every startup, even though concept implementations of the parsers exist. This is the Stage 0 bootstrap chain — it works but prevents removing the ~1,523 LOC of Stage 0 scaffolding.

**Design: `.copf-cache/` compiled artifact directory**

```
.copf-cache/
├── manifest.json              # cache metadata
│   ├── version: "1"
│   ├── sourceHashes: { "specs/password.concept": "abc123...", ... }
│   └── compiledAt: "2025-03-15T10:00:00Z"
├── concepts/
│   ├── password.manifest.json   # serialized ConceptManifest
│   ├── user.manifest.json
│   └── ...
├── syncs/
│   ├── auth.compiled.json       # serialized CompiledSync objects
│   └── ...
└── registrations.json           # concept URI → transport config mappings
```

**Cache invalidation:** On startup, the kernel computes SHA-256 hashes of all `.concept` and `.sync` source files. If any hash differs from what's recorded in `manifest.json`, the cache is stale. Stale cache triggers a deprecation warning and falls back to full compilation (which itself goes through the concept pipeline, not the Stage 0 parsers).

**Boot sequence after Stage 3.5:**

1. Kernel starts (pre-conceptual: process entry, transport factory, storage factory)
2. Check `.copf-cache/manifest.json` — if valid, load pre-compiled artifacts directly
3. Instantiate concept transports from `registrations.json`
4. Load `CompiledSync` objects from `syncs/` into the SyncEngine concept
5. Ready to serve — no parsing, no schema generation, no code generation at boot time

The `copf compile --cache` command runs the full pipeline through the concept implementations (SpecParser, SchemaGen, TypeScriptGen, SyncParser, SyncCompiler) and writes the output to `.copf-cache/`. This is a build step, not a boot step.

**After Stage 3.5, `createSelfHostedKernel()` becomes the only boot path.** The Stage 0 `createKernel()` factory and all Stage 0 parser/engine/log code are deleted.

### 17.6 Kernel Target State

After all five phases, the kernel contains only pre-conceptual code per Section 10.3:

| Module | LOC | Responsibility |
|--------|----:|----------------|
| `http-transport.ts` | ~212 | HTTP transport adapter instantiation |
| `ws-transport.ts` | ~162 | WebSocket transport adapter instantiation |
| `storage.ts` | ~117 | In-memory storage (backs every concept) |
| `transport.ts` | ~53 | In-process transport adapter |
| `index.ts` | ~40 | Message dispatch, cached boot loader |
| **Total** | **~584** | **Matches ~500 LOC target** |

Everything above this layer is spec-driven and self-hosting. The kernel's only jobs are: start the process, create transport connections, provide storage primitives, and route messages between the SyncEngine concept and other concepts.

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
| Observability | Not addressed | Telemetry concept + sync, maps to OpenTelemetry |
| Conflict resolution | Not addressed | LWW default, optional onConflict hooks with escalation |
| Schema migration | Not addressed | @version annotation, migrate action convention, CLI |
| Hot reloading | Not addressed | Atomic sync swap, concept transport drain, degraded marking |
| Debugging | Not addressed | `copf trace` provenance graph renderer, FlowTrace API |
| Domain extensibility | Not addressed | Engine/concept boundary: engine handles delivery, domains add gating concepts in sync chains |
| Convention validation | Not addressed | `@gate` annotation + `copf check --pattern` for structural conformance |
