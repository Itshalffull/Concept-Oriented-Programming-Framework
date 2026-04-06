/**
 * E2EEProvider — query execution provider for encrypted-local data sources.
 *
 * Handles the backend leg of the E2EE execution pipeline (Section 6 of
 * view-query-three-tier-execution.md). This provider:
 *
 *   1. Accepts only `scan` instructions — capabilities = ["scan"]
 *   2. Executes the scan instruction to fetch ciphertext blobs from the kernel
 *   3. Returns ciphertext rows as-is — the decrypt step is handled by the
 *      sync chain (ExecuteSplitQueryE2EEDecrypt), NOT by this provider
 *
 * The security invariant enforced by this provider:
 *   - No filter predicates are sent to the backend
 *   - No key material is sent to the backend
 *   - planPushdown places every non-scan instruction into the residual
 *
 * E2EE execution flow (execute-split-query.sync):
 *   Step 1: ExecuteSplitQueryBackend → QueryExecution/execute(kind="e2ee")
 *           → e2eeProvider.execute → ciphertext rows returned
 *   Step 2b: ExecuteSplitQueryE2EEDecrypt → E2EEProvider/decrypt
 *           → plaintext rows
 *   Step 2c: ExecuteSplitQueryResidualE2EE → QueryExecution/execute(kind="in-memory", data=plaintextRows)
 *           → filtered/sorted/projected result
 *
 * The decrypt step is NOT a QueryProgram instruction — it sits outside the
 * program language between the two QueryExecution/execute calls. This keeps
 * QueryProgram pure and provider-agnostic (Section 6 of
 * view-query-split-execution-flow.md).
 *
 * Export shape mirrors kernel/in-memory providers:
 *   { name, kind, capabilities, execute, planPushdown }
 *
 * See architecture doc Section 16.12 and view-query-three-tier-execution.md
 * Sections 2.3, 6 for the full E2EE design.
 */

// ─── QueryProgram wire types ──────────────────────────────────────────────────

export type Instruction =
  | { type: 'scan'; source: string; bindAs?: string }
  | { type: 'filter'; node: unknown; bindAs?: string }
  | { type: 'sort'; keys: unknown[]; bindAs?: string }
  | { type: 'group'; keys?: string[]; config?: Record<string, unknown>; bindAs?: string }
  | { type: 'project'; fields: string[]; bindAs?: string }
  | { type: 'limit'; count: number; output?: string }
  | { type: string; [key: string]: unknown };

export interface QueryProgram {
  instructions: Instruction[];
}

// ─── Execution result ─────────────────────────────────────────────────────────

export interface ExecuteResult {
  variant: 'ok' | 'error';
  /** Ciphertext blob rows. Caller is responsible for decryption before filtering. */
  rows?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  message?: string;
}

// ─── Pushdown plan ────────────────────────────────────────────────────────────

export interface PushdownPlan {
  /** The pushdown partition — scan instructions only for this provider. */
  pushdown: QueryProgram;
  /** The residual partition — everything that is not a scan instruction. */
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

// ─── Provider implementation ──────────────────────────────────────────────────

/**
 * Execute a serialized QueryProgram for an encrypted-local data source.
 *
 * For the E2EE tier, execution is intentionally minimal:
 *   - Scan instructions: record the scan source in metadata; the rows
 *     argument carries any pre-fetched ciphertext blobs passed by the caller.
 *   - All other instruction types: ignored (they belong in the residual program
 *     and will be evaluated by the in-memory provider after decryption).
 *
 * The caller (execute-split-query.sync) is responsible for:
 *   1. Passing ciphertext rows obtained from the kernel concept action
 *   2. Routing those rows through E2EEProvider/decrypt before running
 *      the residual program via the in-memory provider
 *
 * If `rows` is not provided, execution starts with an empty set and the
 * scan source is recorded in metadata for the caller to use.
 */
export function execute(
  programJson: string,
  rows: Record<string, unknown>[] = [],
): ExecuteResult {
  const program = parseProgram(programJson);
  if (program === null) {
    return {
      variant: 'error',
      message: 'program could not be parsed as a QueryProgram',
    };
  }

  const instructions = program.instructions;

  // Empty program — return rows (ciphertext blobs) unchanged
  if (instructions.length === 0) {
    return {
      variant: 'ok',
      rows,
      metadata: { instructionsApplied: 0, tier: 'e2ee' },
    };
  }

  let scanSource: string | undefined;
  let instructionsApplied = 0;

  for (const instruction of instructions) {
    if (instruction.type === 'scan') {
      // Record the scan source so the caller can invoke the kernel concept action.
      // Non-scan instructions are silently ignored — they are residual work for
      // the in-memory provider after client-side decryption.
      scanSource = instruction.source;
      instructionsApplied++;
    }
    // All other instruction types are intentionally not processed here.
    // capabilities = ["scan"] means the split-execution compiler only puts
    // scan instructions in the backend program for E2EE views; anything else
    // that arrives here is a misconfiguration but should not throw.
  }

  const metadata: Record<string, unknown> = {
    instructionsApplied,
    tier: 'e2ee',
  };
  if (scanSource !== undefined) {
    metadata.scanSource = scanSource;
  }

  // Return the rows passed by the caller. For E2EE views these are ciphertext
  // blobs fetched from the kernel concept action. The sync chain
  // (ExecuteSplitQueryE2EEDecrypt) will decrypt them before the residual runs.
  return { variant: 'ok', rows, metadata };
}

/**
 * Split a QueryProgram into pushdown and residual partitions for E2EE sources.
 *
 * E2EE capability contract: only "scan" instructions are pushed down to the
 * backend. Every other instruction type (filter, sort, group, project, limit,
 * join) is placed in the residual — they run locally via the in-memory provider
 * after client-side decryption.
 *
 * This is a hard security constraint (Section 9 / view-query-three-tier-execution.md):
 * no predicate information is sent to the backend, regardless of filter sourceType.
 * Even system and contextual filters are residual for E2EE views.
 */
export function planPushdown(programJson: string): PushdownPlan | null {
  const program = parseProgram(programJson);
  if (program === null) return null;

  const pushdownInstructions: Instruction[] = [];
  const residualInstructions: Instruction[] = [];

  for (const instruction of program.instructions) {
    if (instruction.type === 'scan') {
      pushdownInstructions.push(instruction);
    } else {
      // All non-scan instructions are residual for E2EE — this is not
      // configurable. Filter/sort/group/project must run locally after decrypt.
      residualInstructions.push(instruction);
    }
  }

  return {
    pushdown: { instructions: pushdownInstructions },
    residual: { instructions: residualInstructions },
  };
}

// ─── Provider export ──────────────────────────────────────────────────────────

export const e2eeProvider = {
  name: 'e2ee-local',
  kind: 'e2ee',
  /**
   * scan = fetch ciphertext blob array from the kernel concept action.
   * All other query operations (filter, sort, group, project, limit) run
   * in-memory after client-side decryption by E2EEProvider/decrypt.
   */
  capabilities: ['scan'] as const,
  execute,
  planPushdown,
} as const;

export default e2eeProvider;
