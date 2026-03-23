// @clef-handler style=imperative
// Reputation Concept Handler
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; output?: Record<string, unknown>; [key: string]: unknown };

export const reputationHandler: ConceptHandler = {
  async earn(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant, reason } = input;
    const amount = parseFloat(input.amount as string);
    if (!participant || (participant as string).trim() === '') {
      return { variant: 'error', message: 'participant is required' };
    }
    if (!isNaN(amount) && amount <= 0) {
      return { variant: 'error', message: 'amount must be positive' };
    }
    const id = `rep-${participant}`;
    const record = await storage.get('reputation', id) as Record<string, unknown> | null;
    const currentScore = record ? (record.score as number) : 0;
    const history = record ? ((record.history as unknown[]) ?? []) : [];
    const newScore = currentScore + (isNaN(amount) ? 0 : amount);
    history.push({ amount, reason, earnedAt: new Date().toISOString() });
    await storage.put('reputation', id, { id, participant, score: newScore, history });
    return { variant: 'ok', entry: id, newScore, output: { entry: id, newScore } };
  },

  async burn(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant } = input;
    const amount = parseFloat(input.amount as string);
    if (!participant || (participant as string).trim() === '') {
      return { variant: 'error', message: 'participant is required' };
    }
    const id = `rep-${participant}`;
    const record = await storage.get('reputation', id) as Record<string, unknown> | null;
    const currentScore = record ? (record.score as number) : 0;
    if (!isNaN(amount) && amount > currentScore) {
      return { variant: 'error', message: 'Insufficient reputation to burn' };
    }
    const newScore = Math.max(0, currentScore - (isNaN(amount) ? 0 : amount));
    await storage.put('reputation', id, { ...(record || {}), id, participant, score: newScore });
    return { variant: 'ok', entry: id, newScore, output: { entry: id, newScore } };
  },

  async decay(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant } = input;
    const decayFactor = parseFloat(input.decayFactor as string);
    if (!participant || (participant as string).trim() === '') {
      return { variant: 'error', message: 'participant is required' };
    }
    if (!isNaN(decayFactor) && decayFactor < 0) {
      return { variant: 'error', message: 'decayFactor must be non-negative' };
    }
    const id = `rep-${participant}`;
    const record = await storage.get('reputation', id) as Record<string, unknown> | null;
    const currentScore = record ? (record.score as number) : 0;
    const factor = isNaN(decayFactor) ? 0 : decayFactor;
    const newScore = currentScore * (1 - factor);
    await storage.put('reputation', id, { ...(record || {}), id, participant, score: newScore });
    return { variant: 'ok', entry: id, newScore, output: { entry: id, newScore } };
  },

  async getScore(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant } = input;
    if (!participant || (participant as string).trim() === '') {
      return { variant: 'error', message: 'participant is required' };
    }
    const record = await storage.get('reputation', `rep-${participant}`) as Record<string, unknown> | null;
    if (!record) return { variant: 'not_found', participant, output: { participant } };
    return { variant: 'ok', participant, value: record.score, output: { participant, value: record.score } };
  },

  async recalculate(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { participant } = input;
    if (!participant || (participant as string).trim() === '') {
      return { variant: 'error', message: 'participant is required' };
    }
    const record = await storage.get('reputation', `rep-${participant}`) as Record<string, unknown> | null;
    const history = record ? ((record.history as unknown[]) ?? []) : [];
    let newScore = 0;
    for (const h of history) {
      newScore += parseFloat((h as any).amount) || 0;
    }
    if (record) {
      await storage.put('reputation', `rep-${participant}`, { ...record, score: newScore });
    }
    return { variant: 'ok', participant, newScore, output: { participant, newScore } };
  },
};
