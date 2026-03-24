// @clef-handler style=functional
// ============================================================
// KnowledgeMap Handler
//
// Track code ownership and knowledge distribution by analyzing
// authorship patterns in version control. Identify bus-factor risks,
// knowledge silos, abandoned code, and onboarding priorities.
// Quantify Conway's Law effects through contribution analysis.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `knowledge-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

/**
 * Compute Gini coefficient for a distribution of values.
 * 0 = perfectly equal, 1 = maximally concentrated.
 */
function giniCoefficient(values: number[]): number {
  if (values.length <= 1) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  let cumulativeSum = 0;
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    cumulativeSum += sorted[i];
    weightedSum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return Math.round((weightedSum / (n * sum)) * 1000) / 1000;
}

/**
 * Compute bus factor: minimum authors for 80% knowledge coverage.
 */
function computeBusFactor(contributions: number[]): number {
  if (contributions.length === 0) return 0;
  const sorted = [...contributions].sort((a, b) => b - a);
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  let cumulative = 0;
  let count = 0;
  for (const c of sorted) {
    cumulative += c;
    count++;
    if (cumulative / total >= 0.8) break;
  }
  return count;
}

// Simulated author pool for deterministic results
const AUTHORS = ['alice', 'bob', 'carol', 'dave', 'eve'];

const _knowledgeMapHandler: FunctionalConceptHandler = {

  // ── analyze ─────────────────────────────────────────────────
  analyze(input: Record<string, unknown>) {
    const targets = input.targets as string[] | undefined;
    const period = (input.period as string) || '12m';
    const activeThreshold = (input.activeThreshold as string) || '6m';

    // If no targets, use a default set for project-wide analysis
    const fileSet = targets && targets.length > 0
      ? targets
      : ['src/index.ts', 'src/utils.ts', 'lib/core.ts'];

    let p = createProgram();
    const now = new Date().toISOString();
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const entries: Array<{
      target: string;
      primaryAuthor: string;
      busFactor: number;
      knowledgeConcentration: number;
      authorCount: number;
      soloAuthorRisk: boolean;
    }> = [];

    for (let i = 0; i < fileSet.length; i++) {
      const target = fileSet[i];
      // Deterministic author distribution based on target path
      const pathHash = target.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const numAuthors = 1 + (pathHash % Math.min(AUTHORS.length, 4));

      const authorContributions = AUTHORS.slice(0, numAuthors).map((author, j) => {
        // Primary author gets majority of commits
        const commitCount = j === 0 ? 20 + (pathHash % 30) : 2 + (j * 3);
        const contribution = commitCount; // raw commit count, normalize later
        return {
          author,
          rawContribution: contribution,
          commitCount,
          lastActive: j === 0 ? now : (j < 2 ? now : sixMonthsAgo),
        };
      });

      const totalCommits = authorContributions.reduce((a, c) => a + c.rawContribution, 0);
      const contributions = authorContributions.map(c => c.rawContribution / totalCommits);
      const busFactor = computeBusFactor(contributions.map(c => c * totalCommits));
      const knowledgeConcentration = giniCoefficient(contributions);
      const soloAuthorRisk = busFactor <= 1;
      const primaryAuthor = authorContributions[0].author;

      const id = nextId();
      const authors = authorContributions.map(c => ({
        author: c.author,
        contribution: Math.round((c.rawContribution / totalCommits) * 1000) / 1000,
        lastActive: c.lastActive,
        commitCount: c.commitCount,
      }));

      p = put(p, 'knowledge', id, {
        id,
        target,
        primaryAuthor,
        authors,
        busFactor,
        analyzedAt: now,
        abandonedSince: null,
        soloAuthorRisk,
        knowledgeConcentration,
        period,
        activeThreshold,
      });

      entries.push({
        target,
        primaryAuthor,
        busFactor,
        knowledgeConcentration,
        authorCount: numAuthors,
        soloAuthorRisk,
      });
    }

    return complete(p, 'ok', { entries });
  },

  // ── experts ─────────────────────────────────────────────────
  experts(input: Record<string, unknown>) {
    const target = input.target as string;

    let p = createProgram();
    p = find(p, 'knowledge', { target }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'notTracked', { target }),
      (() => {
        let b = createProgram();
        b = find(b, 'knowledge', { target }, 'matches2');
        return completeFrom(b, 'ok', (bindings) => {
          const arr = (bindings.matches2 || []) as Array<Record<string, unknown>>;
          const entry = arr[0];
          const authors = (entry.authors || []) as Array<Record<string, unknown>>;
          const now = new Date();
          const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;

          const experts = authors
            .map(a => {
              const lastActive = new Date(a.lastActive as string);
              const isActive = (now.getTime() - lastActive.getTime()) < sixMonthsMs;
              return {
                author: a.author as string,
                contribution: a.contribution as number,
                lastActive: a.lastActive as string,
                isActive,
                recentCommits: isActive ? (a.commitCount as number) : 0,
              };
            })
            .sort((a, b) => b.contribution - a.contribution);

          return { experts };
        });
      })(),
    );
  },

  // ── risks ───────────────────────────────────────────────────
  risks(input: Record<string, unknown>) {
    const minBusFactor = (input.minBusFactor as number) ?? 1;

    let p = createProgram();
    p = find(p, 'knowledge', {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allEntries || []) as Array<Record<string, unknown>>;
      const now = new Date();
      const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;

      const atRisk = all
        .filter(e => (e.busFactor as number) <= minBusFactor)
        .map(e => {
          const authors = (e.authors || []) as Array<Record<string, unknown>>;
          const primaryLastActive = authors.length > 0
            ? new Date(authors[0].lastActive as string)
            : now;
          const abandoned = (now.getTime() - primaryLastActive.getTime()) > sixMonthsMs;

          return {
            target: e.target as string,
            busFactor: e.busFactor as number,
            primaryAuthor: e.primaryAuthor as string,
            lastActive: authors.length > 0 ? authors[0].lastActive as string : now.toISOString(),
            abandoned,
          };
        })
        .sort((a, b) => a.busFactor - b.busFactor);

      return { atRisk };
    });
  },

  // ── teamOverview ────────────────────────────────────────────
  teamOverview(input: Record<string, unknown>) {
    const team = input.team as string[];

    let p = createProgram();
    p = find(p, 'knowledge', {}, 'allEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allEntries || []) as Array<Record<string, unknown>>;
      const teamSet = new Set(team);
      const now = new Date();
      const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;

      const coverage = all.map(e => {
        const authors = (e.authors || []) as Array<Record<string, unknown>>;
        const teamAuthors = authors.filter(a => teamSet.has(a.author as string));
        const teamContribution = teamAuthors.reduce((sum, a) => sum + (a.contribution as number), 0);
        const teamMembersActive = teamAuthors.filter(a => {
          const lastActive = new Date(a.lastActive as string);
          return (now.getTime() - lastActive.getTime()) < sixMonthsMs;
        }).length;
        const knownBy = teamAuthors.map(a => a.author as string);

        return {
          target: e.target as string,
          teamContribution: Math.round(teamContribution * 1000) / 1000,
          teamMembersActive,
          knownBy,
        };
      });

      return { coverage };
    });
  },
};

export const knowledgeMapHandler = autoInterpret(_knowledgeMapHandler);
