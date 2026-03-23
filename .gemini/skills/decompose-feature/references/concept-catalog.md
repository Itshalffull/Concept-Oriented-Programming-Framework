# Concept Catalog

Reusable concept patterns organized by category. When decomposing a feature, check this catalog first — many purposes map directly to well-known concepts. Based on Daniel Jackson's concept catalog from *The Essence of Software* and the patterns implemented in the Clef codebase.

## Identity Concepts

### User
**Purpose**: Associate identifying information with user accounts.
**State**: `users: set U`, `name: U -> String`, `email: U -> String`
**Actions**: `register` (add user with uniqueness check)
**Pattern**: Entity concept — owns a set of entities with relations
**When to use**: Any system with user accounts
**Key insight**: User is *only* about identity (name, email). Authentication is a separate concept (Password). Profile details are a separate concept (Profile).

### Organization / Team
**Purpose**: Group users into named collections with roles.
**State**: `orgs: set O`, `name: O -> String`, `members: O -> set String`, `roles: O -> (String -> String)`
**Actions**: `create`, `addMember`, `removeMember`, `setRole`
**When to use**: Multi-tenant or team-based applications
**Key insight**: Role management can be split into its own concept if roles have complex behavior (permissions, hierarchies).

## Authentication Concepts

### Password
**Purpose**: Securely store and validate user credentials.
**State**: `hash: U -> Bytes`, `salt: U -> Bytes`
**Capabilities**: `requires crypto`
**Actions**: `set` (hash and store), `check` (verify), `validate` (check strength without storing)
**When to use**: Any system with password-based auth
**Key insight**: Password does NOT generate sessions — that's JWT's job. The sync layer connects them.

### JWT (Session Token)
**Purpose**: Generate and verify session tokens for authenticated access.
**State**: `tokens: U -> String`
**Actions**: `generate` (create token for user), `verify` (decode token, return user)
**When to use**: Any system with token-based sessions (API keys, JWTs, session cookies)
**Key insight**: JWT is a relation concept — it decorates users with tokens. It doesn't know *why* a token was generated (login, registration, refresh).

### OAuth
**Purpose**: Authenticate users via external identity providers.
**State**: `providers: set P`, `tokens: (U, P) -> String`, `profiles: (U, P) -> Record`
**Actions**: `initiate` (start OAuth flow), `callback` (handle provider response), `refresh` (renew token)
**When to use**: "Login with Google/GitHub" flows
**Key insight**: OAuth replaces Password but still needs JWT for session management.

### MagicLink
**Purpose**: Authenticate users via emailed one-time links.
**State**: `links: String -> U`, `expiry: String -> DateTime`
**Actions**: `generate` (create link), `verify` (check link, return user), `expire` (invalidate)
**When to use**: Passwordless authentication
**Key insight**: Similar to JWT but for one-time use. The sync layer handles the email sending.

## Content Concepts

### Article / Post / Document
**Purpose**: Manage long-form content with metadata.
**State**: `items: set A`, `title: A -> String`, `body: A -> String`, `slug: A -> String`, `author: A -> String`, `createdAt: A -> DateTime`, `updatedAt: A -> DateTime`
**Actions**: `create`, `update`, `delete`, `get`
**When to use**: Any system with user-created content
**Key insight**: The author reference is an opaque String, not a User type — maintaining independence. Description, tags, and categories are separate concepts.

### Comment
**Purpose**: Manage comments attached to a target entity.
**State**: `comments: set C`, `body: C -> String`, `target: C -> String`, `author: C -> String`, `createdAt: C -> DateTime`
**Actions**: `create`, `delete`, `list` (by target)
**When to use**: Any system with discussions on content
**Key insight**: `target` is a String, not an Article type. The same Comment concept can be used for comments on articles, photos, or any entity.

### Message
**Purpose**: Exchange messages between users.
**State**: `messages: set M`, `body: M -> String`, `sender: M -> String`, `recipient: M -> String`, `sentAt: M -> DateTime`, `read: M -> Bool`
**Actions**: `send`, `markRead`, `list` (by recipient), `delete`
**When to use**: Chat, messaging, notifications

## Social Concepts

### Follow
**Purpose**: Track directional relationships between users.
**State**: `following: U -> set String`
**Actions**: `follow` (add to set), `unfollow` (remove from set), `isFollowing` (query)
**When to use**: Any system with follow/subscribe mechanics
**Key insight**: This is a pure set-relation concept. It doesn't know *why* users follow each other — the sync layer determines the effects of following.

### Favorite / Like / Bookmark
**Purpose**: Track user preferences on content items.
**State**: `favorites: U -> set String`
**Actions**: `favorite`, `unfavorite`, `isFavorited`, `count`
**When to use**: Any system with like/save/bookmark functionality
**Key insight**: Identical structure to Follow but different purpose. They should be separate concepts even though the state pattern is the same — they serve different user goals.

### Reaction
**Purpose**: Attach typed reactions (emoji, +1/-1) to content.
**State**: `reactions: (U, String) -> String` (user + target → reaction type)
**Actions**: `react`, `unreact`, `list` (by target), `count` (by target and type)
**When to use**: Emoji reactions, upvote/downvote
**Key insight**: If you only need binary like/unlike, use Favorite instead. Reaction adds a *type* dimension.

### Block
**Purpose**: Allow users to block other users from interaction.
**State**: `blocked: U -> set String`
**Actions**: `block`, `unblock`, `isBlocked`
**When to use**: Any system where users can restrict others
**Key insight**: Same state pattern as Follow but inverse semantics. Block *prevents* interaction; the sync layer enforces this.

## Taxonomy Concepts

### Tag / Label
**Purpose**: Manage tags and their association with entities.
**State**: `tags: set T`, `articles: T -> set String`
**Actions**: `add` (create tag if needed, associate with entity), `remove`, `list`
**When to use**: Any system with user-defined categorization
**Key insight**: Tags are entities (they have their own set) with a many-to-many relation to other entities. The relation target is String, not the entity type.

### Category
**Purpose**: Organize entities into a fixed hierarchy of categories.
**State**: `categories: set C`, `name: C -> String`, `parent: C -> option String`, `items: C -> set String`
**Actions**: `create`, `assign`, `unassign`, `list`, `tree`
**When to use**: When categorization is predefined (not user-created)
**Key insight**: If categories are user-created and flat, use Tag instead. Category adds hierarchy.

## Profile / Metadata Concepts

### Profile
**Purpose**: Store supplementary user information separate from identity.
**State**: `bio: U -> String`, `image: U -> String`
**Actions**: `update`, `get`
**When to use**: Any system where users have displayable profiles
**Key insight**: Profile is deliberately separated from User. User handles identity (register, uniqueness). Profile handles display (bio, avatar). They evolve independently.

### Settings / Preferences
**Purpose**: Store user configuration options.
**State**: `settings: U -> map String String`
**Actions**: `set` (key-value), `get` (key), `getAll`, `reset` (key)
**When to use**: Any system with user-customizable behavior
**Key insight**: Use a generic key-value map rather than typed fields. This keeps the concept reusable across apps.

## Infrastructure Concepts

### Echo / Ping
**Purpose**: Accept input and return it, for diagnostic/health-check purposes.
**State**: `messages: set M`, `text: M -> String`
**Actions**: `send` (store and echo back)
**When to use**: API health checks, connectivity testing
**Key insight**: The simplest possible concept — useful as a template and for verifying the framework pipeline.

### Notification
**Purpose**: Deliver notifications to users about events.
**State**: `notifications: set N`, `user: N -> String`, `type: N -> String`, `payload: N -> String`, `read: N -> Bool`, `createdAt: N -> DateTime`
**Actions**: `create`, `markRead`, `list` (by user), `delete`
**When to use**: Any system that notifies users of events
**Key insight**: Notification doesn't *decide* what to notify about — syncs trigger notifications based on other concept actions.

### Audit / ActivityLog
**Purpose**: Record a tamper-evident log of actions for compliance.
**State**: `entries: set E`, `actor: E -> String`, `action: E -> String`, `target: E -> String`, `timestamp: E -> DateTime`
**Actions**: `log`, `query` (by actor, action, or target)
**When to use**: Systems requiring audit trails
**Key insight**: This is append-only — no update or delete actions. Syncs trigger logging from other concept actions.

## Concept Selection Guide

When you identify a purpose, find the closest catalog entry:

| Purpose Pattern | Concept | Category |
|----------------|---------|----------|
| "Store user identity/accounts" | User | Identity |
| "Validate credentials" | Password | Auth |
| "Manage sessions/tokens" | JWT | Auth |
| "Login with external provider" | OAuth | Auth |
| "Create/read/update/delete content" | Article/Post/Document | Content |
| "Discuss/respond to content" | Comment | Content |
| "Direct messaging between users" | Message | Content |
| "Track who follows whom" | Follow | Social |
| "Bookmark/like content" | Favorite | Social |
| "React with emoji/types" | Reaction | Social |
| "Prevent interaction" | Block | Social |
| "Categorize with user labels" | Tag | Taxonomy |
| "Organize in hierarchy" | Category | Taxonomy |
| "Display user details" | Profile | Metadata |
| "User preferences" | Settings | Metadata |
| "Health check / diagnostics" | Echo | Infrastructure |
| "Notify users of events" | Notification | Infrastructure |
| "Audit trail" | AuditLog | Infrastructure |

## When No Catalog Entry Fits

If your purpose doesn't map to any existing concept:

1. **State the purpose** in one sentence starting with a verb
2. **Identify the state pattern**: Entity (owns a set), Relation (maps from an external type), or Hybrid
3. **List the minimum actions**: What operations must this concept support?
4. **Check independence**: Can it work without knowing about other concepts?
5. **Use the `create-concept` skill** to build it properly

The catalog is a starting point, not an exhaustive list. Novel applications may require novel concepts.
