# Sync Tiers

How required and recommended sync tiers work in suites, including override mechanics, disable mechanics, and enforcement rules.

## The Two Tiers

Kit syncs are divided into exactly two tiers:

### Required Syncs

**Purpose**: Enforce structural invariants that the suite's concepts depend on. If removed, concept state becomes inconsistent — orphaned records, dangling references, unpopulated fields.

**Behavior**:
- Loaded automatically when the suite is used
- Apps **cannot** override them (no same-name replacement)
- Apps **cannot** disable them (compiler emits an error)
- Should be kept to a minimum

**Annotation in .sync files**: `[required]`

```
sync CascadeDeleteFields [required]
when {
  Entity/delete: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  Field: { ?field target: ?entity }
}
then {
  Field/detach: [ field: ?field ]
}
```

**The required test**: Ask "if an app removes this sync, does concept state become corrupted?" If yes → required. If no → recommended.

Examples of required syncs:
- Cascade delete children when parent is deleted (prevents orphaned records)
- Cascade unlink relations when entity is deleted (prevents dangling references)
- Set timestamps on entity lifecycle events (prevents null timestamps that actions depend on)

Examples that are NOT required:
- "Send notification when entity is created" — nothing breaks if removed
- "Auto-create a default title field" — the entity still works without it
- "Log actions for audit trail" — audit is a nice-to-have, not data integrity

### Recommended Syncs

**Purpose**: Useful defaults that most apps will want, but can be customized.

**Behavior**:
- Loaded by default when the suite is used
- Apps **can override** by declaring a sync with the same `name`
- Apps **can disable** by listing the sync name in their deployment manifest
- Each recommended sync must have a `name` in the suite manifest (used for override/disable targeting)

**Annotation in .sync files**: `[recommended]`

```
sync DefaultTitleField [recommended]
when {
  Web/request: [ method: "create_node"; title: ?title ] => []
  Entity/create: [ entity: ?entity ] => [ entity: ?entity ]
}
where {
  bind(uuid() as ?field)
}
then {
  Field/attach: [ field: ?field; target: ?entity; name: "title"; value: ?title ]
}
```

**The override test**: Ask "what would an app replace this with?"
- If the answer is "nothing, they'd just remove it" → the sync needs `disable` support
- If the answer is "a different version of the same behavior" → the sync needs `override` support
- Either way, it's recommended (both override and disable are available for all recommended syncs)

## Override Mechanics

An app overrides a recommended sync by declaring a sync with the **same name** in its deployment manifest:

```yaml
# In deploy.yaml
kits:
  - name: content-management
    path: ./kits/content-management
    overrides:
      DefaultTitleField: ./syncs/my-custom-title.sync
```

The app's `my-custom-title.sync` completely replaces the suite's `default-title-field.sync`. The replacement sync must be a valid `.sync` file but doesn't need to have the same structure — it's a total replacement.

**Override flow**:
1. Compiler loads suite syncs
2. Compiler loads app overrides
3. For each override, the compiler removes the suite sync with the matching name and substitutes the app's sync
4. If the override references a name that doesn't exist in the suite, the compiler warns

## Disable Mechanics

An app disables a recommended sync by listing its name:

```yaml
# In deploy.yaml
kits:
  - name: content-management
    path: ./kits/content-management
    disable:
      - UpdateTimestamp
```

**Disable flow**:
1. Compiler loads suite syncs
2. Compiler processes disable list
3. For each disabled name, the compiler removes the suite sync entirely
4. If the name references a required sync, the compiler **errors**
5. If the name doesn't match any suite sync, the compiler warns

## Enforcement Summary

| Action | Required Sync | Recommended Sync |
|--------|--------------|-----------------|
| Loaded by default | Yes | Yes |
| App can override | No | Yes (same-name in `overrides`) |
| App can disable | No (compiler error) | Yes (name in `disable` list) |
| Compiler enforcement | Error on disable attempt | Warning on invalid name |
| Runtime enforcement | None (all syncs evaluated equally) | None |

**Important**: The tier distinction is purely a **compile-time and packaging concern**. At runtime, the sync engine evaluates all syncs equally — it has no concept of tiers. The tiers protect app developers from accidentally removing syncs that would corrupt their data.

## Checking Overrides

The `clef suite check-overrides` command validates that app-level sync overrides reference valid suite sync names:

```bash
npx tsx cli/src/index.ts suite check-overrides
```

Output:
```
Checking sync overrides...

App syncs that override suite syncs:
  DefaultTitleField (overrides suite sync)

3 suite sync(s), 8 app sync(s), 1 override(s)
```

This catches typos in override names and stale references to syncs that have been removed from the suite.

## Designing for Tiers

When writing a suite sync, decide its tier by answering these questions:

1. **Does removing this sync cause data corruption?** → Required
2. **Does removing this sync violate a concept invariant?** → Required
3. **Does removing this sync cause null/undefined state that actions depend on?** → Required
4. **Is this sync a useful default that some apps might not want?** → Recommended
5. **Does this sync implement behavior that varies across apps?** → Recommended
6. **Is this sync a convenience (notifications, logging, defaults)?** → Recommended

**Rule of thumb**: A suite with 5 syncs should have at most 2 required ones. If more than half your syncs are required, the concepts might be too tightly coupled — consider whether they should be merged or restructured.
