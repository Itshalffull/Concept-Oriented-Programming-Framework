# Worked Example: Social Blogging Platform

A complete decomposition of a "social blogging platform" (similar to Medium or RealWorld) into independent Clef concepts with synchronizations. This is the actual decomposition used by the Clef codebase.

## Feature Description

> Build a social blogging platform where users can register, log in, write articles, comment on articles, follow other users, favorite articles, tag articles, and manage their profiles.

## Step 1: List the Purposes

Starting from the feature description, extract every distinct purpose:

| # | Feature Text | Purpose (verb phrase) |
|---|-------------|----------------------|
| 1 | "users can register" | Associate identifying information with users |
| 2 | "register" (password) | Securely store and validate user credentials |
| 3 | "log in" | Generate and verify session tokens |
| 4 | "write articles" | Manage articles with content and metadata |
| 5 | "comment on articles" | Manage comments attached to content |
| 6 | "follow other users" | Track follower relationships between users |
| 7 | "favorite articles" | Track which articles users have favorited |
| 8 | "tag articles" | Manage tags and their association with articles |
| 9 | "manage their profiles" | Store user profile information (bio, image) |

**Key decision**: "register" involves two distinct purposes — creating user identity (#1) and storing credentials (#2). These are separated because credential management (hashing, validation, strength checking) is independent of identity management (names, emails, uniqueness).

**Key decision**: "log in" maps to token management (#3), not to credential checking. Credential checking is Password's job; JWT handles the session that results from a successful check. The sync layer connects them.

## Step 2: Name the Concepts

| Purpose | Concept Name | Rationale |
|---------|-------------|-----------|
| Associate identifying information with users | **User** | Standard identity concept |
| Securely store and validate credentials | **Password** | From Jackson's catalog — credential management |
| Generate and verify session tokens | **JWT** | Specific token technology, clear purpose |
| Manage articles with content and metadata | **Article** | Domain entity, one word |
| Manage comments attached to content | **Comment** | Domain entity, one word |
| Track follower relationships | **Follow** | Verb-as-noun, standard social pattern |
| Track article favorites | **Favorite** | Verb-as-noun, standard social pattern |
| Manage tags and associations | **Tag** | Domain entity, one word |
| Store user profile information | **Profile** | Separate from User for independence |

**Why Profile is separate from User**: Profile data (bio, image) serves a different purpose than identity data (name, email). Profile can evolve independently — adding fields like "website", "location", etc. doesn't affect authentication. In a different app, you might have User without Profile, or Profile without User (anonymous profiles).

## Step 3: Concept Map

```
CONCEPT MAP for "Social Blogging Platform"

User [U]         — Associate identifying information with users (entity)
                   State: users: set U, name: U -> String, email: U -> String
                   Actions: register

Password [U]     — Securely store and validate credentials (relation on U)
                   State: hash: U -> Bytes, salt: U -> Bytes
                   Capabilities: requires crypto
                   Actions: set, check, validate

JWT [U]          — Generate and verify session tokens (relation on U)
                   State: tokens: U -> String
                   Actions: generate, verify

Article [A]      — Manage articles with content and metadata (entity)
                   State: articles: set A, slug/title/description/body/author: A -> String,
                          createdAt/updatedAt: A -> DateTime
                   Actions: create, update, delete, get

Comment [C]      — Manage comments on articles (entity)
                   State: comments: set C, body/target/author: C -> String,
                          createdAt: C -> DateTime
                   Actions: create, delete, list

Tag [T]          — Manage tags and article associations (entity)
                   State: tags: set T, articles: T -> set String
                   Actions: add, remove, list

Follow [U]       — Track follower relationships (relation on U)
                   State: following: U -> set String
                   Actions: follow, unfollow, isFollowing

Favorite [U]     — Track article favorites per user (relation on U)
                   State: favorites: U -> set String
                   Actions: favorite, unfavorite, isFavorited, count

Profile [U]      — Store user profile info (relation on U)
                   State: bio: U -> String, image: U -> String
                   Actions: update, get

+ Echo [M]       — Diagnostic echo endpoint (entity)
                   State: messages: set M, text: M -> String
                   Actions: send
```

## Step 4: Validate Independence

**User**: References no other concepts. Name and email are stored directly. ✓
**Password**: Type parameter U is opaque — doesn't know it's a "User". ✓
**JWT**: Type parameter U is opaque. Doesn't reference Password. ✓
**Article**: Author is `String`, not User type. ✓
**Comment**: Target is `String`, not Article type. Author is `String`, not User type. ✓
**Tag**: Articles are `set String`, not set Article. ✓
**Follow**: Target is `String`, not User type. ✓
**Favorite**: Article is `String`, not Article type. ✓
**Profile**: Type parameter U is opaque. Bio/image are pure Profile state. ✓

**The acid test**: Each concept can be implemented without reading any other concept's code. The only shared interface is the action signatures.

## Step 5: Sync Flows

### Flow 1: Registration (7 sync rules)

```
Web/request("register") → Password/validate → [success?]
  → User/register → Password/set → JWT/generate → Web/respond
  → [validation failure] → Web/respond(422)
  → [registration failure] → Web/respond(422)
```

**Sync rules:**
1. `ValidatePassword` — Web → Password/validate
2. `ValidatePasswordError` — Password/validate(invalid) → Web/respond(422)
3. `RegisterUser` — Password/validate(valid) → User/register (generates UUID)
4. `SetPassword` — User/register(ok) → Password/set
5. `GenerateToken` — User/register(ok) → JWT/generate
6. `RegistrationResponse` — All three complete → Web/respond (username, email, token)
7. `RegistrationError` — User/register(error) → Web/respond(422)

**Data flow**: UUID generated in `where` clause of RegisterUser, flows through all subsequent syncs as `?user`.

### Flow 2: Login (4 sync rules)

```
Web/request("login") → Password/check → [valid?]
  → JWT/generate → Web/respond
  → [invalid] → Web/respond(401)
```

**Sync rules:**
1. `LoginCheckPassword` — Web → Password/check (looks up user by email via `where`)
2. `LoginSuccess` — Password/check(valid: true) → JWT/generate
3. `LoginResponse` — JWT/generate → Web/respond (username, email, token)
4. `LoginFailure` — Password/check(valid: false) → Web/respond(401)

### Flow 3: Articles (10 sync rules + 1 cascade)

Each CRUD operation follows the Auth Gate → Perform → Response pattern:

**Create** (3 rules): `CreateArticleAuth`, `PerformCreateArticle`, `CreateArticleResponse`
**Update** (3 rules): `UpdateArticleAuth`, `PerformUpdateArticle`, `UpdateArticleResponse`
**Delete** (3 rules + cascade): `DeleteArticleAuth`, `PerformDeleteArticle`, `DeleteArticleResponse`, `CascadeDeleteComments`

The cascade rule is critical:
```
sync CascadeDeleteComments [eager]
when {
  Article/delete: [ article: ?article ] => [ article: ?article ]
}
where {
  Comment: { ?comment target: ?article }
}
then {
  Comment/delete: [ comment: ?comment ]
}
```

This fires for every comment whose `target` matches the deleted article.

### Flow 4: Comments (6 sync rules)

**Create** (3 rules): `CreateCommentAuth`, `PerformCreateComment`, `CreateCommentResponse`
**Delete** (3 rules): `DeleteCommentAuth`, `PerformDeleteComment`, `DeleteCommentResponse`

### Flow 5: Social (12 sync rules)

Four operations, each with Auth → Perform → Response:

**Follow** (3 rules): `FollowAuth`, `PerformFollow`, `FollowResponse`
**Unfollow** (3 rules): `UnfollowAuth`, `PerformUnfollow`, `UnfollowResponse`
**Favorite** (3 rules): `FavoriteAuth`, `PerformFavorite`, `FavoriteResponse`
**Unfavorite** (3 rules): `UnfavoriteAuth`, `PerformUnfavorite`, `UnfavoriteResponse`

### Flow 6: Profile (3 sync rules)

**Update** (3 rules): `UpdateProfileAuth`, `PerformUpdateProfile`, `UpdateProfileResponse`

### Flow 7: Echo (2 sync rules)

**Echo** (2 rules): `HandleEcho` (unauthenticated, generates UUID), `EchoResponse`

## Summary Statistics

| Metric | Count |
|--------|-------|
| Concepts | 10 (9 app + 1 diagnostic) |
| Sync files | 7 |
| Total sync rules | ~38 |
| Entity concepts | 5 (User, Article, Comment, Tag, Echo) |
| Relation concepts | 5 (Password, JWT, Follow, Favorite, Profile) |
| Authenticated flows | 5 (articles, comments, follow, unfavorite, profile) |
| Unauthenticated flows | 3 (login, registration, echo) |
| Cascade rules | 1 (article delete → comment delete) |

## Design Decisions Explained

**Why not a single "Auth" concept?**
Password (credential storage) and JWT (session tokens) serve different purposes. You could replace Password with OAuth without changing JWT. You could replace JWT with session cookies without changing Password. Independence enables substitution.

**Why is author stored as String in Article/Comment?**
If Article stored `author: A -> User`, it would depend on the User concept. Using `String` (an opaque reference) keeps Article independent. The sync layer resolves the reference when needed (e.g., fetching the author's name for display).

**Why is Profile separate from User?**
User handles registration and identity uniqueness. Profile handles display information. Adding "website" to Profile requires zero changes to User, Password, or JWT. Different apps might use User without Profile (API-only service) or Profile without User (anonymous profiles).

**Why isn't "feed" a concept?**
A user's feed (articles from followed users) is a *query* that spans Follow and Article, not a concept with its own state. It belongs in the sync/query layer, not as an independent concept. If feed caching were needed, *that* would be its own concept (FeedCache).

**Why Follow and Favorite are separate despite identical structure?**
They serve different user purposes. Follow affects what you see (feed). Favorite affects what you've saved. They could be different in a future version (e.g., favorites might gain folders, follows might gain notifications). Jackson's singularity principle: same structure, different purpose = different concepts.
