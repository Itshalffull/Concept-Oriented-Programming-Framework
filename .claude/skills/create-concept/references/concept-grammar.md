# .concept File Grammar Reference

The `.concept` file format is parsed by a recursive descent parser at `handlers/ts/framework/parser.ts`. This document describes the complete grammar.

## Top-Level Structure

```
concept <Name> [<TypeParam>, ...] {
  purpose { ... }
  state { ... }
  capabilities { ... }     // optional
  actions { ... }
  invariant { ... }         // zero or more
}
```

Sections must appear in this order: purpose, state, capabilities (optional), actions, invariant(s).

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
```

Inline records use braces with comma-separated or semicolon-separated fields:
```
outputs: S -> list { path: String, content: String }
```

### State Groups

Fields can be grouped under a name (for documentation):
```
state {
  credentials {
    hash: U -> Bytes
    salt: U -> Bytes
  }
}
```

Groups are flattened during parsing — the group name becomes a prefix in the AST.

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
  -> <variant>(<field>: <Type>, ...) { <prose> }
  -> <variant>(<field>: <Type>, ...) { <prose> }
}
```

- **Action name**: camelCase verb (e.g., `create`, `get`, `delete`, `register`, `isFollowing`)
- **Parameters**: typed inputs to the action
- **Variants**: the possible return shapes (discriminated union)
- **Prose**: free-form description inside variant braces

### Variant Naming Conventions

| Variant | When to use | Return fields |
|---------|-------------|---------------|
| `ok` | Success (always first) | Entity ID for mutations, data for queries |
| `notfound` | Entity lookup failed | `message: String` |
| `error` | General failure | `message: String` |
| `invalid` | Validation failed | `message: String` |
| `warning` | Success with issues | Result + `issues: list String` |

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

**Syntax**: `fixture <name> { <key>: <value>, ... } [-> <variant>]`

- **name**: camelCase identifier describing the scenario
- **input object**: `{ key: value, ... }` with JSON-like values (strings, numbers, booleans, arrays, nested objects)
- **expected variant** (optional): `-> error`, `-> invalid`, etc. Defaults to `ok` if omitted
- Fixtures appear after variants but before the action's closing `}`

**Fixture values**:

| Syntax | Type | Example |
|--------|------|---------|
| `"text"` | String | `name: "hello"` |
| `42`, `-1`, `3.14` | Number | `count: 42` |
| `true`, `false` | Boolean | `deterministic: true` |
| `[1, 2, 3]` | Array | `ids: [1, 2, 3]` |
| `{ k: "v" }` | Nested object | `config: { timeout: 30 }` |
| `none` | Null | `optional: none` |

**Guidelines**:
- Every action should have at least one `ok` fixture with realistic inputs
- Add `-> error` or `-> invalid` fixtures to test negative paths
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

### Action Invocation Steps

Each step invokes an action and asserts its return variant:
```
action_name(param: value, ...) -> variant_name(field: value, ...)
```

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

### Assertion Expression Types

| Syntax | Meaning | Example |
|--------|---------|---------|
| `var.field` | Dot-access on bound variable | `b.status`, `r.count` |
| `var` | Bare variable reference | `s`, `count` |
| `"text"` | String literal | `"complete"` |
| `123` | Numeric literal | `0`, `42` |
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
| `param: true/false` | Boolean literal | `valid: true` |
| `param: none` | Null/absent value | `error: none` |
| `param: _` | Wildcard (any value) | `headers: _` |
| `param: { f: "v", g: 42 }` | Record literal | `manifest: { name: "Ping" }` |
| `param: ["a", "b"]` | List literal | `items: ["x", "y"]` |
| `param: []` | Empty list | `manifests: []` |

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

### Comprehensive Invariant Coverage

Every concept should have invariants covering **all qualities worth proving**:

| Quality | What to test | Example pattern |
|---------|-------------|-----------------|
| Core purpose | The defining operational principle | Create → Query returns same data |
| State correctness | Fields stored accurately | Create → Get, check each field |
| Constraint enforcement | Uniqueness, bounds, rules | Register → Register duplicate → error |
| Error handling | Invalid inputs rejected properly | Bad input → error variant with message |
| State transitions | FSM correctness | Configure (closed) → failures → tripped (open) |
| Idempotency | Repeated calls are safe | Register → Register same → exists (not error) |
| Boundary conditions | Edge cases, empty inputs, limits | Zero tokens → limited, max capacity → ok |
| Reversibility | Undo operations work | Follow → Unfollow → isFollowing = false |
| Composition readiness | Works when composed via syncs | Register → resolve returns correct metadata |

Aim for 2-5 invariants per concept. A concept with only 1 invariant testing the happy path has weak guarantees.

## Complete Example

```
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

  invariant {
    after favorite(user: u, article: "a1") -> ok(user: u, article: "a1")
    then isFavorited(user: u, article: "a1") -> ok(favorited: true)
    and  unfavorite(user: u, article: "a1") -> ok(user: u, article: "a1")
  }
}
```

## Parser Error Messages

Common parse errors and their causes:

| Error | Cause |
|-------|-------|
| `Expected 'concept'` | File doesn't start with `concept` keyword |
| `Expected '['` | Missing type parameter brackets |
| `Expected '{'` | Missing opening brace for a section |
| `Unknown section` | Section name not recognized (typo in `purpose`/`state`/`actions`) |
| `Expected '->'` | Missing arrow in action variant |
| `Unexpected token` | General syntax error — check for missing commas, braces, or parentheses |
