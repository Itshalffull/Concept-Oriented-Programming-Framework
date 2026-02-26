// ============================================================
// TreeSitterYaml Handler
//
// Tree-sitter grammar provider for YAML files. Registers the
// YAML WASM parser with LanguageGrammar for .yaml and .yml
// extensions. Uses simple line-based parsing (key: value,
// indentation for nesting).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-yaml-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-yaml';

// --- AST node types for YAML grammar ---

interface ParseNode {
  type: string;
  text: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  children: ParseNode[];
}

/**
 * Parse YAML source into a simplified AST using line-based indentation parsing.
 * Detects: documents, block mappings, block sequences, scalar values,
 * comments, directives, and anchors/aliases.
 */
function parseYaml(source: string): ParseNode {
  const root: ParseNode = {
    type: 'source_file',
    text: source,
    startLine: 0,
    startCol: 0,
    endLine: 0,
    endCol: 0,
    children: [],
  };

  const lines = source.split('\n');
  root.endLine = lines.length - 1;
  root.endCol = (lines[lines.length - 1] ?? '').length;

  // Stack to track nesting by indentation level
  const stack: Array<{ node: ParseNode; indent: number }> = [{ node: root, indent: -1 }];
  let currentDocument: ParseNode | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip empty lines
    if (trimmed.length === 0) continue;

    const indent = line.length - trimmed.length;

    // YAML directive: %YAML 1.2 or %TAG
    if (trimmed.startsWith('%')) {
      root.children.push({
        type: 'directive',
        text: trimmed,
        startLine: i,
        startCol: indent,
        endLine: i,
        endCol: line.length,
        children: [],
      });
      continue;
    }

    // Document start: ---
    if (trimmed === '---' || trimmed.startsWith('--- ')) {
      currentDocument = {
        type: 'document',
        text: '---',
        startLine: i,
        startCol: 0,
        endLine: i,
        endCol: line.length,
        children: [],
      };
      root.children.push(currentDocument);
      // Reset stack to document level
      stack.length = 1;
      stack.push({ node: currentDocument, indent: -1 });
      continue;
    }

    // Document end: ...
    if (trimmed === '...') {
      if (currentDocument) {
        currentDocument.endLine = i;
        currentDocument.endCol = line.length;
      }
      currentDocument = null;
      stack.length = 1;
      continue;
    }

    // Comment line: # comment
    if (trimmed.startsWith('#')) {
      const target = currentDocument ?? root;
      target.children.push({
        type: 'comment',
        text: trimmed,
        startLine: i,
        startCol: indent,
        endLine: i,
        endCol: line.length,
        children: [],
      });
      continue;
    }

    // Pop stack to find correct parent based on indentation
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;

    // Sequence item: - value or - key: value
    if (trimmed.startsWith('- ') || trimmed === '-') {
      const itemContent = trimmed.slice(2).trim();
      const itemNode: ParseNode = {
        type: 'block_sequence_item',
        text: trimmed,
        startLine: i,
        startCol: indent,
        endLine: i,
        endCol: line.length,
        children: [],
      };

      // Check if the item contains a key: value pair
      const kvMatch = itemContent.match(/^([\w][\w.-]*)\s*:\s*(.*)/);
      if (kvMatch) {
        const keyNode: ParseNode = {
          type: 'block_mapping_pair',
          text: itemContent,
          startLine: i,
          startCol: indent + 2,
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'flow_node',
              text: kvMatch[1],
              startLine: i,
              startCol: indent + 2,
              endLine: i,
              endCol: indent + 2 + kvMatch[1].length,
              children: [],
            },
          ],
        };
        if (kvMatch[2].trim()) {
          keyNode.children.push(createScalarNode(kvMatch[2].trim(), i, line.indexOf(kvMatch[2].trim())));
        }
        itemNode.children.push(keyNode);
      } else if (itemContent) {
        itemNode.children.push(createScalarNode(itemContent, i, indent + 2));
      }

      parent.children.push(itemNode);
      stack.push({ node: itemNode, indent: indent + 2 });
      continue;
    }

    // Key: value pair
    const kvMatch = trimmed.match(/^([\w][\w.\s-]*?)\s*:\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      const pairNode: ParseNode = {
        type: 'block_mapping_pair',
        text: trimmed,
        startLine: i,
        startCol: indent,
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'flow_node',
            text: key,
            startLine: i,
            startCol: indent,
            endLine: i,
            endCol: indent + key.length,
            children: [],
          },
        ],
      };

      // Handle anchor: &anchor
      const anchorMatch = value.match(/^&(\w+)\s*(.*)/);
      if (anchorMatch) {
        pairNode.children.push({
          type: 'anchor',
          text: `&${anchorMatch[1]}`,
          startLine: i,
          startCol: line.indexOf('&'),
          endLine: i,
          endCol: line.indexOf('&') + anchorMatch[1].length + 1,
          children: [],
        });
        if (anchorMatch[2].trim()) {
          pairNode.children.push(createScalarNode(anchorMatch[2].trim(), i, line.indexOf(anchorMatch[2].trim())));
        }
      }
      // Handle alias: *alias
      else if (value.startsWith('*')) {
        const aliasName = value.slice(1);
        pairNode.children.push({
          type: 'alias',
          text: value,
          startLine: i,
          startCol: line.indexOf('*'),
          endLine: i,
          endCol: line.indexOf('*') + value.length,
          children: [],
        });
      }
      // Handle flow sequence: [a, b, c]
      else if (value.startsWith('[')) {
        pairNode.children.push({
          type: 'flow_sequence',
          text: value,
          startLine: i,
          startCol: line.indexOf('['),
          endLine: i,
          endCol: line.indexOf('[') + value.length,
          children: parseFlowSequenceItems(value, i, line.indexOf('[')),
        });
      }
      // Handle flow mapping: {a: b, c: d}
      else if (value.startsWith('{')) {
        pairNode.children.push({
          type: 'flow_mapping',
          text: value,
          startLine: i,
          startCol: line.indexOf('{'),
          endLine: i,
          endCol: line.indexOf('{') + value.length,
          children: [],
        });
      }
      // Handle multi-line indicator: | or >
      else if (value === '|' || value === '>' || value === '|+' || value === '|-' || value === '>+' || value === '>-') {
        pairNode.children.push({
          type: 'block_scalar_indicator',
          text: value,
          startLine: i,
          startCol: line.indexOf(value, indent + key.length),
          endLine: i,
          endCol: line.indexOf(value, indent + key.length) + value.length,
          children: [],
        });
      }
      // Regular scalar value
      else if (value) {
        pairNode.children.push(createScalarNode(value, i, line.indexOf(value, indent + key.length + 1)));
      }

      parent.children.push(pairNode);
      stack.push({ node: pairNode, indent });
      continue;
    }

    // Bare scalar (continuation of multi-line or standalone value)
    if (trimmed && !trimmed.startsWith('#')) {
      parent.children.push(createScalarNode(trimmed, i, indent));
    }
  }

  return root;
}

/** Create a scalar node, determining type from content. */
function createScalarNode(text: string, line: number, col: number): ParseNode {
  let scalarType = 'string_scalar';

  // Remove inline comments for type detection
  const valueText = text.replace(/\s+#.*$/, '').trim();

  if (valueText === 'true' || valueText === 'false') {
    scalarType = 'boolean_scalar';
  } else if (valueText === 'null' || valueText === '~') {
    scalarType = 'null_scalar';
  } else if (/^-?\d+$/.test(valueText)) {
    scalarType = 'integer_scalar';
  } else if (/^-?\d+\.\d+$/.test(valueText) || /^-?\d+[eE][+-]?\d+$/.test(valueText)) {
    scalarType = 'float_scalar';
  } else if ((valueText.startsWith('"') && valueText.endsWith('"')) || (valueText.startsWith("'") && valueText.endsWith("'"))) {
    scalarType = 'quoted_scalar';
  }

  return {
    type: scalarType,
    text: valueText,
    startLine: line,
    startCol: col,
    endLine: line,
    endCol: col + text.length,
    children: [],
  };
}

/** Parse items from a flow sequence string like [a, b, c]. */
function parseFlowSequenceItems(text: string, line: number, baseCol: number): ParseNode[] {
  const items: ParseNode[] = [];
  // Strip brackets
  const inner = text.slice(1, text.length - 1);
  if (!inner.trim()) return items;

  const parts = inner.split(',');
  let currentCol = baseCol + 1;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      items.push(createScalarNode(trimmed, line, currentCol + part.indexOf(trimmed)));
    }
    currentCol += part.length + 1;
  }
  return items;
}

/**
 * Identify highlight ranges for YAML syntax.
 */
function highlightYaml(source: string): Array<{
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  tokenType: string;
}> {
  const highlights: Array<{
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
    tokenType: string;
  }> = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // Comments
    const commentIdx = trimmed.indexOf('#');
    if (commentIdx >= 0) {
      // Make sure it's not inside a string
      const beforeHash = trimmed.slice(0, commentIdx);
      const quotes = (beforeHash.match(/"/g) || []).length;
      if (quotes % 2 === 0) {
        highlights.push({ startLine: i, startCol: indent + commentIdx, endLine: i, endCol: line.length, tokenType: 'comment' });
      }
    }

    // Directives
    if (trimmed.startsWith('%')) {
      highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: line.length, tokenType: 'directive' });
      continue;
    }

    // Document markers
    if (trimmed === '---' || trimmed === '...') {
      highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + 3, tokenType: 'punctuation' });
      continue;
    }

    // Key in key: value
    const kvMatch = trimmed.match(/^([\w][\w.\s-]*?)\s*:/);
    if (kvMatch) {
      highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + kvMatch[1].length, tokenType: 'property' });

      // Value part
      const valueStart = indent + kvMatch[0].length;
      const valuePart = line.slice(valueStart).trim();
      if (valuePart && !valuePart.startsWith('#')) {
        if (valuePart === 'true' || valuePart === 'false') {
          highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'boolean' });
        } else if (valuePart === 'null' || valuePart === '~') {
          highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'keyword' });
        } else if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(valuePart)) {
          highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'number' });
        } else if (valuePart.startsWith('"') || valuePart.startsWith("'")) {
          highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'string' });
        }
      }
    }

    // Sequence item markers
    if (trimmed.startsWith('- ') || trimmed === '-') {
      highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + 1, tokenType: 'punctuation' });
    }

    // Anchors and aliases
    const anchorRegex = /&\w+/g;
    let am: RegExpExecArray | null;
    while ((am = anchorRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: am.index, endLine: i, endCol: am.index + am[0].length, tokenType: 'anchor' });
    }

    const aliasRegex = /\*\w+/g;
    let alm: RegExpExecArray | null;
    while ((alm = aliasRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: alm.index, endLine: i, endCol: alm.index + alm[0].length, tokenType: 'alias' });
    }

    // Block scalar indicators: | > |+ |- >+ >-
    if (trimmed === '|' || trimmed === '>' || trimmed === '|+' || trimmed === '|-' || trimmed === '>+' || trimmed === '>-') {
      highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + trimmed.length, tokenType: 'operator' });
    }
  }

  return highlights;
}

/**
 * Execute a simplified tree-sitter-style query against a parse tree.
 */
function queryTree(node: ParseNode, pattern: string): ParseNode[] {
  const results: ParseNode[] = [];
  const typeMatch = pattern.match(/\(\s*(\w+)/);
  if (!typeMatch) return results;
  const targetType = typeMatch[1];

  function walk(n: ParseNode): void {
    if (n.type === targetType) {
      results.push(n);
    }
    for (const child of n.children) {
      walk(child);
    }
  }

  walk(node);
  return results;
}

export const treeSitterYamlHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      const existing = await storage.find(RELATION, { language: 'yaml' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        grammarRef: 'tree-sitter-yaml',
        wasmPath: 'tree-sitter-yaml.wasm',
        language: 'yaml',
        extensions: JSON.stringify(['.yaml', '.yml']),
        grammarVersion: '1.0.0',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async parse(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const tree = parseYaml(source);
      return { variant: 'ok', tree: JSON.stringify(tree) };
    } catch (e) {
      return { variant: 'parseError', message: String(e) };
    }
  },

  async highlight(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const ranges = highlightYaml(source);
      return { variant: 'ok', highlights: JSON.stringify(ranges) };
    } catch (e) {
      return { variant: 'highlightError', message: String(e) };
    }
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const source = input.source as string;

    try {
      const tree = parseYaml(source);
      const matches = queryTree(tree, pattern);
      return { variant: 'ok', matches: JSON.stringify(matches) };
    } catch (e) {
      return { variant: 'queryError', message: String(e) };
    }
  },

  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const instanceId = input.instance as string | undefined;
    const record = instanceId ? await storage.get(RELATION, instanceId) : null;

    return {
      variant: 'ok',
      language: 'yaml',
      extensions: JSON.stringify(['.yaml', '.yml']),
      grammarVersion: '1.0.0',
      registered: record !== null,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterYamlCounter(): void {
  idCounter = 0;
}
