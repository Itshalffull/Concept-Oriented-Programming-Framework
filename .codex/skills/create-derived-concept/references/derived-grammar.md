# Derived Concept Grammar — Invariants

`.derived` files gained an `invariant { … }` block in MAG-911 (INV-7).
Derived invariants assert **composition-level guarantees** — properties
that hold of the combined behaviour of the composed concepts and syncs,
not of any single base concept.

The block is parsed by the universal
`handlers/ts/framework/invariant-body-parser.ts` and supports the full
seven-kind grammar (`example`, `forall`, `always`, `never`,
`eventually`, `action requires/ensures`, `scenario`) documented in
`docs/concept-grammar.md`.

## Where invariants appear

A derived concept may have zero or more `invariant { … }` blocks. They
attach to the derived concept as a whole and describe invariants over
the composed system.

```
derived DerivedName {
  composes { Concept1, Concept2, ... }
  syncs    { sync1:required, sync2:recommended, ... }

  surface { actions { ... } queries { ... } }

  principle { ... }

  invariant { ... }     # zero or more blocks
}
```

## Identifier resolution

The derived `AssertionContext` plugin resolves identifiers against:

| Identifier | Resolves to |
|---|---|
| `<Concept>/<action>` | A composed concept's action |
| `<Concept>.<field>` | A composed concept's state field (read-only) |
| `surface.<action>` | A surface action this derived exposes |
| `surface.<query>` | A surface query |
| `composed.<sync>` | A named composed sync |

## Worked example 1 — cross-concept always

```
derived TaskBoard {
  composes { Task, Label, Assignment }
  syncs    { assign-on-create:required, label-inherited:recommended }

  principle {
    Creating a task with a parent board inherits the board's default
    labels and assignee.
  }

  invariant {
    always "every task has at least one label after create": {
      forall t in Task.tasks:
        Label.labelsFor(t) count > 0
    }

    never "a task exists without an assignment": {
      exists t in Task.tasks:
        Assignment.forTask(t) = none
    }
  }
}
```

## Worked example 2 — scenario exercising the derived composition

```
derived TrashSystem {
  composes { Item, Trash }
  syncs    { on-delete-move-to-trash:required, on-purge-remove:required }

  invariant {
    scenario "deleting an item moves it to the trash, not the bin": {
      fixture i1 { id: "item-42", name: "draft" }

      when {
        Item/delete(id: "item-42") -> ok
      }
      then {
        Item/get(id: "item-42") -> ok(status: s)
        and s = "trashed"
        and Trash/contains(id: "item-42") -> ok
      }
      settlement: sync
    }

    scenario "purging trashed items removes them permanently": {
      fixture i1 { id: "item-42", status: "trashed" }

      when {
        Trash/purge() -> ok
      }
      then {
        Item/get(id: "item-42") -> notFound
      }
      settlement: "async-eventually" { timeoutMs: 500 }
    }
  }
}
```

## Derived invariants in the test generation pipeline

Derived invariants participate in the same pipeline as concept and sync
invariants — parsed by the universal body parser, resolved by the
derived `AssertionContext`, routed through TestPlan → renderer plugins
and `IntegrationTestGen`. Because derived concepts coordinate multiple
base concepts, their invariants are especially natural candidates for
the `scenario` kind: a scenario over a derived concept exercises the
full composition (base concepts + configured syncs) end-to-end, with
settlement modalities covering the async sync chains that typically
connect composed concepts.

## How this becomes tests

The `TestGeneration/run` pipeline treats derived invariants as
integration-level tests. The derived `AssertionContext` plugin composes
the per-base-concept plugins, so an assertion like
`Task/create(...) -> ok` is resolved exactly as it would be inside the
`Task` concept spec.

Generated tests boot a kernel with all composed concepts registered and
all configured syncs active, then exercise the assertion body.

## References

- Universal parser: `handlers/ts/framework/invariant-body-parser.ts`
- Derived integration: `handlers/ts/framework/derived-parser.ts`
- AST types: `runtime/types.ts` (`InvariantDecl`)
- Pipeline: `specs/test/test-generation.derived`
- Full grammar reference: `docs/concept-grammar.md`
