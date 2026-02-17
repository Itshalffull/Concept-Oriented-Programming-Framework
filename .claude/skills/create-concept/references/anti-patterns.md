# Concept Design Anti-Patterns

Common mistakes when designing concepts, with fixes based on Daniel Jackson's methodology.

## 1. Overloading (Singularity Violation)

**Problem**: The concept serves more than one purpose.

**Symptom**: The purpose statement uses "and" to connect two distinct goals.

**Example**:
```
concept UserAuth [U] {
  purpose {
    Manage user registration AND authenticate users with passwords.
  }
  state {
    users: set U
    name: U -> String
    email: U -> String
    hash: U -> Bytes
    salt: U -> Bytes
  }
}
```

This concept manages user identity (registration) AND authentication (passwords) — two distinct purposes.

**Fix**: Split into two independent concepts:
- `User [U]` — "Associate identifying information with users"
- `Password [U]` — "Securely store and validate user credentials"

**How Jackson describes it**: "Each concept has exactly one purpose. If you find the concept doing two things, it should be two concepts." Zoom's Mute concept was his classic example — it served both privacy (turning off your own mic) and moderation (controlling who can speak).

## 2. Over-Scoping

**Problem**: The concept includes state or actions that serve a different purpose.

**Symptom**: Some state fields are only used by a subset of actions that could stand alone.

**Example**:
```
concept Article [A] {
  state {
    articles: set A
    title: A -> String
    body: A -> String
    favoriteCount: A -> Int        // This belongs in a Favorite concept
    comments: A -> list String     // This belongs in a Comment concept
  }
}
```

**Fix**: Apply Jackson's "lifting" design move — extract `favoriteCount` into a Favorite concept and `comments` into a Comment concept. Let synchronization handle the coordination.

**Principle**: A concept should only contain state that is *directly necessary* for its own purpose. References to external concepts are handled through opaque IDs (type parameters) and syncs.

## 3. Coupling (Independence Violation)

**Problem**: The concept references another concept's specific types.

**Symptom**: State or actions use concrete types like `Article`, `User`, `Comment` instead of type parameters.

**Example**:
```
concept Favorite [U] {
  state {
    favorites: U -> set Article     // BAD: references Article type directly
  }
  actions {
    action favorite(user: User, article: Article) {   // BAD: concrete types
      -> ok(user: User, article: Article) { ... }
    }
  }
}
```

**Fix**: Use opaque `String` references (or a type parameter if the concept is truly generic over the favorited entity type):
```
concept Favorite [U] {
  state {
    favorites: U -> set String      // Opaque article IDs
  }
  actions {
    action favorite(user: U, article: String) {
      -> ok(user: U, article: String) { ... }
    }
  }
}
```

**Principle**: Concepts are polymorphic. They work with opaque IDs that happen to refer to other concepts' entities at composition time.

## 4. Missing Purpose

**Problem**: The concept exists but cannot articulate a clear, single purpose.

**Symptom**: The purpose is vague ("Handle stuff related to X") or purely mechanical ("Store X data in the database").

**Example**:
```
concept DataStore [D] {
  purpose {
    Store and retrieve data.
  }
}
```

**Fix**: Ask: "What *value* does this concept deliver to the user?" If the answer is just "it stores things," it's not a concept — it's infrastructure. A concept must have a user-facing purpose.

**Good purposes**: "Securely store and validate user credentials using salted hashing" (Password), "Track follower relationships between users" (Follow), "Associate identifying information with users" (User).

## 5. Action-State Mismatch

**Problem**: State fields exist that no action reads or writes, or actions need data that isn't in state.

### 5a. Dead State (Necessity Violation)

**Symptom**: A state field is defined but never referenced in any action.

```
state {
  users: set U
  name: U -> String
  createdAt: U -> DateTime     // Never used in any action
  lastLoginIp: U -> String     // Never used in any action
}
```

**Fix**: Remove the unused fields. If you *might* need them later, add them when you actually do.

### 5b. Missing State (Sufficiency Violation)

**Symptom**: An action needs to check something that isn't in state.

```
state {
  users: set U
  name: U -> String
}
actions {
  action register(user: U, name: String, email: String) {
    -> ok(user: U) { ... }
    -> error(message: String) { If email is already taken. }   // But email isn't in state!
  }
}
```

**Fix**: Add `email: U -> String` to state if the action checks for email uniqueness.

## 6. Missing Invariants

**Problem**: A domain concept has no invariants, making its behavioral contract implicit.

**Symptom**: The concept defines state and actions but never specifies what should happen when they're used together.

**Fix**: Write at least one invariant that demonstrates the core operational principle. For a CRUD concept, show create-then-get. For authentication, show set-then-check. For relationships, show follow-then-verify.

**Exception**: Infrastructure concepts that are purely transformational (parse input, produce output) may legitimately have no invariants.

## 7. Variant Confusion

**Problem**: Return variants are misnamed or poorly scoped.

### 7a. Generic Error Variant

```
action get(article: A) {
  -> ok(article: A, title: String) { ... }
  -> error(message: String) { Something went wrong. }    // Too vague
}
```

**Fix**: Use specific variant names. If the entity might not exist, use `notfound`. If validation fails, use `invalid`.

### 7b. Too Many Variants

```
action create(article: A, title: String) {
  -> ok(article: A) { ... }
  -> titleTooLong(message: String) { ... }
  -> titleEmpty(message: String) { ... }
  -> titleContainsProfanity(message: String) { ... }
  -> bodyTooShort(message: String) { ... }
}
```

**Fix**: Group validation failures into a single `invalid` or `error` variant. The `message` field explains the specific issue.

### 7c. Missing Failure Variant

```
action get(article: A) {
  -> ok(article: A, title: String) { Returns the article data. }
  // Missing: what if the article doesn't exist?
}
```

**Fix**: Always consider what happens when the entity doesn't exist. Add `notfound` for lookups.

## 8. Wrong Concept Granularity

### 8a. Too Fine-Grained

```
concept ArticleTitle [A] { ... }
concept ArticleBody [A] { ... }
concept ArticleSlug [A] { ... }
```

**Fix**: These serve the same purpose (managing article content). Merge into one `Article` concept.

### 8b. Too Coarse-Grained

```
concept SocialNetwork [U] {
  // Manages users, friendships, posts, comments, likes, notifications...
}
```

**Fix**: Split into independent concepts: User, Follow, Post, Comment, Favorite, Notification. Each with one purpose.

## 9. Synchronization in the Concept

**Problem**: The concept tries to coordinate with other concepts internally.

**Symptom**: Action descriptions reference other concepts or their actions.

```
actions {
  action register(user: U, name: String) {
    -> ok(user: U) {
      Register the user AND create a default profile AND
      send a welcome notification.
    }
  }
}
```

**Fix**: The concept only handles registration. Profile creation and notification sending are handled by synchronizations:

```
sync UserRegistration
when {
  User/register: [user: ?user, name: ?name] => []
}
then {
  Profile/create: [user: ?user, bio: ""]
  Notification/send: [user: ?user, message: "Welcome!"]
}
```

## Quick Anti-Pattern Checklist

| # | Anti-Pattern | Test |
|---|-------------|------|
| 1 | Overloading | Does the purpose have "AND" connecting two goals? |
| 2 | Over-scoping | Are some state fields only used by a subset of actions? |
| 3 | Coupling | Does the concept reference another concept's types? |
| 4 | Missing purpose | Is the purpose vague or purely mechanical? |
| 5a | Dead state | Is every state field read or written by some action? |
| 5b | Missing state | Does every action have the state it needs? |
| 6 | Missing invariants | Is there at least one invariant for domain concepts? |
| 7 | Variant issues | Are variants specific, not too many, not missing? |
| 8 | Wrong granularity | Too fine (merge) or too coarse (split)? |
| 9 | Internal sync | Does the concept try to coordinate with others? |
