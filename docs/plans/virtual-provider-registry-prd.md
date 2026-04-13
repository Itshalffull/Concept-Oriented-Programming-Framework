# PRD: Virtual Provider Registry

## Status: Draft
## Authors: 2026-04-13
## Depends on:
- Completed: Block Editor Loose Ends (MAG-794) — ships Parse, Format, Highlight, ContentSerializer concepts and their per-language registration syncs
- Existing: PluginRegistry concept (already used as slot registry for widget/panel registration)

---

## 1. Problem Statement

Block Editor Loose Ends landed four concept registries (Parse, Format, Highlight, ContentSerializer) with hand-written per-provider registration syncs — ~28 sync files before we've added a single new language.

Two failure modes at scale:
1. **Per-language sync-file overhead.** Shiki alone supports 100+ languages; writing a sync per language turns config into code.
2. **Reinvention drift.** Every language we cover is already covered by a mature ecosystem — tree-sitter (parsing), TextMate grammars (highlighting), Prettier (formatting), LSP (format-on-save), shiki (tokenization). If our provider layer speaks a Clef-specific vocabulary, we maintain translation layers forever and re-solve what the ecosystem already solved.

### The core idea: connect, don't reinvent

Clef's Parse/Format/Highlight/ContentSerializer concepts are the abstract interfaces. The providers plugged into them should be **thin adapters over existing industry-standard formats**, not bespoke Clef implementations. Specifically:

| Ecosystem standard | Clef adapter | Coverage unlocked |
|---|---|---|
| Tree-sitter grammars (.wasm + node_modules) | `tree-sitter` Parse provider | 100+ languages via published grammar packages |
| TextMate grammars (.tmLanguage.json) | `textmate` Highlight provider | Every VSCode-supported language |
| Shiki (TextMate + themes) | `shiki` Highlight provider (already have) | 100+ languages with themeable output |
| Prettier plugins (npm packages) | `prettier` Format provider | js/ts/json/css/html/markdown/solidity/java/... |
| LSP servers (format/diagnostics endpoints) | `lsp` Format + Highlight provider | Any language with a language server |
| .editorconfig | Applied as manifest overlay | Tab width, line endings, charset — standard |
| Prettier config files (.prettierrc, etc.) | Passed through as `options` to prettier provider | Prettier's existing config semantics, unchanged |

Once the adapters exist, adding a new language is always "add an entry to `.clef/providers.yaml` pointing at the already-published grammar/plugin/server." We never write a Clef-specific parser for a language that already has a tree-sitter grammar.

### The architecture: three-layer registration

The manifest format itself is pluggable. Users shouldn't have to migrate `.prettierrc` / `.editorconfig` / `package.json` language settings into a Clef-specific yaml just to get provider registrations — those files already describe what they want.

```
  ManifestReader registry      ← format adapters (yaml, prettier, editorconfig, vscode, ...)
        ↓ normalized entries
  ProviderManifest             ← aggregator; emits PluginRegistry/register per entry
        ↓ PluginRegistry/register
  4 generic syncs              ← type-filtered fan-out
        ↓ <Concept>/register
  Parse / Format / Highlight / ContentSerializer
```

**Layer A — ManifestReader [R]** registers format adapters. Each reader translates an external config format into normalized `{kind, slot, provider, options}` entries:

| Reader | Source file(s) | Translates to |
|---|---|---|
| `clef-yaml` | `.clef/providers.yaml` | Native Clef manifest (1:1) |
| `clef-json` | `.clef/providers.json` | Same schema, JSON |
| `prettier-config` | `.prettierrc*`, `prettier.config.js`, `prettier` in `package.json` | Format entries with prettier's config shape as `options` |
| `editorconfig` | `.editorconfig` | Format option overlays (tab width, EOL, charset) on matching slots |
| `package-json` | `package.json` | Reads `clef`, `prettier`, `shiki`, `eslint` fields |
| `vscode-settings` | `.vscode/settings.json` | Language-specific settings (`[typescript]`, `[rust]`) as slot options |
| `vscode-extension` | Installed extension `package.json` `contributes.{languages,grammars}` | TextMate grammars → Highlight entries; language IDs → Parse hints |
| `tree-sitter` | `node_modules/tree-sitter-*/package.json` with `tree-sitter` field | Auto-register each grammar as a `tree-sitter` Parse entry |

**Layer B — ProviderManifest [M]** loads the configured list of readers in priority order, collects their normalized entries, deduplicates (later-priority reader wins on slot collision, same semantics as `.editorconfig`'s precedence), and emits one `PluginRegistry/register` per entry.

**Layer C — four generic syncs** dispatch `PluginRegistry/register` to `Parse/register`, `Format/register`, `Highlight/register`, `ContentSerializer/register` by filtering on `type`.

### Why this shape

- **Zero-config onboarding.** A project with existing `.prettierrc` + `.editorconfig` + `node_modules/tree-sitter-typescript` boots with working Parse + Format for TypeScript without any Clef manifest written.
- **Ecosystem tracking is free.** A new shiki release supporting Elixir lands; manifest entry for `elixir` slot appears; no code change in Clef. A new tree-sitter grammar published to npm; the `tree-sitter` reader finds it in `node_modules` on next boot; registered automatically.
- **New *kinds* of config source = one reader.** Biome supports a new config format → one ManifestReader adapter. LSP servers announce formatters via the LSP `textDocument/formatting` capability → one reader queries running servers and registers them as Format providers.
- **Nothing in the core changes.** Adding a language is config; adding a config format is one adapter module; neither touches the generic syncs or the target concepts.

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

### 3.1 New concepts (2)

| Concept | Purpose | Actions |
|---|---|---|
| `ManifestReader [R]` | Registry of format-specific config readers | `register(reader, formats)`, `read(path) -> entries`, `listReaders()` |
| `ProviderManifest [M]` | Aggregate entries across readers; emit PluginRegistry/register | `load(sources)`, `reload()`, `listEntries()` |

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

### 4.8 Composable provider extensions

Entry schema supports `extensions: [...]` per row. The provider module knows how to compose its extensions; the manifest/registry are transparent pass-through.

This matches how the ecosystem actually ships Parse/Highlight/Format capability:
- **micromark/remark/rehype** — `extensions: [gfm, callout, math, ...]`
- **shiki** — grammar injections + embedded languages
- **tree-sitter** — combined highlight queries + language injections
- **prettier** — `plugins: [...]`

One concrete consequence: the 3 callout providers from Block Editor Loose Ends (LE-06) should be refactored into **micromark extensions** rather than standalone distinct-language Parse providers. One `markdown` slot, three optional extensions in `options`. Consumers of markdown parsing (smart-paste, etc.) make one call; the active extension set is determined by manifest/config, not by picking a language slot.

Providers that don't support extensions (katex-parse, domparser-parse) ignore the field. No opt-in ceremony.

### 4.9 rustfmt / swift-format subprocess vs wasm

Prefer wasm where available (rustfmt has wasm builds); fall back to subprocess if the user's environment has the toolchain. Both paths return a Patch via the same line-diff pipeline as prettier-format.

---

## 5. Phasing

### Phase 1 — Core concepts + generic syncs (3 cards)

1. `ManifestReader` + `ProviderManifest` concepts + handlers + conformance tests
2. Four generic forward syncs (`RegisterParseProviderFromPluginRegistry` + 3 parallel for Highlight/Format/ContentSerializer)
3. Four generic reverse syncs (PluginRegistry/remove → <Concept>/deregister)

### Phase 2 — Native ManifestReader + adapters for existing standards (5 cards)

4. `clef-yaml` + `clef-json` readers (native Clef manifest format)
5. `prettier-config` reader (`.prettierrc*`, `prettier.config.js`, `package.json` prettier field)
6. `editorconfig` reader (`.editorconfig` → Format option overlays)
7. `vscode-settings` + `vscode-extension` readers (language settings + contributed grammars)
8. `tree-sitter` reader (auto-discover `node_modules/tree-sitter-*` packages)

### Phase 3 — Clef DSL parsers + highlighter (2 cards)

9. `clef-framework-parse` meta-provider wrapping the 5 framework parsers; one language slot each
10. `clef-dsl-highlight` meta-provider emitting token annotations from the 5 framework parsers' ASTs

### Phase 4 — Generic provider adapters (3 cards)

11. `tree-sitter` Parse adapter (consumes wasm grammars from `node_modules` or manifest-declared paths)
12. `textmate` Highlight adapter (consumes `.tmLanguage.json` from VSCode extensions / manifest-declared paths)
13. `lsp` Format + Highlight adapter (delegates to a running LSP server via `textDocument/formatting` and semantic tokens)

### Phase 5 — Default manifest + retirement (2 cards)

14. Write `clef-base/config/providers.yaml` covering Clef DSLs + broad shiki language set + the codegen targets; configure default reader priority list (`clef-yaml` > `prettier-config` > `editorconfig` > `package-json` > `tree-sitter` auto-discovery)
15. Delete the ~28 per-language registration syncs and verify the manifest-driven path produces equivalent PluginRegistry state (behavioral conformance test)

### Phase 6 — Codegen-target Format providers (3 cards)

16. prettier-plugin-solidity Format provider + manifest entry
17. rustfmt Format provider (wasm preferred, subprocess fallback) + manifest entry
18. swift-format Format provider (subprocess) + manifest entry

### Phase 7 — Reload + file watch (1 card)

19. `ProviderManifest/reload()` with diff semantics + dev-mode file watcher integration (watches every file any registered reader declared interest in)

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

20 cards under epic MAG-817 "Virtual Provider Registry". All shipped 2026-04-13.

| Card | Title | Commit |
|---|---|---|
| VPR-01 | ManifestReader + ProviderManifest concepts + handlers | 0ef9b245 |
| VPR-02 | Four generic forward registration syncs | a094e44f |
| VPR-03 | Reverse syncs + deregister actions + PluginRegistry/remove | 0cd211e6 |
| VPR-04 | clef-yaml + clef-json ManifestReaders | 8077b56b |
| VPR-05 | prettier-config ManifestReader | 8d170fd6 |
| VPR-06 | editorconfig ManifestReader | 5403e47b |
| VPR-07 | vscode-settings + vscode-extension ManifestReaders | ca931e46 |
| VPR-08 | tree-sitter auto-discover ManifestReader | e93250e4 |
| VPR-09 | clef-framework-parse meta-provider (5 DSLs) | ff91311a |
| VPR-10 | clef-dsl-highlight meta-provider (5 DSLs) | db72f923 |
| VPR-11 | tree-sitter generic Parse adapter | d546343c |
| VPR-12 | textmate generic Highlight adapter | 3a025bd9 |
| VPR-13 | LSP Format + Highlight adapter | 33965592 |
| VPR-14 | Default .clef/providers.yaml + InputRule migration | a6904bbd |
| VPR-15 | Retire per-language registration syncs | 4f373f87 |
| VPR-16 | prettier-plugin-solidity Format provider | d5a2213e |
| VPR-17 | rustfmt Format provider (wasm + subprocess) | 5403e47b |
| VPR-18 | swift-format Format provider | b52946e1 |
| VPR-19 | ProviderManifest/reload diff semantics + file watcher | 8995cd52 |
| VPR-20 | Refactor callout providers into micromark extensions | 13ff5cfa |
