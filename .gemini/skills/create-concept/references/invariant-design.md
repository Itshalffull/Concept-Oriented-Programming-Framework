# Invariant Design Reference

## What Invariants Represent

In Daniel Jackson's methodology, the **operational principle** is a "defining story" — an archetypal scenario proving the concept fulfills its purpose. In Clef, operational principles are expressed as `invariant` blocks.

An invariant says: "If you perform these setup actions, then these verification actions produce these results."

## What Makes an Invariant Meaningful

An invariant is meaningful when it would **catch a real bug** if the implementation were broken. Ask yourself: "If I deleted the core logic from this handler and replaced it with a stub that just returns `{ variant: 'ok' }`, would this invariant fail?" If not, the invariant is testing nothing.

### The Three Requirements

1. **Exercise real logic** — The input must be rich enough to pass through the handler's actual code paths, not just hit guard clauses or trivially succeed.

2. **Test different behaviors across steps** — The `after` and `then` steps should exercise different code paths. A good invariant tests the happy path AND either a query that confirms state, a different action that depends on the first, or an error path with genuinely different input.

3. **Match the handler's actual interface** — Field names, nesting, and types must match what the handler code reads. If the handler reads `input.manifest.name`, your invariant must provide `manifest: { name: "..." }`, not `manifest: "..."`.

### Bad Invariants (Anti-Patterns)

These invariants provide zero value and should never be written:

**Anti-pattern 1: Guard-clause only (same behavior tested twice)**
```
// BAD — both steps do the exact same thing
invariant {
  after generate(spec: "x") -> ok(manifest: m)
  then generate(spec: "y") -> ok(manifest: n)
}
```
This tests that `generate` returns `ok` for any string. It doesn't test that the handler actually *does* anything with the input. A stub handler would pass.

**Anti-pattern 2: Degenerate input**
```
// BAD — empty/minimal input that skips all real logic
invariant {
  after generate(spec: "s1", ast: {}) -> ok(manifest: m)
  then generate(spec: "s2", ast: {}) -> error(message: e)
}
```
Empty objects bypass all the handler's interesting logic. The handler might check `if (!ast.name)` and return early — you've only tested the first 3 lines of a 200-line function.

**Anti-pattern 3: Same degenerate input, same variant**
```
// BAD — tests literally nothing, both calls are identical
invariant {
  after generate(spec: "a") -> error(message: e1)
  then generate(spec: "b") -> error(message: e2)
}
```
Both steps hit the same error guard. The second step doesn't depend on the first. No state is established, no behavior is verified.

**Anti-pattern 4: Mismatched field names**
```
// BAD — handler reads manifest.tag but invariant says manifest.name
invariant {
  after generate(spec: "s1", manifest: {
    variants: [{ name: "ok" }]
  }) -> ok(files: f)
}
```
The handler expects `variant.tag` (from VariantSchema), not `variant.name`. This invariant either crashes on a TypeError or silently produces garbage because `tag` is `undefined`. Always read the handler code or type definitions to get field names right.

### Good Invariants (What to Aim For)

**Good: Happy path exercises real transformation logic**
```
invariant {
  after generate(spec: "s1", ast: {
    name: "Ping", typeParams: ["T"], purpose: "A test.",
    state: [], actions: [{
      name: "ping", params: [],
      variants: [{ name: "ok", params: [], description: "Pong." }]
    }], invariants: [], capabilities: []
  }) -> ok(manifest: m)
  then generate(spec: "s2", ast: { name: "" }) -> error(message: e)
}
```
The first step passes a minimal but **complete** AST with a real action and variant. The handler must walk the AST, resolve types, build schemas — not just check for emptiness. The second step tests genuine error detection with structurally different input.

**Good: Multi-step state flow**
```
invariant {
  after registerSync(sync: {
    name: "TestSync", annotations: ["eager"],
    when: [{ concept: "urn:clef/Test", action: "act",
             inputFields: [], outputFields: [] }],
    where: [],
    then: [{ concept: "urn:clef/Other", action: "do", fields: [] }]
  }) -> ok()
  then onCompletion(completion: {
    id: "c1", concept: "urn:clef/Test", action: "act",
    input: {}, variant: "ok", output: {}, flow: "f1",
    timestamp: "2024-01-01T00:00:00Z"
  }) -> ok(invocations: inv)
}
```
The first step registers a sync rule. The second step fires a completion that *matches* the sync's when-clause. This tests the core engine logic: indexing, pattern matching, variable binding, invocation building. If the matching logic were broken, this invariant would fail.

**Good: Create-then-query proves storage works**
```
invariant {
  after register(uri: "test://concept-a", transport: "in-process") -> ok(concept: c)
  then heartbeat(uri: "test://concept-a") -> ok(available: true)
}
```
The second step depends on state established by the first. If `register` didn't store the concept, `heartbeat` would fail. This is the fundamental operational principle: "if you register a concept, it's available."

**Good: Positive and negative in one invariant**
```
invariant {
  after set(user: x, password: "secret") -> ok(user: x)
  then check(user: x, password: "secret") -> ok(valid: true)
  and  check(user: x, password: "wrong")  -> ok(valid: false)
}
```
Three steps, two different outcomes. The first check proves correct passwords work, the second proves incorrect passwords are rejected. A stub handler returning `valid: true` always would fail the third step.

### How to Design an Invariant: Step by Step

1. **Read the handler code** (or at minimum the spec's action prose). Understand what the handler actually does with its inputs.

2. **Identify the minimal valid input** that exercises the handler's core logic — not just guard clauses. For a code generator, this means a manifest with at least one action and one variant. For a parser, this means a syntactically valid source string. For a registry, this means a URI and transport config.

3. **Choose what the second step should prove**:
   - If the concept has a query action: query the state created by step 1
   - If the concept has only one action: test the error path with structurally different (not just empty) input
   - If the concept processes multi-step flows: the second step should depend on state from the first

4. **Verify field names against the handler/types**. Read `kernel/src/types.ts` or the handler implementation. Common mistakes: `name` vs `tag`, `params` vs `fields`, `description` vs `prose`.

5. **Ask: "Would a trivial stub pass this?"** If yes, your invariant needs more substance.

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
| `param: { f1: "v", f2: 42 }` | Record literal — nested object with named fields |
| `param: ["a", "b", "c"]` | List literal — ordered collection of values |
| `param: []` | Empty list literal |
| `param: { name: "X", items: [{ tag: "ok" }] }` | Nested records and lists can be combined |

Free variables receive deterministic test values during conformance test generation (e.g., `x` becomes `"u-test-invariant-001"`, `y` becomes `"u-test-invariant-002"`).

Record and list literals are essential for testing framework/infrastructure concepts that accept structured inputs (ASTs, manifests, configuration objects). Use them whenever a handler expects structured data rather than simple scalars.

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

### Pattern 8: Process Structured Input (Pipeline/Transform)

Proves: the concept correctly processes valid structured data and rejects invalid input.

```
invariant {
  after generate(spec: "s1", manifest: {
    name: "Ping", uri: "urn:clef/Ping", typeParams: [], relations: [],
    actions: [{ name: "ping", params: [],
      variants: [{ tag: "ok", fields: [], prose: "Pong." }] }],
    invariants: [], graphqlSchema: "",
    jsonSchemas: { invocations: {}, completions: {} },
    capabilities: [], purpose: "A test."
  }) -> ok(files: f)
  then generate(spec: "s2", manifest: { name: "" }) -> error(message: e)
}
```

**When to use**: Framework/infrastructure concepts that transform, validate, or process structured data (ASTs, manifests, configurations, sync rules).

**What it proves**: "Given valid structured input, the concept produces correct output. Given invalid input, it returns an error."

**Key technique**: Use record `{ }` and list `[ ]` literals to pass minimal-but-real structured input. The first step passes a complete (though minimal) valid structure. The second step passes a deliberately broken structure to verify error handling.

**Examples**: SchemaGen, TypeScriptGen, RustGen, SwiftGen, SolidityGen, SyncCompiler, SyncParser, SyncEngine, FlowTrace, DeploymentValidator

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

## Formal Verification Invariant Constructs

Six constructs are supported (see docs/plans/clef-fv.md Section 1). Bare `invariant { ... }` blocks default to `example` kind.

### `example` — Named Conformance Test (Tier 1)
```
example "happy path": {
  after create(name: "alice") -> ok(user: u)
  then get(user: u) -> ok(user: u, name: "alice")
}
```
Generates a 1:1 test vector. This is the same as bare `invariant { ... }` but with a name.

### `forall` — Universally Quantified Property (Tier 2-3)
```
forall "valid kinds accepted": {
  given kind in {"invariant", "precondition", "postcondition"}
  after define(kind: kind) -> ok(property: _)
}
```
Generates one PBT (property-based test) property per clause. Solver target: Alloy (finite) / Z3 (infinite).

### `always` — State Predicate (Tier 2-3)
```
always "status consistency": {
  forall p in items:
    p.status in ["active", "inactive", "archived"]
}
```
Must hold in every reachable state. Generates stateful sequence tests. Solver target: Z3 / Alloy.

### `never` — Safety Property (Tier 2-3)
```
never "orphaned items": {
  exists p in items:
    p.status = "deleted"
}
```
A bad state that must never be reachable. Generates violation-attempt sequence tests. Solver target: Z3 (negated existential).

### `eventually` — Liveness Property (Tier 3)
```
eventually "runs terminate": {
  forall r in runs where r.status = "running":
    r.status in ["completed", "timeout", "cancelled"]
}
```
An outcome that must eventually occur. Generates bounded sequence tests. Solver target: TLC (TLA+).

### `action requires/ensures` — Pre/Postcondition Contracts (Tier 2-3)
```
invariant {
  action define {
    requires: kind in ["invariant", "precondition"]
    requires: propertyText.length > 0
    ensures ok: result.kind = kind
    ensures invalid: kind != "invariant"
  }
}
```
Pre/postconditions on actions. Generates PBT generators constrained by requires, assertions from ensures. Solver target: Z3 / Dafny.

### Property Assertions in Then-Chains
```
invariant {
  after configure(endpoint: "api", threshold: 5) -> ok(breaker: b)
  then b.failureCount = 0
  and  b.status != "open"
}
```
Supported operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `in`

### `when` Guard Clauses
```
invariant {
  when r.runtime = "onnx"
  after register(name: "model", runtime: "onnx") -> ok(instance: r)
  then resolve(name: "model") -> ok(instance: r, runtime: "onnx", config: _)
}
```

## How Many Invariants?

**Invariants should be comprehensive** — they are the concept's behavioral contract and the source of all test generation and formal verification. Cover all qualities you want to prove:

| Concept Type | Recommended | What to Cover |
|-------------|-------------|---------------|
| Domain entity (CRUD) | 3-5 | Create→query, update→verify, delete→notfound, constraint violation, field correctness |
| Relationship (toggle) | 2-3 | Full cycle, idempotency, negative check |
| Authentication | 2-3 | Correct password, wrong password, missing user |
| Constraint enforcement | 2-3 | Violation triggered, boundary values, valid inputs near boundary |
| Registry/dispatch | 3-5 | Register→resolve, duplicate→exists, not-found, list all, dispatch routing |
| State machine (FSM) | 3-5 | Each major transition, invalid transition rejection, reset |
| Infrastructure/pipeline | 2-4 | Valid input → ok, invalid → error, structured data handling, edge cases |
| Provider | 2-3 | Registration metadata, transport effects declared, resolution by name |

### Comprehensive Coverage Checklist

For every concept, ask whether you've covered:

- [ ] **Core operational principle** — The defining "if you do X, then Y" story (`example`)
- [ ] **State correctness** — Data stored matches data retrieved (`example` with field checks)
- [ ] **Error paths** — Each error variant is reachable (`example` with invalid input)
- [ ] **Constraint enforcement** — Uniqueness, bounds, business rules (`example` + `never`)
- [ ] **Idempotency** — Repeated calls behave correctly (`example`)
- [ ] **Boundary conditions** — Empty inputs, zero values, max capacity (`forall` with `given`)
- [ ] **State transitions** — FSM correctness (`always` for valid states, `never` for invalid)
- [ ] **Liveness** — Long-running operations eventually complete (`eventually`)
- [ ] **Contracts** — Pre/postconditions on actions (`action requires/ensures`)
- [ ] **Composition readiness** — Resolve/dispatch returns correct metadata (`example`)

**Every concept should have at least one invariant.** Most should have 3-5 using a mix of constructs. A concept without invariants has no machine-verifiable behavioral contract.

## Test Value Guidelines

Choose test values that are:
- **Realistic**: `"Test Article"` not `"foo"`, `"a@b.com"` not `"email"`
- **Distinguishable**: If testing uniqueness, use different values for different variables
- **Deterministic**: If testing computed values (like slugs), know what the output will be
- **Sufficient**: Include enough fields/structure to exercise the handler's real logic, not just its guard clauses
- **Accurate**: Field names must match the handler's actual expectations (`tag` not `name` for VariantSchema, etc.)

### Choosing Input Complexity

The right level of input complexity depends on the handler:

| Handler accepts... | Invariant should pass... |
|-------------------|------------------------|
| Simple scalars (String, Int, Bool) | String/number/boolean literals |
| An opaque ID (type parameter) | A free variable (`user: x`) |
| A structured object (AST, Manifest) | A record literal with all fields the handler reads |
| A list of structured objects | A list with at least one complete item |
| A string that gets parsed (JSON, YAML, source code) | A realistic string the parser accepts |

**The key principle**: your invariant input should be the **smallest input that still exercises the handler's core logic path**. Not empty, not degenerate, not a real-world 500-field monster — just enough to make the handler do real work.

For example, a code generator handler that iterates over `manifest.actions` and for each action iterates over `action.variants` needs at minimum:
```
manifest: {
  name: "Ping", ...,
  actions: [{ name: "ping", params: [],
    variants: [{ tag: "ok", fields: [], prose: "Pong." }] }]
}
```
One action, one variant. This exercises the iteration logic, type mapping, and template generation. An empty `actions: []` would skip all of that.

### Common Mistakes with Test Values

| Mistake | Why it's bad | Fix |
|---------|-------------|-----|
| `manifest: {}` | Skips all handler logic, hits first guard | Include all fields the handler reads |
| `source: ""` | Empty string hits "nothing to parse" guard | Use a minimal valid source string |
| Same value in both steps | Second step doesn't test anything new | Use structurally different input |
| Wrong field names | Handler reads `undefined`, may silently produce garbage | Read the types or handler code |
| Giant real-world input | Hard to read, maintain, and debug | Use minimal sufficient input |

## Invariant Design Checklist

Before finalizing an invariant, verify ALL of these:

**Purpose alignment:**
- [ ] Does the invariant demonstrate the concept's core purpose?
- [ ] Could you explain in one sentence what behavior this invariant proves?

**Input quality:**
- [ ] Does the first step pass input rich enough to exercise real handler logic (not just guard clauses)?
- [ ] For structured inputs: are all fields that the handler reads present with correct names?
- [ ] Would a trivial stub handler (`return { variant: 'ok' }`) FAIL this invariant?

**Step relationships:**
- [ ] Do the steps test DIFFERENT behaviors (not the same action with slightly different strings)?
- [ ] Does at least one step depend on state established by a previous step? Or does the second step test a genuinely different code path (error vs ok)?

**Coverage:**
- [ ] Does the invariant cover the "happy path" (primary operational principle)?
- [ ] If the concept has constraints or error conditions, is there an invariant showing them?

**Variable usage:**
- [ ] Are free variables used for entity IDs (not hardcoded strings)?
- [ ] Are literal values realistic and meaningful?
- [ ] Does each invariant test one logical scenario (not multiple unrelated things)?
