// ============================================================
// TreeSitterQueryProvider Handler
//
// Pattern engine provider for Tree-sitter S-expression queries.
// The most precise structural pattern syntax, using native
// Tree-sitter query capabilities against concrete syntax trees.
// Stores, validates, and executes query patterns against parsed
// trees.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-query-provider-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-query-provider';

// --- Types for query execution ---

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
  captures: Record<string, {
    type: string;
    text: string;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  }>;
}

/**
 * Represents a parsed S-expression pattern.
 * For example: (function_declaration name: (identifier) @name)
 */
interface SExprPattern {
  type: string;
  captures: string[];
  fieldName?: string;
  children: SExprPattern[];
  isWildcard: boolean;
  isAnonymous: boolean;
  textMatch?: string;
}

/**
 * Validate an S-expression query pattern for syntactic correctness.
 * Returns null if valid, or an error message if invalid.
 */
function validatePattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return 'Empty pattern';
  }

  // Check balanced parentheses
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '(') depth++;
    if (trimmed[i] === ')') depth--;
    if (depth < 0) {
      return `Unexpected closing parenthesis at position ${i}`;
    }
  }
  if (depth !== 0) {
    return `Unbalanced parentheses: ${depth > 0 ? 'missing' : 'extra'} ${Math.abs(depth)} closing parenthes${Math.abs(depth) === 1 ? 'is' : 'es'}`;
  }

  // Must start with '('
  if (!trimmed.startsWith('(')) {
    return 'Pattern must start with an S-expression: (node_type ...)';
  }

  // Check for basic S-expression structure
  const nodeTypeMatch = trimmed.match(/^\(\s*(\w+|_)/);
  if (!nodeTypeMatch) {
    return 'Pattern must specify a node type after opening parenthesis';
  }

  return null;
}

/**
 * Parse an S-expression pattern string into a structured representation.
 */
function parseSExpr(pattern: string): SExprPattern[] {
  const patterns: SExprPattern[] = [];
  let pos = 0;
  const input = pattern.trim();

  function skipWhitespace(): void {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
  }

  function parseOne(): SExprPattern | null {
    skipWhitespace();
    if (pos >= input.length || input[pos] !== '(') return null;
    pos++; // skip '('

    skipWhitespace();

    // Read node type
    let nodeType = '';
    while (pos < input.length && /[\w._-]/.test(input[pos])) {
      nodeType += input[pos];
      pos++;
    }

    const result: SExprPattern = {
      type: nodeType,
      captures: [],
      children: [],
      isWildcard: nodeType === '_',
      isAnonymous: false,
    };

    skipWhitespace();

    // Parse children, field-name prefixed children, and captures
    while (pos < input.length && input[pos] !== ')') {
      skipWhitespace();

      // Capture: @name
      if (input[pos] === '@') {
        pos++; // skip @
        let captureName = '';
        while (pos < input.length && /[\w.-]/.test(input[pos])) {
          captureName += input[pos];
          pos++;
        }
        result.captures.push(captureName);
        skipWhitespace();
        continue;
      }

      // String literal match: "text"
      if (input[pos] === '"') {
        pos++; // skip opening quote
        let textMatch = '';
        while (pos < input.length && input[pos] !== '"') {
          if (input[pos] === '\\') pos++; // skip escape
          textMatch += input[pos];
          pos++;
        }
        if (pos < input.length) pos++; // skip closing quote
        result.textMatch = textMatch;
        skipWhitespace();
        continue;
      }

      // Field name: field_name: (child)
      if (pos < input.length && input[pos] !== '(' && input[pos] !== ')') {
        let fieldName = '';
        const savedPos = pos;
        while (pos < input.length && /[\w-]/.test(input[pos])) {
          fieldName += input[pos];
          pos++;
        }
        skipWhitespace();
        if (pos < input.length && input[pos] === ':') {
          pos++; // skip ':'
          skipWhitespace();
          const child = parseOne();
          if (child) {
            child.fieldName = fieldName;
            result.children.push(child);
          }
          continue;
        } else {
          // Not a field name, restore position
          pos = savedPos;
        }
      }

      // Child pattern
      if (pos < input.length && input[pos] === '(') {
        const child = parseOne();
        if (child) {
          result.children.push(child);
        }
        continue;
      }

      // Skip any unrecognized tokens
      if (pos < input.length && input[pos] !== ')') {
        pos++;
      }
    }

    if (pos < input.length) pos++; // skip ')'
    return result;
  }

  while (pos < input.length) {
    skipWhitespace();
    if (pos >= input.length) break;
    const p = parseOne();
    if (p) {
      patterns.push(p);
    } else {
      break;
    }
  }

  return patterns;
}

/**
 * Execute parsed S-expression patterns against a parse tree.
 * Returns an array of match results with captured nodes.
 */
function executeQuery(tree: ParseNode, patterns: SExprPattern[]): QueryMatch[] {
  const results: QueryMatch[] = [];

  function matchNode(node: ParseNode, pattern: SExprPattern): Record<string, ParseNode> | null {
    // Check node type match (wildcard matches any)
    if (!pattern.isWildcard && node.type !== pattern.type) {
      return null;
    }

    // Check text match if specified
    if (pattern.textMatch !== undefined && node.text !== pattern.textMatch) {
      return null;
    }

    const captures: Record<string, ParseNode> = {};

    // Add this node's captures
    for (const captureName of pattern.captures) {
      captures[captureName] = node;
    }

    // Match children patterns against node's children
    if (pattern.children.length > 0) {
      for (const childPattern of pattern.children) {
        let matched = false;

        if (childPattern.fieldName) {
          // Look for a child matching the field name (by convention, check type)
          for (const childNode of node.children) {
            const childCaptures = matchNode(childNode, childPattern);
            if (childCaptures !== null) {
              Object.assign(captures, childCaptures);
              matched = true;
              break;
            }
          }
        } else {
          // Match any child
          for (const childNode of node.children) {
            const childCaptures = matchNode(childNode, childPattern);
            if (childCaptures !== null) {
              Object.assign(captures, childCaptures);
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          return null;
        }
      }
    }

    return captures;
  }

  function walk(node: ParseNode, patternIdx: number): void {
    const pattern = patterns[patternIdx];
    const captures = matchNode(node, pattern);

    if (captures !== null) {
      const match: QueryMatch = {
        pattern: patternIdx,
        captures: {},
      };
      for (const [name, capturedNode] of Object.entries(captures)) {
        match.captures[name] = {
          type: capturedNode.type,
          text: capturedNode.text,
          startLine: capturedNode.startLine,
          startCol: capturedNode.startCol,
          endLine: capturedNode.endLine,
          endCol: capturedNode.endCol,
        };
      }
      results.push(match);
    }

    // Recurse into children
    for (const child of node.children) {
      walk(child, patternIdx);
    }
  }

  for (let i = 0; i < patterns.length; i++) {
    walk(tree, i);
  }

  return results;
}

export const treeSitterQueryProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      const existing = await storage.find(RELATION, { providerType: 'tree-sitter-query' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        patternRef: 'tree-sitter-query',
        providerType: 'tree-sitter-query',
        syntaxName: 's-expression',
        description: 'Tree-sitter S-expression query engine',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'initError', message: String(e) };
    }
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const tree = input.tree as string;

    // Validate the pattern
    const validationError = validatePattern(pattern);
    if (validationError) {
      return { variant: 'invalidPattern', message: validationError };
    }

    try {
      // Parse the S-expression pattern
      const parsedPatterns = parseSExpr(pattern);
      if (parsedPatterns.length === 0) {
        return { variant: 'invalidPattern', message: 'No valid patterns found in query' };
      }

      // Parse the tree (expecting JSON-serialized ParseNode)
      let treeNode: ParseNode;
      try {
        treeNode = JSON.parse(tree) as ParseNode;
      } catch {
        return { variant: 'invalidPattern', message: 'Invalid tree: expected JSON-serialized parse tree' };
      }

      // Execute the query
      const matches = executeQuery(treeNode, parsedPatterns);
      return { variant: 'ok', matches: JSON.stringify(matches) };
    } catch (e) {
      return { variant: 'invalidPattern', message: `Query execution failed: ${String(e)}` };
    }
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterQueryProviderCounter(): void {
  idCounter = 0;
}
