# Sync Pattern Templates

Copy-paste templates for common sync patterns. Each template shows the sync rules needed for a complete flow. Replace `CONCEPT`, `ACTION`, `METHOD`, and field names with your actual values.

## Template 1: Authenticated CRUD (3 rules per operation)

The most common pattern — an authenticated user performs a CRUD action on a concept.

### Create

```
sync CreateCONCEPTAuth [eager]
when {
  Web/request: [ method: "create_METHOD"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}

sync PerformCreateCONCEPT [eager]
when {
  Web/request: [
    method: "create_METHOD";
    fieldA: ?a;
    fieldB: ?b ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
where {
  bind(uuid() as ?id)
}
then {
  CONCEPT/create: [
    id: ?id;
    fieldA: ?a;
    fieldB: ?b;
    author: ?user ]
}

sync CreateCONCEPTResponse [eager]
when {
  Web/request: [ method: "create_METHOD" ]
    => [ request: ?request ]
  CONCEPT/create: []
    => [ id: ?id ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ created: ?id ] ]
}
```

### Update

```
sync UpdateCONCEPTAuth [eager]
when {
  Web/request: [ method: "update_METHOD"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}

sync PerformUpdateCONCEPT [eager]
when {
  Web/request: [
    method: "update_METHOD";
    id: ?id;
    fieldA: ?a;
    fieldB: ?b ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
then {
  CONCEPT/update: [
    id: ?id;
    fieldA: ?a;
    fieldB: ?b ]
}

sync UpdateCONCEPTResponse [eager]
when {
  Web/request: [ method: "update_METHOD" ]
    => [ request: ?request ]
  CONCEPT/update: []
    => [ id: ?id ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ updated: ?id ] ]
}
```

### Delete

```
sync DeleteCONCEPTAuth [eager]
when {
  Web/request: [ method: "delete_METHOD"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}

sync PerformDeleteCONCEPT [eager]
when {
  Web/request: [ method: "delete_METHOD"; id: ?id ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
then {
  CONCEPT/delete: [ id: ?id ]
}

sync DeleteCONCEPTResponse [eager]
when {
  Web/request: [ method: "delete_METHOD" ]
    => [ request: ?request ]
  CONCEPT/delete: []
    => [ id: ?id ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ deleted: ?id ] ]
}
```

## Template 2: Authenticated Toggle (3 rules per direction)

For boolean operations like follow/unfollow, favorite/unfavorite.

### Toggle On

```
sync ACTIONAuth [eager]
when {
  Web/request: [ method: "ACTION"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}

sync PerformACTION [eager]
when {
  Web/request: [ method: "ACTION"; target: ?target ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
then {
  CONCEPT/ACTION: [ user: ?user; target: ?target ]
}

sync ACTIONResponse [eager]
when {
  Web/request: [ method: "ACTION" ]
    => [ request: ?request ]
  CONCEPT/ACTION: []
    => [ user: ?user ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ active: true ] ]
}
```

### Toggle Off

```
sync UnACTIONAuth [eager]
when {
  Web/request: [ method: "unACTION"; token: ?token ]
    => [ request: ?request ]
}
then {
  JWT/verify: [ token: ?token ]
}

sync PerformUnACTION [eager]
when {
  Web/request: [ method: "unACTION"; target: ?target ]
    => []
  JWT/verify: []
    => [ user: ?user ]
}
then {
  CONCEPT/unACTION: [ user: ?user; target: ?target ]
}

sync UnACTIONResponse [eager]
when {
  Web/request: [ method: "unACTION" ]
    => [ request: ?request ]
  CONCEPT/unACTION: []
    => [ user: ?user ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ active: false ] ]
}
```

## Template 3: Registration Flow (7 rules)

Full registration with validation, user creation, password storage, and token generation.

```
// Step 1: Validate password strength
sync ValidatePassword [eager]
when {
  Web/request: [ method: "register"; password: ?password ]
    => [ request: ?request ]
}
then {
  Password/validate: [ password: ?password ]
}

// Step 2a: Validation failure → error response
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

// Step 2b: Validation success → create user
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

// Step 3: Store password after user is created
sync SetPassword [eager]
when {
  Web/request: [ method: "register"; password: ?password ]
    => []
  User/register: []
    => [ user: ?user ]
}
then {
  Password/set: [ user: ?user; password: ?password ]
}

// Step 4: Generate session token after user is created
sync GenerateToken [eager]
when {
  User/register: []
    => [ user: ?user ]
}
then {
  JWT/generate: [ user: ?user ]
}

// Step 5a: All steps complete → success response
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

// Step 5b: Registration failure → error response
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

## Template 4: Login Flow (4 rules)

Credential check followed by token generation.

```
// Step 1: Look up user by email, check password
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

// Step 2a: Valid credentials → generate token
sync LoginSuccess [eager]
when {
  Web/request: [ method: "login" ]
    => []
  Password/check: [ user: ?user ]
    => [ valid: true ]
}
then {
  JWT/generate: [ user: ?user ]
}

// Step 2b: Success → respond with user data and token
sync LoginResponse [eager]
when {
  Web/request: [ method: "login"; email: ?email ]
    => [ request: ?request ]
  JWT/generate: [ user: ?user ]
    => [ token: ?token ]
}
where {
  User: { ?u email: ?email; name: ?username }
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

// Step 2c: Invalid credentials → error
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

## Template 5: Cascade Delete (1 rule per parent-child pair)

When deleting a parent entity, automatically delete all children that reference it.

```
sync CascadeDeleteCHILD [eager]
when {
  PARENT/delete: [ parent: ?parent ]
    => [ parent: ?parent ]
}
where {
  CHILD: { ?child parentRef: ?parent }
}
then {
  CHILD/delete: [ child: ?child ]
}
```

**Multi-level cascades**: If deleting a parent triggers deleting children, and children have their own dependents, create separate cascade rules for each level. The sync engine handles the chain.

```
// Level 1: Article delete → Comment delete
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

// Level 2: Comment delete → Reaction delete (if reactions exist)
sync CascadeDeleteReactions [eager]
when {
  Comment/delete: [ comment: ?comment ]
    => [ comment: ?comment ]
}
where {
  Reaction: { ?reaction target: ?comment }
}
then {
  Reaction/delete: [ reaction: ?reaction ]
}
```

## Template 6: Unauthenticated Action (2 rules)

For public endpoints that don't require JWT verification.

```
sync HandleACTION [eager]
when {
  Web/request: [ method: "ACTION"; input: ?input ]
    => [ request: ?request ]
}
where {
  bind(uuid() as ?id)
}
then {
  CONCEPT/ACTION: [ id: ?id; input: ?input ]
}

sync ACTIONResponse [eager]
when {
  Web/request: [ method: "ACTION" ]
    => [ request: ?request ]
  CONCEPT/ACTION: []
    => [ output: ?output ]
}
then {
  Web/respond: [
    request: ?request;
    body: [ result: ?output ] ]
}
```

## Template 7: Side-Effect Sync (1 rule)

When an action on one concept should trigger an action on a different concept (not a cascade delete, but a side effect).

```
// When a user registers, create a default profile
sync CreateDefaultProfile [eager]
when {
  User/register: []
    => [ user: ?user ]
}
then {
  Profile/update: [ user: ?user; bio: ""; image: "" ]
}

// When an article is created, log it
sync LogArticleCreation [eager]
when {
  Article/create: [ article: ?article; author: ?author ]
    => [ article: ?article ]
}
where {
  bind(now() as ?timestamp)
}
then {
  AuditLog/log: [ actor: ?author; action: "create_article"; target: ?article; timestamp: ?timestamp ]
}
```

## Choosing the Right Template

| User Flow | Template | Expected Rules |
|-----------|----------|---------------|
| Create/Update/Delete entity (auth) | Template 1 | 3 per operation |
| Follow/unfollow, like/unlike (auth) | Template 2 | 3 per direction (6 total) |
| User registration | Template 3 | 7 |
| User login | Template 4 | 4 |
| Parent entity deletion | Template 5 | 1 per child type |
| Public/diagnostic endpoint | Template 6 | 2 |
| Cross-concept side effect | Template 7 | 1 per effect |

## Estimating Sync Count

For a new feature decomposition, estimate total sync rules:

```
Total ≈ (authenticated_crud_ops × 3)
      + (toggle_pairs × 6)
      + (has_registration ? 7 : 0)
      + (has_login ? 4 : 0)
      + (cascade_relationships × 1)
      + (unauthenticated_endpoints × 2)
      + (side_effects × 1)
```

**Social blogging example**: 6 CRUD ops (article×3 + comment×2 + profile×1) × 3 = 18, plus 2 toggle pairs × 6 = 12, plus registration (7) + login (4) + 1 cascade + 1 echo × 2 = 44. Actual count: ~38 (some operations share auth patterns).
