# Clef — Concept-Oriented Programming Framework

## Project Conventions

### Naming & Comments
- **Never reference implementation phases or ordering** in code comments, file names, test names, or descriptions. Name and organize everything by logical function.
- Comments should reference architecture doc section numbers (e.g., "Section 16.12") not phase numbers.

## CLI Commands

```bash
# Run tests
npx vitest run                          # all tests
npx vitest run tests/                   # unit tests only
npx vitest run generated/tests/         # conformance tests only

# Generate code from concept specs (TypeScript, Rust, Swift, etc.)
npx tsx cli/src/main.ts generate
npx tsx cli/src/main.ts generate --concept Foo --target typescript

# Regenerate conformance tests from concept specs
npx tsx scripts/generate-all-tests.ts

# Regenerate interface bindings (MCP tools, CLI commands, skills)
npx tsx --tsconfig tsconfig.json -e "
  const { interfaceCommand } = await import('./cli/src/commands/interface.ts');
  await interfaceCommand(['generate'], { manifest: 'examples/devtools/devtools.interface.yaml' });
"
# This regenerates: .claude/mcp/**/*, cli/src/**/*.command.ts, .claude/skills/**/
```

## Concept Spec Syntax

See `.claude/skills/create-concept/references/concept-grammar.md` for the full grammar.

Key constructs: `concept`, `state`, `actions` (with `fixture` declarations), `invariant` (six kinds: `example`, `forall`, `always`, `never`, `eventually`, `requires`/`ensures`).

### Fixtures

Named input examples declared inside action blocks after variants:
```
action create(name: String, config: String) {
  -> ok(id: T)
  -> error(message: String)
  fixture valid { name: "hello", config: "{\"timeout\": 30}" }
  fixture empty {} -> error
}
```
- Omitting `-> variant` defaults to `ok`
- Used for deterministic behavioral tests and as default inputs for structural tests
- Every action should have at least one `ok` fixture and negative fixtures for error variants
- The `# @fixtures-added` comment at the top of a `.concept` file marks it as migrated

## Architecture

Pipeline: `.concept` spec -> Parser -> `ConceptAST` -> SchemaGen -> `ConceptManifest` -> CodeGen/TestGen -> output files.

Handlers use the StorageProgram DSL (functional) by default. The DSL builds instruction sequences that are interpreted, analyzed, or serialized — never executed directly.

## Key Directories

| Path | Contents |
|------|----------|
| `specs/` | `.concept` spec files (the source of truth) |
| `handlers/ts/` | TypeScript handler implementations |
| `runtime/` | Core runtime: types, storage, interpreter, storage-program DSL |
| `generated/tests/` | Auto-generated conformance tests |
| `.claude/mcp/` | Auto-generated MCP tool definitions |
| `.claude/skills/` | Claude Code skill prompts |
| `cli/src/` | CLI commands (mix of hand-written and auto-generated) |
| `examples/devtools/` | Interface manifest (`devtools.interface.yaml`) |
| `scripts/` | Utility scripts (test generation, etc.) |
