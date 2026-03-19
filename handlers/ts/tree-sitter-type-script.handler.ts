// ============================================================
// TreeSitterTypeScript Handler
//
// Tree-sitter grammar provider for TypeScript and TSX files.
// Registers the TypeScript WASM parser with LanguageGrammar
// for .ts and .tsx extensions. Uses regex-based identification
// of declarations, imports, and exports.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-type-script-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-type-script';

// --- AST node types for TypeScript grammar ---

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
 * Parse TypeScript source into a simplified AST using regex patterns.
 * Identifies: imports, exports, function/class/interface/type/enum/const
 * declarations, and JSX/TSX elements.
 */
function parseTypeScript(source: string): ParseNode {
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

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track block comments
    if (inBlockComment) {
      const endCommentIdx = line.indexOf('*/');
      if (endCommentIdx >= 0) {
        root.children.push({
          type: 'comment',
          text: line.slice(0, endCommentIdx + 2),
          startLine: i,
          startCol: 0,
          endLine: i,
          endCol: endCommentIdx + 2,
          children: [],
        });
        inBlockComment = false;
      } else {
        root.children.push({
          type: 'comment',
          text: line,
          startLine: i,
          startCol: 0,
          endLine: i,
          endCol: line.length,
          children: [],
        });
      }
      continue;
    }

    const blockCommentStart = line.indexOf('/*');
    if (blockCommentStart >= 0 && line.indexOf('*/') < 0) {
      inBlockComment = true;
      root.children.push({
        type: 'comment',
        text: line.slice(blockCommentStart),
        startLine: i,
        startCol: blockCommentStart,
        endLine: i,
        endCol: line.length,
        children: [],
      });
      continue;
    }

    // Single-line comment
    const lineCommentMatch = line.match(/^\s*(\/\/.*)/);
    if (lineCommentMatch) {
      root.children.push({
        type: 'comment',
        text: lineCommentMatch[1],
        startLine: i,
        startCol: line.indexOf('//'),
        endLine: i,
        endCol: line.length,
        children: [],
      });
      continue;
    }

    // Import statement: import { ... } from '...'  or  import X from '...'
    const importMatch = line.match(/^\s*(import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?\s+from\s+['"][^'"]+['"])/);
    if (importMatch) {
      const node: ParseNode = {
        type: 'import_declaration',
        text: importMatch[1],
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [],
      };

      // Extract module specifier
      const moduleMatch = importMatch[1].match(/from\s+['"]([^'"]+)['"]/);
      if (moduleMatch) {
        node.children.push({
          type: 'module_specifier',
          text: moduleMatch[1],
          startLine: i,
          startCol: line.indexOf(moduleMatch[1]),
          endLine: i,
          endCol: line.indexOf(moduleMatch[1]) + moduleMatch[1].length,
          children: [],
        });
      }

      // Extract named imports
      const namedMatch = importMatch[1].match(/\{([^}]*)\}/);
      if (namedMatch) {
        const names = namedMatch[1].split(',').map((n) => n.trim()).filter(Boolean);
        for (const name of names) {
          const cleanName = name.replace(/\s+as\s+\w+/, '').trim();
          node.children.push({
            type: 'import_specifier',
            text: cleanName,
            startLine: i,
            startCol: line.indexOf(cleanName),
            endLine: i,
            endCol: line.indexOf(cleanName) + cleanName.length,
            children: [],
          });
        }
      }

      root.children.push(node);
      continue;
    }

    // Export declaration
    const exportMatch = line.match(/^\s*(export\s+(?:default\s+)?)/);
    if (exportMatch) {
      // Will be decorated on the following declaration node
    }

    // Function declaration: function name(...) or async function name(...)
    const funcMatch = line.match(/^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/);
    if (funcMatch) {
      const isExported = /export/.test(line);
      const isAsync = /async/.test(line);
      const funcNode: ParseNode = {
        type: 'function_declaration',
        text: funcMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'function_name',
            text: funcMatch[1],
            startLine: i,
            startCol: line.indexOf(funcMatch[1]),
            endLine: i,
            endCol: line.indexOf(funcMatch[1]) + funcMatch[1].length,
            children: [],
          },
        ],
      };
      if (isExported) {
        funcNode.children.push({ type: 'export_modifier', text: 'export', startLine: i, startCol: line.indexOf('export'), endLine: i, endCol: line.indexOf('export') + 6, children: [] });
      }
      if (isAsync) {
        funcNode.children.push({ type: 'async_modifier', text: 'async', startLine: i, startCol: line.indexOf('async'), endLine: i, endCol: line.indexOf('async') + 5, children: [] });
      }
      root.children.push(funcNode);
      continue;
    }

    // Arrow function: const name = (...) => or const name = async (...) =>
    const arrowMatch = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(?/);
    if (arrowMatch && line.includes('=>')) {
      root.children.push({
        type: 'arrow_function',
        text: arrowMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'variable_name',
            text: arrowMatch[1],
            startLine: i,
            startCol: line.indexOf(arrowMatch[1]),
            endLine: i,
            endCol: line.indexOf(arrowMatch[1]) + arrowMatch[1].length,
            children: [],
          },
        ],
      });
      continue;
    }

    // Class declaration: class Name { or class Name extends Base {
    const classMatch = line.match(/^\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{?/);
    if (classMatch) {
      const classNode: ParseNode = {
        type: 'class_declaration',
        text: classMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'class_name',
            text: classMatch[1],
            startLine: i,
            startCol: line.indexOf(classMatch[1]),
            endLine: i,
            endCol: line.indexOf(classMatch[1]) + classMatch[1].length,
            children: [],
          },
        ],
      };
      if (classMatch[2]) {
        classNode.children.push({
          type: 'extends_clause',
          text: classMatch[2],
          startLine: i,
          startCol: line.indexOf(classMatch[2]),
          endLine: i,
          endCol: line.indexOf(classMatch[2]) + classMatch[2].length,
          children: [],
        });
      }
      if (classMatch[3]) {
        classNode.children.push({
          type: 'implements_clause',
          text: classMatch[3].trim(),
          startLine: i,
          startCol: line.indexOf(classMatch[3]),
          endLine: i,
          endCol: line.indexOf(classMatch[3]) + classMatch[3].trim().length,
          children: [],
        });
      }
      root.children.push(classNode);
      continue;
    }

    // Interface declaration: interface Name { or interface Name extends Base {
    const ifaceMatch = line.match(/^\s*(?:export\s+)?interface\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+([^{]+))?\s*\{?/);
    if (ifaceMatch) {
      const ifaceNode: ParseNode = {
        type: 'interface_declaration',
        text: ifaceMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'interface_name',
            text: ifaceMatch[1],
            startLine: i,
            startCol: line.indexOf(ifaceMatch[1]),
            endLine: i,
            endCol: line.indexOf(ifaceMatch[1]) + ifaceMatch[1].length,
            children: [],
          },
        ],
      };
      if (ifaceMatch[2]) {
        ifaceNode.children.push({
          type: 'extends_clause',
          text: ifaceMatch[2].trim(),
          startLine: i,
          startCol: line.indexOf(ifaceMatch[2]),
          endLine: i,
          endCol: line.indexOf(ifaceMatch[2]) + ifaceMatch[2].trim().length,
          children: [],
        });
      }
      root.children.push(ifaceNode);
      continue;
    }

    // Type alias: type Name = ...
    const typeMatch = line.match(/^\s*(?:export\s+)?type\s+(\w+)(?:\s*<[^>]*>)?\s*=/);
    if (typeMatch) {
      root.children.push({
        type: 'type_alias',
        text: typeMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'type_name',
            text: typeMatch[1],
            startLine: i,
            startCol: line.indexOf(typeMatch[1]),
            endLine: i,
            endCol: line.indexOf(typeMatch[1]) + typeMatch[1].length,
            children: [],
          },
        ],
      });
      continue;
    }

    // Enum declaration: enum Name {
    const enumMatch = line.match(/^\s*(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{?/);
    if (enumMatch) {
      root.children.push({
        type: 'enum_declaration',
        text: enumMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'enum_name',
            text: enumMatch[1],
            startLine: i,
            startCol: line.indexOf(enumMatch[1]),
            endLine: i,
            endCol: line.indexOf(enumMatch[1]) + enumMatch[1].length,
            children: [],
          },
        ],
      });
      continue;
    }

    // Const/let/var declaration: const name = ... (not arrow function)
    const constMatch = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/);
    if (constMatch && !line.includes('=>')) {
      root.children.push({
        type: 'variable_declaration',
        text: constMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'variable_name',
            text: constMatch[1],
            startLine: i,
            startCol: line.indexOf(constMatch[1]),
            endLine: i,
            endCol: line.indexOf(constMatch[1]) + constMatch[1].length,
            children: [],
          },
        ],
      });
      continue;
    }

    // JSX/TSX element: <ComponentName ...> or <div ...>
    const jsxMatch = line.match(/<(\w+)(?:\s|>|\/)/);
    if (jsxMatch && /[A-Z]/.test(jsxMatch[1][0])) {
      root.children.push({
        type: 'jsx_element',
        text: jsxMatch[0],
        startLine: i,
        startCol: line.indexOf('<'),
        endLine: i,
        endCol: line.indexOf(jsxMatch[0]) + jsxMatch[0].length,
        children: [
          {
            type: 'jsx_tag_name',
            text: jsxMatch[1],
            startLine: i,
            startCol: line.indexOf(jsxMatch[1]),
            endLine: i,
            endCol: line.indexOf(jsxMatch[1]) + jsxMatch[1].length,
            children: [],
          },
        ],
      });
    }
  }

  return root;
}

/**
 * Identify highlight ranges for TypeScript syntax.
 */
function highlightTypeScript(source: string): Array<{
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

  const keywords = [
    'import', 'export', 'from', 'default', 'const', 'let', 'var',
    'function', 'async', 'await', 'return', 'if', 'else', 'for',
    'while', 'do', 'switch', 'case', 'break', 'continue', 'throw',
    'try', 'catch', 'finally', 'new', 'delete', 'typeof', 'instanceof',
    'in', 'of', 'class', 'extends', 'implements', 'interface', 'type',
    'enum', 'abstract', 'private', 'protected', 'public', 'static',
    'readonly', 'as', 'is', 'keyof', 'infer', 'never', 'void',
    'null', 'undefined', 'true', 'false', 'this', 'super', 'yield',
  ];

  const typeNames = ['string', 'number', 'boolean', 'any', 'unknown', 'object', 'symbol', 'bigint'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Comments
    const lineCommentIdx = line.indexOf('//');
    if (lineCommentIdx >= 0) {
      highlights.push({ startLine: i, startCol: lineCommentIdx, endLine: i, endCol: line.length, tokenType: 'comment' });
    }

    // Strings
    const strRegex = /(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: sm.index, endLine: i, endCol: sm.index + sm[0].length, tokenType: 'string' });
    }

    // Keywords
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = kwRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + kw.length, tokenType: 'keyword' });
      }
    }

    // Built-in type names
    for (const tn of typeNames) {
      const tnRegex = new RegExp(`\\b${tn}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = tnRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + tn.length, tokenType: 'type' });
      }
    }

    // Numbers
    const numRegex = /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
    let nm: RegExpExecArray | null;
    while ((nm = numRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: nm.index, endLine: i, endCol: nm.index + nm[0].length, tokenType: 'number' });
    }

    // Decorators
    const decoRegex = /@\w+/g;
    let dm: RegExpExecArray | null;
    while ((dm = decoRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: dm.index, endLine: i, endCol: dm.index + dm[0].length, tokenType: 'decorator' });
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

export const treeSitterTypeScriptHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      const existing = await storage.find(RELATION, { language: 'typescript' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        grammarRef: 'tree-sitter-typescript',
        wasmPath: 'tree-sitter-typescript.wasm',
        language: 'typescript',
        extensions: JSON.stringify(['.ts', '.tsx']),
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
      const tree = parseTypeScript(source);
      return { variant: 'ok', tree: JSON.stringify(tree) };
    } catch (e) {
      return { variant: 'parseError', message: String(e) };
    }
  },

  async highlight(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const ranges = highlightTypeScript(source);
      return { variant: 'ok', highlights: JSON.stringify(ranges) };
    } catch (e) {
      return { variant: 'highlightError', message: String(e) };
    }
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const source = input.source as string;

    try {
      const tree = parseTypeScript(source);
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
      language: 'typescript',
      extensions: JSON.stringify(['.ts', '.tsx']),
      grammarVersion: '1.0.0',
      registered: record !== null,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterTypeScriptCounter(): void {
  idCounter = 0;
}
