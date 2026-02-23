# Sync Language Reference

Syncs wire concepts together by reacting to completions. A sync
never calls another sync — it only sees concept action completions.

## Sync Declaration

```
sync Name [mode] {
  when { ... }
  where { ... }    # optional
  filter(...)      # optional
  then { ... }
}
```

**Modes:**
- `eager` — Executes synchronously within the same transaction.
  Use for data consistency (e.g., creating related records).
- `eventual` — Queued for async execution. Use for side effects
  (e.g., sending emails, updating caches).

## When Clause

Pattern matches on a concept action completion:

```
when { Concept/action => variant[binding: ?var, ...] }
```

- `Concept/action` — The concept and action to watch.
- `=> variant` — Which return variant to match.
- `[binding: ?var]` — Extract values from the completion into variables.

## Where Clause

Queries concept state to bind additional variables:

```
where { Concept: { ?item field: ?value } }
```

- `?item` — Binds to items in the concept's primary collection.
- `field: ?value` — Binds the field value to a variable.

## Filter Clause

Guards execution with a boolean condition:

```
filter(?count > 0)
filter(?status = "active")
```

## Then Clause

Invokes a target concept action with bound variables:

```
then { Concept/action[param: ?var, ...] }
```

All variables in then must be bound in when or where.

## Variable Binding Rules

1. Variables start with `?` — e.g., `?user`, `?email`.
2. A variable must be bound (in when or where) before use in then.
3. Variables are scoped to a single sync — no cross-sync sharing.
