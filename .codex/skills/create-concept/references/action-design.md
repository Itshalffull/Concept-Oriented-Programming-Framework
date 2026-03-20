# Action Design Reference

## Action Anatomy

Every action in a Clef concept follows this structure:

```
action <name>(<param>: <Type>, ...) {
  -> <variant>(<field>: <Type>, ...) { <prose description> }
  -> <variant>(<field>: <Type>, ...) { <prose description> }
}
```

An action:
1. Takes typed input parameters
2. Reads and/or modifies concept state
3. Returns one of several possible **variants** (a discriminated union)
4. Each variant has its own fields and a prose description

## Naming Conventions

### Action Names (verb-first, camelCase)

| Category | Names | Examples |
|----------|-------|----------|
| CRUD | `create`, `get`, `update`, `delete` | `create(article: A, ...)` |
| Collection | `add`, `remove`, `list` | `add(tag: T, article: String)` |
| Relationship | `follow`, `unfollow`, `favorite`, `unfavorite` | `follow(user: U, target: String)` |
| Auth | `set`, `check`, `verify`, `validate` | `check(user: U, password: String)` |
| Query (boolean) | `isFollowing`, `isFavorited` | `isFollowing(user: U, target: String)` |
| Registration | `register`, `deregister` | `register(user: U, name: String)` |
| Processing | `parse`, `generate`, `compile` | `generate(spec: S, manifest: ConceptManifest)` |
| Count | `count` | `count(article: String)` |

### Parameter Names

- Match the concept's state field names where possible
- Use the type parameter name in lowercase: `user: U`, `article: A`, `tag: T`
- Use descriptive names for non-entity params: `password: String`, `body: String`, `target: String`
- References to external entities use `String` (opaque IDs)

## Return Variant Design

### Variant Naming

| Variant | Purpose | Return fields | Used when |
|---------|---------|---------------|-----------|
| `ok` | Success | Depends on action type | Always present, always first |
| `notfound` | Entity doesn't exist | `message: String` | Lookup by ID |
| `error` | Operation failed | `message: String` | Parsing, validation, general failure |
| `invalid` | Input rejected | `message: String` | Constraint violation |
| `warning` | Success with caveats | Result + `issues: list String` | Validation with non-fatal issues |

### Return Value Patterns

**Mutations (create/update/delete) return the entity:**
```
action create(article: A, title: String) {
  -> ok(article: A) { ... }
  -> error(message: String) { ... }
}

action delete(comment: C) {
  -> ok(comment: C) { ... }
  -> notfound(message: String) { ... }
}
```

**Relationship mutations return both sides:**
```
action follow(user: U, target: String) {
  -> ok(user: U, target: String) { ... }
}
```

**Queries return the data:**
```
action get(article: A) {
  -> ok(article: A, slug: String, title: String, ...) { ... }
  -> notfound(message: String) { ... }
}

action isFollowing(user: U, target: String) {
  -> ok(following: Bool) { ... }
}

action count(article: String) {
  -> ok(count: Int) { ... }
}
```

**List/search actions return collections:**
```
action list() {
  -> ok(tags: String) { ... }
}
```

**Processing actions return structured output:**
```
action generate(spec: S, manifest: ConceptManifest) {
  -> ok(files: list { path: String, content: String }) { ... }
  -> error(message: String) { ... }
}
```

## Prose Descriptions in Variants

Each variant's prose should describe **when** this variant occurs and **what** happens — not implementation details.

**Good prose (describes behavior):**
```
-> ok(user: U) {
  Generate a random salt. Hash the password with the salt.
  Store both. Return the user reference.
}
-> invalid(message: String) {
  If the password does not meet strength requirements,
  return a description of the violation.
}
```

**Bad prose (too vague):**
```
-> ok(user: U) {
  Success.
}
```

**Bad prose (too implementation-specific):**
```
-> ok(user: U) {
  Call bcrypt.hash with cost factor 12 and store
  in PostgreSQL users table.
}
```

## Action Coverage Rules

### Every state field must be accessible

For each state field, there should be:
- At least one action that **writes** it (create, set, update)
- At least one action that **reads** it (get, list, is-query)

### Common action sets by concept type

**Entity management (CRUD):**
```
create(entity: T, ...) -> ok | error
get(entity: T) -> ok | notfound
update(entity: T, ...) -> ok | notfound
delete(entity: T) -> ok | notfound
list(...) -> ok
```

**Toggle relationship:**
```
follow(user: U, target: String) -> ok
unfollow(user: U, target: String) -> ok
isFollowing(user: U, target: String) -> ok
```

**Authentication:**
```
set(user: U, password: String) -> ok | invalid
check(user: U, password: String) -> ok | notfound
validate(password: String) -> ok
```

**Token management:**
```
generate(user: U) -> ok | error
verify(token: String) -> ok | error
```

**Transformation pipeline:**
```
generate(spec: S, manifest: ConceptManifest) -> ok | error
```

## Action Count Guidelines

| Concept Type | Typical Actions | Examples |
|-------------|----------------|----------|
| Simple entity | 2-3 | Echo (1), Tag (3) |
| Standard entity | 3-4 | Password (3), Article (4), Comment (3) |
| Relationship | 3-4 | Follow (3), Favorite (4) |
| Infrastructure | 1-3 | SchemaGen (1), Registry (3) |
| Complex orchestration | 4-6 | SyncEngine (6) |

**If you have 7+ actions**, consider whether the concept is doing too much and should be split.

## Design Decisions Actions Force

Writing down actions forces critical choices:

1. **What can fail?** Each failure mode becomes a variant.
2. **What is returned?** Deciding return values clarifies what the concept promises.
3. **What state is needed?** If an action needs data, that data must be in state.
4. **What is the API boundary?** Parameters define the contract with callers.
5. **What is NOT an action?** If behavior doesn't need its own action, it's handled by synchronization.
