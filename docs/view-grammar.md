# View Grammar — Invariants

`.view` files support the singular `invariant { … }` block that was
unified in MAG-911 (INV-7) and is parsed by the universal
`handlers/ts/framework/invariant-body-parser.ts`. The block accepts all
seven invariant kinds documented in `docs/concept-grammar.md`:
`example`, `forall`, `always`, `never`, `eventually`,
`action requires/ensures`, and `scenario`.

Some legacy views use the plural `invariants { … }` form; it is
preserved for backward compatibility but new views should use the
singular `invariant { … }` block that matches every other spec kind.

## Where invariants appear

A view spec may have zero or more `invariant { … }` blocks at the
top level of the view body:

```
view ViewName {
  purity: "read-only"
  dataSource { ... }
  filterSpec { ... }
  projectionSpec { ... }
  presentationSpec { ... }
  interactionSpec { ... }

  invariants { ... }     # legacy plural — still supported
  invariant  { ... }     # preferred singular — universal grammar
}
```

## Identifier resolution

The view `AssertionContext` plugin resolves identifiers against:

| Identifier | Resolves to |
|---|---|
| `<col>` on an assertion LHS | A projection column (from `projectionSpec.fields`) |
| `presentation.<field>` | A field on the presentation spec |
| `filterSpec.<field>` | A filter spec field |
| `results` | The materialised result row set |
| `row.<col>` in a `forall row in results:` | Per-row iteration |

## Worked example 1 — always + never over view configuration

```
view view-editor {
  purity: "read-write"
  dataSource   { concept: "ViewShell", action: "list" }
  presentation { displayType: "detail", hints: { showPreviewPane: true } }

  invariant {
    always "editor presentation is detail-mode": {
      presentation.displayType = "detail"
    }

    never "editor view drops the live preview pane hint": {
      presentation.hints.showPreviewPane = false
    }
  }
}
```

## Worked example 2 — scenario exercising a view end-to-end

```
view ActiveTasks {
  dataSource     { concept: "Task", action: "list" }
  filterSpec     { field: "status", op: "=", value: "active" }
  projectionSpec { fields: ["id", "title", "assignee"] }
  presentationSpec { displayType: "table" }

  invariant {
    forall "every returned row is active": {
      forall row in results:
        row.status = "active"
    }

    scenario "newly-created active task appears in the view": {
      fixture t1 { id: "task-1", title: "finish PRD", status: "active", assignee: "u-alice" }

      when {
        Task/create(id: "task-1", title: "finish PRD", status: "active", assignee: "u-alice") -> ok
      }
      then {
        results contains-where id = "task-1"
      }
      settlement: "async-eventually" { timeoutMs: 200 }
    }
  }
}
```

## How this becomes tests

`TestGeneration/run` treats view invariants as **query-level tests**:

1. **`InvariantParser`** parses the view's invariant block.
2. **View `AssertionContext`** resolves identifiers against the view's
   projection, filter, and presentation fields.
3. **`TestPlan` IR** captures the expected query semantics.
4. **`TestPlanRenderer`** emits tests that execute the view's
   `QueryProgram` against a kernel with fixtures applied and assert on
   the resulting rows.

For scenarios with `"async-eventually"` settlement, the renderer emits
polling assertions that wait for the propagated query result to
converge.

## References

- Universal parser: `handlers/ts/framework/invariant-body-parser.ts`
- View integration: `handlers/ts/framework/view-spec-parser.ts`
- AST types: `runtime/types.ts` (`InvariantDecl`)
- Pipeline: `specs/test/test-generation.derived`
- Full grammar reference: `docs/concept-grammar.md`
- Related: `docs/views-architecture.md`
