// ============================================================
// Diff Handler
//
// Compute the minimal representation of differences between two
// content states, using a pluggable algorithm selected by content
// type and context.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `diff-${++idCounter}`;
}

/** Simple line-based diff producing an edit script */
function computeLineDiff(a: string, b: string): { editScript: string; distance: number } {
  const linesA = a.split('\n');
  const linesB = b.split('\n');

  const ops: string[] = [];
  let distance = 0;

  // Simple LCS-based diff
  const m = linesA.length;
  const n = linesB.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce edit operations
  let i = m;
  let j = n;
  const editOps: Array<{ type: string; line: number; content: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      editOps.unshift({ type: 'equal', line: i - 1, content: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      editOps.unshift({ type: 'insert', line: j - 1, content: linesB[j - 1] });
      distance++;
      j--;
    } else {
      editOps.unshift({ type: 'delete', line: i - 1, content: linesA[i - 1] });
      distance++;
      i--;
    }
  }

  return { editScript: JSON.stringify(editOps), distance };
}

/** Apply an edit script to content */
function applyEditScript(content: string, editScript: string): string | null {
  try {
    const ops = JSON.parse(editScript) as Array<{ type: string; line: number; content: string }>;
    const resultLines: string[] = [];

    for (const op of ops) {
      if (op.type === 'equal' || op.type === 'insert') {
        resultLines.push(op.content);
      }
      // 'delete' lines are skipped
    }

    return resultLines.join('\n');
  } catch {
    return null;
  }
}

export const diffHandler: ConceptHandler = {
  async registerProvider(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const contentTypes = input.contentTypes as string[];

    // Check for duplicates
    const existing = await storage.find('diff-provider', { name });
    if (existing.length > 0) {
      return { variant: 'duplicate', message: `A provider with name '${name}' already exists` };
    }

    const id = nextId();
    await storage.put('diff-provider', id, {
      id,
      name,
      contentTypes: Array.isArray(contentTypes) ? contentTypes : [],
    });

    return { variant: 'ok', provider: id };
  },

  async diff(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentA = input.contentA as string;
    const contentB = input.contentB as string;
    const algorithm = input.algorithm as string | null | undefined;

    // Check for identical content
    if (contentA === contentB) {
      return { variant: 'identical' };
    }

    // If algorithm specified, look up provider
    if (algorithm) {
      const providers = await storage.find('diff-provider', { name: algorithm });
      if (providers.length === 0) {
        return { variant: 'noProvider', message: `No registered provider handles algorithm '${algorithm}'` };
      }
    }

    // Use built-in line diff
    const { editScript, distance } = computeLineDiff(contentA, contentB);

    // Cache the result
    const cacheId = nextId();
    await storage.put('diff-cache', cacheId, {
      id: cacheId,
      contentA,
      contentB,
      editScript,
      distance,
    });

    return { variant: 'diffed', editScript, distance };
  },

  async patch(input: Record<string, unknown>, storage: ConceptStorage) {
    const content = input.content as string;
    const editScript = input.editScript as string;

    const result = applyEditScript(content, editScript);
    if (result === null) {
      return { variant: 'incompatible', message: 'Edit script does not apply cleanly to this content' };
    }

    return { variant: 'ok', result };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDiffCounter(): void {
  idCounter = 0;
}
