---
name: sync-scaffold-gen
description: Use when creating a new sync rule to connect concepts. Generates a .sync file with when/where/then clauses from trigger and effect configurations.
argument-hint: --name <SyncName>
allowed-tools: Read, Write, Bash
---

# SyncScaffoldGen

Scaffold a sync rule **$ARGUMENTS** with trigger patterns, guard conditions, and effect actions.

> **When to use:** Use when creating a new sync rule to connect concepts. Generates a .sync file with when/where/then clauses from trigger and effect configurations.

## Design Principles

- **Declarative Wiring:** Syncs declare what happens when — they never contain imperative logic, loops, or conditionals beyond pattern matching.
- **Concept Independence:** Syncs reference concepts by name but concepts never know about syncs. The sync is the only place where concept names appear together.
- **Pattern Completeness:** The when clause must match specific action completions (concept/action with variant). The then clause invokes specific actions.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track SyncConfig → SyncSpec transformations.

**Examples:**
*Register the sync scaffold generator*
```typescript
const result = await syncScaffoldGenHandler.register({}, storage);

```

### Step 2: Generate Sync Rule

Generate a .sync file with when clause (trigger pattern), optional where clause (guard conditions), and then clause (effect actions).

**Examples:**
*Generate a simple sync*
```bash
copf scaffold sync --name CreateProfile --from User/create --to Profile/init
```
*Generate an eager sync*
```bash
copf scaffold sync --name ValidateOrder --tier required --eager
```

**Checklist:**
- [ ] Sync name is PascalCase?
- [ ] Tier annotation matches intended behavior ([eager], [required], [recommended])?
- [ ] When clause references a valid concept/action?
- [ ] Variable bindings in where clause use ?prefix?
- [ ] Then clause references a valid concept/action?
- [ ] Purpose statement explains why the sync exists?

## References

- [Sync rule writing guide](references/sync-rule-guide.md)

## Supporting Materials

- [Sync rule scaffolding walkthrough](examples/scaffold-sync.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | PascalCase sync name |
| tier | String | Sync tier (required, recommended) |
| eager | Boolean | Fire immediately (default: true) |
| trigger | Trigger | When clause (concept, action, params, variant) |
| conditions | list Condition | Where clause guards |
| effects | list Effect | Then clause actions |


## Anti-Patterns

### Sync with imperative logic
Sync tries to express conditionals or loops instead of pattern matching.

**Bad:**
```
# Pseudo-code in sync — not valid!
if user.isAdmin then
  AdminPanel/grant: [user: ?u]
```

**Good:**
```
where {
  bind(?meta.role as ?role)
  any(?role = "admin")
}
then {
  AdminPanel/grant: [user: ?u]
}
```

## Validation

*Generate a sync scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold sync --name CreateProfile --from User/create --to Profile/init
```
*Validate generated sync:*
```bash
npx tsx tools/copf-cli/src/index.ts sync validate syncs/create-profile.sync
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| sync-designer | Design syncs using formal patterns before generating |
| concept-scaffold | Generate concept specs referenced by the sync |
| sync-validator | Validate compiled syncs |

