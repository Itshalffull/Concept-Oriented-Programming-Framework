# Domain Concept Examples

Real-world examples from the COPF codebase (`specs/app/`) with design rationale.

## Example 1: Password — Authentication Concept

**Design rationale**: Password is separate from User because authentication is a distinct purpose from identity management. A user can exist without a password (OAuth), and passwords can be changed without affecting user identity.

```
concept Password [U] {

  purpose {
    Securely store and validate user credentials using
    salted hashing. Does not handle reset flows — those
    are composed via synchronization with a token concept.
  }

  state {
    hash: U -> Bytes
    salt: U -> Bytes
  }

  capabilities {
    requires crypto
  }

  actions {
    action set(user: U, password: String) {
      -> ok(user: U) {
        Generate a random salt. Hash the password with the salt.
        Store both. Return the user reference.
      }
      -> invalid(message: String) {
        If the password does not meet strength requirements,
        return a description of the violation.
      }
    }

    action check(user: U, password: String) {
      -> ok(valid: Bool) {
        Retrieve the salt for the user. Hash the provided
        password with it. Return true if hashes match.
      }
      -> notfound(message: String) {
        If the user has no stored credentials, return an error.
      }
    }

    action validate(password: String) {
      -> ok(valid: Bool) {
        Check that the password meets strength requirements
        without storing anything.
      }
    }
  }

  invariant {
    after set(user: x, password: "secret") -> ok(user: x)
    then check(user: x, password: "secret") -> ok(valid: true)
    and  check(user: x, password: "wrong")  -> ok(valid: false)
  }
}
```

**Design notes**:
- **State pattern**: User-keyed relations (Pattern B) — no `set U` because the concept doesn't own users
- **State sufficiency**: `hash` and `salt` are both needed by `check` to verify passwords
- **State necessity**: No extra fields like `lastChanged` — no action needs it
- **Invariant**: Demonstrates the operational principle — "set a password, correct one works, wrong one doesn't"
- **Capabilities**: `requires crypto` because hashing is a runtime dependency
- **Independence**: References users only through type parameter `U` — no User concept dependency
- **Purpose boundary**: Explicitly states what it does NOT do (reset flows) — those are composed via syncs

## Example 2: Follow — Relationship Concept

**Design rationale**: Follow is a pure relationship tracker. It doesn't know what users are (that's the User concept) or what happens when you follow someone (notifications are composed via syncs).

```
concept Follow [U] {

  purpose {
    Track follower relationships between users.
  }

  state {
    following: U -> set String
  }

  actions {
    action follow(user: U, target: String) {
      -> ok(user: U, target: String) {
        Add target to user's following set.
      }
    }

    action unfollow(user: U, target: String) {
      -> ok(user: U, target: String) {
        Remove target from user's following set.
      }
    }

    action isFollowing(user: U, target: String) {
      -> ok(following: Bool) {
        Return true if user is following target.
      }
    }
  }

  invariant {
    after follow(user: u, target: "u2") -> ok(user: u, target: "u2")
    then isFollowing(user: u, target: "u2") -> ok(following: true)
    and  unfollow(user: u, target: "u2") -> ok(user: u, target: "u2")
  }
}
```

**Design notes**:
- **Minimal state**: Just one field — the set of followed targets per user
- **Target as String**: The followed entity is an opaque `String` ID, not a typed reference to User
- **Three actions form a complete API**: add, remove, check — covers all state access
- **Invariant**: Full cycle — follow, verify, unfollow — proving the operational principle
- **No error variants**: Following is idempotent and cannot fail (you can follow someone twice without error)
- **Relationship mutations return both sides**: `ok(user: U, target: String)` echoes both the actor and the target

## Example 3: User — Entity Management Concept

**Design rationale**: User manages identity — the association between a user ID and their identifying information. Authentication (Password), profile details (Profile), and social relationships (Follow) are separate concepts.

```
concept User [U] {

  purpose {
    Associate identifying information with users.
  }

  state {
    users: set U
    name: U -> String
    email: U -> String
  }

  actions {
    action register(user: U, name: String, email: String) {
      -> ok(user: U) {
        Add user to users set. Store name and email.
        Return user reference.
      }
      -> error(message: String) {
        If name or email is not unique, return error.
      }
    }
  }

  invariant {
    after register(user: x, name: "alice", email: "a@b.com") -> ok(user: x)
    then register(user: y, name: "alice", email: "c@d.com") -> error(message: "name already taken")
  }
}
```

**Design notes**:
- **Entity collection pattern** (Pattern A): `users: set U` as the primary collection
- **Only one action**: Registration is all this concept does — no update, delete, or get
- **Why no `get`?**: The state is queryable through the framework's query system — explicit get actions are optional for simple lookups
- **Constraint invariant**: Tests that duplicate names are rejected
- **Narrow scope**: No password, no profile, no avatar — just identity

## Example 4: Article — Full CRUD Entity

**Design rationale**: Article is the most complex domain concept, with 8 state fields and 4 actions. It manages the full lifecycle of content entities.

```
concept Article [A] {

  purpose {
    Manage articles with slugs, titles, bodies, tags, and metadata.
  }

  state {
    articles: set A
    slug: A -> String
    title: A -> String
    body: A -> String
    author: A -> String
    tags: A -> list String
    createdAt: A -> DateTime
    updatedAt: A -> DateTime
  }

  actions {
    action create(article: A, title: String, body: String, author: String, tags: list String) {
      -> ok(article: A) {
        Generate a slug from the title. Store all fields. Set timestamps.
      }
      -> error(message: String) {
        If the generated slug already exists, return error.
      }
    }

    action get(article: A) {
      -> ok(article: A, slug: String, title: String, body: String, author: String, tags: list String, createdAt: DateTime, updatedAt: DateTime) {
        Return all article data.
      }
      -> notfound(message: String) {
        If article does not exist in the set.
      }
    }

    action update(article: A, title: String, body: String, tags: list String) {
      -> ok(article: A) {
        Update mutable fields and set updatedAt timestamp.
      }
      -> notfound(message: String) {
        If article does not exist.
      }
    }

    action delete(article: A) {
      -> ok(article: A) {
        Remove article from set and all associated relations.
      }
      -> notfound(message: String) {
        If article does not exist.
      }
    }
  }

  invariant {
    after create(article: a, title: "Test Article", body: "Content", author: "u1", tags: "tag1") -> ok(article: a)
    then get(article: a) -> ok(article: a, slug: "test-article", title: "Test Article", body: "Content", author: "u1")
  }

  invariant {
    after create(article: a, title: "To Delete", body: "Content", author: "u1", tags: "tag1") -> ok(article: a)
    then delete(article: a) -> ok(article: a)
  }
}
```

**Design notes**:
- **Full CRUD**: create, get, update, delete — complete entity lifecycle
- **Computed state**: `slug` is derived from `title` — stored in state because it's needed for lookups
- **Immutable author**: `update` doesn't include `author` because article authorship doesn't change
- **Two invariants**: One for create-query (data integrity), one for create-delete (lifecycle)
- **No favorites/comments**: Those are separate concepts (Favorite, Comment) — concept independence

## Example 5: Favorite — Toggle with Count

```
concept Favorite [U] {

  purpose {
    Track which articles each user has favorited
    and provide counts.
  }

  state {
    favorites: U -> set String
  }

  actions {
    action favorite(user: U, article: String) {
      -> ok(user: U, article: String) {
        Add article to user's favorites set.
      }
    }

    action unfavorite(user: U, article: String) {
      -> ok(user: U, article: String) {
        Remove article from user's favorites set.
      }
    }

    action isFavorited(user: U, article: String) {
      -> ok(favorited: Bool) {
        Check if user has favorited article.
      }
    }

    action count(article: String) {
      -> ok(count: Int) {
        Return number of users who favorited article.
      }
    }
  }

  invariant {
    after favorite(user: u, article: "a1") -> ok(user: u, article: "a1")
    then isFavorited(user: u, article: "a1") -> ok(favorited: true)
    and  unfavorite(user: u, article: "a1") -> ok(user: u, article: "a1")
  }
}
```

**Design notes**:
- **Like Follow, but with count**: Extends the toggle pattern with an aggregate query
- **Count by article, not user**: `count(article)` counts across all users — derived from the favorites set
- **Same structural pattern as Follow**: favorite/unfavorite/isFavorited mirrors follow/unfollow/isFollowing

## Key Takeaways from Domain Concepts

1. **Concepts are small**: 1-8 state fields, 1-4 actions
2. **One purpose each**: Password doesn't know about users. User doesn't know about passwords.
3. **Opaque references**: Cross-concept references are always `String` (opaque IDs)
4. **Invariants prove the purpose**: Each invariant tells the concept's "defining story"
5. **State matches actions**: Every field is used, every action has the state it needs
6. **Error handling is explicit**: `notfound` for missing entities, `error` for constraint violations
7. **Composition via syncs**: Password + JWT = login flow, but the concepts don't know about each other
