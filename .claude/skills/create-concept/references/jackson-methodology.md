# Daniel Jackson's Concept Design Methodology

From "The Essence of Software" (Princeton University Press, 2021) and related academic work.

## What Is a Concept?

A concept is simultaneously:
1. A **mental construct** that a user must understand to use software effectively (e.g., "the concept of a folder," "the concept of friending")
2. A **coherent unit of functionality** — a modularity mechanism akin to procedures, classes, or abstract data types, but fundamentally *user-facing*

Jackson describes concepts as "free-standing nanoservices that factor the behavior of a system into independent and reusable parts." Each concept is smaller and more tightly focused than a microservice, and critically, it is designed to be independent of all other concepts.

## The Five Components of a Concept

### 1. Name
A clear, recognizable identifier. Good names are nouns that users already understand: Reservation, Trash, Label, Session, Password, Upvote.

### 2. Purpose
A concise statement of what the concept is *for* — the **why**. Each concept must have exactly ONE purpose (the Singularity principle).

Examples:
- **Trash**: To *undelete* files (not to delete them — a common misconception)
- **Reservation**: To ensure that when you arrive at the restaurant, they have a table for you
- **Upvote**: To allow collective ranking of items by preference
- **Password**: To verify a user's identity through a shared secret
- **Session**: To allow a user to operate without repeated authentication

The purpose is NOT a description of the mechanism — it's the *value proposition*.

### 3. Operational Principle (OP)
A "defining story" — an archetypal scenario showing how the concept is typically used and *why it fulfills its purpose*.

The term comes from chemist-philosopher Michael Polanyi and was brought to software by Michael A. Jackson. The OP takes the form:

> "If you perform some actions, then some result occurs that fulfills a useful purpose."

**Example — Reservation:**
> "You call in advance and agree on a time. Later you turn up at that time, and a table is available."

**Example — Password:**
> "You set a password for your account. Later, you provide the same password to prove it's you."

**Example — Trash:**
> "You delete a file (moving it to trash). Later, you realize you need it back, so you restore it from trash."

Key properties of OPs:
- They are **not** use cases — they don't cover all scenarios, just the essential story
- They prove the concept fulfills its purpose
- They can be formalized as invariants in COPF

### 4. State
What the concept remembers at runtime. Expressed as a relational model:
- **Sets**: collections of elements
- **Relations**: mappings between elements (of any arity)
- **Scalars**: single values

### 5. Actions
The operations users can perform, with:
- **Guards** (preconditions): conditions that must hold for the action to proceed
- **Postconditions**: how state changes after the action executes

## The Three Design Criteria

### Singularity
Each concept has exactly **one** purpose. If a concept serves two purposes, it should be split into two concepts.

**Anti-example**: Zoom's Mute serves two purposes — letting participants turn off their microphone for privacy AND controlling who is allowed to speak. Fix: split into Privacy + Permission concepts.

### Uniformity
A concept's operational principle works the same regardless of what application it's embedded in. The Password concept works identically whether it's in a banking app or a social network.

### Integrity
Concepts should be composed conjunctively (AND), preserving their individual properties. Composing concepts should not violate any concept's invariants.

## Concept Independence

This is Jackson's most radical and important idea. It has two concrete requirements:

### Polymorphic Types
A concept's types **cannot reference** the types of other concepts. It must be polymorphic.

Example: The Upvote concept operates on "items" of any type. At runtime, items might be posts, but the Upvote concept itself knows nothing about posts. In COPF, this is achieved through type parameters: `concept Upvote [I]`.

### No Cross-Concept Action Calls
The actions of one concept **cannot call** the actions of another. Coordination happens only through synchronization.

## Concept Composition via Synchronization

Since concepts are fully independent, coordination happens through **synchronizations** — external rules that bind actions across concepts:

> "Whenever one action happens, the other should happen too."

Syncs are like transactions: either all actions happen or none do. Key properties:
- **Syncs can only restrict, never extend** — they can never make a concept do an action it wouldn't otherwise allow
- **Syncs preserve concept independence** — concepts remain understandable individually
- **Syncs are separate from concepts** — they live in a distinct synchronization layer

Example sync:
```
sync LoginSuccess
when {
  Password/check: [user: ?user] => [valid: true]
}
then {
  JWT/generate: [user: ?user]
}
```

## Design Moves

Jackson catalogs archetypal transformations for improving concept designs:

1. **Split**: Break an overloaded concept into two focused concepts (Mute -> Privacy + Permission)
2. **Merge**: Combine concepts when extra flexibility isn't worth the complexity
3. **Unify**: Replace multiple specialized concepts with one general concept (like adjustable wrench replacing fixed-size set)
4. **Specialize**: Create a specialized variant of a general concept
5. **Lift**: Move a relational mapping out of a concept into application configuration, simplifying the concept's scope

## State Design Principles

### Sufficiency
State must be rich enough to support all actions. The concept must remember enough about past actions to perform future actions correctly.

Example: An Upvote concept must remember *which user* issued each upvote, to prevent double voting.

### Necessity
State should not include components that are never needed by any action.

Example: Should a Group store the date a user joined? Only if an action depends on it. If users can see all old messages, the join date is unnecessary.

### Visibility
Concept state is visible to users. States should make sense to users — this contrasts with OOP where internal state is often hidden.

## The Concept Catalog

Jackson envisions a catalog of reusable concepts drawn from studying hundreds of apps. Known patterns include:

| Concept | Purpose |
|---------|---------|
| Trash | Undeleting files |
| Folder | Hierarchical organization |
| Label | Non-hierarchical tagging |
| Style | Formatting abstraction |
| Session | Authenticated user context |
| Reservation | Guaranteed future availability |
| Upvote | Collective ranking |
| Friend/Follow | Social connections |
| Comment | Threaded discussion |
| Group | User collections with permissions |
| Karma | Reputation-gated access |
| Notification | Alerting users of events |

## References

- Jackson, Daniel. "The Essence of Software: Why Concepts Matter for Great Design." Princeton University Press, 2021.
- Jackson, Daniel. "Concept Design Moves." NASA Formal Methods (NFM), 2022.
- Jackson, Daniel. "Towards a Theory of Conceptual Design for Software." Onward! 2015.
- https://essenceofsoftware.com/
