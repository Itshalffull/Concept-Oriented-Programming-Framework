// @clef-handler style=functional concept=GitLogParserProvider
// ============================================================
// GitLogParserProvider Handler
//
// Shared VCS provider that parses git log output into structured
// commit records and computes derived metrics: per-file change
// frequency, co-change matrix, and knowledge map (bus factor +
// Gini coefficient). Registers with PluginRegistry as a VCS
// provider under name "git-log-parser".
//
// Actions:
//   parseLog          — shell out to git log, parse raw output
//   getFileStats      — per-file commit count, unique authors, timestamps
//   getCoChangeMatrix — files co-modified in same commit (coupling)
//   getKnowledgeMap   — author recency-weighted contributions + bus factor
//
// All actions accept repoPath + timeWindow inputs, shell out via
// perform('local-process', 'run', ...) and return ok(result: String)
// as a JSON payload or error(message).
//
// Shell command:
//   git log --since="<window>" \
//            --pretty=format:"%H %ae %aI" \
//            --name-only
//
// Output block format (per commit):
//   <hash> <email> <iso-timestamp>
//   <file1>
//   <file2>
//   (blank line)
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, perform, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'GitLogParserProvider';
const DEFAULT_WINDOW = '6 months ago';

// ──────────────────────────────────────────────────────────────
// Commit record types
// ──────────────────────────────────────────────────────────────

interface CommitRecord {
  hash: string;
  authorEmail: string;
  timestamp: string; // ISO 8601
  files: string[];
}

interface FileStats {
  file: string;
  commitCount: number;
  uniqueAuthors: string[];
  firstSeen: string;
  lastSeen: string;
}

interface CoChangePair {
  fileA: string;
  fileB: string;
  count: number;
}

interface AuthorContribution {
  email: string;
  weightedScore: number; // recency-weighted
  commits: number;
  share: number; // fraction of total weight
}

interface KnowledgeMapEntry {
  file: string;
  busFactor: number; // authors covering ≥80 % of weighted score
  giniCoefficient: number; // inequality of contributions
  topContributors: AuthorContribution[];
}

// ──────────────────────────────────────────────────────────────
// Pure parsing helpers
// ──────────────────────────────────────────────────────────────

/**
 * Parse raw `git log --pretty=format:"%H %ae %aI" --name-only` output
 * into an array of CommitRecord objects.
 *
 * Blocks are separated by blank lines. The first line of each block
 * is the commit header; subsequent non-blank lines are file paths.
 */
function parseGitLogOutput(raw: string): CommitRecord[] {
  const commits: CommitRecord[] = [];
  const blocks = raw.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // First line: "<hash> <email> <isoTimestamp>"
    const headerLine = lines[0];
    const spaceIdx1 = headerLine.indexOf(' ');
    if (spaceIdx1 < 0) continue;
    const spaceIdx2 = headerLine.indexOf(' ', spaceIdx1 + 1);
    if (spaceIdx2 < 0) continue;

    const hash = headerLine.slice(0, spaceIdx1);
    const authorEmail = headerLine.slice(spaceIdx1 + 1, spaceIdx2);
    const timestamp = headerLine.slice(spaceIdx2 + 1).trim();

    if (!hash || !authorEmail || !timestamp) continue;

    const files = lines.slice(1).filter(l => l.length > 0 && !l.startsWith(' '));

    commits.push({ hash, authorEmail, timestamp, files });
  }

  return commits;
}

/**
 * Build per-file stats from a list of commit records.
 */
function buildFileStats(commits: CommitRecord[]): FileStats[] {
  const map = new Map<string, { authors: Set<string>; timestamps: string[] }>();

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!map.has(file)) {
        map.set(file, { authors: new Set(), timestamps: [] });
      }
      const entry = map.get(file)!;
      entry.authors.add(commit.authorEmail);
      entry.timestamps.push(commit.timestamp);
    }
  }

  const stats: FileStats[] = [];
  for (const [file, entry] of map.entries()) {
    const sorted = [...entry.timestamps].sort();
    stats.push({
      file,
      commitCount: entry.timestamps.length,
      uniqueAuthors: [...entry.authors],
      firstSeen: sorted[0] ?? '',
      lastSeen: sorted[sorted.length - 1] ?? '',
    });
  }

  return stats.sort((a, b) => b.commitCount - a.commitCount);
}

/**
 * Build the co-change matrix: pairs of files that appeared in the
 * same commit, with occurrence counts.
 */
function buildCoChangeMatrix(commits: CommitRecord[]): CoChangePair[] {
  const pairCounts = new Map<string, number>();

  for (const commit of commits) {
    const files = [...new Set(commit.files)].sort();
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = `${files[i]}\0${files[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: CoChangePair[] = [];
  for (const [key, count] of pairCounts.entries()) {
    const [fileA, fileB] = key.split('\0');
    pairs.push({ fileA, fileB, count });
  }

  return pairs.sort((a, b) => b.count - a.count);
}

/**
 * Compute exponential decay weight for a commit timestamp.
 * Weight = exp(-lambda * ageDays) where lambda = ln(2) / halfLifeDays.
 * Default half-life: 90 days (contributions 90 days ago count half as much).
 */
function recencyWeight(isoTimestamp: string, halfLifeDays = 90): number {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  if (isNaN(then)) return 0;
  const ageDays = (now - then) / (1000 * 60 * 60 * 24);
  const lambda = Math.LN2 / halfLifeDays;
  return Math.exp(-lambda * ageDays);
}

/**
 * Compute Gini coefficient for an array of non-negative values.
 * G = 0: perfect equality; G = 1: one contributor holds everything.
 */
function giniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  if (sum === 0) return 0;
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return numerator / (n * sum);
}

/**
 * Compute bus factor: minimum number of authors whose combined weighted
 * score covers at least 80 % of the total.
 */
function busFactor(contributions: AuthorContribution[]): number {
  const sorted = [...contributions].sort((a, b) => b.weightedScore - a.weightedScore);
  const total = sorted.reduce((acc, c) => acc + c.weightedScore, 0);
  if (total === 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i].weightedScore;
    if (cumulative / total >= 0.8) return i + 1;
  }
  return sorted.length;
}

/**
 * Build knowledge map entries for every file.
 */
function buildKnowledgeMap(commits: CommitRecord[]): KnowledgeMapEntry[] {
  // file → author → total weighted score
  const fileAuthorWeight = new Map<string, Map<string, number>>();

  for (const commit of commits) {
    const weight = recencyWeight(commit.timestamp);
    for (const file of commit.files) {
      if (!fileAuthorWeight.has(file)) {
        fileAuthorWeight.set(file, new Map());
      }
      const authorMap = fileAuthorWeight.get(file)!;
      authorMap.set(commit.authorEmail, (authorMap.get(commit.authorEmail) ?? 0) + weight);
    }
  }

  const entries: KnowledgeMapEntry[] = [];

  for (const [file, authorMap] of fileAuthorWeight.entries()) {
    const totalWeight = [...authorMap.values()].reduce((a, b) => a + b, 0);

    const contributions: AuthorContribution[] = [...authorMap.entries()].map(([email, w]) => ({
      email,
      weightedScore: w,
      commits: 0, // filled below
      share: totalWeight > 0 ? w / totalWeight : 0,
    }));

    // Fill in raw commit counts per author per file
    for (const commit of commits) {
      if (commit.files.includes(file)) {
        const contrib = contributions.find(c => c.email === commit.authorEmail);
        if (contrib) contrib.commits += 1;
      }
    }

    const sortedContribs = contributions.sort((a, b) => b.weightedScore - a.weightedScore);
    const bf = busFactor(sortedContribs);
    const gini = giniCoefficient(sortedContribs.map(c => c.weightedScore));

    entries.push({
      file,
      busFactor: bf,
      giniCoefficient: Math.round(gini * 1000) / 1000,
      topContributors: sortedContribs.slice(0, 5),
    });
  }

  return entries.sort((a, b) => a.busFactor - b.busFactor || b.giniCoefficient - a.giniCoefficient);
}

// ──────────────────────────────────────────────────────────────
// Shared: derive parsed commits from a process result binding
// ──────────────────────────────────────────────────────────────

/**
 * Derive { _commits, _parseError } from _gitResult binding.
 * Used by all four actions via mapBindings before completeFrom.
 */
function deriveCommits(bindings: Record<string, unknown>): { _commits: CommitRecord[] | null; _parseError: string | null } {
  const result = bindings._gitResult as Record<string, unknown> | null;
  if (!result) {
    return { _commits: null, _parseError: 'git log process returned no result' };
  }

  const exitCode = (result.exitCode as number) ?? 1;
  const stdout = (result.stdout as string) ?? '';
  const stderr = (result.stderr as string) ?? '';

  if (exitCode !== 0) {
    return { _commits: null, _parseError: `git log failed (exit ${exitCode}): ${stderr.slice(0, 500)}` };
  }

  try {
    const commits = parseGitLogOutput(stdout);
    return { _commits: commits, _parseError: null };
  } catch (err) {
    return { _commits: null, _parseError: `Failed to parse git log output: ${String(err)}` };
  }
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: PROVIDER_NAME,
      kind: 'vcs-provider',
    }) as StorageProgram<Result>;
  },

  /**
   * parseLog — accepts repoPath and timeWindow, shells out to git log,
   * and returns structured commit records as a JSON string.
   */
  parseLog(input: Record<string, unknown>) {
    const repoPath = (input.repoPath as string) ?? '';
    const timeWindow = (input.timeWindow as string) || DEFAULT_WINDOW;

    if (!repoPath || repoPath.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'repoPath is required' }) as StorageProgram<Result>;
    }

    const command = `git -C "${repoPath}" log --since="${timeWindow}" --pretty=format:"%H %ae %aI" --name-only`;
    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      command,
      workdir: repoPath,
      timeout: 30000,
    }, '_gitResult');

    p = mapBindings(p, (bindings) => deriveCommits(bindings), '_derived');

    return completeFrom(p, 'ok', (bindings) => {
      const derived = bindings._derived as { _commits: CommitRecord[] | null; _parseError: string | null };
      if (derived._parseError || !derived._commits) {
        return { _error: derived._parseError ?? 'unknown error' };
      }
      return { result: JSON.stringify({ commits: derived._commits, timeWindow, repoPath }) };
    }) as StorageProgram<Result>;
  },

  /**
   * getFileStats — per-file commit count, unique authors, first/last timestamps.
   */
  getFileStats(input: Record<string, unknown>) {
    const repoPath = (input.repoPath as string) ?? '';
    const timeWindow = (input.timeWindow as string) || DEFAULT_WINDOW;

    if (!repoPath || repoPath.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'repoPath is required' }) as StorageProgram<Result>;
    }

    const command = `git -C "${repoPath}" log --since="${timeWindow}" --pretty=format:"%H %ae %aI" --name-only`;
    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      command,
      workdir: repoPath,
      timeout: 30000,
    }, '_gitResult');

    p = mapBindings(p, (bindings) => deriveCommits(bindings), '_derived');

    return completeFrom(p, 'ok', (bindings) => {
      const derived = bindings._derived as { _commits: CommitRecord[] | null; _parseError: string | null };
      if (derived._parseError || !derived._commits) {
        return { _error: derived._parseError ?? 'unknown error' };
      }
      const stats = buildFileStats(derived._commits);
      return { result: JSON.stringify({ fileStats: stats, timeWindow, repoPath }) };
    }) as StorageProgram<Result>;
  },

  /**
   * getCoChangeMatrix — groups files modified in the same commit
   * and returns co-change pairs with occurrence counts.
   */
  getCoChangeMatrix(input: Record<string, unknown>) {
    const repoPath = (input.repoPath as string) ?? '';
    const timeWindow = (input.timeWindow as string) || DEFAULT_WINDOW;

    if (!repoPath || repoPath.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'repoPath is required' }) as StorageProgram<Result>;
    }

    const command = `git -C "${repoPath}" log --since="${timeWindow}" --pretty=format:"%H %ae %aI" --name-only`;
    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      command,
      workdir: repoPath,
      timeout: 30000,
    }, '_gitResult');

    p = mapBindings(p, (bindings) => deriveCommits(bindings), '_derived');

    return completeFrom(p, 'ok', (bindings) => {
      const derived = bindings._derived as { _commits: CommitRecord[] | null; _parseError: string | null };
      if (derived._parseError || !derived._commits) {
        return { _error: derived._parseError ?? 'unknown error' };
      }
      const matrix = buildCoChangeMatrix(derived._commits);
      return { result: JSON.stringify({ coChangeMatrix: matrix, timeWindow, repoPath }) };
    }) as StorageProgram<Result>;
  },

  /**
   * getKnowledgeMap — weights author contributions by recency
   * (exponential decay, 90-day half-life), then computes bus factor
   * and Gini coefficient per file.
   */
  getKnowledgeMap(input: Record<string, unknown>) {
    const repoPath = (input.repoPath as string) ?? '';
    const timeWindow = (input.timeWindow as string) || DEFAULT_WINDOW;

    if (!repoPath || repoPath.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'repoPath is required' }) as StorageProgram<Result>;
    }

    const command = `git -C "${repoPath}" log --since="${timeWindow}" --pretty=format:"%H %ae %aI" --name-only`;
    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      command,
      workdir: repoPath,
      timeout: 30000,
    }, '_gitResult');

    p = mapBindings(p, (bindings) => deriveCommits(bindings), '_derived');

    return completeFrom(p, 'ok', (bindings) => {
      const derived = bindings._derived as { _commits: CommitRecord[] | null; _parseError: string | null };
      if (derived._parseError || !derived._commits) {
        return { _error: derived._parseError ?? 'unknown error' };
      }
      const knowledgeMap = buildKnowledgeMap(derived._commits);
      return { result: JSON.stringify({ knowledgeMap, timeWindow, repoPath }) };
    }) as StorageProgram<Result>;
  },
};

export const gitLogParserHandler = autoInterpret(_handler);

export default gitLogParserHandler;
