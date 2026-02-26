// ============================================================
// copf inspect tree <file> [--node-at <line:col>] [--query <s-expr>]
//
// Parses a file using Tree-sitter and displays the syntax tree.
// Optionally runs S-expression queries or finds nodes at a
// specific position.
//
// See design doc Section 4.1 (SyntaxTree, LanguageGrammar).
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, extname } from 'path';
import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import { languageGrammarHandler } from '../../../../kits/parse/handlers/ts/language-grammar.handler.js';
import { syntaxTreeHandler, clearTreeCaches } from '../../../../kits/parse/handlers/ts/syntax-tree.handler.js';
import type { ConceptStorage } from '../../../kernel/src/types.js';

// Grammar configurations for supported languages
const GRAMMAR_CONFIGS: Array<{
  name: string;
  extensions: string[];
  wasm: string;
}> = [
  { name: 'typescript', extensions: ['.ts', '.tsx'], wasm: 'tree-sitter-typescript.wasm' },
  { name: 'json', extensions: ['.json'], wasm: 'tree-sitter-json.wasm' },
  { name: 'yaml', extensions: ['.yaml', '.yml'], wasm: 'tree-sitter-yaml.wasm' },
];

async function registerGrammars(storage: ConceptStorage): Promise<void> {
  for (const config of GRAMMAR_CONFIGS) {
    await languageGrammarHandler.register(
      {
        name: config.name,
        extensions: JSON.stringify(config.extensions),
        parserWasmPath: config.wasm,
        nodeTypes: '{}',
      },
      storage,
    );
  }
}

export async function runInspect(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const subcommand = positional[0];

  if (subcommand !== 'tree') {
    console.error('Usage: copf inspect tree <file> [--node-at <line:col>] [--query <s-expr>]');
    process.exit(1);
  }

  const filePath = positional[1];
  if (!filePath) {
    console.error('Error: file path is required');
    console.error('Usage: copf inspect tree <file> [--node-at <line:col>] [--query <s-expr>]');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    console.error(`Error: file not found: ${absPath}`);
    process.exit(1);
  }

  const ext = extname(absPath);
  const content = readFileSync(absPath, 'utf-8');

  // Set up storage and register grammars
  const storage = createInMemoryStorage();
  clearTreeCaches();
  await registerGrammars(storage);

  // Store file content for the handler
  await storage.put('file_content', absPath, { content });

  // Resolve grammar by extension
  const resolution = await languageGrammarHandler.resolve({ fileExtension: ext }, storage);
  if (resolution.variant !== 'ok') {
    console.error(`Error: no grammar available for extension "${ext}"`);
    process.exit(1);
  }

  const grammarId = resolution.grammar as string;

  // Parse the file
  const parseResult = await syntaxTreeHandler.parse(
    { file: absPath, grammar: grammarId },
    storage,
  );

  if (parseResult.variant === 'noGrammar') {
    console.error(`Error: grammar failed to load for ${ext}`);
    process.exit(1);
  }

  const treeId = parseResult.tree as string;

  if (parseResult.variant === 'parseError') {
    console.error(`Warning: file has ${parseResult.errorCount} parse error(s)`);
  }

  // Handle --query flag
  const queryPattern = flags.query as string | undefined;
  if (queryPattern && typeof queryPattern === 'string') {
    const queryResult = await syntaxTreeHandler.query(
      { tree: treeId, pattern: queryPattern },
      storage,
    );

    if (queryResult.variant === 'invalidPattern') {
      console.error(`Error: invalid S-expression pattern: ${queryResult.message}`);
      process.exit(1);
    }

    const matches = JSON.parse(queryResult.matches as string);
    console.log(`Query: ${queryPattern}`);
    console.log(`Matches: ${matches.length}\n`);

    for (const match of matches) {
      for (const capture of match.captures) {
        console.log(`  @${capture.name}: "${capture.text}" (${capture.node_type}) [${capture.start_row}:${capture.start_col}–${capture.end_row}:${capture.end_col}]`);
      }
    }
    return;
  }

  // Handle --node-at flag
  const nodeAtStr = flags['node-at'] as string | undefined;
  if (nodeAtStr && typeof nodeAtStr === 'string') {
    const parts = nodeAtStr.split(':');
    const line = parseInt(parts[0], 10) - 1; // Convert to 0-based
    const col = parseInt(parts[1] || '0', 10);

    // Convert line:col to byte offset
    const lines = content.split('\n');
    let byteOffset = 0;
    for (let i = 0; i < Math.min(line, lines.length); i++) {
      byteOffset += lines[i].length + 1; // +1 for newline
    }
    byteOffset += col;

    const nodeResult = await syntaxTreeHandler.nodeAt(
      { tree: treeId, byteOffset },
      storage,
    );

    if (nodeResult.variant === 'outOfRange') {
      console.error(`Error: position ${nodeAtStr} is out of range`);
      process.exit(1);
    }

    console.log(`Node at ${nodeAtStr}:`);
    console.log(`  Type: ${nodeResult.nodeType}`);
    console.log(`  Bytes: ${nodeResult.startByte}–${nodeResult.endByte}`);
    console.log(`  Named: ${nodeResult.named}`);
    if (nodeResult.field) {
      console.log(`  Field: ${nodeResult.field}`);
    }
    return;
  }

  // Default: print the S-expression tree
  const treeData = await syntaxTreeHandler.get({ tree: treeId }, storage);
  const sexp = (await storage.get('tree', treeId))?.rootSexp as string;
  console.log(`File: ${filePath}`);
  console.log(`Grammar: ${grammarId}`);
  console.log(`Bytes: ${treeData.byteLength}`);
  console.log(`Edit version: ${treeData.editVersion}`);
  console.log(`Errors: ${JSON.parse(treeData.errorRanges as string).length}\n`);
  console.log(sexp);
}
