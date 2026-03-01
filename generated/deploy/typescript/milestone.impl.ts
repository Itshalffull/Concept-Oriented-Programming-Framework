// Milestone Concept Implementation
// Track achievement of significant process goals declaratively,
// without prescribing which specific steps cause achievement.
import type { ConceptStorage } from "@clef/runtime";
import type { MilestoneHandler } from "./milestone.handler";

const RELATION = "milestone";

let milestoneCounter = 0;
function nextMilestoneId(): string {
  milestoneCounter += 1;
  return `ms-${Date.now()}-${String(milestoneCounter).padStart(4, "0")}`;
}

/**
 * Evaluate a simple condition expression against a context object.
 * Supports expressions like:
 *   - "field == value" (equality check)
 *   - "field > number" (numeric comparison)
 *   - "field >= number"
 *   - "field exists" (presence check)
 *   - "true" (always true, for testing)
 *   - "false" (always false, for testing)
 */
function evaluateCondition(conditionExpr: string, context: Record<string, any>): boolean {
  const trimmed = conditionExpr.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // "field exists" pattern
  const existsMatch = trimmed.match(/^(\w+)\s+exists$/);
  if (existsMatch) {
    return existsMatch[1] in context;
  }

  // "field >= number" pattern
  const gteMatch = trimmed.match(/^(\w+)\s*>=\s*(.+)$/);
  if (gteMatch) {
    const fieldVal = context[gteMatch[1]];
    const threshold = parseFloat(gteMatch[2]);
    return typeof fieldVal === "number" && fieldVal >= threshold;
  }

  // "field > number" pattern
  const gtMatch = trimmed.match(/^(\w+)\s*>\s*(.+)$/);
  if (gtMatch) {
    const fieldVal = context[gtMatch[1]];
    const threshold = parseFloat(gtMatch[2]);
    return typeof fieldVal === "number" && fieldVal > threshold;
  }

  // "field == value" pattern
  const eqMatch = trimmed.match(/^(\w+)\s*==\s*(.+)$/);
  if (eqMatch) {
    const fieldVal = context[eqMatch[1]];
    const expected = eqMatch[2].trim();
    // Try numeric comparison first
    const num = parseFloat(expected);
    if (!isNaN(num) && typeof fieldVal === "number") {
      return fieldVal === num;
    }
    // String comparison (strip quotes if present)
    const stripped = expected.replace(/^["']|["']$/g, "");
    return String(fieldVal) === stripped;
  }

  return false;
}

export const milestoneHandler: MilestoneHandler = {
  async define(input, storage) {
    const { runRef, name, conditionExpr } = input;

    const milestoneId = nextMilestoneId();

    await storage.put(RELATION, milestoneId, {
      milestone: milestoneId,
      runRef,
      name,
      conditionExpr,
      status: "pending",
      achievedAt: "",
    });

    return { variant: "ok", milestone: milestoneId };
  },

  async evaluate(input, storage) {
    const { milestone, context } = input;

    const record = await storage.get(RELATION, milestone);
    if (!record) {
      return { variant: "notYet", milestone };
    }

    const status = record.status as string;
    if (status === "achieved") {
      return { variant: "alreadyAchieved", milestone };
    }

    const conditionExpr = record.conditionExpr as string;

    // Parse context as JSON
    let contextObj: Record<string, any> = {};
    try {
      contextObj = JSON.parse(context);
    } catch {
      // If context is not valid JSON, condition cannot be evaluated
      return { variant: "notYet", milestone };
    }

    const result = evaluateCondition(conditionExpr, contextObj);

    if (result) {
      const now = new Date().toISOString();
      await storage.put(RELATION, milestone, {
        ...record,
        status: "achieved",
        achievedAt: now,
      });

      return {
        variant: "achieved",
        milestone,
        name: record.name as string,
        runRef: record.runRef as string,
      };
    }

    return { variant: "notYet", milestone };
  },

  async revoke(input, storage) {
    const { milestone } = input;

    const record = await storage.get(RELATION, milestone);
    if (record) {
      await storage.put(RELATION, milestone, {
        ...record,
        status: "pending",
        achievedAt: "",
      });
    }

    return { variant: "ok", milestone };
  },
};
