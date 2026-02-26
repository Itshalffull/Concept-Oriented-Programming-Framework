// Rollout Concept Implementation (Deploy Kit)
// Manage progressive delivery of concept deployments (canary, blue-green, rolling).
import type { ConceptHandler } from '@clef/kernel';

export const rolloutHandler: ConceptHandler = {
  async begin(input, storage) {
    const plan = input.plan as string;
    const strategy = input.strategy as string;
    const steps = input.steps as string;

    const validStrategies = ['canary', 'blue-green', 'rolling'];
    if (!validStrategies.includes(strategy)) {
      return { variant: 'invalidStrategy', message: `Unknown strategy: ${strategy}` };
    }

    let stepList: Array<{ weight: number; pauseSeconds: number }>;
    try {
      stepList = JSON.parse(steps);
    } catch {
      return { variant: 'invalidStrategy', message: 'Invalid step configuration JSON' };
    }

    if (!Array.isArray(stepList) || stepList.length === 0) {
      return { variant: 'invalidStrategy', message: 'Steps must be a non-empty array' };
    }

    const rolloutId = `ro-${Date.now()}`;
    const startedAt = new Date().toISOString();

    await storage.put('rollout', rolloutId, {
      rolloutId,
      strategy,
      steps: JSON.stringify(stepList),
      successCriteria: JSON.stringify({ maxErrorRate: 0.01, maxLatencyP99: 500 }),
      autoRollback: true,
      currentStep: 0,
      currentWeight: stepList[0].weight,
      startedAt,
      status: 'in_progress',
      oldVersion: '',
      newVersion: '',
      plan,
    });

    return { variant: 'ok', rollout: rolloutId };
  },

  async advance(input, storage) {
    const rollout = input.rollout as string;

    const existing = await storage.get('rollout', rollout);
    if (!existing) {
      return { variant: 'paused', rollout, reason: 'Rollout not found' };
    }

    const status = existing.status as string;
    if (status === 'completed') {
      return { variant: 'complete', rollout };
    }

    if (status === 'paused') {
      return { variant: 'paused', rollout, reason: 'Rollout is paused' };
    }

    const steps: Array<{ weight: number; pauseSeconds: number }> =
      JSON.parse(existing.steps as string);
    const currentStep = existing.currentStep as number;
    const nextStep = currentStep + 1;

    if (nextStep >= steps.length) {
      await storage.put('rollout', rollout, {
        ...existing,
        status: 'completed',
        currentStep: steps.length - 1,
        currentWeight: 100,
      });
      return { variant: 'complete', rollout };
    }

    const newWeight = steps[nextStep].weight;

    await storage.put('rollout', rollout, {
      ...existing,
      currentStep: nextStep,
      currentWeight: newWeight,
    });

    return { variant: 'ok', rollout, newWeight, step: nextStep };
  },

  async pause(input, storage) {
    const rollout = input.rollout as string;
    const reason = input.reason as string;

    const existing = await storage.get('rollout', rollout);
    if (!existing) {
      return { variant: 'ok', rollout };
    }

    await storage.put('rollout', rollout, {
      ...existing,
      status: 'paused',
    });

    return { variant: 'ok', rollout };
  },

  async resume(input, storage) {
    const rollout = input.rollout as string;

    const existing = await storage.get('rollout', rollout);
    if (!existing) {
      return { variant: 'ok', rollout, currentWeight: 0 };
    }

    await storage.put('rollout', rollout, {
      ...existing,
      status: 'in_progress',
    });

    return { variant: 'ok', rollout, currentWeight: existing.currentWeight as number };
  },

  async abort(input, storage) {
    const rollout = input.rollout as string;

    const existing = await storage.get('rollout', rollout);
    if (!existing) {
      return { variant: 'ok', rollout };
    }

    const status = existing.status as string;
    if (status === 'completed') {
      return { variant: 'alreadyComplete', rollout };
    }

    await storage.put('rollout', rollout, {
      ...existing,
      status: 'aborted',
      currentWeight: 0,
    });

    return { variant: 'ok', rollout };
  },

  async status(input, storage) {
    const rollout = input.rollout as string;

    const existing = await storage.get('rollout', rollout);
    if (!existing) {
      return { variant: 'ok', rollout, step: 0, weight: 0, status: 'unknown', elapsed: 0 };
    }

    const startedAt = new Date(existing.startedAt as string).getTime();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);

    return {
      variant: 'ok',
      rollout,
      step: existing.currentStep as number,
      weight: existing.currentWeight as number,
      status: existing.status as string,
      elapsed,
    };
  },
};
