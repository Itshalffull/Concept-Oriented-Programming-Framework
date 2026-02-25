// ============================================================
// Tree-sitter WASM Runtime Loader
//
// Provides lazy initialization of the Tree-sitter WASM runtime
// and loading of grammar-specific WASM parsers. Grammar WASM
// files are expected at kits/parse/grammars/wasm/.
//
// See design doc Sections 4.1 (SyntaxTree, LanguageGrammar).
// ============================================================

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

let ParserClass: typeof import('web-tree-sitter').default | null = null;
let initialized = false;

const __dirname_compat = dirname(fileURLToPath(import.meta.url));
const GRAMMARS_DIR = resolve(__dirname_compat, '../../grammars/wasm');

/**
 * Initialize the Tree-sitter WASM runtime. Idempotent — safe to call multiple times.
 * Returns the Parser constructor class.
 */
export async function initTreeSitter(): Promise<typeof import('web-tree-sitter').default> {
  if (ParserClass && initialized) return ParserClass;
  const mod = await import('web-tree-sitter');
  ParserClass = mod.default;
  await ParserClass.init();
  initialized = true;
  return ParserClass;
}

/**
 * Load a language grammar WASM file by filename.
 * The file must exist in kits/parse/grammars/wasm/.
 */
export async function loadLanguage(
  wasmFileName: string,
): Promise<import('web-tree-sitter').default.Language> {
  const Parser = await initTreeSitter();
  const wasmPath = resolve(GRAMMARS_DIR, wasmFileName);
  if (!existsSync(wasmPath)) {
    throw new Error(
      `Grammar WASM file not found: ${wasmPath}. Run "npm install" to copy WASM files.`,
    );
  }
  return Parser.Language.load(wasmPath);
}

/**
 * Create a new Parser instance with the Tree-sitter runtime initialized.
 */
export async function createParser(): Promise<import('web-tree-sitter').default> {
  const Parser = await initTreeSitter();
  return new Parser();
}

/** Return the directory where grammar WASM files are stored. */
export function getGrammarsDir(): string {
  return GRAMMARS_DIR;
}
