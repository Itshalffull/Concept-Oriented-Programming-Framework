// EloRating Reputation Provider
// Standard Elo: E = 1/(1+10^((Rl-Rw)/400)), rating update with K-factor.
import type { ConceptHandler } from '@clef/runtime';

export const eloRatingHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `elo-${Date.now()}`;
    await storage.put('elo_cfg', id, {
      id,
      kFactor: input.kFactor ?? 32,
      initialRating: input.initialRating ?? 1500,
      kFactorDecay: input.kFactorDecay ?? null,
    });

    await storage.put('plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'EloRating',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async recordOutcome(input, storage) {
    const { config, winner, loser } = input;
    const cfg = await storage.get('elo_cfg', config as string);
    const K = cfg ? (cfg.kFactor as number) : 32;
    const initial = cfg ? (cfg.initialRating as number) : 1500;

    const winnerKey = `${config}:${winner}`;
    const loserKey = `${config}:${loser}`;
    const wRec = await storage.get('elo_rating', winnerKey);
    const lRec = await storage.get('elo_rating', loserKey);
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

    await storage.put('elo_rating', winnerKey, {
      config, participant: winner, rating: winnerNewRating, gamesPlayed: wGames + 1,
    });
    await storage.put('elo_rating', loserKey, {
      config, participant: loser, rating: loserNewRating, gamesPlayed: lGames + 1,
    });

    return {
      variant: 'updated',
      winnerNewRating, loserNewRating,
      winnerDelta, loserDelta,
    };
  },

  async recordDraw(input, storage) {
    const { config, participantA, participantB } = input;
    const cfg = await storage.get('elo_cfg', config as string);
    const K = cfg ? (cfg.kFactor as number) : 32;
    const initial = cfg ? (cfg.initialRating as number) : 1500;

    const keyA = `${config}:${participantA}`;
    const keyB = `${config}:${participantB}`;
    const recA = await storage.get('elo_rating', keyA);
    const recB = await storage.get('elo_rating', keyB);
    const Ra = recA ? (recA.rating as number) : initial;
    const Rb = recB ? (recB.rating as number) : initial;
    const gA = recA ? (recA.gamesPlayed as number) : 0;
    const gB = recB ? (recB.gamesPlayed as number) : 0;

    const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
    const Eb = 1 / (1 + Math.pow(10, (Ra - Rb) / 400));

    const aNew = Ra + K * (0.5 - Ea);
    const bNew = Rb + K * (0.5 - Eb);

    await storage.put('elo_rating', keyA, {
      config, participant: participantA, rating: aNew, gamesPlayed: gA + 1,
    });
    await storage.put('elo_rating', keyB, {
      config, participant: participantB, rating: bNew, gamesPlayed: gB + 1,
    });

    return { variant: 'updated', aNewRating: aNew, bNewRating: bNew };
  },

  async getRating(input, storage) {
    const { config, participant } = input;
    const cfg = await storage.get('elo_cfg', config as string);
    const initial = cfg ? (cfg.initialRating as number) : 1500;

    const key = `${config}:${participant}`;
    const rec = await storage.get('elo_rating', key);
    const rating = rec ? (rec.rating as number) : initial;
    const gamesPlayed = rec ? (rec.gamesPlayed as number) : 0;

    return { variant: 'rating', participant, value: rating, gamesPlayed };
  },
};
