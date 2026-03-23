// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// EloRating Reputation Provider
// Standard Elo: E = 1/(1+10^((Rl-Rw)/400)), rating update with K-factor.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/** Pure Elo calculation. */
function computeElo(Rw: number, Rl: number, K: number) {
  const Ew = 1 / (1 + Math.pow(10, (Rl - Rw) / 400));
  const El = 1 / (1 + Math.pow(10, (Rw - Rl) / 400));
  const winnerDelta = K * (1 - Ew);
  const loserDelta = K * (0 - El);
  return {
    winnerNewRating: Rw + winnerDelta,
    loserNewRating: Rl + loserDelta,
    winnerDelta,
    loserDelta,
  };
}

/** Pure Elo draw calculation. */
function computeEloDraw(Ra: number, Rb: number, K: number) {
  const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
  const Eb = 1 / (1 + Math.pow(10, (Ra - Rb) / 400));
  return {
    aNewRating: Ra + K * (0.5 - Ea),
    bNewRating: Rb + K * (0.5 - Eb),
  };
}

type Result = { variant: string; [key: string]: unknown };

const _eloRatingHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const kFactor = typeof input.kFactor === 'string' ? parseFloat(input.kFactor) : (input.kFactor as number ?? 32);
    if (kFactor <= 0) {
      return complete(createProgram(), 'error', { message: 'kFactor must be positive' }) as StorageProgram<Result>;
    }
    const id = `elo-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'elo_cfg', id, {
      id,
      kFactor: input.kFactor ?? 32,
      initialRating: input.initialRating ?? 1500,
      kFactorDecay: input.kFactorDecay ?? null,
    });
    p = put(p, 'plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'EloRating',
      instanceId: id,
    });
    return complete(p, 'ok', { id, config: id }) as StorageProgram<Result>;
  },

  recordOutcome(input: Record<string, unknown>) {
    const { config, winner, loser } = input;
    if (winner === loser) {
      return complete(createProgram(), 'error', { message: 'winner and loser must be different' }) as StorageProgram<Result>;
    }
    const winnerKey = `${config}:${winner}`;
    const loserKey = `${config}:${loser}`;

    let p = createProgram();
    p = get(p, 'elo_cfg', config as string, 'cfg');
    p = get(p, 'elo_rating', winnerKey, 'wRec');
    p = get(p, 'elo_rating', loserKey, 'lRec');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const wRec = bindings.wRec as Record<string, unknown> | null;
      const lRec = bindings.lRec as Record<string, unknown> | null;
      const K = cfg ? (cfg.kFactor as number) : 32;
      const initial = cfg ? (cfg.initialRating as number) : 1500;

      const Rw = wRec ? (wRec.rating as number) : initial;
      const Rl = lRec ? (lRec.rating as number) : initial;
      const wGames = wRec ? (wRec.gamesPlayed as number) : 0;
      const lGames = lRec ? (lRec.gamesPlayed as number) : 0;

      const elo = computeElo(Rw, Rl, K);

      return {
        winnerPut: { config, participant: winner, rating: elo.winnerNewRating, gamesPlayed: wGames + 1 },
        loserPut: { config, participant: loser, rating: elo.loserNewRating, gamesPlayed: lGames + 1 },
        ...elo,
      };
    }, 'calc');

    p = putFrom(p, 'elo_rating', winnerKey, (bindings) => (bindings.calc as Record<string, unknown>).winnerPut as Record<string, unknown>);
    p = putFrom(p, 'elo_rating', loserKey, (bindings) => (bindings.calc as Record<string, unknown>).loserPut as Record<string, unknown>);

    return completeFrom(p, 'ok', (bindings) => {
      const calc = bindings.calc as Record<string, unknown>;
      return {
        winnerNewRating: calc.winnerNewRating,
        loserNewRating: calc.loserNewRating,
        winnerDelta: calc.winnerDelta,
        loserDelta: calc.loserDelta,
      };
    }) as StorageProgram<Result>;
  },

  recordDraw(input: Record<string, unknown>) {
    const { config, participantA, participantB } = input;
    if (participantA === participantB) {
      return complete(createProgram(), 'error', { message: 'participants must be different' }) as StorageProgram<Result>;
    }
    const keyA = `${config}:${participantA}`;
    const keyB = `${config}:${participantB}`;

    let p = createProgram();
    p = get(p, 'elo_cfg', config as string, 'cfg');
    p = get(p, 'elo_rating', keyA, 'recA');
    p = get(p, 'elo_rating', keyB, 'recB');

    p = mapBindings(p, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const recA = bindings.recA as Record<string, unknown> | null;
      const recB = bindings.recB as Record<string, unknown> | null;
      const K = cfg ? (cfg.kFactor as number) : 32;
      const initial = cfg ? (cfg.initialRating as number) : 1500;

      const Ra = recA ? (recA.rating as number) : initial;
      const Rb = recB ? (recB.rating as number) : initial;
      const gA = recA ? (recA.gamesPlayed as number) : 0;
      const gB = recB ? (recB.gamesPlayed as number) : 0;

      const draw = computeEloDraw(Ra, Rb, K);

      return {
        aPut: { config, participant: participantA, rating: draw.aNewRating, gamesPlayed: gA + 1 },
        bPut: { config, participant: participantB, rating: draw.bNewRating, gamesPlayed: gB + 1 },
        aNewRating: draw.aNewRating,
        bNewRating: draw.bNewRating,
      };
    }, 'calc');

    p = putFrom(p, 'elo_rating', keyA, (bindings) => (bindings.calc as Record<string, unknown>).aPut as Record<string, unknown>);
    p = putFrom(p, 'elo_rating', keyB, (bindings) => (bindings.calc as Record<string, unknown>).bPut as Record<string, unknown>);

    return completeFrom(p, 'ok', (bindings) => {
      const calc = bindings.calc as Record<string, unknown>;
      return { aNewRating: calc.aNewRating, bNewRating: calc.bNewRating };
    }) as StorageProgram<Result>;
  },

  getRating(input: Record<string, unknown>) {
    if (!input.participant || (typeof input.participant === 'string' && (input.participant as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }
    const { config, participant } = input;
    let p = createProgram();
    p = get(p, 'elo_cfg', config as string, 'cfg');
    p = get(p, 'elo_rating', `${config}:${participant}`, 'rec');

    return completeFrom(p, 'rating', (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const rec = bindings.rec as Record<string, unknown> | null;
      const initial = cfg ? (cfg.initialRating as number) : 1500;
      const rating = rec ? (rec.rating as number) : initial;
      const gamesPlayed = rec ? (rec.gamesPlayed as number) : 0;
      return { participant, value: rating, gamesPlayed };
    }) as StorageProgram<Result>;
  },
};

export const eloRatingHandler = autoInterpret(_eloRatingHandler);
