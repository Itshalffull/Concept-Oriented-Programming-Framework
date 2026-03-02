---
name: derive-app
description: Build an entire application as a hierarchy of progressively composed derived concepts, culminating in a single root derivation that represents the complete app. This is the "hierarchical derivation architecture" pattern — an alternative to flat concept bags where every feature is a named, testable, analyzable composition.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<app-name or feature description>"
---

# Derive an App: Hierarchical Derivation Architecture

Build **$ARGUMENTS** as a hierarchy of derived concepts, progressively composing primitive concepts into named domain features, and composing those features into a single root derivation that represents the complete application.

## The Hierarchical Derivation Architecture

An entire Clef application can be expressed as a tree of derived concepts:

```
App (root derivation)
├── Feature A (derived)
│   ├── Concept X (primitive)
│   ├── Concept Y (primitive)
│   └── syncs: [x-y-flow]
├── Feature B (derived)
│   ├── derived Feature C (derived-of-derived)
│   │   ├── Concept Z (primitive)
│   │   └── Concept W (primitive)
│   ├── Concept V (primitive)
│   └── syncs: [c-v-integration]
└── syncs: [cross-feature-wiring]
```

This pattern provides:

1. **Named everything** — every feature, sub-feature, and the app itself has a name, purpose, and operational principle
2. **Hierarchical analysis** — Score can show impact at any zoom level ("what breaks if I change Concept Z?")
3. **Testable compositions** — each derived concept has a principle that generates integration tests
4. **Natural API groupings** — Bind generates REST resources / GraphQL namespaces / CLI subcommands from the hierarchy
5. **Scoped tracing** — FlowTrace shows runtime behavior grouped by derivation level, with clean boundaries

### When to Use This Pattern

Use hierarchical derivation when:
- Your app has 5+ primitive concepts that naturally cluster into features
- Users think in terms of features ("Trash", "Registration", "Search") not primitives ("Label", "Password", "Index")
- You want Score to provide feature-level impact analysis
- You want Bind to generate feature-grouped APIs automatically
- You want integration tests derived from operational principles at each level

### When NOT to Use This Pattern

Skip hierarchical derivation when:
- Your app is small (3-4 concepts) — a flat composition with syncs is fine
- The composition boundaries are unclear or artificial
- You're building a library/kit, not an app (use suites for organizational packaging)

## Step-by-Step Process

### Step 1: Decompose into Primitive Concepts

Start with `/decompose-feature` to break the app into independent primitive concepts:

```
Social Blogging Platform:
  User [U], Password [U], JWT [U], Profile [U],
  Article [A], Comment [C], Tag [T],
  Follow [U], Favorite [U], SearchIndex [S]
```

Each concept must pass the standard concept test: independent state, meaningful actions, operational principles.

### Step 2: Identify Feature Clusters

Group concepts that work together to serve a recognizable user-facing feature:

```
Registration:   User + Password + JWT + Profile
Publishing:     Article + Tag
Social:         Follow + Favorite
Comments:       Comment
Search:         SearchIndex
```

Each cluster should correspond to something a user would name: "the registration system", "the publishing feature", "the social features".

**Key test:** Does this cluster have a purpose that's more than "these concepts exist together"? If so, it's a derived concept. If not, it's just organizational grouping (use a suite).

### Step 3: Identify Syncs Per Feature

For each cluster, list which syncs are semantically *inside* the feature:

```
Registration:
  Inside:  registration-flow, login-flow, token-generation
  Outside: audit-log (serves all features), search-index-update

Publishing:
  Inside:  article-tag-association, article-slug-generation
  Outside: search-index-update, comment-cascade-delete
```

### Step 4: Build Leaf Derivations (Bottom-Up)

Start from the leaves of the hierarchy — features that compose only primitive concepts:

```
derived Registration [U] {
  purpose { Allow new users to create accounts with secure credentials. }
  composes { User [U], Password [U], JWT [U], Profile [U] }
  syncs { required: [registration-flow, login-flow, token-generation] }
  surface {
    action register(username: String, password: String, email: String) {
      matches: User/register
    }
    action login(username: String, password: String) {
      matches: Password/check
    }
    query currentUser(token: String) -> JWT/verify(token: token)
  }
  principle {
    after register(username: "alice", password: "s3cret", email: "a@b.com")
    then login(username: "alice", password: "s3cret") succeeds
  }
}
```

Create one `.derived` file per feature. Use `/create-derived-concept` for each.

### Step 5: Build Intermediate Derivations

If features naturally group into larger features, create intermediate derived concepts:

```
derived ContentManagement [T] {
  purpose { Create, organize, and discover content with rich metadata. }
  composes {
    derived Publishing [T]
    derived Comments [T]
    SearchIndex [T]
  }
  syncs { required: [content-search-indexing, comment-cascade-delete] }
  surface {
    action createArticle(title: String, body: String) {
      matches: derivedContext "Publishing/publish"
    }
    action search(query: String) -> SearchIndex/search(query: query)
  }
}
```

Note: intermediate derivations match on `derivedContext` tags from their child derivations, not on primitive concept actions. This creates the hierarchical boundary — if Publishing's internals change, ContentManagement's match still works.

### Step 6: Build the Root Derivation

The root derivation represents the complete application:

```
derived SocialBlog [T] {
  purpose {
    A social blogging platform where users can register, write articles,
    follow each other, and discover content through search.
  }

  composes {
    derived Registration [T]
    derived ContentManagement [T]
    derived Social [T]
  }

  syncs {
    required: [auth-gate-all-mutations, cross-feature-notifications]
  }

  surface {
    action register(username: String, password: String, email: String) {
      matches: derivedContext "Registration/register"
    }

    action publish(title: String, body: String) {
      matches: derivedContext "ContentManagement/createArticle"
    }

    action follow(target: T) {
      matches: derivedContext "Social/follow"
    }

    query feed(user: T) -> Social/getFeed(user: user)
    query search(query: String) -> ContentManagement/search(query: query)
  }

  principle {
    after register(username: "alice", password: "pass", email: "a@b.com")
    and  publish(title: "Hello", body: "World")
    then search(query: "Hello") returns the article
    and  follow(target: alice)
    then feed(user: bob) includes alice's articles
  }
}
```

### Step 7: Validate the Full Hierarchy

```bash
# Parse all .derived files
npx vitest run tests/derived-concepts.test.ts

# Verify DAG property (no cycles)
# Verify all composed concepts/derivations exist
# Verify surface patterns match real actions
# Verify type parameters unify correctly
```

### Step 8: Generate Interfaces from Hierarchy

The hierarchy maps directly to Bind's interface generation:

| Level | REST | GraphQL | CLI | MCP |
|-------|------|---------|-----|-----|
| Root derivation | API root | Schema root | Top-level command | Tool namespace |
| Feature derivation | Resource group | Namespace | Subcommand group | Tool group |
| Surface action | Endpoint (POST) | Mutation | Subcommand | Tool |
| Surface query | Endpoint (GET) | Query | Flag/option | Resource |

```yaml
# interface.yaml
derived:
  - SocialBlog      # Generates the full API from the hierarchy
```

## The Architecture in Score

Score renders the hierarchy as nested composite nodes:

```
SocialBlog
├── Registration
│   ├── User/register -> ok
│   ├── Password/set -> ok    (via registration-flow — inside Registration)
│   └── JWT/generate -> ok    (via token-generation — inside Registration)
├── ContentManagement
│   ├── Publishing
│   │   └── Article/create -> ok
│   ├── SearchIndex/update -> ok  (via content-search-indexing — inside ContentManagement)
│   └── Comment/create -> ok
├── Social
│   └── Follow/follow -> ok
AuditLog/record -> ok         (outside all derived concepts)
```

Each level provides:
- **Impact analysis:** "Changing User affects Registration which affects SocialBlog"
- **Scoped tracing:** Runtime traces show which feature a flow belongs to
- **Completeness checking:** Every primitive concept should appear somewhere in the tree

## Hierarchical Derivation Checklist

- [ ] Every primitive concept appears in at least one leaf derivation
- [ ] Every leaf derivation composes only primitive concepts
- [ ] Intermediate derivations match on `derivedContext` tags (not primitive actions)
- [ ] The root derivation represents the complete app
- [ ] Each derivation has a meaningful purpose (not just "groups X and Y")
- [ ] Each derivation has an operational principle
- [ ] Sync boundaries are precise — no over-claiming, no under-claiming
- [ ] The composition graph is a DAG (verified by `clef check`)
- [ ] Type parameters unify correctly across levels
- [ ] Cross-feature syncs (outside all derivations) are documented

## Worked Example: Tool for Thought

See [examples/tool-for-thought.md](examples/tool-for-thought.md) for a complete hierarchy:

```
ToolForThought
├── derived Registration
│   ├── User, Password, JWT, Profile
├── derived IncrementalBuild
│   ├── Resource, BuildCache, GenerationPlan, Emitter
├── ContentNode, Canvas, Reference, Backlink
├── Formula, DailyNote, SearchIndex
```

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/decompose-feature` | Start here — break the app into primitive concepts |
| `/create-concept` | Create each primitive concept |
| `/create-derived-concept` | Create each derived concept in the hierarchy |
| `/create-sync` | Write the sync rules claimed by each derivation |
| `/create-suite` | Bundle the hierarchy into a distributable suite |
