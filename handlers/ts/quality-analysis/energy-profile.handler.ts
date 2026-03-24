// @clef-handler style=functional
// ============================================================
// EnergyProfile Handler
//
// Measure and track energy consumption and carbon emissions of
// code execution. Compute Software Carbon Intensity (SCI) per
// ISO/IEC 21031:2024. Enable energy-aware quality gates and
// optimization tracking. Providers perform actual measurement.
//
// SCI formula: ((E * I) + M) / R
//   E = energy per functional unit (joules)
//   I = grid carbon intensity (gCO2eq/kWh)
//   M = embodied carbon per functional unit
//   R = 1 (per functional unit)
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `energy-${++idCounter}`;
}

const VALID_FUNCTIONAL_UNITS = ['per-request', 'per-operation', 'per-user', 'per-transaction'];

// Convert joules to kWh: 1 kWh = 3,600,000 J
const JOULES_PER_KWH = 3_600_000;

function computeSCI(
  energyJoules: number,
  requestCount: number,
  gridCarbonIntensity: number,
  embodiedCarbonPerUnit: number,
): number {
  const energyPerUnit = energyJoules / requestCount;
  const energyKwh = energyPerUnit / JOULES_PER_KWH;
  const operationalCarbon = energyKwh * gridCarbonIntensity;
  const sci = operationalCarbon + embodiedCarbonPerUnit;
  return Math.round(sci * 1_000_000) / 1_000_000; // 6 decimal precision
}

const _energyProfileHandler: FunctionalConceptHandler = {

  // ── configure ─────────────────────────────────────────────
  configure(input: Record<string, unknown>) {
    const target = input.target as string;
    const functionalUnit = input.functionalUnit as string;
    const gridCarbonIntensity = input.gridCarbonIntensity as number;
    const embodiedCarbonPerUnit = input.embodiedCarbonPerUnit as number;

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', { message: 'target is required' });
    }
    if (!functionalUnit || !VALID_FUNCTIONAL_UNITS.includes(functionalUnit)) {
      return complete(createProgram(), 'error', {
        message: `functionalUnit must be one of: ${VALID_FUNCTIONAL_UNITS.join(', ')}; got "${functionalUnit}"`,
      });
    }

    let p = createProgram();
    p = find(p, 'profile', { target }, 'existing');

    return branch(p,
      (bindings) => {
        const arr = bindings.existing as unknown[];
        return arr && arr.length > 0;
      },
      // duplicate
      complete(createProgram(), 'duplicate', { target }),
      // ok — create new profile
      (() => {
        const id = nextId();
        let b = createProgram();
        b = put(b, 'profile', id, {
          id,
          target,
          functionalUnit,
          gridCarbonIntensity,
          embodiedCarbonPerUnit,
          energyJoules: 0,
          carbonIntensityGrams: 0,
          embodiedCarbon: embodiedCarbonPerUnit,
          sciScore: 0,
          measuredAt: null,
          history: [],
        });
        return complete(b, 'ok', { profile: id });
      })(),
    );
  },

  // ── measure ───────────────────────────────────────────────
  measure(input: Record<string, unknown>) {
    const target = input.target as string;
    const energyJoules = input.energyJoules as number;
    const requestCount = input.requestCount as number;

    let p = createProgram();
    p = find(p, 'profile', { target }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      // notConfigured
      complete(createProgram(), 'notConfigured', { target }),
      // found — compute SCI and update
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_profile');

        b = mapBindings(b, (bindings) => {
          const profile = bindings._profile as Record<string, unknown>;
          const gridCI = profile.gridCarbonIntensity as number;
          const embodied = profile.embodiedCarbonPerUnit as number;
          const previousSCI = profile.sciScore as number;
          const hasPrevious = profile.measuredAt !== null;

          const sciScore = computeSCI(energyJoules, requestCount, gridCI, embodied);
          const energyPerUnit = energyJoules / requestCount;
          const energyKwh = energyPerUnit / JOULES_PER_KWH;
          const carbonGrams = energyKwh * gridCI;

          const now = new Date().toISOString();
          const history = (profile.history as Array<Record<string, unknown>>) || [];
          const newHistory = [...history, {
            date: now,
            sciScore,
            energyJoules,
          }];

          return {
            id: profile.id as string,
            sciScore,
            carbonGrams,
            previous: hasPrevious ? previousSCI : null,
            updatedProfile: {
              ...profile,
              energyJoules,
              carbonIntensityGrams: carbonGrams,
              sciScore,
              measuredAt: now,
              history: newHistory,
            },
          };
        }, '_result');

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings._result as {
            id: string;
            sciScore: number;
            previous: number | null;
          };
          return {
            profile: result.id,
            sciScore: result.sciScore,
            previous: result.previous,
          };
        });
      })(),
    );
  },

  // ── query ─────────────────────────────────────────────────
  query(input: Record<string, unknown>) {
    const targets = input.targets as string[] | null | undefined;

    let p = createProgram();
    p = find(p, 'profile', {}, 'allProfiles');

    p = mapBindings(p, (bindings) => {
      let profiles = (bindings.allProfiles as Record<string, unknown>[]) || [];

      if (targets && targets.length > 0) {
        profiles = profiles.filter(pr => targets.includes(pr.target as string));
      }

      // Only return profiles that have been measured
      return profiles
        .filter(pr => pr.measuredAt !== null)
        .map(pr => ({
          target: pr.target as string,
          sciScore: pr.sciScore as number,
          energyJoules: pr.energyJoules as number,
          carbonIntensityGrams: pr.carbonIntensityGrams as number,
          functionalUnit: pr.functionalUnit as string,
          measuredAt: pr.measuredAt as string,
        }));
    }, '_results');

    return completeFrom(p, 'ok', (bindings) => ({
      results: bindings._results as unknown[],
    }));
  },

  // ── trend ─────────────────────────────────────────────────
  trend(input: Record<string, unknown>) {
    const target = input.target as string;
    const count = (input.count as number) ?? 20;

    let p = createProgram();
    p = find(p, 'profile', { target }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'notTracked', { target }),
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          const profile = arr[0];
          const history = (profile.history as Array<{
            date: string; sciScore: number; energyJoules: number;
          }>) || [];
          const sliced = history.slice(-count);

          // Compute deltas
          const trend = sliced.map((entry, i) => ({
            date: entry.date,
            sciScore: entry.sciScore,
            delta: i > 0 ? entry.sciScore - sliced[i - 1].sciScore : 0,
          }));

          // Determine trajectory from recent trend
          let trajectory = 'stable';
          if (trend.length >= 2) {
            const recent = trend.slice(-3);
            const avgDelta = recent.reduce((sum, t) => sum + t.delta, 0) / recent.length;
            if (avgDelta < -0.001) trajectory = 'improving';
            else if (avgDelta > 0.001) trajectory = 'worsening';
          }

          return {
            target: profile.target as string,
            currentSCI: profile.sciScore as number,
            trend,
            trajectory,
          };
        }, '_trendResult');

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings._trendResult as {
            target: string;
            currentSCI: number;
            trend: unknown[];
            trajectory: string;
          };
          return {
            target: result.target,
            currentSCI: result.currentSCI,
            trend: result.trend,
            trajectory: result.trajectory,
          };
        });
      })(),
    );
  },

  // ── summary ───────────────────────────────────────────────
  summary(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'profile', {}, 'allProfiles');

    p = mapBindings(p, (bindings) => {
      const profiles = (bindings.allProfiles as Record<string, unknown>[]) || [];
      const measured = profiles.filter(pr => pr.measuredAt !== null);

      if (measured.length === 0) {
        return {
          totalEnergy: 0,
          totalCarbon: 0,
          meanSCI: 0,
          worstTargets: [],
          improving: 0,
          worsening: 0,
          stable: 0,
        };
      }

      const totalEnergy = measured.reduce((sum, pr) => sum + (pr.energyJoules as number), 0);
      const totalCarbon = measured.reduce((sum, pr) => sum + (pr.carbonIntensityGrams as number), 0);
      const meanSCI = measured.reduce((sum, pr) => sum + (pr.sciScore as number), 0) / measured.length;

      // Worst targets: top 5 by SCI
      const sorted = [...measured].sort((a, b) => (b.sciScore as number) - (a.sciScore as number));
      const worstTargets = sorted.slice(0, 5).map(pr => ({
        target: pr.target as string,
        sciScore: pr.sciScore as number,
      }));

      // Trajectory counts
      let improving = 0;
      let worsening = 0;
      let stable = 0;
      for (const pr of measured) {
        const history = (pr.history as Array<{ sciScore: number }>) || [];
        if (history.length >= 2) {
          const recent = history.slice(-3);
          const avgDelta = recent.reduce((sum, entry, i) => {
            if (i === 0) return 0;
            return sum + (entry.sciScore - recent[i - 1].sciScore);
          }, 0) / Math.max(recent.length - 1, 1);
          if (avgDelta < -0.001) improving++;
          else if (avgDelta > 0.001) worsening++;
          else stable++;
        } else {
          stable++;
        }
      }

      return {
        totalEnergy,
        totalCarbon,
        meanSCI: Math.round(meanSCI * 1_000_000) / 1_000_000,
        worstTargets,
        improving,
        worsening,
        stable,
      };
    }, '_overview');

    return completeFrom(p, 'ok', (bindings) => ({
      overview: bindings._overview as Record<string, unknown>,
    }));
  },
};

export const energyProfileHandler = autoInterpret(_energyProfileHandler);

export function resetEnergyProfileCounter(): void {
  idCounter = 0;
}
