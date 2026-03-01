// generated: approval.impl.ts
import type { ConceptStorage } from "@clef/runtime";
import type { ApprovalHandler } from "./approval.handler";
import type { ApprovalDecision } from "./approval.types";

async function nextId(storage: ConceptStorage): Promise<string> {
  const counter = await storage.get("_idCounter", "_approval");
  const next = counter ? (counter.value as number) + 1 : 1;
  await storage.put("_idCounter", "_approval", { value: next });
  return `appr-${String(next).padStart(6, "0")}`;
}

const RESOLVED_STATUSES = new Set(["approved", "denied", "timed_out", "changes_requested"]);

function isResolved(status: string): boolean {
  return RESOLVED_STATUSES.has(status);
}

function parseRoles(rolesJson: string): string[] {
  try {
    return JSON.parse(rolesJson);
  } catch {
    return [];
  }
}

function parseDecisions(decisionsJson: string): ApprovalDecision[] {
  try {
    return JSON.parse(decisionsJson);
  } catch {
    return [];
  }
}

/**
 * Determine if the approval threshold is met based on policy.
 * - one_of: at least 1 approve decision
 * - all_of: all required_count approvals met
 * - n_of_m: at least required_count approvals met
 */
function isThresholdMet(
  decisions: ApprovalDecision[],
  policyKind: string,
  requiredCount: number,
): boolean {
  const approveCount = decisions.filter(d => d.decision === "approve").length;

  switch (policyKind) {
    case "one_of":
      return approveCount >= 1;
    case "all_of":
      return approveCount >= requiredCount;
    case "n_of_m":
      return approveCount >= requiredCount;
    default:
      return approveCount >= requiredCount;
  }
}

export const approvalHandler: ApprovalHandler = {
  async request(input, storage) {
    const approval = await nextId(storage);
    const now = new Date().toISOString();

    await storage.put("approval", approval, {
      id: approval,
      step_ref: input.step_ref,
      status: "pending",
      policy_kind: input.policy_kind,
      required_count: input.required_count,
      roles: input.roles,
      decisions: JSON.stringify([]),
      requested_at: now,
      resolved_at: null,
    });

    return { variant: "ok", approval, step_ref: input.step_ref };
  },

  async approve(input, storage) {
    const record = await storage.get("approval", input.approval);
    if (!record) {
      return { variant: "already_resolved", approval: input.approval };
    }

    if (isResolved(record.status as string)) {
      return { variant: "already_resolved", approval: input.approval };
    }

    // Authorization check: actor must have an authorized role
    const roles = parseRoles(record.roles as string);
    if (roles.length > 0 && !roles.includes(input.actor)) {
      return { variant: "not_authorized", actor: input.actor };
    }

    const now = new Date().toISOString();
    const decisions = parseDecisions(record.decisions as string);
    decisions.push({
      actor: input.actor,
      decision: "approve",
      comment: input.comment,
      decided_at: now,
    });

    const policyKind = record.policy_kind as string;
    const requiredCount = record.required_count as number;

    if (isThresholdMet(decisions, policyKind, requiredCount)) {
      await storage.put("approval", input.approval, {
        ...record,
        status: "approved",
        decisions: JSON.stringify(decisions),
        resolved_at: now,
      });

      return {
        variant: "ok",
        approval: input.approval,
        step_ref: record.step_ref as string,
      };
    }

    // Threshold not yet met - remain pending
    await storage.put("approval", input.approval, {
      ...record,
      decisions: JSON.stringify(decisions),
    });

    return {
      variant: "pending",
      approval: input.approval,
      decisions_so_far: decisions.filter(d => d.decision === "approve").length,
      required: requiredCount,
    };
  },

  async deny(input, storage) {
    const record = await storage.get("approval", input.approval);
    if (!record) {
      return { variant: "already_resolved", approval: input.approval };
    }

    if (isResolved(record.status as string)) {
      return { variant: "already_resolved", approval: input.approval };
    }

    const roles = parseRoles(record.roles as string);
    if (roles.length > 0 && !roles.includes(input.actor)) {
      return { variant: "not_authorized", actor: input.actor };
    }

    const now = new Date().toISOString();
    const decisions = parseDecisions(record.decisions as string);
    decisions.push({
      actor: input.actor,
      decision: "deny",
      comment: input.reason,
      decided_at: now,
    });

    await storage.put("approval", input.approval, {
      ...record,
      status: "denied",
      decisions: JSON.stringify(decisions),
      resolved_at: now,
    });

    return {
      variant: "ok",
      approval: input.approval,
      step_ref: record.step_ref as string,
      reason: input.reason,
    };
  },

  async requestChanges(input, storage) {
    const record = await storage.get("approval", input.approval);
    if (!record) {
      return { variant: "already_resolved", approval: input.approval };
    }

    if (isResolved(record.status as string)) {
      return { variant: "already_resolved", approval: input.approval };
    }

    const now = new Date().toISOString();
    const decisions = parseDecisions(record.decisions as string);
    decisions.push({
      actor: input.actor,
      decision: "request_changes",
      comment: input.feedback,
      decided_at: now,
    });

    await storage.put("approval", input.approval, {
      ...record,
      status: "changes_requested",
      decisions: JSON.stringify(decisions),
      resolved_at: now,
    });

    return {
      variant: "ok",
      approval: input.approval,
      step_ref: record.step_ref as string,
      feedback: input.feedback,
    };
  },

  async timeout(input, storage) {
    const record = await storage.get("approval", input.approval);
    if (!record) {
      return { variant: "already_resolved", approval: input.approval };
    }

    if (isResolved(record.status as string)) {
      return { variant: "already_resolved", approval: input.approval };
    }

    const now = new Date().toISOString();
    await storage.put("approval", input.approval, {
      ...record,
      status: "timed_out",
      resolved_at: now,
    });

    return {
      variant: "ok",
      approval: input.approval,
      step_ref: record.step_ref as string,
    };
  },

  async getStatus(input, storage) {
    const record = await storage.get("approval", input.approval);
    if (!record) {
      return { variant: "not_found", approval: input.approval };
    }

    return {
      variant: "ok",
      approval: input.approval,
      status: record.status as string,
      decisions: record.decisions as string,
    };
  },
};
