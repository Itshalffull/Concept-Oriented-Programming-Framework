// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// CssTokenSymbolExtractor Handler
//
// Symbol extraction provider for CSS files. Extracts custom property
// definitions (--token-*), class names, keyframe names, and media
// query identifiers as symbols. Supports design token tracing from
// theme specs through CSS custom properties.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `css-token-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from CSS source text using regex patterns.
 */
function extractFromCss(source: string, file: string): Array<{
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match CSS custom property definitions: --token-name: value;
    const customPropRegex = /--([\w-]+)\s*:/g;
    let customPropMatch;
    while ((customPropMatch = customPropRegex.exec(line)) !== null) {
      const propName = customPropMatch[1];
      symbols.push({
        symbolString: `css/custom-property/${file}/--${propName}`,
        kind: 'variable',
        displayName: `--${propName}`,
        role: 'definition',
        line: lineNum,
        col: customPropMatch.index + 1,
      });
    }

    // Match class selectors: .class-name
    const classRegex = /\.([a-zA-Z_][\w-]*)\s*[,{:[\s]/g;
    let classMatch;
    while ((classMatch = classRegex.exec(line)) !== null) {
      const className = classMatch[1];
      // Skip common pseudo-class keywords
      if (['hover', 'focus', 'active', 'visited', 'first-child', 'last-child',
        'not', 'nth-child', 'before', 'after', 'root'].includes(className)) continue;
      symbols.push({
        symbolString: `css/class/${file}/${className}`,
        kind: 'class',
        displayName: `.${className}`,
        role: 'definition',
        line: lineNum,
        col: classMatch.index + 1,
      });
    }

    // Match @keyframes name
    const keyframesMatch = line.match(/@keyframes\s+([\w-]+)/);
    if (keyframesMatch) {
      const kfName = keyframesMatch[1];
      symbols.push({
        symbolString: `css/keyframes/${file}/${kfName}`,
        kind: 'function',
        displayName: `@keyframes ${kfName}`,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(kfName) + 1,
      });
    }

    // Match @media query identifiers (named queries)
    const mediaMatch = line.match(/@media\s+\(?\s*([\w-]+)\s*[):]/);
    if (mediaMatch) {
      const mediaName = mediaMatch[1];
      if (!['min-width', 'max-width', 'min-height', 'max-height', 'screen', 'print',
        'all', 'not', 'only', 'prefers-color-scheme', 'prefers-reduced-motion'].includes(mediaName)) {
        symbols.push({
          symbolString: `css/media/${file}/${mediaName}`,
          kind: 'variable',
          displayName: `@media ${mediaName}`,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(mediaName) + 1,
        });
      }
    }

    // Match CSS custom property references: var(--token-name)
    const varRefRegex = /var\(\s*--([\w-]+)\s*[,)]/g;
    let varRefMatch;
    while ((varRefMatch = varRefRegex.exec(line)) !== null) {
      const refName = varRefMatch[1];
      symbols.push({
        symbolString: `css/custom-property-ref/--${refName}`,
        kind: 'variable',
        displayName: `var(--${refName})`,
        role: 'reference',
        line: lineNum,
        col: varRefMatch.index + 1,
      });
    }
  }

  return symbols;
}

type Result = { variant: string; [key: string]: unknown };

const _cssTokenSymbolExtractorHandler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'css-token-symbol-extractor', id, {
      id,
      extractorRef: 'css-token-symbol-extractor',
      handledExtensions: '.css',
      language: 'css',
    });
    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },

  extract(input: Record<string, unknown>) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromCss(source, file);

    const p = createProgram();
    return complete(p, 'ok', {
      symbols: JSON.stringify(symbols),
    }) as StorageProgram<Result>;
  },

  getSupportedExtensions(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      extensions: JSON.stringify(['.css']),
    }) as StorageProgram<Result>;
  },
};

export const cssTokenSymbolExtractorHandler = autoInterpret(_cssTokenSymbolExtractorHandler);

/** Reset the ID counter. Useful for testing. */
export function resetCssTokenSymbolExtractorCounter(): void {
  idCounter = 0;
}
