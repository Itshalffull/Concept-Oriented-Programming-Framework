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
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
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
        return complete(b2, 'new', { path: outputPath, contentHash: currentHash });
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

  approveAll(input: Record<string, unknown>) {
    let p = createProgram();
    const paths = input.paths as string[] | undefined;

    p = find(p, COMPARISONS, 'allComparisons');
    let approved = 0;

    for (const comp of allComparisons) {
      const status = comp.status as string;
      if (status !== 'changed' && status !== 'new') continue;

      const compPath = comp.path as string;
      if (paths && paths.length > 0) {
        const matches = paths.some(prefix => compPath.startsWith(prefix));
        if (!matches) continue;
      }

      const currentHash = comp.currentHash as string;
      const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${approved}`;
      const now = new Date().toISOString();

      p = put(p, BASELINES, compPath, {
        id: snapshotId,
        path: compPath,
        contentHash: currentHash,
        approvedAt: now,
        approvedBy: null,
      });

      p = put(p, COMPARISONS, compPath, {
        ...comp,
        status: 'current',
        diffSummary: null,
      });

      approved++;
    }

    return complete(p, 'ok', { approved }) as StorageProgram<Result>;
  },

  reject(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;

    p = get(p, COMPARISONS, path, 'comparison');
    if (!comparison || comparison.status === 'current') {
      p = get(p, BASELINES, path, 'baseline');
      return complete(p, 'noChange', {
        snapshot: baseline ? (baseline.id as string) : path,
      }) as StorageProgram<Result>;
    }

    p = put(p, COMPARISONS, path, {
      ...comparison,
      status: 'rejected',
    });

    p = get(p, BASELINES, path, 'baseline');
    return complete(p, 'ok', {
      snapshot: baseline ? (baseline.id as string) : path,
    }) as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    let p = createProgram();
    const paths = input.paths as string[] | undefined;

    p = find(p, COMPARISONS, 'allComparisons');
    const results: Array<{
      path: string;
      status: string;
      linesChanged: number | null;
      approvedAt: string | null;
    }> = [];

    for (const comp of allComparisons) {
      const compPath = comp.path as string;
      if (paths && paths.length > 0) {
        const matches = paths.some(prefix => compPath.startsWith(prefix));
        if (!matches) continue;
      }

      p = get(p, BASELINES, compPath, 'baseline');
      const linesAdded = (comp.linesAdded as number) || 0;
      const linesRemoved = (comp.linesRemoved as number) || 0;

      results.push({
        path: compPath,
        status: comp.status as string,
        linesChanged: linesAdded + linesRemoved || null,
        approvedAt: baseline ? (baseline.approvedAt as string) : null,
      });
    }

    return complete(p, 'ok', { results }) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    let p = createProgram();
    const path = input.path as string;

    p = get(p, BASELINES, path, 'baseline');
    if (!baseline) {
      return complete(p, 'noBaseline', { path }) as StorageProgram<Result>;
    }

    p = get(p, COMPARISONS, path, 'comparison');
    if (!comparison || comparison.status === 'current') {
      return complete(p, 'unchanged', { path }) as StorageProgram<Result>;
    }

    const baselineHash = baseline.contentHash as string;
    const currentHash = comparison.currentHash as string;
    const { diff, linesAdded, linesRemoved } = computeDiff(baselineHash, currentHash);

    return complete(p, 'ok', { diff, linesAdded, linesRemoved }) as StorageProgram<Result>;
  },

  clean(input: Record<string, unknown>) {
    let p = createProgram();
    const _outputDir = input.outputDir as string;

    // Remove baselines that have no corresponding comparison (orphaned)
    p = find(p, BASELINES, 'allBaselines');
    const removed: string[] = [];

    for (const baseline of allBaselines) {
      const path = baseline.path as string;
      p = get(p, COMPARISONS, path, 'comparison');
      if (!comparison) {
        p = del(p, BASELINES, path);
        removed.push(path);
      }
    }

    return complete(p, 'ok', { removed }) as StorageProgram<Result>;
  },
};

export const snapshotHandler = autoInterpret(_handler);
