// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, getLens, find, complete, relation, at,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

// Lenses for storing coverage reports — dogfooding the lens DSL
const reportsRel = relation('reports');

interface SyncPattern {
  sync: string;
  variant?: string;
  concept?: string;
  action?: string;
}

/**
 * CompletionCoverage — functional handler.
 *
 * Cross-references declared completion variants against sync
 * when-patterns to find coverage gaps. Reports both uncovered
 * variants (variants with no matching sync) and orphaned patterns
 * (sync patterns referencing nonexistent variants).
 */
export const completionCoverageHandler: FunctionalConceptHandler = {
  check(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const action = input.action as string;
    const declaredVariantsStr = input.declaredVariants as string;
    const extractedVariantsStr = input.extractedVariants as string;
    const syncPatternsStr = input.syncPatterns as string;

    try {
      const declaredVariants: string[] = JSON.parse(declaredVariantsStr);
      const extractedVariants: string[] = JSON.parse(extractedVariantsStr);
      const syncPatterns: SyncPattern[] = JSON.parse(syncPatternsStr);

      // Use the union of declared + extracted as the full variant set
      const allVariants = new Set([...declaredVariants, ...extractedVariants]);

      // Find which variants are covered by at least one sync
      const coveredVariants = new Set<string>();
      for (const variant of allVariants) {
        const hasCovering = syncPatterns.some(p => {
          // A sync covers a variant if:
          // 1. It matches this concept/action (or has no filter on concept/action)
          // 2. It matches this variant (or has no variant filter — wildcard covers all)
          const conceptMatch = !p.concept || p.concept === concept;
          const actionMatch = !p.action || p.action === action;
          const variantMatch = !p.variant || p.variant === variant;
          return conceptMatch && actionMatch && variantMatch;
        });
        if (hasCovering) coveredVariants.add(variant);
      }

      // Uncovered = all variants minus covered
      const uncoveredVariants = [...allVariants].filter(v => !coveredVariants.has(v));

      // Orphaned = sync patterns that reference a specific variant not in our set
      const orphanedPatterns: string[] = [];
      for (const p of syncPatterns) {
        if (p.variant && !allVariants.has(p.variant)) {
          orphanedPatterns.push(`${p.sync}:${p.variant}`);
        }
      }

      const reportId = `cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const status = uncoveredVariants.length === 0 && orphanedPatterns.length === 0 ? 'covered' : 'uncovered';

      let p = createProgram();
      p = putLens(p, at(reportsRel, reportId), {
        concept,
        action,
        declaredVariants: JSON.stringify(declaredVariants),
        extractedVariants: JSON.stringify(extractedVariants),
        coveredVariants: JSON.stringify([...coveredVariants]),
        uncoveredVariants: JSON.stringify(uncoveredVariants),
        orphanedPatterns: JSON.stringify(orphanedPatterns),
        status,
      });

      if (status === 'covered') {
        p = complete(p, 'covered', { report: reportId });
      } else {
        p = complete(p, 'uncovered', {
          report: reportId,
          uncoveredVariants: JSON.stringify(uncoveredVariants),
          orphanedPatterns: JSON.stringify(orphanedPatterns),
        });
      }
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Failed to parse coverage inputs: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  report(input: Record<string, unknown>) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'reports', { concept }, 'reports');
    p = complete(p, 'ok', { reports: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listUncovered(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'reports', { status: 'uncovered' }, 'uncoveredReports');
    p = complete(p, 'ok', { uncovered: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
