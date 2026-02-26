// ============================================================
// UniversalTreeSitterExtractor Handler
//
// Fallback symbol extraction provider using generic patterns for
// function, class, and type declarations. Works with any language
// that has no dedicated symbol extractor by applying universal
// declaration patterns.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

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

    // Universal function patterns:
    // function name(   (JS/TS/PHP/Hack)
    // def name(         (Python/Ruby)
    // fn name(          (Rust)
    // func name(        (Go)
    // fun name(         (Kotlin)
    // sub name(         (Perl)
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

    // Universal class patterns:
    // class Name         (most languages)
    // struct Name        (Rust/Go/C)
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

    // Universal type/interface patterns:
    // interface Name     (TS/Java/Go)
    // type Name          (TS/Go/Rust)
    // trait Name         (Rust/Scala)
    // protocol Name      (Swift)
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

    // Universal enum pattern:
    // enum Name
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

    // Universal module/namespace patterns:
    // module Name        (TS/Haskell)
    // namespace Name     (TS/C#/C++)
    // package Name       (Java/Go)
    // mod Name           (Rust)
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

    // Universal constant/variable patterns:
    // const NAME =       (JS/TS)
    // val name =         (Kotlin/Scala)
    // let name =         (JS/TS/Rust/Swift)
    // var name =         (JS/TS/Go/Swift)
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

    // Universal import patterns:
    // import ... from '...'     (JS/TS)
    // import name               (Python/Java)
    // use name                  (Rust)
    // require('...')            (Node.js)
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

export const universalTreeSitterExtractorHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('universal-tree-sitter-extractor', id, {
        id,
        extractorRef: 'universal-tree-sitter-extractor',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractUniversal(source, file);

    return {
      variant: 'ok',
      symbols: JSON.stringify(symbols),
    };
  },

  async getSupportedExtensions(input: Record<string, unknown>, storage: ConceptStorage) {
    // Universal extractor is a fallback -- it handles any extension
    return {
      variant: 'ok',
      extensions: JSON.stringify(['*']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetUniversalTreeSitterExtractorCounter(): void {
  idCounter = 0;
}
