// generated: escalation.types.ts

export interface EscalationEscalateInput {
  source_ref: string;
  run_ref: string;
  trigger_type: string;
  reason: string;
  level: number;
}

export type EscalationEscalateOutput =
  { variant: "ok"; escalation: string; source_ref: string };

export interface EscalationAcceptInput {
  escalation: string;
  acceptor: string;
}

export type EscalationAcceptOutput =
  | { variant: "ok"; escalation: string }
  | { variant: "not_escalated"; escalation: string };

export interface EscalationResolveInput {
  escalation: string;
  resolution: string;
}

export type EscalationResolveOutput =
  | { variant: "ok"; escalation: string; source_ref: string; resolution: string }
  | { variant: "not_accepted"; escalation: string };

export interface EscalationReEscalateInput {
  escalation: string;
  new_level: number;
  reason: string;
}

export type EscalationReEscalateOutput =
  { variant: "ok"; escalation: string };
