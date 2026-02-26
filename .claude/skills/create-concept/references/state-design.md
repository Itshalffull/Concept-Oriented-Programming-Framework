# State Design Reference

## The Purpose of State

State is the concept's memory — what it remembers across action invocations. In Jackson's formulation, state must satisfy two properties:

1. **Sufficiency**: State is rich enough that every action can compute its result and update state correctly
2. **Necessity**: No state component exists that is never read or written by any action

## State Patterns in Clef

### Pattern A: Entity Collection (set + relations)

For concepts that manage a collection of entities:

```
state {
  articles: set A              // Primary collection
  slug: A -> String            // Entity -> single value
  title: A -> String
  body: A -> String
  author: A -> String          // Reference to external entity (opaque ID)
  tags: A -> list String       // Entity -> list
  createdAt: A -> DateTime     // Timestamp
  updatedAt: A -> DateTime
}
```

**When to use**: The concept's purpose is to manage the lifecycle of entities (create, read, update, delete).

**Examples**: User, Article, Comment, Tag

**Key characteristics**:
- Always starts with `items: set T` (the primary collection)
- Properties are individual relations from the entity to values
- References to entities from other concepts are plain `String` (opaque IDs)
- Supports timestamps (`DateTime`), text (`String`), flags (`Bool`), binary data (`Bytes`)

### Pattern B: User-Keyed Relations (no primary set)

For concepts that track relationships or properties of an external entity:

```
state {
  following: U -> set String    // User's followed targets
}
```

or:

```
state {
  hash: U -> Bytes             // User's password hash
  salt: U -> Bytes             // User's salt
}
```

**When to use**: The concept doesn't own the entities — it decorates/extends them with additional state. The entities are created elsewhere.

**Examples**: Follow, Favorite, Password, Profile, JWT

**Key characteristics**:
- No `set T` — the concept doesn't manage a collection
- Relations map the type parameter to properties or sets
- Multiple fields may share the same key type (like `hash: U -> Bytes` and `salt: U -> Bytes`)
- These get merged into a single storage relation during schema generation

### Pattern C: Rich State (custom types)

For infrastructure/framework concepts with complex state:

```
state {
  records: set R
  record: R -> ActionRecord
  edges: R -> list { target: R, sync: String }
}
```

**When to use**: The concept processes or stores structured data with custom types.

**Examples**: ActionLog, SchemaGen, SyncEngine, FlowTrace, DeploymentValidator

**Key characteristics**:
- Uses custom type names (ActionRecord, ConceptManifest, CompiledSync)
- May use inline records: `list { field: Type, field: Type }`
- State is often append-only or output-focused

## Type Reference for State Fields

### Primitive Types

| Type | Description | When to use |
|------|-------------|-------------|
| `String` | Text | Names, titles, bodies, descriptions, opaque IDs |
| `Int` | Integer | Counts, versions, indices |
| `Float` | Decimal | Measurements, scores, percentages |
| `Bool` | Boolean | Flags, toggles, status indicators |
| `Bytes` | Binary | Hashes, tokens, encrypted data, files |
| `DateTime` | Timestamp | Created/updated times, expiration dates |
| `ID` | Identifier | Unique references (similar to String) |

### Collection Types

| Type | Description | When to use |
|------|-------------|-------------|
| `set T` | Unordered unique collection | Primary entity sets, membership sets |
| `list T` | Ordered collection | Tags, items with ordering |
| `option T` | Nullable value | Optional fields (bio, avatar) |
| `T -> Type` | Key-value relation | Entity properties |
| `T -> set Type` | Key to set relation | One-to-many (following, favorites) |
| `T -> list Type` | Key to list relation | Ordered one-to-many |

## State Sizing Guidelines

Based on the 23 concepts in the current codebase:

| Concept Complexity | Typical Field Count | Examples |
|-------------------|---------------------|----------|
| Simple | 1-2 fields | Follow (1), JWT (1), Echo (2) |
| Standard | 3-5 fields | Password (2), Comment (5), Tag (2) |
| Complex | 6-8 fields | Article (8), SyncEngine (5) |
| Infrastructure | 2-4 fields | SchemaGen (1), ActionLog (3) |

**If you find yourself with 10+ state fields**, consider whether the concept is overloaded and should be split.

## State Design Checklist

1. **Start from purpose**: What must be remembered to fulfill the purpose?
2. **Identify the primary collection**: Does the concept own entities? If yes, use `set T`.
3. **Map each property**: Each entity attribute becomes a relation `T -> Type`.
4. **Check sufficiency**: Can every action compute its result from this state?
5. **Check necessity**: Is every field read or written by at least one action?
6. **Use the right types**: Don't use `String` for everything — use `Bool`, `Int`, `DateTime`, `Bytes` where appropriate.
7. **Keep references opaque**: References to entities from other concepts are always `String` (opaque IDs, mapped through the type parameter).

## State Merge Rules

When multiple fields share the same key (type parameter), the SchemaGen merges them into a single storage relation:

```
state {
  hash: U -> Bytes    // These two fields share key U
  salt: U -> Bytes    // They merge into one "entries" relation
}
```

Becomes a single relation `entries` with fields `{ u: string, hash: bytes, salt: bytes }`.

Set-valued fields get their own separate relation:
```
state {
  favorites: U -> set String  // Becomes "favorites" relation: { u: string, value: string }[]
}
```

This is handled automatically by the framework — you don't need to design for it, but it's useful to understand for debugging.
