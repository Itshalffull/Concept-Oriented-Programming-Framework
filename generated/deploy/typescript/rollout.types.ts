// generated: rollout.types.ts

export interface RolloutBeginInput {
  plan: string;
  strategy: string;
  steps: string[];
}

export type RolloutBeginOutput =
  { variant: "ok"; rollout: string }
  | { variant: "invalidStrategy"; message: string };

export interface RolloutAdvanceInput {
  rollout: string;
}

export type RolloutAdvanceOutput =
  { variant: "ok"; rollout: string; newWeight: number; step: number }
  | { variant: "complete"; rollout: string }
  | { variant: "paused"; rollout: string; reason: string };

export interface RolloutPauseInput {
  rollout: string;
  reason: string;
}

export type RolloutPauseOutput =
  { variant: "ok"; rollout: string };

export interface RolloutResumeInput {
  rollout: string;
}

export type RolloutResumeOutput =
  { variant: "ok"; rollout: string; currentWeight: number };

export interface RolloutAbortInput {
  rollout: string;
}

export type RolloutAbortOutput =
  { variant: "ok"; rollout: string }
  | { variant: "alreadyComplete"; rollout: string };

export interface RolloutStatusInput {
  rollout: string;
}

export type RolloutStatusOutput =
  { variant: "ok"; rollout: string; step: number; weight: number; status: string; elapsed: number };

