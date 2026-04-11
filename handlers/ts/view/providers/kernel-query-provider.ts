/**
 * KernelQueryProvider — default in-process execution provider for QueryExecution.
 *
 * Wraps the ViewRenderer's existing in-memory filter/sort/limit behavior as a
 * formal execution provider conforming to the execute/planPushdown interface
 * declared in query-execution.concept.
 *
 * Capabilities: ["scan", "filter", "sort", "limit", "join", "offset"]
 *
 * execute(program):
 *   Parses a serialized QueryProgram (JSON with `instructions` array).
 *   - "scan"   — returns the source config; the caller is responsible for
 *                fetching rows via the concept action named in source.
 *   - "filter" — applies evaluateFilterNode in-memory using the FilterNode
 *                tree stored in the instruction's `node` field.
 *   - "sort"   — applies applySortKeys in-memory using the SortKey array
 *                stored in the instruction's `keys` field.
 *   - "group", "project" — passed through as-is (in-memory stubs).
 *   - "limit"  — truncates the row set to at most `count` records.
 *
 * planPushdown(program, capabilities):
 *   Partitions instructions into:
 *   - pushdown  — scan, filter (system/contextual), sort, limit, join
 *   - residual  — group, project, and interactive/search filters
 *                 (evaluated in-memory by the in-memory provider).
 *
 * See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.
 */

import { evaluateFilterNode, applySortKeys } from '../../../../clef-base/lib/filter-evaluator.ts';
import type { FilterNode, SortKey } from '../../../../clef-base/lib/filter-evaluator.ts';

// ─── QueryProgram wire types ──────────────────────────────────────────────────

export type Instruction =
  | { type: 'scan'; source: string; bindAs?: string }
  | { type: 'filter'; node: FilterNode; bindAs?: string }
  | { type: 'sort'; keys: SortKey[]; bindAs?: string }
  | { type: 'group'; keys: string[]; config?: Record<string, unknown>; bindAs?: string }
  | { type: 'project'; fields: string[]; bindAs?: string }
  | { type: 'limit'; count: number; output?: string }
  | { type: 'offset'; count: number; bindAs?: string };

export interface QueryProgram {
  instructions: Instruction[];
}

// ─── Execution result ─────────────────────────────────────────────────────────

export interface ExecuteResult {
  variant: 'ok' | 'error';
  rows?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  message?: string;
}

// ─── Pushdown plan ────────────────────────────────────────────────────────────

export interface PushdownPlan {
  pushdown: QueryProgram;
  residual: QueryProgram;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parse a serialized QueryProgram JSON string.
 * Returns null on parse failure or if the result has no `instructions` array.
 */
function parseProgram(programJson: string): QueryProgram | null {
  if (!programJson || programJson.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(programJson);
  } catch {
    return null;
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as Record<string, unknown>).instructions)
  ) {
    return null;
  }
  return parsed as QueryProgram;
}

/**
 * Apply a single instruction to the current row set.
 * Returns the transformed row set, or null if execution should short-circuit
 * (e.g., scan instruction encountered — caller must handle scan separately).
 */
function applyInstruction(
  instruction: Instruction,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] | null {
  switch (instruction.type) {
    case 'scan':
      // Scan is handled by the caller (concept action fetch); return rows unchanged
      return rows;

    case 'filter': {
      const node = instruction.node;
      return rows.filter(row => evaluateFilterNode(node, row));
    }

    case 'sort': {
      const keys = instruction.keys;
      if (!Array.isArray(keys) || keys.length === 0) return rows;
      return applySortKeys(rows, keys);
    }

    case 'group':
      // In-memory group stub — return rows unchanged
      // Full aggregation support is out of scope for the kernel provider
      return rows;

    case 'project': {
      const fields = instruction.fields;
      if (!Array.isArray(fields) || fields.length === 0) return rows;
      return rows.map(row => {
        const projected: Record<string, unknown> = {};
        for (const field of fields) {
          if (Object.prototype.hasOwnProperty.call(row, field)) {
            projected[field] = row[field];
          }
        }
        return projected;
      });
    }

    case 'limit': {
      const count = instruction.count;
      if (typeof count !== 'number' || count < 0) return rows;
      return rows.slice(0, count);
    }

    case 'offset': {
      const count = instruction.count;
      if (typeof count !== 'number' || count < 0) return rows;
      return rows.slice(count);
    }

    default:
      return rows;
  }
}

// ─── Provider implementation ──────────────────────────────────────────────────

/**
 * Execute a serialized QueryProgram against an optional initial row set.
 *
 * For scan instructions, the provider returns the source config so the caller
 * can invoke the appropriate concept action. All other instructions run
 * in-memory using the pure functions from filter-evaluator.
 *
 * If rows is not provided (undefined), execution starts with an empty set and
 * the first scan instruction's source is recorded in metadata.
 */
export function execute(
  programJson: string,
  rows: Record<string, unknown>[] = [],
): ExecuteResult {
  const program = parseProgram(programJson);
  if (program === null) {
    return { variant: 'error', message: 'program could not be parsed as a QueryProgram' };
  }

  const instructions = program.instructions;

  // Empty program — return rows unchanged
  if (instructions.length === 0) {
    return {
      variant: 'ok',
      rows,
      metadata: { instructionsApplied: 0 },
    };
  }

  let current = rows;
  let instructionsApplied = 0;
  let scanSource: string | undefined;

  for (const instruction of instructions) {
    if (instruction.type === 'scan') {
      // Record the scan source in metadata; rows come from the caller
      scanSource = instruction.source;
      instructionsApplied++;
      continue;
    }

    const next = applyInstruction(instruction, current);
    if (next !== null) {
      current = next;
      instructionsApplied++;
    }
  }

  const metadata: Record<string, unknown> = { instructionsApplied };
  if (scanSource !== undefined) {
    metadata.scanSource = scanSource;
  }

  return { variant: 'ok', rows: current, metadata };
}

/**
 * Split a QueryProgram into pushdown and residual partitions based on the
 * kernel provider's declared capabilities: ["scan", "filter", "sort", "limit", "join"].
 *
 * Pushdown receives: scan, filter (system/contextual), sort, limit, join.
 * Residual receives: group, project, and any instructions not in the capability set.
 *
 * Note: the caller is responsible for ensuring only system/contextual filter
 * instructions are passed for pushdown. Interactive and search filters should
 * be routed to the residual program by compile-split-query.sync before
 * planPushdown is called (see architecture doc Section 5.1).
 */
const KERNEL_CAPABILITIES = new Set<string>(['scan', 'filter', 'sort', 'limit', 'join', 'offset']);

export function planPushdown(programJson: string): PushdownPlan | null {
  const program = parseProgram(programJson);
  if (program === null) return null;

  const pushdownInstructions: Instruction[] = [];
  const residualInstructions: Instruction[] = [];

  for (const instruction of program.instructions) {
    if (KERNEL_CAPABILITIES.has(instruction.type)) {
      pushdownInstructions.push(instruction);
    } else {
      residualInstructions.push(instruction);
    }
  }

  return {
    pushdown: { instructions: pushdownInstructions },
    residual: { instructions: residualInstructions },
  };
}

// ─── Provider export ──────────────────────────────────────────────────────────

export const kernelQueryProvider = {
  name: 'default-kernel',
  kind: 'kernel',
  capabilities: ['scan', 'filter', 'sort', 'limit', 'join', 'offset'] as const,
  execute,
  planPushdown,
} as const;

export default kernelQueryProvider;
