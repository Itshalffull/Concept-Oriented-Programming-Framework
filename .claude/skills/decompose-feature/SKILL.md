---
name: decompose-feature
description: Decompose a feature or app idea into independent COPF concepts and synchronizations following Daniel Jackson's methodology. Produces scaffolded .concept files and .sync files ready for refinement via the create-concept skill.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<feature or app description>"
---

# Decompose Feature into COPF Concepts

Break down **$ARGUMENTS** into independent concepts with synchronizations following Daniel Jackson's concept design methodology.

## The Decomposition Principle

Jackson's key insight: software should be structured as a collection of **independent concepts**, each with exactly one purpose, composed through **synchronizations**. The decomposition process is:

1. **Identify the purposes** the system must serve (not the features — the *why*)
2. **Map each purpose to one concept** (singularity principle)
3. **Ensure independence** — no concept references another's types or actions
4. **Design synchronizations** to coordinate concepts into user-visible flows

## Step 1: List the Purposes

Read the feature description and extract every distinct **purpose** the system must fulfill. A purpose answers "what value does this deliver?" — not "what does it do?"

Read [references/decomposition-method.md](references/decomposition-method.md) for Jackson's full decomposition methodology.

For each purpose, write a single sentence starting with a verb:
- "Track follower relationships between users"
- "Securely store and validate user credentials"
- "Manage articles with titles, bodies, and metadata"

**Key test**: If two purposes can exist independently (one could be removed without breaking the other), they are separate concepts. If removing one makes the other meaningless, they might be the same concept.

Consult [references/concept-catalog.md](references/concept-catalog.md) — many purposes map to well-known reusable concepts.

## Step 2: Name the Concepts

For each purpose, assign a name:
- **Nouns** that users already understand: Password, Article, Comment, Tag
- **PascalCase**: `Follow`, `Favorite`, `Profile`
- **One word when possible**: prefer `Tag` over `ArticleLabel`

## Step 3: Draw the Concept Map

List each concept with:
- Its purpose (one sentence)
- Its type parameter and what it represents
- Whether it's an **entity concept** (owns a collection) or a **relation concept** (decorates external entities)
- Which other concepts it will interact with via syncs

Example format:
```
CONCEPT MAP for "Social Blogging Platform"

User [U]         — Associate identifying information with users (entity)
Password [U]     — Securely store and validate credentials (relation on U)
JWT [U]          — Generate and verify session tokens (relation on U)
Profile [U]      — Store user profile information (relation on U)
Article [A]      — Manage articles with content and metadata (entity)
Comment [C]      — Manage comments on articles (entity)
Tag [T]          — Manage tags and article associations (entity)
Follow [U]       — Track follower relationships (relation on U)
Favorite [U]     — Track article favorites per user (relation on U)

SYNCS NEEDED:
  Registration: Web -> Password/validate -> User/register -> Password/set -> JWT/generate
  Login:        Web -> Password/check -> JWT/generate
  Articles:     Web -> JWT/verify -> Article/create|update|delete
  Comments:     Web -> JWT/verify -> Comment/create|delete
  Social:       Web -> JWT/verify -> Follow/follow|unfollow, Favorite/favorite|unfavorite
  Cascade:      Article/delete -> Comment/delete (all comments on that article)
```

## Step 4: Validate Independence

For each concept, check:

- [ ] **No type coupling**: Does it reference another concept's name in its state or actions? If yes, replace with a type parameter or opaque `String`.
- [ ] **No action coupling**: Does an action need to call another concept? If yes, that's a sync, not an action.
- [ ] **Single purpose**: Can you state the purpose in one sentence without "and"?
- [ ] **Reusable**: Could this concept work in a completely different app?

Apply Jackson's design moves if needed:
- **Split**: Concept has two purposes → break into two concepts
- **Merge**: Two concepts always used together and separating them adds no value → combine
- **Lift**: A mapping inside a concept really belongs in the sync layer → move it out

## Step 5: Identify Synchronization Flows

Read [references/sync-design.md](references/sync-design.md) for the sync language and patterns.

For each user-visible action (API endpoint, button click, form submission):

1. **What triggers it?** (e.g., Web/request with method "login")
2. **What concepts are involved?** List them in order
3. **What data flows between them?** (variables bound in when, used in then)
4. **What are the success and failure paths?**

Group syncs by flow:
- **Authentication syncs**: JWT/verify gates most actions
- **CRUD syncs**: Auth -> Action -> Response (three syncs per operation)
- **Cascade syncs**: Deleting parent → deleting children
- **Side-effect syncs**: Action on one concept triggers action on another

See [examples/sync-patterns.md](examples/sync-patterns.md) for reusable sync templates.

## Step 6: Scaffold the Concept Files

For each concept, create a skeleton `.concept` file at `specs/app/<name>.concept`:

```bash
npx tsx -e "
import { writeFileSync, mkdirSync } from 'fs';

const concepts = [
  // Fill in from your concept map:
  // { name: 'ConceptName', param: 'T', file: 'concept-name', purpose: '...',
  //   state: ['field: T -> Type'], actions: ['actionName'], entity: true/false }
];

mkdirSync('specs/app', { recursive: true });

for (const c of concepts) {
  const stateLines = c.state.map(s => '    ' + s).join('\n');
  const actionLines = c.actions.map(a =>
    '    action ' + a + '() {\n      -> ok() {\n        TODO\n      }\n    }'
  ).join('\n\n');

  const content = \`concept \${c.name} [\${c.param}] {

  purpose {
    \${c.purpose}
  }

  state {
\${stateLines}
  }

  actions {
\${actionLines}
  }
}
\`;
  writeFileSync('specs/app/' + c.file + '.concept', content);
  console.log('Created specs/app/' + c.file + '.concept');
}
"
```

Then use the `create-concept` skill to flesh out each one with proper actions, variants, and invariants.

## Step 7: Scaffold the Sync Files

For each flow, create a `.sync` file at `syncs/app/<flow>.sync`:

```bash
npx tsx -e "
import { writeFileSync, mkdirSync } from 'fs';

const flows = [
  // Fill in from your sync design:
  // { file: 'flow-name', comment: 'Description', syncs: [
  //   { name: 'SyncName', annotation: 'eager',
  //     when: 'Concept/action: [ field: ?var ] => [ field: ?var ]',
  //     then: 'Concept/action: [ field: ?var ]' }
  // ]}
];

mkdirSync('syncs/app', { recursive: true });

for (const flow of flows) {
  const syncBlocks = flow.syncs.map(s =>
    'sync ' + s.name + ' [' + s.annotation + ']\nwhen {\n  ' + s.when + '\n}\nthen {\n  ' + s.then + '\n}'
  ).join('\n\n');

  const content = '// ' + flow.comment + '\n\n' + syncBlocks + '\n';
  writeFileSync('syncs/app/' + flow.file + '.sync', content);
  console.log('Created syncs/app/' + flow.file + '.sync');
}
"
```

## Step 8: Validate the Full Pipeline

Parse all concepts to verify syntax:

```bash
npx tsx cli/src/index.ts check
```

Compile syncs to verify they reference valid concepts and actions:

```bash
npx tsx cli/src/index.ts compile-syncs
```

## Step 9: Hand Off to create-concept

For each scaffolded concept, use the `create-concept` skill to:
1. Flesh out action parameters and return variants
2. Write prose descriptions
3. Add invariants (operational principles)
4. Validate through the full pipeline

## Decomposition Checklist

Before finalizing, verify:

- [ ] Every user-visible feature maps to at least one sync flow
- [ ] Every concept has exactly one purpose
- [ ] No concept references another concept's types
- [ ] Auth-gated operations use JWT/verify syncs
- [ ] Entity deletion cascades are handled by syncs
- [ ] Success and failure response syncs exist for every flow
- [ ] Sync files are grouped by domain (login, registration, articles, etc.)
- [ ] Every concept purpose explains what/why/how concisely (1-3 sentences)
- [ ] Every action variant has a clear description (not just echoing the name)
- [ ] Every sync rule has a one-line comment explaining what it does
- [ ] Every sync file has a header comment explaining the flow it covers

## Quick Reference: Concept Categories

| Category | Examples | State Pattern | Typical Actions |
|----------|---------|---------------|-----------------|
| Identity | User | Entity (set + relations) | register |
| Auth | Password | Relation (U -> Bytes) | set, check, validate |
| Session | JWT | Relation (U -> String) | generate, verify |
| Content | Article, Comment | Entity (set + relations) | create, get, update, delete |
| Profile | Profile | Relation (U -> String) | update, get |
| Social | Follow, Favorite | Relation (U -> set String) | add, remove, query |
| Taxonomy | Tag | Entity (set + set relation) | add, remove, list |
| Diagnostic | Echo | Entity (set + relation) | send |

## Full Decomposition Example

See [examples/social-blogging-platform.md](examples/social-blogging-platform.md) for a complete worked example showing how the existing COPF app was decomposed from a "social blogging platform" feature description into 9 independent concepts with 7 sync files containing 30+ sync rules.

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design each concept identified during decomposition |
| `/create-sync` | Write the sync rules that connect decomposed concepts |
| `/create-concept-kit` | Bundle the decomposed concepts into a reusable kit |
| `/create-implementation` | Write implementations for each decomposed concept |
