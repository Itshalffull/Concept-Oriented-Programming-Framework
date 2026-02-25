# copf builder — Help

Use when compiling, testing, and packaging concept implementations across languages. Coordinates build operations and routes to language-specific providers (SwiftBuilder, TypeScriptBuilder, RustBuilder, SolidityBuilder).

> **When to use:** Use when compiling, testing, and packaging concept implementations across languages. Coordinates build operations and routes to language-specific providers (SwiftBuilder, TypeScriptBuilder, RustBuilder, SolidityBuilder).

## Design Principles

- **Coordination, Not Compilation:** Builder coordinates — it never compiles directly. Language-specific provider concepts own compilation logic.
- **Content-Addressed Artifacts:** Build outputs are stored in Artifact with content-addressed hashes. Same inputs always produce same artifact.
- **Executor Transparency:** Builder doesn't know whether builds run locally, remotely, or in containers. Execution strategy is a provider-internal concern.

**build:**
- [ ] Toolchain resolved for language+platform?
- [ ] Source directory exists and is non-empty?
- [ ] Config mode is valid (debug/release/skip-tests)?
- [ ] Artifact hash is content-addressed?

**buildAll:**
- [ ] All target languages have resolved toolchains?
- [ ] Independent targets build in parallel?
- [ ] Partial results reported if some builds fail?

**test:**
- [ ] Build artifact exists for this concept+language?
- [ ] Test runner detected for language?

**status:**
- [ ] Build reference is valid?

**history:**
- [ ] Language filter is valid (if provided)?

## References

- [Build pipeline architecture](references/build-pipeline.md)

## Supporting Materials

- [Multi-target build walkthrough](examples/build-all-targets.md)

## Quick Reference

| Action | Command | Purpose |
|--------|---------|---------|
| build | `copf build` | Compile, test, package one concept |
| buildAll | `copf build` (all targets) | Build all concepts for all targets |
| test | `copf build test` | Run tests only (no compile) |
| status | `copf build status` | Check build status |
| history | `copf build history` | Show build history |


## Anti-Patterns

### Building without toolchain resolution
Calling Builder/build before Toolchain/resolve — compilation will fail.

**Bad:**
```
# Skip toolchain resolution
Builder/build(concept: "password", language: "swift", ...)
```

**Good:**
```
# Resolve first, then build
Toolchain/resolve(language: "swift", platform: "linux-arm64")
# -> ok(tool, version, path)
Builder/build(concept: "password", language: "swift", ...)
```

### Monolithic build action
Putting compilation, testing, and packaging logic in Builder instead of provider concepts.

**Bad:**
```
# Builder implementation knows about swiftc flags
if (language === "swift") { exec("swiftc -c release ..."); }
```

**Good:**
```
# Builder routes to SwiftBuilder which owns swift-specific logic
SwiftBuilder/build(source, toolchainPath, platform, config)
```

## Validation

*Build all targets:*
```bash
copf build ./app.deploy.yaml
```
*Build specific language:*
```bash
copf build ./app.deploy.yaml --language swift
```
*Dry run (show build plan):*
```bash
copf build ./app.deploy.yaml --plan
```
*Run tests only:*
```bash
copf build test --concept password --language swift
```

## Related Skills

- toolchain-management — Resolve toolchains before building
- deployment-config — Deploy built artifacts

