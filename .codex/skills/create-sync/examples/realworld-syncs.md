# Worked Example: RealWorld App Syncs

All sync patterns from the RealWorld (Conduit) implementation — a production-grade blogging platform with authentication, articles, comments, and social features. This is the reference implementation that validates the sync language.

## Architecture Overview

The RealWorld app uses these concepts: **Web**, **JWT**, **User**, **Password**, **Profile**, **Article**, **Comment**, **Follow**, **Favorite**

Syncs are organized by feature in separate files:
- `registration.sync` — User registration flow (7 syncs)
- `login.sync` — Login flow (4 syncs)
- `articles.sync` — Article CRUD + cascade (10 syncs)
- `comments.sync` — Comment CRUD (6 syncs)
- `social.sync` — Follow/unfollow, favorite/unfavorite (12 syncs)
- `profile.sync` — Profile updates (3 syncs)

## Pattern 1: Auth Gate

The first sync in any authenticated flow — extracts the token from the request and verifies it. The JWT/verify completion then triggers the next sync in the chain.

```
sync CreateArticleAuth [eager]
when {
  Web/request: [ method: "create_article"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}
```

**Why this is a separate sync**: Separating auth from the action means:
- Auth logic is consistent across all endpoints
- The auth sync is testable in isolation
- Changing auth (e.g., switching from JWT to API keys) only changes one sync per endpoint

**Variations across the app:**

```
// Same pattern, different method names
sync UpdateArticleAuth [eager]
when { Web/request: [ method: "update_article"; token: ?token ] => [ request: ?request ] }
then { JWT/verify: [ token: ?token ] }

sync DeleteArticleAuth [eager]
when { Web/request: [ method: "delete_article"; token: ?token ] => [ request: ?request ] }
then { JWT/verify: [ token: ?token ] }

sync FollowAuth [eager]
when { Web/request: [ method: "follow"; token: ?token ] => [ request: ?request ] }
then { JWT/verify: [ token: ?token ] }
```

## Pattern 2: Perform Action (After Auth)

Waits for both the original request AND the auth completion, then performs the domain action. Uses `bind(uuid())` to generate new entity IDs.

```
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
```

**Key points:**
- Two patterns in `when` = both must match in the same flow
- `?author` comes from JWT/verify's output (the authenticated user)
- `?title`, `?desc`, `?body` come from the Web/request's input
- `bind(uuid() as ?article)` generates a fresh ID for the new article
- All variables flow into `Article/create`

**Variation without new ID (update):**

```
sync PerformUpdateArticle [eager]
when {
  Web/request: [
    method: "update_article";
    article: ?article;
    title: ?title;
    description: ?desc;
    body: ?body ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
then {
  Article/update: [
    article: ?article;
    title: ?title;
    description: ?desc;
    body: ?body ]
}
```

No `where` clause needed — the article ID comes from the request, not from `uuid()`.

## Pattern 3: Success Response

Waits for the action completion, optionally queries for display data, and sends the response.

```
sync CreateArticleResponse [eager]
when {
  Web/request: [ method: "create_article" ]
    => [ request: ?request ]
  Article/create: []
    => [ article: ?article ]
}
where {
  Article: { ?a slug: ?slug; title: ?title; author: ?author }
}
then {
  Web/respond: [
    request: ?request;
    body: [
      article: [
        slug: ?slug;
        title: ?title;
        author: ?author ] ] ]
}
```

**Key points:**
- `Article/create` completion provides `?article` (the new article ID)
- `where` queries the Article concept for display fields (`slug`, `title`, `author`)
- Response body uses nested bracket syntax for JSON structure
- `?request` threads through to `Web/respond` to match the HTTP response to the right request

**Simpler response (no query needed):**

```
sync UpdateArticleResponse [eager]
when {
  Web/request: [ method: "update_article" ]
    => [ request: ?request ]
  Article/update: []
    => [ article: ?article ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ updated: ?article ] ]
}
```

## Pattern 4: Error Response

Matches on the **error variant** of a completion to send an error response.

```
sync LoginFailure [eager]
when {
  Web/request: [ method: "login" ]
    => [ request: ?request ]
  Password/check: []
    => [ valid: false ]
}
then {
  Web/respond: [
    request: ?request;
    error: "Invalid credentials";
    code: 401 ]
}
```

**Key points:**
- `valid: false` is a boolean literal match — this sync fires ONLY on failure
- A separate sync (`LoginSuccess`) matches `valid: true`
- The error sync and success sync are independent — the engine fires whichever matches

**Error with dynamic message:**

```
sync RegistrationError [eager]
when {
  Web/request: [ method: "register" ]
    => [ request: ?request ]
  User/register: []
    => [ message: ?error ]
}
then {
  Web/respond: [
    request: ?request;
    error: ?error;
    code: 422 ]
}
```

Here `?error` comes from the concept's error completion variant (e.g., "Username already taken").

## Pattern 5: Validation Gate

Validates input before proceeding. The validation result (true/false) triggers different downstream syncs.

```
sync ValidatePassword [eager]
when {
  Web/request: [ method: "register"; password: ?password ]
    => [ request: ?request ]
}
then {
  Password/validate: [ password: ?password ]
}

sync ValidatePasswordError [eager]
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

sync RegisterUser [eager]
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
```

**Key points:**
- `ValidatePassword` fires first, producing a `Password/validate` completion
- If `valid: false`, `ValidatePasswordError` fires and sends error response
- If `valid: true`, `RegisterUser` fires and proceeds with registration
- Boolean branching via literal matching — no if/else in the sync language

## Pattern 6: Cascade Delete

When a parent entity is deleted, delete all children. Uses `where` query for multi-row expansion.

```
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
```

**Key points:**
- `?article` appears in both input AND output of `Article/delete` — matches the specific article being deleted
- `where` query returns ALL comments targeting this article
- `then` executes once per comment (multi-row expansion)
- Each `Comment/delete` invocation produces its own completion, which could trigger further cascades

## Pattern 7: Side Effect Chain

An action completion triggers a secondary action with no additional logic needed.

```
sync GenerateToken [eager]
when {
  User/register: []
    => [ user: ?user ]
}
then {
  JWT/generate: [ user: ?user ]
}
```

**Key points:**
- Minimal sync — just one pattern, one action, no where clause
- Fires whenever any `User/register` completes successfully
- The `JWT/generate` completion then triggers `RegistrationResponse`

## Pattern 8: Multi-Condition Response

Waits for **many** completions before responding. This is the "join" pattern.

```
sync RegistrationResponse [eager]
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
  User: { ?u name: ?username; email: ?email }
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
```

**Key points:**
- Four patterns — all must complete in the same flow
- `?user` appears in both `User/register` and `Password/set` outputs — consistency enforced
- Only fires when registration, password set, AND token generation are all done
- `where` query fetches display data for the response

## Pattern 9: State Lookup for Action

Queries concept state to find an entity before acting on it.

```
sync LoginCheckPassword [eager]
when {
  Web/request: [ method: "login"; email: ?email; password: ?password ]
    => [ request: ?request ]
}
where {
  User: { ?user email: ?email }
}
then {
  Password/check: [ user: ?user; password: ?password ]
}
```

**Key points:**
- `?email` is bound from the request input
- `where` query uses `?email` as a filter to find the matching User record
- `?user` is bound from the query result (the User record key)
- Both `?user` and `?password` flow into `Password/check`

## Pattern 10: Pipeline Stage

One compilation/processing step triggers the next. No external trigger needed.

```
sync GenerateManifest [eager]
when {
  SpecParser/parse: [] => [ spec: ?spec; ast: ?ast ]
}
then {
  SchemaGen/generate: [ spec: ?spec; ast: ?ast ]
}

sync GenerateTypeScript [eager]
when {
  SchemaGen/generate: [ spec: ?spec ] => [ manifest: ?manifest ]
}
then {
  TypeScriptGen/generate: [ spec: ?spec; manifest: ?manifest ]
}

sync GenerateRust [eager]
when {
  SchemaGen/generate: [ spec: ?spec ] => [ manifest: ?manifest ]
}
then {
  RustGen/generate: [ spec: ?spec; manifest: ?manifest ]
}
```

**Key points:**
- Linear pipeline: SpecParser → SchemaGen → TypeScriptGen / RustGen
- SchemaGen's completion triggers BOTH TypeScriptGen and RustGen (fan-out)
- Adding a new language target = one new concept + one new sync (no changes to existing code)

## Complete Flow: Registration

Here's how the registration syncs chain together:

```
1. Web/request(register, username, email, password) arrives
   ├─ ValidatePassword fires → Password/validate
   │
2. Password/validate completes
   ├─ [valid: false] → ValidatePasswordError → Web/respond(error)
   ├─ [valid: true]  → RegisterUser → User/register
   │
3. User/register completes
   ├─ [→ user] → SetPassword → Password/set
   ├─ [→ user] → GenerateToken → JWT/generate
   ├─ [→ message] → RegistrationError → Web/respond(error)
   │
4. Password/set completes
5. JWT/generate completes
   │
6. All four completions present in flow → RegistrationResponse fires
   └─ Queries User for display data → Web/respond(user)
```

Seven syncs, each independently testable, composing through completions into a complete registration flow.
