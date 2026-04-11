// @clef-handler style=functional concept=QueryExecution
// QueryExecution Concept Implementation — Functional (StorageProgram) style
//
// Registry and dispatcher for query execution providers. Manages named provider
// registrations with kind-based routing and capability declarations through sync
// wiring. Actual execution dispatch returns a placeholder result since external
// backend modules are injected via syncs, not imported directly.
// See architecture doc Section 10.1 (ConceptManifest IR) for query patterns.
// Coroutine-style invoke execution (Sections 10.2, 16.11): execute yields
// invoke_pending when hitting an invoke instruction; resumeAfterInvoke
// continues from the serialized continuation.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── FilterNode evaluator (matches TextDslProvider's FilterNode type) ──────

function evaluateFilterNode(node: Record<string, unknown>, record: Record<string, unknown>): boolean {
  const nodeType = node.type as string;
  switch (nodeType) {
    case 'true': return true;
    case 'false': return false;
    case 'eq': return String(record[node.field as string] ?? '') === String(node.value);
    case 'neq': return String(record[node.field as string] ?? '') !== String(node.value);
    case 'gt': return String(record[node.field as string] ?? '') > String(node.value);
    case 'gte': return String(record[node.field as string] ?? '') >= String(node.value);
    case 'lt': return String(record[node.field as string] ?? '') < String(node.value);
    case 'lte': return String(record[node.field as string] ?? '') <= String(node.value);
    case 'in': {
      const values = (node.values as unknown[]) ?? [];
      const fieldVal = String(record[node.field as string] ?? '');
      return values.some(v => String(v) === fieldVal);
    }
    case 'not_in': {
      const values = (node.values as unknown[]) ?? [];
      const fieldVal = String(record[node.field as string] ?? '');
      return !values.some(v => String(v) === fieldVal);
    }
    case 'exists': return record[node.field as string] != null;
    case 'function': {
      const fieldVal = String(record[node.field as string] ?? '');
      const searchVal = String(node.value ?? '');
      switch (node.name as string) {
        case 'contains': return fieldVal.toLowerCase().includes(searchVal.toLowerCase());
        case 'startsWith': return fieldVal.startsWith(searchVal);
        case 'endsWith': return fieldVal.endsWith(searchVal);
        case 'matches': return new RegExp(searchVal).test(fieldVal);
        default: return true;
      }
    }
    case 'and': {
      const conditions = (node.conditions as Array<Record<string, unknown>>) ?? [];
      return conditions.every(c => evaluateFilterNode(c, record));
    }
    case 'or': {
      const conditions = (node.conditions as Array<Record<string, unknown>>) ?? [];
      return conditions.some(c => evaluateFilterNode(c, record));
    }
    case 'not':
      return !evaluateFilterNode(node.condition as Record<string, unknown>, record);
    default: return true;
  }
}

// ─── Continuation type ────────────────────────────────────────────────────

interface Continuation {
  remainingInstructions: Array<Record<string, unknown>>;
  bindings: Record<string, unknown>;
  programId: string;
  instructionIndex: number;
  traverseState?: {
    sourceBinding: string;
    currentIndex: number;
    totalItems: number;
    accumulatedResults: unknown[];
  };
}

// ─── executeInstructions helper ───────────────────────────────────────────
//
// Iterates over instructions starting at startIndex, applying each to
// currentSet. Returns either an invoke_pending descriptor (coroutine yield)
// or the final rows string. Pure JavaScript — called inside mapBindings
// callbacks so no StorageProgram monad is needed here.

type InstructionResult =
  | { kind: 'ok'; rows: string; instructionCount: number }
  | {
      kind: 'invoke_pending';
      concept: string;
      action: string;
      input: string;
      continuation: Continuation;
    };

function executeInstructions(
  instructions: Array<Record<string, unknown>>,
  bindings: Record<string, unknown>,
  startIndex: number,
  programId: string,
  relationCache: Record<string, Array<Record<string, unknown>>>,
): InstructionResult {
  let currentSet: Array<Record<string, unknown>> = [];
  // Restore current set from bindings if present (used on resume)
  if (bindings['_currentSet'] != null) {
    currentSet = bindings['_currentSet'] as Array<Record<string, unknown>>;
  }

  for (let i = startIndex; i < instructions.length; i++) {
    const instr = instructions[i];
    const instrType = (instr.type as string) ?? '';

    switch (instrType) {
      case 'scan': {
        const source = instr.source as string;
        currentSet = relationCache[source] ?? [];
        break;
      }
      case 'filter': {
        const node = typeof instr.node === 'string' ? JSON.parse(instr.node as string) : instr.node;
        currentSet = currentSet.filter(record => evaluateFilterNode(node as Record<string, unknown>, record));
        break;
      }
      case 'join': {
        const joinSource = instr.source as string;
        const localField = instr.localField as string;
        const foreignField = instr.foreignField as string;
        const joinBindAs = instr.bindAs as string;
        const joinData = relationCache[joinSource] ?? [];

        const lookupMap = new Map<string, Array<Record<string, unknown>>>();
        for (const jRecord of joinData) {
          const fVal = String(jRecord[foreignField] ?? '');
          const existing = lookupMap.get(fVal) ?? [];
          existing.push(jRecord);
          lookupMap.set(fVal, existing);
        }

        currentSet = currentSet.map(record => {
          const lVal = String(record[localField] ?? '');
          const matched = lookupMap.get(lVal) ?? [];
          return { ...record, [joinBindAs]: matched.map(m => m.schema ?? m) };
        });
        break;
      }
      case 'sort': {
        const keys: Array<{ field: string; direction: string }> =
          typeof instr.keys === 'string' ? JSON.parse(instr.keys as string) : (instr.keys ?? []);
        currentSet = [...currentSet];
        for (const key of [...keys].reverse()) {
          const desc = key.direction === 'desc';
          currentSet.sort((a, b) => {
            const aVal = a[key.field];
            const bVal = b[key.field];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return desc ? 1 : -1;
            if (bVal == null) return desc ? -1 : 1;
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        break;
      }
      case 'group': {
        const groupKeys: string[] = typeof instr.keys === 'string' ? JSON.parse(instr.keys as string) : (instr.keys ?? []);
        const groups = new Map<string, Array<Record<string, unknown>>>();
        for (const record of currentSet) {
          const groupKey = groupKeys.map(k => String(record[k] ?? '')).join('::');
          const existingGroup = groups.get(groupKey) ?? [];
          existingGroup.push(record);
          groups.set(groupKey, existingGroup);
        }
        currentSet = Array.from(groups.entries()).map(([key, items]) => ({
          _groupKey: key,
          _count: items.length,
          _items: items,
        }));
        break;
      }
      case 'project': {
        const fields: string[] = typeof instr.fields === 'string' ? JSON.parse(instr.fields as string) : (instr.fields ?? []);
        currentSet = currentSet.map(record => {
          const projected: Record<string, unknown> = {};
          for (const f of fields) {
            if (f in record) projected[f] = record[f];
          }
          return projected;
        });
        break;
      }
      case 'limit': {
        const count = typeof instr.count === 'number' ? instr.count : parseInt(String(instr.count ?? '0'), 10);
        currentSet = currentSet.slice(0, count);
        break;
      }
      case 'pure':
        // Terminal — stop processing
        return { kind: 'ok', rows: JSON.stringify(currentSet), instructionCount: instructions.length };

      case 'invoke': {
        // Coroutine yield: serialize remaining instructions + bindings as continuation
        const remainingInstructions = instructions.slice(i + 1);
        const continuation: Continuation = {
          remainingInstructions,
          bindings: { ...bindings, _currentSet: currentSet },
          programId,
          instructionIndex: i,
        };
        return {
          kind: 'invoke_pending',
          concept: instr.concept as string,
          action: instr.action as string,
          input: typeof instr.input === 'string' ? instr.input : JSON.stringify(instr.input ?? {}),
          continuation,
        };
      }

      case 'traverseInvoke': {
        // traverseInvoke: iterate over source, yield on first item's invoke,
        // continuation tracks traversal position
        const sourceBinding = instr.sourceBinding as string;
        const items = (bindings[sourceBinding] ?? currentSet) as Array<unknown>;
        const accumulatedResults = (bindings['_traverseResults'] ?? []) as unknown[];
        const currentIndex = typeof bindings['_traverseIndex'] === 'number' ? bindings['_traverseIndex'] as number : 0;

        if (currentIndex < items.length) {
          const item = items[currentIndex];
          const remainingInstructions = instructions.slice(i); // stay on traverseInvoke
          const continuation: Continuation = {
            remainingInstructions,
            bindings: {
              ...bindings,
              _currentSet: currentSet,
              _traverseIndex: currentIndex + 1,
              _traverseResults: accumulatedResults,
              [sourceBinding]: items,
            },
            programId,
            instructionIndex: i,
            traverseState: {
              sourceBinding,
              currentIndex,
              totalItems: items.length,
              accumulatedResults,
            },
          };
          const itemAction = instr.action as string;
          const itemConcept = instr.concept as string;
          const itemInput = typeof item === 'object' ? JSON.stringify(item) : String(item);
          return {
            kind: 'invoke_pending',
            concept: itemConcept,
            action: itemAction,
            input: itemInput,
            continuation,
          };
        }
        // All items processed — advance with accumulated results
        currentSet = accumulatedResults as Array<Record<string, unknown>>;
        break;
      }

      default:
        // Unknown instruction — skip
        break;
    }
  }

  // Reached end of instructions without pure or invoke
  return { kind: 'ok', rows: JSON.stringify(currentSet), instructionCount: instructions.length };
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  registerKind(input: Record<string, unknown>) {
    const kind = input.kind as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { kind }),
      (b) => {
        const b2 = put(b, 'registeredKind', kind, { kind });
        return complete(b2, 'ok', { kind });
      },
    ) as StorageProgram<Result>;
  },

  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const kind = input.kind as string;
    const capabilitiesRaw = input.capabilities as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Validate capabilities JSON before storage operations
    let parsedCapabilities: string[];
    try {
      const parsed = JSON.parse(typeof capabilitiesRaw === 'string' ? capabilitiesRaw : '[]');
      if (!Array.isArray(parsed)) {
        return complete(createProgram(), 'error', { message: 'capabilities must be a JSON array' }) as StorageProgram<Result>;
      }
      parsedCapabilities = parsed;
    } catch {
      return complete(createProgram(), 'error', { message: 'capabilities is not valid JSON' }) as StorageProgram<Result>;
    }

    const caps = parsedCapabilities;

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');
    p = get(p, 'provider', name, 'existing');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" has not been registered` }),
      (b) => branch(b,
        (bb) => bb.existing != null,
        (bb) => completeFrom(bb, 'duplicate', (bindings) => ({
          provider: (bindings.existing as Record<string, unknown>).name as string,
        })),
        (bb) => {
          const b2 = put(bb, 'provider', name, { name, kind, capabilities: caps });
          return complete(b2, 'ok', { provider: name });
        },
      ),
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const program = input.program as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" is not registered` }),
      (b) => {
        // Validate the program is parseable JSON before dispatch
        const p2 = mapBindings(b, (_bindings) => {
          try {
            JSON.parse(typeof program === 'string' ? program : '{}');
            return { ok: true };
          } catch {
            return { ok: false, message: 'program is not valid JSON' };
          }
        }, '_parseCheck');

        return branch(p2,
          (bb) => !(bb._parseCheck as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._parseCheck as { ok: false; message: string }).message,
          })),
          (bb) => {
            // Parse program and extract instructions
            const parsed = JSON.parse(typeof program === 'string' ? program : '{}');
            const instructions: Array<Record<string, unknown>> = Array.isArray(parsed.instructions)
              ? parsed.instructions
              : (Array.isArray(parsed) ? parsed : []);

            // Build relation cache from storage, then run the instruction walker.
            // Invoke instructions yield invoke_pending (coroutine); others execute in-memory.
            let p3 = find(bb, 'node', {}, '_allNodes');
            p3 = find(p3, 'membership', {}, '_allMemberships');
            p3 = mapBindings(p3, (bindings) => {
              const allNodes = (bindings._allNodes as Array<Record<string, unknown>>) || [];
              const allMemberships = (bindings._allMemberships as Array<Record<string, unknown>>) || [];
              const relationCache: Record<string, Array<Record<string, unknown>>> = {
                node: allNodes,
                membership: allMemberships,
              };
              const programId = (parsed.id as string) ?? 'program';
              return executeInstructions(instructions, {}, 0, programId, relationCache);
            }, '_execResult');

            return branch(p3,
              (bb2) => (bb2._execResult as InstructionResult).kind === 'invoke_pending',
              (bb2) => completeFrom(bb2, 'invoke_pending', (bindings) => {
                const result = bindings._execResult as Extract<InstructionResult, { kind: 'invoke_pending' }>;
                return {
                  concept: result.concept,
                  action: result.action,
                  input: result.input,
                  continuation: JSON.stringify(result.continuation),
                };
              }),
              (bb2) => completeFrom(bb2, 'ok', (bindings) => {
                const result = bindings._execResult as Extract<InstructionResult, { kind: 'ok' }>;
                return {
                  rows: result.rows,
                  metadata: JSON.stringify({ kind, instructionCount: result.instructionCount }),
                };
              }),
            );
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  resumeAfterInvoke(input: Record<string, unknown>) {
    const continuationRaw = input.continuation as string;
    const variantRaw = input.variant as string;
    const outputRaw = input.output as string;

    if (!continuationRaw || (typeof continuationRaw === 'string' && continuationRaw.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'continuation is required' }) as StorageProgram<Result>;
    }

    // Parse the continuation — return error if invalid JSON
    let continuation: Continuation;
    try {
      continuation = JSON.parse(continuationRaw) as Continuation;
    } catch {
      return complete(createProgram(), 'error', { message: 'continuation is not valid JSON' }) as StorageProgram<Result>;
    }

    // Parse the invoke output — return error if invalid JSON
    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(typeof outputRaw === 'string' ? outputRaw : '{}');
    } catch {
      return complete(createProgram(), 'error', { message: 'output is not valid JSON' }) as StorageProgram<Result>;
    }

    // Bind the invoke result into the continuation's bindings, then continue execution.
    // We need access to storage for relation data, so we load nodes/memberships.
    let p = createProgram();
    p = find(p, 'node', {}, '_resumeNodes');
    p = find(p, 'membership', {}, '_resumeMemberships');

    // Enrich bindings with the invoke result and continue
    p = mapBindings(p, (storageBindings) => {
      const allNodes = (storageBindings._resumeNodes as Array<Record<string, unknown>>) || [];
      const allMemberships = (storageBindings._resumeMemberships as Array<Record<string, unknown>>) || [];
      const relationCache: Record<string, Array<Record<string, unknown>>> = {
        node: allNodes,
        membership: allMemberships,
      };

      // Merge the invoke result into the continuation's bindings
      const enrichedBindings: Record<string, unknown> = {
        ...continuation.bindings,
        _invokeVariant: variantRaw,
        _invokeOutput: parsedOutput,
      };

      // If this was a traverseInvoke, accumulate the result and advance the index
      const ts = continuation.traverseState;
      if (ts != null) {
        const accumulated = [...ts.accumulatedResults, { variant: variantRaw, ...((parsedOutput as Record<string, unknown>) ?? {}) }];
        enrichedBindings['_traverseResults'] = accumulated;
        enrichedBindings['_traverseIndex'] = ts.currentIndex + 1;
      }

      return executeInstructions(
        continuation.remainingInstructions,
        enrichedBindings,
        0,
        continuation.programId,
        relationCache,
      );
    }, '_resumeResult');

    return branch(p,
      (b) => (b._resumeResult as InstructionResult).kind === 'invoke_pending',
      (b) => completeFrom(b, 'invoke_pending', (bindings) => {
        const result = bindings._resumeResult as Extract<InstructionResult, { kind: 'invoke_pending' }>;
        return {
          concept: result.concept,
          action: result.action,
          input: result.input,
          continuation: JSON.stringify(result.continuation),
        };
      }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const result = bindings._resumeResult as Extract<InstructionResult, { kind: 'ok' }>;
        return {
          rows: result.rows,
          metadata: JSON.stringify({ programId: continuation.programId, instructionCount: result.instructionCount }),
        };
      }),
    ) as StorageProgram<Result>;
  },

  planPushdown(input: Record<string, unknown>) {
    const providerName = input.provider as string;
    const programRaw = input.program as string;

    if (!providerName || (typeof providerName === 'string' && providerName.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', providerName, 'providerRecord');

    return branch(p,
      (b) => b.providerRecord == null,
      (b) => complete(b, 'error', { message: `No provider registered with name "${providerName}"` }),
      (b) => {
        const p2 = mapBindings(b, (_bindings) => {
          try {
            const parsed = JSON.parse(typeof programRaw === 'string' ? programRaw : '{}') as Record<string, unknown>;
            return { ok: true, parsed };
          } catch {
            return { ok: false, message: 'program is not valid JSON' };
          }
        }, '_parseResult');

        return branch(p2,
          (bb) => !(bb._parseResult as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._parseResult as { ok: false; message: string }).message,
          })),
          (bb) => completeFrom(bb, 'ok', (bindings) => {
            const record = bindings.providerRecord as Record<string, unknown>;
            const caps = (record.capabilities ?? []) as string[];
            const capSet = new Set(caps);
            const parsed = (bindings._parseResult as { ok: true; parsed: Record<string, unknown> }).parsed;
            const instructions = (parsed.instructions ?? []) as Array<Record<string, unknown>>;

            const pushdownInstructions = instructions.filter(instr =>
              capSet.has((instr.type as string) ?? ''),
            );
            const residualInstructions = instructions.filter(instr =>
              !capSet.has((instr.type as string) ?? ''),
            );

            return {
              pushdown: JSON.stringify({ instructions: pushdownInstructions }),
              residual: JSON.stringify({ instructions: residualInstructions }),
            };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'provider', {}, 'allProviders');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allProviders ?? []) as Array<Record<string, unknown>>;
      const providers = all.map(r => ({
        name: r.name,
        kind: r.kind,
        capabilities: r.capabilities,
      }));
      return { providers: JSON.stringify(providers) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', name, 'providerRecord');

    return branch(p,
      (b) => b.providerRecord == null,
      (b) => complete(b, 'notfound', { message: `No provider registered with name "${name}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.providerRecord as Record<string, unknown>;
        return {
          provider: record.name as string,
          kind: record.kind as string,
          capabilities: JSON.stringify(record.capabilities ?? []),
        };
      }),
    ) as StorageProgram<Result>;
  },
};

export const queryExecutionHandler = autoInterpret(_handler);
