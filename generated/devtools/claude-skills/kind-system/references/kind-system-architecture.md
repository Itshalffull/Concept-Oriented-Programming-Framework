# KindSystem Architecture

The KindSystem models the pipeline topology as a directed acyclic graph
of IR (intermediate representation) kinds.

## Kind Categories

- **source**: Raw input files (ConceptDSL, SyncDSL, InterfaceManifest)
- **model**: Parsed/structured data (ConceptAST, ConceptManifest, Projection)
- **artifact**: Generated output files (TypeScriptFiles, RestRoutes, etc.)

## Transform Edges

Each edge represents a generator that transforms one kind into another:
- `ConceptDSL →[SpecParser]→ ConceptAST`
- `ConceptAST →[SchemaGen]→ ConceptManifest`
- `ConceptManifest →[TypeScriptGen]→ TypeScriptFiles`
- `Projection →[RestTarget]→ RestRoutes`

## Routing

`route(from, to)` finds the shortest path using BFS. This determines
which generators must run to produce a desired artifact from a given source.

## Cascade Invalidation

When a kind is invalidated, `dependents(kind)` returns all downstream
kinds that need re-generation. This drives the cascade invalidation syncs.
