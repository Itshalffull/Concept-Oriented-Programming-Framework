// ============================================================
// Parse Kit Handler Behavior Tests
//
// Tests SyntaxTree, LanguageGrammar, and FileArtifact handlers
// using in-memory storage. Validates Tree-sitter WASM integration,
// grammar resolution, file artifact metadata inference, and
// S-expression query capabilities.
//
// See design doc Sections 4.1 (SyntaxTree, LanguageGrammar,
// FileArtifact).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { languageGrammarHandler } from '../handlers/ts/score/parse/language-grammar.handler.js';
import { syntaxTreeHandler, clearTreeCaches } from '../handlers/ts/score/parse/syntax-tree.handler.js';
import { fileArtifactHandler, resetArtifactCounter } from '../handlers/ts/score/parse/file-artifact.handler.js';
import type { ConceptStorage } from '../kernel/src/types.js';

// ============================================================
// 1. LanguageGrammar Handler
// ============================================================

describe('LanguageGrammar Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('registers a grammar and resolves by extension', async () => {
    const reg = await languageGrammarHandler.register(
      { name: 'typescript', extensions: '[".ts",".tsx"]', parserWasmPath: 'tree-sitter-typescript.wasm', nodeTypes: '{}' },
      storage,
    );
    expect(reg.variant).toBe('ok');
    expect(reg.grammar).toBeTruthy();

    const res = await languageGrammarHandler.resolve({ fileExtension: '.ts' }, storage);
    expect(res.variant).toBe('ok');
    expect(res.grammar).toBe(reg.grammar);
  });

  it('resolves .tsx to the same grammar as .ts', async () => {
    const reg = await languageGrammarHandler.register(
      { name: 'typescript', extensions: '[".ts",".tsx"]', parserWasmPath: 'tree-sitter-typescript.wasm', nodeTypes: '{}' },
      storage,
    );

    const res = await languageGrammarHandler.resolve({ fileExtension: '.tsx' }, storage);
    expect(res.variant).toBe('ok');
    expect(res.grammar).toBe(reg.grammar);
  });

  it('returns noGrammar for unknown extension', async () => {
    const res = await languageGrammarHandler.resolve({ fileExtension: '.xyz' }, storage);
    expect(res.variant).toBe('noGrammar');
    expect(res.extension).toBe('.xyz');
  });

  it('rejects duplicate grammar registration', async () => {
    await languageGrammarHandler.register(
      { name: 'json', extensions: '[".json"]', parserWasmPath: 'tree-sitter-json.wasm', nodeTypes: '{}' },
      storage,
    );
    const dup = await languageGrammarHandler.register(
      { name: 'json', extensions: '[".json"]', parserWasmPath: 'tree-sitter-json.wasm', nodeTypes: '{}' },
      storage,
    );
    expect(dup.variant).toBe('alreadyRegistered');
  });

  it('retrieves grammar by ID', async () => {
    const reg = await languageGrammarHandler.register(
      { name: 'yaml', extensions: '[".yaml",".yml"]', parserWasmPath: 'tree-sitter-yaml.wasm', nodeTypes: '{}' },
      storage,
    );
    const get = await languageGrammarHandler.get({ grammar: reg.grammar }, storage);
    expect(get.variant).toBe('ok');
    expect(get.name).toBe('yaml');
    expect(get.parserWasmPath).toBe('tree-sitter-yaml.wasm');
  });

  it('lists all registered grammars', async () => {
    await languageGrammarHandler.register(
      { name: 'typescript', extensions: '[".ts"]', parserWasmPath: 'ts.wasm', nodeTypes: '{}' },
      storage,
    );
    await languageGrammarHandler.register(
      { name: 'json', extensions: '[".json"]', parserWasmPath: 'json.wasm', nodeTypes: '{}' },
      storage,
    );

    const list = await languageGrammarHandler.list({}, storage);
    expect(list.variant).toBe('ok');
    const grammars = JSON.parse(list.grammars as string);
    expect(grammars.length).toBe(2);
  });
});

// ============================================================
// 2. SyntaxTree Handler (Tree-sitter WASM integration)
// ============================================================

describe('SyntaxTree Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
    clearTreeCaches();
  });

  // Helper: register a grammar and store file content
  async function setupGrammarAndFile(
    grammarName: string,
    extensions: string,
    wasmFile: string,
    filePath: string,
    content: string,
  ): Promise<string> {
    const reg = await languageGrammarHandler.register(
      { name: grammarName, extensions, parserWasmPath: wasmFile, nodeTypes: '{}' },
      storage,
    );
    await storage.put('file_content', filePath, { content });
    return reg.grammar as string;
  }

  it('parses a TypeScript file', async () => {
    const grammarId = await setupGrammarAndFile(
      'typescript', '[".ts"]', 'tree-sitter-typescript.wasm',
      'test.ts', 'const x: number = 42;\n',
    );

    const result = await syntaxTreeHandler.parse({ file: 'test.ts', grammar: grammarId }, storage);
    expect(result.variant).toBe('ok');
    expect(result.tree).toBeTruthy();

    // Verify metadata stored
    const get = await syntaxTreeHandler.get({ tree: result.tree }, storage);
    expect(get.variant).toBe('ok');
    expect(get.source).toBe('test.ts');
    expect(get.grammar).toBe(grammarId);
    expect(get.editVersion).toBe(1);
    expect(get.errorRanges).toBe('[]');
  });

  it('parses a JSON file', async () => {
    const grammarId = await setupGrammarAndFile(
      'json', '[".json"]', 'tree-sitter-json.wasm',
      'data.json', '{"key": "value", "num": 42}\n',
    );

    const result = await syntaxTreeHandler.parse({ file: 'data.json', grammar: grammarId }, storage);
    expect(result.variant).toBe('ok');
  });

  it('handles YAML grammar with ABI mismatch gracefully', async () => {
    // The tree-sitter-yaml WASM from tree-sitter-wasms uses ABI v13,
    // while web-tree-sitter 0.24.x requires ABI v14. The handler
    // should catch the parse error rather than crashing.
    const grammarId = await setupGrammarAndFile(
      'yaml', '[".yaml"]', 'tree-sitter-yaml.wasm',
      'config.yaml', 'name: test\nversion: 1\n',
    );

    const result = await syntaxTreeHandler.parse({ file: 'config.yaml', grammar: grammarId }, storage);
    // Until a compatible YAML WASM is available, expect graceful error
    expect(['ok', 'parseError']).toContain(result.variant);
  });

  it('reports parse errors for invalid TypeScript', async () => {
    const grammarId = await setupGrammarAndFile(
      'typescript', '[".ts"]', 'tree-sitter-typescript.wasm',
      'bad.ts', 'const = = = ;\n',
    );

    const result = await syntaxTreeHandler.parse({ file: 'bad.ts', grammar: grammarId }, storage);
    expect(result.variant).toBe('parseError');
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.tree).toBeTruthy();
  });

  it('runs S-expression queries against a parsed tree', async () => {
    const grammarId = await setupGrammarAndFile(
      'typescript', '[".ts"]', 'tree-sitter-typescript.wasm',
      'funcs.ts', 'function hello() { return 1; }\nfunction world() { return 2; }\n',
    );

    const parse = await syntaxTreeHandler.parse({ file: 'funcs.ts', grammar: grammarId }, storage);
    expect(parse.variant).toBe('ok');

    const queryResult = await syntaxTreeHandler.query(
      { tree: parse.tree, pattern: '(function_declaration name: (identifier) @name)' },
      storage,
    );
    expect(queryResult.variant).toBe('ok');

    const matches = JSON.parse(queryResult.matches as string);
    expect(matches.length).toBe(2);
    const names = matches.flatMap((m: { captures: Array<{ text: string }> }) => m.captures.map((c) => c.text));
    expect(names).toContain('hello');
    expect(names).toContain('world');
  });

  it('returns invalidPattern for bad S-expression query', async () => {
    const grammarId = await setupGrammarAndFile(
      'typescript', '[".ts"]', 'tree-sitter-typescript.wasm',
      'test2.ts', 'const x = 1;\n',
    );

    const parse = await syntaxTreeHandler.parse({ file: 'test2.ts', grammar: grammarId }, storage);
    const queryResult = await syntaxTreeHandler.query(
      { tree: parse.tree, pattern: '(not_a_real_node_type @x' },
      storage,
    );
    expect(queryResult.variant).toBe('invalidPattern');
  });

  it('finds node at byte offset', async () => {
    const grammarId = await setupGrammarAndFile(
      'typescript', '[".ts"]', 'tree-sitter-typescript.wasm',
      'offset.ts', 'const x = 42;\n',
    );

    const parse = await syntaxTreeHandler.parse({ file: 'offset.ts', grammar: grammarId }, storage);
    expect(parse.variant).toBe('ok');

    // Byte offset 6 should be within "x" identifier
    const node = await syntaxTreeHandler.nodeAt({ tree: parse.tree, byteOffset: 6 }, storage);
    expect(node.variant).toBe('ok');
    expect(node.nodeType).toBe('identifier');
  });

  it('returns outOfRange for negative offset', async () => {
    const grammarId = await setupGrammarAndFile(
      'typescript', '[".ts"]', 'tree-sitter-typescript.wasm',
      'range.ts', 'const a = 1;\n',
    );

    const parse = await syntaxTreeHandler.parse({ file: 'range.ts', grammar: grammarId }, storage);
    const node = await syntaxTreeHandler.nodeAt({ tree: parse.tree, byteOffset: -1 }, storage);
    expect(node.variant).toBe('outOfRange');
  });

  it('returns noGrammar when grammar is not loaded', async () => {
    const result = await syntaxTreeHandler.parse({ file: 'test.ts', grammar: 'nonexistent' }, storage);
    expect(result.variant).toBe('noGrammar');
  });

  it('tree metadata persists and can be retrieved', async () => {
    const grammarId = await setupGrammarAndFile(
      'typescript', '[".ts"]', 'tree-sitter-typescript.wasm',
      'persist.ts', 'let y = "hello";\n',
    );

    const parse = await syntaxTreeHandler.parse({ file: 'persist.ts', grammar: grammarId }, storage);
    const get = await syntaxTreeHandler.get({ tree: parse.tree }, storage);

    expect(get.variant).toBe('ok');
    expect(get.byteLength).toBeGreaterThan(0);
    expect(get.editVersion).toBe(1);
  });

  it('returns notfound for nonexistent tree ID', async () => {
    const get = await syntaxTreeHandler.get({ tree: 'tree-99999' }, storage);
    expect(get.variant).toBe('notfound');
  });
});

// ============================================================
// 3. FileArtifact Handler
// ============================================================

describe('FileArtifact Handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetArtifactCounter();
  });

  it('registers a TypeScript source file with inferred metadata', async () => {
    const result = await fileArtifactHandler.register(
      { node: 'src/handler.ts', role: '', language: '' },
      storage,
    );
    expect(result.variant).toBe('ok');

    const get = await fileArtifactHandler.get({ artifact: result.artifact }, storage);
    expect(get.variant).toBe('ok');
    expect(get.role).toBe('source');
    expect(get.language).toBe('typescript');
    expect(get.encoding).toBe('utf-8');
  });

  it('infers spec role for .concept files', async () => {
    const result = await fileArtifactHandler.register(
      { node: 'specs/app/user.concept', role: '', language: '' },
      storage,
    );

    const get = await fileArtifactHandler.get({ artifact: result.artifact }, storage);
    expect(get.role).toBe('spec');
    expect(get.language).toBe('concept-spec');
  });

  it('infers test role for .test.ts files', async () => {
    const result = await fileArtifactHandler.register(
      { node: 'tests/parse-kit.test.ts', role: '', language: '' },
      storage,
    );

    const get = await fileArtifactHandler.get({ artifact: result.artifact }, storage);
    expect(get.role).toBe('test');
    expect(get.language).toBe('typescript');
  });

  it('infers generated role for files in generated/ directory', async () => {
    const result = await fileArtifactHandler.register(
      { node: 'generated/devtools/cli/user.ts', role: '', language: '' },
      storage,
    );

    const get = await fileArtifactHandler.get({ artifact: result.artifact }, storage);
    expect(get.role).toBe('generated');
  });

  it('infers doc role for .md files', async () => {
    const result = await fileArtifactHandler.register(
      { node: 'docs/architecture.md', role: '', language: '' },
      storage,
    );

    const get = await fileArtifactHandler.get({ artifact: result.artifact }, storage);
    expect(get.role).toBe('doc');
    expect(get.language).toBe('markdown');
  });

  it('infers config role for config files', async () => {
    const result = await fileArtifactHandler.register(
      { node: 'tsconfig.json', role: '', language: '' },
      storage,
    );

    const get = await fileArtifactHandler.get({ artifact: result.artifact }, storage);
    expect(get.role).toBe('config');
  });

  it('uses explicit role and language when provided', async () => {
    const result = await fileArtifactHandler.register(
      { node: 'custom/file.xyz', role: 'asset', language: 'custom' },
      storage,
    );

    const get = await fileArtifactHandler.get({ artifact: result.artifact }, storage);
    expect(get.role).toBe('asset');
    expect(get.language).toBe('custom');
  });

  it('rejects duplicate registration', async () => {
    await fileArtifactHandler.register({ node: 'src/app.ts', role: '', language: '' }, storage);
    const dup = await fileArtifactHandler.register({ node: 'src/app.ts', role: '', language: '' }, storage);
    expect(dup.variant).toBe('alreadyRegistered');
  });

  it('finds artifacts by role', async () => {
    await fileArtifactHandler.register({ node: 'a.ts', role: 'source', language: '' }, storage);
    await fileArtifactHandler.register({ node: 'b.ts', role: 'source', language: '' }, storage);
    await fileArtifactHandler.register({ node: 'c.test.ts', role: '', language: '' }, storage);

    const result = await fileArtifactHandler.findByRole({ role: 'source' }, storage);
    expect(result.variant).toBe('ok');
    const artifacts = JSON.parse(result.artifacts as string);
    expect(artifacts.length).toBe(2);
  });

  it('sets and queries provenance', async () => {
    const reg = await fileArtifactHandler.register(
      { node: 'generated/user.ts', role: 'generated', language: '' },
      storage,
    );

    await fileArtifactHandler.setProvenance(
      { artifact: reg.artifact, spec: 'specs/app/user.concept', generator: 'TypeScriptGen' },
      storage,
    );

    const found = await fileArtifactHandler.findGeneratedFrom(
      { spec: 'specs/app/user.concept' },
      storage,
    );
    expect(found.variant).toBe('ok');
    const artifacts = JSON.parse(found.artifacts as string);
    expect(artifacts.length).toBe(1);
  });

  it('returns noGeneratedFiles when no provenance matches', async () => {
    const result = await fileArtifactHandler.findGeneratedFrom(
      { spec: 'nonexistent.concept' },
      storage,
    );
    expect(result.variant).toBe('noGeneratedFiles');
  });
});
