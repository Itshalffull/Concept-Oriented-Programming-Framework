// generated: workitem.types.ts

export interface WorkItemCreateInput {
  step_ref: string;
  candidate_pool: string;
  form_schema: string;
  priority: number;
}

export type WorkItemCreateOutput =
  { variant: "ok"; item: string; step_ref: string };

export interface WorkItemClaimInput {
  item: string;
  assignee: string;
}

export type WorkItemClaimOutput =
  | { variant: "ok"; item: string; assignee: string }
  | { variant: "not_offered"; item: string }
  | { variant: "not_authorized"; assignee: string };

export interface WorkItemStartInput {
  item: string;
}

export type WorkItemStartOutput =
  | { variant: "ok"; item: string }
  | { variant: "not_claimed"; item: string };

export interface WorkItemCompleteInput {
  item: string;
  form_data: string;
}

export type WorkItemCompleteOutput =
  | { variant: "ok"; item: string; step_ref: string; form_data: string }
  | { variant: "not_active"; item: string }
  | { variant: "validation_failed"; message: string };

export interface WorkItemRejectInput {
  item: string;
  reason: string;
}

export type WorkItemRejectOutput =
  | { variant: "ok"; item: string; step_ref: string; reason: string }
  | { variant: "not_active"; item: string };

export interface WorkItemDelegateInput {
  item: string;
  new_assignee: string;
}

export type WorkItemDelegateOutput =
  | { variant: "ok"; item: string; new_assignee: string }
  | { variant: "not_claimed"; item: string };

export interface WorkItemReleaseInput {
  item: string;
}

export type WorkItemReleaseOutput =
  | { variant: "ok"; item: string }
  | { variant: "not_claimed"; item: string };
