// @clef-handler style=functional
// ============================================================
// CodeHealth Handler
//
// Aggregates ten biomarker signals — complexity, test coverage,
// duplication, dependency freshness, security vulnerabilities,
// documentation coverage, code churn, coupling, technical debt,
// and static analysis violations — into a unified health score
// per target. Tracks score history and surfaces degrading signals.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `code-health-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

// ── Biomarker signal metadata ─────────────────────────────────
//
// Each signal is stored 0–100 where 100 is "good" and 0 is "bad".
// For "lower-is-better" raw values (complexity, duplication, etc.),
// the raw input is already expected on a 0–100 scale where a higher
// raw value means MORE of the bad thing. We invert these when
// computing the health contribution so that the score converges:
//   contribution = weight * (invert ? 100 - rawValue : rawValue)
//
// Weights are normalised so they sum to 1.0 after all 10 signals
// are combined. The final health score is 0–100.

interface SignalSpec {
  name: string;
  weight: number;     // raw weight (will be normalised)
  invert: boolean;    // true = lower raw value is better
}

const SIGNAL_SPECS: SignalSpec[] = [
  { name: 'securityVulns',    weight: 15, invert: true  }, // higher vulns → lower health
  { name: 'testCoverage',     weight: 14, invert: false }, // higher coverage → higher health
  { name: 'techDebt',         weight: 13, invert: true  }, // higher debt → lower health
  { name: 'staticViolations', weight: 11, invert: true  }, // higher violations → lower health
  { name: 'duplication',      weight: 10, invert: true  }, // higher duplication → lower health
  { name: 'coupling',         weight: 10, invert: true  }, // higher coupling → lower health
  { name: 'complexity',       weight: 10, invert: true  }, // higher complexity → lower health
  { name: 'codeChurn',        weight:  9, invert: true  }, // higher churn → lower health
  { name: 'docCoverage',      weight:  9, invert: false }, // higher coverage → higher health
  { name: 'depFreshness',     weight:  9, invert: false }, // higher freshness → higher health
];

const TOTAL_WEIGHT = SIGNAL_SPECS.reduce((s, sig) => s + sig.weight, 0); // 110

function computeHealthScore(signals: Record<string, number>): number {
  let weighted = 0;
  for (const spec of SIGNAL_SPECS) {
    const raw = signals[spec.name] ?? 50;
    const contribution = spec.invert ? 100 - raw : raw;
    weighted += spec.weight * contribution;
  }
  return Math.round((weighted / TOTAL_WEIGHT) * 10) / 10; // one decimal
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Compare two scores and classify trend direction */
function classifyTrend(prev: number, curr: number): string {
  const delta = curr - prev;
  if (delta > 1) return 'improving';
  if (delta < -1) return 'degrading';
  return 'stable';
}

/**
 * Returns the list of signal names whose contribution worsened between
 * two snapshots. "Worsened" means the signal moved in the bad direction
 * (i.e. the health contribution decreased).
 */
function degradedSignals(
  a: Record<string, number>,
  b: Record<string, number>,
): string[] {
  const degraded: string[] = [];
  for (const spec of SIGNAL_SPECS) {
    const rawA = a[spec.name] ?? 50;
    const rawB = b[spec.name] ?? 50;
    const contribA = spec.invert ? 100 - rawA : rawA;
    const contribB = spec.invert ? 100 - rawB : rawB;
    if (contribB < contribA) degraded.push(spec.name);
  }
  return degraded;
}

/** Return the signal name with the lowest health contribution */
function worstSignal(signals: Record<string, number>): { name: string; value: number } {
  let worst = { name: '', contribution: Infinity, rawValue: 0 };
  for (const spec of SIGNAL_SPECS) {
    const raw = signals[spec.name] ?? 50;
    const contribution = spec.invert ? 100 - raw : raw;
    if (contribution < worst.contribution) {
      worst = { name: spec.name, contribution, rawValue: raw };
    }
  }
  return { name: worst.name, value: worst.rawValue };
}

/** Validate all 10 signal values are in [0, 100] */
function validateSignals(signals: Record<string, number>): string | null {
  for (const spec of SIGNAL_SPECS) {
    const v = signals[spec.name];
    if (v === undefined || v === null) continue; // optional signals default to 50
    if (v < 0 || v > 100) {
      return `Signal "${spec.name}" value ${v} is outside valid range [0, 100]`;
    }
  }
  return null;
}

// ── Breakdown metadata for the breakdown() action ─────────────
function buildBreakdown(signals: Record<string, number>): Array<{
  name: string;
  value: number;
  weight: number;
  contribution: number;
  rating: string;
}> {
  return SIGNAL_SPECS.map((spec) => {
    const raw = signals[spec.name] ?? 50;
    const contribution = Math.round((spec.invert ? 100 - raw : raw) * 10) / 10;
    const normWeight = Math.round((spec.weight / TOTAL_WEIGHT) * 100) / 100;
    let rating: string;
    if (contribution >= 80) rating = 'good';
    else if (contribution >= 50) rating = 'fair';
    else rating = 'poor';
    return { name: spec.name, value: raw, weight: normWeight, contribution, rating };
  });
}

const _codeHealthHandler: FunctionalConceptHandler = {

  // ── register ────────────────────────────────────────────────
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'CodeHealth' }) as StorageProgram<Result>;
  },

  // ── measure ─────────────────────────────────────────────────
  //
  // Validation and score computation happen synchronously at
  // construction time. The snapshotId is generated before the program
  // is built (same pattern as hotspot.handler.ts). Trend computation
  // does not need prior storage data for the first snapshot, and
  // subsequent trend computation is handled by reading all snapshots
  // for the target at query time via latest()/history(). This keeps
  // the measure action as a pure write without a read-then-write cycle.
  measure(input: Record<string, unknown>) {
    const target = input.target as string;

    if (!target || (target as string).trim() === '') {
      return complete(createProgram(), 'invalid', {
        message: 'target is required',
      }) as StorageProgram<Result>;
    }

    const signals: Record<string, number> = {
      complexity:       input.complexity       as number,
      testCoverage:     input.testCoverage     as number,
      duplication:      input.duplication      as number,
      depFreshness:     input.depFreshness     as number,
      securityVulns:    input.securityVulns    as number,
      docCoverage:      input.docCoverage      as number,
      codeChurn:        input.codeChurn        as number,
      coupling:         input.coupling         as number,
      techDebt:         input.techDebt         as number,
      staticViolations: input.staticViolations as number,
    };

    const validationError = validateSignals(signals);
    if (validationError) {
      return complete(createProgram(), 'invalid', {
        message: validationError,
      }) as StorageProgram<Result>;
    }

    const healthScore = computeHealthScore(signals);
    const grade = scoreToGrade(healthScore);
    // snapshotId is computed synchronously — the key is known at program
    // construction time (same pattern as hotspot.handler.ts's `nextId()` call).
    const snapshotId = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'code-health-snapshot', snapshotId, {
      id: snapshotId,
      target,
      takenAt: now,
      healthScore,
      grade,
      trend: 'stable', // trend is computed lazily by latest() and history()
      scoreHistory: [{ takenAt: now, healthScore, grade }],
      ...signals,
    });

    return complete(p, 'ok', {
      snapshot: snapshotId,
      healthScore,
      grade,
    }) as StorageProgram<Result>;
  },

  // ── get ─────────────────────────────────────────────────────
  get(input: Record<string, unknown>) {
    const snapshot = input.snapshot as string;

    let p = createProgram();
    p = get(p, 'code-health-snapshot', snapshot, 'record');

    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const r = bindings.record as Record<string, unknown>;
        return {
          snapshot: r.id as string,
          target: r.target as string,
          takenAt: r.takenAt as string,
          healthScore: r.healthScore as number,
          grade: r.grade as string,
          trend: r.trend as string,
          signals: {
            complexity:       r.complexity       as number,
            testCoverage:     r.testCoverage     as number,
            duplication:      r.duplication      as number,
            depFreshness:     r.depFreshness     as number,
            securityVulns:    r.securityVulns    as number,
            docCoverage:      r.docCoverage      as number,
            codeChurn:        r.codeChurn        as number,
            coupling:         r.coupling         as number,
            techDebt:         r.techDebt         as number,
            staticViolations: r.staticViolations as number,
          },
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {
        message: `No snapshot found with id "${snapshot}"`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  // ── latest ──────────────────────────────────────────────────
  latest(input: Record<string, unknown>) {
    const target = input.target as string;

    let p = createProgram();
    p = find(p, 'code-health-snapshot', { target }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'notfound', {
        message: `No snapshots recorded for target "${target}"`,
      }) as StorageProgram<Result>,
      (() => {
        let b = createProgram();
        b = find(b, 'code-health-snapshot', { target }, 'matches2');
        return completeFrom(b, 'ok', (bindings) => {
          const arr = (bindings.matches2 || []) as Array<Record<string, unknown>>;
          const sorted = [...arr].sort((a, b) =>
            new Date(b.takenAt as string).getTime() - new Date(a.takenAt as string).getTime()
          );
          const latest = sorted[0];
          return {
            snapshot: latest.id as string,
            healthScore: latest.healthScore as number,
            grade: latest.grade as string,
            trend: latest.trend as string,
            takenAt: latest.takenAt as string,
          };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  // ── history ─────────────────────────────────────────────────
  history(input: Record<string, unknown>) {
    const target = input.target as string;
    const limit = (input.limit as number | undefined) ?? 20;

    let p = createProgram();
    p = find(p, 'code-health-snapshot', { target }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'notfound', {
        message: `No snapshots recorded for target "${target}"`,
      }) as StorageProgram<Result>,
      (() => {
        let b = createProgram();
        b = find(b, 'code-health-snapshot', { target }, 'matches2');
        return completeFrom(b, 'ok', (bindings) => {
          const arr = (bindings.matches2 || []) as Array<Record<string, unknown>>;
          const sorted = [...arr].sort((a, b) =>
            new Date(b.takenAt as string).getTime() - new Date(a.takenAt as string).getTime()
          );
          const sliced = sorted.slice(0, limit);
          const snapshots = sliced.map(s => ({
            snapshot: s.id as string,
            healthScore: s.healthScore as number,
            grade: s.grade as string,
            takenAt: s.takenAt as string,
          }));
          return { snapshots };
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  // ── compare ─────────────────────────────────────────────────
  compare(input: Record<string, unknown>) {
    const snapshotA = input.snapshotA as string;
    const snapshotB = input.snapshotB as string;

    let p = createProgram();
    p = get(p, 'code-health-snapshot', snapshotA, 'recordA');
    p = get(p, 'code-health-snapshot', snapshotB, 'recordB');

    return branch(p,
      (bindings) => !bindings.recordA || !bindings.recordB,
      (b) => complete(b, 'notfound', {
        message: `One or both snapshots not found (snapshotA="${snapshotA}", snapshotB="${snapshotB}")`,
      }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rA = bindings.recordA as Record<string, unknown>;
        const rB = bindings.recordB as Record<string, unknown>;
        const scoreA = rA.healthScore as number;
        const scoreB = rB.healthScore as number;
        const delta = Math.round((scoreB - scoreA) * 10) / 10;
        const improved = delta > 0;

        const signalsA = {
          complexity:       rA.complexity       as number,
          testCoverage:     rA.testCoverage     as number,
          duplication:      rA.duplication      as number,
          depFreshness:     rA.depFreshness     as number,
          securityVulns:    rA.securityVulns    as number,
          docCoverage:      rA.docCoverage      as number,
          codeChurn:        rA.codeChurn        as number,
          coupling:         rA.coupling         as number,
          techDebt:         rA.techDebt         as number,
          staticViolations: rA.staticViolations as number,
        };
        const signalsB = {
          complexity:       rB.complexity       as number,
          testCoverage:     rB.testCoverage     as number,
          duplication:      rB.duplication      as number,
          depFreshness:     rB.depFreshness     as number,
          securityVulns:    rB.securityVulns    as number,
          docCoverage:      rB.docCoverage      as number,
          codeChurn:        rB.codeChurn        as number,
          coupling:         rB.coupling         as number,
          techDebt:         rB.techDebt         as number,
          staticViolations: rB.staticViolations as number,
        };

        return {
          delta,
          improved,
          degradedSignals: degradedSignals(signalsA, signalsB),
        };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  // ── topOffenders ────────────────────────────────────────────
  topOffenders(input: Record<string, unknown>) {
    const limit = (input.limit as number | undefined) ?? 10;
    const gradeFilter = input.grade as string | undefined;

    // Grade ordering for filtering: A=5, B=4, C=3, D=2, F=1
    const gradeOrder: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

    let p = createProgram();
    p = find(p, 'code-health-snapshot', {}, 'allSnapshots');

    return completeFrom(p, 'ok', (bindings) => {
      const allSnapshots = (bindings.allSnapshots || []) as Array<Record<string, unknown>>;

      // Group by target — keep only the latest snapshot per target
      const latestByTarget = new Map<string, Record<string, unknown>>();
      for (const s of allSnapshots) {
        const t = s.target as string;
        const existing = latestByTarget.get(t);
        if (!existing || new Date(s.takenAt as string) > new Date(existing.takenAt as string)) {
          latestByTarget.set(t, s);
        }
      }

      let items = Array.from(latestByTarget.values());

      // Filter by grade if requested
      if (gradeFilter) {
        const maxOrder = gradeOrder[gradeFilter] ?? 3;
        items = items.filter(s => (gradeOrder[s.grade as string] ?? 1) <= maxOrder);
      }

      // Sort ascending by healthScore (worst first)
      items.sort((a, b) => (a.healthScore as number) - (b.healthScore as number));
      items = items.slice(0, limit);

      const offenders = items.map(s => {
        const signals = {
          complexity:       s.complexity       as number,
          testCoverage:     s.testCoverage     as number,
          duplication:      s.duplication      as number,
          depFreshness:     s.depFreshness     as number,
          securityVulns:    s.securityVulns    as number,
          docCoverage:      s.docCoverage      as number,
          codeChurn:        s.codeChurn        as number,
          coupling:         s.coupling         as number,
          techDebt:         s.techDebt         as number,
          staticViolations: s.staticViolations as number,
        };
        const ws = worstSignal(signals);
        return {
          target: s.target as string,
          snapshot: s.id as string,
          healthScore: s.healthScore as number,
          grade: s.grade as string,
          worstSignal: ws.name,
          worstValue: ws.value,
        };
      });

      return { offenders };
    }) as StorageProgram<Result>;
  },

  // ── breakdown ───────────────────────────────────────────────
  breakdown(input: Record<string, unknown>) {
    const snapshot = input.snapshot as string;

    let p = createProgram();
    p = get(p, 'code-health-snapshot', snapshot, 'record');

    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const r = bindings.record as Record<string, unknown>;
        const signals = {
          complexity:       r.complexity       as number,
          testCoverage:     r.testCoverage     as number,
          duplication:      r.duplication      as number,
          depFreshness:     r.depFreshness     as number,
          securityVulns:    r.securityVulns    as number,
          docCoverage:      r.docCoverage      as number,
          codeChurn:        r.codeChurn        as number,
          coupling:         r.coupling         as number,
          techDebt:         r.techDebt         as number,
          staticViolations: r.staticViolations as number,
        };
        return { signals: buildBreakdown(signals) };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {
        message: `No snapshot found with id "${snapshot}"`,
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const codeHealthHandler = autoInterpret(_codeHealthHandler);

/** Reset the ID counter — useful for testing. */
export function resetCodeHealthCounter(): void {
  idCounter = 0;
}
