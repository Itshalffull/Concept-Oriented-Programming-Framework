// Smoke test for the generic tree-sitter Parse provider.
// Verifies: (a) self-registration under id "tree-sitter",
//           (b) async parse of a trivial TypeScript snippet using the
//               pre-copied typescript.wasm grammar,
//           (c) AST contains the expected top-level and nested node
//               types that web-tree-sitter's TypeScript grammar emits.

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  parseWithTreeSitter,
  PARSE_PROVIDER_ID,
} from '../handlers/ts/providers/tree-sitter.provider.ts';
import { getParseProvider } from '../handlers/ts/providers/parse-provider-registry.ts';

const GRAMMAR_PATH = resolve(
  process.cwd(),
  'suites/parse/grammars/wasm/tree-sitter-typescript.wasm',
);

type AstNode = {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  children: AstNode[];
};

function findNodeByType(root: AstNode, type: string): AstNode | null {
  if (root.type === type) return root;
  for (const child of root.children) {
    const found = findNodeByType(child, type);
    if (found) return found;
  }
  return null;
}

describe('tree-sitter Parse provider', () => {
  it('self-registers under provider id "tree-sitter"', () => {
    const fn = getParseProvider(PARSE_PROVIDER_ID);
    expect(fn).toBeTypeOf('function');
  });

  it('parses a TypeScript snippet using the pre-copied grammar wasm', async () => {
    expect(existsSync(GRAMMAR_PATH)).toBe(true);

    const config = JSON.stringify({
      grammar: GRAMMAR_PATH,
      packageName: 'tree-sitter-typescript',
    });
    const source = 'const x: number = 1;';

    const raw = await parseWithTreeSitter(source, 'typescript', config);
    const env = JSON.parse(raw) as {
      ok: boolean;
      language: string;
      grammar: string;
      packageName?: string;
      tree?: AstNode;
      error?: { message: string };
    };

    if (!env.ok) {
      throw new Error(
        `tree-sitter parse failed: ${env.error?.message ?? 'unknown'}`,
      );
    }
    expect(env.language).toBe('typescript');
    expect(env.grammar).toBe(GRAMMAR_PATH);
    expect(env.packageName).toBe('tree-sitter-typescript');

    const root = env.tree!;
    expect(root.type).toBe('program');

    const lexical = findNodeByType(root, 'lexical_declaration');
    expect(lexical).not.toBeNull();

    const typeAnnotation = findNodeByType(root, 'type_annotation');
    expect(typeAnnotation).not.toBeNull();
    expect(typeAnnotation!.text).toContain('number');
  });

  it('returns a structured error envelope when grammar is missing', async () => {
    const raw = await parseWithTreeSitter('const x = 1;', 'typescript', '{}');
    const env = JSON.parse(raw) as { ok: boolean; error?: { message: string } };
    expect(env.ok).toBe(false);
    expect(env.error?.message).toMatch(/options\.grammar/);
  });
});
