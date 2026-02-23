---
name: sync-compiler
description: Compile parsed synchronizations into executable registrations
argument-hint: $ARGUMENTS
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# SyncCompiler

Compile sync rules in **$ARGUMENTS** into executable registrations for the sync engine.


> **When to use:** Use when compiling parsed sync ASTs into executable registrations that the sync engine can evaluate at runtime.


## Design Principles

- **Completion Chaining:** Syncs compose through completions, never by referencing other syncs — each sync reacts to what happened, not who caused it.
- **Concept Independence:** Syncs wire concepts together without the concepts knowing about each other — concepts never import or reference each other.
- **Pattern Exhaustiveness:** Every when-clause variant that a sync matches should be explicitly listed — don't rely on fallthrough behavior.

## Step-by-Step Process

### Step 1: Compile Sync Rules

Compile .sync files that wire concepts together through pattern matching on completions.

**Arguments:** `$0` **sync** (Y), `$1` **ast** (syncast)

**Checklist:**
- [ ] Sync references valid concept actions?
- [ ] Variable bindings are consistent across when/where/then?
- [ ] Where-clause queries are well-formed?
- [ ] Sync mode (eager vs eventual) matches intent?

**Examples:**
*Compile sync rules*
```bash
copf compile-syncs --dir ./syncs
```
*Compile programmatically*
```typescript
import { syncCompilerHandler } from './sync-compiler.impl';
const result = await syncCompilerHandler.compile(
  { sync: parsedSync, ast: syncAst }, storage
);
```
## References

- [Reusable sync templates and patterns](references/sync-patterns.md)

#### Completion Chaining Pattern

Syncs compose through completions, not references. A typical
authenticated CRUD flow chains like this:

1. `User/login => ok[session: ?s]`
2. → `Auth/validate[session: ?s] => ok[token: ?t]`
3. → `Article/create[author: ?t] => ok[article: ?a]`

Each sync sees only the completion it reacts to — no sync
knows about the others in the chain.


## References

- [Sync language and patterns](references/sync-design.md)
- [Reusable sync templates](references/sync-patterns.md)
## Supporting Materials

- [Sync chain composition walkthrough](examples/write-a-sync-chain.md)
## Quick Reference

| Clause | Purpose | Example |
|--------|---------|---------|
| when | Pattern match on completion | `ConceptA/action => ok[field: ?var]` |
| where | Query concept state | `ConceptB: { ?item state.field: ?val }` |
| then | Invoke target action | `ConceptC/action[param: ?var]` |
| filter | Guard condition | `filter(?val > 0)` |


## Example Walkthroughs

For complete examples with design rationale:

- [Compose a sync chain (registration flow)](examples/write-a-sync-chain.md)
## Anti-Patterns

### Sync referencing sync
One sync tries to trigger another sync directly instead of reacting to a completion.

**Bad:**
```
sync BadChain [eager] {
  when { MySyncA/complete => ok }
  then { ConceptB/doThing }
}

```

**Good:**
```
sync GoodChain [eager] {
  when { ConceptA/create => ok[item: ?x] }
  then { ConceptB/process[item: ?x] }
}

```

### Overly broad pattern match
Sync matches all variants of an action instead of the specific one it needs.

**Bad:**
```
sync TooWide [eager] {
  when { User/register => [user: ?u] }
  then { Email/send[to: ?u] }
}

```

**Good:**
```
sync Precise [eager] {
  when { User/register => ok[user: ?u] }
  then { Email/send[to: ?u] }
}

```
## Validation

*Compile all sync rules:*
```bash
npx tsx tools/copf-cli/src/index.ts compile-syncs
```
*Run sync compiler tests:*
```bash
npx vitest run tests/sync-compiler.test.ts
```
## Related Skills

| Skill | When to Use |
| --- | --- |
| `/concept-designer` | Design concepts that syncs connect |
| `/implementation-builder` | Write handlers for concept actions |
| `/concept-validator` | Validate concept specs before writing syncs |
