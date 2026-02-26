// ============================================================
// SyncSpecSymbolExtractor Handler
//
// Symbol extraction provider for .sync files. Extracts sync names,
// concept references, and variable bindings as symbols.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `sync-spec-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from .sync file source text using regex patterns.
 */
function extractFromSyncSpec(source: string, file: string): Array<{
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
  let syncName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match sync declaration: sync SyncName {
    const syncMatch = line.match(/^\s*sync\s+(\w+)\s*\{/);
    if (syncMatch) {
      syncName = syncMatch[1];
      symbols.push({
        symbolString: `clef/sync/${syncName}`,
        kind: 'sync',
        displayName: syncName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(syncName) + 1,
      });
      continue;
    }

    // Match concept references in when/then clauses: ConceptName.actionName(...)
    const conceptRefRegex = /\b([A-Z]\w+)\.(\w+)\s*\(/g;
    let conceptRefMatch;
    while ((conceptRefMatch = conceptRefRegex.exec(line)) !== null) {
      const conceptRef = conceptRefMatch[1];
      const actionRef = conceptRefMatch[2];

      // Concept reference
      symbols.push({
        symbolString: `clef/concept/${conceptRef}`,
        kind: 'concept',
        displayName: conceptRef,
        role: 'reference',
        line: lineNum,
        col: conceptRefMatch.index + 1,
      });

      // Action reference
      symbols.push({
        symbolString: `clef/concept/${conceptRef}/action/${actionRef}`,
        kind: 'action',
        displayName: `${conceptRef}.${actionRef}`,
        role: 'reference',
        line: lineNum,
        col: conceptRefMatch.index + conceptRef.length + 2,
      });
    }

    // Match variable bindings in when/where patterns: name: variableName
    // Pattern: paramName: varName  (in action patterns)
    const bindingRegex = /(\w+)\s*:\s*([a-z]\w*)\b/g;
    let bindingMatch;
    while ((bindingMatch = bindingRegex.exec(line)) !== null) {
      const varName = bindingMatch[2];
      // Skip common keywords and type names
      if (['string', 'int', 'bool', 'true', 'false', 'null', 'undefined',
        'when', 'where', 'then', 'sync'].includes(varName)) continue;
      // Skip if it looks like a key-value literal (quoted values)
      if (line.charAt(bindingMatch.index + bindingMatch[0].length) === '"') continue;

      symbols.push({
        symbolString: `clef/sync/${syncName || 'unknown'}/var/${varName}`,
        kind: 'variable',
        displayName: varName,
        role: 'definition',
        line: lineNum,
        col: bindingMatch.index + bindingMatch[1].length + 3,
      });
    }

    // Match variant references: -> variantName(...)
    const variantMatch = line.match(/->\s+(\w+)\s*\(/);
    if (variantMatch) {
      const variantName = variantMatch[1];
      symbols.push({
        symbolString: `clef/variant/${variantName}`,
        kind: 'variant',
        displayName: variantName,
        role: 'reference',
        line: lineNum,
        col: line.indexOf(variantName) + 1,
      });
    }
  }

  return symbols;
}

export const syncSpecSymbolExtractorHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('sync-spec-symbol-extractor', id, {
        id,
        extractorRef: 'sync-spec-symbol-extractor',
        handledExtensions: '.sync',
        language: 'sync-spec',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromSyncSpec(source, file);

    return {
      variant: 'ok',
      symbols: JSON.stringify(symbols),
    };
  },

  async getSupportedExtensions(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      extensions: JSON.stringify(['.sync']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSyncSpecSymbolExtractorCounter(): void {
  idCounter = 0;
}
