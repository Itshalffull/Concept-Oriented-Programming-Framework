// @clef-handler style=functional
// ============================================================
// QueryPurityProvider Handler
//
// Classifies a QueryProgram's purity and extracts read fields
// plus invoked actions by walking its instruction tree.
//
// Purity classification:
//   pure       — no instructions
//   read-only  — only read instructions (scan, filter, sort,
//                group, project, join, limit)
//   read-write — any invoke, traverseInvoke, or traverse whose
//                body/declaredEffects includes invocations
//
// See Architecture doc Section 16 (StorageProgram Monad) and
// the view suite for QueryProgram instruction definitions.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Field-extraction helpers
// ---------------------------------------------------------------------------

/** Extract field names referenced by a FilterNode predicate tree. */
function extractFilterFields(node: unknown, fields: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;

  if (typeof n.field === 'string') {
    fields.add(n.field);
  }
  // Recurse into composite nodes
  if (Array.isArray(n.children)) {
    for (const child of n.children) extractFilterFields(child, fields);
  }
  if (n.child) extractFilterFields(n.child, fields);
}

/**
 * Walk a parsed instruction list, collecting readFields and invokedActions.
 * Returns purity contribution: 'invoke' if any invocations found, else 'read'.
 */
function walkInstructions(
  instructions: unknown[],
  readFields: Set<string>,
  invokedActions: Set<string>,
): 'invoke' | 'read' {
  if (!Array.isArray(instructions)) return 'read';

  let hasInvoke = false;

  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Record<string, unknown>;

    switch (i.tag ?? i.type) {
      case 'scan': {
        if (typeof i.source === 'string') readFields.add(i.source);
        break;
      }
      case 'filter': {
        extractFilterFields(i.predicate ?? i.filter, readFields);
        break;
      }
      case 'sort': {
        // keys is an array of { field, direction }
        const keys = i.keys ?? i.sortKeys;
        if (Array.isArray(keys)) {
          for (const k of keys) {
            if (k && typeof k === 'object' && typeof (k as Record<string, unknown>).field === 'string') {
              readFields.add((k as Record<string, unknown>).field as string);
            }
          }
        }
        break;
      }
      case 'group': {
        // grouping keys
        const config = i.config as Record<string, unknown> | undefined;
        const grouping = config?.grouping ?? i.grouping;
        if (grouping && typeof grouping === 'object') {
          const g = grouping as Record<string, unknown>;
          if (Array.isArray(g.keys)) {
            for (const k of g.keys) {
              if (typeof k === 'string') readFields.add(k);
            }
          }
        }
        break;
      }
      case 'project': {
        const fields = i.fields;
        if (Array.isArray(fields)) {
          for (const f of fields) {
            if (f && typeof f === 'object') {
              const fObj = f as Record<string, unknown>;
              if (typeof fObj.key === 'string') readFields.add(fObj.key);
            } else if (typeof f === 'string') {
              readFields.add(f);
            }
          }
        }
        break;
      }
      case 'join': {
        if (typeof i.localField === 'string') readFields.add(i.localField);
        if (typeof i.foreignField === 'string') readFields.add(i.foreignField);
        if (typeof i.source === 'string') readFields.add(i.source);
        break;
      }
      case 'limit': {
        // limit contributes to readFields by field name convention; no field to extract
        // (limit is read-class but carries no field name)
        break;
      }
      case 'invoke': {
        const concept = i.concept as string | undefined;
        const action = i.action as string | undefined;
        if (concept && action) invokedActions.add(`${concept}/${action}`);
        hasInvoke = true;
        break;
      }
      case 'traverseInvoke': {
        const concept = i.concept as string | undefined;
        const action = i.action as string | undefined;
        if (concept && action) invokedActions.add(`${concept}/${action}`);
        // Also merge any declared invocations
        const de = i.declaredEffects as Record<string, unknown> | undefined;
        if (de?.invokedActions && Array.isArray(de.invokedActions)) {
          for (const pair of de.invokedActions as string[]) invokedActions.add(pair);
        }
        hasInvoke = true;
        break;
      }
      case 'traverse': {
        // Prefer declaredEffects.invokedActions; fall back to body walk
        const de = i.declaredEffects as Record<string, unknown> | undefined;
        const deInvocations = de?.invokedActions ?? de?.invocations;
        if (deInvocations && Array.isArray(deInvocations) && deInvocations.length > 0) {
          for (const pair of deInvocations as string[]) invokedActions.add(pair);
          hasInvoke = true;
        } else {
          // Walk body sub-program
          const body = i.body ?? i.bodyProgram;
          if (body) {
            const bodyResult = walkSubProgram(body, readFields, invokedActions);
            if (bodyResult === 'invoke') hasInvoke = true;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return hasInvoke ? 'invoke' : 'read';
}

function walkSubProgram(
  subProgram: unknown,
  readFields: Set<string>,
  invokedActions: Set<string>,
): 'invoke' | 'read' {
  if (!subProgram) return 'read';

  if (typeof subProgram === 'string') {
    try {
      const parsed = JSON.parse(subProgram) as Record<string, unknown>;
      return walkInstructions(
        (parsed.instructions ?? []) as unknown[],
        readFields,
        invokedActions,
      );
    } catch { return 'read'; }
  } else if (typeof subProgram === 'object') {
    const obj = subProgram as Record<string, unknown>;
    return walkInstructions(
      (obj.instructions ?? []) as unknown[],
      readFields,
      invokedActions,
    );
  }
  return 'read';
}

/**
 * Core analysis: parse the program JSON, walk instructions, classify purity.
 */
function analyzePurity(programStr: string): {
  readFields: string[];
  invokedActions: string[];
  purity: 'pure' | 'read-only' | 'read-write';
} {
  const parsed = JSON.parse(programStr) as Record<string, unknown>;
  const instructions = (parsed.instructions ?? []) as unknown[];

  const readFieldsSet = new Set<string>();
  const invokedActionsSet = new Set<string>();

  // Fast path: structural invocations from the program's built-in effect set
  const structuralInvocations = (parsed.effects as Record<string, unknown> | undefined)?.invocations;
  if (Array.isArray(structuralInvocations) && structuralInvocations.length > 0) {
    for (const inv of structuralInvocations as string[]) invokedActionsSet.add(inv);
  }

  const walkResult = walkInstructions(instructions, readFieldsSet, invokedActionsSet);

  let purity: 'pure' | 'read-only' | 'read-write';
  if (instructions.length === 0) {
    purity = 'pure';
  } else if (walkResult === 'invoke' || invokedActionsSet.size > 0) {
    purity = 'read-write';
  } else {
    purity = 'read-only';
  }

  return {
    readFields: [...readFieldsSet],
    invokedActions: [...invokedActionsSet],
    purity,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const _handler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    // Input validation — empty program is an error
    if (
      !input.program ||
      (typeof input.program === 'string' && (input.program as string).trim() === '')
    ) {
      return complete(createProgram(), 'error', {
        message: 'program is required',
      }) as StorageProgram<Result>;
    }

    const program = input.program as string;

    // JSON.parse safety
    try {
      JSON.parse(program);
    } catch {
      return complete(createProgram(), 'error', {
        message: 'program must be valid JSON',
      }) as StorageProgram<Result>;
    }

    try {
      const { readFields, invokedActions, purity } = analyzePurity(program);
      const resultId = `qpp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const readFieldsJson = JSON.stringify(readFields);
      const invokedActionsJson = JSON.stringify(invokedActions);

      let p = createProgram();
      p = put(p, 'queryPurityResult', resultId, {
        readFields: readFieldsJson,
        invokedActions: invokedActionsJson,
        purity,
      });
      p = complete(p, 'ok', {
        result: resultId,
        readFields: readFieldsJson,
        invokedActions: invokedActionsJson,
        purity,
      });
      return p as StorageProgram<Result>;
    } catch (e) {
      return complete(createProgram(), 'error', {
        message: `Failed to analyze program: ${(e as Error).message}`,
      }) as StorageProgram<Result>;
    }
  },

  get(input: Record<string, unknown>) {
    const resultId = input.result as string;

    let p = createProgram();
    p = get(p, 'queryPurityResult', resultId, 'record');

    p = branch(
      p,
      'record',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            readFields: record.readFields as string,
            invokedActions: record.invokedActions as string,
            purity: record.purity as string,
          };
        }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },
};

export const queryPurityProviderHandler = autoInterpret(_handler);
