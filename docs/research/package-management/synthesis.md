# Clef Package Management — Unified Synthesis & Implementation Plan

**COPF v0.19.0 — 2026-03-03**

---

## Part 0: Research Synthesis — Compare, Contrast, Decide

### The Four Reports at a Glance

**Report 1 ("Start Deep Research")** is a broad ecosystem survey. It catalogs npm, pip, Maven, Cargo, Composer, apt, Homebrew, Chocolatey, Flatpak, Snap, OCI, Git submodules, GitHub Packages, and five marketplace ecosystems (WordPress, Drupal, Envato, Unity, VS Code). Its contribution is the **four-plane reference architecture** (Authoring, Solving, Distribution, Trust) and the comparative tables. It proposes six transferable primitives for Clef but stops short of concrete concept designs.

**Report 2 ("Continued Deep Research")** goes deeper: it proposes a **per-concept artifact taxonomy** (concept module, sync module, handler module, widget module, theme module, bind target module, SDK provider module, spec provider module, suite meta-module). It adds a **dependency edge model** with typed edges (requires.contract, requires.provider, provides.capability, conflicts, optional, build_requires) across four environments (host, build, runtime, bind). It proposes composition operators (merge, override, patch, mask) and a staged transactional installer. Its contribution is the **fine-grained module manifest schema** and the OCI/TUF/SLSA trust architecture.

**Report 3 ("Concept Research Compass")** is the most conceptually precise. It decomposes package management into **thirteen separable concerns** (Registry, Resolution, Fetching, Integrity, Linking, Lockfile, Workspace, Caching, Publishing, Build Scripts, Auditing, Environment Management, Feature Selection). It champions **PubGrub** for resolution, **content-addressed storage** as the unifying decision, and maps the Repertoire architecture to proven patterns. Critically, it identifies **three open questions** Clef must answer: feature unification vs. isolation, runtime vs. compile-time composition, and spec vs. implementation versioning.

**Report 4 ("Architecting Modular Software")** provides the broadest academic framing — CBSE, NP-completeness of resolution, Nix's functional model, OCI artifacts, Bit.dev's Harmony framework, marketplace metadata (Drupal, Envato), and CLI plugin architectures (oclif, VS Code extensions, Cobra/Krew). Its Clef-specific contribution is the **four-phase execution pipeline** (Resolution → Fetching → Validation → Generation) and emphasis on the Score as the internal dependency graph.

### Where They Agree

All four reports converge on these design decisions:

1. **Per-concept granularity over suite-level bundles.** Suites become meta-packages (thin manifest referencing modules), not the atomic distribution unit.
2. **Content-addressed storage (CAS)** for artifact identity, deduplication, and integrity-by-design.
3. **PubGrub** (or comparable conflict-driven solver) for dependency resolution, not SAT solvers or mediation heuristics.
4. **Lockfiles as the contract** between resolution intent and deterministic installation.
5. **Staged/transactional installation** (fetch → verify → stage → activate) with rollback.
6. **Typed dependency edges** (not a single "depends" field) — contract, provider, build, optional.
7. **Provenance layering**: TUF for repository metadata, SLSA for build provenance, SBOMs for component inventory.
8. **Suites as curated meta-packages** preserving "easy onboarding" while permitting fine-grained substitution.
9. **The concept/provider pattern** for pluggable backends (registries, resolvers, storage, signing).

### Where They Disagree — and Decisions Made

| Tension | Report 2 | Report 3 | Decision |
|---------|----------|----------|----------|
| **Number of concepts** | ~9 artifact types, each a module kind | 13 concerns, each a concept | **13 concerns as concepts**. Report 2's artifact taxonomy becomes the *module kind enum* within the Registry concept, not separate concepts. |
| **Feature unification** | Not addressed | Flags open question (Cargo union vs. isolation) | **Additive unification by default** (Cargo model). Per-concept feature isolation available as opt-in via a resolver policy flag. |
| **Runtime vs. compile-time composition** | Implies compile-time (lockfile-driven) | Explicitly raises the question | **Compile-time by default** (lockfile is authoritative). Runtime activation is a separate concern handled by a Loader concept that reads the lockfile and lazily activates modules. |
| **Spec vs. implementation versioning** | Hints at two-dimensional versioning | Calls it genuinely novel | **Two-version scheme**: concept specs carry `spec_version` (SemVer on the contract); handler/widget implementations carry `impl_version`. Compatibility is a declared range (`compatible_spec: ">=1.2.0 <2.0.0"`). |
| **Registry backend** | OCI-based + simple index + Git index | Git-backed metadata (like Cargo/Homebrew) | **Hybrid**: Git-backed sparse index for metadata resolution (fast, offline-friendly, mirrorable), OCI-backed blob store for artifact bytes. This matches Cargo's architecture. |
| **Resolution algorithm** | SAT/backtracking, defers to policy | PubGrub specifically | **PubGrub**. It has proven implementations in uv, Poetry, Swift PM, and produces human-readable conflict errors. |
| **SBOM format** | SPDX and/or CycloneDX | Not specified | **CycloneDX as primary** (better automation support), with SPDX export available. |

### Concepts Collapsed or Removed (Justification)

| Proposed Concept | Disposition | Reason |
|------------------|-------------|--------|
| Report 2's "Bind Target Module" as concept | **Collapsed into Registry** | A bind target is a module *kind*, not a separate concern. Registry tracks all module kinds via a `kind` field. |
| Report 2's "SDK Provider Module" as concept | **Collapsed into Registry** | Same reasoning — it's a module kind, not a concept with independent state. |
| Report 4's "Score as dependency graph" | **Not a package management concept** | Score is the *consumer* of package management, not part of it. Score reads the lockfile and resolved graph. |
| Report 2's "Composition Operators" (merge/override/patch) | **Becomes actions on Manifest concept** | Not independent concepts — they're operations on manifests. |
| Report 3's "Environment Management" | **Collapsed into Workspace** | Environment isolation (like Python venvs) is a workspace concern in Clef's model, not independent. |
| Report 3's "Build Scripts/Plugins" | **Collapsed into BuildHook** actions within Installer | Build hooks are part of the installation lifecycle, not an independent service with state. |

---

## Part I: The Package Management Suite — Concepts, Suites, and Syncs

### Suite Overview

**Suite name:** `suites/package/`
**Suite version:** `0.1.0`
**Description:** Content-addressed package management for Clef modules — registry, resolution, distribution, integrity, and lifecycle management.

The suite contains **14 concepts** organized into **3 suites** plus coordination concepts with providers.

### Suite 1: Package Core Suite (`suites/package/core/`)

These concepts handle the "what" of package management — identity, metadata, constraints, and resolved state.

---

#### Concept 1: Registry

```
@version(1)
concept Registry [M] {

  purpose {
    Index of available module metadata — names, versions, dependency
    declarations, checksums, and module kinds. Serves as the discovery
    and resolution data source. Decoupled from artifact storage.
  }

  state {
    modules: set M
    name: M -> String
    namespace: M -> String
    version: M -> String
    kind: M -> ModuleKind           // concept, sync, handler, widget, theme, bind-target, sdk-provider, spec-provider, suite-meta, derived
    spec_version: M -> option String // for implementations: which spec contract version
    compatible_spec: M -> option String // semver range of compatible specs
    dependencies: M -> list {
      module_id: String,
      version_range: String,
      edge_type: String,            // contract, provider, build, optional, conflicts
      environment: String           // host, build, runtime, bind
    }
    capabilities_provided: M -> list String  // virtual provides (e.g., "storage:kv")
    capabilities_required: M -> list String
    features: M -> list {
      name: String,
      default: Bool,
      additional_deps: list String
    }
    content_hash: M -> String       // CAS digest of the artifact
    artifact_url: M -> String       // blob store location
    metadata: M -> {
      description: String,
      license: String,
      repository: String,
      authors: list String,
      keywords: list String
    }
    published_at: M -> DateTime
    yanked: M -> Bool
  }

  actions {
    action publish(name: String, namespace: String, version: String, kind: String, artifact_hash: String, dependencies: list, metadata: {}) {
      -> ok(module: M) {
        Validates name uniqueness within namespace+version, verifies artifact hash
        exists in blob store, indexes metadata. Published versions are immutable.
      }
      -> duplicate(message: String) {
        Version already exists for this name+namespace.
      }
      -> invalid(errors: list String) {
        Manifest validation failures.
      }
    }

    action yank(module: M) {
      -> ok() { Marks module as yanked — excluded from new resolutions but honored in existing lockfiles. }
      -> notfound(message: String) { Module not in registry. }
    }

    action lookup(name: String, namespace: String, version_range: String) {
      -> ok(modules: list M) { Returns all versions matching range, sorted by semver descending. }
      -> notfound(message: String) { No module matches. }
    }

    action search(query: String, kind: option String, namespace: option String) {
      -> ok(modules: list M) { Full-text search over name, description, keywords. }
    }

    action listVersions(name: String, namespace: String) {
      -> ok(versions: list String) { All published versions, including yanked (marked). }
      -> notfound(message: String) { Module not in registry. }
    }

    action resolveCapability(capability: String) {
      -> ok(providers: list M) { All modules that provides.capability matches. }
      -> notfound(message: String) { No providers. }
    }
  }

  invariant {
    after publish(name: "x", namespace: "ns", version: "1.0.0", kind: "concept", artifact_hash: "abc", dependencies: [], metadata: {}) -> ok(module: m)
    then lookup(name: "x", namespace: "ns", version_range: ">=1.0.0") -> ok(modules: ms)
    and  ms includes m
  }
}
```

**Module kinds (the `ModuleKind` enum referenced above):**
- `concept` — a `.concept` spec file
- `sync` — a `.sync` spec file
- `handler` — a language-specific implementation of a concept
- `widget` — a `.widget` UI component spec/implementation
- `theme` — a `.theme` package
- `bind-target` — a Bind target provider (REST, GraphQL, gRPC, CLI, MCP, etc.)
- `sdk-provider` — a language SDK generator (TypeScript, Python, Go, Rust, etc.)
- `spec-provider` — an API spec generator (OpenAPI, AsyncAPI)
- `suite-meta` — a thin composition manifest referencing other modules
- `derived` — a `.derived` concept

**Uses concept/provider pattern:** Yes. The Registry concept is a coordination concept. Providers implement different registry backends.

**Providers:**
- `GitSparseIndex` — Cargo-style sparse HTTP index backed by Git
- `OciRegistry` — OCI Distribution API for artifact blobs
- `LocalFilesystem` — development-time local directory registry
- `InMemory` — testing

---

#### Concept 2: Resolver

```
@version(1)
concept Resolver [R] {

  purpose {
    Computes a consistent set of exact module versions from declared
    constraints using PubGrub conflict-driven solving. Pure function:
    (manifest constraints + available versions) → resolved graph.
  }

  state {
    resolutions: set R
    input_constraints: R -> list {
      module_id: String,
      version_range: String,
      edge_type: String,
      environment: String
    }
    resolved_modules: R -> list {
      module_id: String,
      resolved_version: String,
      content_hash: String,
      features_enabled: list String
    }
    resolution_policy: R -> {
      unification_strategy: String,     // "unified" | "isolated"
      feature_unification: String,      // "additive" | "per-dependent"
      prefer_locked: Bool,
      allowed_updates: String           // "patch" | "minor" | "major" | "exact"
    }
    conflict_explanation: R -> option list String
    status: R -> String                 // "pending" | "solved" | "unsolvable"
  }

  actions {
    action resolve(constraints: list, policy: {}, locked_versions: option list) {
      -> ok(resolution: R) {
        PubGrub computes satisfying assignment. Locked versions are preferred
        when prefer_locked is true. Features are unified additively by default.
      }
      -> unsolvable(explanation: list String) {
        Human-readable conflict explanation from PubGrub's derivation tree.
        Each entry describes one incompatibility and its causes.
      }
      -> error(message: String) {
        Registry unavailable or constraint syntax invalid.
      }
    }

    action update(resolution: R, targets: list String, policy: {}) {
      -> ok(resolution: R) {
        Selectively updates specified modules within policy bounds, preserving
        locked versions for everything else.
      }
      -> unsolvable(explanation: list String) { Same as resolve. }
    }

    action explain(resolution: R, module_id: String) {
      -> ok(path: list String) {
        Why this module is included — the chain of dependencies leading to it.
      }
      -> notfound(message: String) { Module not in resolution. }
    }
  }
}
```

**No providers needed.** The Resolver is a pure algorithm. PubGrub is the single implementation. If alternative algorithms are needed later, they become providers.

---

#### Concept 3: Manifest

```
@version(1)
concept Manifest [P] {

  purpose {
    Declarative project configuration — what modules a project needs,
    what features to enable, what overrides to apply. The human-authored
    input to resolution. Corresponds to clef.yaml's package section.
  }

  state {
    projects: set P
    name: P -> String
    version: P -> String
    dependencies: P -> list {
      module_id: String,
      version_range: String,
      edge_type: String,
      environment: String,
      features: list String,
      optional: Bool
    }
    overrides: P -> list {
      module_id: String,
      replacement_id: option String,
      replacement_source: option String,    // local path, git URL
      version_pin: option String
    }
    patches: P -> list {
      target_module: String,
      patch_path: String
    }
    disabled: P -> list String              // explicitly disabled optional modules
    resolution_policy: P -> {
      unification_strategy: String,
      feature_unification: String,
      prefer_locked: Bool,
      allowed_updates: String
    }
    registries: P -> list {
      name: String,
      url: String,
      scope: option String                  // namespace scope for this registry
    }
    target_languages: P -> list String
    target_platforms: P -> list String
  }

  actions {
    action add(project: P, module_id: String, version_range: String, edge_type: String, features: list String) {
      -> ok() { Adds dependency to manifest. }
      -> duplicate(message: String) { Already declared. }
    }

    action remove(project: P, module_id: String) {
      -> ok() { Removes dependency from manifest. }
      -> notfound(message: String) { Not in manifest. }
    }

    action override(project: P, module_id: String, replacement_id: option String, source: option String) {
      -> ok() { Adds or updates an override entry. }
    }

    action disable(project: P, module_id: String) {
      -> ok() { Adds module to disabled list. }
    }

    action enable(project: P, module_id: String) {
      -> ok() { Removes module from disabled list. }
    }

    action merge(project: P, other: P) {
      -> ok() {
        Structural union of dependencies, overrides, patches.
        Conflicts in overrides are reported as warnings.
      }
      -> conflict(conflicts: list String) { Irreconcilable overrides. }
    }

    action validate(project: P) {
      -> ok() { Manifest is well-formed. }
      -> invalid(errors: list String) { Schema violations. }
    }
  }
}
```

---

#### Concept 4: Lockfile

```
@version(1)
concept Lockfile [L] {

  purpose {
    Serialized resolved dependency graph for deterministic installation.
    The output of resolution, the input to installation. Immutable once
    written — only resolution can produce a new lockfile.
  }

  state {
    lockfiles: set L
    project_hash: L -> String           // hash of the manifest that produced this
    entries: L -> list {
      module_id: String,
      version: String,
      content_hash: String,
      artifact_url: String,
      integrity: String,                // SRI hash (sha256/sha512)
      features_enabled: list String,
      dependencies: list String         // resolved module_id@version references
    }
    metadata: L -> {
      resolver_version: String,
      resolved_at: DateTime,
      registry_snapshot: String         // hash of registry state at resolution time
    }
  }

  actions {
    action write(resolution_data: list, manifest_hash: String) {
      -> ok(lockfile: L) {
        Serializes resolved graph with integrity hashes.
        Deterministic: same resolution always produces identical lockfile bytes.
      }
      -> error(message: String) { Serialization failure. }
    }

    action read(path: String) {
      -> ok(lockfile: L) { Parses lockfile from disk. }
      -> corrupted(message: String) { Integrity check failed. }
      -> notfound(message: String) { File doesn't exist. }
    }

    action verify(lockfile: L) {
      -> ok() { All integrity hashes match stored artifacts. }
      -> stale(changes: list String) { Manifest changed since lockfile was produced. }
      -> corrupted(entries: list String) { Hash mismatches. }
    }

    action diff(old: L, new: L) {
      -> ok(added: list, removed: list, updated: list) {
        Computes the delta between two lockfiles.
      }
    }
  }
}
```

---

#### Concept 5: FeatureFlag

```
@version(1)
concept FeatureFlag [F] {

  purpose {
    Manages additive compile-time feature toggles on modules.
    Features gate optional dependencies and conditional code paths.
    Unified additively by default: if any dependent enables a feature,
    it is enabled for all dependents of that module.
  }

  state {
    flags: set F
    module_id: F -> String
    name: F -> String
    default: F -> Bool
    additional_deps: F -> list String
    mutually_exclusive_with: F -> list String
    enabled: F -> Bool
  }

  actions {
    action enable(module_id: String, feature: String) {
      -> ok(flag: F) { Enables feature, activating its additional deps. }
      -> conflict(message: String) { Mutually exclusive with an already-enabled feature. }
      -> notfound(message: String) { Feature doesn't exist on this module. }
    }

    action disable(module_id: String, feature: String) {
      -> ok() { Disables feature. }
      -> required(message: String) { Another module requires this feature. }
    }

    action unify(module_id: String, requested_features: list String) {
      -> ok(unified: list String) {
        Computes the union of all requested features for this module,
        respecting mutual exclusion constraints.
      }
      -> conflict(message: String) { Mutual exclusion violated. }
    }
  }
}
```

---

### Suite 2: Package Distribution Suite (`suites/package/distribution/`)

These concepts handle the "how" of package management — fetching, storing, verifying, installing, and publishing.

---

#### Concept 6: ContentStore

```
@version(1)
concept ContentStore [B] {

  purpose {
    Content-addressed blob storage. Every artifact is identified by its
    cryptographic hash. Provides deduplication, integrity-by-identity,
    and cache safety. The single most important architectural decision
    per all research.
  }

  state {
    blobs: set B
    hash: B -> String               // sha256 digest — this IS the identity
    size: B -> Int
    media_type: B -> String
    stored_at: B -> DateTime
    storage_path: B -> String       // physical location in the store
    reference_count: B -> Int       // number of lockfile entries pointing here
  }

  actions {
    action store(data: Bytes, media_type: String) {
      -> ok(blob: B) {
        Computes hash, deduplicates. If hash already exists, returns existing
        blob with incremented reference count.
      }
      -> error(message: String) { Storage failure. }
    }

    action retrieve(hash: String) {
      -> ok(data: Bytes) { Returns blob data. }
      -> notfound(message: String) { Hash not in store. }
    }

    action verify(hash: String) {
      -> ok() { Stored data matches declared hash. }
      -> corrupted(message: String) { Hash mismatch — data has been tampered. }
    }

    action gc(lockfile_hashes: list String) {
      -> ok(removed: Int) {
        Garbage collects blobs not referenced by any provided lockfile hash set.
      }
    }

    action stats() {
      -> ok(total_blobs: Int, total_bytes: Int, deduplicated_bytes: Int) {
        Storage utilization statistics.
      }
    }
  }
}
```

---

#### Concept 7: Fetcher

```
@version(1)
concept Fetcher [D] {

  purpose {
    Downloads artifacts from registries or caches. I/O-bound and
    independently parallelizable. Checks ContentStore before network.
  }

  state {
    downloads: set D
    module_id: D -> String
    version: D -> String
    source_url: D -> String
    expected_hash: D -> String
    status: D -> String             // "queued" | "downloading" | "verifying" | "complete" | "failed"
    bytes_downloaded: D -> Int
    bytes_total: D -> Int
    error: D -> option String
    started_at: D -> option DateTime
    completed_at: D -> option DateTime
  }

  actions {
    action fetch(module_id: String, version: String, source_url: String, expected_hash: String) {
      -> ok(download: D) {
        Checks ContentStore first. If hash exists, returns immediately.
        Otherwise downloads from source_url, verifies hash, stores in ContentStore.
      }
      -> cached() { Already in ContentStore. }
      -> integrity_failure(expected: String, actual: String) {
        Downloaded bytes don't match expected hash.
      }
      -> network_error(message: String) { Download failed. }
    }

    action fetchBatch(items: list {module_id: String, version: String, source_url: String, expected_hash: String}) {
      -> ok(results: list D) {
        Parallel fetch of multiple artifacts. Each item is independently
        cached or downloaded.
      }
      -> partial(completed: list D, failed: list D) {
        Some items failed. Completed items are already in ContentStore.
      }
    }

    action cancel(download: D) {
      -> ok() { Cancels in-progress download. }
    }
  }
}
```

---

#### Concept 8: Installer

```
@version(1)
concept Installer [I] {

  purpose {
    Staged, transactional installation. Materializes resolved modules
    from ContentStore into the project's working directories. Two-phase:
    stage (prepare in isolation), then activate (atomic switch).
    Supports rollback to previous generation.
  }

  state {
    installations: set I
    generation: I -> Int                // monotonically increasing generation number
    lockfile_hash: I -> String
    staged_modules: I -> list {
      module_id: String,
      version: String,
      content_hash: String,
      target_path: String,
      kind: String
    }
    active: I -> Bool
    previous_generation: I -> option I  // link for rollback
    installed_at: I -> option DateTime
  }

  actions {
    action stage(lockfile_entries: list, project_root: String) {
      -> ok(installation: I) {
        Creates a new generation. Extracts all artifacts from ContentStore
        into staging area. Runs build hooks for handler modules.
        Generates code for concept/sync modules. Does NOT modify active state.
      }
      -> error(message: String) { Staging failure. }
    }

    action activate(installation: I) {
      -> ok() {
        Atomically switches the "current" pointer to this generation.
        Materializes into generated/, bind/, handlers/ as appropriate.
        Previous generation becomes rollback target.
      }
      -> error(message: String) { Activation failure — previous generation preserved. }
    }

    action rollback(installation: I) {
      -> ok(previous: I) {
        Reverts to previous generation. Current generation is preserved
        for potential re-activation.
      }
      -> no_previous(message: String) { No previous generation to rollback to. }
    }

    action clean(keep_generations: Int) {
      -> ok(removed: Int) {
        Removes old generations beyond the keep count.
      }
    }
  }
}
```

---

#### Concept 9: Publisher

```
@version(1)
concept Publisher [U] {

  purpose {
    Packages a module for distribution and uploads to a registry.
    The reverse of fetching. Handles validation, signing, SBOM
    generation, and provenance attestation.
  }

  state {
    publications: set U
    module_id: U -> String
    version: U -> String
    artifact_hash: U -> String
    signature: U -> option String
    provenance: U -> option {
      builder: String,
      source_repo: String,
      source_commit: String,
      build_timestamp: DateTime,
      slsa_level: Int
    }
    sbom: U -> option String            // CycloneDX JSON
    status: U -> String                 // "packaging" | "signing" | "uploading" | "published" | "failed"
  }

  actions {
    action package(source_path: String, kind: String, manifest: {}) {
      -> ok(publication: U) {
        Validates manifest, computes content hash, creates distributable
        archive. Does not upload.
      }
      -> invalid(errors: list String) { Manifest or content validation failures. }
    }

    action sign(publication: U) {
      -> ok() { Attaches cryptographic signature. }
      -> error(message: String) { Signing failure. }
    }

    action attest(publication: U, builder: String, source_repo: String, source_commit: String) {
      -> ok() { Attaches SLSA provenance attestation. }
    }

    action generateSbom(publication: U) {
      -> ok() { Generates CycloneDX SBOM from resolved dependencies. }
    }

    action upload(publication: U, registry_url: String) {
      -> ok() { Uploads artifact + metadata + attestations to registry. }
      -> duplicate(message: String) { Version already published. }
      -> unauthorized(message: String) { Authentication failure. }
      -> error(message: String) { Network or registry error. }
    }
  }
}
```

---

#### Concept 10: Auditor

```
@version(1)
concept Auditor [A] {

  purpose {
    Scans resolved dependency graphs against vulnerability databases
    and policy rules. Purely analytical — no state mutation.
    Produces advisories and compliance reports.
  }

  state {
    audits: set A
    lockfile_hash: A -> String
    advisories: A -> list {
      module_id: String,
      version: String,
      severity: String,             // "critical" | "high" | "medium" | "low"
      cve: option String,
      description: String,
      fix_version: option String
    }
    policy_violations: A -> list {
      module_id: String,
      rule: String,
      message: String
    }
    audit_at: A -> DateTime
  }

  actions {
    action audit(lockfile_entries: list) {
      -> ok(audit: A) {
        Checks all entries against known vulnerability databases.
        Returns advisories sorted by severity.
      }
      -> error(message: String) { Database unavailable. }
    }

    action checkPolicy(lockfile_entries: list, policy: {allowed_licenses: list String, denied_namespaces: list String, max_severity: String}) {
      -> ok(audit: A) { All entries pass policy. }
      -> violations(audit: A) { Policy violations found. }
    }

    action diff(old_audit: A, new_audit: A) {
      -> ok(new_advisories: list, resolved_advisories: list) {
        What changed between two audits.
      }
    }
  }
}
```

---

### Coordination Concepts and Providers

The following use the concept/provider pattern via PluginRegistry:

| Coordination Concept | Provider Implementations | Selection Basis |
|---------------------|--------------------------|-----------------|
| **Registry** | GitSparseIndex, OciBlob, LocalFilesystem, InMemory | Registry URL scheme |
| **ContentStore** | LocalFilesystem, OciBlob, S3, GCS | Configuration |
| **Fetcher** | HttpFetcher, GitFetcher, LocalCopy | Source URL scheme |
| **Publisher** | OciPublisher, GitPublisher, LocalPublisher | Target registry type |
| **Auditor** | OsvDatabase, GithubAdvisory, CustomPolicy | Database configuration |

---

### Syncs

#### Required Syncs

```
sync ManifestToResolution [eager]
  when Manifest/validate() -> ok()
  then Resolver/resolve(
    constraints: Manifest.dependencies,
    policy: Manifest.resolution_policy,
    locked_versions: Lockfile.entries
  )
```

```
sync ResolutionToLockfile [eager]
  when Resolver/resolve() -> ok(resolution: r)
  then Lockfile/write(
    resolution_data: Resolver.resolved_modules(r),
    manifest_hash: hash(Manifest)
  )
```

```
sync LockfileToFetch [eager]
  when Lockfile/write() -> ok(lockfile: l)
  then Fetcher/fetchBatch(
    items: Lockfile.entries(l).map(e => {
      module_id: e.module_id,
      version: e.version,
      source_url: e.artifact_url,
      expected_hash: e.content_hash
    })
  )
```

```
sync FetchToInstall [eager]
  when Fetcher/fetchBatch() -> ok(results: rs)
  then Installer/stage(
    lockfile_entries: Lockfile.entries,
    project_root: Manifest.project_root
  )
```

```
sync StageToActivate [eager]
  when Installer/stage() -> ok(installation: i)
  then Installer/activate(installation: i)
```

```
sync PublishToRegistry [eager]
  when Publisher/upload() -> ok()
  then Registry/publish(
    name: Publisher.module_id,
    namespace: Publisher.namespace,
    version: Publisher.version,
    kind: Publisher.kind,
    artifact_hash: Publisher.artifact_hash,
    dependencies: Publisher.dependencies,
    metadata: Publisher.metadata
  )
```

#### Recommended Syncs

```
sync AutoAuditOnInstall [eventual]
  when Installer/activate() -> ok()
  then Auditor/audit(lockfile_entries: Lockfile.entries)
```

```
sync FeatureUnification [eager]
  when Resolver/resolve() -> ok(resolution: r)
  then FeatureFlag/unify(
    module_id: each resolved module,
    requested_features: collected from all dependents
  )
```

```
sync ProvenanceOnPublish [eager]
  when Publisher/package() -> ok(publication: u)
  then Publisher/attest(publication: u, ...)
  then Publisher/generateSbom(publication: u)
  then Publisher/sign(publication: u)
```

#### Integration Syncs

```
sync IntegrityCheckOnFetch [eager]
  when Fetcher/fetch() -> ok(download: d)
  then ContentStore/verify(hash: d.expected_hash)
```

```
sync GarbageCollectOnClean [eventual]
  when Installer/clean() -> ok()
  then ContentStore/gc(lockfile_hashes: current lockfile hashes)
```

---

### Suite Manifest

```yaml
suite:
  name: package
  version: 0.1.0
  description: "Content-addressed package management for Clef modules"

concepts:
  # Core Suite
  Registry:
    spec: ./core/registry.concept
    params:
      M: { as: module, description: "A versioned module in the registry" }
  Resolver:
    spec: ./core/resolver.concept
    params:
      R: { as: resolution, description: "A resolved dependency set" }
  Manifest:
    spec: ./core/manifest.concept
    params:
      P: { as: project, description: "A project manifest" }
  Lockfile:
    spec: ./core/lockfile.concept
    params:
      L: { as: lockfile, description: "A serialized resolution" }
  FeatureFlag:
    spec: ./core/feature-flag.concept
    params:
      F: { as: flag, description: "A feature toggle on a module" }

  # Distribution Suite
  ContentStore:
    spec: ./distribution/content-store.concept
    params:
      B: { as: blob, description: "A content-addressed artifact blob" }
  Fetcher:
    spec: ./distribution/fetcher.concept
    params:
      D: { as: download, description: "A download operation" }
  Installer:
    spec: ./distribution/installer.concept
    params:
      I: { as: installation, description: "An installation generation" }
  Publisher:
    spec: ./distribution/publisher.concept
    params:
      U: { as: publication, description: "A publication operation" }
  Auditor:
    spec: ./distribution/auditor.concept
    params:
      A: { as: audit, description: "An audit result" }

syncs:
  required:
    - manifest-to-resolution
    - resolution-to-lockfile
    - lockfile-to-fetch
    - fetch-to-install
    - stage-to-activate
    - publish-to-registry
    - integrity-check-on-fetch
    - feature-unification
  recommended:
    - auto-audit-on-install
    - provenance-on-publish
  integration:
    - garbage-collect-on-clean

uses:
  - suite: infrastructure
    concepts:
      - name: PluginRegistry
  - suite: generation
    optional: true
    concepts:
      - name: Emitter
```

---

## Part I-B: Implementation Plan — Four Languages

### Implementation Order

Phase 1 (Foundation): ContentStore, Lockfile, Manifest
Phase 2 (Resolution): Registry, Resolver, FeatureFlag
Phase 3 (Lifecycle): Fetcher, Installer
Phase 4 (Supply Chain): Publisher, Auditor

### Per-Concept Implementation Matrix

| Concept | TypeScript | Rust | Go | Python |
|---------|-----------|------|-----|--------|
| **ContentStore** | SHA-256 via `crypto`, flat file store under `.clef/store/` | `sha2` crate, memory-mapped file I/O | `crypto/sha256`, file-based | `hashlib`, `pathlib` |
| **Lockfile** | YAML serialization via `yaml`, deterministic key sorting | `serde_yaml`, deterministic via `BTreeMap` | `gopkg.in/yaml.v3`, sorted maps | `ruamel.yaml`, sort_keys |
| **Manifest** | YAML parse + JSON Schema validation | `serde_yaml` + `jsonschema` crate | `yaml.v3` + `gojsonschema` | `pydantic` model validation |
| **Registry** | HTTP client for sparse index, `@octokit` for Git | `reqwest` + `git2` | `net/http` + `go-git` | `httpx` + `pygit2` |
| **Resolver** | Port of PubGrub (or use existing `pubgrub` npm package) | `pubgrub` crate (Rust-native) | Port of PubGrub | `resolvelib` (pip's resolver) or PubGrub port |
| **FeatureFlag** | In-memory set operations during resolution | Integrated into Resolver via `pubgrub` features | Map-based union during resolution | Dict-based union |
| **Fetcher** | `undici` for parallel HTTP, streaming to ContentStore | `reqwest` with `tokio` parallelism | `net/http` with goroutines | `httpx` async |
| **Installer** | Symlink-based activation (pnpm model), `fs.symlink` | Hardlink-based (pnpm model), `std::os::unix::fs` | Symlink + `os.Symlink` | Symlink + `os.symlink` |
| **Publisher** | `tar` + `zlib` for packaging, `node-forge` for signing | `flate2` + `tar` crate, `ring` for crypto | `archive/tar` + `compress/gzip`, `crypto/ed25519` | `tarfile` + `cryptography` |
| **Auditor** | HTTP to OSV API, JSON advisory parsing | `reqwest` to OSV, `serde_json` | `net/http` to OSV, `encoding/json` | `httpx` to OSV, `pydantic` |

### Key Dependencies Per Language

**TypeScript:** `yaml`, `crypto`, `tar-stream`, `undici`, `semver`
**Rust:** `pubgrub`, `sha2`, `serde_yaml`, `reqwest`, `tokio`, `flate2`, `tar`, `ring`, `semver`
**Go:** `golang.org/x/mod/semver`, `gopkg.in/yaml.v3`, `github.com/go-git/go-git`, `github.com/opencontainers/go-digest`
**Python:** `pydantic`, `ruamel.yaml`, `httpx`, `cryptography`, `packaging` (for version parsing), `resolvelib`

### PubGrub Implementation Notes

The Resolver is the most complex concept. PubGrub is available natively in Rust (`pubgrub` crate). For other languages:

- **TypeScript**: The `uv` project's Rust PubGrub can be compiled to WASM and called from TS. Alternatively, port the ~1500-line core algorithm.
- **Go**: No mature PubGrub library exists. Recommend porting from the Rust reference implementation. The core algorithm is ~2000 lines.
- **Python**: The `resolvelib` package (used by pip) implements backtracking but not PubGrub specifically. For Clef's needs, a PubGrub port from Rust is preferred for consistent conflict messages across languages.

### Lockfile Format (Shared Across Languages)

```yaml
# clef.lock.yaml
lockfile_version: 1
resolver: pubgrub
resolved_at: "2026-03-03T12:00:00Z"
manifest_hash: "sha256:abc123..."

modules:
  "repertoire/identity.user@1.2.0":
    kind: concept
    content_hash: "sha256:def456..."
    integrity: "sha256-base64encodedSRIhash=="
    artifact_url: "https://registry.clef.dev/blobs/sha256:def456..."
    features: [oauth, mfa]
    dependencies:
      - "repertoire/identity.password@1.1.0"
      - "repertoire/identity.jwt@2.0.0"

  "repertoire/identity.user#handler.ts@1.2.0":
    kind: handler
    spec_version: "1.2.0"
    compatible_spec: ">=1.0.0 <2.0.0"
    content_hash: "sha256:ghi789..."
    integrity: "sha256-anotherhash=="
    artifact_url: "https://registry.clef.dev/blobs/sha256:ghi789..."
    dependencies:
      - "repertoire/identity.user@1.2.0"
```

---

## Part II: Adding Package Management to the Clef App Itself

### The Incremental Bootstrap Strategy

The key insight: Clef itself is built with concepts. Package management concepts can be added incrementally to the Clef CLI, starting with the smallest useful subset and growing.

### Phase 0: Pre-Package (Current State)

Today, Clef projects are manually structured. The Repertoire ships bundled. There's no resolution, no lockfile, no registry. Concepts are included by copying suite directories.

### Phase 1: Manifest + Lockfile Only (Week 1-2)

**Add:** Manifest, Lockfile concepts.
**Effect:** Developers declare dependencies in `clef.yaml` under a new `packages:` section. The lockfile is initially hand-written or generated by a simple "snapshot current state" command.

```yaml
# clef.yaml addition
packages:
  dependencies:
    - module: repertoire/identity.user
      version: "^1.2.0"
      kind: concept
    - module: repertoire/identity.password
      version: "^1.1.0"
      kind: concept
  target_languages: [typescript, rust]
```

**CLI commands:**
- `clef lock` — Generates `clef.lock.yaml` from current state (no resolution yet, just snapshot)
- `clef verify` — Checks that installed modules match lockfile

**Why start here:** The lockfile is the universal serialization boundary. Everything downstream depends on it. Getting the format right early is critical.

### Phase 2: ContentStore + Fetcher (Week 3-4)

**Add:** ContentStore, Fetcher concepts.
**Effect:** Modules are stored in `.clef/store/` by content hash. Fetcher can download from HTTP URLs. The `clef install` command reads the lockfile and fetches missing modules.

**CLI commands:**
- `clef install` — Reads `clef.lock.yaml`, fetches missing blobs to `.clef/store/`, extracts to project directories
- `clef cache stats` — Shows ContentStore utilization
- `clef cache clean` — Garbage collection

**Why now:** CAS is the single most impactful architectural decision. It immediately provides deduplication and integrity.

### Phase 3: Registry + Resolver (Week 5-8)

**Add:** Registry, Resolver, FeatureFlag concepts.
**Effect:** Full dependency resolution. `clef add <module>` modifies the manifest and resolves. The Repertoire becomes a real registry.

**CLI commands:**
- `clef add repertoire/identity.user` — Adds to manifest, resolves, updates lockfile, fetches, installs
- `clef update` — Resolves with latest compatible versions
- `clef update repertoire/identity.user` — Selective update
- `clef search identity` — Search the registry
- `clef why repertoire/identity.jwt` — Explain why a module is included
- `clef resolve` — Re-resolve without installing (dry run)

**Registry bootstrap:** The Repertoire's suites are published to a Git-backed sparse index at `https://index.clef.dev/`. Each suite's concepts, syncs, handlers, and widgets become individual modules.

### Phase 4: Installer with Generations (Week 9-10)

**Add:** Installer concept (full staged/transactional).
**Effect:** Installation becomes atomic. Rollback is possible. Multiple generations coexist.

**CLI commands:**
- `clef install` — Now uses staged installation with generation tracking
- `clef rollback` — Reverts to previous generation
- `clef generations` — Lists installation generations

### Phase 5: Publisher + Auditor (Week 11-14)

**Add:** Publisher, Auditor concepts.
**Effect:** Community can publish modules. Security scanning on install.

**CLI commands:**
- `clef publish` — Package and upload a module
- `clef audit` — Scan dependencies for known vulnerabilities
- `clef audit --fix` — Auto-update to patched versions where available
- `clef sbom` — Generate CycloneDX SBOM

### Phase 6: Bind + Surface + Deploy Integration (Week 15-18)

**Add:** Integration syncs connecting package management to existing Clef subsystems.

**New syncs:**
```
sync InstallTriggersGenerate [eager]
  when Installer/activate() -> ok()
  then SchemaGen/generate(concepts: newly installed concept modules)
```

```
sync InstallTriggersBind [eager]
  when Installer/activate() -> ok()
  then Generator/plan(concepts: newly installed concept modules, interface_manifest: project interfaces)
```

```
sync InstallTriggersSurface [eager]
  when Installer/activate() -> ok()
  then WidgetParser/parse(widgets: newly installed widget modules)
  then ThemeParser/parse(themes: newly installed theme modules)
```

**Effect:** `clef add repertoire/content.comment` automatically:
1. Resolves dependencies
2. Fetches from registry
3. Installs with CAS
4. Generates handler skeletons in target languages
5. Generates Bind interfaces (REST, CLI, MCP, etc.)
6. Generates Surface UI components (React, SwiftUI, etc.)
7. Updates the Score

### Phase 7: Testing + Formal Verification (Week 19-22)

**Add syncs:** Integration with Test Suite for automated quality gates.

```
sync AuditGatesPublish [eager]
  when Publisher/package() -> ok(publication: u)
  then Auditor/checkPolicy(lockfile_entries: Publisher.dependencies(u), policy: project_policy)
  where Auditor/checkPolicy() -> violations(audit: a)
  then Publisher/upload() BLOCKED
```

```
sync ConformanceOnInstall [eventual]
  when Installer/activate() -> ok()
  then Conformance/verify(concepts: newly installed concept modules)
```

**Formal verification integration:** When a concept module is published, the Publisher can require that:
- All invariants have passing conformance tests
- All sync chains have contract tests
- Handler implementations pass type-checking in all target languages

---

## Part III: Building New Clef Apps with Package Management

### Design Principle: Creation Is Concepts, Not CLI

Creating a new Clef app is NOT a CLI feature — it's a set of independent concepts with their own state, actions, and operational principles. `clef create` (CLI), a web-based project builder, an MCP tool ("create me a Clef app for..."), and a REST API endpoint are all just Bind renderings of the same underlying concepts. Surface can render the same concepts as an interactive wizard UI, a form, or a conversational flow.

This means an LLM can create a Clef app by calling the same actions a human uses through a CLI — through MCP or Claude Skills, querying TargetProfile options, selecting modules, and invoking ProjectInit.

### New App Suite (`suites/new-app/`)

Four concepts handle the "what do you want to build?" question. They compose with the Package Suite concepts (Manifest, Resolver, Fetcher, Installer) via syncs to produce a running project.

---

#### Concept 11: AppTemplate

```
@version(1)
concept AppTemplate [T] {

  purpose {
    Curated starting configurations for common app patterns. Each template
    declares which concepts, syncs, widgets, themes, and handler strategies
    make up a coherent starting point. Templates are themselves modules
    published to the Repertoire.
  }

  state {
    templates: set T
    name: T -> String
    description: T -> String
    category: T -> String               // "social" | "cms" | "ecommerce" | "api" | "tool"
    included_modules: T -> list {
      module_id: String,
      kind: String,
      required: Bool,                   // false = user can deselect
      rationale: String                 // why this module is included
    }
    included_syncs: T -> list String
    suggested_derived: T -> list {      // derived concept compositions the template recommends
      name: String,
      composes: list String
    }
    default_features: T -> list {
      module_id: String,
      features: list String
    }
    compatible_languages: T -> list String
    compatible_platforms: T -> list String
    minimum_concepts: T -> Int          // floor — can't deselect below this
  }

  actions {
    action list(category: option String) {
      -> ok(templates: list T) {
        Returns available templates, optionally filtered by category.
      }
    }

    action detail(name: String) {
      -> ok(template: T) {
        Full template description including all included modules,
        rationale for each, and suggested derived concepts.
      }
      -> notfound(message: String) { Template doesn't exist. }
    }

    action customize(template: T, add: list String, remove: list String, features: list {module_id: String, features: list String}) {
      -> ok(customized: T) {
        Returns a modified template with additions/removals applied.
        Cannot remove required modules.
      }
      -> invalid(errors: list String) {
        Tried to remove required modules, or additions conflict.
      }
    }

    action register(name: String, description: String, category: String, modules: list, syncs: list) {
      -> ok(template: T) { Registers a new template (for community/org publishing). }
      -> duplicate(message: String) { Name already taken. }
    }
  }

  invariant {
    after customize(template: t, add: [], remove: ["x"], features: [])
    where t.included_modules includes {module_id: "x", required: true}
    then -> invalid(errors: es)
    and  es includes "Cannot remove required module"
  }
}
```

---

#### Concept 12: TargetProfile

```
@version(1)
concept TargetProfile [P] {

  purpose {
    Captures the full deployment target specification for a project:
    which backend languages, frontend frameworks, API interface types,
    deployment platforms, and infrastructure choices. Independent of
    which concepts are selected — this is purely about WHERE and HOW
    code will run, not WHAT it does.
  }

  state {
    profiles: set P
    name: P -> String
    backend_languages: P -> list String       // "typescript" | "rust" | "go" | "python" | "swift" | "solidity"
    frontend_frameworks: P -> list String     // "react" | "vue" | "svelte" | "swiftui" | "compose" | "react-native" | "ink"
    api_interfaces: P -> list String          // "rest" | "graphql" | "grpc" | "cli" | "mcp" | "claude-skills"
    sdk_languages: P -> list String           // which typed client libraries to generate
    deploy_targets: P -> list String          // "local" | "vercel" | "lambda" | "cloudrun" | "cloudflare" | "k8s" | "docker-compose"
    storage_adapters: P -> list String        // "postgres" | "sqlite" | "mongodb" | "dynamodb" | "memory"
    transport_adapters: P -> list String      // "http" | "grpc" | "ws" | "nats"
  }

  actions {
    action create(name: String) {
      -> ok(profile: P) {
        Creates an empty profile. Fields are populated via set* actions.
      }
    }

    action setBackendLanguages(profile: P, languages: list String) {
      -> ok() { Sets backend languages. At least one required. }
      -> invalid(unsupported: list String) { Unrecognized language identifiers. }
    }

    action setFrontendFrameworks(profile: P, frameworks: list String) {
      -> ok() { Sets frontend frameworks. Empty list means API-only project. }
      -> invalid(unsupported: list String) { Unrecognized framework identifiers. }
    }

    action setApiInterfaces(profile: P, interfaces: list String) {
      -> ok() { Sets API interface targets. }
      -> invalid(unsupported: list String) { Unrecognized interface identifiers. }
    }

    action setSdkLanguages(profile: P, languages: list String) {
      -> ok() { Sets which typed SDK client libraries to generate. }
    }

    action setDeployTargets(profile: P, targets: list String) {
      -> ok() { Sets deployment targets. }
      -> incompatible(conflicts: list String) {
        Some deploy targets are incompatible with selected languages/frameworks.
      }
    }

    action setStorageAdapters(profile: P, adapters: list String) {
      -> ok() { Sets storage backend preferences. }
    }

    action setTransportAdapters(profile: P, adapters: list String) {
      -> ok() { Sets transport preferences. }
    }

    action validate(profile: P) {
      -> ok() { Profile is complete and internally consistent. }
      -> incomplete(missing: list String) { Required fields not set. }
      -> incompatible(conflicts: list String) {
        E.g., SwiftUI frontend requires Swift backend or React Native,
        Solidity backend can't target Vercel, etc.
      }
    }

    action deriveModules(profile: P) {
      -> ok(modules: list {module_id: String, kind: String, rationale: String}) {
        Computes the infrastructure modules implied by this profile:
        handler generators per language, bind targets per API interface,
        surface adapters per frontend framework, deploy providers per target,
        storage/transport adapters. These are NOT app concepts — they're
        the toolchain modules needed to serve this profile.
      }
    }

    action listOptions() {
      -> ok(options: {
        backend_languages: list {id: String, name: String, description: String},
        frontend_frameworks: list {id: String, name: String, description: String},
        api_interfaces: list {id: String, name: String, description: String},
        deploy_targets: list {id: String, name: String, description: String},
        storage_adapters: list {id: String, name: String, description: String},
        transport_adapters: list {id: String, name: String, description: String}
      }) {
        Returns all available options for each profile dimension.
        Used by any surface (CLI, web UI, MCP) to present choices.
      }
    }
  }

  invariant {
    after setBackendLanguages(profile: p, languages: ["typescript"])
    then validate(profile: p) -> ok()
    // A profile with at least one backend language is minimally valid
  }
}
```

---

#### Concept 13: ModuleSelection

```
@version(1)
concept ModuleSelection [S] {

  purpose {
    Computes the complete set of modules a project needs by combining
    an AppTemplate's concept modules with a TargetProfile's infrastructure
    modules. Handles user additions, removals, handler strategy choices,
    and widget/theme selection. Produces a dependency list ready for
    the Manifest concept.
  }

  state {
    selections: set S
    template_name: S -> option String
    profile_name: S -> option String
    selected_concepts: S -> list {
      module_id: String,
      source: String                    // "template" | "user" | "dependency"
    }
    selected_syncs: S -> list {
      module_id: String,
      source: String
    }
    selected_handlers: S -> list {
      concept_module: String,
      handler_module: String,           // specific premade handler chosen
      language: String
    }
    selected_widgets: S -> list {
      module_id: String,
      source: String
    }
    selected_themes: S -> list String
    selected_bind_targets: S -> list String   // from TargetProfile
    selected_sdk_providers: S -> list String  // from TargetProfile
    selected_deploy_providers: S -> list String // from TargetProfile
    derived_concepts: S -> list {
      name: String,
      composes: list String
    }
    all_modules: S -> list {            // the final flattened list
      module_id: String,
      kind: String,
      version_range: String,
      features: list String,
      source: String
    }
  }

  actions {
    action begin(template_name: option String, profile_name: option String) {
      -> ok(selection: S) {
        Starts a selection session. If template is provided, pre-populates
        concept/sync/widget selections from it. If profile is provided,
        pre-populates infrastructure modules from TargetProfile/deriveModules.
      }
      -> template_notfound(message: String) { Template doesn't exist. }
      -> profile_notfound(message: String) { Profile doesn't exist. }
    }

    action addConcept(selection: S, module_id: String, features: list String) {
      -> ok() { Adds a concept module to the selection. }
      -> already_selected(message: String) { Already in selection. }
    }

    action removeConcept(selection: S, module_id: String) {
      -> ok() { Removes a concept. }
      -> required(message: String) { Template marks this as required. }
      -> has_dependents(dependents: list String) {
        Other selected syncs or derived concepts depend on this.
        Lists them so user can decide.
      }
    }

    action chooseHandler(selection: S, concept_module: String, handler_module: String) {
      -> ok() {
        Selects a specific premade handler implementation for a concept.
        If no handler is chosen, skeleton generation is the fallback.
      }
      -> incompatible(message: String) {
        Handler's compatible_spec doesn't match concept's version.
      }
      -> language_mismatch(message: String) {
        Handler language not in TargetProfile.
      }
    }

    action addWidget(selection: S, module_id: String) {
      -> ok() { Adds a widget module. }
    }

    action selectTheme(selection: S, theme_module: String) {
      -> ok() { Selects a theme. Replaces previous selection. }
    }

    action addDerived(selection: S, name: String, composes: list String) {
      -> ok() {
        Adds a derived concept composition. All composed concepts must
        be in the selection.
      }
      -> missing_concepts(missing: list String) {
        Some composed concepts aren't selected.
      }
    }

    action finalize(selection: S) {
      -> ok(all_modules: list) {
        Flattens all selections into a single module list with version
        ranges, kinds, and features. Ready for Manifest/add.
      }
      -> incomplete(issues: list String) {
        Missing required syncs, handler language gaps, etc.
      }
    }

    action preview(selection: S) {
      -> ok(summary: {
        concept_count: Int,
        sync_count: Int,
        handler_count: Int,
        widget_count: Int,
        languages: list String,
        frameworks: list String,
        api_interfaces: list String,
        deploy_targets: list String,
        estimated_module_count: Int
      }) {
        Human-readable summary of what this selection will produce.
        Useful for any surface to show a preview before committing.
      }
    }
  }

  invariant {
    after begin(template_name: "social", profile_name: none) -> ok(selection: s)
    then preview(selection: s) -> ok(summary: sum)
    and  sum.concept_count > 0
  }
}
```

---

#### Concept 14: ProjectInit

```
@version(1)
concept ProjectInit [J] {

  purpose {
    Creates the physical project structure on disk: directory tree,
    clef.yaml with all package declarations, interface manifests,
    deploy manifests, and triggers the full resolution-fetch-install-generate
    pipeline. The final step in new app creation.
  }

  state {
    inits: set J
    project_name: J -> String
    project_path: J -> String
    module_list: J -> list {            // from ModuleSelection/finalize
      module_id: String,
      kind: String,
      version_range: String,
      features: list String
    }
    profile: J -> {
      backend_languages: list String,
      frontend_frameworks: list String,
      api_interfaces: list String,
      deploy_targets: list String
    }
    derived_concepts: J -> list {
      name: String,
      composes: list String
    }
    status: J -> String                 // "pending" | "scaffolding" | "resolving" | "installing" | "generating" | "complete" | "failed"
    error: J -> option String
    created_files: J -> list String     // all files created, for reporting
  }

  actions {
    action create(project_name: String, project_path: String, module_list: list, profile: {}, derived_concepts: list) {
      -> ok(init: J) {
        Creates the project directory structure:
        - clef.yaml with packages section populated from module_list
        - concepts/, syncs/, widgets/, themes/ directories
        - interfaces/ with manifests derived from profile.api_interfaces
        - deploys/ with manifests derived from profile.deploy_targets
        - handlers/ with subdirectories per profile.backend_languages
        - generated/, bind/, tests/, .clef/ directories
        Sets status to "scaffolding".
      }
      -> already_exists(message: String) { Directory already exists. }
      -> invalid_path(message: String) { Path is not writable. }
    }

    action writeManifest(init: J) {
      -> ok() {
        Writes clef.yaml with all module declarations, registries,
        target languages, resolution policy. Sets status to "resolving".
      }
      -> error(message: String) { Write failure. }
    }

    action writeInterfaceManifests(init: J) {
      -> ok() {
        Writes interface manifests to interfaces/ based on profile:
        - api.interface.yaml for REST + GraphQL
        - cli.interface.yaml if CLI selected
        - mcp.interface.yaml if MCP selected
        - grpc.interface.yaml if gRPC selected
      }
    }

    action writeDeployManifests(init: J) {
      -> ok() {
        Writes deploy manifests to deploys/ based on profile:
        - local.deploy.yaml always
        - vercel.deploy.yaml, lambda.deploy.yaml, etc. per targets
      }
    }

    action writeDerivedConcepts(init: J) {
      -> ok() {
        Writes .derived files for the application's derived concept
        hierarchy. E.g., if user selected Registration (User + Password + JWT),
        writes registration.derived with composes and surface actions.
      }
    }

    action triggerInstall(init: J) {
      -> ok() {
        Triggers the full package chain: resolve → lockfile → fetch → install.
        Sets status to "installing". This action is the bridge to the
        Package Suite — it invokes Manifest/validate which starts the sync chain.
      }
      -> error(message: String) { Resolution or installation failure. }
    }

    action triggerGenerate(init: J) {
      -> ok() {
        Triggers code generation: SchemaGen → language generators → Bind → Surface.
        Sets status to "generating".
      }
      -> error(message: String) { Generation failure. }
    }

    action complete(init: J) {
      -> ok(summary: {
        project_path: String,
        created_files: list String,
        concept_count: Int,
        handler_skeletons: list String,
        generated_interfaces: list String,
        next_steps: list String
      }) {
        Marks creation as complete. Returns a summary suitable for
        any surface to display — CLI prints it, web UI shows a dashboard,
        MCP returns it as structured data.
      }
    }
  }

  invariant {
    after create(project_name: "my-app", project_path: "/tmp/my-app", module_list: ms, profile: p, derived_concepts: ds) -> ok(init: j)
    then complete(init: j) -> ok(summary: s)
    and  s.concept_count > 0
  }
}
```

---

### New App Syncs

These wire the four new-app concepts together and bridge to the Package Suite:

```
sync TemplateToSelection [eager]
  when AppTemplate/customize() -> ok(customized: t)
  then ModuleSelection/begin(
    template_name: AppTemplate.name(t),
    profile_name: none
  )
```

```
sync ProfileToSelection [eager]
  when TargetProfile/validate() -> ok()
  then TargetProfile/deriveModules(profile: p) -> ok(modules: infra_modules)
  // infra_modules are added to the selection as infrastructure deps
```

```
sync SelectionToInit [eager]
  when ModuleSelection/finalize() -> ok(all_modules: ms)
  then ProjectInit/create(
    project_name: from_context,
    project_path: from_context,
    module_list: ms,
    profile: TargetProfile state,
    derived_concepts: ModuleSelection.derived_concepts
  )
```

```
sync InitScaffoldChain [eager]
  when ProjectInit/create() -> ok(init: j)
  then ProjectInit/writeManifest(init: j)
  then ProjectInit/writeInterfaceManifests(init: j)
  then ProjectInit/writeDeployManifests(init: j)
  then ProjectInit/writeDerivedConcepts(init: j)
```

```
sync InitToPackageChain [eager]
  when ProjectInit/writeManifest() -> ok()
  then ProjectInit/triggerInstall(init: j)
  // This invokes Manifest/validate, which triggers the Package Suite sync chain:
  // Manifest/validate → Resolver/resolve → Lockfile/write → Fetcher/fetchBatch → Installer/stage → Installer/activate
```

```
sync InstallToGenerate [eager]
  when Installer/activate() -> ok()
  then ProjectInit/triggerGenerate(init: j)
  // Triggers: SchemaGen → TypeScriptGen/RustGen/etc → Bind Generator → Surface WidgetParser/ThemeParser
```

```
sync GenerateToComplete [eager]
  when ProjectInit/triggerGenerate() -> ok()
  then ProjectInit/complete(init: j)
```

### Derived Concept: NewApp

The entire creation flow is itself a derived concept:

```
derived NewApp {
  purpose {
    Full lifecycle of creating a new Clef application from template
    selection through running project. Composes template browsing,
    target profile specification, module selection, and project
    initialization with the full package management pipeline.
  }

  composes AppTemplate, TargetProfile, ModuleSelection, ProjectInit,
           Manifest, Resolver, Lockfile, Fetcher, ContentStore, Installer

  syncs {
    required: [
      template-to-selection,
      profile-to-selection,
      selection-to-init,
      init-scaffold-chain,
      init-to-package-chain,
      install-to-generate,
      generate-to-complete
    ]
  }

  surface action createFromTemplate(template: String, profile: {}) {
    matches: AppTemplate/detail(name: template)
  }

  surface action createCustom(concepts: list String, profile: {}) {
    matches: ModuleSelection/begin(template_name: none, profile_name: none)
  }

  surface action browseTemplates(category: option String) {
    matches: AppTemplate/list(category: category)
  }

  surface action configureTargets() {
    matches: TargetProfile/listOptions()
  }

  surface action previewProject() {
    matches: ModuleSelection/preview()
  }

  surface query status() -> ProjectInit.status
  surface query summary() -> ProjectInit/complete()

  principle {
    after createFromTemplate(template: "social", profile: {backend_languages: ["typescript"]})
    then status() eventually equals "complete"
  }
}
```

### How This Renders Through Bind Targets

Because these are concepts, they automatically get every Bind target:

**CLI** (`clef create`):
```bash
# Interactive mode — CLI Bind renders TargetProfile/listOptions and AppTemplate/list
# as interactive prompts, ModuleSelection/preview as a summary, ProjectInit/complete as output
$ clef create my-app

# Non-interactive mode — all actions called with flags
$ clef create my-app \
  --template social \
  --languages typescript,rust \
  --frontend react,swiftui \
  --apis rest,graphql,mcp,cli \
  --deploy local,vercel

# Custom mode — select concepts individually
$ clef create my-app --custom \
  --concepts user,password,jwt,article,comment \
  --languages typescript
```

**MCP** (for LLMs):
```json
{
  "tool": "NewApp/createFromTemplate",
  "input": {
    "template": "social",
    "profile": {
      "backend_languages": ["typescript"],
      "frontend_frameworks": ["react"],
      "api_interfaces": ["rest", "mcp"],
      "deploy_targets": ["vercel"]
    }
  }
}
```

**REST API** (for a web-based project builder):
```
POST /api/new-app/create-from-template
{
  "template": "social",
  "profile": { ... }
}

GET /api/new-app/templates?category=social
GET /api/new-app/target-options
POST /api/new-app/preview
```

**Surface UI** (React, SwiftUI, etc.):
The same concepts render as a multi-step wizard, a single-page form, or a conversational flow — the Surface layer decides presentation, the concepts provide the actions and state.

### Suite Manifest for New App Suite

```yaml
suite:
  name: new-app
  version: 0.1.0
  description: "Project creation and bootstrapping for new Clef applications"

concepts:
  AppTemplate:
    spec: ./app-template.concept
    params:
      T: { as: template, description: "A curated app starting configuration" }
  TargetProfile:
    spec: ./target-profile.concept
    params:
      P: { as: profile, description: "A deployment target specification" }
  ModuleSelection:
    spec: ./module-selection.concept
    params:
      S: { as: selection, description: "A computed set of modules for a project" }
  ProjectInit:
    spec: ./project-init.concept
    params:
      J: { as: init, description: "A project creation lifecycle" }

syncs:
  required:
    - template-to-selection
    - profile-to-selection
    - selection-to-init
    - init-scaffold-chain
    - init-to-package-chain
    - install-to-generate
    - generate-to-complete

uses:
  - suite: package
    concepts:
      - name: Manifest
      - name: Resolver
      - name: Lockfile
      - name: Fetcher
      - name: ContentStore
      - name: Installer
  - suite: generation
    concepts:
      - name: Emitter
  - suite: framework
    concepts:
      - name: SchemaGen
  - suite: scaffolding
    concepts:
      - name: ProjectScaffold
```

### What ProjectInit/create Produces

The ProjectInit concept creates this structure. Every surface (CLI, web, MCP) receives the same `created_files` list and `summary` from ProjectInit/complete:

```
my-app/
├── clef.yaml                        # Project config with packages section
├── clef.lock.yaml                   # Resolved, deterministic lockfile
├── concepts/                        # Pulled from Repertoire
│   ├── user.concept
│   ├── password.concept
│   ├── jwt.concept
│   ├── profile.concept
│   ├── article.concept
│   ├── comment.concept
│   ├── tag.concept
│   ├── follow.concept
│   └── favorite.concept
├── syncs/                           # Pulled from Repertoire
│   ├── registration-flow.sync
│   ├── article-publish.sync
│   ├── comment-thread.sync
│   └── social-feed.sync
├── widgets/                         # Pulled from Repertoire
│   ├── user-profile.widget
│   ├── article-card.widget
│   ├── comment-thread.widget
│   └── ...
├── themes/
│   ├── light.theme
│   └── dark.theme
├── interfaces/                      # Generated from template
│   ├── api.interface.yaml           # REST + GraphQL
│   ├── cli.interface.yaml
│   └── mcp.interface.yaml
├── deploys/
│   ├── local.deploy.yaml
│   └── vercel.deploy.yaml
├── handlers/
│   ├── ts/                          # TypeScript handler skeletons
│   │   ├── user.handler.ts          # <-- Developer fills these in
│   │   ├── article.handler.ts
│   │   └── ...
│   └── rust/                        # Rust handler skeletons
│       ├── user_handler.rs
│       └── ...
├── generated/                       # Fully disposable
│   ├── ts/
│   ├── rust/
│   ├── graphql/
│   ├── openapi/
│   ├── react/
│   └── swiftui/
├── bind/                            # Fully disposable
│   ├── rest/
│   ├── graphql/
│   ├── cli/
│   ├── mcp/
│   ├── sdk-ts/
│   └── sdk-rust/
├── tests/
│   ├── conformance/                 # Auto-generated
│   └── contract/                    # Auto-generated
└── .clef/
    ├── store/                       # Content-addressed blob store
    ├── score/
    ├── build/
    └── cache/
```

### The `clef.yaml` for the New App

```yaml
project:
  name: my-app
  version: 0.1.0

packages:
  registries:
    - name: repertoire
      url: https://index.clef.dev
      scope: repertoire

  dependencies:
    # Concept modules
    - module: repertoire/identity.user
      version: "^1.0.0"
      kind: concept
    - module: repertoire/identity.password
      version: "^1.0.0"
      kind: concept
    - module: repertoire/identity.jwt
      version: "^2.0.0"
      kind: concept
    - module: repertoire/social.profile
      version: "^1.0.0"
      kind: concept
    - module: repertoire/content.article
      version: "^1.0.0"
      kind: concept
    - module: repertoire/content.comment
      version: "^1.0.0"
      kind: concept
    - module: repertoire/classification.tag
      version: "^1.0.0"
      kind: concept
    - module: repertoire/social.follow
      version: "^1.0.0"
      kind: concept
    - module: repertoire/social.favorite
      version: "^1.0.0"
      kind: concept

    # Sync modules
    - module: repertoire/syncs.registration-flow
      version: "^1.0.0"
      kind: sync
    - module: repertoire/syncs.article-publish
      version: "^1.0.0"
      kind: sync

    # Handler modules (premade implementations)
    - module: repertoire/handlers.user-postgres-ts
      version: "^1.0.0"
      kind: handler
      features: [oauth, mfa]
    - module: repertoire/handlers.user-postgres-rust
      version: "^1.0.0"
      kind: handler

    # Widget modules
    - module: repertoire/widgets.user-profile
      version: "^1.0.0"
      kind: widget
    - module: repertoire/widgets.article-card
      version: "^1.0.0"
      kind: widget

    # Theme
    - module: repertoire/themes.default-light
      version: "^1.0.0"
      kind: theme

    # Bind target providers
    - module: repertoire/bind.rest
      version: "^1.0.0"
      kind: bind-target
    - module: repertoire/bind.graphql
      version: "^1.0.0"
      kind: bind-target
    - module: repertoire/bind.mcp
      version: "^1.0.0"
      kind: bind-target
    - module: repertoire/bind.cli
      version: "^1.0.0"
      kind: bind-target

    # SDK providers
    - module: repertoire/sdk.typescript
      version: "^1.0.0"
      kind: sdk-provider
    - module: repertoire/sdk.rust
      version: "^1.0.0"
      kind: sdk-provider

  resolution_policy:
    unification_strategy: unified
    feature_unification: additive
    prefer_locked: true
    allowed_updates: minor

  target_languages: [typescript, rust]
  target_platforms: [web, ios]
```

### Suite-Level Shortcuts

For common patterns, suite meta-modules let developers pull everything at once:

```yaml
packages:
  dependencies:
    # This single line pulls all identity concepts, syncs, default handlers, and widgets
    - module: repertoire/suites.identity
      version: "^1.0.0"
      kind: suite-meta
      features: [oauth, mfa, social-login]
```

The suite meta-module's own manifest declares all the individual concept, sync, handler, and widget modules as dependencies. The resolver expands it into the full graph.

### Incremental Customization — Concept Actions

After initial creation, customization uses Manifest and ModuleSelection actions. Below shows the concept action and its CLI Bind rendering side by side:

| Action | CLI Rendering |
|--------|---------------|
| `Manifest/add(module: "repertoire/content.canvas", kind: "concept")` | `clef add repertoire/content.canvas` |
| `ModuleSelection/chooseHandler(concept: "billing.payment", handler: "handlers.stripe-payment-ts")` | `clef add repertoire/billing.payment --handler repertoire/handlers.stripe-payment-ts` |
| `Manifest/remove(module: "repertoire/social.favorite")` | `clef remove repertoire/social.favorite` |
| `Manifest/override(module: "handlers.user-postgres-ts", source: "./handlers/ts/user.handler.ts")` | `clef override repertoire/handlers.user-postgres-ts --with ./handlers/ts/user.handler.ts` |
| `Manifest/add(module: "repertoire/bind.grpc", kind: "bind-target")` | `clef add repertoire/bind.grpc --kind bind-target` |
| `Resolver/resolve(policy: {allowed_updates: "minor"})` | `clef update` |
| `Resolver/explain(module_id: "repertoire/identity.jwt")` | `clef why repertoire/identity.jwt` |
| `Lockfile/diff(old: current, new: proposed)` | `clef resolve --dry-run` |
| `Auditor/audit(lockfile_entries: current)` | `clef audit` |
| `Publisher/generateSbom(publication: current)` | `clef sbom` |

Every one of these is also available as an MCP tool, REST endpoint, GraphQL mutation, or Surface button — because they're concept actions, not CLI features.

### The Module Website — A New Clef App Built with Clef

The Repertoire module website itself should be a Clef app, built using package management. Here's how:

**New concepts for the website:**

```
concept ModuleListing [L] {
  purpose { Browseable listing of published modules with search, filtering, and documentation. }
  state {
    listings: set L
    module_id: L -> String
    display_name: L -> String
    description: L -> String
    readme: L -> String
    latest_version: L -> String
    downloads: L -> Int
    quality_score: L -> Float
    categories: L -> list String
  }
  actions {
    action index(module: {}) { -> ok(listing: L) {} -> error(message: String) {} }
    action search(query: String, filters: {}) { -> ok(results: list L) {} }
    action detail(module_id: String) { -> ok(listing: L) {} -> notfound(message: String) {} }
  }
}

concept ModuleDoc [D] {
  purpose { Auto-generated documentation from concept specs, including action reference, state schema, sync diagrams, and usage examples. }
  state {
    docs: set D
    module_id: D -> String
    spec_html: D -> String
    sync_diagram: D -> String
    usage_examples: D -> list String
    api_reference: D -> String
  }
  actions {
    action generate(module_id: String, spec_content: String) { -> ok(doc: D) {} }
    action get(module_id: String) { -> ok(doc: D) {} -> notfound(message: String) {} }
  }
}

concept DownloadStats [S] {
  purpose { Track download counts, version popularity, and usage trends. }
  state {
    stats: set S
    module_id: S -> String
    version: S -> String
    download_count: S -> Int
    period: S -> String
  }
  actions {
    action record(module_id: String, version: String) { -> ok() {} }
    action query(module_id: String, period: String) { -> ok(stats: list S) {} }
  }
}
```

**The website's `clef.yaml`:**

```yaml
project:
  name: repertoire-web
  version: 0.1.0

packages:
  dependencies:
    # Core identity for user accounts
    - module: repertoire/suites.identity
      version: "^1.0.0"
      kind: suite-meta
      features: [github-oauth]

    # Package management concepts (consuming our own suite!)
    - module: repertoire/package.registry
      version: "^1.0.0"
      kind: concept
    - module: repertoire/package.content-store
      version: "^1.0.0"
      kind: concept
    - module: repertoire/package.auditor
      version: "^1.0.0"
      kind: concept

    # Website-specific concepts
    - module: local/module-listing
      kind: concept
    - module: local/module-doc
      kind: concept
    - module: local/download-stats
      kind: concept

    # Search
    - module: repertoire/query-retrieval.search-index
      version: "^1.0.0"
      kind: concept

    # Bind targets
    - module: repertoire/bind.rest
      version: "^1.0.0"
      kind: bind-target
    - module: repertoire/bind.graphql
      version: "^1.0.0"
      kind: bind-target

  target_languages: [typescript]
  target_platforms: [web]
```

**Website syncs:**

```
sync PublishUpdatesListing [eventual]
  when Registry/publish() -> ok(module: m)
  then ModuleListing/index(module: Registry.metadata(m))
  then ModuleDoc/generate(module_id: Registry.name(m), spec_content: fetch spec)
```

```
sync FetchRecordsDownload [eventual]
  when Fetcher/fetch() -> ok(download: d)
  then DownloadStats/record(module_id: Fetcher.module_id(d), version: Fetcher.version(d))
```

---

## Part III-B: Implementation Plan for Module Website & New App Tooling

### Phase 1: Registry Infrastructure (Week 1-4)

1. Implement Registry concept handlers in TypeScript
2. Set up Git sparse index at `index.clef.dev`
3. Set up OCI blob store (can use GitHub Container Registry initially)
4. Publish all existing Repertoire concepts as individual modules
5. Implement `clef publish` for Repertoire maintainers

### Phase 2: Resolution & Installation (Week 5-8)

1. Implement Resolver (PubGrub) in TypeScript and Rust
2. Implement Lockfile read/write
3. Implement ContentStore with local filesystem backend
4. Implement Fetcher with HTTP parallel downloads
5. Implement Installer with generation-based staging
6. Wire all syncs in the package core chain
7. Add `clef add`, `clef install`, `clef update`, `clef remove` commands

### Phase 3: New App Suite Concepts (Week 9-12)

1. Implement AppTemplate concept — register built-in templates (social, CMS, e-commerce, API service, tool)
2. Implement TargetProfile concept — enumerate all supported options via listOptions
3. Implement ModuleSelection concept — module graph computation from template + profile
4. Implement ProjectInit concept — directory creation, manifest writing, pipeline triggering
5. Implement NewApp derived concept — wires the four together
6. Wire all new-app syncs to Package Suite syncs
7. Create suite meta-modules for each built-in template
8. Publish templates as modules to the Repertoire
9. End-to-end test: NewApp/createFromTemplate → working app with clef dev
10. Verify all four Bind targets work: CLI (`clef create`), REST, MCP, and Claude Skills

### Phase 4: Module Website (Week 11-14)

1. Build the `repertoire-web` Clef app using package management
2. Implement ModuleListing, ModuleDoc, DownloadStats concepts
3. Auto-generate documentation from concept specs (use SchemaGen output)
4. Build React frontend with Surface widgets
5. Deploy to Vercel via Clef deploy
6. Wire up publish → index → doc generation pipeline

### Phase 5: Supply Chain & Quality (Week 15-18)

1. Implement Publisher with signing (Ed25519)
2. Implement SLSA provenance attestation generation
3. Implement CycloneDX SBOM generation
4. Implement Auditor with OSV database integration
5. Add `clef audit`, `clef sbom` commands
6. Add quality gates: conformance tests required for publish

### Phase 6: Multi-Language Handlers & Cross-Platform (Week 19-22)

1. Implement all 10 concept handlers in Go and Python
2. Publish premade handlers for common patterns (Postgres-backed identity, Stripe billing, etc.)
3. Build handler marketplace section on module website
4. Cross-platform testing: verify lockfile portability across TS/Rust/Go/Python
5. Add widget marketplace section with live previews

### Phase 7: Advanced Features (Week 23-26)

1. Private registries (for enterprise/org-scoped modules)
2. Workspaces (monorepo support with shared lockfile, à la Cargo workspaces)
3. `clef doctor` — diagnostic tool that checks project health
4. `clef migrate` — automated migration when concept spec versions bump
5. Offline mode — full resolution and installation from local cache
6. CI/CD integration templates (GitHub Actions, GitLab CI)

---

## Appendix: Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module granularity | Per-concept (suites are meta-packages) | Maximum reuse, fine-grained updates, better provenance |
| Storage model | Content-addressed (SHA-256) | Integrity-by-identity, deduplication, cache safety |
| Resolution algorithm | PubGrub | Human-readable errors, proven implementations, conflict-driven learning |
| Lockfile format | YAML with deterministic key ordering | Human-readable diffs, Clef ecosystem alignment |
| Registry metadata | Git sparse index | Offline-friendly, mirrorable, efficient incremental updates |
| Artifact storage | OCI blob store | Industry standard, existing infrastructure, referrer support for attestations |
| Signing | Ed25519 (publisher) + TUF (repository metadata) | Modern, fast, compromise-resilient |
| SBOM format | CycloneDX (primary), SPDX (export) | Better automation, VEX support |
| Feature model | Additive unification (default), per-dependent isolation (opt-in) | Follows Cargo's proven model |
| Versioning | Dual: spec_version + impl_version | Specs and implementations evolve independently |
| Manifest format | YAML (clef.yaml packages section) | Consistent with existing Clef manifests |
| Installation model | Generational with atomic activation | Rollback support, never partial states |
| Conflict messages | PubGrub derivation trees | Users can understand WHY resolution failed |
| Build hooks | Part of Installer lifecycle | Not a separate concept — hooks are installation side-effects |
| Provenance | SLSA Level 2 minimum for published modules | Verifiable build origin without requiring hermetic builds initially |
