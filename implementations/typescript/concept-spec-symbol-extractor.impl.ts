// ============================================================
// ConceptSpecSymbolExtractor Handler
//
// Symbol extraction provider for .concept files. Extracts concept
// name, action names, variant names, and state field names as
// symbols in the copf/* namespace.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `concept-spec-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from .concept file source text using regex patterns.
 * Returns an array of extracted symbol descriptors.
 */
function extractFromConceptSpec(source: string, file: string): Array<{
  symbolString: string;
  kind: string;
  displayName: string;
  role: string;
  line: number;
  col: number;
}> {
  const symbols: Array<{
    symbolString: string;
    kind: string;
    displayName: string;
    role: string;
    line: number;
    col: number;
  }> = [];

  const lines = source.split('\n');
  let conceptName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match concept declaration: concept ConceptName [T] {
    const conceptMatch = line.match(/^\s*concept\s+(\w+)\s*(?:\[.*?\])?\s*\{/);
    if (conceptMatch) {
      conceptName = conceptMatch[1];
      symbols.push({
        symbolString: `copf/concept/${conceptName}`,
        kind: 'concept',
        displayName: conceptName,
        role: 'definition',
        line: lineNum,
        col: (line.indexOf(conceptName) + 1),
      });
      continue;
    }

    // Match state field: fieldName: T -> Type  or  fieldName: set T
    const stateMatch = line.match(/^\s+(\w+)\s*:\s*(?:set\s+)?(\w+)(?:\s*->\s*(\w+))?\s*$/);
    if (stateMatch && conceptName) {
      const fieldName = stateMatch[1];
      // Skip common keywords that look like fields but are section headers
      if (!['purpose', 'state', 'actions', 'capabilities', 'invariant'].includes(fieldName)) {
        symbols.push({
          symbolString: `copf/concept/${conceptName}/state/${fieldName}`,
          kind: 'state-field',
          displayName: fieldName,
          role: 'definition',
          line: lineNum,
          col: (line.indexOf(fieldName) + 1),
        });
      }
    }

    // Match action declaration: action actionName(...)
    const actionMatch = line.match(/^\s+action\s+(\w+)\s*\(/);
    if (actionMatch && conceptName) {
      const actionName = actionMatch[1];
      symbols.push({
        symbolString: `copf/concept/${conceptName}/action/${actionName}`,
        kind: 'action',
        displayName: actionName,
        role: 'definition',
        line: lineNum,
        col: (line.indexOf(actionName) + 1),
      });
    }

    // Match variant: -> variantName(...)  or  -> variantName() {
    const variantMatch = line.match(/^\s+->\s+(\w+)\s*\(/);
    if (variantMatch && conceptName) {
      const variantName = variantMatch[1];
      symbols.push({
        symbolString: `copf/concept/${conceptName}/variant/${variantName}`,
        kind: 'variant',
        displayName: variantName,
        role: 'definition',
        line: lineNum,
        col: (line.indexOf(variantName) + 1),
      });
    }
  }

  return symbols;
}

export const conceptSpecSymbolExtractorHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('concept-spec-symbol-extractor', id, {
        id,
        extractorRef: 'concept-spec-symbol-extractor',
        handledExtensions: '.concept',
        language: 'concept-spec',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromConceptSpec(source, file);

    return {
      variant: 'ok',
      symbols: JSON.stringify(symbols),
    };
  },

  async getSupportedExtensions(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      extensions: JSON.stringify(['.concept']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConceptSpecSymbolExtractorCounter(): void {
  idCounter = 0;
}
