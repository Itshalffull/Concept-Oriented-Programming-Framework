# Sync Design Reference

Complete guide to designing synchronization rules in Clef. Syncs are the **only** mechanism for composing independent concepts into user-visible flows.

## What Syncs Do

A sync rule says: "When these actions produce these results, then trigger this action." Syncs are the glue between independent concepts — they carry data across concept boundaries without creating compile-time dependencies.

## Sync File Structure

Sync files live at `syncs/app/<flow-name>.sync`. Each file groups related sync rules by domain:

```
// Description of this flow

sync RuleName [annotation]
when {
  Concept/action: [ field: ?var; field: value ] => [ field: ?var ]
}
where {
  Concept: { ?entity field: ?var }
  bind(expression as ?var)
}
then {
  Concept/action: [ field: ?var; field: value ]
}
```

## Sync Rule Anatomy

### The `when` Clause

Specifies the preconditions — which concept actions must have fired and what their inputs/outputs were.

```
when {
  // Match on action input AND output
  Web/request: [ method: "login"; email: ?email; password: ?password ]
    => [ request: ?request ]

  // Match on just the output
  Password/check: [ user: ?user ]
    => [ valid: true ]
}
```

**Pattern syntax:**
- `field: ?var` — Bind the field value to variable `?var`
- `field: value` — Match only if field equals this literal value
- `field: ?var` in input + `field: ?var` in output — Same variable links input to output
- `=> []` — Output pattern is empty (match any output)

**Multiple when entries** act as AND — all must be satisfied for the rule to fire.

### The `where` Clause (Optional)

Performs lookups and bindings that aren't concept actions:

```
where {
  // Entity lookup: find entity with matching field
  User: { ?user email: ?email }

  // Multiple field lookup
  Article: { ?a slug: ?slug; title: ?title; author: ?author }

  // Variable binding with expression
  bind(uuid() as ?id)
  bind(now() as ?timestamp)
}
```

**Entity lookup**: `Concept: { ?entity field: ?value }` — Find an entity in the concept's state where the field matches. Binds the entity to `?entity` and any new fields to their variables.

**Bind expression**: `bind(expr as ?var)` — Compute a value and bind it. Common expressions:
- `uuid()` — Generate a unique ID
- `now()` — Current timestamp

### The `then` Clause

Specifies the action to trigger when conditions are met:

```
then {
  Article/create: [
    article: ?article;
    title: ?title;
    description: ?desc;
    body: ?body;
    author: ?author ]
}
```

**Only one action** per `then` clause. If multiple actions must happen, use separate sync rules that chain (the output of one becomes the `when` input of the next).

### Annotations

```
sync RuleName [eager]
```

- `[eager]` — Execute as soon as conditions are met (most common)
- Other annotations may be added for lazy evaluation, debouncing, etc.

## Sync Patterns

### Pattern 1: Auth Gate

Every authenticated operation starts with verifying the JWT:

```
sync OperationAuth [eager]
when {
  Web/request: [ method: "operation_name"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}
```

This pattern is always the first sync in any authenticated flow. The `?token` flows from the web request to the JWT concept.

### Pattern 2: Authenticated Action

After auth, perform the actual concept action:

```
sync PerformOperation [eager]
when {
  Web/request: [ method: "operation_name"; fieldA: ?a; fieldB: ?b ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
then {
  Concept/action: [ field: ?a; field: ?b; user: ?user ]
}
```

Key: The `JWT/verify => [ user: ?user ]` in the when clause ensures this only fires after successful auth. The `?user` variable flows from JWT verification into the concept action.

### Pattern 3: Success Response

Return the result to the client:

```
sync OperationResponse [eager]
when {
  Web/request: [ method: "operation_name" ]
    => [ request: ?request ]
  Concept/action: []
    => [ result: ?result ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ key: ?result ] ]
}
```

### Pattern 4: Failure Response

Handle errors from concept actions:

```
sync OperationFailure [eager]
when {
  Web/request: [ method: "operation_name" ]
    => [ request: ?request ]
  Concept/action: []
    => [ message: ?error ]
}
then {
  Web/respond: [
    request: ?request;
    error: ?error;
    code: 422 ]
}
```

### Pattern 5: Cascade Delete

When deleting a parent entity, delete dependent entities:

```
sync CascadeDeleteChildren [eager]
when {
  Parent/delete: [ parent: ?parent ]
    => [ parent: ?parent ]
}
where {
  Child: { ?child parentRef: ?parent }
}
then {
  Child/delete: [ child: ?child ]
}
```

The `where` clause finds all children that reference the deleted parent. The sync engine iterates over all matching entities.

### Pattern 6: Validation Gate

Validate input before proceeding with the main action:

```
sync ValidateInput [eager]
when {
  Web/request: [ method: "register"; password: ?password ]
    => [ request: ?request ]
}
then {
  Password/validate: [ password: ?password ]
}

sync ValidateInputError [eager]
when {
  Web/request: [ method: "register" ]
    => [ request: ?request ]
  Password/validate: [ password: ?password ]
    => [ valid: false ]
}
then {
  Web/respond: [
    request: ?request;
    error: "Validation failed";
    code: 422 ]
}

sync ProceedAfterValidation [eager]
when {
  Web/request: [ method: "register"; data: ?data ]
    => []
  Password/validate: []
    => [ valid: true ]
}
then {
  Concept/action: [ data: ?data ]
}
```

### Pattern 7: Chain Multiple Concepts

When a flow requires multiple concept actions in sequence:

```
// Step 1: First concept action
sync StepOne [eager]
when {
  Web/request: [ method: "register"; data: ?data ]
    => []
  Validation/check: []
    => [ valid: true ]
}
then {
  ConceptA/create: [ data: ?data ]
}

// Step 2: Second concept action, triggered by step 1's output
sync StepTwo [eager]
when {
  Web/request: [ method: "register"; extra: ?extra ]
    => []
  ConceptA/create: []
    => [ id: ?id ]
}
then {
  ConceptB/associate: [ ref: ?id; extra: ?extra ]
}

// Step 3: Respond only when both are done
sync FinalResponse [eager]
when {
  Web/request: [ method: "register" ]
    => [ request: ?request ]
  ConceptA/create: []
    => [ id: ?id ]
  ConceptB/associate: []
    => [ ref: ?id ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ created: ?id ] ]
}
```

### Pattern 8: Unauthenticated Action

Simple operations without JWT (e.g., echo, health check):

```
sync HandleAction [eager]
when {
  Web/request: [ method: "action_name"; input: ?input ]
    => [ request: ?request ]
}
where {
  bind(uuid() as ?id)
}
then {
  Concept/action: [ id: ?id; input: ?input ]
}

sync ActionResponse [eager]
when {
  Web/request: [ method: "action_name" ]
    => [ request: ?request ]
  Concept/action: []
    => [ output: ?output ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ result: ?output ] ]
}
```

## Naming Conventions

| Pattern | Naming Convention | Example |
|---------|-------------------|---------|
| Auth gate | `<Action>Auth` | `CreateArticleAuth` |
| Perform action | `Perform<Action>` | `PerformCreateArticle` |
| Success response | `<Action>Response` | `CreateArticleResponse` |
| Failure response | `<Action>Failure` or `<Action>Error` | `LoginFailure`, `RegistrationError` |
| Cascade | `CascadeDelete<Children>` | `CascadeDeleteComments` |
| Validation | `Validate<Thing>` | `ValidatePassword` |
| Chained step | `<FlowName><Step>` | `RegisterUser`, `SetPassword`, `GenerateToken` |

## File Organization

Group syncs by **user-visible flow**, one file per flow:

```
syncs/app/
├── login.sync           # Login flow (4 rules)
├── registration.sync    # Registration flow (7 rules)
├── articles.sync        # Article CRUD (10 rules + cascade)
├── comments.sync        # Comment CRUD (6 rules)
├── social.sync          # Follow + Favorite (12 rules)
├── profile.sync         # Profile update (3 rules)
└── echo.sync            # Echo diagnostic (2 rules)
```

**Rule of thumb**: If a flow has both success and failure paths, expect 3-4 sync rules per operation (auth + perform + success response + failure response).

## Data Flow Rules

1. **Variables are scoped to a single sync rule** — `?user` in one rule is independent of `?user` in another
2. **Variables flow forward**: bound in `when` or `where`, consumed in `then`
3. **Literal values are exact matches**: `method: "login"` only matches the string "login"
4. **The `Web/request` action is the entry point** for all HTTP-triggered flows
5. **The `Web/respond` action is the exit point** — it sends data back to the client
6. **Entity lookups in `where` bind all fields** — you can extract multiple fields from a single entity

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Calling two concept actions in one `then` | Sync rules have exactly one `then` action | Split into two rules; chain via outputs |
| Using a variable not bound in `when`/`where` | Unbound variable | Add binding in `when` pattern or `where` clause |
| Missing failure path | User gets no response on error | Add a separate failure sync rule |
| Auth gate missing from authenticated flow | Unauthenticated access | Add `<Action>Auth` sync as first rule |
| Response sync doesn't wait for all steps | Premature response | Add all prerequisite actions to the `when` clause |
