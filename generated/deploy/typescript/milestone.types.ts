// generated: milestone.types.ts

export interface MilestoneDefineInput {
  runRef: string;
  name: string;
  conditionExpr: string;
}

export type MilestoneDefineOutput =
  { variant: "ok"; milestone: string };

export interface MilestoneEvaluateInput {
  milestone: string;
  context: string;
}

export type MilestoneEvaluateOutput =
  | { variant: "achieved"; milestone: string; name: string; runRef: string }
  | { variant: "notYet"; milestone: string }
  | { variant: "alreadyAchieved"; milestone: string };

export interface MilestoneRevokeInput {
  milestone: string;
}

export type MilestoneRevokeOutput =
  { variant: "ok"; milestone: string };
