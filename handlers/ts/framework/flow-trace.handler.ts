// ============================================================
// FlowTrace Concept Implementation
//
// Walks ActionLog provenance edges from a flow root to build
// a FlowTrace tree. For each completion, checks the sync index
// for candidate syncs and marks unfired ones. Computes per-action
// timing from ActionLog timestamps.
//
// See Architecture doc Section 16.1 / 17.1.
// ============================================================

import type { ActionRecord, CompiledSync, ConceptAST, ConceptHandler, WhenPattern } from '../../../kernel/src/types.js';
import type { SyncIndex } from './engine.js';
import { ActionLog, indexKey } from './engine.js';

// --- FlowTrace Types ---

export interface FlowTrace {
  flowId: string;
  status: 'ok' | 'failed' | 'partial';
  durationMs: number;
  root: TraceNode;
}

export interface TraceNode {
  action: string;          // e.g. "User/register"
  variant: string;         // e.g. "ok" or "error"
  durationMs: number;
  fields: Record<string, unknown>;  // completion fields
  children: TraceSyncNode[];

  // Present only for actions on @gate concepts
  gate?: {
    pending: boolean;          // true if action hasn't completed yet
    waitDescription?: string;  // human-readable, from concept impl
    progress?: {               // optional progress reporting
      current: number;
      target: number;
      unit: string;            // e.g. "blocks", "items", "approvals"
    };
  };
}

export interface TraceSyncNode {
  syncName: string;
  fired: boolean;
  missingPattern?: string;  // human-readable: "waiting on JWT/generate → ok"
  child?: TraceNode;        // the invocation this sync produced
  blocked?: string;         // "waiting on: Concept/action → ok" when gate is pending
}

// --- FlowTrace Builder ---

/**
 * Build a FlowTrace from ActionLog records and the sync index.
 *
 * Algorithm:
 * 1. Get all records for the flow
 * 2. Find the root completion (no parent)
 * 3. Recursively build TraceNodes by following parent→child edges
 * 4. For each completion, check which syncs could have fired
 * 5. Mark unfired syncs with the missing pattern
 * 6. Compute timing and aggregate status
 */
/**
 * Lookup function to determine if a concept URI has @gate annotation.
 * Returns the AST if available, used to check ast.annotations?.gate.
 */
export type GateLookup = (conceptUri: string) => ConceptAST | undefined;

export function buildFlowTrace(
  flowId: string,
  log: ActionLog,
  syncIndex: SyncIndex,
  registeredSyncs: CompiledSync[],
  gateLookup?: GateLookup,
): FlowTrace | null {
  const records = log.getFlowRecords(flowId);
  if (records.length === 0) return null;

  // Separate completions and invocations
  const completions = records.filter(r => r.type === 'completion');
  const invocations = records.filter(r => r.type === 'invocation');

  // Find root completion (no parent — the initial event)
  const rootCompletion = completions.find(r => !r.parent);
  if (!rootCompletion) return null;

  // Build lookup maps
  // invocationId → completion (the completion that resulted from this invocation)
  const invocationToCompletion = new Map<string, ActionRecord>();
  for (const c of completions) {
    if (c.parent) {
      invocationToCompletion.set(c.parent, c);
    }
  }

  // completionId → invocations triggered by it (via parent pointer on invocations)
  const completionToInvocations = new Map<string, ActionRecord[]>();
  for (const inv of invocations) {
    if (inv.parent) {
      const list = completionToInvocations.get(inv.parent) || [];
      list.push(inv);
      completionToInvocations.set(inv.parent, list);
    }
  }

  // Collect all sync names that fired anywhere in this flow.
  // A multi-when sync (e.g. EchoResponse) is indexed under multiple
  // concept:action keys, but only fires once from the trigger that
  // completes the when-clause match. We must not report it as unfired
  // at the other indexed completions.
  const globallyFiredSyncs = new Set<string>();
  for (const inv of invocations) {
    if (inv.sync) {
      globallyFiredSyncs.add(inv.sync);
    }
  }

  // Build the trace tree recursively
  const root = buildTraceNode(
    rootCompletion,
    completionToInvocations,
    invocationToCompletion,
    syncIndex,
    registeredSyncs,
    completions,
    globallyFiredSyncs,
    gateLookup,
  );

  // Compute aggregate status
  const status = computeStatus(root);

  // Compute total duration from first to last timestamp
  const timestamps = records.map(r => new Date(r.timestamp).getTime());
  const durationMs = Math.max(...timestamps) - Math.min(...timestamps);

  return {
    flowId,
    status,
    durationMs,
    root,
  };
}

/**
 * Build a TraceNode from a completion record.
 */
function buildTraceNode(
  completion: ActionRecord,
  completionToInvocations: Map<string, ActionRecord[]>,
  invocationToCompletion: Map<string, ActionRecord>,
  syncIndex: SyncIndex,
  registeredSyncs: CompiledSync[],
  allCompletions: ActionRecord[],
  globallyFiredSyncs: Set<string>,
  gateLookup?: GateLookup,
): TraceNode {
  // Get invocations triggered by this completion
  const triggeredInvocations = completionToInvocations.get(completion.id) || [];

  // Track which syncs actually fired for this completion
  const firedSyncNames = new Set<string>();
  const children: TraceSyncNode[] = [];

  for (const inv of triggeredInvocations) {
    const syncName = inv.sync || 'unknown';
    firedSyncNames.add(syncName);

    // Find the completion that resulted from this invocation
    const resultCompletion = invocationToCompletion.get(inv.id);

    let childNode: TraceNode | undefined;
    if (resultCompletion) {
      childNode = buildTraceNode(
        resultCompletion,
        completionToInvocations,
        invocationToCompletion,
        syncIndex,
        registeredSyncs,
        allCompletions,
        globallyFiredSyncs,
        gateLookup,
      );
    } else if (gateLookup) {
      // No completion yet — if this is a gate concept, create a pending gate node
      const ast = gateLookup(inv.concept);
      if (ast?.annotations?.gate) {
        const invTime = new Date(inv.timestamp).getTime();
        const now = Date.now();
        const conceptName = formatConceptName(inv.concept);
        const pendingGate: TraceNode['gate'] = { pending: true };

        // Extract progress from invocation input fields if present
        if (
          typeof inv.input.progressCurrent === 'number' &&
          typeof inv.input.progressTarget === 'number' &&
          typeof inv.input.progressUnit === 'string'
        ) {
          pendingGate.progress = {
            current: inv.input.progressCurrent,
            target: inv.input.progressTarget,
            unit: inv.input.progressUnit,
          };
        }

        childNode = {
          action: `${conceptName}/${inv.action}`,
          variant: 'pending',
          durationMs: Math.max(0, now - invTime),
          fields: inv.input || {},
          children: [],
          gate: pendingGate,
        };
      }
    }

    children.push({
      syncName,
      fired: true,
      child: childNode,
    });
  }

  // Check for unfired syncs: look up all syncs that could match this
  // completion's concept:action pattern
  const key = indexKey(completion.concept, completion.action);
  const candidateSyncs = syncIndex.get(key);

  if (candidateSyncs) {
    for (const sync of candidateSyncs) {
      // Skip if this sync fired from this completion
      if (firedSyncNames.has(sync.name)) continue;

      // Skip if this sync fired elsewhere in the flow (multi-when syncs
      // are indexed under multiple concept:action keys but only fire once)
      if (globallyFiredSyncs.has(sync.name)) continue;

      // This sync was a candidate but didn't fire — figure out why
      const missingPattern = findMissingPattern(
        sync,
        completion,
        allCompletions,
      );

      // Check if the unfired sync is blocked by a pending gate
      let blocked: string | undefined;
      if (gateLookup && missingPattern.startsWith('waiting on:')) {
        // Find the concept URI from the sync's when patterns that is missing
        for (const pattern of sync.when) {
          const patternAst = gateLookup(pattern.concept);
          if (patternAst?.annotations?.gate) {
            // Check if there's an invocation but no completion for this gate
            const hasPendingGate = allCompletions.every(
              c => c.concept !== pattern.concept || c.action !== pattern.action,
            );
            if (hasPendingGate) {
              const gateConceptName = formatConceptName(pattern.concept);
              blocked = `waiting on: ${gateConceptName}/${pattern.action} \u2192 ok`;
            }
          }
        }
      }

      children.push({
        syncName: sync.name,
        fired: false,
        missingPattern,
        blocked,
      });
    }
  }

  // Compute duration for this action
  // If we have an invocation record for this completion, use its timestamp
  // as the start time
  const completionTime = new Date(completion.timestamp).getTime();
  let durationMs = 0;

  // Look for the invocation that produced this completion
  // (the parent of this completion is an invocation)
  if (completion.parent) {
    // Find the invocation record
    const parentInv = findRecord(completionToInvocations, invocationToCompletion, completion.parent);
    if (parentInv) {
      durationMs = completionTime - new Date(parentInv.timestamp).getTime();
    }
  }

  // Format action name as Concept/action (strip URI prefix)
  const conceptName = formatConceptName(completion.concept);
  const action = `${conceptName}/${completion.action}`;

  const node: TraceNode = {
    action,
    variant: completion.variant || 'ok',
    durationMs: Math.max(0, durationMs),
    fields: completion.output || {},
    children,
  };

  // Check if this is a gate concept and populate gate metadata
  if (gateLookup) {
    const ast = gateLookup(completion.concept);
    if (ast?.annotations?.gate) {
      const fields = completion.output || {};
      const pending = false; // Completed actions are not pending
      const gate: TraceNode['gate'] = { pending };

      // Extract waitDescription from completion fields (convention: 'description' field)
      if (typeof fields.description === 'string') {
        gate.waitDescription = fields.description;
      }

      // Extract progress from completion fields (convention: progressCurrent, progressTarget, progressUnit)
      if (
        typeof fields.progressCurrent === 'number' &&
        typeof fields.progressTarget === 'number' &&
        typeof fields.progressUnit === 'string'
      ) {
        gate.progress = {
          current: fields.progressCurrent,
          target: fields.progressTarget,
          unit: fields.progressUnit,
        };
      }

      node.gate = gate;
    }
  }

  // Mark unfired syncs as "blocked" if they're waiting on an incomplete gate action
  for (const syncChild of children) {
    if (!syncChild.fired && syncChild.missingPattern && node.gate) {
      // If this node IS a gate and hasn't completed its full chain,
      // downstream unfired syncs are blocked, not simply unmatched
      const isWaitingOnGate = syncChild.missingPattern.startsWith('waiting on:');
      if (isWaitingOnGate) {
        syncChild.blocked = syncChild.missingPattern;
      }
    }
  }

  return node;
}

/**
 * Find the record with the given ID from the invocations/completions.
 */
function findRecord(
  completionToInvocations: Map<string, ActionRecord[]>,
  invocationToCompletion: Map<string, ActionRecord>,
  id: string,
): ActionRecord | undefined {
  // Check all invocations
  for (const invs of completionToInvocations.values()) {
    for (const inv of invs) {
      if (inv.id === id) return inv;
    }
  }
  // Check all completions
  for (const c of invocationToCompletion.values()) {
    if (c.id === id) return c;
  }
  return undefined;
}

/**
 * Determine what pattern a sync was waiting on that prevented it from firing.
 */
function findMissingPattern(
  sync: CompiledSync,
  triggerCompletion: ActionRecord,
  allCompletions: ActionRecord[],
): string {
  // For each when pattern in the sync, check if there's a matching completion
  // (including literal field checks — a completion for the right concept:action
  // but wrong literal field values does NOT satisfy the pattern)
  for (const pattern of sync.when) {
    // Check if any completion in the flow satisfies this pattern
    // (including the trigger completion — it must match literal fields too)
    const hasMatch = allCompletions.some(c =>
      c.concept === pattern.concept &&
      c.action === pattern.action &&
      matchesPatternFields(pattern, c),
    );

    if (!hasMatch) {
      const conceptName = formatConceptName(pattern.concept);
      const requiredLiterals = getRequiredLiterals(pattern);
      return `waiting on: ${conceptName}/${pattern.action}${requiredLiterals ? ` with ${requiredLiterals}` : ''}`;
    }
  }

  // All patterns matched but sync still didn't fire —
  // likely a binding/where-clause issue
  return 'binding or where-clause unsatisfied';
}

/**
 * Check if a completion matches the literal field patterns of a WhenPattern.
 */
function matchesPatternFields(pattern: WhenPattern, completion: ActionRecord): boolean {
  // Check input literal fields
  for (const field of pattern.inputFields) {
    if (field.match.type === 'literal') {
      if (completion.input[field.name] !== field.match.value) return false;
    }
  }
  // Check output literal fields
  for (const field of pattern.outputFields) {
    if (field.match.type === 'literal') {
      if (completion.output?.[field.name] !== field.match.value) return false;
    }
  }
  return true;
}

/**
 * Extract a human-readable description of the required literal fields
 * from a when pattern.
 */
function getRequiredLiterals(pattern: WhenPattern): string | null {
  const literals: string[] = [];
  for (const field of pattern.inputFields) {
    if (field.match.type === 'literal') {
      literals.push(`${field.name}: ${JSON.stringify(field.match.value)}`);
    }
  }
  for (const field of pattern.outputFields) {
    if (field.match.type === 'literal') {
      literals.push(`${field.name}: ${JSON.stringify(field.match.value)}`);
    }
  }
  return literals.length > 0 ? literals.join(', ') : null;
}

/**
 * Format a concept URI to a short name.
 * "urn:clef/User" → "User"
 * "urn:test/Echo" → "Echo"
 */
function formatConceptName(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1];
}

/**
 * Compute aggregate status from the trace tree.
 * - "ok" if all nodes have variant "ok" and no unexpectedly-unfired syncs
 * - "failed" if any node has a non-ok variant
 * - "partial" if there are syncs whose when-patterns were all satisfied
 *   but still didn't fire (binding or where-clause issue)
 *
 * Syncs that didn't fire because a required when-pattern wasn't matched
 * (e.g., error-handling syncs on a happy path) are expected and don't
 * affect the status.
 */
function computeStatus(node: TraceNode): 'ok' | 'failed' | 'partial' {
  let hasFailed = false;
  let hasUnexpectedlyUnfired = false;

  function walk(n: TraceNode): void {
    if (n.variant !== 'ok') {
      hasFailed = true;
    }

    for (const child of n.children) {
      if (!child.fired) {
        // Only count as "unexpectedly unfired" if all when-patterns
        // were satisfied (missing pattern shows binding/where issue,
        // not a missing completion)
        const isMissingCompletion = child.missingPattern?.startsWith('waiting on:');
        if (!isMissingCompletion) {
          hasUnexpectedlyUnfired = true;
        }
      }
      if (child.child) {
        walk(child.child);
      }
    }
  }

  walk(node);

  if (hasFailed) return 'failed';
  if (hasUnexpectedlyUnfired) return 'partial';
  return 'ok';
}

// --- CLI Renderer ---

/**
 * Render a FlowTrace as a tree-formatted string for terminal output.
 *
 * Output format:
 * ```
 * flow-abc-123  Registration Flow  (142ms total, FAILED)
 * │
 * ├─ ✅ Web/request → ok                          0ms
 * │  ├─ [ValidatePassword] →
 * │  │  └─ ✅ Password/validate → ok              12ms
 * ```
 */
/**
 * Format a duration in milliseconds to human-friendly units.
 * Gate actions can take minutes, hours, or days, so the renderer
 * uses "14m 18s" instead of "858000ms".
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}.${Math.floor((ms % 1000) / 100)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

export function renderFlowTrace(
  trace: FlowTrace,
  options: { failed?: boolean; json?: boolean; gates?: boolean } = {},
): string {
  if (options.json) {
    return JSON.stringify(trace, null, 2);
  }

  const statusLabel = trace.status.toUpperCase();
  const lines: string[] = [];

  const totalDuration = hasGateNode(trace.root)
    ? formatDuration(trace.durationMs)
    : `${trace.durationMs}ms`;

  lines.push(
    `${trace.flowId}  (${totalDuration} total, ${statusLabel})`,
  );
  lines.push('│');

  renderNode(trace.root, lines, '', true, options.failed || false, options.gates || false);

  return lines.join('\n');
}

function renderNode(
  node: TraceNode,
  lines: string[],
  prefix: string,
  isLast: boolean,
  failedOnly: boolean,
  gatesOnly: boolean = false,
): void {
  const connector = isLast ? '\u2514\u2500' : '\u251C\u2500';

  // Determine icon and label based on gate status
  let icon: string;
  let gateLabel = '';
  let timingStr: string;

  if (node.gate) {
    icon = '\u23F3'; // ⏳ for gate actions
    if (node.gate.pending) {
      gateLabel = '  (async gate, pending)';
    } else if (node.variant !== 'ok') {
      gateLabel = '  (async gate, FAILED)';
    } else {
      gateLabel = '  (async gate)';
    }
    timingStr = formatDuration(node.durationMs);
  } else {
    icon = node.variant === 'ok' ? '\u2705' : '\u274C';
    timingStr = `${node.durationMs}ms`;
  }

  // If --failed mode, skip successful branches with no errors
  if (failedOnly && node.variant === 'ok' && !hasFailedDescendant(node)) {
    return;
  }

  // If --gates mode, skip non-gate branches unless they contain gate nodes
  if (gatesOnly && !node.gate && !hasGateDescendant(node)) {
    return;
  }

  const variantStr = node.gate?.pending ? '' : ` \u2192 ${node.variant}`;
  const padding = Math.max(1, 40 - node.action.length - (node.gate?.pending ? 0 : node.variant.length + 4));
  lines.push(`${prefix}${connector} ${icon} ${node.action}${variantStr}${' '.repeat(padding)}${timingStr}${gateLabel}`);

  const childPrefix = prefix + (isLast ? '   ' : '\u2502  ');

  // Show gate-specific details
  if (node.gate) {
    // Show input fields for gate actions (e.g. level: "l1-batch")
    if (node.variant !== 'ok' || node.gate.pending) {
      for (const [key, value] of Object.entries(node.fields)) {
        if (key !== 'description' && key !== 'progressCurrent' && key !== 'progressTarget' && key !== 'progressUnit') {
          lines.push(`${childPrefix}   ${key}: ${JSON.stringify(value)}`);
        }
      }
    }

    // "waited for:" line when gate completes with a description
    if (node.gate.waitDescription && !node.gate.pending) {
      lines.push(`${childPrefix}   waited for: ${node.gate.waitDescription}`);
    }

    // Progress bar/fraction for pending gates
    if (node.gate.progress && node.gate.pending) {
      const { current, target, unit } = node.gate.progress;
      lines.push(`${childPrefix}   status: ${current}/${target === 0 ? '?' : `~${target}`} ${unit}`);
    }
  } else if (node.variant !== 'ok' && Object.keys(node.fields).length > 0) {
    // If error variant (non-gate), show fields
    for (const [key, value] of Object.entries(node.fields)) {
      lines.push(`${childPrefix}   ${key}: ${JSON.stringify(value)}`);
    }
  }

  // Render children (sync nodes)
  let visibleChildren = failedOnly
    ? node.children.filter(c => !c.fired || (c.child && hasFailedDescendant(c.child)))
    : node.children;

  if (gatesOnly) {
    visibleChildren = visibleChildren.filter(c =>
      c.blocked || (c.child && (c.child.gate || hasGateDescendant(c.child))),
    );
  }

  for (let i = 0; i < visibleChildren.length; i++) {
    const syncNode = visibleChildren[i];
    const isLastChild = i === visibleChildren.length - 1;
    const syncConnector = isLastChild ? '\u2514\u2500' : '\u251C\u2500';

    if (syncNode.fired && syncNode.child) {
      // Fired sync with result
      lines.push(`${childPrefix}${syncConnector} [${syncNode.syncName}] \u2192`);
      const syncChildPrefix = childPrefix + (isLastChild ? '   ' : '\u2502  ');
      renderNode(syncNode.child, lines, syncChildPrefix, true, failedOnly, gatesOnly);
    } else if (syncNode.blocked) {
      // Blocked by pending gate — distinct from unfired (⚠)
      lines.push(`${childPrefix}${syncConnector} \u23F8 [${syncNode.syncName}] blocked`);
      const blockedPrefix = childPrefix + (isLastChild ? '   ' : '\u2502  ');
      lines.push(`${blockedPrefix}   (${syncNode.blocked})`);
    } else if (!syncNode.fired) {
      // Unfired sync
      lines.push(`${childPrefix}${syncConnector} \u26A0 [${syncNode.syncName}] did not fire`);
      if (syncNode.missingPattern) {
        const unfiredPrefix = childPrefix + (isLastChild ? '   ' : '\u2502  ');
        lines.push(`${unfiredPrefix}   (${syncNode.missingPattern})`);
      }
    }
  }
}

function hasGateNode(node: TraceNode): boolean {
  if (node.gate) return true;
  for (const child of node.children) {
    if (child.child && hasGateNode(child.child)) return true;
  }
  return false;
}

function hasGateDescendant(node: TraceNode): boolean {
  for (const child of node.children) {
    if (child.blocked) return true;
    if (child.child) {
      if (child.child.gate) return true;
      if (hasGateDescendant(child.child)) return true;
    }
  }
  return false;
}

function hasFailedDescendant(node: TraceNode): boolean {
  if (node.variant !== 'ok') return true;
  for (const child of node.children) {
    if (!child.fired) return true;
    if (child.child && hasFailedDescendant(child.child)) return true;
  }
  return false;
}

// --- Concept Handler ---

export const flowTraceHandler: ConceptHandler = {
  async build(input, _storage) {
    const flowId = input.flowId as string;
    if (!flowId) {
      return { variant: 'error', message: 'flowId is required' };
    }

    // Building a trace requires ActionLog and SyncIndex which are
    // only available via the engine runtime. Return error for
    // standalone invocations.
    return { variant: 'error', message: 'No action log available for flow: ' + flowId };
  },

  async render(input, _storage) {
    const trace = input.trace as FlowTrace | undefined;
    const options = input.options as { failed?: boolean; json?: boolean } | undefined;

    if (!trace || !trace.flowId) {
      return { variant: 'ok', output: '' };
    }

    const output = renderFlowTrace(trace, options || {});
    return { variant: 'ok', output };
  },
};
