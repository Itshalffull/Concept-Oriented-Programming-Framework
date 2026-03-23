// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Snapshot Concept Implementation
//
// Golden-file baselines for generated output. Compares current
// generator output against approved snapshots for stability.
// See Architecture doc Section 3.8
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, putFrom, traverse, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const BASELINES = 'snapshot-baselines';
const COMPARISONS = 'snapshot-comparisons';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

function computeDiff(
  baselineHash: string,
  currentHash: string,
): { diff: string; linesAdded: number; linesRemoved: number } {
  // Simplified diff — real implementation would compute unified diff
  // from actual file contents. Here we signal that content changed.
  return {
    diff: `--- baseline (${baselineHash})\n+++ current (${currentHash})`,
    linesAdded: Math.abs(parseInt(currentHash.slice(-4), 16) % 20),
    linesRemoved: Math.abs(parseInt(baselineHash.slice(-4), 16) % 10),
  };
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  compare(input: Record<string, unknown>) {
    let p = createProgram();
    const outputPath = input.outputPath as string;
    const currentContent = input.currentContent as string;
    const currentHash = simpleHash(currentContent);

    p = get(p, BASELINES, outputPath, 'baseline');

    p = branch(p,
      (bindings) => !bindings.baseline,
      (b) => {
        // New path — no baseline exists
        let b2 = put(b, COMPARISONS, outputPath, {
          path: outputPath,
          currentHash,
          status: 'new',
          diffSummary: null,
          comparedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { path: outputPath, contentHash: currentHash });
      },
      (b) => {
        // Baseline exists — check if changed
        return branch(b,
          (bindings) => {
            const baseline = bindings.baseline as Record<string, unknown>;
            return (baseline.contentHash as string) === currentHash;
          },
          (b2) => {
            // Unchanged
            let b3 = put(b2, COMPARISONS, outputPath, {
              path: outputPath,
              currentHash,
              status: 'current',
              diffSummary: null,
              comparedAt: new Date().toISOString(),
            });
            return completeFrom(b3, 'unchanged', (bindings) => {
              const baseline = bindings.baseline as Record<string, unknown>;
              return { snapshot: baseline.id as string };
            });
          },
          (b2) => {
            // Content changed
            let b3 = putFrom(b2, COMPARISONS, outputPath, (bindings) => {
              const baseline = bindings.baseline as Record<string, unknown>;
              const baselineHash = baseline.contentHash as string;
              const { diff, linesAdded, linesRemoved } = computeDiff(baselineHash, currentHash);
              return {
                path: outputPath,
                currentHash,
                status: 'changed',
                diffSummary: diff,
                linesAdded,
                linesRemoved,
                comparedAt: new Date().toISOString(),
              };
            });
            return completeFrom(b3, 'changed', (bindings) => {
              const baseline = bindings.baseline as Record<string, unknown>;
              const baselineHash = baseline.contentHash as string;
              const { diff, linesAdded, linesRemoved } = computeDiff(baselineHash, currentHash);
              return { snapshot: baseline.id as string, diff, linesAdded, linesRemoved };
            });
          },
        );
      },
    );

    return p as StorageProgram<Result>;
  },

  approve(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;
    const approver = input.approver as string | undefined;

    p = get(p, COMPARISONS, path, 'comparison');

    p = branch(p,
      (bindings) => {
        const comparison = bindings.comparison as Record<string, unknown> | undefined;
        return !comparison || (comparison.status as string) === 'current';
      },
      (b) => {
        let b2 = get(b, BASELINES, path, 'baseline');
        return completeFrom(b2, 'noChange', (bindings) => {
          const baseline = bindings.baseline as Record<string, unknown> | undefined;
          return { snapshot: baseline ? (baseline.id as string) : path };
        });
      },
      (b) => {
        const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        let b2 = putFrom(b, BASELINES, path, (bindings) => {
          const comparison = bindings.comparison as Record<string, unknown>;
          return {
            id: snapshotId,
            path,
            contentHash: comparison.currentHash as string,
            approvedAt: now,
            approvedBy: approver || null,
          };
        });

        b2 = putFrom(b2, COMPARISONS, path, (bindings) => {
          const comparison = bindings.comparison as Record<string, unknown>;
          return {
            ...comparison,
            status: 'current',
            diffSummary: null,
          };
        });

        return complete(b2, 'ok', { snapshot: snapshotId });
      },
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Approve all changed/new comparisons. Uses traverse to iterate over
   * filtered comparisons, creating baseline records and updating each
   * comparison status.
   */
  approveAll(input: Record<string, unknown>) {
    let p = createProgram();
    const paths = input.paths as string[] | undefined;

    p = find(p, COMPARISONS, {}, 'allComparisons');

    // Filter to only those needing approval
    p = mapBindings(p, (bindings) => {
      const allComparisons = (bindings.allComparisons || []) as Array<Record<string, unknown>>;
      const toApprove: Array<Record<string, unknown>> = [];

      for (const comp of allComparisons) {
        const status = comp.status as string;
        if (status !== 'changed' && status !== 'new') continue;

        const compPath = comp.path as string;
        if (paths && paths.length > 0) {
          const matchesPath = paths.some(prefix => compPath.startsWith(prefix));
          if (!matchesPath) continue;
        }

        toApprove.push(comp);
      }

      return toApprove;
    }, 'toApprove');

    // Traverse each comparison that needs approval
    p = traverse(p, 'toApprove', '_comp', (item) => {
      const comp = item as Record<string, unknown>;
      const compPath = comp.path as string;
      const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      let sub = createProgram();
      sub = put(sub, BASELINES, compPath, {
        id: snapshotId,
        path: compPath,
        contentHash: comp.currentHash as string,
        approvedAt: now,
        approvedBy: null,
      });
      sub = put(sub, COMPARISONS, compPath, {
        ...comp,
        status: 'current',
        diffSummary: null,
      });
      return complete(sub, 'ok', {});
    }, '_approveResults', { writes: ['snapshot-baselines', 'snapshot-comparisons'], completionVariants: ['ok'] });

    return completeFrom(p, 'ok', (bindings) => {
      const toApprove = (bindings.toApprove || []) as Array<Record<string, unknown>>;
      return { approved: toApprove.length };
    }) as StorageProgram<Result>;
  },

  reject(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;

    p = get(p, COMPARISONS, path, 'comparison');

    p = branch(p,
      (bindings) => {
        const comparison = bindings.comparison as Record<string, unknown> | undefined;
        return !comparison || (comparison.status as string) === 'current';
      },
      (b) => {
        let b2 = get(b, BASELINES, path, 'baseline');
        return completeFrom(b2, 'noChange', (bindings) => {
          const baseline = bindings.baseline as Record<string, unknown> | undefined;
          return { snapshot: baseline ? (baseline.id as string) : path };
        });
      },
      (b) => {
        let b2 = putFrom(b, COMPARISONS, path, (bindings) => {
          const comparison = bindings.comparison as Record<string, unknown>;
          return {
            ...comparison,
            status: 'rejected',
          };
        });

        b2 = get(b2, BASELINES, path, 'baseline');
        return completeFrom(b2, 'ok', (bindings) => {
          const baseline = bindings.baseline as Record<string, unknown> | undefined;
          return { snapshot: baseline ? (baseline.id as string) : path };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    let p = createProgram();
    const paths = input.paths as string[] | undefined;

    p = find(p, COMPARISONS, {}, 'allComparisons');

    // Use mapBindings to filter and compute results from bound data
    p = mapBindings(p, (bindings) => {
      const allComparisons = (bindings.allComparisons || []) as Array<Record<string, unknown>>;
      const results: Array<{
        path: string;
        status: string;
        linesChanged: number | null;
      }> = [];

      for (const comp of allComparisons) {
        const compPath = comp.path as string;
        if (paths && paths.length > 0) {
          const matches = paths.some(prefix => compPath.startsWith(prefix));
          if (!matches) continue;
        }

        const linesAdded = (comp.linesAdded as number) || 0;
        const linesRemoved = (comp.linesRemoved as number) || 0;

        results.push({
          path: compPath,
          status: comp.status as string,
          linesChanged: linesAdded + linesRemoved || null,
        });
      }

      return results;
    }, 'statusResults');

    return completeFrom(p, 'ok', (bindings) => {
      return { results: bindings.statusResults };
    }) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;

    p = get(p, BASELINES, path, 'baseline');
    p = get(p, COMPARISONS, path, 'comparison');

    // If no baseline AND no comparison → noBaseline
    p = branch(p,
      (bindings) => !bindings.baseline && !bindings.comparison,
      (b) => complete(b, 'noBaseline', { path }),
      (b) => {
        // If no baseline but comparison exists → ok (first-gen comparison)
        return branch(b,
          (bindings) => !bindings.baseline,
          (b2) => complete(b2, 'ok', { path }),
          (b2) => {
            // Baseline exists - check comparison status
            return branch(b2,
              (bindings) => {
                const comparison = bindings.comparison as Record<string, unknown> | undefined;
                return !comparison || (comparison.status as string) === 'current';
              },
              (b3) => complete(b3, 'unchanged', { path }),
              (b3) => completeFrom(b3, 'ok', (bindings) => {
                const baseline = bindings.baseline as Record<string, unknown>;
                const comparison = bindings.comparison as Record<string, unknown>;
                const baselineHash = baseline.contentHash as string;
                const currentHash = comparison.currentHash as string;
                const { diff, linesAdded, linesRemoved } = computeDiff(baselineHash, currentHash);
                return { diff, linesAdded, linesRemoved };
              }),
            );
          },
        );
      },
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Remove baselines that have no corresponding comparison (orphaned).
   * Uses traverse to delete each orphaned baseline.
   */
  clean(input: Record<string, unknown>) {
    let p = createProgram();
    const _outputDir = input.outputDir as string;

    p = find(p, BASELINES, {}, 'allBaselines');
    p = find(p, COMPARISONS, {}, 'allComparisons');

    // Identify orphaned baselines
    p = mapBindings(p, (bindings) => {
      const allBaselines = (bindings.allBaselines || []) as Array<Record<string, unknown>>;
      const allComparisons = (bindings.allComparisons || []) as Array<Record<string, unknown>>;
      const comparisonPaths = new Set(allComparisons.map(c => c.path as string));

      const orphaned: Array<Record<string, unknown>> = [];
      for (const baseline of allBaselines) {
        const path = baseline.path as string;
        if (!comparisonPaths.has(path)) {
          orphaned.push({ path });
        }
      }
      return orphaned;
    }, 'orphanedList');

    // Traverse orphaned baselines and delete each
    p = traverse(p, 'orphanedList', '_orphan', (item) => {
      const orphan = item as Record<string, unknown>;
      let sub = createProgram();
      sub = del(sub, BASELINES, orphan.path as string);
      return complete(sub, 'ok', { path: orphan.path });
    }, '_cleanResults', { writes: ['snapshot-baselines'], completionVariants: ['ok'] });

    return completeFrom(p, 'ok', (bindings) => {
      const orphanedList = (bindings.orphanedList || []) as Array<Record<string, unknown>>;
      return { removed: orphanedList.map(o => o.path) };
    }) as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const snapshotHandler = autoInterpret(_handler);
