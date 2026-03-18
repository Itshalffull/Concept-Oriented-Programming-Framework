// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterQueryProvider Handler
//
// Pattern engine provider for Tree-sitter S-expression queries.
// The most precise structural pattern syntax, using native
// Tree-sitter query capabilities against concrete syntax trees.
// Stores, validates, and executes query patterns against parsed
// trees.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, completeFrom,
  branch, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-query-provider-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-query-provider';

interface ParseNode {
  type: string;
  text: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  children: ParseNode[];
}

interface QueryMatch {
  pattern: number;
  captures: Record<string, { type: string; text: string; startLine: number; startCol: number; endLine: number; endCol: number }>;
}

interface SExprPattern {
  type: string;
  captures: string[];
  fieldName?: string;
  children: SExprPattern[];
  isWildcard: boolean;
  isAnonymous: boolean;
  textMatch?: string;
}

function validatePattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (!trimmed) return 'Empty pattern';
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '(') depth++;
    if (trimmed[i] === ')') depth--;
    if (depth < 0) return `Unexpected closing parenthesis at position ${i}`;
  }
  if (depth !== 0) return `Unbalanced parentheses: ${depth > 0 ? 'missing' : 'extra'} ${Math.abs(depth)} closing parenthes${Math.abs(depth) === 1 ? 'is' : 'es'}`;
  if (!trimmed.startsWith('(')) return 'Pattern must start with an S-expression: (node_type ...)';
  const nodeTypeMatch = trimmed.match(/^\(\s*(\w+|_)/);
  if (!nodeTypeMatch) return 'Pattern must specify a node type after opening parenthesis';
  return null;
}

function parseSExpr(pattern: string): SExprPattern[] {
  const patterns: SExprPattern[] = [];
  let pos = 0;
  const input = pattern.trim();

  function skipWhitespace(): void { while (pos < input.length && /\s/.test(input[pos])) pos++; }

  function parseOne(): SExprPattern | null {
    skipWhitespace();
    if (pos >= input.length || input[pos] !== '(') return null;
    pos++;
    skipWhitespace();
    let nodeType = '';
    while (pos < input.length && /[\w._-]/.test(input[pos])) { nodeType += input[pos]; pos++; }
    const result: SExprPattern = { type: nodeType, captures: [], children: [], isWildcard: nodeType === '_', isAnonymous: false };
    skipWhitespace();
    while (pos < input.length && input[pos] !== ')') {
      skipWhitespace();
      if (input[pos] === '@') {
        pos++;
        let captureName = '';
        while (pos < input.length && /[\w.-]/.test(input[pos])) { captureName += input[pos]; pos++; }
        result.captures.push(captureName);
        skipWhitespace();
        continue;
      }
      if (input[pos] === '"') {
        pos++;
        let textMatch = '';
        while (pos < input.length && input[pos] !== '"') { if (input[pos] === '\\') pos++; textMatch += input[pos]; pos++; }
        if (pos < input.length) pos++;
        result.textMatch = textMatch;
        skipWhitespace();
        continue;
      }
      if (pos < input.length && input[pos] !== '(' && input[pos] !== ')') {
        let fieldName = '';
        const savedPos = pos;
        while (pos < input.length && /[\w-]/.test(input[pos])) { fieldName += input[pos]; pos++; }
        skipWhitespace();
        if (pos < input.length && input[pos] === ':') {
          pos++;
          skipWhitespace();
          const child = parseOne();
          if (child) { child.fieldName = fieldName; result.children.push(child); }
          continue;
        } else {
          pos = savedPos;
        }
      }
      if (pos < input.length && input[pos] === '(') {
        const child = parseOne();
        if (child) result.children.push(child);
        continue;
      }
      if (pos < input.length && input[pos] !== ')') pos++;
    }
    if (pos < input.length) pos++;
    return result;
  }

  while (pos < input.length) {
    skipWhitespace();
    if (pos >= input.length) break;
    const p = parseOne();
    if (p) patterns.push(p); else break;
  }
  return patterns;
}

function executeQuery(tree: ParseNode, patterns: SExprPattern[]): QueryMatch[] {
  const results: QueryMatch[] = [];

  function matchNode(node: ParseNode, pattern: SExprPattern): Record<string, ParseNode> | null {
    if (!pattern.isWildcard && node.type !== pattern.type) return null;
    if (pattern.textMatch !== undefined && node.text !== pattern.textMatch) return null;
    const captures: Record<string, ParseNode> = {};
    for (const captureName of pattern.captures) captures[captureName] = node;
    if (pattern.children.length > 0) {
      for (const childPattern of pattern.children) {
        let matched = false;
        for (const childNode of node.children) {
          const childCaptures = matchNode(childNode, childPattern);
          if (childCaptures !== null) { Object.assign(captures, childCaptures); matched = true; break; }
        }
        if (!matched) return null;
      }
    }
    return captures;
  }

  function walk(node: ParseNode, patternIdx: number): void {
    const pattern = patterns[patternIdx];
    const captures = matchNode(node, pattern);
    if (captures !== null) {
      const match: QueryMatch = { pattern: patternIdx, captures: {} };
      for (const [name, capturedNode] of Object.entries(captures)) {
        match.captures[name] = { type: capturedNode.type, text: capturedNode.text, startLine: capturedNode.startLine, startCol: capturedNode.startCol, endLine: capturedNode.endLine, endCol: capturedNode.endCol };
      }
      results.push(match);
    }
    for (const child of node.children) walk(child, patternIdx);
  }

  for (let i = 0; i < patterns.length; i++) walk(tree, i);
  return results;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = find(p, RELATION, { providerType: 'tree-sitter-query' }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'ok', (b) => ({
          instance: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        let e = createProgram();
        e = put(e, RELATION, id, {
          id, patternRef: 'tree-sitter-query', providerType: 'tree-sitter-query',
          syntaxName: 's-expression', description: 'Tree-sitter S-expression query engine',
        });
        return complete(e, 'ok', { instance: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const pattern = input.pattern as string;
    const tree = input.tree as string;

    const validationError = validatePattern(pattern);
    if (validationError) {
      const p = createProgram();
      return complete(p, 'invalidPattern', { message: validationError }) as StorageProgram<Result>;
    }

    try {
      const parsedPatterns = parseSExpr(pattern);
      if (parsedPatterns.length === 0) {
        const p = createProgram();
        return complete(p, 'invalidPattern', { message: 'No valid patterns found in query' }) as StorageProgram<Result>;
      }

      let treeNode: ParseNode;
      try {
        treeNode = JSON.parse(tree) as ParseNode;
      } catch {
        const p = createProgram();
        return complete(p, 'invalidPattern', { message: 'Invalid tree: expected JSON-serialized parse tree' }) as StorageProgram<Result>;
      }

      const matches = executeQuery(treeNode, parsedPatterns);
      const p = createProgram();
      return complete(p, 'ok', { matches: JSON.stringify(matches) }) as StorageProgram<Result>;
    } catch (e) {
      const p = createProgram();
      return complete(p, 'invalidPattern', { message: `Query execution failed: ${String(e)}` }) as StorageProgram<Result>;
    }
  },
};

export const treeSitterQueryProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterQueryProviderCounter(): void {
  idCounter = 0;
}
