// @clef-handler style=functional concept=semantic
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SemanticMerge Handler
//
// Merge source code files using AST-level understanding. Resolves
// conflicts that are semantically non-conflicting at the text level,
// such as independently added imports or reordered function
// definitions.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

    if (line.startsWith('import ') || line.startsWith('from ')) {
      const startLine = i;
      let content = lines[i];
      while (i < lines.length && !lines[i].includes(';') && !lines[i + 1]?.trim().startsWith('import') && !lines[i + 1]?.trim().startsWith('from') && i - startLine < 10) {
        i++;
        content += '\n' + lines[i];
      }
      blocks.push({ type: 'import', name: line, content, startLine, endLine: i });
      i++;
      continue;
    }

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

      blocks.push({ type: 'function', name, content, startLine, endLine: i });
      i++;
      continue;
    }

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

      blocks.push({ type: 'class', name, content, startLine, endLine: i });
      i++;
      continue;
    }

    if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) {
      const startLine = i;
      let content = lines[i];

      if (line.startsWith('/*')) {
        while (i + 1 < lines.length && !lines[i].includes('*/')) {
          i++;
          content += '\n' + lines[i];
        }
      }

      blocks.push({ type: 'comment', name: `comment_${startLine}`, content, startLine, endLine: i });
      i++;
      continue;
    }

    blocks.push({ type: 'other', name: `block_${i}`, content: lines[i], startLine: i, endLine: i });
    i++;
  }

  return blocks;
}

/**
 * Semantic merge: merge at the block level.
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

  const baseImports = new Set(baseBlocks.filter(b => b.type === 'import').map(b => b.content.trim()));
  const oursImports = oursBlocks.filter(b => b.type === 'import').map(b => b.content.trim());
  const theirsImports = theirsBlocks.filter(b => b.type === 'import').map(b => b.content.trim());

  const mergedImports = new Set([...oursImports, ...theirsImports]);
  for (const imp of mergedImports) {
    resultParts.push(imp);
  }

  const baseNamed = new Map<string, CodeBlock>();
  const oursNamed = new Map<string, CodeBlock>();
  const theirsNamed = new Map<string, CodeBlock>();

  for (const block of baseBlocks.filter(b => b.type !== 'import')) baseNamed.set(block.name, block);
  for (const block of oursBlocks.filter(b => b.type !== 'import')) oursNamed.set(block.name, block);
  for (const block of theirsBlocks.filter(b => b.type !== 'import')) theirsNamed.set(block.name, block);

  const processedNames = new Set<string>();
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
        resultParts.push(oursBlock.content);
      } else if (baseBlock && oursBlock.content === baseBlock.content) {
        resultParts.push(theirsBlock.content);
      } else if (baseBlock && theirsBlock.content === baseBlock.content) {
        resultParts.push(oursBlock.content);
      } else {
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
      if (baseBlock) {
        if (oursBlock.content !== baseBlock.content) {
          const marker = `<<<<<<< ours\n${oursBlock.content}\n=======\n>>>>>>> theirs (deleted)`;
          conflicts.push(marker);
          resultParts.push(marker);
        }
      } else {
        resultParts.push(oursBlock.content);
      }
    } else if (theirsBlock) {
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

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'SemanticMerge',
      category: 'merge',
      contentTypes: ['text/x-python', 'text/typescript', 'text/javascript', 'text/x-java'],
    }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const base = input.base as string;
    const ours = input.ours as string;
    const theirs = input.theirs as string;

    if (typeof base !== 'string' || typeof ours !== 'string' || typeof theirs !== 'string') {
      const p = createProgram();
      return complete(p, 'unsupportedContent', { message: 'Content must be source code strings' }) as StorageProgram<Result>;
    }

    if (ours === theirs) {
      const p = createProgram();
      return complete(p, 'clean', { result: ours }) as StorageProgram<Result>;
    }
    if (ours === base) {
      const p = createProgram();
      return complete(p, 'clean', { result: theirs }) as StorageProgram<Result>;
    }
    if (theirs === base) {
      const p = createProgram();
      return complete(p, 'clean', { result: ours }) as StorageProgram<Result>;
    }

    const { result, conflicts } = semanticMerge(base, ours, theirs);

    const p = createProgram();
    if (result !== null) {
      return complete(p, 'clean', { result }) as StorageProgram<Result>;
    }

    return complete(p, 'conflicts', { regions: conflicts }) as StorageProgram<Result>;
  },
};

export const semanticMergeHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSemanticMergeCounter(): void {
  idCounter = 0;
}
