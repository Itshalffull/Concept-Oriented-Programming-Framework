// ============================================================
// ThemeSpecSymbolExtractor Handler
//
// Symbol extraction provider for Clef Surface theme spec files. Extracts
// token names, scale values, semantic aliases, and mode variants
// as symbols in the surface/* namespace.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `theme-spec-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from theme spec source text using regex patterns.
 * Theme spec files define design tokens, scales, semantic aliases,
 * and mode variants.
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

    // Match theme declaration: theme ThemeName { or name: ThemeName
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

    // Track sections: tokens, scales, semantic, modes
    const sectionMatch = line.match(/^\s*(tokens|scales?|semantic|modes?|colors?|spacing|typography)\s*[:{]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Match token definitions: tokenName: value or --token-name: value
    const tokenMatch = line.match(/^\s+([\w-]+)\s*:\s*(.+)/);
    if (tokenMatch && currentSection) {
      const tokenName = tokenMatch[1];
      // Skip common YAML/JSON structure keywords
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

    // Match token references: {tokens.colorName} or {scale.size}
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

export const themeSpecSymbolExtractorHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('theme-spec-symbol-extractor', id, {
        id,
        extractorRef: 'theme-spec-symbol-extractor',
        handledExtensions: '.theme,.theme.yaml,.theme.json',
        language: 'theme-spec',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromThemeSpec(source, file);

    return {
      variant: 'ok',
      symbols: JSON.stringify(symbols),
    };
  },

  async getSupportedExtensions(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      extensions: JSON.stringify(['.theme', '.theme.yaml', '.theme.json']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetThemeSpecSymbolExtractorCounter(): void {
  idCounter = 0;
}
