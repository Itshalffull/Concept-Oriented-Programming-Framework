// Rollout Concept Implementation
// Progressive delivery orchestration. Manages canary, blue-green, and
// linear rollout strategies with step-by-step traffic shifting.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'rollout';
const VALID_STRATEGIES = ['canary', 'blue-green', 'linear', 'immediate'];

export const rolloutHandler: ConceptHandler = {
  async begin(input, storage) {
    const plan = input.plan as string;
    const strategy = input.strategy as string;
    const steps = input.steps;

    if (!VALID_STRATEGIES.includes(strategy)) {
      return { variant: 'invalidStrategy', message: `Invalid strategy "${strategy}". Valid: ${VALID_STRATEGIES.join(', ')}` };
    }

    // Default canary weight steps
    const weightSteps = [10, 25, 50, 100];

    const rolloutId = `ro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, rolloutId, {
      rollout: rolloutId,
      plan,
      strategy,
      steps: JSON.stringify(Array.isArray(steps) ? steps : [steps].filter(Boolean)),
      weightSteps: JSON.stringify(weightSteps),
      currentStep: 1,
      currentWeight: 0,
      status: 'active',
      startedAt: now,
      previousVersion: '',
      newVersion: '',
    });

    return { variant: 'ok', rollout: rolloutId };
  },

  async advance(input, storage) {
    const rollout = input.rollout as string;

    const record = await storage.get(RELATION, rollout);
    if (!record) {
      return { variant: 'paused', rollout, reason: 'Rollout not found' };
    }

    if (record.status === 'paused') {
      return { variant: 'paused', rollout, reason: 'Rollout is paused' };
    }

    const weightSteps: number[] = JSON.parse(record.weightSteps as string || '[10,25,50,100]');
    const currentStep = (record.currentStep as number) + 1;
    const stepIndex = currentStep - 1;

    if (stepIndex >= weightSteps.length) {
      await storage.put(RELATION, rollout, {
        ...record,
        currentStep,
        currentWeight: 100,
        status: 'complete',
      });
      return { variant: 'complete', rollout };
    }

    const newWeight = weightSteps[stepIndex];

    await storage.put(RELATION, rollout, {
      ...record,
      currentStep,
      currentWeight: newWeight,
    });

    return { variant: 'ok', rollout, newWeight, step: currentStep };
  },

  async pause(input, storage) {
    const rollout = input.rollout as string;
    const reason = input.reason as string;

    const record = await storage.get(RELATION, rollout);
    if (record) {
      await storage.put(RELATION, rollout, {
        ...record,
        status: 'paused',
        pauseReason: reason,
      });
    }

    return { variant: 'ok', rollout };
  },

  async resume(input, storage) {
    const rollout = input.rollout as string;

    const record = await storage.get(RELATION, rollout);
    if (record) {
      await storage.put(RELATION, rollout, {
        ...record,
        status: 'active',
        pauseReason: '',
      });
    }

    const currentWeight = record ? (record.currentWeight as number) : 0;
    return { variant: 'ok', rollout, currentWeight };
  },

  async abort(input, storage) {
    const rollout = input.rollout as string;

    const record = await storage.get(RELATION, rollout);
    if (!record) {
      return { variant: 'ok', rollout };
    }

    if (record.status === 'complete') {
      return { variant: 'alreadyComplete', rollout };
    }

    await storage.put(RELATION, rollout, {
      ...record,
      status: 'aborted',
      currentWeight: 0,
    });

    return { variant: 'ok', rollout };
  },

  async status(input, storage) {
    const rollout = input.rollout as string;

    const record = await storage.get(RELATION, rollout);
    const step = record ? (record.currentStep as number) : 0;
    const weight = record ? (record.currentWeight as number) : 0;
    const status = record ? (record.status as string) : 'unknown';
    const startedAt = record ? (record.startedAt as string) : new Date().toISOString();
    const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);

    return { variant: 'ok', rollout, step, weight, status, elapsed };
  },
};
