// @migrated dsl-constructs 2026-03-18
// ============================================================
// UniversalTreeSitterExtractor Handler
//
// Fallback symbol extraction provider using generic patterns for
// function, class, and type declarations. Works with any language
// that has no dedicated symbol extractor by applying universal
// declaration patterns.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `universal-tree-sitter-extractor-${++idCounter}`;
}

/**
 * Extract symbols from source text using universal patterns that work
 * across many programming languages. This is a fallback extractor that
 * identifies common declaration patterns.
 */
function extractUniversal(source: string, file: string): Array<{
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

  // Determine a language prefix from the file extension
  const extMatch = file.match(/\.(\w+)$/);
  const lang = extMatch ? extMatch[1] : 'unknown';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Universal function patterns
    const funcMatch = line.match(/(?:export\s+)?(?:pub\s+)?(?:async\s+)?(?:function|def|fn|func|fun|sub)\s+(\w+)\s*(?:<[^>]*>)?\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      symbols.push({
        symbolString: `${lang}/function/${file}/${funcName}`,
        kind: 'function',
        displayName: funcName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(funcName) + 1,
      });
    }

    // Universal class patterns
    const classMatch = line.match(/(?:export\s+)?(?:pub\s+)?(?:abstract\s+)?(?:class|struct)\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[1];
      symbols.push({
        symbolString: `${lang}/class/${file}/${className}`,
        kind: 'class',
        displayName: className,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(className) + 1,
      });
    }

    // Universal type/interface patterns
    const typeMatch = line.match(/(?:export\s+)?(?:pub\s+)?(?:interface|type|trait|protocol)\s+(\w+)/);
    if (typeMatch) {
      const typeName = typeMatch[1];
      symbols.push({
        symbolString: `${lang}/type/${file}/${typeName}`,
        kind: 'type',
        displayName: typeName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(typeName) + 1,
      });
    }

    // Universal enum pattern
    const enumMatch = line.match(/(?:export\s+)?(?:pub\s+)?(?:const\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      const enumName = enumMatch[1];
      symbols.push({
        symbolString: `${lang}/enum/${file}/${enumName}`,
        kind: 'type',
        displayName: enumName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(enumName) + 1,
      });
    }

    // Universal module/namespace patterns
    const moduleMatch = line.match(/(?:export\s+)?(?:pub\s+)?(?:module|namespace|package|mod)\s+([\w.]+)/);
    if (moduleMatch) {
      const modName = moduleMatch[1];
      symbols.push({
        symbolString: `${lang}/module/${file}/${modName}`,
        kind: 'concept',
        displayName: modName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(modName) + 1,
      });
    }

    // Universal constant/variable patterns
    const constMatch = line.match(/(?:export\s+)?(?:pub\s+)?(?:const|val|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/);
    if (constMatch) {
      const varName = constMatch[1];
      symbols.push({
        symbolString: `${lang}/variable/${file}/${varName}`,
        kind: 'variable',
        displayName: varName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(varName) + 1,
      });
    }

    // Universal import patterns
    const importMatch = line.match(/(?:import|use|require)\s+['"]?([\w./]+)['"]?/);
    if (importMatch) {
      const importPath = importMatch[1];
      symbols.push({
        symbolString: `${lang}/import/${importPath}`,
        kind: 'variable',
        displayName: importPath,
        role: 'import',
        line: lineNum,
        col: line.indexOf(importPath) + 1,
      });
    }
  }

  return symbols;
}

const _handler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'universal-tree-sitter-extractor', id, {
      id,
      extractorRef: 'universal-tree-sitter-extractor',
    });

    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },

  extract(input: Record<string, unknown>) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractUniversal(source, file);

    const p = createProgram();
    return complete(p, 'ok', {
      symbols: JSON.stringify(symbols),
    }) as StorageProgram<Result>;
  },

  getSupportedExtensions(_input: Record<string, unknown>) {
    // Universal extractor is a fallback -- it handles any extension
    const p = createProgram();
    return complete(p, 'ok', {
      extensions: JSON.stringify(['*']),
    }) as StorageProgram<Result>;
  },
};

export const universalTreeSitterExtractorHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetUniversalTreeSitterExtractorCounter(): void {
  idCounter = 0;
}
