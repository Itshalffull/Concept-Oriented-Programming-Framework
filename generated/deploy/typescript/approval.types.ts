// generated: approval.types.ts

export interface ApprovalDecision {
  actor: string;
  decision: string;
  comment: string | null;
  decided_at: string;
}

export interface ApprovalRequestInput {
  step_ref: string;
  policy_kind: string;
  required_count: number;
  roles: string;
}

export type ApprovalRequestOutput =
  { variant: "ok"; approval: string; step_ref: string };

export interface ApprovalApproveInput {
  approval: string;
  actor: string;
  comment: string;
}

export type ApprovalApproveOutput =
  | { variant: "ok"; approval: string; step_ref: string }
  | { variant: "already_resolved"; approval: string }
  | { variant: "not_authorized"; actor: string }
  | { variant: "pending"; approval: string; decisions_so_far: number; required: number };

export interface ApprovalDenyInput {
  approval: string;
  actor: string;
  reason: string;
}

export type ApprovalDenyOutput =
  | { variant: "ok"; approval: string; step_ref: string; reason: string }
  | { variant: "already_resolved"; approval: string }
  | { variant: "not_authorized"; actor: string };

export interface ApprovalRequestChangesInput {
  approval: string;
  actor: string;
  feedback: string;
}

export type ApprovalRequestChangesOutput =
  | { variant: "ok"; approval: string; step_ref: string; feedback: string }
  | { variant: "already_resolved"; approval: string };

export interface ApprovalTimeoutInput {
  approval: string;
}

export type ApprovalTimeoutOutput =
  | { variant: "ok"; approval: string; step_ref: string }
  | { variant: "already_resolved"; approval: string };

export interface ApprovalGetStatusInput {
  approval: string;
}

export type ApprovalGetStatusOutput =
  | { variant: "ok"; approval: string; status: string; decisions: string }
  | { variant: "not_found"; approval: string };
