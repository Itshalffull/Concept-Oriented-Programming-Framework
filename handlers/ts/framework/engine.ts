// ============================================================
// Clef Kernel - Sync Engine
// Matching algorithm, when/where/then evaluation
// ============================================================

import type {
  ActionCompletion,
  ActionRecord,
  ActionInvocation,
  CompiledSync,
  WhenPattern,
  FieldPattern,
  WhereEntry,
  ThenAction,
  ThenField,
  Binding,
  ConceptRegistry,
} from '../../../runtime/types.js';
import { generateId, timestamp } from '../../../runtime/types.js';

// --- Action Log ---

export class ActionLog {
  private records: ActionRecord[] = [];
  private syncEdges = new Map<string, Set<string>>(); // key = sorted completionIds, value = set of sync names

  append(completion: ActionCompletion, parentId?: string): ActionRecord {
    const record: ActionRecord = {
      id: completion.id,
      type: 'completion',
      concept: completion.concept,
      action: completion.action,
      input: completion.input,
      variant: completion.variant,
      output: completion.output,
      flow: completion.flow,
      timestamp: completion.timestamp,
      parent: parentId,
    };
    this.records.push(record);
    return record;
  }

  appendInvocation(invocation: ActionInvocation, parentId?: string): ActionRecord {
    const record: ActionRecord = {
      id: invocation.id,
      type: 'invocation',
      concept: invocation.concept,
      action: invocation.action,
      input: invocation.input,
      flow: invocation.flow,
      sync: invocation.sync,
      parent: parentId,
      timestamp: invocation.timestamp,
    };
    this.records.push(record);
    return record;
  }

  getCompletionsForFlow(flow: string): ActionCompletion[] {
    return this.records
      .filter(r => r.flow === flow && r.type === 'completion')
      .map(r => ({
        id: r.id,
        concept: r.concept,
        action: r.action,
        input: r.input,
        variant: r.variant!,
        output: r.output || {},
        flow: r.flow,
        timestamp: r.timestamp,
      }));
  }

  getFlowRecords(flow: string): ActionRecord[] {
    return this.records.filter(r => r.flow === flow);
  }

  hasSyncEdge(matchedIds: string[], syncName: string): boolean {
    const key = [...matchedIds].sort().join('|');
    const edges = this.syncEdges.get(key);
    return edges !== undefined && edges.has(syncName);
  }

  addSyncEdge(completionId: string, invocationId: string, syncName: string): void {
    // Index by the completion that triggered it
    const key = completionId;
    let edges = this.syncEdges.get(key);
    if (!edges) {
      edges = new Set();
      this.syncEdges.set(key, edges);
    }
    edges.add(`${syncName}:${invocationId}`);
  }

  addSyncEdgeForMatch(matchedIds: string[], syncName: string): void {
    const key = [...matchedIds].sort().join('|');
    let edges = this.syncEdges.get(key);
    if (!edges) {
      edges = new Set();
      this.syncEdges.set(key, edges);
    }
    edges.add(syncName);
  }
}

// --- Sync Index ---

export type SyncIndex = Map<string, Set<CompiledSync>>;

export function indexKey(concept: string, action: string): string {
  return `${concept}:${action}`;
}

export function buildSyncIndex(syncs: CompiledSync[]): SyncIndex {
  const index: SyncIndex = new Map();
  for (const sync of syncs) {
    for (const pattern of sync.when) {
      const key = indexKey(pattern.concept, pattern.action);
      let set = index.get(key);
      if (!set) {
        set = new Set();
        index.set(key, set);
      }
      set.add(sync);
    }
  }
  return index;
}

// --- Cross Product ---

function crossProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map(x => [x]);

  const [first, ...rest] = arrays;
  const restProduct = crossProduct(rest);
  const result: T[][] = [];

  for (const item of first) {
    for (const combo of restProduct) {
      result.push([item, ...combo]);
    }
  }

  return result;
}

// --- Field Matching ---

function matchField(
  field: FieldPattern,
  value: unknown,
  binding: Binding,
): boolean {
  switch (field.match.type) {
    case 'wildcard':
      return true;
    case 'literal':
      return value === field.match.value;
    case 'variable': {
      // A variable must bind to a defined value — undefined means
      // the field doesn't exist in the completion output
      if (value === undefined) return false;
      const varName = field.match.name;
      if (varName in binding && varName !== '__matchedCompletionIds') {
        return binding[varName] === value;
      } else {
        binding[varName] = value;
        return true;
      }
    }
  }
}

// --- When-Clause Matching ---

export function matchWhenClause(
  patterns: WhenPattern[],
  completions: ActionCompletion[],
  trigger: ActionCompletion,
): Binding[] {
  // Step 1: For each pattern, find candidate completions
  const candidatesPerPattern: ActionCompletion[][] = patterns.map(pattern =>
    completions.filter(c =>
      c.concept === pattern.concept && c.action === pattern.action,
    ),
  );

  // If any pattern has zero candidates, no match possible
  if (candidatesPerPattern.some(c => c.length === 0)) return [];

  // Step 2: Enumerate combinations (cross product)
  const combinations = crossProduct(candidatesPerPattern);

  // Step 3: Filter and bind
  const results: Binding[] = [];

  for (const combo of combinations) {
    // Must include the trigger
    if (!combo.some(c => c.id === trigger.id)) continue;

    // Try to build a consistent binding
    const binding: Binding = { __matchedCompletionIds: combo.map(c => c.id) };
    let consistent = true;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const completion = combo[i];

      // Match input fields
      for (const field of pattern.inputFields) {
        const value = completion.input[field.name];
        if (!matchField(field, value, binding)) {
          consistent = false;
          break;
        }
      }
      if (!consistent) break;

      // Match output fields
      for (const field of pattern.outputFields) {
        const value = completion.output?.[field.name];
        if (!matchField(field, value, binding)) {
          consistent = false;
          break;
        }
      }
      if (!consistent) break;
    }

    if (consistent) {
      // Deduplicate by matched completion IDs
      const isDuplicate = results.some(existing =>
        existing.__matchedCompletionIds.length === binding.__matchedCompletionIds.length &&
        binding.__matchedCompletionIds.every(
          (id, j) => id === existing.__matchedCompletionIds[j],
        ),
      );
      if (!isDuplicate) results.push(binding);
    }
  }

  return results;
}

// --- Where-Clause Evaluation ---

export async function evaluateWhere(
  whereEntries: WhereEntry[],
  binding: Binding,
  registry: ConceptRegistry,
): Promise<Binding[]> {
  let bindings: Binding[] = [{ ...binding }];

  for (const entry of whereEntries) {
    const newBindings: Binding[] = [];

    for (const b of bindings) {
      if (entry.type === 'bind') {
        const newBinding = { ...b };
        if (entry.expr === 'uuid()') {
          newBinding[entry.as!] = generateId();
        } else {
          // For other expressions, evaluate as simple string
          newBinding[entry.as!] = entry.expr;
        }
        newBindings.push(newBinding);
      } else if (entry.type === 'query') {
        // Query a concept's state
        const conceptUri = entry.concept!;
        const transport = registry.resolve(conceptUri);
        if (!transport) {
          // Concept not available, skip
          continue;
        }

        // Build query args from bindings
        const queryArgs: Record<string, unknown> = {};
        const resultBindingFields: { variable: string; field: string }[] = [];
        const keyVariable: string | null = null;

        for (const qb of entry.bindings || []) {
          if (qb.field === '__key') {
            // This is the key variable — we need results to bind to it
            resultBindingFields.push(qb);
          } else if (qb.variable in b && qb.variable !== '__matchedCompletionIds') {
            // This variable is already bound, use as filter
            queryArgs[qb.field] = b[qb.variable];
          } else {
            // Unbound variable — will be populated from results
            resultBindingFields.push(qb);
          }
        }

        // Determine the relation name from the concept URI
        const conceptName = conceptUri.split('/').pop()?.toLowerCase() || '';
        const results = await transport.query({ relation: conceptName, args: queryArgs });

        for (const row of results) {
          const newBinding = { ...b };
          let valid = true;
          for (const rbf of resultBindingFields) {
            if (rbf.field === '__key') {
              // The key is typically stored in a field like 'user', 'id', etc.
              // Try to find a key field in the result
              const keyField = Object.keys(row).find(k =>
                k === 'id' || k === 'user' || k === conceptName,
              ) || Object.keys(row)[0];
              if (keyField) {
                newBinding[rbf.variable] = row[keyField];
              }
            } else {
              const value = row[rbf.field];
              if (rbf.variable in b && b[rbf.variable] !== value) {
                valid = false;
                break;
              }
              newBinding[rbf.variable] = value;
            }
          }
          if (valid) newBindings.push(newBinding);
        }
      }
      // filter type: skip for now (not needed for bootstrap)
    }

    bindings = newBindings;
  }

  return bindings;
}

// --- Build Invocations from Then Clause ---

export function buildInvocations(
  thenActions: ThenAction[],
  binding: Binding,
  flow: string,
  syncName: string,
): ActionInvocation[] {
  const invocations: ActionInvocation[] = [];

  for (const action of thenActions) {
    const input: Record<string, unknown> = {};

    for (const field of action.fields) {
      if (field.value.type === 'variable') {
        input[field.name] = binding[field.value.name];
      } else {
        // Resolve template variables in literal values
        input[field.name] = resolveTemplateValue(field.value.value, binding);
      }
    }

    invocations.push({
      id: generateId(),
      concept: action.concept,
      action: action.action,
      input,
      flow,
      sync: syncName,
      timestamp: timestamp(),
    });
  }

  return invocations;
}

/**
 * Resolve template variables like {{varName}} in literal values.
 */
function resolveTemplateValue(value: unknown, binding: Binding): unknown {
  if (typeof value === 'string') {
    // Check if the entire string is a template reference
    const match = value.match(/^\{\{(\w+)\}\}$/);
    if (match) {
      return binding[match[1]];
    }
    // Replace embedded template references
    return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      const resolved = binding[varName];
      return resolved !== undefined ? String(resolved) : `{{${varName}}}`;
    });
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const resolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      resolved[k] = resolveTemplateValue(v, binding);
    }
    return resolved;
  }
  return value;
}

// --- Sync Engine ---

export class SyncEngine {
  private log: ActionLog;
  private index: SyncIndex;
  private registry: ConceptRegistry;
  private degradedSyncs = new Set<string>();

  constructor(log: ActionLog, registry: ConceptRegistry) {
    this.log = log;
    this.index = new Map();
    this.registry = registry;
  }

  registerSync(sync: CompiledSync): void {
    for (const pattern of sync.when) {
      const key = indexKey(pattern.concept, pattern.action);
      let set = this.index.get(key);
      if (!set) {
        set = new Set();
        this.index.set(key, set);
      }
      set.add(sync);
    }
  }

  /**
   * Atomically replace the sync index with a new set of syncs.
   * In-flight flows continue using the old sync set (they have
   * captured references). New completions use the new index.
   * See Architecture doc Section 16.3, Scenario A.
   */
  reloadSyncs(syncs: CompiledSync[]): void {
    this.index = buildSyncIndex(syncs);
    this.degradedSyncs.clear();
  }

  /**
   * Mark syncs that reference the given concept URI as degraded.
   * Degraded syncs are skipped during matching with a warning log.
   * Returns the names of newly degraded syncs.
   */
  degradeSyncsForConcept(uri: string): string[] {
    const degraded: string[] = [];
    for (const syncs of this.index.values()) {
      for (const sync of syncs) {
        if (this.degradedSyncs.has(sync.name)) continue;
        const references =
          sync.when.some(p => p.concept === uri) ||
          sync.then.some(t => t.concept === uri);
        if (references) {
          this.degradedSyncs.add(sync.name);
          degraded.push(sync.name);
        }
      }
    }
    return degraded;
  }

  /**
   * Un-degrade syncs that reference the given concept URI.
   * Called automatically when a concept re-registers.
   * Returns the names of un-degraded syncs.
   */
  undegradeSyncsForConcept(uri: string): string[] {
    const undegraded: string[] = [];
    for (const syncs of this.index.values()) {
      for (const sync of syncs) {
        if (!this.degradedSyncs.has(sync.name)) continue;
        const references =
          sync.when.some(p => p.concept === uri) ||
          sync.then.some(t => t.concept === uri);
        if (references) {
          this.degradedSyncs.delete(sync.name);
          undegraded.push(sync.name);
        }
      }
    }
    return undegraded;
  }

  /** Check if a sync is degraded. */
  isSyncDegraded(syncName: string): boolean {
    return this.degradedSyncs.has(syncName);
  }

  /** Get all degraded sync names. */
  getDegradedSyncs(): string[] {
    return [...this.degradedSyncs];
  }

  async onCompletion(
    completion: ActionCompletion,
    parentId?: string,
  ): Promise<ActionInvocation[]> {
    // 1. Append completion to the action log
    this.log.append(completion, parentId);

    // 2. Find candidate syncs
    const key = indexKey(completion.concept, completion.action);
    const candidates = this.index.get(key);
    if (!candidates) return [];

    const allInvocations: ActionInvocation[] = [];

    // 3. For each candidate sync
    for (const sync of candidates) {
      // Skip degraded syncs with warning
      if (this.degradedSyncs.has(sync.name)) {
        console.warn(`[clef] Skipping degraded sync: ${sync.name}`);
        continue;
      }
      // 4. Gather all completions in this flow
      const flowCompletions = this.log.getCompletionsForFlow(completion.flow);

      // 5. Find all valid binding combinations for the when clause
      const whenBindings = matchWhenClause(sync.when, flowCompletions, completion);

      // 6. For each binding set, check firing guard and evaluate
      for (const binding of whenBindings) {
        const matchedIds = binding.__matchedCompletionIds;

        // 6a. Firing guard: has this sync already fired for this exact match?
        if (this.log.hasSyncEdge(matchedIds, sync.name)) continue;

        // Record the edge to prevent re-firing
        this.log.addSyncEdgeForMatch(matchedIds, sync.name);

        // 6b. Evaluate where clause
        const whereBindings = await evaluateWhere(
          sync.where, binding, this.registry,
        );

        // 6c. For each where result, produce invocations
        for (const fullBinding of whereBindings) {
          const invocations = buildInvocations(
            sync.then, fullBinding, completion.flow, sync.name,
          );

          // 6d. Record provenance edges
          for (const inv of invocations) {
            this.log.appendInvocation(inv, completion.id);
            for (const completionId of matchedIds) {
              this.log.addSyncEdge(completionId, inv.id, sync.name);
            }
          }

          allInvocations.push(...invocations);
        }
      }
    }

    return allInvocations;
  }

  getLog(): ActionLog {
    return this.log;
  }

  getSyncIndex(): SyncIndex {
    return this.index;
  }

  getRegisteredSyncs(): CompiledSync[] {
    const seen = new Set<CompiledSync>();
    for (const syncs of this.index.values()) {
      for (const sync of syncs) {
        seen.add(sync);
      }
    }
    return [...seen];
  }
}
