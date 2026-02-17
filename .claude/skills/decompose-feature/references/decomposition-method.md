# Jackson's Decomposition Method

How to decompose a feature or application into independent concepts, following Daniel Jackson's methodology from *The Essence of Software*.

## The Core Idea

Software complexity comes from **coupling**, not from size. Jackson's decomposition method attacks coupling directly: every concept must be independently understandable, testable, and replaceable. The decomposition process is *purpose-driven* — you start with **why** the system exists, not **what** it does.

## Step-by-Step Decomposition

### 1. Enumerate Purposes

A **purpose** is a value the system delivers to its users. It answers "why does this exist?" rather than "what does it do?"

**How to find purposes:**
- List every user-visible action in the feature description
- For each action, ask: "What goal does this achieve for the user?"
- Merge actions that serve the same goal
- Split goals that have two independent reasons for existing

**Example — Social Blogging Platform:**

| User Action | Purpose |
|------------|---------|
| Sign up, log in | Securely authenticate users |
| Write articles | Manage long-form content |
| Comment on articles | Discuss content |
| Follow users | Track interesting authors |
| Favorite articles | Bookmark content for later |
| Tag articles | Categorize and discover content |
| View profiles | Display author information |

Notice: "Sign up" and "log in" serve the *same* purpose (authenticate users) even though they are different features. This is key — features are not concepts.

### 2. Apply the Singularity Principle

> **Singularity**: Each concept serves exactly one purpose. If you can state the purpose in one sentence without "and", it's one concept.

**Test each purpose:**
- "Securely authenticate users" — This is actually two purposes: (1) store and validate credentials, (2) manage session tokens. Split into **Password** and **JWT**.
- "Manage long-form content" — One purpose: CRUD on articles. One concept: **Article**.
- "Track interesting authors" — One purpose. One concept: **Follow**.

**Common mistake**: Bundling authentication into a "User" concept. User identity (names, emails) is a *different purpose* from credential management (hashing, validation) and session management (tokens, expiry). These are three concepts: **User**, **Password**, **JWT**.

### 3. Apply the Independence Principle

> **Independence**: No concept may reference another concept's types, state, or actions.

**Check each concept in isolation:**
- Does Comment reference Article's type parameter? No — it stores `target: C -> String` (an opaque reference). Good.
- Does Follow reference User's type parameter? No — it stores `target: String`. Good.
- Does Password need to know about JWT? No — sync layer connects them. Good.

**If you find coupling, apply a design move:**

| Problem | Design Move | Example |
|---------|-------------|---------|
| Concept A references Concept B's type | **Parameterize**: Use a type parameter or opaque String | Comment uses `String` for article ref, not `Article` |
| Concept A calls Concept B's action | **Lift to sync**: Move the call to a synchronization rule | Password doesn't call JWT/generate; the login sync does |
| Two concepts share state | **Split**: Extract shared state into its own concept | User holds identity; Profile holds bio/image separately |
| Concept has two unrelated purposes | **Split**: Create two concepts | User (identity) vs. Password (credentials) |
| Two concepts are never used apart | **Merge**: Combine if independence adds no value | (Rare — usually they *can* be used apart in a different app) |

### 4. Verify Sufficiency and Necessity

For each concept's state:

- **Sufficiency**: Can every action be implemented with *only* this state? If an action needs data from another concept, either (a) the data should be a parameter, or (b) the sync layer should provide it.
- **Necessity**: Is every state field used by at least one action? Remove dead state.

**Example — Follow concept:**
- State: `following: U -> set String`
- Actions: `follow` (add to set), `unfollow` (remove from set), `isFollowing` (query set)
- Sufficient? Yes — all actions operate only on the `following` mapping
- Necessary? Yes — the single field is used by all three actions

### 5. Map Dependencies to Syncs

Once concepts are independent, the *only* place they interact is through synchronizations. For each user-visible flow:

1. Identify which concepts participate
2. Determine the order of actions
3. Identify what data flows between them (via bound variables)
4. Handle both success and failure paths

**Example — Login flow:**
```
Web/request(login) → Password/check → JWT/generate → Web/respond
                                    ↘ (failure) → Web/respond(401)
```

This becomes 4 sync rules: LoginCheckPassword, LoginSuccess, LoginResponse, LoginFailure.

## Jackson's Design Moves

When the decomposition doesn't work cleanly, apply these transformations:

### Split
**When**: A concept serves two purposes.
**How**: Create two concepts, each with one purpose.
**Example**: "UserAccount" that handles both identity and credentials → **User** (identity: name, email) + **Password** (credentials: hash, salt).

### Merge
**When**: Two concepts are always used together and separating them adds complexity without value.
**How**: Combine into one concept.
**Example**: If "Username" and "Email" were separate concepts but always co-occur → merge into **User**.
**Caution**: Merge is rarely the right move. Test by asking: "Could one exist without the other in a different app?"

### Lift
**When**: A concept contains a mapping that's really about *connecting* two concepts rather than serving its own purpose.
**How**: Move the mapping to the sync layer.
**Example**: If Article stored `authorName: A -> String` by copying it from User, that's a join — lift it to a sync or query that fetches from both concepts.

### Specialize
**When**: A generic concept needs app-specific behavior.
**How**: Create a variant with fixed type parameters or constrained behavior.
**Example**: Generic `Collection [T]` → specialized `Favorite [U]` (collection of article refs per user).

### Unify
**When**: Two concepts with different names serve the same abstract purpose.
**How**: Replace both with a single, parameterized concept.
**Example**: "Followers" and "Blocked Users" are both `Relation [U]` — unify into one concept with different instances.

## Decomposition Smells

Watch for these warning signs that the decomposition needs adjustment:

| Smell | Diagnosis | Fix |
|-------|-----------|-----|
| Concept references another concept's type parameter | Coupling | Parameterize or use opaque String |
| Action name includes another concept's name (e.g., `deleteUserComments`) | Responsibility leak | Lift to sync |
| Purpose statement contains "and" | Two purposes | Split |
| Concept has 0 actions called by syncs | Unused concept | Remove or merge |
| Sync rule has 5+ when clauses | Over-orchestration | Simplify by splitting into sub-flows |
| Same data stored in two concepts | Duplication | Lift shared data to its own concept or use syncs |
| Removing a concept breaks another concept's actions | Dependency | Add type parameter, make concept truly independent |

## The Acid Test

A correct decomposition passes this test:

> **For each concept C**: You can write a complete, working implementation of C without reading the code of any other concept. The only interface is the action signatures (inputs → variant outputs).

If you can't implement a concept in isolation, it's not independent — go back and apply design moves until you can.
