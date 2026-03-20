// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// GlickoRating Reputation Provider
// Glicko-2: rating + deviation + volatility for more accurate skill estimation than Elo.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

// Glicko-2 constants
const TAU = 0.5; // system constant constraining volatility change
const CONVERGENCE_TOL = 0.000001;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/** Compute Glicko-2 updated rating for a participant given an outcome. */
function computeGlicko2Update(
  r: number, RD: number, sigma: number,
  rj: number, RDj: number,
  s: number,
): { newRating: number; newDeviation: number; newSigma: number } {
  const mu = (r - 1500) / 173.7178;
  const phi = RD / 173.7178;
  const muJ = (rj - 1500) / 173.7178;
  const phiJ = RDj / 173.7178;

  const gPhiJ = g(phiJ);
  const e = E(mu, muJ, phiJ);

  const v = 1 / (gPhiJ * gPhiJ * e * (1 - e));
  const delta = v * gPhiJ * (s - e);

  // Compute new volatility via iterative algorithm
  const a = Math.log(sigma * sigma);
  const deltaSquared = delta * delta;
  const phiSquared = phi * phi;

  function f(x: number): number {
    const ex = Math.exp(x);
    const d = phiSquared + v + ex;
    return (ex * (deltaSquared - phiSquared - v - ex)) / (2 * d * d) - (x - a) / (TAU * TAU);
  }

  let A = a;
  let B: number;
  if (deltaSquared > phiSquared + v) {
    B = Math.log(deltaSquared - phiSquared - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  for (let iter = 0; iter < 100; iter++) {
    if (Math.abs(B - A) < CONVERGENCE_TOL) break;
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B; fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C; fB = fC;
  }

  const newSigma = Math.exp(B / 2);
  const phiStar = Math.sqrt(phiSquared + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gPhiJ * (s - e);

  // Convert back to Glicko scale
  const newRating = 173.7178 * newMu + 1500;
  const newDeviation = 173.7178 * newPhi;

  return { newRating, newDeviation, newSigma };
}

type Result = { variant: string; [key: string]: unknown };

const _glickoRatingHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const id = `glicko-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'glicko_cfg', id, {
      id,
      initialRating: input.initialRating ?? 1500,
      initialDeviation: input.initialDeviation ?? 350,
      initialVolatility: input.initialVolatility ?? 0.06,
      inactivityGrowthRate: input.inactivityGrowthRate ?? 30,
    });
    p = put(p, 'plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'GlickoRating',
      instanceId: id,
    });
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  recordOutcome(input: Record<string, unknown>) {
    const { config, participant, opponent, outcome } = input;
    const pKey = `${config}:${participant}`;

    let p = createProgram();
    p = get(p, 'glicko_cfg', config as string, 'cfg');
    p = get(p, 'glicko_rating', pKey, 'pRec');
    p = get(p, 'glicko_rating', `${config}:${opponent}`, 'oRec');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const pRec = bindings.pRec as Record<string, unknown> | null;
      const oRec = bindings.oRec as Record<string, unknown> | null;
      const initialRating = cfg ? (cfg.initialRating as number) : 1500;
      const initialDev = cfg ? (cfg.initialDeviation as number) : 350;
      const initialVol = cfg ? (cfg.initialVolatility as number) : 0.06;

      const r = pRec ? (pRec.rating as number) : initialRating;
      const RD = pRec ? (pRec.deviation as number) : initialDev;
      const sigma = pRec ? (pRec.volatility as number) : initialVol;
      const rj = oRec ? (oRec.rating as number) : initialRating;
      const RDj = oRec ? (oRec.deviation as number) : initialDev;

      const s = outcome as number; // 1.0 = win, 0.5 = draw, 0.0 = loss
      const result = computeGlicko2Update(r, RD, sigma, rj, RDj, s);
      const games = pRec ? (pRec.gamesPlayed as number) + 1 : 1;

      return {
        putData: {
          config, participant,
          rating: result.newRating, deviation: result.newDeviation,
          volatility: result.newSigma, gamesPlayed: games,
        },
        newRating: result.newRating,
        newDeviation: result.newDeviation,
      };
    }, 'calc');

    p = putFrom(p, 'glicko_rating', pKey, (bindings) => (bindings.calc as Record<string, unknown>).putData as Record<string, unknown>);

    return completeFrom(p, 'updated', (bindings) => {
      const calc = bindings.calc as Record<string, unknown>;
      return {
        participant,
        newRating: calc.newRating,
        newDeviation: calc.newDeviation,
      };
    }) as StorageProgram<Result>;
  },

  applyInactivityDecay(input: Record<string, unknown>) {
    const { config, participant, daysSinceActive } = input;
    const key = `${config}:${participant}`;

    let p = createProgram();
    p = get(p, 'glicko_cfg', config as string, 'cfg');
    p = get(p, 'glicko_rating', key, 'rec');

    p = branch(p, 'rec',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const cfg = bindings.cfg as Record<string, unknown> | null;
          const rec = bindings.rec as Record<string, unknown>;
          const initialDev = cfg ? (cfg.initialDeviation as number) : 350;
          const growthRate = cfg ? (cfg.inactivityGrowthRate as number) : 30;

          const phi = (rec.deviation as number) / 173.7178;
          const sigma = rec.volatility as number;
          const periods = Math.floor((daysSinceActive as number) / growthRate);

          let phiNew = phi;
          for (let i = 0; i < periods; i++) {
            phiNew = Math.sqrt(phiNew * phiNew + sigma * sigma);
          }

          const newDeviation = Math.min(173.7178 * phiNew, initialDev);
          return { updatedRec: { ...rec, deviation: newDeviation }, newDeviation };
        }, 'calc');

        b2 = putFrom(b2, 'glicko_rating', key, (bindings) => (bindings.calc as Record<string, unknown>).updatedRec as Record<string, unknown>);

        return completeFrom(b2, 'decayed', (bindings) => {
          const calc = bindings.calc as Record<string, unknown>;
          return { participant, newDeviation: calc.newDeviation };
        });
      },
      (b) => complete(b, 'not_found', { participant }),
    );

    return p as StorageProgram<Result>;
  },

  getReliableWeight(input: Record<string, unknown>) {
    const { config, participant } = input;
    let p = createProgram();
    p = get(p, 'glicko_cfg', config as string, 'cfg');
    p = get(p, 'glicko_rating', `${config}:${participant}`, 'rec');

    return completeFrom(p, 'weight', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const rec = bindings.rec as Record<string, unknown> | null;
      const initialRating = cfg ? (cfg.initialRating as number) : 1500;
      const initialDev = cfg ? (cfg.initialDeviation as number) : 350;
      const rating = rec ? (rec.rating as number) : initialRating;
      const deviation = rec ? (rec.deviation as number) : initialDev;

      // Reliability = inverse of deviation, normalized so maxDev = 0 and minDev ~ 1
      const reliability = Math.max(0, 1 - deviation / initialDev);

      return { participant, rating, deviation, reliability };
    }) as StorageProgram<Result>;
  },
};

export const glickoRatingHandler = autoInterpret(_glickoRatingHandler);
