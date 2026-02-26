// ============================================================
// TreeSitterWidgetSpec Handler
//
// Tree-sitter grammar provider for COIF widget spec files.
// Sections: purpose, anatomy, slots, states (FSM), accessibility,
// props, connect, affordance, compose, invariant.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-widget-spec-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-widget-spec';

// --- AST node types for widget-spec grammar ---

interface ParseNode {
  type: string;
  text: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  children: ParseNode[];
}

/** Known widget-spec section names. */
const WIDGET_SECTIONS = [
  'purpose', 'anatomy', 'slots', 'states',
  'accessibility', 'props', 'connect',
  'affordance', 'compose', 'invariant',
];

/**
 * Parse widget-spec source into a simplified AST.
 * Detects: widget declarations, section blocks (purpose, anatomy, slots,
 * states, accessibility, props, connect, affordance, compose, invariant),
 * part definitions, slot definitions, state transitions, prop definitions,
 * and invariant rules.
 */
function parseWidgetSpec(source: string): ParseNode {
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

  let currentWidget: ParseNode | null = null;
  let currentSection: ParseNode | null = null;
  let currentSubBlock: ParseNode | null = null;

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

    // Widget declaration: widget WidgetName {
    const widgetMatch = line.match(/^\s*widget\s+(\w+)\s*\{/);
    if (widgetMatch) {
      currentWidget = {
        type: 'widget_declaration',
        text: widgetMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'widget_name',
            text: widgetMatch[1],
            startLine: i,
            startCol: line.indexOf(widgetMatch[1]),
            endLine: i,
            endCol: line.indexOf(widgetMatch[1]) + widgetMatch[1].length,
            children: [],
          },
        ],
      };
      root.children.push(currentWidget);
      currentSection = null;
      currentSubBlock = null;
      continue;
    }

    // Section header
    const sectionRegex = new RegExp(`^\\s+(${WIDGET_SECTIONS.join('|')})\\s*\\{`);
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch && currentWidget) {
      currentSection = {
        type: `${sectionMatch[1]}_section`,
        text: sectionMatch[1],
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [],
      };
      currentWidget.children.push(currentSection);
      currentSubBlock = null;
      continue;
    }

    if (!currentSection) continue;

    // --- anatomy section: part definitions ---
    // part PartName { role: "..." }  or  part PartName
    if (currentSection.type === 'anatomy_section') {
      const partMatch = line.match(/^\s+part\s+(\w+)\s*(?:\{|$)/);
      if (partMatch) {
        currentSubBlock = {
          type: 'part_definition',
          text: partMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'part_name',
              text: partMatch[1],
              startLine: i,
              startCol: line.indexOf(partMatch[1]),
              endLine: i,
              endCol: line.indexOf(partMatch[1]) + partMatch[1].length,
              children: [],
            },
          ],
        };
        currentSection.children.push(currentSubBlock);
        continue;
      }

      // Part attribute: role: "value" or contains: [...]
      const attrMatch = line.match(/^\s+([\w-]+)\s*:\s*(.+)/);
      if (attrMatch && currentSubBlock) {
        currentSubBlock.children.push({
          type: 'part_attribute',
          text: attrMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'attribute_name',
              text: attrMatch[1],
              startLine: i,
              startCol: line.indexOf(attrMatch[1]),
              endLine: i,
              endCol: line.indexOf(attrMatch[1]) + attrMatch[1].length,
              children: [],
            },
            {
              type: 'attribute_value',
              text: attrMatch[2].trim(),
              startLine: i,
              startCol: line.indexOf(attrMatch[2]),
              endLine: i,
              endCol: line.indexOf(attrMatch[2]) + attrMatch[2].trim().length,
              children: [],
            },
          ],
        });
        continue;
      }
    }

    // --- slots section: slot definitions ---
    if (currentSection.type === 'slots_section') {
      const slotMatch = line.match(/^\s+slot\s+(\w+)\s*(?:\{|:)/);
      if (slotMatch) {
        currentSubBlock = {
          type: 'slot_definition',
          text: slotMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'slot_name',
              text: slotMatch[1],
              startLine: i,
              startCol: line.indexOf(slotMatch[1]),
              endLine: i,
              endCol: line.indexOf(slotMatch[1]) + slotMatch[1].length,
              children: [],
            },
          ],
        };
        currentSection.children.push(currentSubBlock);
        continue;
      }
    }

    // --- states section: FSM state and transition definitions ---
    if (currentSection.type === 'states_section') {
      // State: state StateName { ... } or initial state StateName
      const stateMatch = line.match(/^\s+(?:(initial)\s+)?state\s+(\w+)\s*\{?/);
      if (stateMatch) {
        currentSubBlock = {
          type: 'state_definition',
          text: stateMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'state_name',
              text: stateMatch[2],
              startLine: i,
              startCol: line.indexOf(stateMatch[2]),
              endLine: i,
              endCol: line.indexOf(stateMatch[2]) + stateMatch[2].length,
              children: [],
            },
          ],
        };
        if (stateMatch[1]) {
          currentSubBlock.children.push({
            type: 'initial_modifier',
            text: 'initial',
            startLine: i,
            startCol: line.indexOf('initial'),
            endLine: i,
            endCol: line.indexOf('initial') + 7,
            children: [],
          });
        }
        currentSection.children.push(currentSubBlock);
        continue;
      }

      // Transition: on EventName -> TargetState
      const transMatch = line.match(/^\s+on\s+(\w+)\s*->\s*(\w+)/);
      if (transMatch && currentSubBlock) {
        currentSubBlock.children.push({
          type: 'transition',
          text: transMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'event_name',
              text: transMatch[1],
              startLine: i,
              startCol: line.indexOf(transMatch[1]),
              endLine: i,
              endCol: line.indexOf(transMatch[1]) + transMatch[1].length,
              children: [],
            },
            {
              type: 'target_state',
              text: transMatch[2],
              startLine: i,
              startCol: line.indexOf(transMatch[2], line.indexOf('->')),
              endLine: i,
              endCol: line.indexOf(transMatch[2], line.indexOf('->')) + transMatch[2].length,
              children: [],
            },
          ],
        });
        continue;
      }
    }

    // --- props section: prop definitions ---
    if (currentSection.type === 'props_section') {
      const propMatch = line.match(/^\s+(\w+)\s*:\s*(\w+)(?:\s*=\s*(.+))?/);
      if (propMatch) {
        const propNode: ParseNode = {
          type: 'prop_definition',
          text: propMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'prop_name',
              text: propMatch[1],
              startLine: i,
              startCol: line.indexOf(propMatch[1]),
              endLine: i,
              endCol: line.indexOf(propMatch[1]) + propMatch[1].length,
              children: [],
            },
            {
              type: 'prop_type',
              text: propMatch[2],
              startLine: i,
              startCol: line.indexOf(propMatch[2], line.indexOf(':')),
              endLine: i,
              endCol: line.indexOf(propMatch[2], line.indexOf(':')) + propMatch[2].length,
              children: [],
            },
          ],
        };
        if (propMatch[3]) {
          propNode.children.push({
            type: 'default_value',
            text: propMatch[3].trim(),
            startLine: i,
            startCol: line.indexOf(propMatch[3]),
            endLine: i,
            endCol: line.indexOf(propMatch[3]) + propMatch[3].trim().length,
            children: [],
          });
        }
        currentSection.children.push(propNode);
        continue;
      }
    }

    // --- accessibility section: aria attributes ---
    if (currentSection.type === 'accessibility_section') {
      const ariaMatch = line.match(/^\s+(role|aria-\w+|label|description)\s*:\s*(.+)/);
      if (ariaMatch) {
        currentSection.children.push({
          type: 'accessibility_attribute',
          text: ariaMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'attribute_name',
              text: ariaMatch[1],
              startLine: i,
              startCol: line.indexOf(ariaMatch[1]),
              endLine: i,
              endCol: line.indexOf(ariaMatch[1]) + ariaMatch[1].length,
              children: [],
            },
            {
              type: 'attribute_value',
              text: ariaMatch[2].trim(),
              startLine: i,
              startCol: line.indexOf(ariaMatch[2]),
              endLine: i,
              endCol: line.indexOf(ariaMatch[2]) + ariaMatch[2].trim().length,
              children: [],
            },
          ],
        });
        continue;
      }
    }

    // --- connect section: concept bindings ---
    if (currentSection.type === 'connect_section') {
      const connectMatch = line.match(/^\s+(\w+)\s*(?:<-|->|<->)\s*(\w+(?:\.\w+)?)/);
      if (connectMatch) {
        const opMatch = line.match(/<-|->|<->/);
        currentSection.children.push({
          type: 'connection',
          text: connectMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'local_binding',
              text: connectMatch[1],
              startLine: i,
              startCol: line.indexOf(connectMatch[1]),
              endLine: i,
              endCol: line.indexOf(connectMatch[1]) + connectMatch[1].length,
              children: [],
            },
            {
              type: 'direction',
              text: opMatch ? opMatch[0] : '->',
              startLine: i,
              startCol: opMatch ? line.indexOf(opMatch[0]) : 0,
              endLine: i,
              endCol: opMatch ? line.indexOf(opMatch[0]) + opMatch[0].length : 0,
              children: [],
            },
            {
              type: 'remote_binding',
              text: connectMatch[2],
              startLine: i,
              startCol: line.indexOf(connectMatch[2], line.indexOf(connectMatch[1]) + connectMatch[1].length),
              endLine: i,
              endCol: line.indexOf(connectMatch[2], line.indexOf(connectMatch[1]) + connectMatch[1].length) + connectMatch[2].length,
              children: [],
            },
          ],
        });
        continue;
      }
    }

    // --- affordance section: interaction patterns ---
    if (currentSection.type === 'affordance_section') {
      const affordMatch = line.match(/^\s+(\w+)\s*:\s*(.+)/);
      if (affordMatch) {
        currentSection.children.push({
          type: 'affordance_definition',
          text: affordMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'affordance_name',
              text: affordMatch[1],
              startLine: i,
              startCol: line.indexOf(affordMatch[1]),
              endLine: i,
              endCol: line.indexOf(affordMatch[1]) + affordMatch[1].length,
              children: [],
            },
            {
              type: 'affordance_value',
              text: affordMatch[2].trim(),
              startLine: i,
              startCol: line.indexOf(affordMatch[2]),
              endLine: i,
              endCol: line.indexOf(affordMatch[2]) + affordMatch[2].trim().length,
              children: [],
            },
          ],
        });
        continue;
      }
    }

    // --- compose section: composition rules ---
    if (currentSection.type === 'compose_section') {
      const compMatch = line.match(/^\s+(\w+)\s*:\s*(.+)/);
      if (compMatch) {
        currentSection.children.push({
          type: 'compose_rule',
          text: compMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'compose_name',
              text: compMatch[1],
              startLine: i,
              startCol: line.indexOf(compMatch[1]),
              endLine: i,
              endCol: line.indexOf(compMatch[1]) + compMatch[1].length,
              children: [],
            },
            {
              type: 'compose_value',
              text: compMatch[2].trim(),
              startLine: i,
              startCol: line.indexOf(compMatch[2]),
              endLine: i,
              endCol: line.indexOf(compMatch[2]) + compMatch[2].trim().length,
              children: [],
            },
          ],
        });
        continue;
      }
    }

    // --- invariant section: constraint rules ---
    if (currentSection.type === 'invariant_section') {
      const invMatch = line.match(/^\s+(.+)/);
      if (invMatch && !line.match(/^\s*\}/)) {
        currentSection.children.push({
          type: 'invariant_rule',
          text: invMatch[1].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [],
        });
        continue;
      }
    }

    // Closing brace detection
    if (line.match(/^\s*\}/)) {
      if (currentSubBlock) {
        currentSubBlock = null;
      } else if (currentSection) {
        currentSection = null;
      }
    }
  }

  return root;
}

/**
 * Identify highlight ranges for widget-spec syntax.
 */
function highlightWidgetSpec(source: string): Array<{
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
    'widget', 'part', 'slot', 'state', 'initial', 'on',
    ...WIDGET_SECTIONS,
  ];

  const typeKeywords = ['String', 'Int', 'Float', 'Boolean', 'Color', 'Size', 'Enum'];

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

    // Direction arrows
    const arrowRegex = /<->|<-|->/g;
    let am: RegExpExecArray | null;
    while ((am = arrowRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: am.index, endLine: i, endCol: am.index + am[0].length, tokenType: 'operator' });
    }

    // Keywords
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = kwRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + kw.length, tokenType: 'keyword' });
      }
    }

    // Type keywords
    for (const tn of typeKeywords) {
      const tnRegex = new RegExp(`\\b${tn}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = tnRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + tn.length, tokenType: 'type' });
      }
    }

    // Quoted strings
    const strRegex = /"[^"]*"|'[^']*'/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: sm.index, endLine: i, endCol: sm.index + sm[0].length, tokenType: 'string' });
    }

    // aria-* attributes
    const ariaRegex = /\baria-\w+\b/g;
    let arm: RegExpExecArray | null;
    while ((arm = ariaRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: arm.index, endLine: i, endCol: arm.index + arm[0].length, tokenType: 'attribute' });
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

export const treeSitterWidgetSpecHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      const existing = await storage.find(RELATION, { language: 'widget-spec' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        grammarRef: 'tree-sitter-widget-spec',
        wasmPath: 'tree-sitter-widget-spec.wasm',
        language: 'widget-spec',
        extensions: JSON.stringify(['.widget']),
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
      const tree = parseWidgetSpec(source);
      return { variant: 'ok', tree: JSON.stringify(tree) };
    } catch (e) {
      return { variant: 'parseError', message: String(e) };
    }
  },

  async highlight(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const ranges = highlightWidgetSpec(source);
      return { variant: 'ok', highlights: JSON.stringify(ranges) };
    } catch (e) {
      return { variant: 'highlightError', message: String(e) };
    }
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const source = input.source as string;

    try {
      const tree = parseWidgetSpec(source);
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
      language: 'widget-spec',
      extensions: JSON.stringify(['.widget']),
      grammarVersion: '1.0.0',
      registered: record !== null,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterWidgetSpecCounter(): void {
  idCounter = 0;
}
