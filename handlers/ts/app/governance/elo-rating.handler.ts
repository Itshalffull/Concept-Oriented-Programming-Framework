// @migrated dsl-constructs 2026-03-18
// EloRating Reputation Provider
// Standard Elo: E = 1/(1+10^((Rl-Rw)/400)), rating update with K-factor.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _eloRatingHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
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
    return complete(p, 'configured', { config: id }) as StorageProgram<Result>;
  },

  recordOutcome(input: Record<string, unknown>) {
    const { config, winner, loser } = input;
    let p = createProgram();
    p = get(p, 'elo_cfg', config as string, 'cfg');
    p = get(p, 'elo_rating', `${config}:${winner}`, 'wRec');
    p = get(p, 'elo_rating', `${config}:${loser}`, 'lRec');

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

      const Ew = 1 / (1 + Math.pow(10, (Rl - Rw) / 400));
      const El = 1 / (1 + Math.pow(10, (Rw - Rl) / 400));

      const winnerDelta = K * (1 - Ew);
      const loserDelta = K * (0 - El);
      const winnerNewRating = Rw + winnerDelta;
      const loserNewRating = Rl + loserDelta;

      return { winnerNewRating, loserNewRating, winnerDelta, loserDelta, wGames, lGames };
    }, 'calc');

    p = branch(p, () => true,
      (b) => {
        return completeFrom(b, 'updated', (bindings) => {
          const calc = bindings.calc as Record<string, unknown>;
          return {
            winnerNewRating: calc.winnerNewRating,
            loserNewRating: calc.loserNewRating,
            winnerDelta: calc.winnerDelta,
            loserDelta: calc.loserDelta,
          };
        });
      },
      (b) => complete(b, 'updated', {}),
    );

    // Issue puts for updated ratings
    let q = createProgram();
    q = get(q, 'elo_cfg', config as string, 'cfg');
    q = get(q, 'elo_rating', `${config}:${winner}`, 'wRec');
    q = get(q, 'elo_rating', `${config}:${loser}`, 'lRec');

    q = mapBindings(q, (bindings) => {
      const cfg = bindings.cfg as Record<string, unknown> | null;
      const wRec = bindings.wRec as Record<string, unknown> | null;
      const lRec = bindings.lRec as Record<string, unknown> | null;
      const K = cfg ? (cfg.kFactor as number) : 32;
      const initial = cfg ? (cfg.initialRating as number) : 1500;

      const Rw = wRec ? (wRec.rating as number) : initial;
      const Rl = lRec ? (lRec.rating as number) : initial;
      const wGames = wRec ? (wRec.gamesPlayed as number) : 0;
      const lGames = lRec ? (lRec.gamesPlayed as number) : 0;

      const Ew = 1 / (1 + Math.pow(10, (Rl - Rw) / 400));
      const El = 1 / (1 + Math.pow(10, (Rw - Rl) / 400));

      const winnerDelta = K * (1 - Ew);
      const loserDelta = K * (0 - El);
      const winnerNewRating = Rw + winnerDelta;
      const loserNewRating = Rl + loserDelta;

      return {
        winnerPut: { config, participant: winner, rating: winnerNewRating, gamesPlayed: wGames + 1 },
        loserPut: { config, participant: loser, rating: loserNewRating, gamesPlayed: lGames + 1 },
        winnerNewRating, loserNewRating, winnerDelta, loserDelta,
      };
    }, 'calc');

    q = put(q, 'elo_rating', `${config}:${winner}`, {});
    q = put(q, 'elo_rating', `${config}:${loser}`, {});

    return completeFrom(q, 'updated', (bindings) => {
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
    let p = createProgram();
    p = get(p, 'elo_cfg', config as string, 'cfg');
    p = get(p, 'elo_rating', `${config}:${participantA}`, 'recA');
    p = get(p, 'elo_rating', `${config}:${participantB}`, 'recB');

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

      const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
      const Eb = 1 / (1 + Math.pow(10, (Ra - Rb) / 400));

      const aNew = Ra + K * (0.5 - Ea);
      const bNew = Rb + K * (0.5 - Eb);

      return {
        aPut: { config, participant: participantA, rating: aNew, gamesPlayed: gA + 1 },
        bPut: { config, participant: participantB, rating: bNew, gamesPlayed: gB + 1 },
        aNewRating: aNew,
        bNewRating: bNew,
      };
    }, 'calc');

    p = put(p, 'elo_rating', `${config}:${participantA}`, {});
    p = put(p, 'elo_rating', `${config}:${participantB}`, {});

    return completeFrom(p, 'updated', (bindings) => {
      const calc = bindings.calc as Record<string, unknown>;
      return { aNewRating: calc.aNewRating, bNewRating: calc.bNewRating };
    }) as StorageProgram<Result>;
  },

  getRating(input: Record<string, unknown>) {
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
