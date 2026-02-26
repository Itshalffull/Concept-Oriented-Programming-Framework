// ============================================================
// TreeSitterConceptSpec Handler
//
// Tree-sitter grammar provider for Clef concept spec files. Uses
// line-based parsing as an approximation for .concept files until
// a custom Tree-sitter grammar is available.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-concept-spec-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-concept-spec';

// --- AST node types for concept-spec grammar ---

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
 * Parse concept-spec source into a simplified AST.
 * Detects: concept declarations, state blocks, action declarations,
 * variant arrows, purpose blocks, capabilities blocks, annotations.
 */
function parseConceptSpec(source: string): ParseNode {
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

  let currentConcept: ParseNode | null = null;
  let currentSection: ParseNode | null = null;
  let currentAction: ParseNode | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Annotations: @version(N), @gate, @category(...), etc.
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

    // Concept declaration
    const conceptMatch = line.match(/^\s*concept\s+(\w+)\s*(?:\[([^\]]*)\])?\s*\{/);
    if (conceptMatch) {
      currentConcept = {
        type: 'concept_declaration',
        text: conceptMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'concept_name',
            text: conceptMatch[1],
            startLine: i,
            startCol: line.indexOf(conceptMatch[1]),
            endLine: i,
            endCol: line.indexOf(conceptMatch[1]) + conceptMatch[1].length,
            children: [],
          },
        ],
      };
      if (conceptMatch[2]) {
        currentConcept.children.push({
          type: 'type_params',
          text: conceptMatch[2],
          startLine: i,
          startCol: line.indexOf('[') + 1,
          endLine: i,
          endCol: line.indexOf(']'),
          children: [],
        });
      }
      root.children.push(currentConcept);
      continue;
    }

    // Section headers: purpose, state, actions, capabilities
    const sectionMatch = line.match(/^\s+(purpose|state|actions|capabilities)\s*\{/);
    if (sectionMatch && currentConcept) {
      currentSection = {
        type: `${sectionMatch[1]}_section`,
        text: sectionMatch[1],
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [],
      };
      currentConcept.children.push(currentSection);
      currentAction = null;
      continue;
    }

    // Action declaration
    const actionMatch = line.match(/^\s+action\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    if (actionMatch && currentSection?.type === 'actions_section') {
      currentAction = {
        type: 'action_declaration',
        text: actionMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'action_name',
            text: actionMatch[1],
            startLine: i,
            startCol: line.indexOf(actionMatch[1]),
            endLine: i,
            endCol: line.indexOf(actionMatch[1]) + actionMatch[1].length,
            children: [],
          },
        ],
      };
      // Parse params if present
      if (actionMatch[2].trim()) {
        const params = actionMatch[2].split(',').map((p) => p.trim());
        for (const param of params) {
          const pMatch = param.match(/(\w+)\s*:\s*(.+)/);
          if (pMatch) {
            currentAction.children.push({
              type: 'parameter',
              text: param,
              startLine: i,
              startCol: line.indexOf(param),
              endLine: i,
              endCol: line.indexOf(param) + param.length,
              children: [],
            });
          }
        }
      }
      currentSection.children.push(currentAction);
      continue;
    }

    // Variant arrow: -> variantName(...)
    const variantMatch = line.match(/^\s+->\s+(\w+)\s*\(([^)]*)\)\s*\{?/);
    if (variantMatch && currentAction) {
      const variant: ParseNode = {
        type: 'variant',
        text: variantMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'variant_name',
            text: variantMatch[1],
            startLine: i,
            startCol: line.indexOf(variantMatch[1]),
            endLine: i,
            endCol: line.indexOf(variantMatch[1]) + variantMatch[1].length,
            children: [],
          },
        ],
      };
      if (variantMatch[2].trim()) {
        const params = variantMatch[2].split(',').map((p) => p.trim());
        for (const param of params) {
          variant.children.push({
            type: 'variant_parameter',
            text: param,
            startLine: i,
            startCol: line.indexOf(param),
            endLine: i,
            endCol: line.indexOf(param) + param.length,
            children: [],
          });
        }
      }
      currentAction.children.push(variant);
      continue;
    }

    // State field: fieldName: set T  or  fieldName: T -> T
    const stateMatch = line.match(/^\s+(\w+)\s*:\s*(.+)\s*$/);
    if (stateMatch && currentSection?.type === 'state_section') {
      const fieldName = stateMatch[1];
      if (!['purpose', 'state', 'actions', 'capabilities', 'invariant'].includes(fieldName)) {
        currentSection.children.push({
          type: 'state_field',
          text: stateMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'field_name',
              text: fieldName,
              startLine: i,
              startCol: line.indexOf(fieldName),
              endLine: i,
              endCol: line.indexOf(fieldName) + fieldName.length,
              children: [],
            },
            {
              type: 'field_type',
              text: stateMatch[2].trim(),
              startLine: i,
              startCol: line.indexOf(stateMatch[2]),
              endLine: i,
              endCol: line.indexOf(stateMatch[2]) + stateMatch[2].length,
              children: [],
            },
          ],
        });
      }
      continue;
    }

    // Capability requirement: requires <cap>
    const capMatch = line.match(/^\s+requires\s+(.+)\s*$/);
    if (capMatch && currentSection?.type === 'capabilities_section') {
      currentSection.children.push({
        type: 'capability',
        text: capMatch[1].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [],
      });
    }
  }

  return root;
}

/**
 * Identify highlight ranges for concept-spec syntax.
 */
function highlightConceptSpec(source: string): Array<{
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

  const keywords = ['concept', 'action', 'state', 'purpose', 'actions', 'capabilities', 'invariant', 'requires', 'set', 'list', 'option'];
  const typeKeywords = ['String', 'Int', 'Float', 'Boolean', 'Timestamp'];

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

    // Variant arrow
    if (line.match(/^\s+->/)) {
      const col = line.indexOf('->');
      highlights.push({ startLine: i, startCol: col, endLine: i, endCol: col + 2, tokenType: 'operator' });
    }

    // Keywords
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = kwRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + kw.length, tokenType: 'keyword' });
      }
    }

    // Type names
    for (const tn of typeKeywords) {
      const tnRegex = new RegExp(`\\b${tn}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = tnRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + tn.length, tokenType: 'type' });
      }
    }
  }

  return highlights;
}

export const treeSitterConceptSpecHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      // Check for existing registration
      const existing = await storage.find(RELATION, { language: 'concept-spec' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        grammarRef: 'tree-sitter-concept-spec',
        wasmPath: 'tree-sitter-concept-spec.wasm',
        language: 'concept-spec',
        extensions: JSON.stringify(['.concept']),
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
      const tree = parseConceptSpec(source);
      return { variant: 'ok', tree: JSON.stringify(tree) };
    } catch (e) {
      return { variant: 'parseError', message: String(e) };
    }
  },

  async highlight(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const ranges = highlightConceptSpec(source);
      return { variant: 'ok', highlights: JSON.stringify(ranges) };
    } catch (e) {
      return { variant: 'highlightError', message: String(e) };
    }
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const source = input.source as string;

    try {
      const tree = parseConceptSpec(source);
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
      language: 'concept-spec',
      extensions: JSON.stringify(['.concept']),
      grammarVersion: '1.0.0',
      registered: record !== null,
    };
  },
};

/**
 * Execute a simplified tree-sitter-style query against a parse tree.
 * Supports matching by node type: (type_name) matches all nodes of that type.
 */
function queryTree(node: ParseNode, pattern: string): ParseNode[] {
  const results: ParseNode[] = [];
  // Extract node type from S-expression pattern, e.g. "(concept_declaration)" or "(action_name)"
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

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterConceptSpecCounter(): void {
  idCounter = 0;
}
