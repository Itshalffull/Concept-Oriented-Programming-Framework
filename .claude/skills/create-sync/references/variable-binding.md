# Variable Binding in Syncs

How `?variable` bindings work across `when`, `where`, and `then` blocks — scoping, sources, consistency, and multi-row expansion.

## Variable Scope

Variables are scoped to the **entire sync**. A variable bound in `when` is available in `where` and `then`. A variable bound in `where` is available in `then`.

```
sync LoginResponse [eager]
when {
  Web/request: [ method: "login"; email: ?email ]     // ?email bound here
    => [ request: ?request ]                            // ?request bound here
  JWT/generate: [ user: ?user ]                         // ?user bound here
    => [ token: ?token ]                                // ?token bound here
}
where {
  User: { ?u email: ?email; name: ?username }           // ?email used as filter
                                                        // ?username bound here
}
then {
  Web/respond: [
    request: ?request;                                  // all variables available
    body: [
      user: [
        username: ?username;
        email: ?email;
        token: ?token ] ] ]
}
```

## Binding Sources

Variables can be bound from four sources:

### 1. When-Clause Input Fields

Binds from the action's **invocation arguments** (what was passed in):

```
when {
  Web/request: [ method: "register"; username: ?username; email: ?email ]
    => [ request: ?request ]
}
```

- `?username` ← the `username` argument passed to `Web/request`
- `?email` ← the `email` argument passed to `Web/request`

### 2. When-Clause Output Fields

Binds from the action's **completion result** (what was returned):

```
when {
  JWT/verify: [] => [ user: ?user ]
  Article/create: [] => [ article: ?article ]
}
```

- `?user` ← the `user` field in `JWT/verify`'s completion output
- `?article` ← the `article` field in `Article/create`'s completion output

### 3. Where-Clause bind() Expressions

Generates a new value and binds it:

```
where {
  bind(uuid() as ?article)
  bind(now() as ?timestamp)
}
```

- `?article` ← a newly generated UUID
- `?timestamp` ← the current time

`uuid()` is the most common bind expression — used whenever a sync creates a new entity.

### 4. Where-Clause Concept Queries

Looks up concept state and binds fields from the result:

```
where {
  User: { ?u name: ?username; email: ?email }
}
```

- `?u` ← the record key from the User concept
- `?username` ← the `name` field from the matching record
- `?email` ← the `email` field from the matching record

## Binding Consistency

When the same variable appears multiple times, all occurrences must have the **same value**:

```
when {
  User/register: [] => [ user: ?user ]       // ?user = "abc"
  Password/set: [] => [ user: ?user ]         // ?user must = "abc"
}
```

This is enforced during cross-product matching. If two completions bind `?user` to different values, that combination is rejected.

**Common use**: Ensuring multiple actions are about the same entity:

```
when {
  Web/request: [ method: "register" ] => [ request: ?request ]
  User/register: [] => [ user: ?user ]
  Password/set: [] => [ user: ?user ]         // same user
  JWT/generate: [] => [ token: ?token ]
}
```

## Query Variables: Filter vs Bind

In `where` concept queries, already-bound variables act as **filters**, and unbound variables get **bound** from results:

### Already bound → Filter

```
when {
  Web/request: [ method: "login"; email: ?email ] => []
}
where {
  // ?email is already bound from when-clause
  // Query filters User records where email matches ?email
  User: { ?user email: ?email }
}
```

The query returns only User records whose `email` field equals the value already bound to `?email`.

### Not yet bound → Bind

```
when {
  Article/create: [] => [ article: ?article ]
}
where {
  // ?slug, ?title, ?author are NOT yet bound
  // Query binds them from the matching Article record
  Article: { ?a slug: ?slug; title: ?title; author: ?author }
}
```

The query looks up the Article record and binds `?slug`, `?title`, and `?author` from its fields.

### Mixed: Some filter, some bind

```
when {
  Web/request: [ method: "login"; email: ?email ] => []
}
where {
  // ?email filters, ?user and ?username bind
  User: { ?user email: ?email; name: ?username }
}
```

## Multi-Row Expansion

If a `where` query returns **multiple records**, the `then` clause executes **once per record**. Each execution gets different variable bindings.

This is how cascade deletes work:

```
sync CascadeDeleteComments [eager]
when {
  Article/delete: [ article: ?article ] => [ article: ?article ]
}
where {
  // Returns ALL comments where target = ?article
  // If there are 5 comments, then-clause runs 5 times
  Comment: { ?comment target: ?article }
}
then {
  Comment/delete: [ comment: ?comment ]
}
```

If the article has 3 comments (comment-1, comment-2, comment-3), the engine produces 3 invocations:
- `Comment/delete: [ comment: "comment-1" ]`
- `Comment/delete: [ comment: "comment-2" ]`
- `Comment/delete: [ comment: "comment-3" ]`

## Then-Clause Variable Usage

All variables in `then` must be bound. The compiler validates this:

```
then {
  Article/create: [
    article: ?article;      // Must be bound in when or where
    title: ?title;           // Must be bound in when or where
    author: ?author ]        // Must be bound in when or where
}
```

If you reference `?unknown` in `then` without binding it anywhere, the compiler reports an error:

```
ERROR: Variable ?unknown in then-clause is not bound in when or where
```

## Variable Naming Conventions

| Convention | Use for | Example |
|-----------|---------|---------|
| `?user` | Entity identifier | `User/register: [] => [ user: ?user ]` |
| `?request` | Web request reference | `Web/request: [] => [ request: ?request ]` |
| `?token` | Auth token | `JWT/generate: [] => [ token: ?token ]` |
| `?email`, `?username` | User input fields | `Web/request: [ email: ?email ]` |
| `?article`, `?comment` | Domain entity IDs | `Article/create: [] => [ article: ?article ]` |
| `?error`, `?message` | Error text | `User/register: [] => [ message: ?error ]` |
| `?u`, `?a`, `?c` | Short aliases for query keys | `User: { ?u name: ?name }` |

**Naming rules:**
- Use descriptive names that reflect the domain meaning
- Short names (`?u`, `?a`) are fine for query record keys that aren't used elsewhere
- Variable names are case-sensitive: `?user` ≠ `?User`
- Prefix is always `?` — `?camelCase` is the convention

## Common Patterns

### Pass-through binding

Extract from one completion, pass to another:

```
when {
  JWT/verify: [] => [ user: ?user ]
}
then {
  Article/create: [ author: ?user ]
}
```

### Generate-and-use

Create a new ID in `where`, use it in `then`:

```
where {
  bind(uuid() as ?article)
}
then {
  Article/create: [ article: ?article ]
}
```

### Query-and-respond

Query state in `where`, send results in `then`:

```
where {
  User: { ?u email: ?email; name: ?username }
}
then {
  Web/respond: [ body: [ user: [ username: ?username; email: ?email ] ] ]
}
```

### Consistency join

Same variable across patterns ensures data integrity:

```
when {
  User/register: [] => [ user: ?user ]
  Password/set: [] => [ user: ?user ]
  JWT/generate: [] => [ token: ?token ]
}
```
