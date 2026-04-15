# interface_scaffold_gen — MCP Tool Guide

Scaffold an interface.yaml for **{input}** with target configs, SDK settings, and per-concept overrides.


> **When to use:** Use when creating a new interface generation manifest. Generates interface.yaml with target configurations for REST, GraphQL, gRPC, CLI, MCP, and Claude Skills, plus SDK settings and spec outputs.


## Design Principles

- **Target Independence:** Each target (REST, GraphQL, CLI, etc.) generates independently — they share concept specs but produce separate output trees.
- **Layered Configuration:** Configuration flows from global defaults → target defaults → per-concept overrides. Specific settings override general ones.
- **SDK Completeness:** Each SDK target should generate a fully-functional client library — types, methods, error handling, and documentation.
**generate:**
- [ ] Interface name is valid?
- [ ] At least one target is specified?
- [ ] Each target has sensible defaults?
- [ ] SDK package names are unique per language?
- [ ] Per-concept overrides reference valid concepts?
- [ ] Grouping strategy is set?
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?
- [ ] contentNative: true set on targets that serve content-pool entities?
## References

- [Interface manifest (interface.yaml) schema reference](references/interface-manifest-schema.md)
## Supporting Materials

- [Interface manifest scaffolding walkthrough](examples/scaffold-interface.md)
## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | Interface name |
| targets | list String | Target types (rest, graphql, grpc, cli, mcp, claude-skills) |
| sdks | list String | SDK languages (typescript, python, go, rust, java, swift) |
| targetConfigJson | String (JSON) | Per-target settings JSON, e.g. `'{"rest":{"contentNative":true}}'` |
| concepts | list String | Concepts with per-concept overrides |
| openapi | Boolean | Generate OpenAPI spec (default: true) |
| asyncapi | Boolean | Generate AsyncAPI spec (default: false) |


## Anti-Patterns

### Targets without concept overrides
All concepts use the same REST base path — collision risk.

**Bad:**
```
targets:
  rest: { basePath: /api }
# No per-concept overrides — all concepts share /api

```

**Good:**
```
targets:
  rest: { basePath: /api }
concepts:
  User:
    rest: { basePath: /api/users }
  Article:
    rest: { basePath: /api/articles }

```
## Validation

*Generate an interface scaffold:*
```bash
npx tsx cli/src/index.ts scaffold interface --name my-api --targets rest,graphql
```
*Generate interfaces from manifest:*
```bash
npx tsx cli/src/index.ts interface generate --manifest my-api.interface.yaml
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```
**Related tools:** [object Object], [object Object], [object Object]

