// @clef-handler style=functional
// ============================================================
// SemanticEvaluator Handler
//
// Assess contextual meaning, readability, and intent alignment
// of code using LLM-based evaluation. Detect semantic issues
// invisible to static analysis: misleading names, logic that
// does not match docstrings, architectural intent violations in
// AI-generated code. Providers perform LLM inference.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `eval-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

// Configuration stored in-memory (persisted via storage for real deployments)
let defaultConfig = {
  defaultPersona: 'senior' as string | null,
  promptTemplate: null as string | null,
  confidenceThreshold: 0.7,
};

const VALID_PERSONAS = ['junior', 'senior', 'security', 'performance', 'architect'];

const ISSUE_TYPES = [
  'misleading-name',
  'intent-mismatch',
  'missing-error-handling',
  'unnecessary-complexity',
  'documentation-drift',
  'hallucinated-feature',
];

// Simulated LLM evaluation (provider-backed in production)
function simulateEvaluation(
  target: string,
  intentDescription: string | null,
  persona: string,
): {
  overallRating: number;
  readabilityScore: number;
  intentAligned: boolean;
  rationale: string;
  issues: Array<{
    location: string;
    issueType: string;
    description: string;
    severity: string;
    suggestion: string | null;
  }>;
} {
  // Deterministic simulation based on target hash for testability
  const hash = target.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rating = 5.0 + (hash % 50) / 10;
  const readability = 4.0 + (hash % 60) / 10;
  const aligned = rating >= 6.0;

  const issues: Array<{
    location: string;
    issueType: string;
    description: string;
    severity: string;
    suggestion: string | null;
  }> = [];

  // Generate issues based on target characteristics
  if (rating < 7.0) {
    issues.push({
      location: `${target}:1`,
      issueType: 'misleading-name',
      description: `Variable naming could be more descriptive in ${target}`,
      severity: 'warning',
      suggestion: 'Use more descriptive variable names',
    });
  }

  if (intentDescription && !aligned) {
    issues.push({
      location: `${target}:10`,
      issueType: 'intent-mismatch',
      description: `Implementation may not fully match: "${intentDescription}"`,
      severity: 'error',
      suggestion: 'Review implementation against specification',
    });
  }

  if (persona === 'security') {
    issues.push({
      location: `${target}:5`,
      issueType: 'missing-error-handling',
      description: 'Missing input validation or sanitization',
      severity: 'warning',
      suggestion: 'Add input validation before processing',
    });
  }

  return {
    overallRating: Math.round(rating * 10) / 10,
    readabilityScore: Math.round(readability * 10) / 10,
    intentAligned: aligned,
    rationale: `${persona} review of ${target}: rating ${Math.round(rating * 10) / 10}/10`,
    issues,
  };
}

const _semanticEvaluatorHandler: FunctionalConceptHandler = {

  // ── assess ───────────────────────────────────────────────────
  assess(input: Record<string, unknown>) {
    const target = input.target as string;
    const intentDescription = (input.intentDescription as string) ?? null;
    const persona = (input.persona as string) ?? defaultConfig.defaultPersona ?? 'senior';

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'targetNotFound', { target: '' });
    }

    // Validate persona if explicitly provided
    if (input.persona && !VALID_PERSONAS.includes(persona)) {
      return complete(createProgram(), 'providerUnavailable', {
        message: `Unknown persona "${persona}". Valid: ${VALID_PERSONAS.join(', ')}`,
      });
    }

    // Simulate evaluation (provider-backed in production)
    const result = simulateEvaluation(target, intentDescription, persona);

    // Filter by confidence threshold
    if (result.overallRating / 10 < defaultConfig.confidenceThreshold * 0.5) {
      return complete(createProgram(), 'providerUnavailable', {
        message: 'Assessment confidence below threshold',
      });
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'evaluation', id, {
      id,
      evaluationId: id,
      target,
      intentDescription,
      persona,
      evaluatedAt: new Date().toISOString(),
      overallRating: result.overallRating,
      intentAligned: result.intentAligned,
      readabilityScore: result.readabilityScore,
      rationale: result.rationale,
      issues: result.issues,
    });

    return complete(p, 'ok', {
      evaluation: id,
      overallRating: result.overallRating,
      issues: result.issues.map(i => ({
        location: i.location,
        issueType: i.issueType,
        description: i.description,
        severity: i.severity,
      })),
    });
  },

  // ── assessBatch ──────────────────────────────────────────────
  assessBatch(input: Record<string, unknown>) {
    const targets = input.targets as Array<{ target: string; intentDescription?: string | null }>;
    const persona = (input.persona as string) ?? defaultConfig.defaultPersona ?? 'senior';

    if (!targets || !Array.isArray(targets)) {
      return complete(createProgram(), 'ok', { results: [] });
    }

    let p = createProgram();
    const results: Array<{
      target: string;
      overallRating: number;
      issueCount: number;
      intentAligned: boolean;
    }> = [];

    for (const entry of targets) {
      const t = entry.target;
      const intent = entry.intentDescription ?? null;
      const evalResult = simulateEvaluation(t, intent, persona);

      const id = nextId();
      p = put(p, 'evaluation', id, {
        id,
        evaluationId: id,
        target: t,
        intentDescription: intent,
        persona,
        evaluatedAt: new Date().toISOString(),
        overallRating: evalResult.overallRating,
        intentAligned: evalResult.intentAligned,
        readabilityScore: evalResult.readabilityScore,
        rationale: evalResult.rationale,
        issues: evalResult.issues,
      });

      results.push({
        target: t,
        overallRating: evalResult.overallRating,
        issueCount: evalResult.issues.length,
        intentAligned: evalResult.intentAligned,
      });
    }

    return complete(p, 'ok', { results });
  },

  // ── configure ────────────────────────────────────────────────
  configure(input: Record<string, unknown>) {
    const newPersona = input.defaultPersona as string | null | undefined;
    const newTemplate = input.promptTemplate as string | null | undefined;
    const newThreshold = input.confidenceThreshold as number | null | undefined;

    if (newPersona !== undefined && newPersona !== null) {
      defaultConfig.defaultPersona = newPersona;
    }
    if (newTemplate !== undefined && newTemplate !== null) {
      defaultConfig.promptTemplate = newTemplate;
    }
    if (newThreshold !== undefined && newThreshold !== null) {
      if (newThreshold < 0 || newThreshold > 1) {
        return complete(createProgram(), 'ok', {});
      }
      defaultConfig.confidenceThreshold = newThreshold;
    }

    let p = createProgram();
    p = put(p, 'config', 'default', { ...defaultConfig });
    return complete(p, 'ok', {});
  },

  // ── compare ──────────────────────────────────────────────────
  compare(input: Record<string, unknown>) {
    const target = input.target as string;
    const beforeVersion = input.beforeVersion as string;
    const afterVersion = input.afterVersion as string;

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'targetNotFound', { target: '' });
    }

    const persona = defaultConfig.defaultPersona ?? 'senior';

    // Simulate before/after evaluations
    const beforeResult = simulateEvaluation(
      `${target}@${beforeVersion}`,
      null,
      persona,
    );
    const afterResult = simulateEvaluation(
      `${target}@${afterVersion}`,
      null,
      persona,
    );

    const ratingDelta = Math.round((afterResult.overallRating - beforeResult.overallRating) * 10) / 10;

    // Find new issues (in after but not in before)
    const beforeIssueKeys = new Set(
      beforeResult.issues.map(i => `${i.location}:${i.issueType}`),
    );
    const afterIssueKeys = new Set(
      afterResult.issues.map(i => `${i.location}:${i.issueType}`),
    );

    const newIssues = afterResult.issues
      .filter(i => !beforeIssueKeys.has(`${i.location}:${i.issueType}`))
      .map(i => ({
        location: i.location,
        issueType: i.issueType,
        description: i.description,
      }));

    const resolvedIssues = beforeResult.issues
      .filter(i => !afterIssueKeys.has(`${i.location}:${i.issueType}`))
      .map(i => `${i.location}:${i.issueType}`);

    const id = nextId();
    let p = createProgram();
    p = put(p, 'evaluation', id, {
      id,
      evaluationId: id,
      target,
      intentDescription: null,
      persona,
      evaluatedAt: new Date().toISOString(),
      overallRating: afterResult.overallRating,
      intentAligned: afterResult.intentAligned,
      readabilityScore: afterResult.readabilityScore,
      rationale: `Comparison of ${target}: ${beforeVersion} -> ${afterVersion}`,
      issues: afterResult.issues,
      beforeVersion,
      afterVersion,
    });

    return complete(p, 'ok', {
      evaluation: id,
      ratingDelta,
      newIssues,
      resolvedIssues,
    });
  },

  // ── query ────────────────────────────────────────────────────
  query(input: Record<string, unknown>) {
    const targets = (input.targets as string[]) ?? null;
    const minRating = (input.minRating as number) ?? null;

    let p = createProgram();
    p = find(p, 'evaluation', {}, 'allEvaluations');

    p = mapBindings(p, (bindings) => {
      let evaluations = (bindings.allEvaluations as Record<string, unknown>[]) || [];

      // Filter by targets
      if (targets && targets.length > 0) {
        evaluations = evaluations.filter(e => targets.includes(e.target as string));
      }

      // Filter by minimum rating
      if (minRating !== null) {
        evaluations = evaluations.filter(e => (e.overallRating as number) >= minRating);
      }

      return evaluations.map(e => ({
        evaluationId: e.evaluationId as string,
        target: e.target as string,
        overallRating: e.overallRating as number,
        intentAligned: e.intentAligned as boolean,
        issueCount: ((e.issues as unknown[]) || []).length,
        evaluatedAt: e.evaluatedAt as string,
      }));
    }, '_results');

    return completeFrom(p, 'ok', (bindings) => ({
      evaluations: bindings._results as unknown[],
    }));
  },
};

export const semanticEvaluatorHandler = autoInterpret(_semanticEvaluatorHandler);

export function resetSemanticEvaluatorCounter(): void {
  idCounter = 0;
  defaultConfig = {
    defaultPersona: 'senior',
    promptTemplate: null,
    confidenceThreshold: 0.7,
  };
}
