// GlickoRating Reputation Provider
// Glicko-2: rating + deviation + volatility for more accurate skill estimation than Elo.
import type { ConceptHandler } from '@clef/runtime';

// Glicko-2 constants
const TAU = 0.5; // system constant constraining volatility change
const CONVERGENCE_TOL = 0.000001;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

export const glickoRatingHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `glicko-${Date.now()}`;
    await storage.put('glicko_cfg', id, {
      id,
      initialRating: input.initialRating ?? 1500,
      initialDeviation: input.initialDeviation ?? 350,
      initialVolatility: input.initialVolatility ?? 0.06,
      inactivityGrowthRate: input.inactivityGrowthRate ?? 30,
    });

    await storage.put('plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'GlickoRating',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async recordOutcome(input, storage) {
    const { config, participant, opponent, outcome } = input;
    const cfg = await storage.get('glicko_cfg', config as string);
    const initialRating = cfg ? (cfg.initialRating as number) : 1500;
    const initialDev = cfg ? (cfg.initialDeviation as number) : 350;
    const initialVol = cfg ? (cfg.initialVolatility as number) : 0.06;

    const pKey = `${config}:${participant}`;
    const oKey = `${config}:${opponent}`;
    const pRec = await storage.get('glicko_rating', pKey);
    const oRec = await storage.get('glicko_rating', oKey);

    // Convert to Glicko-2 scale (mu, phi)
    const r = pRec ? (pRec.rating as number) : initialRating;
    const RD = pRec ? (pRec.deviation as number) : initialDev;
    const sigma = pRec ? (pRec.volatility as number) : initialVol;
    const rj = oRec ? (oRec.rating as number) : initialRating;
    const RDj = oRec ? (oRec.deviation as number) : initialDev;

    const mu = (r - 1500) / 173.7178;
    const phi = RD / 173.7178;
    const muJ = (rj - 1500) / 173.7178;
    const phiJ = RDj / 173.7178;

    const s = outcome as number; // 1.0 = win, 0.5 = draw, 0.0 = loss

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

    const games = pRec ? (pRec.gamesPlayed as number) + 1 : 1;

    await storage.put('glicko_rating', pKey, {
      config, participant,
      rating: newRating, deviation: newDeviation, volatility: newSigma,
      gamesPlayed: games,
    });

    return {
      variant: 'updated', participant,
      newRating, newDeviation,
    };
  },

  async applyInactivityDecay(input, storage) {
    const { config, participant, daysSinceActive } = input;
    const cfg = await storage.get('glicko_cfg', config as string);
    const initialDev = cfg ? (cfg.initialDeviation as number) : 350;
    const growthRate = cfg ? (cfg.inactivityGrowthRate as number) : 30;

    const key = `${config}:${participant}`;
    const rec = await storage.get('glicko_rating', key);
    if (!rec) return { variant: 'not_found', participant };

    const phi = (rec.deviation as number) / 173.7178;
    const sigma = rec.volatility as number;
    const periods = Math.floor((daysSinceActive as number) / growthRate);

    let phiNew = phi;
    for (let i = 0; i < periods; i++) {
      phiNew = Math.sqrt(phiNew * phiNew + sigma * sigma);
    }

    const newDeviation = Math.min(173.7178 * phiNew, initialDev);

    await storage.put('glicko_rating', key, { ...rec, deviation: newDeviation });

    return { variant: 'decayed', participant, newDeviation };
  },

  async getReliableWeight(input, storage) {
    const { config, participant } = input;
    const cfg = await storage.get('glicko_cfg', config as string);
    const initialRating = cfg ? (cfg.initialRating as number) : 1500;
    const initialDev = cfg ? (cfg.initialDeviation as number) : 350;

    const key = `${config}:${participant}`;
    const rec = await storage.get('glicko_rating', key);
    const rating = rec ? (rec.rating as number) : initialRating;
    const deviation = rec ? (rec.deviation as number) : initialDev;

    // Reliability = inverse of deviation, normalized so maxDev = 0 and minDev ≈ 1
    const reliability = Math.max(0, 1 - deviation / initialDev);

    return { variant: 'weight', participant, rating, deviation, reliability };
  },
};
