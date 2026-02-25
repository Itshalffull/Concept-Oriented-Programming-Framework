# COPF Build Layer — Deploy Kit Extension

## Design Principle

The same coordination + provider pattern used by Runtime, Secret, and IaC. **Builder** is a coordination concept that owns the shared build interface — what gets built, what the result is, what status it's in. **Toolchain** is a coordination concept that owns tool resolution — what compiler version, where it lives, whether it's installed. Provider concepts own the language-specific logic: how to invoke `tsc`, how to invoke `rustc`, what flags each needs. Both register providers through **PluginRegistry**.

This is NOT a new kit. It extends the existing deploy kit with two coordination concepts and their providers, fitting into the same deploy manifest (`app.deploy.yaml`) and the same DeployPlan DAG.

### Why This Exists

The deploy layer has a gap between generated source and deployable artifact:

```
.concept spec
    │
    ▼ (generation kit — exists)
Generated TypeScript / Rust / Swift / Solidity source
    │
    ▼ (??? — this document)
Compiled, tested, packaged artifacts
    │
    ▼ (deploy kit — exists)
Running infrastructure
```

Artifact already provides content-addressed, immutable output storage. But Artifact's `build` action is a black box with no `target` parameter, no `language` parameter, no toolchain resolution, and no execution strategy. It can't answer "build all concepts using a remote Swift compiler."

Builder and Toolchain fill this gap following the exact pattern Runtime established:

```
┌─────────────────────┐     integration sync     ┌─────────────────────┐
│  Runtime (coord.)   │────── runtimeType ──────▶│  LambdaRuntime      │
│  • instance registry│       "aws-lambda"        │  (provider)         │
└─────────────────────┘                           └─────────────────────┘

┌─────────────────────┐     integration sync     ┌─────────────────────┐
│  Builder (coord.)   │────── language ─────────▶│  SwiftBuilder       │
│  • build registry   │       "swift"             │  (provider)         │
└─────────────────────┘                           └─────────────────────┘

┌─────────────────────┐     integration sync     ┌─────────────────────┐
│  Toolchain (coord.) │────── language ─────────▶│  SwiftToolchain     │
│  • tool registry    │       "swift"             │  (provider)         │
└─────────────────────┘                           └─────────────────────┘
```

---

## Conceptual Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   COPF Deploy Kit (extended)                            │
│                                                                         │
│  Existing Orchestration Concepts:                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │DeployPlan│ │ Rollout  │ │Migration │ │  Health  │ │   Env    │    │
│  └────┬─────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│       │                                                                 │
│  Existing Concepts:                                                     │
│  ┌──────────┐ ┌──────────┐                                             │
│  │Telemetry │ │ Artifact │ ◀── Builder produces, Artifact stores       │
│  └──────────┘ └──────────┘                                             │
│                                                                         │
│  NEW — Build Coordination:     Build Provider Concepts:                 │
│  ┌──────────┐                  ┌────────────────┐ ┌────────────────┐   │
│  │ Builder  │──[route syncs]──▶│TypeScriptBuilder│ │  SwiftBuilder  │…  │
│  └──────────┘                  └────────────────┘ └────────────────┘   │
│  ┌──────────┐                  ┌────────────────┐ ┌────────────────┐   │
│  │Toolchain │──[route syncs]──▶│TypeScriptToolch.│ │ SwiftToolchain │…  │
│  └──────────┘                  └────────────────┘ └────────────────┘   │
│                                                                         │
│  Existing Coordination:        Existing Providers:                      │
│  ┌──────────┐                  ┌──────────────┐ ┌──────────────┐      │
│  │ Runtime  │──[route syncs]──▶│LambdaRuntime │ │  EcsRuntime  │ …    │
│  └──────────┘                  └──────────────┘ └──────────────┘      │
│  ┌──────────┐                  ┌──────────────┐ ┌──────────────┐      │
│  │  Secret  │──[route syncs]──▶│VaultProvider │ │AwsSmProvider │ …    │
│  └──────────┘                  └──────────────┘ └──────────────┘      │
│  ┌──────────┐                  ┌──────────────┐ ┌──────────────┐      │
│  │   IaC    │──[route syncs]──▶│PulumiProvider│ │  TfProvider  │ …    │
│  └──────────┘                  └──────────────┘ └──────────────┘      │
│                                                                         │
│  NEW Syncs:                                                             │
│  DeployPlan/execute → Toolchain/resolve (per target)                   │
│  Toolchain/resolve → ok → Builder/build (per concept × target)         │
│  Builder/build → ok → Artifact/store (content-addressed)               │
│  Artifact/store → ok → Runtime/deploy (existing flow continues)        │
│  Toolchain/resolve → [route] → SwiftToolchain/resolve (integration)    │
│  Builder/build → [route] → SwiftBuilder/build (integration)            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Concepts

### 1.1 Toolchain (Coordination Concept)

The stable interface for tool resolution. Builder talks to Toolchain. Toolchain owns the registry of what tools are available, their versions, and their locations — regardless of language. Provider concepts own the language-specific resolution logic.

**Independent purpose test:** "Is `swiftc` 5.10 installed? Where? Is it compatible with `linux-arm64`?" — answerable without building anything.

```
@version(1)
concept Toolchain [T] {

  purpose {
    Coordinate tool resolution across languages and platforms.
    Owns the resolved-tool registry: what tools are available,
    their versions, paths, and capabilities. Provider-agnostic —
    Builder invokes Toolchain actions, and integration syncs
    route to the active language provider concept.
  }

  state {
    tools: set T
    registry {
      language: T -> String
      platform: T -> String
      version: T -> String
      path: T -> String
      capabilities: T -> list String
      resolvedAt: T -> DateTime
      status: T -> String
    }
    constraints {
      versionRange: T -> option String
      requiredCapabilities: T -> option list String
    }
  }

  actions {
    action resolve(language: String, platform: String, versionConstraint: option String) {
      -> ok(tool: T, version: String, path: String, capabilities: list String) {
        Resolve a toolchain for the given language and platform.
        Completion arrives after the provider concept finishes
        actual resolution (checking PATH, version validation,
        download if configured). Toolchain records the result
        in its registry.

        Capabilities describe what the tool supports:
        "incremental", "wasm-target", "cross-compile",
        "remote-execution", "debug-symbols", etc.
      }
      -> notInstalled(language: String, platform: String, installHint: String) {
        Tool not found. installHint suggests how to install
        (e.g., "brew install swift", "rustup target add wasm32").
      }
      -> versionMismatch(language: String, installed: String, required: String) {
        Tool found but wrong version. Returns both so the
        user can decide whether to upgrade.
      }
      -> platformUnsupported(language: String, platform: String) {
        This language's toolchain doesn't support the
        requested target platform.
      }
    }

    action validate(tool: T) {
      -> ok(tool: T, version: String) {
        Verify a previously resolved toolchain is still valid.
        Tool exists at recorded path, version matches, not
        corrupted. Used before build to catch environment drift.
      }
      -> invalid(tool: T, reason: String) {
        Tool moved, uninstalled, or version changed since
        last resolution. Re-resolve required.
      }
    }

    action list(language: option String) {
      -> ok(tools: list { language: String, platform: String, version: String, path: String, status: String }) {
        List all resolved toolchains, optionally filtered by
        language. Used by `copf toolchain list`.
      }
    }

    action capabilities(tool: T) {
      -> ok(capabilities: list String) {
        Return detailed capabilities for a resolved tool.
        Used by Builder to determine available build modes.
      }
    }
  }

  invariant {
    after resolve(language: "swift", platform: "linux-arm64", versionConstraint: ">=5.10")
      -> ok(tool: t, version: "5.10.1", path: "/usr/bin/swiftc", capabilities: ["cross-compile"])
    then validate(tool: t) -> ok(tool: t, version: "5.10.1")
    and  list(language: "swift") -> ok(tools: ts)
  }
}
```


### 1.2 Toolchain Provider Concepts

Each provider has sovereign state and language-specific resolution logic. Never referenced outside the deploy kit — only reached through integration syncs from Toolchain.

#### SwiftToolchain

```
@version(1)
concept SwiftToolchain [S] {

  purpose {
    Resolve Swift compiler toolchains. Owns Swift-specific
    resolution: Xcode toolchains vs standalone swiftc, Swift
    Package Manager detection, platform SDK paths, and
    cross-compilation target validation.
  }

  state {
    toolchains: set S
    config {
      swiftcPath: S -> String
      swiftVersion: S -> String
      sdkPath: S -> option String
      xcodeVersion: S -> option String
      spmPath: S -> option String
      supportedTargets: S -> list String
    }
  }

  actions {
    action resolve(platform: String, versionConstraint: option String) {
      -> ok(toolchain: S, swiftcPath: String, version: String, capabilities: list String) {
        Locate swiftc on the system. Check version against
        constraint. Detect Xcode vs standalone installation.
        Resolve platform SDK path for cross-compilation.
        Return capabilities based on Swift version:
        5.9+ has "macros", 5.10+ has "swift-testing",
        6.0+ has "typed-throws".
      }
      -> notInstalled(installHint: String) {
        swiftc not found. Hint: "Install via Xcode or
        download from swift.org/download"
      }
      -> xcodeRequired(reason: String) {
        Platform target requires Xcode (e.g., iOS, watchOS).
      }
    }
  }
}
```

#### TypeScriptToolchain

```
@version(1)
concept TypeScriptToolchain [N] {

  purpose {
    Resolve TypeScript compiler and bundler toolchains. Owns
    TypeScript-specific resolution: tsc version, Node.js version,
    bundler detection (esbuild, webpack, vite), and tsconfig
    target validation.
  }

  state {
    toolchains: set N
    config {
      tscPath: N -> String
      tscVersion: N -> String
      nodePath: N -> String
      nodeVersion: N -> String
      bundler: N -> option { name: String, path: String, version: String }
      packageManager: N -> String
    }
  }

  actions {
    action resolve(platform: String, versionConstraint: option String) {
      -> ok(toolchain: N, tscPath: String, version: String, capabilities: list String) {
        Locate tsc (global or project-local in node_modules/.bin).
        Detect Node.js version and bundler. Return capabilities:
        "esm", "cjs", "declaration-maps", "composite-projects",
        "bundler-resolution", etc.
      }
      -> notInstalled(installHint: String) {
        tsc not found. Hint: "npm install -g typescript" or
        "npx tsc" for project-local.
      }
      -> nodeVersionMismatch(installed: String, required: String) {
        Node.js version too old for requested TypeScript features.
      }
    }
  }
}
```

#### RustToolchain

```
@version(1)
concept RustToolchain [R] {

  purpose {
    Resolve Rust compiler toolchains. Owns Rust-specific
    resolution: rustup channel management, target triple
    installation, cargo feature detection, and wasm-pack
    availability.
  }

  state {
    toolchains: set R
    config {
      rustcPath: R -> String
      rustcVersion: R -> String
      channel: R -> String
      cargoPath: R -> String
      installedTargets: R -> list String
      wasmPackPath: R -> option String
    }
  }

  actions {
    action resolve(platform: String, versionConstraint: option String) {
      -> ok(toolchain: R, rustcPath: String, version: String, capabilities: list String) {
        Check rustup for requested channel (stable/nightly).
        Verify target triple is installed. Detect wasm-pack
        if platform is wasm32. Return capabilities:
        "wasm-target", "proc-macros", "incremental", etc.
      }
      -> notInstalled(installHint: String) {
        rustup/rustc not found.
      }
      -> targetMissing(target: String, installHint: String) {
        Requested target triple not installed.
        Hint: "rustup target add wasm32-unknown-unknown"
      }
    }
  }
}
```

#### SolidityToolchain

```
@version(1)
concept SolidityToolchain [L] {

  purpose {
    Resolve Solidity compiler toolchains. Owns Solidity-specific
    resolution: solc version management (solc-select), Foundry
    detection, Hardhat integration, and EVM version targeting.
  }

  state {
    toolchains: set L
    config {
      solcPath: L -> String
      solcVersion: L -> String
      evmVersion: L -> String
      foundryPath: L -> option String
      hardhatPath: L -> option String
    }
  }

  actions {
    action resolve(platform: String, versionConstraint: option String) {
      -> ok(toolchain: L, solcPath: String, version: String, capabilities: list String) {
        Locate solc. Check version against Solidity pragma.
        Detect Foundry/Hardhat for test infrastructure.
        Return capabilities: "optimizer", "via-ir",
        "foundry-tests", "hardhat-tests", etc.
      }
      -> notInstalled(installHint: String) {
        solc not found.
      }
      -> evmVersionUnsupported(requested: String, supported: list String) {
        Requested EVM version not supported by installed solc.
      }
    }
  }
}
```


### 1.3 Builder (Coordination Concept)

The stable interface for all build operations. DeployPlan talks to Builder. Builder owns the build registry — what's been built, for what target, with what result — regardless of language. Provider concepts own the language-specific compilation steps.

**Independent purpose test:** "What has been built? What's the build status for the Swift target? Did the tests pass?" — answerable without deploying anything.

```
@version(1)
concept Builder [B] {

  purpose {
    Coordinate compilation, testing, and packaging across
    languages. Owns the build registry: what was built, for
    what language and platform, with what toolchain, and what
    the result was. Provider-agnostic — DeployPlan invokes
    Builder actions, and integration syncs route to the
    active language provider concept.
  }

  state {
    builds: set B
    registry {
      concept: B -> String
      language: B -> String
      platform: B -> String
      config: B -> { mode: String, features: option list String }
      toolchainRef: B -> String
      status: B -> String
      startedAt: B -> DateTime
      completedAt: B -> option DateTime
      duration: B -> option Int
    }
    results {
      artifactHash: B -> option String
      artifactLocation: B -> option String
      testsPassed: B -> option Int
      testsFailed: B -> option Int
      testsSkipped: B -> option Int
      warnings: B -> option list String
      errors: B -> option list String
    }
  }

  actions {
    action build(concept: String, source: String, language: String, platform: String, config: { mode: String, features: option list String }) {
      -> ok(build: B, artifactHash: String, artifactLocation: String, duration: Int) {
        Compile, test, and package the concept implementation
        for the specified language and platform. Completion
        arrives after the provider concept finishes actual
        compilation. Builder records the result in its registry.

        The provider:
        1. Resolves Toolchain for the language+platform
        2. Compiles the source
        3. Runs tests (unless config.mode = "skip-tests")
        4. Packages the output
        5. Returns content-addressed artifact

        If an artifact with matching input hash already exists
        in Artifact, returns it without rebuilding (cache hit
        through Artifact's content-addressing).
      }
      -> compilationError(concept: String, language: String, errors: list { file: String, line: Int, message: String }) {
        Compilation failed. Structured errors with file locations
        for IDE integration.
      }
      -> testFailure(concept: String, language: String, passed: Int, failed: Int, failures: list { test: String, message: String }) {
        Compilation succeeded but tests failed. Returns
        pass/fail counts and failure details.
      }
      -> toolchainError(concept: String, language: String, reason: String) {
        Toolchain resolution failed before compilation started.
        Propagated from Toolchain concept.
      }
    }

    action buildAll(concepts: list String, source: String, targets: list { language: String, platform: String }, config: { mode: String, features: option list String }) {
      -> ok(results: list { concept: String, language: String, artifactHash: String, duration: Int }) {
        Build multiple concepts across multiple targets.
        Independent targets build in parallel. Returns
        per-concept, per-target results.
      }
      -> partial(completed: list { concept: String, language: String, artifactHash: String }, failed: list { concept: String, language: String, error: String }) {
        Some builds succeeded, some failed.
      }
    }

    action test(concept: String, language: String, platform: String) {
      -> ok(passed: Int, failed: Int, skipped: Int, duration: Int) {
        Run tests only (no compilation — assumes already built).
        Used for re-running tests after a build.
      }
      -> testFailure(passed: Int, failed: Int, failures: list { test: String, message: String }) {
        Some tests failed.
      }
      -> notBuilt(concept: String, language: String) {
        No build artifact found — must build first.
      }
    }

    action status(build: B) {
      -> ok(build: B, status: String, duration: option Int) {
        Current build status. Statuses: "pending", "compiling",
        "testing", "packaging", "done", "failed".
      }
    }

    action history(concept: String, language: option String) {
      -> ok(builds: list { language: String, platform: String, artifactHash: String, duration: Int, completedAt: DateTime, testsPassed: Int }) {
        Build history for a concept, optionally filtered by
        language. Used by `copf build history`.
      }
    }
  }

  invariant {
    after build(concept: "password", source: "./generated/swift/password", language: "swift", platform: "linux-arm64", config: { mode: "release" })
      -> ok(build: b, artifactHash: "sha256:abc", artifactLocation: ".copf-artifacts/swift/password", duration: 3200)
    then status(build: b) -> ok(build: b, status: "done", duration: 3200)
    and  history(concept: "password", language: "swift") -> ok(builds: bs)
  }
}
```


### 1.4 Builder Provider Concepts

Each provider owns the compilation pipeline for its language. Never referenced outside the deploy kit.

#### SwiftBuilder

```
@version(1)
concept SwiftBuilder [S] {

  purpose {
    Compile, test, and package Swift concept implementations.
    Owns Swift-specific build logic: Swift Package Manager
    invocation, test runner integration, framework packaging,
    and XCFramework generation for multi-platform.
  }

  state {
    builds: set S
    config {
      packagePath: S -> String
      buildDir: S -> String
      configuration: S -> String
      targetTriple: S -> option String
      additionalFlags: S -> option list String
    }
    testResults {
      testSuite: S -> option String
      xcresultPath: S -> option String
    }
  }

  actions {
    action build(source: String, toolchainPath: String, platform: String, config: { mode: String, features: option list String }) {
      -> ok(build: S, artifactPath: String, artifactHash: String) {
        Run `swift build` with the resolved toolchain.
        Configuration maps from COPF modes:
        "debug" → swift build (default)
        "release" → swift build -c release

        For cross-compilation, passes --triple to swiftc.
        Packages result as .framework or .xcframework.
      }
      -> compilationError(errors: list { file: String, line: Int, message: String }) {
        swiftc reported errors.
      }
      -> linkerError(reason: String) {
        Compilation succeeded but linking failed.
        Common for missing platform SDKs.
      }
    }

    action test(build: S, toolchainPath: String) {
      -> ok(passed: Int, failed: Int, skipped: Int, duration: Int) {
        Run `swift test` against the built product.
        Parses XCTest / swift-testing output.
      }
      -> testFailure(passed: Int, failed: Int, failures: list { test: String, message: String }) {
        Some tests failed. Parses failure messages from
        test runner output.
      }
    }

    action package(build: S, format: String) {
      -> ok(artifactPath: String, artifactHash: String) {
        Package built artifact. Formats:
        "framework" → .framework bundle
        "xcframework" → multi-platform .xcframework
        "binary" → standalone executable
        "library" → .dylib / .so / .a
      }
      -> formatUnsupported(format: String) {
        Requested format not available for this target.
      }
    }
  }
}
```

#### TypeScriptBuilder

```
@version(1)
concept TypeScriptBuilder [N] {

  purpose {
    Compile, test, and package TypeScript concept implementations.
    Owns TypeScript-specific build logic: tsc invocation, bundler
    integration (esbuild/webpack/vite), test runner integration
    (jest/vitest), and npm package generation.
  }

  state {
    builds: set N
    config {
      projectPath: N -> String
      outDir: N -> String
      tsconfigTarget: N -> String
      moduleFormat: N -> String
      bundler: N -> option String
    }
  }

  actions {
    action build(source: String, toolchainPath: String, platform: String, config: { mode: String, features: option list String }) {
      -> ok(build: N, artifactPath: String, artifactHash: String) {
        Run tsc for type-checking + bundler for output.
        Platform determines module format:
        "node-20" → ESM with Node.js target
        "browser" → ESM with bundler, tree-shaking
        "cjs" → CommonJS for legacy compatibility

        Mode determines optimization:
        "debug" → source maps, no minification
        "release" → minification, dead code elimination
      }
      -> typeError(errors: list { file: String, line: Int, message: String }) {
        tsc reported type errors.
      }
      -> bundleError(reason: String) {
        Bundler (esbuild/webpack) failed.
      }
    }

    action test(build: N, toolchainPath: String) {
      -> ok(passed: Int, failed: Int, skipped: Int, duration: Int) {
        Run jest/vitest against the built output.
        Auto-detects test runner from project config.
      }
      -> testFailure(passed: Int, failed: Int, failures: list { test: String, message: String }) {
        Some tests failed.
      }
    }

    action package(build: N, format: String) {
      -> ok(artifactPath: String, artifactHash: String) {
        Package built artifact. Formats:
        "npm" → npm-publishable tarball (with package.json)
        "bundle" → single-file bundle for deployment
        "docker" → Dockerfile + built output
      }
      -> formatUnsupported(format: String) {
        Requested format not available.
      }
    }
  }
}
```

#### RustBuilder

```
@version(1)
concept RustBuilder [R] {

  purpose {
    Compile, test, and package Rust concept implementations.
    Owns Rust-specific build logic: cargo invocation, feature
    flag management, WASM compilation via wasm-pack, and
    crate packaging.
  }

  state {
    builds: set R
    config {
      manifestPath: R -> String
      targetDir: R -> String
      profile: R -> String
      features: R -> option list String
      targetTriple: R -> option String
    }
  }

  actions {
    action build(source: String, toolchainPath: String, platform: String, config: { mode: String, features: option list String }) {
      -> ok(build: R, artifactPath: String, artifactHash: String) {
        Run `cargo build` with resolved toolchain.
        Mode mapping:
        "debug" → cargo build (dev profile)
        "release" → cargo build --release

        For WASM targets, uses wasm-pack if available.
        Feature flags passed through from config.
      }
      -> compilationError(errors: list { file: String, line: Int, message: String }) {
        rustc reported errors.
      }
      -> featureConflict(conflicting: list String) {
        Incompatible feature flags.
      }
    }

    action test(build: R, toolchainPath: String) {
      -> ok(passed: Int, failed: Int, skipped: Int, duration: Int) {
        Run `cargo test`. Parses test harness output.
      }
      -> testFailure(passed: Int, failed: Int, failures: list { test: String, message: String }) {
        Some tests failed.
      }
    }

    action package(build: R, format: String) {
      -> ok(artifactPath: String, artifactHash: String) {
        Formats:
        "crate" → cargo-publishable crate
        "binary" → standalone executable
        "wasm-pack" → npm-publishable WASM package
        "docker" → Dockerfile + binary
      }
      -> formatUnsupported(format: String) { ... }
    }
  }
}
```

#### SolidityBuilder

```
@version(1)
concept SolidityBuilder [L] {

  purpose {
    Compile, test, and package Solidity concept implementations.
    Owns Solidity-specific build logic: solc invocation, ABI
    generation, Foundry/Hardhat test execution, and deployment
    artifact packaging.
  }

  state {
    builds: set L
    config {
      contractsPath: L -> String
      outputDir: L -> String
      optimizer: L -> Bool
      optimizerRuns: L -> Int
      evmVersion: L -> String
    }
  }

  actions {
    action build(source: String, toolchainPath: String, platform: String, config: { mode: String, features: option list String }) {
      -> ok(build: L, artifactPath: String, artifactHash: String) {
        Run solc. Generate both bytecode and ABI.
        Mode mapping:
        "debug" → no optimizer
        "release" → optimizer enabled with configured runs

        Always produces ABI alongside bytecode — ABI is
        essential for client generation.
      }
      -> compilationError(errors: list { file: String, line: Int, message: String }) {
        solc reported errors.
      }
      -> pragmaMismatch(required: String, installed: String) {
        Contract's Solidity pragma doesn't match compiler.
      }
    }

    action test(build: L, toolchainPath: String) {
      -> ok(passed: Int, failed: Int, skipped: Int, duration: Int) {
        Run Foundry (`forge test`) or Hardhat (`npx hardhat test`).
        Auto-detects from project config.
      }
      -> testFailure(passed: Int, failed: Int, failures: list { test: String, message: String }) {
        Some tests failed. Includes gas usage in test output.
      }
    }

    action package(build: L, format: String) {
      -> ok(artifactPath: String, artifactHash: String) {
        Formats:
        "abi-bundle" → ABI JSON + bytecode for deployment
        "hardhat-artifacts" → Hardhat-compatible artifact dir
        "foundry-out" → Foundry-compatible output
      }
      -> formatUnsupported(format: String) { ... }
    }
  }
}
```


### 1.5 Artifact (Updated)

Artifact gains a `store` action to separate storage from compilation. Builder produces artifacts, Artifact stores them.

```
# Added to existing Artifact concept

  actions {
    # EXISTING — unchanged, still works for simple cases
    action build(concept: String, spec: String, implementation: String, deps: list String) {
      -> ok(artifact: A, hash: String, sizeBytes: Int) { ... }
      -> compilationError(concept: String, errors: list String) { ... }
    }

    # NEW — store a pre-built artifact from Builder
    action store(hash: String, location: String, concept: String, language: String, platform: String, metadata: option { toolchainVersion: String, buildMode: String, duration: Int }) {
      -> ok(artifact: A) {
        Store a content-addressed artifact produced by Builder.
        If artifact with same hash already exists, return it
        (deduplication). Records language, platform, and build
        metadata for provenance.
      }
      -> alreadyExists(artifact: A) {
        Artifact with this hash already stored. Idempotent.
      }
    }

    # EXISTING — unchanged
    action resolve(hash: String) { ... }
    action gc(olderThan: DateTime, keepVersions: Int) { ... }
  }
```


---

## Part 2: PluginRegistry Integration

Builder and Toolchain providers register through PluginRegistry, just like generators in the generation kit.

### 2.1 Builder Provider Registration

```
sync RegisterSwiftBuilder [eager]
  purpose { Register SwiftBuilder with PluginRegistry for discovery. }
when {
  SwiftBuilder/register: []
    => ok(name: ?name; language: ?lang; capabilities: ?caps)
}
then {
  PluginRegistry/register: [
    type: "builder";
    name: ?name;
    metadata: {
      language: ?lang;
      concept: "SwiftBuilder";
      action: "build";
      testAction: "test";
      packageAction: "package";
      capabilities: ?caps
    }
  ]
}
```

Each builder provider has a lightweight `register` action:

```
# Added to SwiftBuilder, TypeScriptBuilder, RustBuilder, SolidityBuilder
action register() {
  -> ok(name: String, language: String, capabilities: list String) {
    Return static metadata.
    name: "SwiftBuilder"
    language: "swift"
    capabilities: ["framework", "xcframework", "binary", "library"]
  }
}
```

### 2.2 Toolchain Provider Registration

```
sync RegisterSwiftToolchain [eager]
  purpose { Register SwiftToolchain with PluginRegistry for discovery. }
when {
  SwiftToolchain/register: []
    => ok(name: ?name; language: ?lang)
}
then {
  PluginRegistry/register: [
    type: "toolchain";
    name: ?name;
    metadata: {
      language: ?lang;
      concept: "SwiftToolchain";
      action: "resolve"
    }
  ]
}
```

### 2.3 Discovery

Builder and Toolchain query PluginRegistry to find the right provider:

```
# Builder routes to the right provider for a given language
sync RouteBuilderToSwift [eager]
  purpose { Route Swift builds to SwiftBuilder. }
when {
  Builder/build: [ language: "swift"; source: ?src; platform: ?plat; config: ?cfg ]
    => []
}
then {
  SwiftBuilder/build: [ source: ?src; toolchainPath: ?toolPath; platform: ?plat; config: ?cfg ]
}

# Same pattern for each language
sync RouteBuilderToTypeScript [eager]
when {
  Builder/build: [ language: "typescript"; source: ?src; platform: ?plat; config: ?cfg ]
    => []
}
then {
  TypeScriptBuilder/build: [ source: ?src; toolchainPath: ?toolPath; platform: ?plat; config: ?cfg ]
}

sync RouteBuilderToRust [eager]
when {
  Builder/build: [ language: "rust"; source: ?src; platform: ?plat; config: ?cfg ]
    => []
}
then {
  RustBuilder/build: [ source: ?src; toolchainPath: ?toolPath; platform: ?plat; config: ?cfg ]
}

sync RouteBuilderToSolidity [eager]
when {
  Builder/build: [ language: "solidity"; source: ?src; platform: ?plat; config: ?cfg ]
    => []
}
then {
  SolidityBuilder/build: [ source: ?src; toolchainPath: ?toolPath; platform: ?plat; config: ?cfg ]
}
```

Same routing pattern for Toolchain providers. These are the same mechanical integration syncs as Runtime → LambdaRuntime and Secret → VaultProvider.


---

## Part 3: Deploy Manifest Extension

The deploy manifest gains a `build:` section alongside existing `runtime:`, `secrets:`, and `iac:`.

```yaml
# app.deploy.yaml
kit: content-management
version: 0.4.0

environment: production

# NEW — build configuration
build:
  targets:
    - language: swift
      platform: linux-arm64
      mode: release
      config:
        version: ">=5.10"
        features: ["macros"]
        package-format: framework

    - language: typescript
      platform: node-20
      mode: release
      config:
        version: ">=5.7"
        bundler: esbuild
        package-format: npm

    - language: rust
      platform: linux-x86_64
      mode: release
      config:
        version: ">=1.75"
        features: ["async-runtime"]
        package-format: binary

    - language: solidity
      platform: evm-shanghai
      mode: release
      config:
        version: ">=0.8.20"
        optimizer-runs: 200
        package-format: abi-bundle

  # Optional: remote execution
  executor:
    swift:
      type: remote
      endpoint: https://build.internal/swift
    rust:
      type: remote
      endpoint: https://build.internal/rust

# EXISTING — unchanged
runtime:
  provider: LambdaRuntime
  config:
    memory: 512
    timeout: 30

secrets:
  provider: VaultProvider
  config:
    address: https://vault.internal

iac:
  provider: PulumiProvider
```


---

## Part 4: DeployPlan DAG Extension

DeployPlan's `plan` action reads the `build:` section and inserts new nodes into the deploy graph.

### Extended graph construction

```
For each target in build.targets:
  1. Node: resolve-toolchain/{language}
     Depends on: nothing
     Action: Toolchain/resolve(language, platform, versionConstraint)

  2. Node: build-concept/{concept}/{language}
     Depends on: resolve-toolchain/{language}
     Action: Builder/build(concept, source, language, platform, config)

  3. Node: store-artifact/{concept}/{language}
     Depends on: build-concept/{concept}/{language}
     Action: Artifact/store(hash, location, concept, language, platform)

Existing nodes shift downstream:
  4. Node: provision-storage/{concept}
     Depends on: store-artifact/{concept}/{language} (was: nothing)

  5. Node: deploy-concept/{concept}
     Depends on: provision-storage/{concept} (unchanged)
     Now has artifact hash from store-artifact
```

### Visual comparison

**Before (no build layer):**
```
provision-storage → deploy-concept → configure-transport → register-sync
```

**After (with build layer):**
```
resolve-toolchain ─┬─ build-concept/password/swift ──── store-artifact/password/swift ─┐
                   ├─ build-concept/password/ts ────── store-artifact/password/ts ─────┤
                   └─ build-concept/user/swift ──────── store-artifact/user/swift ──────┤
                                                                                        │
provision-storage ─── deploy-concept ─── configure-transport ─── register-sync ◀────────┘
```

Independent language targets build in parallel. Toolchain resolution happens once per language, shared across concepts.

### Syncs connecting build to deploy

```
sync ToolchainBeforeBuild [eager]
  purpose { Resolve toolchain before Builder runs. }
when {
  DeployPlan/execute: [ plan: ?plan ] => ok()
}
then {
  Toolchain/resolve: [ language: ?lang; platform: ?plat; versionConstraint: ?ver ]
}

sync BuildAfterToolchain [eager]
  purpose { Start builds once toolchain is resolved. }
when {
  Toolchain/resolve: [ language: ?lang; platform: ?plat ]
    => ok(tool: ?tool; version: ?ver; path: ?path)
}
then {
  Builder/build: [ concept: ?concept; source: ?src; language: ?lang; platform: ?plat; config: ?cfg ]
}

sync StoreAfterBuild [eager]
  purpose { Store built artifacts in content-addressed Artifact. }
when {
  Builder/build: [ concept: ?concept; language: ?lang; platform: ?plat ]
    => ok(build: ?b; artifactHash: ?hash; artifactLocation: ?loc; duration: ?dur)
}
then {
  Artifact/store: [
    hash: ?hash;
    location: ?loc;
    concept: ?concept;
    language: ?lang;
    platform: ?plat;
    metadata: { toolchainVersion: ?ver; buildMode: ?mode; duration: ?dur }
  ]
}

sync DeployAfterStore [eager]
  purpose { Existing deploy flow picks up stored artifact. }
when {
  Artifact/store: [ concept: ?concept ] => ok(artifact: ?a)
}
then {
  Runtime/deploy: [ instance: ?instance; artifact: ?a; version: ?ver ]
}
```


---

## Part 5: Standalone Build (`copf build`)

`copf build` executes the build portion of the DeployPlan DAG and stops at `store-artifact`. Same plan, truncated execution.

```bash
# Build all targets defined in deploy manifest
copf build ./app.deploy.yaml

# Build specific language
copf build ./app.deploy.yaml --language swift

# Build specific concept
copf build ./app.deploy.yaml --concept password

# Build with mode override
copf build ./app.deploy.yaml --mode debug

# Dry run — show what would build
copf build ./app.deploy.yaml --plan
# Output:
# Build Plan bp-2026-02-24-001
# ├─ Toolchain: swift 5.10 (linux-arm64) — installed ✅
# ├─ Toolchain: typescript 5.7 (node-20) — installed ✅
# ├─ Toolchain: rust 1.78 (linux-x86_64) — installed ✅
# ├─ Toolchain: solidity 0.8.25 (evm-shanghai) — installed ✅
# │
# ├─ Build: password (swift, release) — source changed, will build
# ├─ Build: password (typescript, release) — cached ✅
# ├─ Build: password (rust, release) — source changed, will build
# ├─ Build: password (solidity, release) — cached ✅
# ├─ Build: user (swift, release) — source changed, will build
# └─ Build: user (typescript, release) — cached ✅
#
# Total: 6 builds, 3 cached, 3 to execute

# Toolchain management
copf toolchain list
copf toolchain resolve swift --platform linux-arm64 --version ">=5.10"
copf toolchain validate

# Build history
copf build history --concept password
copf build history --concept password --language swift

# Run tests only (no compile)
copf build test --concept password --language swift
```


---

## Part 6: Kit Packaging

```yaml
# kits/deploy/kit.yaml (extended — additions only)

concepts:
  # EXISTING concepts unchanged...

  # NEW — Build coordination
  Builder:
    spec: ./concepts/builder.concept
    params:
      B: { as: build-ref, description: "Reference to a build record" }

  Toolchain:
    spec: ./concepts/toolchain.concept
    params:
      T: { as: tool-ref, description: "Reference to a resolved toolchain" }

  # NEW — Build provider concepts (load what you need)
  TypeScriptBuilder:
    spec: ./concepts/providers/typescript-builder.concept
    optional: true

  SwiftBuilder:
    spec: ./concepts/providers/swift-builder.concept
    optional: true

  RustBuilder:
    spec: ./concepts/providers/rust-builder.concept
    optional: true

  SolidityBuilder:
    spec: ./concepts/providers/solidity-builder.concept
    optional: true

  TypeScriptToolchain:
    spec: ./concepts/providers/typescript-toolchain.concept
    optional: true

  SwiftToolchain:
    spec: ./concepts/providers/swift-toolchain.concept
    optional: true

  RustToolchain:
    spec: ./concepts/providers/rust-toolchain.concept
    optional: true

  SolidityToolchain:
    spec: ./concepts/providers/solidity-toolchain.concept
    optional: true

syncs:
  # EXISTING syncs unchanged...

  # NEW — Build syncs
  recommended:
    - path: ./syncs/toolchain-before-build.sync
      name: ToolchainBeforeBuild
    - path: ./syncs/build-after-toolchain.sync
      name: BuildAfterToolchain
    - path: ./syncs/store-after-build.sync
      name: StoreAfterBuild

  integration:
    # EXISTING routing syncs unchanged...

    # NEW — Builder routing
    - path: ./syncs/routing/route-builder-to-typescript.sync
      name: RouteBuilderTypeScript
    - path: ./syncs/routing/route-builder-to-swift.sync
      name: RouteBuilderSwift
    - path: ./syncs/routing/route-builder-to-rust.sync
      name: RouteBuilderRust
    - path: ./syncs/routing/route-builder-to-solidity.sync
      name: RouteBuilderSolidity

    # NEW — Toolchain routing
    - path: ./syncs/routing/route-toolchain-to-typescript.sync
      name: RouteToolchainTypeScript
    - path: ./syncs/routing/route-toolchain-to-swift.sync
      name: RouteToolchainSwift
    - path: ./syncs/routing/route-toolchain-to-rust.sync
      name: RouteToolchainRust
    - path: ./syncs/routing/route-toolchain-to-solidity.sync
      name: RouteToolchainSolidity

    # NEW — Builder registration
    - path: ./syncs/registration/register-typescript-builder.sync
      name: RegisterTypeScriptBuilder
    - path: ./syncs/registration/register-swift-builder.sync
      name: RegisterSwiftBuilder
    - path: ./syncs/registration/register-rust-builder.sync
      name: RegisterRustBuilder
    - path: ./syncs/registration/register-solidity-builder.sync
      name: RegisterSolidityBuilder
```


---

## Part 7: Design Decisions

### Why Builder and Toolchain are separate concepts

Toolchain answers "what tools exist." Builder answers "compile this source." They have independent state and independent lifecycles:

- Toolchain state changes when you install/upgrade a compiler. Builder state changes when you build something.
- You can query toolchains without building (`copf toolchain list`). You can't build without a toolchain.
- Toolchain resolution is shared across concepts — resolve `swiftc` once, use it for every concept's Swift build. Builder runs per-concept.

If merged, you'd have one concept trying to own both tool inventory and compilation history. Same reason Runtime and IaC are separate — provisioning compute and provisioning infrastructure are different concerns even though both happen during deployment.

### Why Builder, not stuffing build into Artifact

Artifact's purpose is "immutable, content-addressed storage." It's the Nix store — it doesn't care how things got there, just that they have a hash and a location. If you add toolchain resolution, language-specific compilation, and test execution to Artifact, it becomes a god concept that owns storage AND compilation AND testing.

Builder produces artifacts. Artifact stores them. Emitter writes files. Three concepts, three clean responsibilities.

### Why provider concepts instead of configuration

You could model `SwiftBuilder` as just a configuration of `Builder` — set `language: swift` and let Builder's implementation dispatch internally. But then Builder's implementation would need to know about every language's compilation steps, test runners, packaging formats, and error shapes. Adding a new language means modifying Builder's implementation.

With provider concepts, adding a new language (e.g., `KotlinBuilder`) is:
1. Write the provider concept spec
2. Write the provider implementation
3. Write one routing sync and one registration sync
4. Done — Builder, Toolchain, DeployPlan, and Artifact don't change.

This is the same argument for why LambdaRuntime and EcsRuntime are concepts, not configuration of Runtime.

### Why these live in the deploy kit, not a new "build kit"

The build step exists to produce deployable artifacts. It reads from the deploy manifest. It feeds into the deploy DAG. Its lifecycle is "prepare for deployment." Putting it in a separate kit would create a cross-kit dependency (deploy kit → build kit → generation kit) with no clear boundary. Keeping it in the deploy kit means one manifest, one DAG, one `copf deploy plan` command that shows the full pipeline from toolchain resolution through build through deployment.

### Executor as a provider-internal concern

The build research identified "Executor" (local, sandboxed, remote execution) as a potential concept. In this design, execution strategy is internal to each builder provider. SwiftBuilder's implementation decides whether to run `swiftc` locally or shell out to a remote build service based on the `executor` config in the deploy manifest. This keeps the coordination concept (Builder) simple — it doesn't need to know about execution strategies.

If remote execution becomes complex enough to warrant its own state (job queues, remote cache hits, worker pool management), it could be extracted as a concept later. For now, it's a provider implementation detail.


---

## Part 8: Answering the Original Question

> "If I wanted to build all concepts using a remote Swift compiler, how would I do it?"

```yaml
# app.deploy.yaml
build:
  targets:
    - language: swift
      platform: linux-arm64
      mode: release
      config:
        version: ">=5.10"
        package-format: framework

  executor:
    swift:
      type: remote
      endpoint: https://build.internal/swift
      auth: vault://ci/swift-builder-token
```

```bash
copf build ./app.deploy.yaml --language swift
```

What happens:

1. DeployPlan reads manifest, sees `build.targets[swift]`
2. `Toolchain/resolve(language: "swift", platform: "linux-arm64")` → routes to `SwiftToolchain/resolve`
3. SwiftToolchain checks remote endpoint availability, validates version
4. `Builder/build(concept: *, language: "swift", ...)` → routes to `SwiftBuilder/build` for each concept
5. SwiftBuilder's implementation sees `executor.swift.type: remote`, sends compilation to `https://build.internal/swift`
6. Remote build completes → `Artifact/store(hash, location, concept, "swift", "linux-arm64")`
7. All concept artifacts stored, build phase complete
8. If `copf deploy execute` follows, deploy phase picks up the stored artifacts

The coordination concepts (Builder, Toolchain) don't know about remote execution. SwiftBuilder's implementation does. The deploy manifest configures it. The sync engine orchestrates it.


---

## Part 9: Concept Count Impact

| Addition | Count |
|---|---|
| Builder (coordination) | 1 |
| Toolchain (coordination) | 1 |
| TypeScriptBuilder, SwiftBuilder, RustBuilder, SolidityBuilder (providers) | 4 |
| TypeScriptToolchain, SwiftToolchain, RustToolchain, SolidityToolchain (providers) | 4 |
| **Total new concepts** | **10** |

Artifact gains one action (`store`). DeployPlan gains new DAG node types in its `plan` action. No existing concepts are modified beyond these additions.

The routing and registration syncs follow the established mechanical pattern — one routing sync + one registration sync per provider, identical structure, auto-generatable from PluginRegistry metadata.
