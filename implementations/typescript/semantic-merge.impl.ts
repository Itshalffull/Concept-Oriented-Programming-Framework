// ============================================================
// SemanticMerge Handler
//
// Merge source code files using AST-level understanding. Resolves
// conflicts that are semantically non-conflicting at the text level,
// such as independently added imports or reordered function
// definitions.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `semantic-merge-${++idCounter}`;
}

/**
 * Semantic block types that can be independently merged.
 */
interface CodeBlock {
  type: 'import' | 'function' | 'class' | 'variable' | 'export' | 'comment' | 'other';
  name: string;
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Simple heuristic block parser for common source code patterns.
 * Identifies imports, function definitions, and other top-level blocks.
 */
function parseBlocks(source: string): CodeBlock[] {
  const lines = source.split('\n');
  const blocks: CodeBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === '') {
      i++;
      continue;
    }

    // Import statements
    if (line.startsWith('import ') || line.startsWith('from ')) {
      const startLine = i;
      let content = lines[i];
      // Multi-line imports
      while (i < lines.length && !lines[i].includes(';') && !lines[i + 1]?.trim().startsWith('import') && !lines[i + 1]?.trim().startsWith('from') && i - startLine < 10) {
        i++;
        content += '\n' + lines[i];
      }
      blocks.push({
        type: 'import',
        name: line,
        content,
        startLine,
        endLine: i,
      });
      i++;
      continue;
    }

    // Function declarations
    if (line.startsWith('function ') || line.startsWith('async function ') ||
        line.startsWith('export function ') || line.startsWith('export async function ') ||
        line.startsWith('def ') || line.startsWith('async def ')) {
      const startLine = i;
      const nameMatch = line.match(/(?:export\s+)?(?:async\s+)?(?:function|def)\s+(\w+)/);
      const name = nameMatch ? nameMatch[1] : `fn_${i}`;
      let content = lines[i];
      let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

      if (braceCount > 0) {
        while (i + 1 < lines.length && braceCount > 0) {
          i++;
          content += '\n' + lines[i];
          braceCount += (lines[i].match(/{/g) || []).length;
          braceCount -= (lines[i].match(/}/g) || []).length;
        }
      }

      blocks.push({
        type: 'function',
        name,
        content,
        startLine,
        endLine: i,
      });
      i++;
      continue;
    }

    // Class declarations
    if (line.startsWith('class ') || line.startsWith('export class ')) {
      const startLine = i;
      const nameMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      const name = nameMatch ? nameMatch[1] : `class_${i}`;
      let content = lines[i];
      let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

      if (braceCount > 0) {
        while (i + 1 < lines.length && braceCount > 0) {
          i++;
          content += '\n' + lines[i];
          braceCount += (lines[i].match(/{/g) || []).length;
          braceCount -= (lines[i].match(/}/g) || []).length;
        }
      }

      blocks.push({
        type: 'class',
        name,
        content,
        startLine,
        endLine: i,
      });
      i++;
      continue;
    }

    // Comments
    if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) {
      const startLine = i;
      let content = lines[i];

      if (line.startsWith('/*')) {
        while (i + 1 < lines.length && !lines[i].includes('*/')) {
          i++;
          content += '\n' + lines[i];
        }
      }

      blocks.push({
        type: 'comment',
        name: `comment_${startLine}`,
        content,
        startLine,
        endLine: i,
      });
      i++;
      continue;
    }

    // Other lines
    blocks.push({
      type: 'other',
      name: `block_${i}`,
      content: lines[i],
      startLine: i,
      endLine: i,
    });
    i++;
  }

  return blocks;
}

/**
 * Semantic merge: merge at the block level.
 * Imports from both sides are unioned (deduplicated).
 * Functions/classes are matched by name -- if only one side changed, take that change.
 * Conflicts only arise when both sides modify the same named block differently.
 */
function semanticMerge(
  baseStr: string,
  oursStr: string,
  theirsStr: string,
): { result: string | null; conflicts: string[] } {
  const baseBlocks = parseBlocks(baseStr);
  const oursBlocks = parseBlocks(oursStr);
  const theirsBlocks = parseBlocks(theirsStr);

  const resultParts: string[] = [];
  const conflicts: string[] = [];

  // Handle imports: union all imports from both sides, deduplicate
  const baseImports = new Set(baseBlocks.filter(b => b.type === 'import').map(b => b.content.trim()));
  const oursImports = oursBlocks.filter(b => b.type === 'import').map(b => b.content.trim());
  const theirsImports = theirsBlocks.filter(b => b.type === 'import').map(b => b.content.trim());

  const mergedImports = new Set([...oursImports, ...theirsImports]);
  for (const imp of mergedImports) {
    resultParts.push(imp);
  }

  // Handle named blocks (functions, classes): merge by name
  const baseNamed = new Map<string, CodeBlock>();
  const oursNamed = new Map<string, CodeBlock>();
  const theirsNamed = new Map<string, CodeBlock>();

  for (const block of baseBlocks.filter(b => b.type !== 'import')) {
    baseNamed.set(block.name, block);
  }
  for (const block of oursBlocks.filter(b => b.type !== 'import')) {
    oursNamed.set(block.name, block);
  }
  for (const block of theirsBlocks.filter(b => b.type !== 'import')) {
    theirsNamed.set(block.name, block);
  }

  // Process all known block names
  const allNames = new Set([...oursNamed.keys(), ...theirsNamed.keys()]);
  const processedNames = new Set<string>();

  // Process in order they appear in ours first, then theirs for new blocks
  const orderedNames: string[] = [];
  for (const block of oursBlocks.filter(b => b.type !== 'import')) {
    if (!processedNames.has(block.name)) {
      orderedNames.push(block.name);
      processedNames.add(block.name);
    }
  }
  for (const block of theirsBlocks.filter(b => b.type !== 'import')) {
    if (!processedNames.has(block.name)) {
      orderedNames.push(block.name);
      processedNames.add(block.name);
    }
  }

  for (const name of orderedNames) {
    const baseBlock = baseNamed.get(name);
    const oursBlock = oursNamed.get(name);
    const theirsBlock = theirsNamed.get(name);

    if (oursBlock && theirsBlock) {
      if (oursBlock.content === theirsBlock.content) {
        // Both agree
        resultParts.push(oursBlock.content);
      } else if (baseBlock && oursBlock.content === baseBlock.content) {
        // Only theirs changed
        resultParts.push(theirsBlock.content);
      } else if (baseBlock && theirsBlock.content === baseBlock.content) {
        // Only ours changed
        resultParts.push(oursBlock.content);
      } else {
        // Both changed -- conflict
        const marker = [
          `<<<<<<< ours`,
          oursBlock.content,
          `=======`,
          theirsBlock.content,
          `>>>>>>> theirs`,
        ].join('\n');
        conflicts.push(marker);
        resultParts.push(marker);
      }
    } else if (oursBlock) {
      // Only in ours (added or theirs deleted)
      if (baseBlock) {
        // Was in base, theirs deleted it -- take the deletion
        // (but if ours modified it, conflict)
        if (oursBlock.content !== baseBlock.content) {
          const marker = `<<<<<<< ours\n${oursBlock.content}\n=======\n>>>>>>> theirs (deleted)`;
          conflicts.push(marker);
          resultParts.push(marker);
        }
        // Otherwise, theirs deletion wins
      } else {
        // New in ours
        resultParts.push(oursBlock.content);
      }
    } else if (theirsBlock) {
      // Only in theirs
      if (baseBlock) {
        if (theirsBlock.content !== baseBlock.content) {
          const marker = `<<<<<<< ours (deleted)\n=======\n${theirsBlock.content}\n>>>>>>> theirs`;
          conflicts.push(marker);
          resultParts.push(marker);
        }
      } else {
        resultParts.push(theirsBlock.content);
      }
    }
  }

  if (conflicts.length > 0) {
    return { result: null, conflicts };
  }

  return { result: resultParts.join('\n'), conflicts: [] };
}

export const semanticMergeHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'semantic',
      category: 'merge',
      contentTypes: ['text/x-python', 'text/typescript', 'text/javascript', 'text/x-java'],
    };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string;
    const ours = input.ours as string;
    const theirs = input.theirs as string;

    if (typeof base !== 'string' || typeof ours !== 'string' || typeof theirs !== 'string') {
      return { variant: 'unsupportedContent', message: 'Content must be source code strings' };
    }

    // Trivial cases
    if (ours === theirs) {
      return { variant: 'clean', result: ours };
    }
    if (ours === base) {
      return { variant: 'clean', result: theirs };
    }
    if (theirs === base) {
      return { variant: 'clean', result: ours };
    }

    const { result, conflicts } = semanticMerge(base, ours, theirs);

    if (result !== null) {
      return { variant: 'clean', result };
    }

    return { variant: 'conflicts', regions: conflicts };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSemanticMergeCounter(): void {
  idCounter = 0;
}
