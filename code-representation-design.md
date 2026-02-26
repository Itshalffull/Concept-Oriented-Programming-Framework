# COPF Code Representation & Semantic Query System

## Design Document v0.1.0 — 2026-02-25

---

## 1. Motivation

A COPF program is a collection of `.concept` specs, `.sync` specs, `kit.yaml` manifests, generated code files (TypeScript, Rust, Swift, Solidity), JSON/YAML configs, deployment manifests, interface definitions, documentation, and test files. Today these artifacts are opaque to the framework — the compiler pipeline processes them transiently, but nothing persists the structural or semantic content as queryable, traversable, connectable entities.

This design introduces a layered system that makes **every file in a COPF project** — source, generated, config, spec, doc — a first-class node in the concept graph, queryable at three levels:

- **Syntactic**: What tokens, nodes, and structure does this file contain?
- **Symbolic**: What named entities does it define or reference, and how do they connect across files?
- **Semantic**: What concepts, actions, variants, syncs, and data flows does the application declare, and how do they compose?

### Target queries this system must answer

| Query | Level |
|-------|-------|
| "What concepts does this sync reference?" | Semantic |
| "What files were generated from this spec?" | Semantic + Provenance |
| "Show me all TypeScript files that import this module" | Symbolic |
| "What config values affect this deployment?" | Semantic (data flow) |
| "Which action variants have no sync pattern-matching on them?" | Semantic (liveness) |
| "If I change Article's state schema, what breaks?" | Semantic (impact) |
| "Find all functions matching this structural pattern" | Syntactic |
| "What is the complete chain of effects from User/register?" | Semantic (flow) |

---

## 2. Architecture Overview

Three layers, each building on the one below:

```
┌─────────────────────────────────────────────────────────┐
│  SEMANTIC LAYER                                         │
│  ConceptEntity, ActionEntity, VariantEntity, SyncEntity │
│  StateField, FlowGraph (via Graph), InvariantChecks     │
│  (via DataQuality)                                      │
├─────────────────────────────────────────────────────────┤
│  SYMBOL LAYER                                           │
│  Symbol, SymbolOccurrence, ScopeGraph,                  │
│  SymbolRelationship                                     │
├─────────────────────────────────────────────────────────┤
│  PARSE LAYER                                            │
│  SyntaxTree, LanguageGrammar, DefinitionUnit,           │
│  ContentDigest, StructuralPattern, FileArtifact         │
├─────────────────────────────────────────────────────────┤
│  EXISTING FOUNDATION                                    │
│  ContentNode, ContentParser, ContentStorage, Resource,  │
│  SearchIndex, Graph, Reference, Relation, Provenance,   │
│  FieldMapping, DataQuality, Transform, Enricher, etc.   │
└─────────────────────────────────────────────────────────┘
```

Data flows upward: file changes trigger parse, parse feeds symbol extraction, symbols feed semantic entity construction. Queries flow downward: a semantic query ("what breaks if I change this?") resolves through symbols to file positions.

---

## 3. Existing Concept Audit

### 3.1 Concepts reused directly (no changes)

These existing concepts are used as-is in the new system's pipelines and storage:

| Concept | Kit | Role in new system |
|---------|-----|--------------------|
| ContentNode | Foundation | Base file representation — every project file is a ContentNode |
| ContentParser | Foundation | Parsing dispatch — extended with new grammar-aware parsers |
| ContentStorage | Foundation | Raw file content storage backend |
| Resource | Generation | Input file tracking with content hashing for change detection |
| Graph | Data Organization | Stores typed graph overlays (FlowGraph, ImportGraph, CallGraph, DependenceGraph, ProjectMap) |
| Reference | Linking | Cross-entity references within the concept graph |
| Relation | Linking | Typed relationships between entities |
| Backlink | Linking | Reverse traversal of Reference/Relation edges |
| Provenance | Data Integration | Lineage tracking from spec → generated artifact |
| Transform | Data Integration | Reshaping parsed ASTs into semantic entities |
| Enricher | Data Integration | Adding resolved types, cross-references, metadata |
| FieldMapping | Data Integration | Type parameter binding resolution across kit compositions |
| DataQuality | Data Integration | Invariant coverage validation, dead-variant detection |
| ProgressiveSchema | Data Integration | Schema discovery as new specs are parsed |
| Connector | Data Integration | Integration with external tools (Language Servers, SCIP indexes) |
| DataSource | Data Integration | Treating project directories and file sets as data sources |
| SearchIndex | Query/Retrieval | Coordination point for search — new TextIndex providers register here |
| Query | Query/Retrieval | Query execution against the entity graph |
| Namespace | Classification | Organizing symbols into hierarchical namespaces |
| Schema | Classification | Structural schema for concept metadata, sync metadata, etc. |
| Tag | Classification | Tagging entities (file role, language, generation status) |
| PluginRegistry | Infrastructure | Provider registration and resolution for all coordination concepts |

### 3.2 Concepts extended (additive changes)

| Concept | Kit | Extension |
|---------|-----|-----------|
| ContentParser | Foundation | New parser providers dispatch through LanguageGrammar rather than hardcoded format detection |
| Schema | Classification | New schema definitions for concept-spec-metadata, sync-spec-metadata, action-signature, variant-signature — used to validate and structure semantic entities |
| SearchIndex | Query/Retrieval | TextIndex providers (trigram, suffix array, symbol index) register as SearchIndex providers |
| Namespace | Classification | COPF symbol namespace scheme (`copf/concept/`, `copf/sync/`, `copf/action/`, `ts/module/`, etc.) |
| Tag | Classification | Standard tags: `role:source`, `role:generated`, `role:config`, `role:spec`, `role:doc`, `role:test`; `lang:typescript`, `lang:rust`, etc. |

### 3.3 Concepts superseded by new design

| Proposed concept | Superseded by | Reasoning |
|------------------|---------------|-----------|
| TypeBinding | FieldMapping | Type param mapping is field mapping where source is concept type param, target is kit shared type |
| InvariantCoverage | DataQuality | Invariant coverage is a data quality rule where the "data" is the sync graph |
| FlowGraph | Graph (typed instance) | Static flow graph is a directed graph populated by traversing SyncEntity chains |
| ProjectMap | Graph (typed instance) | Project-wide entity graph is a Graph combining ImportGraph + SymbolRelationship edges |
| CallGraph | Graph (typed instance) | Call relationships stored as typed edges, populated by DependenceGraph providers |
| ImportGraph | Graph (typed instance) | Module-level import/export relationships as typed graph edges |
| Generation provenance | Provenance | Standard lineage chain: spec → generator → output file |
| TextIndex (as standalone) | SearchIndex + providers | TextIndex providers register with existing SearchIndex |

### 3.4 Graph overlay typing scheme

Since CallGraph, ImportGraph, FlowGraph, ProjectMap, and DependenceGraph all collapse into typed instances of Graph, we need a consistent overlay scheme:

| Graph overlay | Node type | Edge type | Populated by |
|---------------|-----------|-----------|--------------|
| `import-graph` | FileArtifact / Symbol | `imports`, `exports`, `re-exports` | DependenceGraph providers |
| `call-graph` | ActionEntity / Symbol | `calls`, `dispatches` | DependenceGraph providers |
| `flow-graph` | ActionEntity / VariantEntity | `triggers`, `invokes` | SyncSemanticSync |
| `dependence-graph` | SyntaxTree node / Symbol | `data-dep`, `control-dep` | DependenceGraph providers |
| `project-map` | All entity types | All relationship types | Composite — union of other overlays |

---

## 4. New Kits and Concepts

### 4.1 Parse Kit (`kits/parse/`)

Extends Foundation Kit. Handles universal file parsing, structural identity, and pattern matching.

#### SyntaxTree [T]

```
purpose: Lossless concrete syntax tree for any parsed file, wrapping Tree-sitter CST output.

state:
  trees: set T
  source: T -> ContentNode-ref    // the file this tree was parsed from
  grammar: T -> LanguageGrammar-ref
  root_node: T -> Bytes           // serialized CST root
  byte_length: T -> Int
  edit_version: T -> Int          // incremented on reparse
  error_ranges: T -> list { start_byte: Int, end_byte: Int }

actions:
  parse(file: ContentNode-ref, grammar: LanguageGrammar-ref)
    -> ok(tree: T)
    -> parse_error(tree: T, error_count: Int)  // partial parse with error recovery
    -> no_grammar(message: String)

  reparse(tree: T, edit: { start_byte: Int, old_end_byte: Int, new_end_byte: Int, new_text: Bytes })
    -> ok(tree: T)

  query(tree: T, pattern: String)  // S-expression query
    -> ok(matches: list { node_type: String, start_row: Int, start_col: Int, end_row: Int, end_col: Int, captures: list { name: String, text: String } })
    -> invalid_pattern(message: String)

  node_at(tree: T, byte_offset: Int)
    -> ok(node_type: String, start: Int, end: Int, named: Bool, field: option String)
    -> out_of_range()

capabilities:
  requires persistent-storage
```

#### LanguageGrammar [G]

```
purpose: Tree-sitter grammar definition for a language or file format, mapping extensions to parsers.

state:
  grammars: set G
  name: G -> String               // "typescript", "yaml", "concept-spec", etc.
  extensions: G -> list String    // [".ts", ".tsx"], [".concept"], [".yaml", ".yml"]
  mime_types: G -> list String
  parser_wasm: G -> Bytes         // compiled Tree-sitter WASM parser
  node_types: G -> Bytes          // node-types.json
  supertypes: G -> list { name: String, subtypes: list String }
  highlights_query: G -> option String  // syntax highlighting S-expression query

actions:
  register(name: String, extensions: list String, parser_wasm: Bytes, node_types: Bytes)
    -> ok(grammar: G)
    -> already_registered(existing: G)

  resolve(file_extension: String)
    -> ok(grammar: G)
    -> no_grammar(extension: String)

  resolve_by_mime(mime_type: String)
    -> ok(grammar: G)
    -> no_grammar(mime_type: String)

capabilities:
  requires persistent-storage
```

**Provider pattern**: LanguageGrammar is a coordination concept. Each grammar is a provider plugin registered via PluginRegistry:

| Provider | Extensions | Notes |
|----------|-----------|-------|
| TreeSitterTypeScript | .ts, .tsx | |
| TreeSitterRust | .rs | |
| TreeSitterPython | .py | |
| TreeSitterSwift | .swift | |
| TreeSitterSolidity | .sol | |
| TreeSitterJson | .json | |
| TreeSitterYaml | .yaml, .yml | |
| TreeSitterToml | .toml | |
| TreeSitterMarkdown | .md | |
| TreeSitterHtml | .html | |
| TreeSitterCss | .css | |
| TreeSitterGraphql | .graphql | |
| TreeSitterProtobuf | .proto | |
| TreeSitterConceptSpec | .concept | Custom grammar extending YAML |
| TreeSitterSyncSpec | .sync | Custom grammar extending YAML |

#### DefinitionUnit [D]

```
purpose: An individual definition (function, type, concept spec, sync rule, config block) as a first-class entity independent of its containing file.

state:
  units: set D
  file: D -> ContentNode-ref
  symbol: D -> Symbol-ref         // globally unique identity
  tree_range: D -> { start_byte: Int, end_byte: Int, start_row: Int, start_col: Int, end_row: Int, end_col: Int }
  digest: D -> ContentDigest-ref
  kind: D -> String               // "function", "class", "type", "concept-spec", "sync-rule", "config-block"
  language: D -> String
  children: D -> list D           // nested definitions (methods in a class, actions in a concept)

actions:
  extract(tree: SyntaxTree-ref, node_range: { start_byte: Int, end_byte: Int })
    -> ok(unit: D)
    -> not_a_definition(node_type: String)

  find_by_symbol(symbol: Symbol-ref)
    -> ok(unit: D)
    -> notfound()

  find_by_pattern(kind: String, language: option String, name_pattern: option String)
    -> ok(units: list D)

  diff(a: D, b: D)
    -> ok(changes: list { kind: String, path: String, before: option String, after: option String })
    -> same()

capabilities:
  requires persistent-storage
```

#### ContentDigest [H]

```
purpose: Structural content hash for any DefinitionUnit, enabling content-addressed identity independent of formatting and local variable names.

state:
  digests: set H
  hash: H -> String               // SHA-256 of normalized structure
  algorithm: H -> String          // "structural-normalized" or "byte-exact"
  unit: H -> DefinitionUnit-ref

actions:
  compute(unit: DefinitionUnit-ref, algorithm: String)
    -> ok(digest: H)
    -> unsupported_algorithm(algorithm: String)

  lookup(hash: String)
    -> ok(units: list DefinitionUnit-ref)  // multiple units can share a digest
    -> notfound()

  equivalent(a: DefinitionUnit-ref, b: DefinitionUnit-ref)
    -> yes()
    -> no(diff_summary: String)

capabilities:
  requires persistent-storage
  requires crypto
```

#### StructuralPattern [P]

```
purpose: Reusable structural search/match pattern over syntax trees, supporting multiple pattern syntaxes.

state:
  patterns: set P
  name: P -> option String
  syntax: P -> String             // "tree-sitter-query", "ast-grep", "comby", "regex"
  source: P -> String             // the pattern source text
  language: P -> option String    // language constraint (none = any)
  compiled: P -> option Bytes     // pre-compiled pattern for performance

actions:
  create(syntax: String, source: String, language: option String)
    -> ok(pattern: P)
    -> invalid_syntax(message: String, position: Int)

  match(pattern: P, tree: SyntaxTree-ref)
    -> ok(matches: list { start_byte: Int, end_byte: Int, captures: list { name: String, text: String } })
    -> no_matches()
    -> incompatible_language(pattern_lang: String, tree_lang: String)

  match_project(pattern: P)  // search all project files
    -> ok(results: list { file: ContentNode-ref, matches: list { start_byte: Int, end_byte: Int } })
    -> no_matches()

capabilities:
  requires persistent-storage
```

**Provider pattern**: StructuralPattern is a coordination concept. Pattern engines are providers:

| Provider | Pattern syntax | Notes |
|----------|---------------|-------|
| TreeSitterQueryProvider | S-expression queries | Native Tree-sitter, most precise |
| AstGrepProvider | Metavariable code patterns | User-friendly, YAML rule composition |
| CombyProvider | Hole-based `:[hole]` patterns | Works without full parser |
| RegexProvider | Regular expressions | Fallback for simple text patterns |

#### FileArtifact [F]

```
purpose: Software-engineering metadata for a project file, extending ContentNode with role, provenance, and dependency information.

state:
  artifacts: set F
  node: F -> ContentNode-ref
  role: F -> String               // "source", "generated", "config", "spec", "doc", "test", "asset"
  language: F -> option String
  encoding: F -> String           // "utf-8", "binary", etc.
  generation_source: F -> option { spec: ContentNode-ref, generator: String, plan: String }
  schema_ref: F -> option String  // Schema that validates this file (for config/spec files)

actions:
  register(node: ContentNode-ref, role: String, language: option String)
    -> ok(artifact: F)
    -> already_registered(existing: F)

  set_provenance(artifact: F, spec: ContentNode-ref, generator: String)
    -> ok()
    -> notfound()

  find_by_role(role: String)
    -> ok(artifacts: list F)

  find_generated_from(spec: ContentNode-ref)
    -> ok(artifacts: list F)
    -> no_generated_files()

  impact(artifact: F)  // what downstream artifacts depend on this one
    -> ok(affected: list F, via: list { relationship: String, path: list F })

capabilities:
  requires persistent-storage
```

### 4.2 Symbol Kit (`kits/symbol/`)

Extends Linking Kit. Handles cross-file identity, occurrence tracking, scope resolution, and typed semantic relationships.

#### Symbol [S]

```
purpose: Globally unique, cross-file identifier for any named entity in the project.

state:
  symbols: set S
  symbol_string: S -> String      // hierarchical: "copf/concept/Article", "ts/function/src/handlers/article.ts/createArticle"
  kind: S -> String               // "function", "class", "type", "variable", "concept", "action", "variant", "state-field", "sync", "config-key"
  display_name: S -> String
  documentation: S -> option String
  visibility: S -> String         // "public", "private", "internal", "module"
  deprecated: S -> option String  // deprecation message if deprecated
  defining_file: S -> ContentNode-ref
  namespace: S -> option String   // Namespace-ref for Classification Kit integration

actions:
  register(symbol_string: String, kind: String, display_name: String, defining_file: ContentNode-ref)
    -> ok(symbol: S)
    -> already_exists(existing: S)

  resolve(symbol_string: String)
    -> ok(symbol: S)
    -> notfound()
    -> ambiguous(candidates: list S)

  find_by_kind(kind: String, namespace: option String)
    -> ok(symbols: list S)

  find_by_file(file: ContentNode-ref)
    -> ok(symbols: list S)

  rename(symbol: S, new_name: String)
    -> ok(old_name: String, occurrences_updated: Int)
    -> conflict(conflicting: S)

capabilities:
  requires persistent-storage
```

**Provider pattern**: Symbol storage/identity is uniform. Symbol *extraction* uses the coordination+provider pattern:

| Provider | Handles | Notes |
|----------|---------|-------|
| TypeScriptSymbolExtractor | .ts, .tsx | Uses TS compiler API for full type resolution |
| RustSymbolExtractor | .rs | Uses rust-analyzer SCIP output |
| PythonSymbolExtractor | .py | Uses Pyright/Jedi SCIP output |
| ConceptSpecSymbolExtractor | .concept | Extracts concept, action, variant, state-field symbols |
| SyncSpecSymbolExtractor | .sync | Extracts sync name, concept refs, variable bindings |
| JsonConfigSymbolExtractor | .json | Extracts config keys as symbols (with JSON Schema awareness) |
| YamlConfigSymbolExtractor | .yaml | Extracts config keys; kit.yaml gets special handling |
| GraphQLSymbolExtractor | .graphql | Extracts types, fields, queries, mutations |
| UniversalTreeSitterExtractor | any | Fallback: generic Tree-sitter queries for function/class/type declarations |

Each extractor registers with PluginRegistry and declares which file extensions it handles. Routing sync dispatches to the best available extractor (language-specific preferred, universal as fallback).

#### SymbolOccurrence [O]

```
purpose: Records where a Symbol appears in a file — exact location and semantic role.

state:
  occurrences: set O
  symbol: O -> Symbol-ref
  file: O -> ContentNode-ref
  location: O -> { start_row: Int, start_col: Int, end_row: Int, end_col: Int, start_byte: Int, end_byte: Int }
  role: O -> list String          // ["definition"], ["reference"], ["import"], ["export"], ["write"], ["read"]
  enclosing_symbol: O -> option Symbol-ref  // the symbol that contains this occurrence

actions:
  record(symbol: Symbol-ref, file: ContentNode-ref, location: {...}, role: list String)
    -> ok(occurrence: O)

  find_definitions(symbol: Symbol-ref)
    -> ok(occurrences: list O)
    -> no_definitions()

  find_references(symbol: Symbol-ref, role_filter: option list String)
    -> ok(occurrences: list O)
    -> no_references()

  find_at_position(file: ContentNode-ref, row: Int, col: Int)
    -> ok(occurrence: O, symbol: Symbol-ref)
    -> no_symbol_at_position()

  find_in_file(file: ContentNode-ref)
    -> ok(occurrences: list O)

capabilities:
  requires persistent-storage
```

#### ScopeGraph [C]

```
purpose: Lexical scoping, visibility, and name resolution model for a file or module.

state:
  graphs: set C
  file: C -> ContentNode-ref
  scopes: C -> list { id: String, kind: String, parent: option String }
  declarations: C -> list { scope: String, name: String, symbol: Symbol-ref }
  references: C -> list { scope: String, name: String, resolved: option Symbol-ref }
  import_edges: C -> list { from_scope: String, to_scope: String, qualifier: option String }

actions:
  build(file: ContentNode-ref, tree: SyntaxTree-ref)
    -> ok(graph: C)
    -> unsupported_language(language: String)

  resolve_reference(graph: C, scope: String, name: String)
    -> ok(symbol: Symbol-ref)
    -> unresolved(candidates: list String)
    -> ambiguous(symbols: list Symbol-ref)

  visible_symbols(graph: C, scope: String)
    -> ok(symbols: list Symbol-ref)

capabilities:
  requires persistent-storage
```

**Provider pattern**: Language-specific scoping rules:

| Provider | Language | Notes |
|----------|----------|-------|
| TypeScriptScopeProvider | TypeScript/JavaScript | Module scopes, hoisting, closures |
| PythonScopeProvider | Python | LEGB rule |
| RustScopeProvider | Rust | Module tree, visibility modifiers |
| ConceptScopeProvider | .concept | Each concept is an isolated scope |
| SyncScopeProvider | .sync | Cross-concept references with variable scoping |
| StackGraphsProvider | multiple | Wraps GitHub's Stack Graphs library |

#### SymbolRelationship [R]

```
purpose: Typed semantic relationships between Symbols beyond simple reference — implements, extends, overrides, generates, configures.

state:
  relationships: set R
  source: R -> Symbol-ref
  target: R -> Symbol-ref
  kind: R -> String               // "implements", "extends", "overrides", "aliases", "generates", "configures", "tests", "documents"
  metadata: R -> option String    // relationship-specific metadata (e.g., for "generates": generator name)

actions:
  add(source: Symbol-ref, target: Symbol-ref, kind: String)
    -> ok(relationship: R)
    -> already_exists(existing: R)

  find_from(source: Symbol-ref, kind: option String)
    -> ok(relationships: list R)

  find_to(target: Symbol-ref, kind: option String)
    -> ok(relationships: list R)

  transitive_closure(start: Symbol-ref, kind: String, direction: String)
    -> ok(symbols: list Symbol-ref, paths: list list Symbol-ref)

capabilities:
  requires persistent-storage
```

Interoperates with existing Linking Kit: SymbolRelationship extends the vocabulary of Reference/Relation with program-analysis-specific edge types. A sync should maintain bidirectional Backlink entries for every SymbolRelationship.

### 4.3 Semantic Kit (`kits/semantic/`)

New kit. COPF-specific semantic entities representing the application's declared structure.

#### ConceptEntity [E]

```
purpose: Queryable representation of a parsed concept, linking declaration to generated artifacts and runtime behavior.

state:
  entities: set E
  name: E -> String
  symbol: E -> Symbol-ref
  source_file: E -> FileArtifact-ref
  purpose_text: E -> String
  version: E -> Int
  gate: E -> Bool
  capabilities: E -> list String
  type_params: E -> list { name: String, binding: option String }  // binding via FieldMapping
  actions_ref: E -> list ActionEntity-ref
  state_fields_ref: E -> list StateField-ref
  kit: E -> option String

actions:
  register(name: String, source: FileArtifact-ref, ast: Bytes)
    -> ok(entity: E)
    -> already_registered(existing: E)

  get(name: String)
    -> ok(entity: E)
    -> notfound()

  find_by_capability(capability: String)
    -> ok(entities: list E)

  find_by_kit(kit: String)
    -> ok(entities: list E)

  generated_artifacts(entity: E)
    -> ok(artifacts: list FileArtifact-ref)  // via Provenance

  participating_syncs(entity: E)
    -> ok(syncs: list SyncEntity-ref)  // syncs that reference any of this concept's actions

  check_compatibility(a: E, b: E)
    -> compatible(shared_type_params: list String)
    -> incompatible(reason: String)

capabilities:
  requires persistent-storage
```

#### ActionEntity [A]

```
purpose: Action declaration with full lifecycle tracing — spec → sync participation → implementation → interface exposure → runtime.

state:
  actions_set: set A
  concept: A -> ConceptEntity-ref
  name: A -> String
  symbol: A -> Symbol-ref
  params: A -> list { name: String, type_expr: String }
  variants: A -> list VariantEntity-ref
  implementation_symbols: A -> list Symbol-ref  // handler functions in generated code

actions:
  register(concept: ConceptEntity-ref, name: String, params: list {...}, variant_refs: list VariantEntity-ref)
    -> ok(action: A)

  find_by_concept(concept: ConceptEntity-ref)
    -> ok(actions: list A)

  triggering_syncs(action: A)
    -> ok(syncs: list SyncEntity-ref)  // syncs whose when-clause matches this action

  invoking_syncs(action: A)
    -> ok(syncs: list SyncEntity-ref)  // syncs whose then-clause invokes this action

  implementations(action: A)
    -> ok(symbols: list Symbol-ref)  // handler code across target languages

  interface_exposures(action: A)
    -> ok(exposures: list { target: String, method: String, path: String })  // REST endpoint, CLI command, etc.

capabilities:
  requires persistent-storage
```

#### VariantEntity [V]

```
purpose: Action return variant as a first-class branching point in sync chains.

state:
  variants: set V
  action: V -> ActionEntity-ref
  tag: V -> String                // "ok", "error", "notfound", "invalid", etc.
  symbol: V -> Symbol-ref
  fields: V -> list { name: String, type_expr: String }
  description: V -> option String

actions:
  register(action: ActionEntity-ref, tag: String, fields: list {...})
    -> ok(variant: V)

  matching_syncs(variant: V)
    -> ok(syncs: list SyncEntity-ref)  // syncs whose when-pattern matches this variant tag

  is_dead(variant: V)
    -> dead(no_matching_syncs: Bool, no_runtime_occurrences: Bool)
    -> alive(sync_count: Int, runtime_count: Int)

capabilities:
  requires persistent-storage
```

#### StateField [L]

```
purpose: Single state declaration in a concept, traced through generation and storage.

state:
  fields: set L
  concept: L -> ConceptEntity-ref
  name: L -> String
  symbol: L -> Symbol-ref
  type_expr: L -> String          // "set T", "T -> String", "T -> list Int", etc.
  cardinality: L -> String        // "set", "mapping", "list", "option", "scalar"
  group: L -> option String       // explicit group name if grouped
  generated_symbols: L -> list Symbol-ref  // corresponding fields in generated code

actions:
  register(concept: ConceptEntity-ref, name: String, type_expr: String)
    -> ok(field: L)

  find_by_concept(concept: ConceptEntity-ref)
    -> ok(fields: list L)

  trace_to_generated(field: L)
    -> ok(targets: list { language: String, symbol: Symbol-ref, file: FileArtifact-ref })

  trace_to_storage(field: L)
    -> ok(targets: list { adapter: String, column_or_key: String })

capabilities:
  requires persistent-storage
```

#### SyncEntity [Y]

```
purpose: Compiled sync rule as a queryable node — the semantic glue connecting concepts.

state:
  syncs: set Y
  name: Y -> String
  symbol: Y -> Symbol-ref
  source_file: Y -> FileArtifact-ref
  annotations: Y -> list String   // ["eager"], ["eventual"], ["local"], ["idempotent"]
  when_patterns: Y -> list {
    concept: ConceptEntity-ref,
    action: ActionEntity-ref,
    variant_filter: option String,
    bindings: list { variable: String, field: String }
  }
  where_clauses: Y -> list {
    kind: String,                 // "query", "bind", "filter"
    concept: option ConceptEntity-ref,
    expression: String
  }
  then_actions: Y -> list {
    concept: ConceptEntity-ref,
    action: ActionEntity-ref,
    arguments: list { field: String, source: String }
  }
  tier: Y -> String               // "required", "recommended", "integration"

actions:
  register(name: String, source: FileArtifact-ref, compiled: Bytes)
    -> ok(sync: Y)
    -> already_registered(existing: Y)

  find_by_concept(concept: ConceptEntity-ref)
    -> ok(syncs: list Y)  // all syncs that reference this concept in when/where/then

  find_triggerable_by(action: ActionEntity-ref, variant: option String)
    -> ok(syncs: list Y)

  chain_from(action: ActionEntity-ref, variant: option String, depth: option Int)
    -> ok(chain: list { sync: Y, triggers: ActionEntity-ref, which_triggers: list Y })
    -> no_chain()

  find_dead_ends()
    -> ok(dead_ends: list { sync: Y, then_action: ActionEntity-ref, reason: String })

  find_orphan_variants()
    -> ok(orphans: list VariantEntity-ref)

capabilities:
  requires persistent-storage
```

### 4.4 Analysis Kit (`kits/analysis/`)

New kit. Program analysis overlays computed from parse + symbol layers.

#### DependenceGraph [N]

```
purpose: Data and control dependency edges between program elements, within and across files.

state:
  graphs: set N
  scope: N -> String              // "file", "module", "project"
  scope_ref: N -> ContentNode-ref
  nodes: N -> list { id: String, symbol: option Symbol-ref, location: option { file: String, row: Int, col: Int } }
  edges: N -> list { source: String, target: String, kind: String, label: option String }
    // kind: "data-dep", "control-dep", "call", "import", "type-dep"

actions:
  compute(scope_ref: ContentNode-ref)
    -> ok(graph: N)
    -> unsupported_language(language: String)

  query_dependents(symbol: Symbol-ref, edge_kinds: option list String)
    -> ok(dependents: list Symbol-ref)

  query_dependencies(symbol: Symbol-ref, edge_kinds: option list String)
    -> ok(dependencies: list Symbol-ref)

  slice_forward(criterion: Symbol-ref)
    -> ok(slice: list Symbol-ref, edges: list { source: String, target: String, kind: String })

  slice_backward(criterion: Symbol-ref)
    -> ok(slice: list Symbol-ref, edges: list { source: String, target: String, kind: String })

  impact_analysis(changed: list Symbol-ref)
    -> ok(affected: list Symbol-ref, paths: list list { symbol: String, edge: String })

capabilities:
  requires persistent-storage
```

**Provider pattern**: Language-specific and strategy-specific analysis:

| Provider | Scope | Notes |
|----------|-------|-------|
| TypeScriptDependenceProvider | .ts/.tsx files | Uses TS compiler API for type-aware analysis |
| RustDependenceProvider | .rs files | Uses rust-analyzer for ownership/lifetime-aware analysis |
| ConceptDependenceProvider | .concept files | State field type refs, capability requirements |
| SyncDependenceProvider | .sync files | When-clause → then-clause data flow, cross-sync triggering |
| DatalogDependenceProvider | any | Wraps Soufflé for declarative analysis from extracted facts |
| UniversalTreeSitterDependenceProvider | any | Basic import/call analysis via Tree-sitter queries |

#### DataFlowPath [W]

```
purpose: Traced flow of data from source to sink through the program, enabling taint tracking and config tracing.

state:
  paths: set W
  source_symbol: W -> Symbol-ref
  sink_symbol: W -> Symbol-ref
  steps: W -> list { symbol: Symbol-ref, file: ContentNode-ref, location: { row: Int, col: Int }, edge_kind: String }
  path_kind: W -> String          // "taint", "config-propagation", "data-provenance"

actions:
  trace(source: Symbol-ref, sink: Symbol-ref)
    -> ok(paths: list W)
    -> no_path()

  trace_from_config(config_key: Symbol-ref)
    -> ok(paths: list W)  // all places this config value flows to

  trace_to_output(output: FileArtifact-ref)
    -> ok(paths: list W)  // all data sources that contribute to this output

capabilities:
  requires persistent-storage
```

#### ProgramSlice [Z]

```
purpose: Minimal subgraph of the dependence graph preserving behavior with respect to a slicing criterion.

state:
  slices: set Z
  criterion_symbol: Z -> Symbol-ref
  criterion_location: Z -> { file: String, row: Int, col: Int }
  direction: Z -> String          // "forward", "backward"
  included_symbols: Z -> list Symbol-ref
  included_files: Z -> list ContentNode-ref
  edge_count: Z -> Int

actions:
  compute(criterion: Symbol-ref, direction: String)
    -> ok(slice: Z)
    -> no_dependence_data(message: String)

  files_in_slice(slice: Z)
    -> ok(files: list FileArtifact-ref)

  symbols_in_slice(slice: Z)
    -> ok(symbols: list Symbol-ref)

capabilities:
  requires persistent-storage
```

#### AnalysisRule [U]

```
purpose: Declarative analysis rules for deriving facts from program entities — custom queries, linting, architectural constraints.

state:
  rules: set U
  name: U -> String
  description: U -> String
  engine: U -> String             // "datalog", "graph-traversal", "pattern-match"
  source: U -> String             // rule source in engine-specific syntax
  severity: U -> String           // "error", "warning", "info"
  category: U -> String           // "dead-code", "security", "architecture", "convention"

actions:
  create(name: String, engine: String, source: String, severity: String, category: String)
    -> ok(rule: U)
    -> invalid_syntax(message: String)

  evaluate(rule: U)
    -> ok(findings: list { message: String, symbol: option Symbol-ref, file: option ContentNode-ref, location: option { row: Int, col: Int } })
    -> no_findings()
    -> evaluation_error(message: String)

  evaluate_all(category: option String)
    -> ok(results: list { rule: String, finding_count: Int, findings: list {...} })

capabilities:
  requires persistent-storage
```

**Provider pattern**: Analysis engines:

| Provider | Engine type | Notes |
|----------|------------|-------|
| DatalogAnalysisProvider | Datalog rules | Wraps Soufflé-style fixpoint evaluation |
| GraphTraversalAnalysisProvider | Graph reachability | Queries against Graph overlays |
| PatternMatchAnalysisProvider | Structural patterns | Delegates to StructuralPattern |

### 4.5 Discovery Kit (`kits/discovery/`)

Extends Query/Retrieval Kit. Search, embedding, and indexing.

#### SemanticEmbedding [B]

```
purpose: Vector representation of DefinitionUnits for similarity search and natural language code search.

state:
  embeddings: set B
  unit: B -> DefinitionUnit-ref
  digest: B -> ContentDigest-ref  // cached by content — recompute only when digest changes
  model: B -> String              // "codeBERT", "unixcoder", "openai-code", "voyage-code"
  vector: B -> list Float
  dimensions: B -> Int

actions:
  compute(unit: DefinitionUnit-ref, model: String)
    -> ok(embedding: B)
    -> model_unavailable(model: String)

  search_similar(query_vector: list Float, top_k: Int, language: option String, kind: option String)
    -> ok(results: list { unit: DefinitionUnit-ref, score: Float })

  search_natural_language(query: String, top_k: Int)
    -> ok(results: list { unit: DefinitionUnit-ref, score: Float })

capabilities:
  requires persistent-storage
  requires network
```

**Provider pattern**: Embedding model providers:

| Provider | Model | Notes |
|----------|-------|-------|
| CodeBERTEmbeddingProvider | CodeBERT | Local, open-source |
| UniXcoderEmbeddingProvider | UniXcoder | Local, structural-aware |
| OpenAIEmbeddingProvider | text-embedding-3-large | API-based, general purpose |
| VoyageCodeEmbeddingProvider | voyage-code-3 | API-based, code-optimized |

---

## 5. Sync Inventory

### 5.1 Parse layer syncs

#### ParseOnChangeSync [required]

```
sync ParseOnChangeSync [eager]
when {
  ContentStorage/store: [ node: ?node ] => [ ]
}
where {
  FileArtifact: { ?node role: ?role }
  LanguageGrammar/resolve: [ file_extension: ?ext ] => [ grammar: ?grammar ]
}
then {
  SyntaxTree/parse: [ file: ?node; grammar: ?grammar ]
}
```

Triggers: any file write. Resolves grammar by extension, triggers parse. If no grammar found, file is indexed as unstructured text only.

#### FileArtifactRegistrationSync [required]

```
sync FileArtifactRegistrationSync [eager]
when {
  ContentStorage/store: [ node: ?node ] => [ ]
}
then {
  FileArtifact/register: [ node: ?node; role: ?inferred_role; language: ?inferred_lang ]
}
```

Infers role (source/generated/config/spec/doc/test) and language from file path and extension.

#### DefinitionExtractionSync [recommended]

```
sync DefinitionExtractionSync [eager]
when {
  SyntaxTree/parse: [ ] => [ tree: ?tree ]
}
then {
  DefinitionUnit/extract: [ tree: ?tree; node_range: ?ranges ]
}
```

Walks the tree to find definition-level nodes and creates DefinitionUnit instances.

#### ContentDigestSync [recommended]

```
sync ContentDigestSync [eager]
when {
  DefinitionUnit/extract: [ ] => [ unit: ?unit ]
}
then {
  ContentDigest/compute: [ unit: ?unit; algorithm: "structural-normalized" ]
}
```

### 5.2 Symbol layer syncs

#### SymbolExtractionSync [required]

```
sync SymbolExtractionSync [eager]
when {
  SyntaxTree/parse: [ ] => [ tree: ?tree ]
}
where {
  // Resolve the best available extractor for this file's language
  PluginRegistry: { ?extractor kind: "symbol-extractor"; language: ?tree_lang }
}
then {
  // Provider-dispatched: routes to TypeScriptSymbolExtractor, ConceptSpecSymbolExtractor, etc.
  Symbol/extract_from_tree: [ tree: ?tree; extractor: ?extractor ]
}
```

#### ScopeResolutionSync [recommended]

```
sync ScopeResolutionSync [eager]
when {
  Symbol/extract_from_tree: [ tree: ?tree ] => [ symbols: ?symbols ]
}
then {
  ScopeGraph/build: [ file: ?file; tree: ?tree ]
}
```

After scope graph is built, a secondary sync resolves unresolved references:

#### CrossFileResolutionSync [eventual]

```
sync CrossFileResolutionSync [eventual]
when {
  ScopeGraph/build: [ ] => [ graph: ?graph ]
}
where {
  ScopeGraph: { ?graph references: ?refs }
  filter(?refs has_unresolved: true)
}
then {
  ScopeGraph/resolve_cross_file: [ graph: ?graph ]
}
```

#### SymbolRelationshipSync [recommended]

Maintains SymbolRelationship edges and corresponding Backlink entries:

```
sync SymbolRelationshipSync [eager]
when {
  ScopeGraph/resolve_reference: [ ] => [ symbol: ?ref_symbol ]
}
then {
  SymbolRelationship/add: [ source: ?ref_symbol; target: ?def_symbol; kind: ?rel_kind ]
  Backlink/register: [ source: ?ref_symbol; target: ?def_symbol ]
}
```

### 5.3 Semantic layer syncs

#### SpecSemanticSync [required]

When a `.concept` file is parsed, extract and persist semantic entities:

```
sync SpecSemanticSync [eager]
when {
  SpecParser/parse: [ source: ?source ] => [ ast: ?ast ]
}
then {
  ConceptEntity/register: [ name: ?ast.name; source: ?file; ast: ?ast ]
  // Then for each action in AST:
  ActionEntity/register: [ concept: ?entity; name: ?action.name; params: ?action.params; variant_refs: ?variants ]
  // Then for each state field:
  StateField/register: [ concept: ?entity; name: ?field.name; type_expr: ?field.type ]
}
```

In practice this would be a multi-step sync or a Transform pipeline.

#### SyncSemanticSync [required]

When a `.sync` file is parsed, extract SyncEntity with resolved concept/action references:

```
sync SyncSemanticSync [eager]
when {
  SyncParser/parse: [ source: ?source ] => [ ast: ?sync_ast ]
}
where {
  // Resolve concept references in when/where/then clauses
  ConceptEntity: { ?concept name: ?concept_name }
  ActionEntity: { ?action concept: ?concept; name: ?action_name }
}
then {
  SyncEntity/register: [ name: ?sync_ast.name; source: ?file; compiled: ?compiled ]
}
```

#### FlowGraphSync [recommended]

Rebuilds the static flow graph (stored in Graph) when syncs change:

```
sync FlowGraphSync [eventual]
when {
  SyncEntity/register: [ ] => [ sync: ?sync ]
}
then {
  // Add edges to the flow-graph Graph overlay:
  // For each when-pattern → then-action pair in the sync
  Graph/add_edge: [ graph: "flow-graph"; source: ?trigger_action; target: ?invoked_action; edge_type: "triggers"; via_sync: ?sync ]
}
```

#### GenerationProvenanceSync [required]

When a code generator produces output, record provenance:

```
sync GenerationProvenanceSync [eager]
when {
  Emitter/emit: [ ] => [ output_path: ?path ]
}
where {
  GenerationPlan: { ?plan step: ?step; source_spec: ?spec }
}
then {
  FileArtifact/set_provenance: [ artifact: ?output; spec: ?spec; generator: ?generator ]
  Provenance/record: [ source: ?spec; derived: ?output; method: ?generator ]
}
```

#### TypeBindingResolutionSync [recommended]

When kit.yaml is parsed, resolve type parameter mappings via FieldMapping:

```
sync TypeBindingResolutionSync [eager]
when {
  ContentParser/parse: [ file: ?kit_yaml ] => [ ]
}
where {
  filter(?kit_yaml path_matches: "*/kit.yaml")
}
then {
  // For each concept param mapping in kit.yaml:
  FieldMapping/create: [ source_schema: ?concept_type_param; target_schema: ?kit_shared_type; direction: "bidirectional" ]
}
```

#### InvariantValidationSync [recommended]

When FlowTrace records a completed flow, check against declared invariants via DataQuality:

```
sync InvariantValidationSync [eventual]
when {
  FlowTrace/record: [ ] => [ trace: ?trace ]
}
then {
  DataQuality/check: [ data: ?trace; rules: ?invariant_rules ]
}
```

#### DeadVariantDetectionSync [recommended]

Periodic analysis rule that finds variants no sync matches on:

```
sync DeadVariantDetectionSync [eventual]
when {
  SyncEntity/register: [ ] => [ ]
}
then {
  SyncEntity/find_orphan_variants: [ ]
  // Results feed into AnalysisRule findings
}
```

### 5.4 Analysis layer syncs

#### DependenceComputeSync [recommended]

```
sync DependenceComputeSync [eventual]
when {
  ScopeGraph/build: [ ] => [ graph: ?scope ]
}
then {
  DependenceGraph/compute: [ scope_ref: ?file ]
}
```

#### SearchIndexSync [recommended]

```
sync SearchIndexSync [eventual]
when {
  SyntaxTree/parse: [ ] => [ tree: ?tree ]
}
then {
  SearchIndex/update: [ source: ?file; content: ?text; symbols: ?extracted_symbols ]
}
```

#### EmbeddingSync [recommended]

```
sync EmbeddingSync [eventual]
when {
  DefinitionUnit/extract: [ ] => [ unit: ?unit ]
  ContentDigest/compute: [ ] => [ digest: ?digest ]
}
where {
  // Only recompute if digest changed
  filter(NOT SemanticEmbedding: { ?existing digest: ?digest })
}
then {
  SemanticEmbedding/compute: [ unit: ?unit; model: ?configured_model ]
}
```

---

## 6. Kit Manifests

### 6.1 Parse Kit

```yaml
kit:
  name: parse
  version: 0.1.0
  description: "Universal file parsing, structural identity, and pattern matching"

concepts:
  SyntaxTree:
    spec: ./syntax-tree.concept
    params:
      T: { as: tree-id, description: "Syntax tree identifier" }
  LanguageGrammar:
    spec: ./language-grammar.concept
    params:
      G: { as: grammar-id, description: "Grammar identifier" }
  DefinitionUnit:
    spec: ./definition-unit.concept
    params:
      D: { as: definition-id, description: "Definition identifier" }
  ContentDigest:
    spec: ./content-digest.concept
    params:
      H: { as: digest-id, description: "Digest identifier" }
  StructuralPattern:
    spec: ./structural-pattern.concept
    params:
      P: { as: pattern-id, description: "Pattern identifier" }
  FileArtifact:
    spec: ./file-artifact.concept
    params:
      F: { as: artifact-id, description: "File artifact identifier" }

  # Grammar providers (optional plugins)
  TreeSitterTypeScript:
    spec: ./providers/grammars/typescript.concept
    optional: true
  TreeSitterRust:
    spec: ./providers/grammars/rust.concept
    optional: true
  TreeSitterPython:
    spec: ./providers/grammars/python.concept
    optional: true
  TreeSitterJson:
    spec: ./providers/grammars/json.concept
    optional: true
  TreeSitterYaml:
    spec: ./providers/grammars/yaml.concept
    optional: true
  TreeSitterConceptSpec:
    spec: ./providers/grammars/concept-spec.concept
    optional: true
  TreeSitterSyncSpec:
    spec: ./providers/grammars/sync-spec.concept
    optional: true

  # Pattern engine providers
  TreeSitterQueryProvider:
    spec: ./providers/patterns/tree-sitter-query.concept
    optional: true
  AstGrepProvider:
    spec: ./providers/patterns/ast-grep.concept
    optional: true
  CombyProvider:
    spec: ./providers/patterns/comby.concept
    optional: true

syncs:
  required:
    - ParseOnChangeSync
    - FileArtifactRegistrationSync
  recommended:
    - DefinitionExtractionSync
    - ContentDigestSync
  integration: []

uses:
  - kit: foundation
    concepts:
      - name: ContentNode
      - name: ContentParser
      - name: ContentStorage
  - kit: generation
    concepts:
      - name: Resource
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
```

### 6.2 Symbol Kit

```yaml
kit:
  name: symbol
  version: 0.1.0
  description: "Cross-file identity, occurrence tracking, scope resolution, and semantic relationships"

concepts:
  Symbol:
    spec: ./symbol.concept
    params:
      S: { as: symbol-id, description: "Symbol identifier" }
  SymbolOccurrence:
    spec: ./symbol-occurrence.concept
    params:
      O: { as: occurrence-id, description: "Occurrence identifier" }
  ScopeGraph:
    spec: ./scope-graph.concept
    params:
      C: { as: scope-graph-id, description: "Scope graph identifier" }
  SymbolRelationship:
    spec: ./symbol-relationship.concept
    params:
      R: { as: relationship-id, description: "Relationship identifier" }

  # Symbol extractor providers
  TypeScriptSymbolExtractor:
    spec: ./providers/extractors/typescript.concept
    optional: true
  RustSymbolExtractor:
    spec: ./providers/extractors/rust.concept
    optional: true
  ConceptSpecSymbolExtractor:
    spec: ./providers/extractors/concept-spec.concept
    optional: true
  SyncSpecSymbolExtractor:
    spec: ./providers/extractors/sync-spec.concept
    optional: true
  UniversalTreeSitterExtractor:
    spec: ./providers/extractors/universal.concept
    optional: true

  # Scope providers
  TypeScriptScopeProvider:
    spec: ./providers/scope/typescript.concept
    optional: true
  ConceptScopeProvider:
    spec: ./providers/scope/concept.concept
    optional: true
  SyncScopeProvider:
    spec: ./providers/scope/sync.concept
    optional: true

syncs:
  required:
    - SymbolExtractionSync
  recommended:
    - ScopeResolutionSync
    - CrossFileResolutionSync
    - SymbolRelationshipSync
  integration: []

uses:
  - kit: parse
    concepts:
      - name: SyntaxTree
      - name: LanguageGrammar
      - name: FileArtifact
  - kit: linking
    concepts:
      - name: Reference
      - name: Relation
      - name: Backlink
  - kit: classification
    concepts:
      - name: Namespace
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
```

### 6.3 Semantic Kit

```yaml
kit:
  name: semantic
  version: 0.1.0
  description: "COPF-specific semantic entities — concepts, actions, variants, syncs, state fields"

concepts:
  ConceptEntity:
    spec: ./concept-entity.concept
    params:
      E: { as: concept-entity-id, description: "Concept entity identifier" }
  ActionEntity:
    spec: ./action-entity.concept
    params:
      A: { as: action-entity-id, description: "Action entity identifier" }
  VariantEntity:
    spec: ./variant-entity.concept
    params:
      V: { as: variant-entity-id, description: "Variant entity identifier" }
  StateField:
    spec: ./state-field.concept
    params:
      L: { as: state-field-id, description: "State field identifier" }
  SyncEntity:
    spec: ./sync-entity.concept
    params:
      Y: { as: sync-entity-id, description: "Sync entity identifier" }

syncs:
  required:
    - SpecSemanticSync
    - SyncSemanticSync
    - GenerationProvenanceSync
  recommended:
    - FlowGraphSync
    - TypeBindingResolutionSync
    - InvariantValidationSync
    - DeadVariantDetectionSync
  integration: []

uses:
  - kit: parse
    concepts:
      - name: SyntaxTree
      - name: FileArtifact
  - kit: symbol
    concepts:
      - name: Symbol
      - name: SymbolOccurrence
      - name: SymbolRelationship
  - kit: data-integration
    concepts:
      - name: Transform
      - name: Enricher
      - name: FieldMapping
      - name: DataQuality
      - name: Provenance
  - kit: data-organization
    concepts:
      - name: Graph
  - kit: generation
    concepts:
      - name: GenerationPlan
      - name: Emitter
```

### 6.4 Analysis Kit

```yaml
kit:
  name: analysis
  version: 0.1.0
  description: "Program analysis overlays — dependence, data flow, slicing, custom rules"

concepts:
  DependenceGraph:
    spec: ./dependence-graph.concept
    params:
      N: { as: dep-graph-id, description: "Dependence graph identifier" }
  DataFlowPath:
    spec: ./data-flow-path.concept
    params:
      W: { as: flow-path-id, description: "Flow path identifier" }
  ProgramSlice:
    spec: ./program-slice.concept
    params:
      Z: { as: slice-id, description: "Slice identifier" }
  AnalysisRule:
    spec: ./analysis-rule.concept
    params:
      U: { as: rule-id, description: "Rule identifier" }

  # Dependence providers
  TypeScriptDependenceProvider:
    spec: ./providers/dependence/typescript.concept
    optional: true
  ConceptDependenceProvider:
    spec: ./providers/dependence/concept.concept
    optional: true
  SyncDependenceProvider:
    spec: ./providers/dependence/sync.concept
    optional: true
  DatalogDependenceProvider:
    spec: ./providers/dependence/datalog.concept
    optional: true
  UniversalTreeSitterDependenceProvider:
    spec: ./providers/dependence/universal.concept
    optional: true

  # Analysis engine providers
  DatalogAnalysisProvider:
    spec: ./providers/analysis-engines/datalog.concept
    optional: true
  GraphTraversalAnalysisProvider:
    spec: ./providers/analysis-engines/graph-traversal.concept
    optional: true
  PatternMatchAnalysisProvider:
    spec: ./providers/analysis-engines/pattern-match.concept
    optional: true

syncs:
  required: []
  recommended:
    - DependenceComputeSync
  integration: []

uses:
  - kit: parse
    concepts:
      - name: SyntaxTree
      - name: FileArtifact
      - name: StructuralPattern
  - kit: symbol
    concepts:
      - name: Symbol
      - name: SymbolOccurrence
      - name: ScopeGraph
  - kit: semantic
    concepts:
      - name: ConceptEntity
      - name: ActionEntity
      - name: SyncEntity
  - kit: data-organization
    concepts:
      - name: Graph
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
```

### 6.5 Discovery Kit

```yaml
kit:
  name: discovery
  version: 0.1.0
  description: "Search, embedding, and indexing across all project entities"

concepts:
  SemanticEmbedding:
    spec: ./semantic-embedding.concept
    params:
      B: { as: embedding-id, description: "Embedding identifier" }

  # Embedding model providers
  CodeBERTEmbeddingProvider:
    spec: ./providers/embedding/codebert.concept
    optional: true
  OpenAIEmbeddingProvider:
    spec: ./providers/embedding/openai.concept
    optional: true
  VoyageCodeEmbeddingProvider:
    spec: ./providers/embedding/voyage.concept
    optional: true

  # Search index providers (register with SearchIndex)
  TrigramIndexProvider:
    spec: ./providers/search/trigram.concept
    optional: true
  SuffixArrayIndexProvider:
    spec: ./providers/search/suffix-array.concept
    optional: true
  SymbolIndexProvider:
    spec: ./providers/search/symbol-index.concept
    optional: true

syncs:
  required: []
  recommended:
    - SearchIndexSync
    - EmbeddingSync
  integration: []

uses:
  - kit: parse
    concepts:
      - name: DefinitionUnit
      - name: ContentDigest
  - kit: symbol
    concepts:
      - name: Symbol
  - kit: query-retrieval
    concepts:
      - name: SearchIndex
      - name: Query
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
```

---

## 7. CLI Updates

### 7.1 New commands

Add to `tools/copf-cli/`:

```
copf symbols <subcommand>
  copf symbols list [--kind <kind>] [--file <path>] [--namespace <ns>]
  copf symbols resolve <symbol-string>
  copf symbols references <symbol-string> [--role definition|reference|import]
  copf symbols rename <symbol-string> <new-name> [--dry-run]

copf query <subcommand>
  copf query flow <concept/action> [--variant <tag>] [--depth <n>]
    # Traces the static sync chain from an action
  copf query impact <file-or-symbol> [--depth <n>]
    # Shows what would be affected by a change
  copf query dead-variants
    # Lists variants no sync pattern-matches on
  copf query dead-syncs
    # Lists syncs whose when-patterns can never fire
  copf query generated-from <spec-file>
    # Lists all files generated from a spec
  copf query depends-on <symbol-string>
    # Lists all symbols this one depends on
  copf query depended-by <symbol-string>
    # Lists all symbols that depend on this one

copf search <subcommand>
  copf search text <query> [--regex] [--file-pattern <glob>]
  copf search structural <pattern> [--syntax ast-grep|comby|tree-sitter] [--language <lang>]
  copf search semantic <natural-language-query> [--top-k <n>]

copf analyze <subcommand>
  copf analyze rules [--category <cat>] [--severity <sev>]
    # Run all matching analysis rules
  copf analyze slice <symbol-string> [--direction forward|backward]
  copf analyze flow <source-symbol> <sink-symbol>
    # Trace data flow paths between two symbols
  copf analyze invariants [--concept <name>]
    # Check invariant coverage

copf inspect <subcommand>
  copf inspect tree <file> [--node-at <line:col>] [--query <s-expr>]
    # Show syntax tree for a file
  copf inspect concept <name>
    # Show full semantic breakdown of a concept
  copf inspect sync <name>
    # Show sync's resolved when/where/then with concept/action refs
  copf inspect file <path>
    # Show file artifact metadata, symbols defined, provenance
```

### 7.2 Updates to existing commands

```
copf check
  # Existing patterns:
  --pattern async-gate
  # New patterns:
  --pattern dead-variants          # variants no sync matches
  --pattern dead-syncs             # syncs that can never fire
  --pattern orphan-state-fields    # state fields with no sync read/write
  --pattern missing-error-handling # actions with error variants but no sync on them
  --pattern circular-sync-chains   # sync chains that loop
  --pattern unused-type-params     # type params never mapped in any kit
  --pattern invariant-coverage     # invariants without test or runtime validation

copf trace
  # Existing:
  --gates
  # New:
  --static                         # trace static flow graph instead of runtime
  --from <concept/action>          # starting point for static trace
  --variant <tag>                  # filter to specific variant paths

copf generate
  # New flag:
  --with-provenance                # emit Provenance records linking specs to outputs
  --with-symbols                   # emit Symbol + SymbolOccurrence data in generated files

copf impact <file-or-symbol>
  # New top-level command (alias for copf query impact)
  # Shows affected files, concepts, syncs, generated artifacts
```

### 7.3 DevServer integration

The DevServer concept gains new hot-reload behaviors:

- On `.concept` file save → reparse → update ConceptEntity/ActionEntity/VariantEntity/StateField → rebuild affected FlowGraph edges → re-run affected AnalysisRules
- On `.sync` file save → reparse → update SyncEntity → rebuild FlowGraph → check for newly dead variants
- On generated file manual edit → warn that file is generated (via FileArtifact role + Provenance) and suggest editing the source spec instead
- Symbol rename refactoring across files via `copf symbols rename`

---

## 8. Interface Kit Updates

### 8.1 New interface targets

The Interface Kit's provider pattern extends to expose semantic query capabilities:

#### McpTarget additions

The existing McpTarget gains new tools exposed via MCP:

```
tools:
  - copf_symbols_resolve: Resolve a symbol string to its definition
  - copf_symbols_references: Find all references to a symbol
  - copf_query_flow: Trace sync chain from an action
  - copf_query_impact: Impact analysis for a change
  - copf_search_structural: Structural code search
  - copf_search_semantic: Natural language code search
  - copf_inspect_concept: Full concept semantic breakdown
  - copf_inspect_sync: Resolved sync with concept/action refs
  - copf_analyze_rules: Run analysis rules
```

#### ClaudeSkillsTarget additions

New Claude Skills that leverage the semantic layer:

```
skills:
  - copf-code-navigator:
      description: "Navigate COPF project structure semantically"
      tools: [symbols_resolve, symbols_references, query_flow, inspect_concept, inspect_sync]

  - copf-impact-analyzer:
      description: "Analyze impact of proposed changes"
      tools: [query_impact, analyze_slice, query_depends_on, query_depended_by]

  - copf-code-search:
      description: "Search project code by structure, text, or natural language"
      tools: [search_text, search_structural, search_semantic]

  - copf-spec-writer:
      description: "Write and validate concept/sync specs with semantic awareness"
      tools: [inspect_concept, query_dead_variants, analyze_invariants, check_compatibility]
```

#### CliTarget additions

All new `copf` subcommands from Section 7 are generated by the CliTarget from the semantic entities' action signatures.

### 8.2 Existing target impact

REST, GraphQL, and gRPC targets automatically gain endpoints for new concept actions through the standard Interface Kit generation pipeline. No manual updates needed — the M+N pattern handles this.

---

## 9. Concept Library Version Update

This design adds:

- **15 new concepts** (SyntaxTree, LanguageGrammar, DefinitionUnit, ContentDigest, StructuralPattern, FileArtifact, Symbol, SymbolOccurrence, ScopeGraph, SymbolRelationship, ConceptEntity, ActionEntity, VariantEntity, StateField, SyncEntity) + DependenceGraph, DataFlowPath, ProgramSlice, AnalysisRule, SemanticEmbedding = **20 new coordination concepts**
- **~35 provider concepts** across all kits (grammars, extractors, scope providers, dependence providers, pattern engines, analysis engines, embedding models, search backends)
- **5 new kits** (Parse, Symbol, Semantic, Analysis, Discovery)
- **~18 new syncs** across all kits

Updated library count: 54 existing + 20 new coordination + ~35 providers = **~109 concepts, 20 kits**

Concept library version: **v0.5.0** (from v0.4.0)

---

## 10. Implementation Phases

### Phase 1: Parse Foundation (v0.19.0)

**Goal**: Every file in a COPF project has a lossless syntax tree.

**Deliverables**:
1. Parse Kit with SyntaxTree, LanguageGrammar, FileArtifact concepts
2. Tree-sitter WASM integration for TypeScript, JSON, YAML
3. Custom Tree-sitter grammars for `.concept` and `.sync` file formats
4. ParseOnChangeSync and FileArtifactRegistrationSync
5. PluginRegistry integration for grammar providers
6. `copf inspect tree <file>` CLI command
7. Conformance tests for all three concepts

**Dependencies**: Foundation Kit (ContentNode, ContentParser, ContentStorage), Generation Kit (Resource), Infrastructure Kit (PluginRegistry)

**Validation**: Parse every file in the RealWorld benchmark project; verify round-trip fidelity (tree → text matches source); verify incremental reparse on edit.

### Phase 2: Symbol Identity (v0.20.0)

**Goal**: Every named entity in the project has a globally unique Symbol with tracked occurrences.

**Deliverables**:
1. Symbol Kit with Symbol, SymbolOccurrence, SymbolRelationship concepts
2. ConceptSpecSymbolExtractor and SyncSpecSymbolExtractor providers
3. UniversalTreeSitterExtractor fallback provider
4. TypeScriptSymbolExtractor provider (primary language)
5. SymbolExtractionSync
6. SymbolRelationshipSync with Backlink integration
7. `copf symbols` CLI commands (list, resolve, references)
8. Namespace scheme registration for COPF symbol strings

**Dependencies**: Phase 1 (SyntaxTree, LanguageGrammar, FileArtifact), Linking Kit (Reference, Relation, Backlink), Classification Kit (Namespace)

**Validation**: For the RealWorld benchmark, verify every concept name, action name, variant tag, state field, and sync name has a Symbol; verify cross-file references from syncs to concepts resolve correctly; verify `copf symbols references User/register` returns all sync when-patterns that reference it.

### Phase 3: Semantic Entities (v0.21.0)

**Goal**: COPF-specific semantic structure is queryable as first-class entities.

**Deliverables**:
1. Semantic Kit with ConceptEntity, ActionEntity, VariantEntity, StateField, SyncEntity concepts
2. SpecSemanticSync and SyncSemanticSync
3. FlowGraph population via Graph (static sync chain graph)
4. GenerationProvenanceSync using Provenance
5. TypeBindingResolutionSync using FieldMapping
6. DeadVariantDetectionSync
7. `copf inspect concept`, `copf inspect sync` CLI commands
8. `copf query flow`, `copf query dead-variants` CLI commands
9. `copf check --pattern dead-variants`, `--pattern missing-error-handling`

**Dependencies**: Phase 2 (Symbol, SymbolOccurrence, SymbolRelationship), Data Integration Kit (Transform, Enricher, FieldMapping, DataQuality, Provenance), Data Organization Kit (Graph), Generation Kit (GenerationPlan, Emitter)

**Validation**: For the RealWorld benchmark, verify the complete registration flow (`User/register → Password/set → JWT/generate`) is captured in the flow graph; verify `copf query flow User/register` returns the full chain; verify `copf query dead-variants` correctly identifies any unmatched variants; verify `copf query generated-from specs/app/user.concept` returns all generated handler files.

### Phase 4: Scope Resolution & Cross-File Linking (v0.22.0)

**Goal**: Full cross-file name resolution and dependency tracking.

**Deliverables**:
1. ScopeGraph concept and providers (ConceptScopeProvider, SyncScopeProvider, TypeScriptScopeProvider)
2. ScopeResolutionSync and CrossFileResolutionSync
3. DefinitionUnit and ContentDigest concepts
4. DefinitionExtractionSync, ContentDigestSync
5. `copf symbols rename` with cross-file refactoring
6. `copf query depends-on`, `copf query depended-by` CLI commands
7. `copf impact` top-level command

**Dependencies**: Phases 1-3, PluginRegistry for scope providers

**Validation**: Verify that renaming a concept in a `.concept` file propagates to all `.sync` files that reference it (in dry-run mode); verify impact analysis from a state field change correctly identifies affected generated files.

### Phase 5: Analysis Overlays (v0.23.0)

**Goal**: Computed analysis graphs enable impact analysis, slicing, and data flow tracing.

**Deliverables**:
1. Analysis Kit with DependenceGraph, DataFlowPath, ProgramSlice, AnalysisRule concepts
2. ConceptDependenceProvider and SyncDependenceProvider
3. DependenceComputeSync
4. InvariantValidationSync using DataQuality
5. `copf analyze` CLI commands (rules, slice, flow, invariants)
6. `copf check --pattern circular-sync-chains`, `--pattern invariant-coverage`
7. Built-in analysis rules for common COPF patterns

**Dependencies**: Phases 1-4, Data Integration Kit (DataQuality)

**Validation**: Forward slice from a concept state field change; backward slice from a runtime error to contributing config values; verify circular sync chain detection on intentionally circular test case.

### Phase 6: Search & Discovery (v0.24.0)

**Goal**: Text, structural, and semantic search across the entire project.

**Deliverables**:
1. Discovery Kit with SemanticEmbedding concept
2. StructuralPattern concept and providers (AstGrepProvider, CombyProvider, TreeSitterQueryProvider)
3. TrigramIndexProvider and SymbolIndexProvider for SearchIndex
4. SearchIndexSync, EmbeddingSync
5. `copf search` CLI commands (text, structural, semantic)
6. MCP tools for all search capabilities
7. Claude Skills for code navigation, impact analysis, code search, spec writing

**Dependencies**: Phases 1-5, Query/Retrieval Kit (SearchIndex, Query)

**Validation**: Structural search for all functions matching a pattern; natural language search "find actions that handle authentication"; text search with trigram pre-filtering performance benchmarks.

### Phase 7: Interface Exposure & DevServer (v0.25.0)

**Goal**: All semantic query capabilities exposed through all interface targets; DevServer integration.

**Deliverables**:
1. McpTarget additions for semantic query tools
2. ClaudeSkillsTarget skill definitions
3. CliTarget generation for all new commands
4. REST/GraphQL/gRPC endpoint generation for semantic entities
5. DevServer hot-reload integration with semantic layer
6. Generated-file-edit warning system
7. End-to-end integration tests

**Dependencies**: All previous phases, Interface Kit

**Validation**: Full round-trip: edit a `.concept` spec → DevServer detects change → reparses → updates semantic entities → rebuilds flow graph → regenerates affected code → updates search index → semantic query via MCP returns correct results.

---

## 11. Architecture Doc Version Update

This design corresponds to architecture doc section additions covering:

- Section X.1: Parse Layer — universal file parsing via Tree-sitter
- Section X.2: Symbol Layer — cross-file identity and scope resolution  
- Section X.3: Semantic Layer — COPF domain entities as queryable nodes
- Section X.4: Analysis Layer — dependence graphs, slicing, data flow
- Section X.5: Discovery Layer — search and embedding
- Section X.6: Provider patterns for language extensibility
- Section X.7: Data Integration Kit reuse patterns (Transform, Enricher, FieldMapping, DataQuality, Provenance)

Architecture doc version: **0.25.0** after Phase 7 completion (from current 0.18.0, with phases 0.19.0 through 0.25.0 mapped to implementation phases above).
