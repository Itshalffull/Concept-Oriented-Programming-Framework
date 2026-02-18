# Pattern Matching in When Clauses

How the sync engine matches action completions to fire syncs, including multi-pattern joins, variable consistency, and the firing guard.

## Matching Overview

When a concept action **completes**, the sync engine:

1. Looks up all syncs that reference that `Concept/action` in their `when` clause
2. For each candidate sync, tries to match **all** patterns against the flow's action log
3. Computes the cross-product of matching completions
4. Filters for consistent variable bindings
5. Checks the firing guard (has this combination already fired?)
6. For each passing combination, evaluates `where` and builds `then` invocations

## Single-Pattern Matching

The simplest case — one pattern, one completion:

```
sync GenerateToken [eager]
when {
  User/register: [] => [ user: ?user ]
}
```

This fires whenever `User/register` completes with a `user` field in its output. The engine:
1. Finds the completion for `User/register`
2. Binds `?user` to the `user` field value
3. Proceeds to `where`/`then`

## Multi-Pattern Matching

Multiple patterns form a **join** over the flow's action log. ALL patterns must match completions in the **same flow**:

```
sync RegistrationResponse [eager]
when {
  Web/request: [ method: "register" ] => [ request: ?request ]
  User/register: [] => [ user: ?user ]
  Password/set: [] => [ user: ?user ]
  JWT/generate: [] => [ token: ?token ]
}
```

The engine:
1. For each pattern, finds all matching completions in the flow
2. Computes the **cross-product** of all candidates
3. Filters combinations where the newly arrived completion is included (the trigger)
4. For each combination, checks variable consistency

This sync fires only when **all four** actions have completed in the same flow and `?user` from `User/register` equals `?user` from `Password/set`.

## Variable Consistency

The same variable name in different patterns must bind to the **same value**:

```
when {
  User/register: [] => [ user: ?user ]      // ?user = "abc123"
  Password/set: [] => [ user: ?user ]        // ?user must also = "abc123"
}
```

If `User/register` completes with `user: "abc123"` but `Password/set` completes with `user: "xyz789"`, the sync does NOT fire — the variable bindings are inconsistent.

This is how the engine knows that the password was set for the correct user, not some other user in a concurrent flow.

## Field Match Types

### Variable Binding (`?name`)

Binds the field value to the variable. If the variable is already bound (from a previous pattern), requires the value to match:

```
// First occurrence → binds ?user
User/register: [] => [ user: ?user ]

// Second occurrence → requires same value
Password/set: [] => [ user: ?user ]
```

### String Literal (`"value"`)

Exact string match. The completion must have this exact value:

```
Web/request: [ method: "login" ] => []
```

Only fires for requests where `method` is exactly `"login"`.

### Numeric Literal (`123`, `3.14`)

Exact numeric match:

```
Counter/increment: [] => [ count: 0 ]
```

### Boolean Literal (`true`, `false`)

Exact boolean match. Critical for success/error branching:

```
// Success path
Password/check: [] => [ valid: true ]

// Error path (separate sync)
Password/check: [] => [ valid: false ]
```

### Wildcard (`_`)

Matches any value, binds nothing:

```
Web/request: [ method: "register"; extra: _ ] => []
```

### Omitted Fields

Fields not listed in the pattern are not checked at all. This is different from `_` (which asserts the field exists):

```
// Matches any Web/request with method="login", regardless of other fields
Web/request: [ method: "login" ] => []
```

## Input vs Output Fields

Each pattern has two sides separated by `=>`:

```
Concept/action: [ INPUT-FIELDS ] => [ OUTPUT-FIELDS ]
```

**Input fields** (left of `=>`) match against the action's **invocation arguments** — what was passed into the action when it was called.

**Output fields** (right of `=>`) match against the action's **completion result** — what the action returned.

```
// Match when Password/check was called with user=?user AND completed with valid=true
Password/check: [ user: ?user ] => [ valid: true ]
```

### Empty Brackets

`[]` means "don't constrain this side":

```
// Match any completion of User/register, regardless of input or output
User/register: [] => []

// Match any completion where output contains user field, regardless of input
JWT/verify: [] => [ user: ?user ]

// Match invocation with method="login", regardless of what it returned
Web/request: [ method: "login" ] => []
```

## Flow Scoping

All patterns in a `when` clause match against completions **in the same flow**. A flow is a causal chain starting from an external trigger (e.g., an HTTP request).

```
Flow A: Web/request(login) → Password/check → JWT/generate → Web/respond
Flow B: Web/request(register) → User/register → Password/set → Web/respond
```

A sync with patterns for `Password/check` and `User/register` would NEVER fire, because those actions don't appear in the same flow.

## The Firing Guard

The engine prevents duplicate firings using **provenance edges**. For each unique combination of (matched completion IDs, sync name), the sync fires at most once.

This means:
- If `Article/create` completes and triggers `CreateArticleResponse`, adding another unrelated completion to the flow won't re-trigger it
- The guard is per-combination, not per-sync — if a sync has a where-clause that returns multiple rows, each row fires once
- Order of sync registration affects latency, not correctness — a sync fires whenever its conditions are met, regardless of when it was registered

## Cross-Product Performance

With N patterns each matching M completions, the engine evaluates N×M combinations. For most syncs (1-4 patterns, each matching 1 completion), this is trivial.

**Performance concern**: If a pattern like `Web/request: [ method: "register" ] => []` matches many completions in a long-running flow, the cross-product grows. Keep patterns specific — match on unique fields to narrow candidates.

## Matching Algorithm Summary

```
onCompletion(completion):
  for each sync referencing completion.concept:action:
    candidates = []
    for each pattern in sync.when:
      matches = findMatchingCompletions(pattern, flow)
      if matches.empty: skip this sync
      candidates.push(matches)

    for each combination in crossProduct(candidates):
      if completion not in combination: skip
      bindings = buildConsistentBindings(combination)
      if bindings inconsistent: skip
      if firingGuard.hasFired(combination, sync): skip

      firingGuard.record(combination, sync)
      whereResults = evaluateWhere(sync.where, bindings)
      for each result in whereResults:
        invocations = buildInvocations(sync.then, result)
        emit(invocations)
```
