// @clef-handler style=functional
// ============================================================
// Hotspot Handler
//
// Identify code that is both complex and frequently changed.
// Rank files by risk = normalized complexity * normalized change
// frequency. Track hotspot evolution over time. Enable targeted
// refactoring investment where it matters most.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, traverse, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `hotspot-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map(v => (v - min) / (max - min));
}

const _hotspotHandler: FunctionalConceptHandler = {

  // ── analyze ─────────────────────────────────────────────────
  analyze(input: Record<string, unknown>) {
    const targets = input.targets as string[];
    const period = (input.period as string) || '6m';
    const complexityMetric = (input.complexityMetric as string) || 'cognitive_complexity';

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return complete(createProgram(), 'noHistory', {
        message: 'No targets provided or VCS history not available',
      });
    }

    // Simulate analysis: generate deterministic complexity and change frequency
    // based on target path characteristics. Real providers would compute these.
    const rawComplexities = targets.map((t, i) => {
      // Deterministic pseudo-complexity based on path length and position
      return 5 + (t.length % 20) + (i * 3);
    });
    const rawFrequencies = targets.map((t, i) => {
      return 2 + (t.length % 15) + (i * 2);
    });

    const normComplexities = normalize(rawComplexities);
    const normFrequencies = normalize(rawFrequencies);

    const hotspots = targets.map((target, i) => {
      const complexity = rawComplexities[i];
      const changeFrequency = rawFrequencies[i];
      const riskScore = Math.round(normComplexities[i] * normFrequencies[i] * 1000) / 1000;
      return { target, complexity, changeFrequency, riskScore, rank: 0 };
    });

    // Sort by risk descending and assign ranks
    hotspots.sort((a, b) => b.riskScore - a.riskScore);
    hotspots.forEach((h, i) => { h.rank = i + 1; });

    // Store each hotspot
    let p = createProgram();
    const now = new Date().toISOString();
    for (const h of hotspots) {
      const id = nextId();
      p = put(p, 'hotspot', id, {
        id,
        target: h.target,
        complexity: h.complexity,
        changeFrequency: h.changeFrequency,
        riskScore: h.riskScore,
        rank: h.rank,
        analyzedAt: now,
        changeCount: Math.floor(h.changeFrequency * 10),
        authorsCount: 1 + Math.floor(h.changeFrequency % 5),
        lastChangedAt: now,
        period,
        complexityMetric,
        riskHistory: [{ date: now, riskScore: h.riskScore, complexity: h.complexity, changeFrequency: h.changeFrequency }],
      });
    }

    return complete(p, 'ok', { hotspots });
  },

  // ── rank ────────────────────────────────────────────────────
  rank(input: Record<string, unknown>) {
    const limit = (input.limit as number) || 20;
    const threshold = input.threshold as number | undefined;

    let p = createProgram();
    p = find(p, 'hotspot', {}, 'allHotspots');

    return completeFrom(p, 'ok', (bindings) => {
      let items = (bindings.allHotspots || []) as Array<Record<string, unknown>>;

      if (threshold != null && threshold > 0) {
        items = items.filter(h => (h.riskScore as number) >= threshold);
      }

      items.sort((a, b) => (b.riskScore as number) - (a.riskScore as number));
      items = items.slice(0, limit);

      const ranked = items.map((h, i) => ({
        hotspot: h.id as string,
        target: h.target as string,
        riskScore: h.riskScore as number,
        complexity: h.complexity as number,
        changeFrequency: h.changeFrequency as number,
        authorsCount: h.authorsCount as number,
        rank: i + 1,
      }));

      return { ranked };
    });
  },

  // ── trend ───────────────────────────────────────────────────
  trend(input: Record<string, unknown>) {
    const target = input.target as string;

    let p = createProgram();
    p = find(p, 'hotspot', { target }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'notTracked', { target }),
      (() => {
        let b = createProgram();
        b = find(b, 'hotspot', { target }, 'matches2');
        return completeFrom(b, 'ok', (bindings) => {
          const arr = (bindings.matches2 || []) as Array<Record<string, unknown>>;
          const entry = arr[0];
          const riskHistory = (entry.riskHistory || []) as Array<Record<string, unknown>>;

          const trend = riskHistory.map((point, i) => ({
            date: point.date as string,
            riskScore: point.riskScore as number,
            improving: i > 0
              ? (point.riskScore as number) < (riskHistory[i - 1].riskScore as number)
              : false,
          }));

          return { hotspot: entry.id as string, trend };
        });
      })(),
    );
  },

  // ── distribution ────────────────────────────────────────────
  distribution(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'hotspot', {}, 'allHotspots');

    return completeFrom(p, 'ok', (bindings) => {
      const items = (bindings.allHotspots || []) as Array<Record<string, unknown>>;
      const totalTargets = items.length;

      if (totalTargets === 0) {
        return {
          summary: {
            totalTargets: 0,
            hotspotsAboveThreshold: 0,
            hotspotPercentage: 0,
            topQuartileRisk: 0,
            medianRisk: 0,
            riskByDirectory: [],
          },
        };
      }

      const risks = items.map(h => h.riskScore as number).sort((a, b) => b - a);
      const defaultThreshold = 0.5;
      const hotspotsAboveThreshold = risks.filter(r => r >= defaultThreshold).length;
      const hotspotPercentage = Math.round((hotspotsAboveThreshold / totalTargets) * 10000) / 100;

      const q1Index = Math.floor(totalTargets * 0.25);
      const topQuartileRisk = risks[q1Index] || 0;
      const medianIndex = Math.floor(totalTargets / 2);
      const medianRisk = risks[medianIndex] || 0;

      // Group by directory
      const dirMap = new Map<string, { total: number; count: number }>();
      for (const h of items) {
        const target = h.target as string;
        const dir = target.includes('/') ? target.substring(0, target.lastIndexOf('/')) : '.';
        const entry = dirMap.get(dir) || { total: 0, count: 0 };
        entry.total += h.riskScore as number;
        entry.count += 1;
        dirMap.set(dir, entry);
      }

      const riskByDirectory = Array.from(dirMap.entries()).map(([directory, data]) => ({
        directory,
        avgRisk: Math.round((data.total / data.count) * 1000) / 1000,
        count: data.count,
      }));

      return {
        summary: {
          totalTargets,
          hotspotsAboveThreshold,
          hotspotPercentage,
          topQuartileRisk,
          medianRisk,
          riskByDirectory,
        },
      };
    });
  },
};

export const hotspotHandler = autoInterpret(_hotspotHandler);
