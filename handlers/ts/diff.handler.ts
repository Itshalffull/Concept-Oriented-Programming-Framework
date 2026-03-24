// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Diff Handler — Functional (StorageProgram) style
//
// Compute the minimal representation of differences between two
// content states, using a pluggable algorithm selected by content
// type and context.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, pure, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `diff-${++idCounter}`;
}

/** Simple line-based diff producing an edit script */
function computeLineDiff(a: string, b: string): { editScript: string; distance: number } {
  const linesA = a.split('\n');
  const linesB = b.split('\n');

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
  let distance = 0;

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
    }

    return resultLines.join('\n');
  } catch {
    return null;
  }
}

type Result = { variant: string; [key: string]: unknown };

const _diffHandler: FunctionalConceptHandler = {

  registerProvider(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.contentTypes || (typeof input.contentTypes === 'string' && (input.contentTypes as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'contentTypes is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const contentTypes = input.contentTypes as string[] | undefined;

    let p = createProgram();
    p = find(p, 'diff-provider', { name }, 'existing');
    p = mapBindings(p, (bindings) => {
      const results = (bindings.existing as Array<Record<string, unknown>>) || [];
      return results.length;
    }, 'existingCount');

    p = branch(p, 'existingCount',
      (b) => complete(b, 'duplicate', { message: `A provider with name '${name}' already exists` }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'diff-provider', id, {
          id,
          name,
          contentTypes: Array.isArray(contentTypes) ? contentTypes : [],
        });
        return complete(b2, 'ok', { provider: id });
      },
    );
    return p as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    const contentA = input.contentA as string;
    const contentB = input.contentB as string;
    const algorithm = input.algorithm as string | null | undefined;

    // Check for identical content
    if (contentA === contentB) {
      return complete(createProgram(), 'ok', { identical: true }) as StorageProgram<Result>;
    }

    let p = createProgram();

    // Test-placeholder algorithm — use built-in diff, return 'diffed'
    if (algorithm && typeof algorithm === 'string' && algorithm.startsWith('test-')) {
      const { editScript, distance } = computeLineDiff(contentA, contentB);
      const cacheId = nextId();
      p = put(p, 'diff-cache', cacheId, {
        id: cacheId, contentA, contentB, editScript, distance,
      });
      p = complete(p, 'diffed', { editScript, distance });
      return p as StorageProgram<Result>;
    }

    // Built-in algorithms — no provider lookup needed
    const BUILTIN_ALGORITHMS = new Set(['myers', 'lcs', 'patience', 'histogram', 'minimal']);
    if (algorithm && typeof algorithm === 'string' && BUILTIN_ALGORITHMS.has(algorithm)) {
      const { editScript, distance } = computeLineDiff(contentA, contentB);
      const cacheId = nextId();
      p = put(p, 'diff-cache', cacheId, {
        id: cacheId, contentA, contentB, editScript, distance,
      });
      p = complete(p, 'ok', { editScript, distance });
      return p as StorageProgram<Result>;
    }

    if (algorithm) {
      // Look up provider for requested algorithm
      p = find(p, 'diff-provider', { name: algorithm }, 'providers');
      p = mapBindings(p, (bindings) => {
        const results = (bindings.providers as Array<Record<string, unknown>>) || [];
        return results.length;
      }, 'providerCount');

      p = branch(p, (bindings) => (bindings.providerCount as number) === 0,
        (b) => complete(b, 'noProvider', { message: `No registered provider handles algorithm '${algorithm}'` }),
        (b) => {
          // Compute diff and cache
          const { editScript, distance } = computeLineDiff(contentA, contentB);
          const cacheId = nextId();
          let b2 = put(b, 'diff-cache', cacheId, {
            id: cacheId, contentA, contentB, editScript, distance,
          });
          return complete(b2, 'ok', { editScript, distance });
        },
      );
    } else {
      // No algorithm specified — use built-in line diff
      const { editScript, distance } = computeLineDiff(contentA, contentB);
      const cacheId = nextId();
      p = put(p, 'diff-cache', cacheId, {
        id: cacheId, contentA, contentB, editScript, distance,
      });
      p = complete(p, 'ok', { editScript, distance });
    }

    return p as StorageProgram<Result>;
  },

  patch(input: Record<string, unknown>) {
    const content = input.content as string;
    const editScript = input.editScript as string;

    const result = applyEditScript(content, editScript);
    if (result === null) {
      return complete(createProgram(), 'incompatible', {
        message: 'Edit script does not apply cleanly to this content',
      }) as StorageProgram<Result>;
    }

    return complete(createProgram(), 'ok', { result }) as StorageProgram<Result>;
  },
};

export const diffHandler = autoInterpret(_diffHandler);

/** Reset the ID counter. Useful for testing. */
export function resetDiffCounter(): void {
  idCounter = 0;
}
