// @migrated dsl-constructs 2026-03-18
// Reputation Concept Handler
// Coordination concept routing to pluggable reputation algorithm providers.
//
// Uses imperative style because earn/burn/decay need to read current score,
// compute new score, and write back — requiring dynamic storage values.
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

const _reputationHandler: ConceptHandler = {
  async earn(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant, amount, reason } = input;
    const id = `rep-${participant}`;

    const record = await storage.get('reputation', id) as Record<string, unknown> | null;
    const currentScore = record ? (record.score as number) : 0;
    const history = record ? ((record.history as unknown[]) ?? []) : [];
    const newScore = currentScore + (amount as number);

    history.push({ amount, reason, earnedAt: new Date().toISOString() });

    await storage.put('reputation', id, {
      id,
      participant,
      score: newScore,
      history,
    });

    return { variant: 'earned', entry: id, newScore };
  },

  async burn(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant, amount } = input;
    const id = `rep-${participant}`;

    const record = await storage.get('reputation', id) as Record<string, unknown> | null;
    const currentScore = record ? (record.score as number) : 0;
    const newScore = Math.max(0, currentScore - (amount as number));

    await storage.put('reputation', id, {
      ...(record || {}),
      id,
      participant,
      score: newScore,
    });

    return { variant: 'burned', entry: id, newScore };
  },

  async decay(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant, decayFactor } = input;
    const id = `rep-${participant}`;

    const record = await storage.get('reputation', id) as Record<string, unknown> | null;
    const currentScore = record ? (record.score as number) : 0;
    const newScore = currentScore * (1 - (decayFactor as number));

    await storage.put('reputation', id, {
      ...(record || {}),
      id,
      participant,
      score: newScore,
    });

    return { variant: 'decayed', entry: id, newScore };
  },

  async getScore(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant } = input;
    const record = await storage.get('reputation', `rep-${participant}`) as Record<string, unknown> | null;

    if (!record) return { variant: 'score', participant, score: 0.0 };
    return { variant: 'score', participant, score: record.score };
  },

  async recalculate(input: Record<string, unknown>, _storage: ConceptStorage): Promise<Result> {
    const { participant } = input;
    return { variant: 'recalculated', participant, newScore: 0.0 };
  },
};

export const reputationHandler = _reputationHandler;
