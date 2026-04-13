# PRD: Virtual Provider Registry

## Status: Draft
## Authors: 2026-04-13
## Depends on:
- Completed: Block Editor Loose Ends (MAG-794) — ships Parse, Format, Highlight, ContentSerializer concepts and their per-language registration syncs
- Existing: PluginRegistry concept (already used as slot registry for widget/panel registration)

---

## 1. Problem Statement

Block Editor Loose Ends landed four concept registries (Parse, Format, Highlight, ContentSerializer) with hand-written per-provider registration syncs: 1 for micromark-parse, 3 for callouts, 1 each for katex-parse/domparser-parse, 5 for prettier (one per language), 1 for micromark-format, 12 for shiki (one per language), 1 for katex-highlight, 3 for ContentSerializer md/html/json, 1 for pdf. That's ~28 sync files before we've added a single new language.

The Clef ecosystem needs coverage well beyond that:
- **Clef DSLs** — `.concept`, `.sync`, `.derived`, `.widget`, `.theme` have no Parse or Highlight providers despite shipping framework parsers that already produce ASTs (`handlers/ts/framework/*-parser.ts`)
- **Codegen targets** — Solidity, Swift, Rust, Go, Python, Kotlin, C# all ship as codegen outputs but only a subset get syntax coloring
- **User code** — any language a user's code-block holds should get highlighting; shiki alone supports 100+ grammars and adding each as a sync is absurd

The right shape: a **ProviderManifest** concept that reads `.clef/providers.yaml` at boot and emits `PluginRegistry/register` calls, plus **four generic sync rules** (one per target concept) that dispatch `PluginRegistry/register` into the concept's `register` action. Adding a new language becomes a config edit, not a code change.

---

## 2. Architecture: Two-Layer Registration

### Layer 1 — Manifest to PluginRegistry

`ProviderManifest [M]` concept reads declarative entries from `.clef/providers.yaml` and emits one `PluginRegistry/register` per entry. The manifest has no knowledge of Parse, Format, Highlight, or ContentSerializer — it only knows about PluginRegistry slots.

```yaml
# .clef/providers.yaml
parse:
  - slot: clef-concept
    provider: clef-framework-parse
    options:
      parserFn: parseConceptFile
  - slot: markdown
    provider: micromark-parse
  - slot: markdown-github-callout
    provider: github-callout-parse
  - slot: latex
    provider: katex-parse
  - slot: html
    provider: domparser-parse

highlight:
  - slot-group: shiki-supported
    provider: shiki
    languages: [typescript, javascript, rust, solidity, swift, go, python,
                sql, bash, yaml, json, html, css, markdown, java, kotlin,
                csharp, cpp, ruby, php]
  - slot-group: clef-dsls
    provider: clef-dsl-highlight
    languages: [clef-concept, clef-sync, clef-widget, clef-theme, clef-derived]
  - slot: latex
    provider: katex-highlight

format:
  - slot-group: prettier-supported
    provider: prettier
    languages: [javascript, typescript, json, css, html, markdown]
  - slot: solidity
    provider: prettier-plugin-solidity
  - slot: rust
    provider: rustfmt
  - slot: swift
    provider: swift-format

content-serializer:
  - slot: markdown
    provider: markdown-serialize
  - slot: html
    provider: html-serialize
  - slot: json
    provider: json-serialize
  - slot: pdf
    provider: pdf-serialize
```

`ProviderManifest/load` on boot walks this file and emits, for each entry:

```
PluginRegistry/register(
  type: "<parse|highlight|format|content-serializer>-provider",
  name: <provider>,
  slot: <slot | per-language slot>,
  options: <remaining entry fields>
)
```

For `slot-group` entries (shiki across 20 languages, prettier across 6), the manifest handler fans out to one `PluginRegistry/register` per language, with `slot: <language>` and the shared provider name.

### Layer 2 — PluginRegistry to target concept

Four generic syncs fire on `PluginRegistry/register` filtered by `type`:

```
sync RegisterParseProviderFromPluginRegistry
  when PluginRegistry/register => ok(type: "parse-provider", name: ?n, slot: ?s, options: ?opts)
  where bind(?opts.config as ?cfg defaulting to "")
  then Parse/register(provider: ?n, language: ?s, config: ?cfg)

sync RegisterHighlightProviderFromPluginRegistry  (parallel shape → Highlight/register)
sync RegisterFormatProviderFromPluginRegistry     (parallel shape → Format/register)
sync RegisterContentSerializerFromPluginRegistry  (parallel shape → ContentSerializer/register)
```

These four syncs replace ~28 hand-written registration syncs and never need to change when new languages are added.

### Runtime extensibility comes free

Because the concept boundary is `PluginRegistry/register`, any code path that dispatches it (manifest loader, UI plugin installer, test setup, agent action) hits the same sync wiring. A plugin adding a new language at runtime calls `PluginRegistry/register(type: "highlight-provider", name: "shiki", slot: "elixir")` and the shiki Highlight provider is live without a reboot. Same with deregistration: `PluginRegistry/remove` fires four parallel deregister syncs.

---

## 3. Scope

### 3.1 New concepts (1)

| Concept | Purpose | Actions |
|---|---|---|
| `ProviderManifest [M]` | Read `.clef/providers.yaml`, fan out to PluginRegistry | `load(path)`, `reload()`, `listEntries()` |

### 3.2 New syncs (4 generic + 4 reverse = 8)

Four forward syncs wiring PluginRegistry/register → concept register.
Four reverse syncs wiring PluginRegistry/remove → concept deregister.

### 3.3 New meta-providers (2)

| Provider | Wraps | Languages |
|---|---|---|
| `clef-framework-parse` | `handlers/ts/framework/{parser,sync-parser,widget-parser,theme-parser,derived-parser}.ts` | clef-concept, clef-sync, clef-widget, clef-theme, clef-derived |
| `clef-dsl-highlight` | AST-walk from the same 5 framework parsers, emits token-kind annotations (keyword/identifier/string/operator/comment) | same 5 Clef DSLs |

### 3.4 Default manifest seed

Ship `clef-base/config/providers.yaml` as the canonical default. Covers:
- 5 Parse providers (markdown, 3 callout dialects, latex, html) + 5 Clef DSL parsers
- Shiki Highlight across ~20 mainstream languages
- clef-dsl-highlight across 5 Clef DSLs
- katex Highlight for latex
- Prettier Format across 6 languages + prettier-plugin-solidity + rustfmt + swift-format
- ContentSerializer providers (md, html, json, pdf)

### 3.5 Retirement of per-language registration syncs

Delete (or migrate to manifest entries only, no sync file):
- `register-micromark-parse.sync`, `register-callout-parsers.sync`, `register-katex-parse.sync`, `register-domparser-parse.sync`
- `register-shiki-highlight.sync` (12 entries collapse to one manifest row)
- `register-katex-highlight.sync`
- `register-prettier-format.sync` (5 entries → one row)
- `register-micromark-format.sync`
- `register-content-serializers.sync`

~28 sync files → 0. Replaced by 4 generic syncs + 1 manifest file.

### 3.6 New Format providers for codegen parity (3)

- `prettier-plugin-solidity` — Format provider for language=solidity
- `rustfmt` — Format provider for language=rust (shells out or uses wasm rustfmt)
- `swift-format` — Format provider for language=swift (shells out)

---

## 4. Design decisions

### 4.1 Manifest location

`.clef/providers.yaml` at project root. Rationale: matches prettier/eslint/tsconfig convention where tool-specific config lives in a dotfile or dot-directory. `.clef/` leaves room for adjacent config (`.clef/deploy.yaml`, `.clef/suites.yaml`) as the platform grows.

### 4.2 Slot naming = language identifier

For Parse/Format/Highlight, `slot` is exactly the `language` field. For ContentSerializer it's `target`. This keeps the manifest schema flat and predictable; no translation layer between slot and concept parameter.

### 4.3 Slot-group is a manifest-level convenience

`slot-group: <name>` + `languages: [...]` expands to N individual `PluginRegistry/register` calls at load time. The registry itself only knows about individual slots. Rationale: writing 20 rows for shiki's language list is noise; the group syntax is pure ergonomics.

### 4.4 Options are provider-opaque

`options` on a manifest entry is passed verbatim to the provider function. Prettier might accept `{ parser: "typescript", semi: false }`; tree-sitter might accept `{ grammar: "typescript.wasm" }`. The PluginRegistry stores it; the concept's `register` action stores it in `config: Bytes`; the provider function deserializes it.

### 4.5 Boot order

`KernelBoot/boot` → `ProviderManifest/load(.clef/providers.yaml)` → N × `PluginRegistry/register` → 4 generic syncs fan out → N × `<Concept>/register` → provider registries are populated before the first user-dispatched Parse/Format/Highlight/serialize call.

If the manifest file is missing, `ProviderManifest/load` returns `ok(entries: 0)` and the platform boots with no providers. Host projects opt in.

### 4.6 Reload semantics

`ProviderManifest/reload()` diffs the current manifest against the loaded set and emits:
- `PluginRegistry/register` for new entries
- `PluginRegistry/remove` for removed entries
- `PluginRegistry/remove` + `PluginRegistry/register` for changed entries (option changes)

The 4 reverse syncs handle deregistration; 4 forward syncs handle re-registration. Dev-mode file watcher can call `reload()` on file change for live iteration.

### 4.7 clef-dsl-highlight output shape

Walks the existing parser's AST and emits `{start, end, kind, scope}` annotations where `kind` is one of `keyword | identifier | string | number | operator | comment | type | attribute`. Matches shiki's output shape so downstream widgets render both uniformly.

### 4.8 rustfmt / swift-format subprocess vs wasm

Prefer wasm where available (rustfmt has wasm builds); fall back to subprocess if the user's environment has the toolchain. Both paths return a Patch via the same line-diff pipeline as prettier-format.

---

## 5. Phasing

### Phase 1 — Core manifest + generic syncs (3 cards)

1. `ProviderManifest` concept + handler + conformance tests
2. Four generic forward syncs (`RegisterParseProviderFromPluginRegistry` + 3 parallel for Highlight/Format/ContentSerializer)
3. Four generic reverse syncs (PluginRegistry/remove → <Concept>/deregister)

### Phase 2 — Clef DSL parsers + highlighter (2 cards)

4. `clef-framework-parse` meta-provider wrapping the 5 framework parsers; each registered under its own language slot
5. `clef-dsl-highlight` meta-provider emitting token annotations from the 5 framework parsers' ASTs

### Phase 3 — Default manifest + retirement (2 cards)

6. Write `clef-base/config/providers.yaml` covering every provider shipped today + Clef DSLs + shiki's broader language set
7. Delete the ~28 per-language registration syncs and verify the manifest-driven path produces equivalent PluginRegistry state (conformance: same providers registered, same languages covered)

### Phase 4 — Codegen-target Format providers (3 cards)

8. prettier-plugin-solidity Format provider + manifest entry
9. rustfmt Format provider (wasm preferred) + manifest entry
10. swift-format Format provider (subprocess) + manifest entry

### Phase 5 — Reload + file watch (1 card)

11. `ProviderManifest/reload()` with diff semantics + dev-mode file watcher integration

---

## 6. Success Criteria

1. `.clef/providers.yaml` is the single source of truth for which providers register under which slots
2. Adding a new shiki-supported language is a one-line manifest edit with no TypeScript/sync changes
3. All 5 Clef DSLs (`.concept`, `.sync`, `.widget`, `.theme`, `.derived`) get syntax highlighting in code-blocks that contain them
4. Deleting the ~28 per-provider syncs produces no change in the PluginRegistry's boot-time state (behavioral equivalence)
5. Runtime `PluginRegistry/register` from a UI plugin installer reaches Parse/register (or the matching concept) without any additional wiring
6. `ProviderManifest/reload()` after a config edit swaps providers without a kernel restart

---

## 7. Non-goals

- **Concept-agnostic plugin framework** — this PRD is scoped to Parse/Format/Highlight/ContentSerializer. PluginRegistry already serves other slot types (editor-panel widgets from LE-21); those stay on their existing paths until a separate migration.
- **Discovering providers at runtime from the filesystem** — the manifest lists providers by id; the provider implementation module must already be imported at kernel boot. Dynamic import from disk is out of scope.
- **Version constraints / capability negotiation** — if two entries claim the same slot, last-write-wins. Conflict resolution via Parse's existing `duplicate` variant is the error surface.
- **User-facing manifest editor UI** — raw yaml is the v1 authoring surface. A settings UI wrapping it is a follow-up.

---

## 8. Open Questions

1. **Manifest schema evolution** — add a top-level `version: 1` field so future schema changes are non-breaking? Lean yes.
2. **Slot-group naming collision** — if two slot-groups list overlapping languages (e.g., both shiki and a custom highlighter claim `javascript`), who wins? Manifest order or explicit priority field? Lean explicit priority, default to manifest order.
3. **Missing optional providers** — if the manifest references `rustfmt` but the rustfmt binary isn't installed, should boot fail, warn, or silently skip? Lean warn + skip so the rest of the manifest still loads.
4. **Watching yaml in production** — dev mode watches for reload; production reads once at boot. Is there a case for runtime hot-reload in prod (feature-flag deploy)? Defer until needed.
5. **clef-dsl-highlight theme mapping** — token kinds are shiki-compatible, but color scopes aren't 1:1. Do we ship a default scope map or rely on the active theme's `clef-dsl-*` tokens? Lean default scope map with theme override.

---

## 9. Card Plan

11 cards under epic "Virtual Provider Registry". See VK breakdown for per-card descriptions and blocking relationships.

Phase ordering:
- Phase 1 blocks Phase 2 (concept + generic syncs before meta-providers can register via them)
- Phase 1 blocks Phase 3 (manifest loader + generic syncs before default manifest can replace per-provider syncs)
- Phase 2 blocks Phase 3 (Clef DSL providers must exist before the default manifest references them)
- Phase 4 is independent — can run in parallel after Phase 1
- Phase 5 is independent after Phase 1
