// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConceptSpecSymbolExtractor Handler
//
// Symbol extraction provider for .concept files. Extracts concept
// name, action names, variant names, and state field names as
// symbols in the clef/* namespace.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `concept-spec-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from .concept file source text using regex patterns.
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

    const conceptMatch = line.match(/^\s*concept\s+(\w+)\s*(?:\[.*?\])?\s*\{/);
    if (conceptMatch) {
      conceptName = conceptMatch[1];
      symbols.push({
        symbolString: `clef/concept/${conceptName}`,
        kind: 'concept',
        displayName: conceptName,
        role: 'definition',
        line: lineNum,
        col: (line.indexOf(conceptName) + 1),
      });
      continue;
    }

    const stateMatch = line.match(/^\s+(\w+)\s*:\s*(?:set\s+)?(\w+)(?:\s*->\s*(\w+))?\s*$/);
    if (stateMatch && conceptName) {
      const fieldName = stateMatch[1];
      if (!['purpose', 'state', 'actions', 'capabilities', 'invariant'].includes(fieldName)) {
        symbols.push({
          symbolString: `clef/concept/${conceptName}/state/${fieldName}`,
          kind: 'state-field',
          displayName: fieldName,
          role: 'definition',
          line: lineNum,
          col: (line.indexOf(fieldName) + 1),
        });
      }
    }

    const actionMatch = line.match(/^\s+action\s+(\w+)\s*\(/);
    if (actionMatch && conceptName) {
      const actionName = actionMatch[1];
      symbols.push({
        symbolString: `clef/concept/${conceptName}/action/${actionName}`,
        kind: 'action',
        displayName: actionName,
        role: 'definition',
        line: lineNum,
        col: (line.indexOf(actionName) + 1),
      });
    }

    const variantMatch = line.match(/^\s+->\s+(\w+)\s*\(/);
    if (variantMatch && conceptName) {
      const variantName = variantMatch[1];
      symbols.push({
        symbolString: `clef/concept/${conceptName}/variant/${variantName}`,
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

const _handler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'concept-spec-symbol-extractor', id, {
      id,
      extractorRef: 'concept-spec-symbol-extractor',
      handledExtensions: '.concept',
      language: 'concept-spec',
    });

    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },

  extract(input: Record<string, unknown>) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromConceptSpec(source, file);

    const p = createProgram();
    return complete(p, 'ok', {
      symbols: JSON.stringify(symbols),
    }) as StorageProgram<Result>;
  },

  getSupportedExtensions(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      extensions: JSON.stringify(['.concept']),
    }) as StorageProgram<Result>;
  },
};

export const conceptSpecSymbolExtractorHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConceptSpecSymbolExtractorCounter(): void {
  idCounter = 0;
}
