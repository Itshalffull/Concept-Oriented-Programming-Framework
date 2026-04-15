# Sync Grammar — Invariants

`.sync` files gained an `invariant { … }` block in MAG-911 (INV-7).
The block is parsed by the universal
`handlers/ts/framework/invariant-body-parser.ts` and reuses the same
seven invariant kinds documented in `docs/concept-grammar.md`:
`example`, `forall`, `always`, `never`, `eventually`,
`action requires/ensures`, and `scenario`.

## Where invariants appear

A sync may have zero or more `invariant { … }` blocks. They attach to
the sync as a whole; each block contributes one or more invariants that
describe a guarantee of the synchronisation rule itself.

```
sync SyncName [eager]
  purpose: "..."
when { Src/action: [...] => variant }
where { ... }
then  { Dst/action: [...] }

invariant { ... }       # zero or more blocks
```

## Identifier resolution

The sync `AssertionContext` plugin resolves identifiers against:

| Identifier | Resolves to |
|---|---|
| `?var` | A variable bound in `when` / `where` |
| `when.<conceptAction>` | The trigger completion |
| `then.<conceptAction>` | An effect action invocation |
| `sync.<field>` | A sync metadata field (e.g., `sync.tier`, `sync.deliveryCount`) |

## Grammar

See `docs/concept-grammar.md` for the full EBNF. The block and its items
are identical; only identifier resolution differs.

## Worked example 1 — always + never

```
sync NotifyOnComment [required]
  purpose: "Every comment creation notifies the thread participants."
when {
  Comment/create: [threadId: ?tid, authorId: ?aid] => ok
}
where {
  query(Thread/participants: [threadId: ?tid] as ?participants)
  filter(?aid not in ?participants)  # don't notify the author
}
then {
  Notification/send: [to: ?participants, kind: "comment", threadId: ?tid]
}

invariant {
  always "every matched comment leads to a send invocation": {
    forall c in matchedCompletions:
      sync.thenInvocations count-where kind = "Notification/send" > 0
  }

  never "author receives own comment notification": {
    exists n in sync.thenInvocations:
      n.to = when.Comment/create.authorId
  }
}
```

## Worked example 2 — scenario exercising the sync end-to-end

```
sync AssignOnCreate [eager]
  purpose: "New tasks get their default assignee applied at create-time."
when { Task/create: [id: ?id, projectId: ?pid] => ok }
where { query(Project/defaultAssignee: [projectId: ?pid] as ?assignee) }
then  { Assignment/assign: [taskId: ?id, userId: ?assignee] }

invariant {
  scenario "creating a task fires the assignment": {
    fixture project1 { projectId: "p1", defaultAssignee: "u-alice" }
    fixture task1    { id: "t1", projectId: "p1" }

    when {
      Task/create(id: "t1", projectId: "p1") -> ok
    }
    then {
      Assignment/assign(taskId: "t1", userId: "u-alice") -> ok
    }
    settlement: sync
  }
}
```

Sync-level scenarios exercise the **full sync chain** — when-clause
matching, where-clause queries, then-clause dispatch — against the
configured concept kernel. Use `"async-eventually"` settlement when the
effect action goes through a transport (HTTP, WebSocket) whose
completion is not synchronous.

## Syncs in the test generation pipeline

A sync can carry its own `invariant { kind: scenario … }` block to
assert end-to-end behaviour after the sync fires — when-clause match,
where-clause queries, and then-clause dispatch all exercised together.
Settlement modalities resolve async sync chains: use
`"async-eventually" { timeoutMs: … }` when the effect action completes
over a transport, or `"async-with-anchor" { anchor: … }` to block until
a specific downstream completion lands. Sync scenario invariants flow
through the same `IntegrationTestGen` + TestPlan renderer pipeline as
concept scenarios.

## How this becomes tests

The same `TestGeneration/run` pipeline used for concepts and widgets
handles sync invariants. The sync `AssertionContext` plugin provides
identifier resolution; `TestPlanRenderer` plugins emit per-language
integration tests that boot a kernel with both concepts registered,
inject fixtures, invoke the trigger action, and assert the effect.

## References

- Universal parser: `handlers/ts/framework/invariant-body-parser.ts`
- Sync integration: `handlers/ts/framework/sync-parser.ts`
- AST types: `runtime/types.ts` (`InvariantDecl`)
- Pipeline: `specs/test/test-generation.derived`
- Full grammar reference: `docs/concept-grammar.md`
