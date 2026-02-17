# Invariant Design Reference

## What Invariants Represent

In Daniel Jackson's methodology, the **operational principle** is a "defining story" — an archetypal scenario proving the concept fulfills its purpose. In COPF, operational principles are expressed as `invariant` blocks.

An invariant says: "If you perform these setup actions, then these verification actions produce these results."

## Invariant Structure

```
invariant {
  after <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
  then <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
  and  <action>(<arg>: <value>, ...) -> <variant>(<arg>: <value>, ...)
}
```

- **after**: One or more setup steps that establish state
- **then**: The first verification step
- **and**: Additional verification steps (zero or more)

Multiple `invariant` blocks are allowed for different scenarios.

## Argument Values

| Syntax | Meaning |
|--------|---------|
| `param: x` | Free variable — bound on first use, reused across steps |
| `param: "text"` | String literal |
| `param: 123` | Numeric literal |
| `param: true` / `param: false` | Boolean literal |

Free variables receive deterministic test values during conformance test generation (e.g., `x` becomes `"u-test-invariant-001"`, `y` becomes `"u-test-invariant-002"`).

## Invariant Patterns

### Pattern 1: Create then Query

Proves: entities are correctly stored and retrievable.

```
invariant {
  after create(article: a, title: "Test Article", body: "Content", author: "u1") -> ok(article: a)
  then get(article: a) -> ok(article: a, slug: "test-article", title: "Test Article", body: "Content", author: "u1")
}
```

**When to use**: Any concept that creates entities (CRUD concepts).

**What it proves**: The operational principle "if you create something, you can retrieve it with the same data."

**Examples**: Article, Profile, User, JWT

### Pattern 2: Mutate then Verify then Reverse

Proves: state changes are observable, and operations are reversible.

```
invariant {
  after follow(user: u, target: "u2") -> ok(user: u, target: "u2")
  then isFollowing(user: u, target: "u2") -> ok(following: true)
  and  unfollow(user: u, target: "u2") -> ok(user: u, target: "u2")
}
```

**When to use**: Toggle/relationship concepts (follow, favorite, like).

**What it proves**: "If you follow someone, you are following them. You can also unfollow them."

**Examples**: Follow, Favorite

### Pattern 3: Set then Verify (Positive and Negative)

Proves: authentication/validation works correctly for both valid and invalid inputs.

```
invariant {
  after set(user: x, password: "secret") -> ok(user: x)
  then check(user: x, password: "secret") -> ok(valid: true)
  and  check(user: x, password: "wrong")  -> ok(valid: false)
}
```

**When to use**: Verification/authentication concepts.

**What it proves**: "If you set a password, the correct password succeeds and the wrong password fails."

**Examples**: Password

### Pattern 4: Constraint Violation

Proves: uniqueness constraints or business rules are enforced.

```
invariant {
  after register(user: x, name: "alice", email: "a@b.com") -> ok(user: x)
  then register(user: y, name: "alice", email: "c@d.com") -> error(message: "name already taken")
}
```

**When to use**: Concepts with uniqueness or exclusivity constraints.

**What it proves**: "If a name is already taken, a second registration fails."

**Examples**: User

### Pattern 5: Sequential Accumulation

Proves: multiple operations accumulate state correctly.

```
invariant {
  after add(tag: t, article: "a1") -> ok(tag: t)
  then add(tag: t, article: "a2") -> ok(tag: t)
}
```

**When to use**: Concepts where the same action is called multiple times.

**What it proves**: "You can add multiple articles to the same tag."

**Examples**: Tag, Echo

### Pattern 6: Create then Delete (Lifecycle)

Proves: entities can be removed after creation.

```
invariant {
  after create(comment: c, body: "Great post", target: "a1", author: "u1") -> ok(comment: c)
  then delete(comment: c) -> ok(comment: c)
}
```

**When to use**: Concepts with full entity lifecycle.

**What it proves**: "If you create something, you can delete it."

**Examples**: Comment, Article

### Pattern 7: Generate then Verify (Token/Crypto)

Proves: generated tokens can be verified.

```
invariant {
  after generate(user: u) -> ok(token: t)
  then verify(token: t) -> ok(user: u)
}
```

**When to use**: Token/session/crypto concepts.

**What it proves**: "A generated token can be verified to recover the user."

**Examples**: JWT

## Variable Binding Conventions

| Variable | Typical use |
|----------|-------------|
| `x`, `y` | Users or generic entities (when multiple needed) |
| `u` | Single user reference |
| `a` | Article reference |
| `c` | Comment reference |
| `t` | Tag or token reference |
| `m` | Message reference |

Use short, single-letter names. Variables are bound on first occurrence and reused by name.

## How Many Invariants?

| Concept Type | Recommended | Reasoning |
|-------------|-------------|-----------|
| Domain entity (CRUD) | 1-2 | One for create-query, one for lifecycle |
| Relationship (toggle) | 1 | One showing full cycle: add, verify, remove |
| Authentication | 1 | One showing set, check-correct, check-wrong |
| Constraint enforcement | 1 | One showing the constraint violation |
| Infrastructure/pipeline | 0 | Often have no user-facing invariants |

**Every domain concept should have at least one invariant.** Framework/infrastructure concepts may omit invariants if their behavior is purely transformational.

## Test Value Guidelines

Choose test values that are:
- **Realistic**: `"Test Article"` not `"foo"`, `"a@b.com"` not `"email"`
- **Distinguishable**: If testing uniqueness, use different values for different variables
- **Deterministic**: If testing computed values (like slugs), know what the output will be

## Invariant Design Checklist

- [ ] Does the invariant demonstrate the concept's core purpose?
- [ ] Does it cover the "happy path" (primary operational principle)?
- [ ] If the concept has constraints, is there an invariant showing constraint violation?
- [ ] Are free variables used for entity IDs (not hardcoded strings)?
- [ ] Are literal values realistic and meaningful?
- [ ] Does each invariant test one logical scenario (not multiple unrelated things)?
