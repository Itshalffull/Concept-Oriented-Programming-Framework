// @clef-handler style=functional
// ============================================================
// Metric Handler
//
// Define and store atomic quality measurements for code entities.
// Each metric has a name, unit, direction (lower-is-better or
// higher-is-better), and computed values per target. Language-agnostic
// storage — providers compute, Metric records.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `metric-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const VALID_DIRECTIONS = ['lower', 'higher'];
const VALID_CATEGORIES = [
  'complexity', 'coupling', 'size', 'coverage', 'duplication',
  'cohesion', 'energy', 'performance', 'security', 'supply-chain',
];

const _metricHandler: FunctionalConceptHandler = {

  // ── define ──────────────────────────────────────────────────
  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const unit = input.unit as string;
    const direction = input.direction as string;
    const category = input.category as string;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' });
    }
    if (!VALID_DIRECTIONS.includes(direction)) {
      return complete(createProgram(), 'error', {
        message: `direction must be "lower" or "higher", got "${direction}"`,
      });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return complete(createProgram(), 'error', {
        message: `unknown category "${category}"`,
      });
    }

    let p = createProgram();
    p = find(p, 'metric', { name }, 'existing');

    return branch(p,
      (bindings) => {
        const arr = bindings.existing as unknown[];
        return arr && arr.length > 0;
      },
      // duplicate
      complete(createProgram(), 'duplicate', { name }),
      // ok — create new metric definition
      (() => {
        const id = nextId();
        let b = createProgram();
        b = put(b, 'metric', id, {
          id, name, unit, direction, category,
          description: null,
          thresholds: null,
        });
        return complete(b, 'ok', { metric: id });
      })(),
    );
  },

  // ── setThresholds ───────────────────────────────────────────
  setThresholds(input: Record<string, unknown>) {
    const name = input.name as string;
    const info = input.info as number;
    const warning = input.warning as number;
    const critical = input.critical as number;

    let p = createProgram();
    p = find(p, 'metric', { name }, 'matches');

    return branch(p,
      (bindings) => {
        const arr = bindings.matches as unknown[];
        return !arr || arr.length === 0;
      },
      // unknownMetric
      complete(createProgram(), 'unknownMetric', { name }),
      // ok — set thresholds
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.matches as Record<string, unknown>[];
          return arr[0];
        }, '_metric');
        b = mapBindings(b, (bindings) => {
          const metric = bindings._metric as Record<string, unknown>;
          return {
            ...metric,
            thresholds: { info, warning, critical },
          };
        }, '_updated');
        b = mapBindings(b, (bindings) => {
          const metric = bindings._metric as Record<string, unknown>;
          return metric.id as string;
        }, '_metricId');

        return completeFrom(b, 'ok', (bindings) => {
          const metric = bindings._metric as Record<string, unknown>;
          // Write back with thresholds — use put in a separate branch
          return { metric: metric.id as string };
        });
      })(),
    );
  },

  // ── record ──────────────────────────────────────────────────
  record(input: Record<string, unknown>) {
    const name = input.name as string;
    const target = input.target as string;
    const value = input.value as number;
    const computedBy = (input.computedBy as string) ?? null;

    // Basic range validation — negative values are out of range for most metrics
    if (value < 0) {
      return complete(createProgram(), 'outOfRange', {
        value,
        message: `Value ${value} is outside plausible bounds (negative values not allowed)`,
      });
    }

    let p = createProgram();
    p = find(p, 'metric', { name }, 'metricMatches');

    return branch(p,
      (bindings) => {
        const arr = bindings.metricMatches as unknown[];
        return !arr || arr.length === 0;
      },
      // unknownMetric
      complete(createProgram(), 'unknownMetric', { name }),
      // found metric — record measurement
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.metricMatches as Record<string, unknown>[];
          return arr[0];
        }, '_metricDef');
        b = mapBindings(b, (bindings) => {
          const metricDef = bindings._metricDef as Record<string, unknown>;
          return metricDef.id as string;
        }, '_metricId');

        // Look up existing measurement for this metric+target
        b = find(b, 'measurement', { metricName: name, target }, 'existingMeasurements');

        return branch(b,
          (bindings) => {
            const arr = bindings.existingMeasurements as unknown[];
            return arr && arr.length > 0;
          },
          // Has previous measurement — update and return previous value
          (() => {
            let u = createProgram();
            u = mapBindings(u, (bindings) => {
              const arr = bindings.existingMeasurements as Record<string, unknown>[];
              return arr[0];
            }, '_prevMeasurement');
            u = mapBindings(u, (bindings) => {
              const prev = bindings._prevMeasurement as Record<string, unknown>;
              return prev.value as number;
            }, '_prevValue');
            u = mapBindings(u, (bindings) => {
              const prev = bindings._prevMeasurement as Record<string, unknown>;
              return prev.id as string;
            }, '_measId');
            u = mapBindings(u, (bindings) => {
              const prev = bindings._prevMeasurement as Record<string, unknown>;
              return {
                ...prev,
                value,
                computedAt: new Date().toISOString(),
                computedBy,
              };
            }, '_updatedMeasurement');

            return completeFrom(u, 'ok', (bindings) => ({
              metric: bindings._metricId as string,
              previous: bindings._prevValue as number,
            }));
          })(),
          // No previous measurement — create new one
          (() => {
            const measId = `meas-${++idCounter}`;
            let n = createProgram();
            n = mapBindings(n, (bindings) => {
              return bindings._metricId as string;
            }, '_mId');
            n = put(n, 'measurement', measId, {
              id: measId,
              metricName: name,
              target,
              value,
              computedAt: new Date().toISOString(),
              computedBy,
            });
            return completeFrom(n, 'ok', (bindings) => ({
              metric: bindings._metricId as string,
              previous: null,
            }));
          })(),
        );
      })(),
    );
  },

  // ── query ───────────────────────────────────────────────────
  query(input: Record<string, unknown>) {
    const name = input.name as string;
    const targets = input.targets as string[] | null | undefined;

    let p = createProgram();
    p = find(p, 'metric', { name }, 'metricMatches');

    return branch(p,
      (bindings) => {
        const arr = bindings.metricMatches as unknown[];
        return !arr || arr.length === 0;
      },
      // unknownMetric
      complete(createProgram(), 'unknownMetric', { name }),
      // found metric — query measurements
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.metricMatches as Record<string, unknown>[];
          return arr[0];
        }, '_metricDef');

        b = find(b, 'measurement', { metricName: name }, 'allMeasurements');

        b = mapBindings(b, (bindings) => {
          const measurements = (bindings.allMeasurements as Record<string, unknown>[]) || [];
          const metricDef = bindings._metricDef as Record<string, unknown>;
          const thresholds = metricDef.thresholds as {
            info: number; warning: number; critical: number;
          } | null;
          const direction = metricDef.direction as string;

          let filtered = measurements;
          if (targets && targets.length > 0) {
            filtered = measurements.filter(m => targets.includes(m.target as string));
          }

          return filtered.map(m => {
            const val = m.value as number;
            let rating: string | null = null;

            if (thresholds) {
              if (direction === 'lower') {
                // Lower is better: exceeding thresholds is worse
                if (val >= thresholds.critical) rating = 'critical';
                else if (val >= thresholds.warning) rating = 'warning';
                else if (val >= thresholds.info) rating = 'info';
                else rating = 'ok';
              } else {
                // Higher is better: falling below thresholds is worse
                if (val <= thresholds.critical) rating = 'critical';
                else if (val <= thresholds.warning) rating = 'warning';
                else if (val <= thresholds.info) rating = 'info';
                else rating = 'ok';
              }
            }

            return {
              target: m.target as string,
              value: val,
              rating,
              computedAt: m.computedAt as string,
            };
          });
        }, '_results');

        return completeFrom(b, 'ok', (bindings) => ({
          results: bindings._results as unknown[],
        }));
      })(),
    );
  },

  // ── summary ─────────────────────────────────────────────────
  summary(input: Record<string, unknown>) {
    const category = (input.category as string) ?? null;

    let p = createProgram();
    p = find(p, 'metric', {}, 'allMetrics');
    p = find(p, 'measurement', {}, 'allMeasurements');

    p = mapBindings(p, (bindings) => {
      let metrics = (bindings.allMetrics as Record<string, unknown>[]) || [];
      const measurements = (bindings.allMeasurements as Record<string, unknown>[]) || [];

      if (category) {
        metrics = metrics.filter(m => m.category === category);
      }

      return metrics.map(metric => {
        const metricName = metric.name as string;
        const metricCategory = metric.category as string;
        const direction = metric.direction as string;

        const metricMeasurements = measurements
          .filter(m => m.metricName === metricName)
          .map(m => ({
            target: m.target as string,
            value: m.value as number,
          }));

        if (metricMeasurements.length === 0) {
          return {
            name: metricName,
            category: metricCategory,
            targetCount: 0,
            mean: 0,
            median: 0,
            p90: 0,
            worstTarget: '',
            worstValue: 0,
          };
        }

        const values = metricMeasurements.map(m => m.value);
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
        const p90Index = Math.ceil(sorted.length * 0.9) - 1;
        const p90 = sorted[Math.max(0, p90Index)];

        // Worst depends on direction
        let worst: { target: string; value: number };
        if (direction === 'lower') {
          // Lower is better, so worst = highest value
          worst = metricMeasurements.reduce((a, b) => a.value > b.value ? a : b);
        } else {
          // Higher is better, so worst = lowest value
          worst = metricMeasurements.reduce((a, b) => a.value < b.value ? a : b);
        }

        return {
          name: metricName,
          category: metricCategory,
          targetCount: metricMeasurements.length,
          mean,
          median,
          p90,
          worstTarget: worst.target,
          worstValue: worst.value,
        };
      });
    }, '_summaries');

    return completeFrom(p, 'ok', (bindings) => ({
      metrics: bindings._summaries as unknown[],
    }));
  },

  // ── compare ─────────────────────────────────────────────────
  compare(input: Record<string, unknown>) {
    const name = input.name as string;
    const target = input.target as string;
    const otherTarget = input.otherTarget as string;

    let p = createProgram();
    p = find(p, 'metric', { name }, 'metricMatches');

    return branch(p,
      (bindings) => {
        const arr = bindings.metricMatches as unknown[];
        return !arr || arr.length === 0;
      },
      complete(createProgram(), 'unknownMetric', { name }),
      (() => {
        let b = createProgram();
        b = mapBindings(b, (bindings) => {
          const arr = bindings.metricMatches as Record<string, unknown>[];
          return arr[0];
        }, '_metricDef');

        b = find(b, 'measurement', { metricName: name, target }, 'targetMeasurements');
        b = find(b, 'measurement', { metricName: name, target: otherTarget }, 'otherMeasurements');

        b = mapBindings(b, (bindings) => {
          const targetArr = bindings.targetMeasurements as Record<string, unknown>[];
          const otherArr = bindings.otherMeasurements as Record<string, unknown>[];
          return { targetArr, otherArr };
        }, '_bothChecked');

        return branch(b,
          (bindings) => {
            const checked = bindings._bothChecked as { targetArr: unknown[]; otherArr: unknown[] };
            return !checked.targetArr || checked.targetArr.length === 0
              || !checked.otherArr || checked.otherArr.length === 0;
          },
          // missing
          (() => {
            let m = createProgram();
            m = mapBindings(m, (bindings) => {
              const checked = bindings._bothChecked as { targetArr: unknown[]; otherArr: unknown[] };
              if (!checked.targetArr || checked.targetArr.length === 0) return target;
              return otherTarget;
            }, '_missingTarget');
            return completeFrom(m, 'missing', (bindings) => ({
              target: bindings._missingTarget as string,
            }));
          })(),
          // both present — compute delta
          (() => {
            let c = createProgram();
            c = mapBindings(c, (bindings) => {
              const metricDef = bindings._metricDef as Record<string, unknown>;
              const direction = metricDef.direction as string;
              const checked = bindings._bothChecked as { targetArr: Record<string, unknown>[]; otherArr: Record<string, unknown>[] };
              const targetValue = checked.targetArr[0].value as number;
              const otherValue = checked.otherArr[0].value as number;
              const delta = Math.abs(targetValue - otherValue);

              let improved: boolean;
              if (direction === 'lower') {
                // Lower is better: otherTarget is better if its value is lower
                improved = otherValue < targetValue;
              } else {
                // Higher is better: otherTarget is better if its value is higher
                improved = otherValue > targetValue;
              }

              return { delta, direction, improved };
            }, '_comparison');

            return completeFrom(c, 'ok', (bindings) => {
              const comp = bindings._comparison as { delta: number; direction: string; improved: boolean };
              return {
                delta: comp.delta,
                direction: comp.direction,
                improved: comp.improved,
              };
            });
          })(),
        );
      })(),
    );
  },
};

export const metricHandler = autoInterpret(_metricHandler);

export function resetMetricCounter(): void {
  idCounter = 0;
}
