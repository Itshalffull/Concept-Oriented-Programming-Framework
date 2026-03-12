// AnalysisReport Concept Implementation
// Generates structured reports from graph analysis results.
import type { ConceptHandler } from '@clef/runtime';

function generateId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AnalysisNode {
  id: string;
  score?: number;
  community?: number;
  rank?: number;
  label?: string;
}

interface AnalysisPayload {
  nodes?: AnalysisNode[];
  communities?: Record<string, number>;
  scores?: Record<string, number>;
  type?: string;
}

function parsePayload(raw: string): AnalysisPayload {
  return JSON.parse(raw) as AnalysisPayload;
}

/**
 * Collect all scored entries from a payload, sorted descending by score.
 */
function rankedEntries(payload: AnalysisPayload): Array<{ id: string; score: number; rank: number }> {
  const map = new Map<string, number>();
  const nodes = payload.nodes || [];
  const scores = payload.scores || {};

  for (const node of nodes) {
    const s = node.score ?? scores[node.id];
    if (s !== undefined) map.set(node.id, s);
  }
  for (const [id, s] of Object.entries(scores)) {
    if (!map.has(id)) map.set(id, s);
  }

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score], idx) => ({ id, score, rank: idx + 1 }));
}

/**
 * Count distinct communities in a payload.
 */
function communityInfo(payload: AnalysisPayload): { count: number; sizes: Record<string, number> } {
  const groups: Record<string, number> = {};
  const communities = payload.communities || {};
  const nodes = payload.nodes || [];

  for (const [, c] of Object.entries(communities)) {
    const key = String(c);
    groups[key] = (groups[key] || 0) + 1;
  }
  for (const node of nodes) {
    if (node.community !== undefined) {
      const key = String(node.community);
      groups[key] = (groups[key] || 0) + 1;
    }
  }

  return { count: Object.keys(groups).length, sizes: groups };
}

function buildTableContent(payload: AnalysisPayload): Record<string, unknown> {
  const ranked = rankedEntries(payload);
  const headers = ['Rank', 'Node', 'Score'];
  const rows = ranked.map((e) => [e.rank, e.id, e.score.toFixed(4)]);

  const info = communityInfo(payload);
  if (info.count > 0) {
    return {
      tables: [
        { title: 'Ranked Scores', headers, rows },
        {
          title: 'Communities',
          headers: ['Community', 'Size'],
          rows: Object.entries(info.sizes)
            .sort((a, b) => b[1] - a[1])
            .map(([community, size]) => [community, size]),
        },
      ],
    };
  }

  return { tables: [{ title: 'Ranked Scores', headers, rows }] };
}

function buildSummaryContent(payload: AnalysisPayload, title?: string): Record<string, unknown> {
  const ranked = rankedEntries(payload);
  const top5 = ranked.slice(0, 5);
  const info = communityInfo(payload);
  const totalNodes = ranked.length || (payload.nodes?.length ?? 0);

  const findings: string[] = [];
  findings.push(`Total nodes analyzed: ${totalNodes}`);

  if (top5.length > 0) {
    findings.push('Top 5 nodes by score:');
    for (const entry of top5) {
      findings.push(`  ${entry.rank}. ${entry.id} (${entry.score.toFixed(4)})`);
    }
  }

  if (info.count > 0) {
    findings.push(`Communities detected: ${info.count}`);
    const largestCommunity = Object.entries(info.sizes).sort((a, b) => b[1] - a[1])[0];
    if (largestCommunity) {
      findings.push(`Largest community: ${largestCommunity[0]} (${largestCommunity[1]} nodes)`);
    }
  }

  if (ranked.length >= 2) {
    const topScore = ranked[0].score;
    const bottomScore = ranked[ranked.length - 1].score;
    findings.push(`Score range: ${bottomScore.toFixed(4)} – ${topScore.toFixed(4)}`);
  }

  return {
    title: title || 'Analysis Summary',
    findings,
  };
}

function buildDashboardContent(payload: AnalysisPayload, title?: string): Record<string, unknown> {
  const ranked = rankedEntries(payload);
  const info = communityInfo(payload);
  const totalNodes = ranked.length || (payload.nodes?.length ?? 0);

  const metrics: Record<string, unknown> = {
    totalNodes,
    communityCount: info.count,
  };

  if (ranked.length > 0) {
    const scores = ranked.map((e) => e.score);
    metrics.maxScore = Math.max(...scores).toFixed(4);
    metrics.minScore = Math.min(...scores).toFixed(4);
    metrics.meanScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4);
  }

  const topN = ranked.slice(0, 10).map((e) => ({
    rank: e.rank,
    id: e.id,
    score: e.score.toFixed(4),
  }));

  return {
    title: title || 'Analysis Dashboard',
    metrics,
    topN,
    communitySizes: info.sizes,
  };
}

function exportToCsv(content: Record<string, unknown>): string {
  const tables = content.tables as Array<{ headers: string[]; rows: unknown[][] }> | undefined;
  if (!tables || tables.length === 0) {
    // Attempt to export topN from dashboard
    const topN = content.topN as Array<Record<string, unknown>> | undefined;
    if (topN) {
      const lines = ['Rank,Node,Score'];
      for (const entry of topN) {
        lines.push(`${entry.rank},${entry.id},${entry.score}`);
      }
      return lines.join('\n');
    }
    return '';
  }

  const lines: string[] = [];
  for (const table of tables) {
    lines.push(table.headers.join(','));
    for (const row of table.rows) {
      lines.push(row.map((cell) => String(cell)).join(','));
    }
    lines.push(''); // blank line between tables
  }
  return lines.join('\n').trim();
}

function exportToMarkdown(content: Record<string, unknown>): string {
  const lines: string[] = [];

  // Title
  if (content.title) {
    lines.push(`# ${content.title}`, '');
  }

  // Findings (summary format)
  const findings = content.findings as string[] | undefined;
  if (findings) {
    for (const finding of findings) {
      lines.push(finding);
    }
    lines.push('');
  }

  // Metrics (dashboard format)
  const metrics = content.metrics as Record<string, unknown> | undefined;
  if (metrics) {
    lines.push('## Metrics', '');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    for (const [key, value] of Object.entries(metrics)) {
      lines.push(`| ${key} | ${value} |`);
    }
    lines.push('');
  }

  // Tables
  const tables = content.tables as Array<{ title?: string; headers: string[]; rows: unknown[][] }> | undefined;
  if (tables) {
    for (const table of tables) {
      if (table.title) lines.push(`## ${table.title}`, '');
      lines.push(`| ${table.headers.join(' | ')} |`);
      lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
      for (const row of table.rows) {
        lines.push(`| ${row.map((cell) => String(cell)).join(' | ')} |`);
      }
      lines.push('');
    }
  }

  // Top N (dashboard format)
  const topN = content.topN as Array<Record<string, unknown>> | undefined;
  if (topN && topN.length > 0) {
    lines.push('## Top Nodes', '');
    lines.push('| Rank | Node | Score |');
    lines.push('| --- | --- | --- |');
    for (const entry of topN) {
      lines.push(`| ${entry.rank} | ${entry.id} | ${entry.score} |`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export const analysisReportHandler: ConceptHandler = {
  async generate(input, storage) {
    const result = input.result as string;
    const format = input.format as string;
    const title = input.title as string | undefined;

    const validFormats = ['table', 'summary', 'dashboard'];
    if (!validFormats.includes(format)) {
      return { variant: 'invalid', message: `Unknown format: ${format}` };
    }

    let payload: AnalysisPayload;
    try {
      payload = parsePayload(result);
    } catch {
      return { variant: 'invalid', message: 'Failed to parse analysis result' };
    }

    let content: Record<string, unknown>;
    switch (format) {
      case 'table':
        content = buildTableContent(payload);
        break;
      case 'summary':
        content = buildSummaryContent(payload, title);
        break;
      case 'dashboard':
        content = buildDashboardContent(payload, title);
        break;
      default:
        content = {};
    }

    const id = generateId();
    await storage.put('report', id, {
      id,
      result,
      format,
      title: title || '',
      content: JSON.stringify(content),
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', report: id, content: JSON.stringify(content) };
  },

  async compare(input, storage) {
    const resultsStr = input.results as string;
    const format = input.format as string;

    let resultPayloads: string[];
    try {
      resultPayloads = JSON.parse(resultsStr) as string[];
    } catch {
      return { variant: 'invalid', message: 'Failed to parse results array' };
    }

    if (resultPayloads.length < 2) {
      return { variant: 'invalid', message: 'At least two results are required for comparison' };
    }

    const parsedPayloads: AnalysisPayload[] = [];
    for (const raw of resultPayloads) {
      try {
        parsedPayloads.push(parsePayload(raw));
      } catch {
        return { variant: 'invalid', message: 'Failed to parse one of the result payloads' };
      }
    }

    // Build ranked entries for each payload
    const rankings = parsedPayloads.map((p) => rankedEntries(p));

    // Compute deltas between consecutive results
    const deltas: Array<{
      from: number;
      to: number;
      rankChanges: Array<{ id: string; oldRank: number; newRank: number; delta: number }>;
      scoreChanges: Array<{ id: string; oldScore: number; newScore: number; delta: number }>;
    }> = [];

    for (let i = 0; i < rankings.length - 1; i++) {
      const prev = rankings[i];
      const next = rankings[i + 1];

      const prevMap = new Map(prev.map((e) => [e.id, e]));
      const nextMap = new Map(next.map((e) => [e.id, e]));

      const allIds = new Set([...prevMap.keys(), ...nextMap.keys()]);
      const rankChanges: Array<{ id: string; oldRank: number; newRank: number; delta: number }> = [];
      const scoreChanges: Array<{ id: string; oldScore: number; newScore: number; delta: number }> = [];

      for (const id of allIds) {
        const pEntry = prevMap.get(id);
        const nEntry = nextMap.get(id);
        if (pEntry && nEntry) {
          const rankDelta = pEntry.rank - nEntry.rank; // positive = improved
          if (rankDelta !== 0) {
            rankChanges.push({ id, oldRank: pEntry.rank, newRank: nEntry.rank, delta: rankDelta });
          }
          const scoreDelta = nEntry.score - pEntry.score;
          if (Math.abs(scoreDelta) > 1e-6) {
            scoreChanges.push({ id, oldScore: pEntry.score, newScore: nEntry.score, delta: scoreDelta });
          }
        }
      }

      rankChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      scoreChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

      deltas.push({ from: i, to: i + 1, rankChanges, scoreChanges });
    }

    const content = { format, comparisons: deltas };
    const id = generateId();

    await storage.put('report', id, {
      id,
      result: resultsStr,
      format: `compare-${format}`,
      title: 'Comparison Report',
      content: JSON.stringify(content),
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', report: id, content: JSON.stringify(content) };
  },

  async getReport(input, storage) {
    const report = input.report as string;

    const existing = await storage.get('report', report);
    if (!existing) {
      return { variant: 'notfound', message: 'Report not found' };
    }

    return {
      variant: 'ok',
      report: existing.id as string,
      format: existing.format as string,
      content: existing.content as string,
      createdAt: existing.createdAt as string,
    };
  },

  async listReports(input, storage) {
    const resultFilter = input.result as string | undefined;

    const query: Record<string, unknown> = {};
    if (resultFilter) {
      query.result = resultFilter;
    }

    const all = await storage.find('report', query);
    const items = all.map((r: Record<string, unknown>) => ({
      id: r.id,
      format: r.format,
      title: r.title,
      createdAt: r.createdAt,
    }));

    return { variant: 'ok', reports: JSON.stringify(items) };
  },

  async exportReport(input, storage) {
    const reportId = input.report as string;
    const outputFormat = input.outputFormat as string;

    const existing = await storage.get('report', reportId);
    if (!existing) {
      return { variant: 'notfound', message: 'Report not found' };
    }

    const validFormats = ['csv', 'json', 'markdown'];
    if (!validFormats.includes(outputFormat)) {
      return { variant: 'invalid', message: `Unknown output format: ${outputFormat}` };
    }

    let content: Record<string, unknown>;
    try {
      content = JSON.parse(existing.content as string) as Record<string, unknown>;
    } catch {
      return { variant: 'invalid', message: 'Failed to parse stored report content' };
    }

    let output: string;
    switch (outputFormat) {
      case 'csv':
        output = exportToCsv(content);
        break;
      case 'markdown':
        output = exportToMarkdown(content);
        break;
      case 'json':
        output = JSON.stringify(content, null, 2);
        break;
      default:
        output = JSON.stringify(content);
    }

    return { variant: 'ok', outputFormat, output };
  },
};
