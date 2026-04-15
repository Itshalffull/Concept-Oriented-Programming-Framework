# Concept Grammar — Invariants and Test Generation

This document covers the **invariant grammar** inside `.concept` files.
The same grammar is shared across `.widget`, `.view`, `.sync`, and
`.derived` specs through the universal parser at
`handlers/ts/framework/invariant-body-parser.ts`. Per-kind variation is
limited to the `AssertionContext` plugin that resolves identifiers
(action names vs. anatomy parts vs. query columns vs. sync bindings vs.
composed concepts).

See also: `docs/widget-grammar.md`, `docs/view-grammar.md`,
`docs/sync-grammar.md`, `docs/derived-grammar.md`.

## Where invariants can appear

In a `.concept` file, invariants may appear as:

1. **A body block** — `invariant { … }` — zero or more, each block
   containing one or more invariants.
2. **Top-level named forms** — `example "…" { … }`, `forall "…" { … }`,
   `always "…" { … }`, `never "…" { … }`, `eventually "…" { … }`, and
   `scenario "…" { … }` — appearing at concept-body level alongside or
   instead of `invariant { … }` blocks.

## Seven invariant kinds

| Kind | Purpose |
|---|---|
| `example` | Named 1:1 conformance test (`after … -> variant` / `then …`) |
| `forall` | Universally quantified property with `given … in …` |
| `always` | State predicate that must hold in every reachable state |
| `never` | Safety property — state the system must never reach |
| `eventually` | Bounded liveness property |
| `requires` / `ensures` | Pre/postcondition action contracts |
| `scenario` | Multi-block behavioral test (fixtures + given/when/then + settlement) |

## Grammar (EBNF-ish)

```
invariantBlock     ::= "invariant" "{" invariantItem* "}"
invariantItem      ::= exampleInv | forallInv | alwaysInv | neverInv
                     | eventuallyInv | actionContract | scenarioInv
                     | stringLiteral         // legacy prose, no codegen

exampleInv         ::= "example" [STRING] "{" exampleBody "}"
exampleBody        ::= ("after" step) ("and" step)*
                       ("then" step) (("and" | ";") step)*
                       ["when" whenClause]

forallInv          ::= "forall" [STRING] "{" ("given" quant)+ exampleBody "}"
quant              ::= IDENT "in" ("{" literal ("," literal)* "}" | IDENT)

alwaysInv          ::= "always" [STRING] "{" predicate "}"
neverInv           ::= "never"  [STRING] "{" predicate "}"
eventuallyInv      ::= "eventually" [STRING] "{" predicate "}"

actionContract     ::= "action" IDENT "{" (requiresCl | ensuresCl)+ "}"
requiresCl         ::= "requires" [":"] assertion
ensuresCl          ::= "ensures" [IDENT] [":"] assertion

scenarioInv        ::= "scenario" [STRING] "{"
                         fixtureDecl*
                         ["given" "{" stepList "}"]
                         ["when"  "{" stepList "}"]
                          "then"  "{" stepList "}"
                         ["settlement" [":"] settlement]
                       "}"

fixtureDecl        ::= "fixture" (IDENT | STRING) [":" component]? ["{" argPattern ("," argPattern)* "}"]
component          ::= IDENT | STRING

stepList           ::= step (("and" | ";") step)*
step               ::= [ "assert" ] actionCall | assertion

settlement         ::= "sync"
                     | STRING["async-eventually"] "{" "timeoutMs" ":" INT "}"
                     | STRING["async-with-anchor"] "{" "anchor" ":" STRING "}"
```

## Worked example 1 — example + forall + action contract

```
concept PropertyStore [P] {
  purpose { Store formal properties as first-class data. }

  state {
    properties: set P
    kind: P -> {Invariant | Precondition | Postcondition}
  }

  actions {
    action define(kind: String, propertyText: String) {
      -> ok(property: P)
      -> invalid(reason: String)
    }
  }

  invariant {
    example "defining an invariant creates a retrievable property": {
      after define(kind: "Invariant", propertyText: "x > 0") -> ok(property: p)
      then get(property: p) -> ok(kind: "Invariant", text: "x > 0")
    }

    forall "valid kinds accepted": {
      given kind in {"Invariant", "Precondition", "Postcondition"}
      after define(kind: kind, propertyText: "t") -> ok
    }

    action define {
      requires: propertyText.length > 0
      ensures ok: result.kind in ["Invariant", "Precondition", "Postcondition"]
      ensures invalid: propertyText.length = 0
    }
  }
}
```

## Worked example 2 — scenario with fixture, when/then, settlement

```
concept Origin {
  # ... (state, actions) ...

  invariant {
    scenario "registering an origin makes it retrievable via get": {
      fixture o1 {
        origin: "scenario-origin",
        kind: "space",
        qualifier: "vs-1",
        displayName: "scenario",
        resolverConfig: '{"spaceId":"vs-1"}'
      }
      when {
        register(
          origin: "scenario-origin",
          kind: "space",
          qualifier: "vs-1",
          displayName: "scenario",
          resolverConfig: '{"spaceId":"vs-1"}'
        ) -> ok
      }
      then {
        get(origin: "scenario-origin") -> ok(
          kind: k, qualifier: q, displayName: dn, status: s, resolverConfig: rc
        )
        and s = "connected"
      }
      settlement: sync
    }
  }
}
```

## Settlement modalities

| Modality | Meaning |
|---|---|
| `sync` (bare) | Assertions evaluated immediately after `when` completes. Default. |
| `"async-eventually" { timeoutMs: N }` | Poll assertions until they hold or `N` ms elapse (generates timed liveness tests). |
| `"async-with-anchor" { anchor: "..." }` | Block until the named anchor fires (sync completion, UI anchor, etc.). |

## How this becomes tests

`TestGeneration/run` dispatches through:

1. **`InvariantParser`** — parse the `.concept` body into `InvariantDecl[]`
   (AST declared in `runtime/types.ts`).
2. **`AssertionContext` plugins** — resolve identifiers against the
   concept's state fields, actions, variants.
3. **`TestPlan` IR** — structural description of each test to emit.
4. **`TestPlanRenderer` plugins** — emit per-language/framework code
   (TypeScript + Vitest for concepts, React + Playwright for widgets, …).
5. **`TestArtifact`** — write generated files through `Emitter`.

Run the pipeline via:

```
npx tsx cli/src/index.ts test-gen --concept MyConcept --language typescript
```

or any of the thin dispatchers in `scripts/generate-*.ts`.

## References

- Parser: `handlers/ts/framework/invariant-body-parser.ts`
- AST types: `runtime/types.ts` (`InvariantDecl`, `ScenarioFixture`, `ScenarioSettlement`)
- Per-kind integration: `handlers/ts/framework/parser.ts`,
  `widget-spec-parser.ts`, `view-spec-parser.ts`, `sync-parser.ts`,
  `derived-parser.ts`
- Pipeline: `specs/test/test-generation.derived`
- PRD: `docs/plans/invariant-grammar-portability-prd.md`
