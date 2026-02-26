// ============================================================
// TreeSitterThemeSpec Handler
//
// Tree-sitter grammar provider for Clef Surface theme spec files.
// Sections: purpose, palette, typography, spacing, motion,
// elevation, radius. Supports extends clause for theme
// inheritance.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-theme-spec-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-theme-spec';

// --- AST node types for theme-spec grammar ---

interface ParseNode {
  type: string;
  text: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  children: ParseNode[];
}

/** Known theme-spec section names. */
const THEME_SECTIONS = [
  'purpose', 'palette', 'typography', 'spacing',
  'motion', 'elevation', 'radius',
];

/**
 * Parse theme-spec source into a simplified AST.
 * Detects: theme declarations, extends clauses, section blocks
 * (purpose, palette, typography, spacing, motion, elevation, radius),
 * and key-value token definitions within sections.
 */
function parseThemeSpec(source: string): ParseNode {
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

  let currentTheme: ParseNode | null = null;
  let currentSection: ParseNode | null = null;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Annotations: @version(N), etc.
    const annoMatch = line.match(/^\s*(@\w+(?:\(.*?\))?)/);
    if (annoMatch) {
      root.children.push({
        type: 'annotation',
        text: annoMatch[1],
        startLine: i,
        startCol: line.indexOf('@'),
        endLine: i,
        endCol: line.indexOf('@') + annoMatch[1].length,
        children: [],
      });
      continue;
    }

    // Theme declaration: theme ThemeName {  or  theme ThemeName extends BaseName {
    const themeMatch = line.match(/^\s*theme\s+(\w+)\s*(?:extends\s+(\w+)\s*)?\{/);
    if (themeMatch) {
      currentTheme = {
        type: 'theme_declaration',
        text: themeMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'theme_name',
            text: themeMatch[1],
            startLine: i,
            startCol: line.indexOf(themeMatch[1]),
            endLine: i,
            endCol: line.indexOf(themeMatch[1]) + themeMatch[1].length,
            children: [],
          },
        ],
      };
      if (themeMatch[2]) {
        currentTheme.children.push({
          type: 'extends_clause',
          text: themeMatch[2],
          startLine: i,
          startCol: line.indexOf(themeMatch[2], line.indexOf('extends')),
          endLine: i,
          endCol: line.indexOf(themeMatch[2], line.indexOf('extends')) + themeMatch[2].length,
          children: [],
        });
      }
      root.children.push(currentTheme);
      braceDepth = 1;
      currentSection = null;
      continue;
    }

    // Track brace depth
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
    }

    // Section header: palette { , typography { , etc.
    const sectionRegex = new RegExp(`^\\s+(${THEME_SECTIONS.join('|')})\\s*\\{`);
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch && currentTheme) {
      currentSection = {
        type: `${sectionMatch[1]}_section`,
        text: sectionMatch[1],
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [],
      };
      currentTheme.children.push(currentSection);
      continue;
    }

    // Token definition within a section: tokenName: value
    const tokenMatch = line.match(/^\s+([\w-]+)\s*:\s*(.+)\s*$/);
    if (tokenMatch && currentSection) {
      const tokenName = tokenMatch[1];
      const tokenValue = tokenMatch[2].trim();
      currentSection.children.push({
        type: 'token_definition',
        text: `${tokenName}: ${tokenValue}`,
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'token_name',
            text: tokenName,
            startLine: i,
            startCol: line.indexOf(tokenName),
            endLine: i,
            endCol: line.indexOf(tokenName) + tokenName.length,
            children: [],
          },
          {
            type: 'token_value',
            text: tokenValue,
            startLine: i,
            startCol: line.indexOf(tokenValue),
            endLine: i,
            endCol: line.indexOf(tokenValue) + tokenValue.length,
            children: [],
          },
        ],
      });
      continue;
    }

    // Closing brace resets current section
    if (line.match(/^\s*\}/) && currentSection && braceDepth <= 1) {
      currentSection = null;
    }
  }

  return root;
}

/**
 * Identify highlight ranges for theme-spec syntax.
 */
function highlightThemeSpec(source: string): Array<{
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

  const keywords = ['theme', 'extends', ...THEME_SECTIONS];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Annotations
    const annoMatch = line.match(/@\w+(?:\([^)]*\))?/g);
    if (annoMatch) {
      for (const m of annoMatch) {
        const col = line.indexOf(m);
        highlights.push({ startLine: i, startCol: col, endLine: i, endCol: col + m.length, tokenType: 'annotation' });
      }
    }

    // Keywords
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = kwRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + kw.length, tokenType: 'keyword' });
      }
    }

    // Color values: #hex
    const colorRegex = /#[0-9a-fA-F]{3,8}\b/g;
    let cm: RegExpExecArray | null;
    while ((cm = colorRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: cm.index, endLine: i, endCol: cm.index + cm[0].length, tokenType: 'color' });
    }

    // Numeric values with units: 16px, 1.5rem, 200ms, etc.
    const numRegex = /\b\d+(?:\.\d+)?(?:px|rem|em|ms|s|%|dp|sp)\b/g;
    let nm: RegExpExecArray | null;
    while ((nm = numRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: nm.index, endLine: i, endCol: nm.index + nm[0].length, tokenType: 'number' });
    }

    // Quoted strings
    const strRegex = /"[^"]*"|'[^']*'/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: sm.index, endLine: i, endCol: sm.index + sm[0].length, tokenType: 'string' });
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

export const treeSitterThemeSpecHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      const existing = await storage.find(RELATION, { language: 'theme-spec' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        grammarRef: 'tree-sitter-theme-spec',
        wasmPath: 'tree-sitter-theme-spec.wasm',
        language: 'theme-spec',
        extensions: JSON.stringify(['.theme']),
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
      const tree = parseThemeSpec(source);
      return { variant: 'ok', tree: JSON.stringify(tree) };
    } catch (e) {
      return { variant: 'parseError', message: String(e) };
    }
  },

  async highlight(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const ranges = highlightThemeSpec(source);
      return { variant: 'ok', highlights: JSON.stringify(ranges) };
    } catch (e) {
      return { variant: 'highlightError', message: String(e) };
    }
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const source = input.source as string;

    try {
      const tree = parseThemeSpec(source);
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
      language: 'theme-spec',
      extensions: JSON.stringify(['.theme']),
      grammarVersion: '1.0.0',
      registered: record !== null,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterThemeSpecCounter(): void {
  idCounter = 0;
}
