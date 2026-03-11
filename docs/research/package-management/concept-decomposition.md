# Composable concepts need thirteen independent concerns and three coordination primitives

**The design space for Clef's modular package system is well-mapped by existing theory and practice.** Analysis of 30+ package managers, plugin systems, and academic frameworks reveals that package management decomposes into exactly thirteen independent concerns, that composition requires three distinct coordination mechanisms (declarative syncs, conditional activation, and dependency inversion), and that content-addressed storage is the singular architectural decision that unifies integrity, deduplication, and reproducibility. Daniel Jackson's concept design — the theoretical foundation of Clef — already provides the formal model; what remains is mapping the Repertoire's engineering to proven patterns from Cargo, Nix, pnpm, and Spring Boot.

## Thirteen separable concerns constitute all of package management

Cross-analysis of npm/yarn/pnpm, Cargo, pip/Poetry/uv, Maven/Gradle, NuGet, Nix/Guix, and Homebrew reveals that every package manager implements the same fundamental concerns, differing only in which concerns they couple or separate. These concerns form the atomic "concepts" of a package management system itself:

**Registry/Index** stores and serves package metadata (names, versions, dependency declarations, checksums). This concern is demonstrably independent: Cargo migrated from a Git-based index to a sparse HTTP protocol without changing its resolver. Homebrew switched from Git-cloned taps to a JSON API. npm supports scoped registries and custom registry URLs via `.npmrc`. The registry protocol is fully decoupled from resolution logic.

**Dependency Resolution** computes a consistent set of exact versions from declared version ranges — essentially a constraint satisfaction problem. The resolver is a pure function: (manifest constraints + available versions) → resolved graph. npm, Yarn, and pnpm all produce different `node_modules` layouts from identical resolution outputs. The state-of-the-art algorithm is **PubGrub**, created by Natalie Weizenbaum for Dart's pub manager and now adopted by uv (Python), Poetry, Bundler, Swift Package Manager, and under consideration for Cargo. PubGrub uses conflict-driven clause learning to produce human-readable error messages when resolution fails — a critical UX improvement over generic SAT solvers.

**Fetching** downloads artifacts from registries or caches. This concern is I/O-bound and independently parallelizable — uv's **10-100× speed advantage** over pip comes largely from parallel metadata and package fetching. Nix's binary substitution (downloading pre-built outputs) operates entirely independently of building.

**Integrity Verification** confirms downloaded artifacts match expected content via SHA checksums, SRI hashes, GPG signatures, or content-addressing. In npm's `package-lock.json`, every entry carries SHA-512 integrity hashes. In Nix's content-addressed model, **the hash is the identity** — verification is inherent in addressing, not a separate step.

**Linking/Installation** makes resolved packages accessible to the runtime. This is where the most dramatic architectural divergence occurs across ecosystems: npm hoists packages into flat `node_modules`; Yarn PnP generates a `.pnp.cjs` lookup table with packages stored as zip archives; pnpm uses a global content-addressed store with hard links and symlinks; Nix places each package in an immutable store path. Yarn explicitly makes this concern pluggable via a `nodeLinker` configuration setting, proving its independence.

**Lockfile Management** serializes the exact resolved dependency graph for reproducible future installations. The lockfile is the **output** of resolution and the **input** for deterministic installation — the universal serialization boundary. Formats differ (`Cargo.lock`, `package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, `flake.lock`) but the concept is identical.

**Workspace Coordination** manages multiple related packages within a single repository: inter-package references, shared lockfiles, coordinated builds. Cargo workspaces share a single `Cargo.lock` and `target/` directory. Since Cargo 1.64, workspace-level `[workspace.dependencies]` enables dependency inheritance — members declare `dependency.workspace = true` to inherit the workspace version, optionally adding features additively.

**Caching** stores previously downloaded or built artifacts for reuse. pnpm's global content-addressed store deduplicates at the file level (identical files across package versions stored once). Nix's binary caches serve pre-built NAR archives. Turborepo fingerprints task inputs for content-addressable remote caching shared across developers and CI.

**Publishing** packages a project into distributable form and uploads to a registry — the reverse of fetching, with its own access control, verification, and metadata concerns.

**Build Scripts/Plugins** execute custom logic during build. Cargo's `build.rs` runs before compilation, emitting linker flags and generating code. Maven's entire lifecycle is defined through plugin-goal bindings to abstract phases. Gradle's convention plugins encapsulate reusable build logic as composable code rather than inherited configuration.

**Auditing** scans dependency graphs against vulnerability databases — purely analytical, requiring no state mutation. **Environment Management** creates isolated execution contexts (Python venvs, Nix shells). **Feature/Variant Selection** chooses which subsets of a package's functionality to enable — Cargo's feature flags, NuGet's target framework selection.

The key architectural insight: **resolution and installation are fundamentally separable**, and **the lockfile is the contract between them**. The same resolved graph can be installed via hoisting, PnP lookup tables, content-addressed hard links, or Nix store paths. This decomposition directly maps to Clef's concept model — each concern becomes an independent, spec-driven concept.

## Content-addressed storage unifies three critical properties

Across Nix, pnpm, OCI/Docker, Flatpak/OSTree, and Git, content-addressed storage emerges as the single most important architectural decision for artifact distribution. It simultaneously provides integrity verification (the hash *is* the identity), deduplication (identical content stored once regardless of source), and reproducibility (same inputs → same hash → same artifact).

**Nix's store model** is the most sophisticated. Every package lives at `/nix/store/<hash>-<name>-<version>/`, where the hash encodes all build inputs. Builds run in sandboxes that block network access and undeclared dependencies. The experimental content-addressed mode (RFC 0062) hashes build *outputs* instead, enabling early cutoff optimization — if rebuilding glibc produces identical output, **60,000+ downstream rebuilds are skipped**. Content-addressed outputs are also self-verifying without requiring trusted signatures.

**pnpm's three-layer architecture** demonstrates content-addressing at the file level for JavaScript: a global CAS store (`~/.pnpm-store/v3/files/`) indexes every file by SHA-512 hash, a virtual store (`node_modules/.pnpm/`) hard-links files from the global store, and project `node_modules` contains only symlinks to direct dependencies. When a package updates 1 of 100 files, only that 1 file enters the store. This achieves **O(unique files)** disk usage versus npm's **O(projects × dependencies)**.

**OCI images** are Merkle DAGs of content-addressable components. Image manifests reference layers and configs via content descriptors containing `sha256:` digests. Layer deduplication across images is automatic. The OCI v1.1 Referrers API extends this to attach signatures, SBOMs, and attestations as artifacts referencing manifests via content hashes.

For the Repertoire, the architectural recommendation is clear: **concept artifacts should be identified by content hash**, stored in a global content-addressed store, and referenced via Merkle-DAG-style manifests. This provides integrity without signatures, deduplication without coordination, and caching safety at every layer.

## Jackson's concept design provides the formal composition theory

Daniel Jackson's *The Essence of Software* (Princeton University Press, 2021) provides the most directly relevant theoretical foundation. A concept is a small, independent service with its own **state**, **actions**, and **operational principle** (an archetypal usage scenario demonstrating purpose fulfillment). Concepts are formalized as state machines with typed state, actions with pre/postconditions, and invariants.

The critical innovation is **synchronizations** ("syncs"): declarative coordination rules where the firing of one concept's action triggers actions in other concepts. Concepts contain no references to other concepts — all inter-concept coordination is expressed externally. This independence guarantee is stronger than microservices, which often call each other directly. As Jackson writes: "When concepts are composed into a system, the traces of the system as a whole are always interleavings of the traces of the individual concepts."

Three complementary theoretical frameworks strengthen this foundation:

**ML module theory** provides the type-theoretic basis. ML signatures (module types) map to concept specs; structures (module values) map to implementations; functors (parameterized modules) enable generic concepts like `Folder<Item>`. Opaque ascription (`:>` in SML) enforces that only the declared spec is visible — the formal mechanism for encapsulation. OCaml's applicative functors guarantee that applying the same functor to the same argument produces compatible types, enabling safe composition.

**Software Product Lines** formalize variability management through feature models — trees of AND/OR nodes with cross-tree constraints, semantically equivalent to propositional logic formulas. This means **suite configurations can be verified by SAT solvers**. If concept A requires concept B and excludes concept C, these constraints become clauses that a solver can check for consistency. The FODA method (Kang et al., 1990) provides the domain analysis framework; modern tools automate the analysis.

**Szyperski's component model** defines components as "units of composition with contractually specified interfaces and explicit context dependencies, independently deployable and subject to composition by third parties." This maps precisely to Clef's concepts: contractual interfaces → specs, explicit context dependencies → declared requirements, independent deployment → Repertoire distribution.

## Plugin ecosystems reveal the discovery-installation-activation lifecycle

Analysis of Drupal, WordPress, VS Code, Terraform, Unity, Unreal, and Figma reveals a universal **three-phase lifecycle** — discovery, installation, and activation — with configuration as a cross-cutting concern.

**Discovery** is most effective when embedded directly in the tool's UI. VS Code's in-editor marketplace, Figma's library panel, and Unity's asset store window all outperform separate website visits. Terraform's Registry auto-generates documentation from module structure (parsing `variables.tf`, `outputs.tf`, resource declarations) — concept specs could similarly auto-generate browseable documentation.

**Installation separates from activation** in every mature system. Drupal separates `composer require` (download) from `drush en` (enable). VS Code extensions have activation events — lazy-loading triggers like `onLanguage:python` or `workspaceContains:.editorconfig` that defer loading until needed. This two-phase model enables a concept to be "available but dormant" until its actions are invoked.

**Configuration schemas should be declarative and manifest-embedded.** VS Code extensions declare configuration schemas in `package.json` via `contributes.configuration`, which auto-generates settings UI. Terraform modules expose typed input variables with defaults and validation rules. Spring Boot's `@ConfigurationProperties` generates IDE-friendly metadata. The pattern: concepts should declare their configuration schema in their manifest, enabling auto-generated UIs, validation, and documentation.

**Extension packs provide the cleanest suite model.** VS Code extension packs are pure manifests — empty shells with no code, listing member extensions via an `extensionPack` array. Installing a pack installs all members; each remains independently manageable. Debian meta-packages work identically: `ubuntu-desktop` is an empty package whose `Depends` field pulls in the entire GNOME stack. The `Depends`/`Recommends`/`Suggests` hierarchy maps directly to hard requirements, strong recommendations, and optional enhancements — three tiers of concept dependency.

The **hook/event pattern** from WordPress and Drupal maps naturally to concept coordination. WordPress distinguishes **actions** (side-effect triggers: `do_action('save_post')`) from **filters** (data-transformation pipelines: `apply_filters('the_content', $content)`). Drupal's plugin system adds class-swapping — replacing an entire implementation at a declared extension point. Clef's syncs are the principled version of this: declarative rules connecting actions across concepts.

## Three composition primitives cover all coordination needs

Across all systems studied, three distinct coordination mechanisms emerge:

**Declarative syncs** (from Jackson's theory, realized in Turborepo's `dependsOn`, Terraform's module composition, Eclipse's extension point bindings). These specify that when concept A's action fires, concept B's action should also fire. They are purely declarative, external to both concepts, and composable. Turborepo's `"^build"` dependency syntax — meaning "run build in all upstream dependencies first" — demonstrates topological ordering of synced actions.

**Conditional activation** (from Spring Boot's `@ConditionalOnClass`/`@ConditionalOnMissingBean`, VS Code's activation events, Cargo's feature-gated compilation). This mechanism activates coordination logic only when certain concepts are present or certain conditions hold. Spring Boot auto-configuration is the paradigm: if `DataSource.class` is on the classpath and no user-defined `TransactionManager` bean exists, auto-configure one. The sync analogue: "if UserAuth concept and Session concept are both present, activate this sync."

**Dependency inversion** (from Terraform's module design, Szyperski's required interfaces, JPMS's `uses`/`provides`). Terraform modules accept dependencies as input variables rather than creating them — a VPC ID is *passed to* a consul_cluster module, not created by it. This is the formal mechanism ensuring concept independence: concepts declare required interfaces (like Debian virtual packages, where `mail-transport-agent` is an abstract interface multiple packages can "Provide"), and syncs bind providers to consumers.

## Universal downloaders demonstrate artifact-type abstraction

Homebrew's Formula/Cask split, Scoop's JSON manifests, and proto's WASM plugin system reveal patterns for handling diverse artifact types within a single CLI:

**Homebrew** maintains two entirely separate DSLs: Formulae (Ruby classes describing source compilation or bottle extraction, installed into `/usr/local/Cellar/`) and Casks (a different Ruby DSL for pre-built `.dmg`/`.pkg`/`.app` artifacts, installed into `/usr/local/Caskroom/`). Both share the `brew install` command interface despite radically different installation semantics.

**proto (moonrepo)** takes the most forward-looking approach: **WASM-based plugins** written in any language that compiles to WASM (Rust, Go, Zig, TypeScript). Plugin functions like `register_tool`, `detect_version_files`, `download_prebuilt`, and `locate_executables` are called through a sandboxed Extism runtime with capability-based security. This enables language-agnostic extensibility with strong isolation — directly applicable to concept adapters in the Repertoire.

**Version managers** (asdf, mise, proto) demonstrate the decomposition of tool management into discrete operations. asdf pioneered the plugin-as-Git-repo model with executable scripts (`list-all`, `download`, `install`, `exec-env`). mise improved on this with **native PATH modification** instead of shims, eliminating the ~120ms per-invocation overhead of asdf's shell-script shims. The `.tool-versions` / `.mise.toml` / `.prototools` pattern — per-directory configuration with hierarchical resolution (local → parent → home) — is directly applicable to concept version pinning.

**Flatpak's runtime/app separation** provides a layered dependency model: shared runtimes (`org.gnome.Platform`, `org.kde.Platform`) provide common libraries, while applications bundle only their unique dependencies. Built on **OSTree** (content-addressed storage for operating system binaries), Flatpak achieves byte-level delta updates, automatic file deduplication, and instant rollback via immutable versioned branches. **Nix's generational rollback** extends this further: every `nix-env` operation creates a numbered generation, and `nix-env --rollback` atomically switches to the previous state.

## Manifest formats and CLI patterns set the interaction model

Comparing `package.json` (JSON), `Cargo.toml` (TOML), `pyproject.toml` (TOML), `go.mod` (custom), `Gemfile` (Ruby DSL), and `MODULE.bazel` (Starlark) reveals that TOML has emerged as the preferred format for new systems — readable, unambiguous, supports comments, and has well-defined semantics for tables and arrays.

The most effective CLI patterns combine **direct manifest modification** with **interactive scaffolding**:

- `cargo add serde --features derive` modifies `Cargo.toml` directly, adding a dependency entry with version constraints and listing enabled/disabled features. Entirely flag-driven, no prompts.
- `npm create next-app@latest` runs interactive prompts (TypeScript? App Router? Tailwind?) then generates a complete project skeleton. Flags provide non-interactive overrides for CI.
- Nx generators (`nx generate @nx/react:application`) create projects following established patterns with full project-graph awareness.

For Clef, the recommended CLI surface: `clef add <concept>` modifies the suite manifest (like `cargo add`); `clef create <suite>` scaffolds interactively from a suite template (like `npm create`); `clef sync` validates and auto-generates sync wiring (like Nx sync generators); and all commands support flag-based non-interactive modes for CI.

**Lockfiles complement manifests** as the contract between intent and resolution. The manifest expresses version ranges; the lockfile records exact resolved versions with integrity hashes. Cargo's workspace model — a single `Cargo.lock` at the workspace root, with dependency inheritance via `workspace = true` — is the gold standard for the Repertoire's approach to shared resolution across a suite of concepts.

## The Repertoire architecture maps to proven patterns

Synthesizing all findings, Clef's Repertoire maps cleanly onto established patterns:

| Clef Element | Theoretical Basis | Engineering Analogue |
|---|---|---|
| **Concept** | Jackson's concept (state machine with purpose) + Szyperski's component | Rust crate, Rails engine, Terraform module, OSGi bundle |
| **Spec** | ML signature + Jackson's operational principle | `module-info.java` exports, Terraform `variables.tf`/`outputs.tf` |
| **Sync** | Jackson's synchronization + Spring Boot conditional auto-config | Turborepo `dependsOn`, Eclipse extension point binding |
| **Suite** | SPL feature configuration + VS Code extension pack | Debian meta-package, Spring Boot starter |
| **Repertoire** | Content-addressed registry + PubGrub resolver | pnpm store + Cargo workspace + Terraform Registry |
| **Feature flag** | Cargo features + SPL feature model | Additive compile-time toggle with cross-concept constraints |
| **Manifest** | Cargo.toml structure + JPMS module declaration | TOML file declaring concepts, syncs, features, dependencies |

The Repertoire should use **PubGrub for dependency resolution** (proven in uv, Poetry, Swift PM), **content-addressed storage for artifacts** (proven in Nix, pnpm, OCI), **semantic versioning on concept specs** (the spec interface as the compatibility contract), and **Git-backed metadata** (like Homebrew taps, Terraform Registry) separating discovery from artifact hosting. Concept compositions should be **immutable snapshots** with generational rollback (like Nix profiles), and the standard library should follow a **three-tier model**: core Repertoire concepts (curated, like Flatpak's freedesktop runtime), community-contributed concepts (like Homebrew taps), and project-local concepts.

## What the theoretical literature leaves unresolved

Despite comprehensive coverage, several design tensions remain open. **Feature unification** — Cargo's rule that features from all dependents are unioned — creates pressure for features to be purely additive, which limits expressiveness. Cargo's RFC 3692 introduces per-package feature isolation as an alternative, but this means potentially building the same crate multiple times. Clef must decide where on this spectrum concept features sit.

**Runtime vs. compile-time composition** is undertheorized. Jackson's syncs are specified declaratively, but real systems need both static wiring (resolved at build time, like Cargo features) and dynamic wiring (resolved at runtime, like Spring Boot's `@ConditionalOnMissingBean`). The Repertoire needs a clear model for when composition decisions are made.

**Versioning of specs independently from implementations** has no clean precedent. Most systems version the whole package. If concept specs evolve independently (as they should for maximum reuse), the Repertoire needs a two-dimensional versioning scheme — spec version and implementation version — with compatibility tracked between them. ML's opaque ascription provides the type-theoretic tool, but no package manager has operationalized this.

These open questions represent the genuinely novel design work Clef must do, building on but going beyond the patterns catalogued here.