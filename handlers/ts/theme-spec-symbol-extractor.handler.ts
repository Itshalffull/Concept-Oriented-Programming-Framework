// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ThemeSpecSymbolExtractor Handler
//
// Symbol extraction provider for Clef Surface theme spec files. Extracts
// token names, scale values, semantic aliases, and mode variants
// as symbols in the surface/* namespace.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `theme-spec-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from theme spec source text using regex patterns.
 */
function extractFromThemeSpec(source: string, file: string): Array<{
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
  let currentSection = '';
  let themeName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const themeMatch = line.match(/^\s*(?:theme\s+(\w[\w-]*)|name\s*:\s*['"]?([\w-]+)['"]?)\s*/);
    if (themeMatch) {
      themeName = themeMatch[1] || themeMatch[2];
      if (themeName) {
        symbols.push({
          symbolString: `surface/theme/${themeName}`,
          kind: 'concept',
          displayName: themeName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(themeName) + 1,
        });
      }
      continue;
    }

    const sectionMatch = line.match(/^\s*(tokens|scales?|semantic|modes?|colors?|spacing|typography)\s*[:{]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    const tokenMatch = line.match(/^\s+([\w-]+)\s*:\s*(.+)/);
    if (tokenMatch && currentSection) {
      const tokenName = tokenMatch[1];
      if (['true', 'false', 'null', 'description', 'type', 'value', 'default'].includes(tokenName)) continue;

      const prefix = themeName ? `surface/theme/${themeName}` : 'surface/theme';

      if (currentSection === 'tokens' || currentSection === 'colors' || currentSection === 'spacing' || currentSection === 'typography') {
        symbols.push({
          symbolString: `${prefix}/token/${tokenName}`,
          kind: 'config-key',
          displayName: tokenName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(tokenName) + 1,
        });
      } else if (currentSection === 'scales' || currentSection === 'scale') {
        symbols.push({
          symbolString: `${prefix}/scale/${tokenName}`,
          kind: 'config-key',
          displayName: tokenName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(tokenName) + 1,
        });
      } else if (currentSection === 'semantic') {
        symbols.push({
          symbolString: `${prefix}/semantic/${tokenName}`,
          kind: 'config-key',
          displayName: tokenName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(tokenName) + 1,
        });
      } else if (currentSection === 'modes' || currentSection === 'mode') {
        symbols.push({
          symbolString: `${prefix}/mode/${tokenName}`,
          kind: 'variant',
          displayName: tokenName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(tokenName) + 1,
        });
      }
    }

    const tokenRefRegex = /\{([\w./-]+)\}/g;
    let tokenRefMatch;
    while ((tokenRefMatch = tokenRefRegex.exec(line)) !== null) {
      const refPath = tokenRefMatch[1];
      symbols.push({
        symbolString: `surface/theme-ref/${refPath}`,
        kind: 'config-key',
        displayName: refPath,
        role: 'reference',
        line: lineNum,
        col: tokenRefMatch.index + 1,
      });
    }
  }

  return symbols;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'theme-spec-symbol-extractor', id, {
      id,
      extractorRef: 'theme-spec-symbol-extractor',
      handledExtensions: '.theme,.theme.yaml,.theme.json',
      language: 'theme-spec',
    });

    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },

  extract(input: Record<string, unknown>) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromThemeSpec(source, file);

    const p = createProgram();
    return complete(p, 'ok', {
      symbols: JSON.stringify(symbols),
    }) as StorageProgram<Result>;
  },

  getSupportedExtensions(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      extensions: JSON.stringify(['.theme', '.theme.yaml', '.theme.json']),
    }) as StorageProgram<Result>;
  },
};

export const themeSpecSymbolExtractorHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetThemeSpecSymbolExtractorCounter(): void {
  idCounter = 0;
}
