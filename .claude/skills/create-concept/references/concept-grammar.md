# .concept File Grammar Reference

The `.concept` file format is parsed by a recursive descent parser at `implementations/typescript/framework/parser.ts`. This document describes the complete grammar.

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

### Custom Types in Action Parameters

Actions can reference types not defined in the concept. The parser accepts any identifier as a type. Custom types like `ConceptManifest`, `ActionRecord`, `CompiledSync` are used by framework concepts.

## Invariant Section

```
invariant {
  after set(user: x, password: "secret") -> ok(user: x)
  then check(user: x, password: "secret") -> ok(valid: true)
  and  check(user: x, password: "wrong")  -> ok(valid: false)
}
```

### Invariant Structure

```
invariant {
  after <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
  then <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
  and  <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
}
```

- **after**: Setup steps that establish state (one or more)
- **then**: First assertion step
- **and**: Additional assertion steps (zero or more)
- Multiple `invariant` blocks are allowed (one per scenario)

### Argument Values

| Syntax | Meaning | Example |
|--------|---------|---------|
| `param: variable` | Free variable binding | `user: x` |
| `param: "literal"` | String literal | `password: "secret"` |
| `param: 123` | Numeric literal | `count: 0` |
| `param: true/false` | Boolean literal | `valid: true` |
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
