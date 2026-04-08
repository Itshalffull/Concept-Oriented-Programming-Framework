// @clef-handler style=functional concept=QueryProgram
// QueryProgram Concept Implementation — Functional (StorageProgram) style
//
// Each action appends an instruction to the program's ordered instruction
// list and persists the updated record. Programs are terminated via pure()
// and composed via compose(). The program key is caller-supplied (not
// computed at runtime), so functional style with put() static keys works.
//
// Sealed variant: program exists but terminated = true.
// Notfound variant: program does not exist in storage.
//
// See architecture doc Section 10.1 for StorageProgram monad patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Record helpers ─────────────────────────────────────────────────────────

type ProgramRecord = {
  program: string;
  instructions: string[];
  bindings: string[];
  terminated: boolean;
  readFields: string[];
  invokedActions: string[];  // concept/action pairs
  purity: string;            // "pure" | "read-only" | "read-write"
};

// ─── Purity helpers ──────────────────────────────────────────────────────────

function promotePurity(current: string, to: string): string {
  const levels: Record<string, number> = { 'pure': 0, 'read-only': 1, 'read-write': 2 };
  return (levels[to] ?? 0) > (levels[current] ?? 0) ? to : current;
}

function appendInstruction(rec: ProgramRecord, instruction: Record<string, unknown>): ProgramRecord {
  return {
    ...rec,
    instructions: [...rec.instructions, JSON.stringify(instruction)],
  };
}

function withReadField(rec: ProgramRecord, field: string): ProgramRecord {
  if (rec.readFields.includes(field)) return rec;
  return { ...rec, readFields: [...rec.readFields, field] };
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    const program = input.program as string;

    // Guard: program identifier must be non-empty
    if (!program || (typeof program === 'string' && program.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'program identifier is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = put(b, 'queryProgram', program, {
          program,
          instructions: [],
          bindings: [],
          terminated: false,
          readFields: [],
          invokedActions: [],
          purity: 'pure',
        });
        return complete(b2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },

  scan(input: Record<string, unknown>) {
    const program = input.program as string;
    const source = input.source as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'scan', source, bindAs };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = withReadField(appendInstruction(rec, instruction), source);
            return { ...updated, purity: promotePurity(updated.purity ?? 'pure', 'read-only') } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  filter(input: Record<string, unknown>) {
    const program = input.program as string;
    const node = input.node as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'filter', node, bindAs };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            return { ...updated, purity: promotePurity(updated.purity ?? 'pure', 'read-only') } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  sort(input: Record<string, unknown>) {
    const program = input.program as string;
    const keys = input.keys as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'sort', keys, bindAs };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            return { ...updated, purity: promotePurity(updated.purity ?? 'pure', 'read-only') } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  group(input: Record<string, unknown>) {
    const program = input.program as string;
    const keys = input.keys as string;
    const config = input.config as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'group', keys, config, bindAs };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            return { ...updated, purity: promotePurity(updated.purity ?? 'pure', 'read-only') } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  project(input: Record<string, unknown>) {
    const program = input.program as string;
    const fields = input.fields as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'project', fields, bindAs };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            return { ...updated, purity: promotePurity(updated.purity ?? 'pure', 'read-only') } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  limit(input: Record<string, unknown>) {
    const program = input.program as string;
    const count = input.count as number;
    const output = input.output as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'limit', count, output };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            return { ...updated, purity: promotePurity(updated.purity ?? 'pure', 'read-only') } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  pure(input: Record<string, unknown>) {
    const program = input.program as string;
    const variant = input.variant as string;
    const output = input.output as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'pure', variant, output };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const withInstruction = appendInstruction(rec, instruction);
            return { ...withInstruction, terminated: true } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program, terminated: true }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  join(input: Record<string, unknown>) {
    const programId = input.program as string;
    const source = input.source as string;
    const localField = input.localField as string;
    const foreignField = input.foreignField as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', programId, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'join', source, localField, foreignField, bindAs };
          let b2 = putFrom(bb, 'queryProgram', programId, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = withReadField(appendInstruction(rec, instruction), localField);
            const existingBindings = updated.bindings ?? [];
            const newBindings = existingBindings.includes(bindAs)
              ? existingBindings
              : [...existingBindings, bindAs];
            return {
              ...updated,
              bindings: newBindings,
              purity: promotePurity(updated.purity ?? 'pure', 'read-only'),
            } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program: programId }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  compose(input: Record<string, unknown>) {
    const first = input.first as string;
    const second = input.second as string;
    const bindAs = input.bindAs as string;

    // The composed program ID is deterministic from the two input IDs.
    const composedId = `${first}+${second}`;

    let p = createProgram();
    p = get(p, 'queryProgram', first, 'firstProg');
    p = get(p, 'queryProgram', second, 'secondProg');
    p = mapBindings(p, (b) => b.firstProg == null || b.secondProg == null ? 'notfound' : 'ok', '_composeState');

    return branch(p,
      (b) => b._composeState === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => {
        let b2 = putFrom(b, 'queryProgram', composedId, (bindings) => {
          const r1 = bindings.firstProg as ProgramRecord;
          const r2 = bindings.secondProg as ProgramRecord;
          const combinedInstructions = [
            ...r1.instructions,
            JSON.stringify({ type: 'bind', bindAs }),
            ...r2.instructions,
          ];
          const readFieldSet = new Set<string>([...r1.readFields, ...r2.readFields]);
          const invokedActionSet = new Set<string>([
            ...(r1.invokedActions ?? []),
            ...(r2.invokedActions ?? []),
          ]);
          const composedPurity = promotePurity(r1.purity ?? 'pure', r2.purity ?? 'pure');
          const composed: ProgramRecord = {
            program: composedId,
            instructions: combinedInstructions,
            bindings: [],
            terminated: r2.terminated,
            readFields: Array.from(readFieldSet),
            invokedActions: Array.from(invokedActionSet),
            purity: composedPurity,
          };
          return composed as unknown as Record<string, unknown>;
        });
        return complete(b2, 'ok', { program: composedId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  invoke(input: Record<string, unknown>) {
    const program = input.program as string;
    const concept = input.concept as string;
    const action = input.action as string;
    const invokeInput = input.input as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'invoke', concept, action, input: invokeInput, bindAs };
          const conceptActionPair = `${concept}/${action}`;
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            const existingBindings = updated.bindings ?? [];
            const newBindings = existingBindings.includes(bindAs)
              ? existingBindings
              : [...existingBindings, bindAs];
            const existingInvokedActions = updated.invokedActions ?? [];
            const newInvokedActions = existingInvokedActions.includes(conceptActionPair)
              ? existingInvokedActions
              : [...existingInvokedActions, conceptActionPair];
            return {
              ...updated,
              bindings: newBindings,
              invokedActions: newInvokedActions,
              purity: promotePurity(updated.purity ?? 'pure', 'read-write'),
            } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  match(input: Record<string, unknown>) {
    const program = input.program as string;
    const binding = input.binding as string;
    const casesStr = input.cases as string;
    const bindAs = input.bindAs as string;

    // Validate cases JSON before any storage operations
    let parsedCases: Record<string, unknown>;
    try {
      parsedCases = JSON.parse(casesStr);
    } catch {
      // Must check program exists first, then return invalid_cases
      // But per spec, invalid JSON cases → invalid_cases regardless
      let p = createProgram();
      p = get(p, 'queryProgram', program, 'existing');
      p = mapBindings(p, (b) => b.existing == null ? 'notfound' : 'ok', '_state');
      return branch(p,
        (b) => b._state === 'notfound',
        (b) => complete(b, 'notfound', {}),
        (b) => complete(b, 'invalid_cases', {}),
      ) as StorageProgram<Result>;
    }

    // Validate cases is non-empty
    if (Object.keys(parsedCases).length === 0) {
      let p = createProgram();
      p = get(p, 'queryProgram', program, 'existing');
      p = mapBindings(p, (b) => b.existing == null ? 'notfound' : 'ok', '_state');
      return branch(p,
        (b) => b._state === 'notfound',
        (b) => complete(b, 'notfound', {}),
        (b) => complete(b, 'invalid_cases', {}),
      ) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'match', binding, cases: casesStr, bindAs };
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            const existingBindings = updated.bindings ?? [];
            const newBindings = existingBindings.includes(bindAs)
              ? existingBindings
              : [...existingBindings, bindAs];
            return {
              ...updated,
              bindings: newBindings,
            } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  traverseInvoke(input: Record<string, unknown>) {
    const program = input.program as string;
    const sourceBinding = input.sourceBinding as string;
    const itemBinding = input.itemBinding as string;
    const concept = input.concept as string;
    const action = input.action as string;
    const inputTemplate = input.inputTemplate as string;
    const bindAs = input.bindAs as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => {
          const instruction = { type: 'traverseInvoke', sourceBinding, itemBinding, concept, action, inputTemplate, bindAs };
          const conceptActionPair = `${concept}/${action}`;
          let b2 = putFrom(bb, 'queryProgram', program, (bindings) => {
            const rec = bindings.existing as ProgramRecord;
            const updated = appendInstruction(rec, instruction);
            const existingBindings = updated.bindings ?? [];
            const newBindings = existingBindings.includes(bindAs)
              ? existingBindings
              : [...existingBindings, bindAs];
            const existingInvokedActions = updated.invokedActions ?? [];
            const newInvokedActions = existingInvokedActions.includes(conceptActionPair)
              ? existingInvokedActions
              : [...existingInvokedActions, conceptActionPair];
            return {
              ...updated,
              bindings: newBindings,
              invokedActions: newInvokedActions,
              purity: promotePurity(updated.purity ?? 'pure', 'read-write'),
            } as unknown as Record<string, unknown>;
          });
          return complete(b2, 'ok', { program }) as StorageProgram<Result>;
        },
      ),
    ) as StorageProgram<Result>;
  },

  traverse(input: Record<string, unknown>) {
    const program = input.program as string;
    const sourceBinding = input.sourceBinding as string;
    const itemBinding = input.itemBinding as string;
    const bodyProgram = input.bodyProgram as string;
    const bindAs = input.bindAs as string;
    const declaredEffectsStr = input.declaredEffects as string;

    let p = createProgram();
    p = get(p, 'queryProgram', program, 'existing');
    p = get(p, 'queryProgram', bodyProgram, 'bodyExisting');
    p = mapBindings(p, (b) => {
      if (b.existing == null) return 'notfound';
      if (b.bodyExisting == null) return 'body_notfound';
      const rec = b.existing as ProgramRecord;
      if (rec.terminated) return 'sealed';
      const bodyRec = b.bodyExisting as ProgramRecord;
      if (!bodyRec.terminated) return 'not_sealed';
      return 'ok';
    }, '_state');

    return branch(p,
      (b) => b._state === 'notfound' || b._state === 'body_notfound',
      (b) => complete(b, 'notfound', {}),
      (b) => branch(b,
        (bb) => bb._state === 'sealed',
        (bb) => complete(bb, 'sealed', {}),
        (bb) => branch(bb,
          (bbb) => bbb._state === 'not_sealed',
          (bbb) => complete(bbb, 'not_sealed', {}),
          (bbb) => {
            const instruction = { type: 'traverse', sourceBinding, itemBinding, bodyProgram, bindAs, declaredEffects: declaredEffectsStr };
            let b2 = putFrom(bbb, 'queryProgram', program, (bindings) => {
              const rec = bindings.existing as ProgramRecord;
              const bodyRec = bindings.bodyExisting as ProgramRecord;
              const updated = appendInstruction(rec, instruction);
              const existingBindings = updated.bindings ?? [];
              const newBindings = existingBindings.includes(bindAs)
                ? existingBindings
                : [...existingBindings, bindAs];

              // Parse declared effects to extract invokedActions and purity hints
              let newInvokedActions = [...(updated.invokedActions ?? [])];
              let newPurity = updated.purity ?? 'pure';

              let declaredEffects: Record<string, unknown> = {};
              try {
                declaredEffects = JSON.parse(declaredEffectsStr ?? '{}');
              } catch {
                // ignore parse errors on declaredEffects — treat as empty
              }

              if (Array.isArray(declaredEffects.invokedActions)) {
                for (const ia of declaredEffects.invokedActions as string[]) {
                  if (!newInvokedActions.includes(ia)) {
                    newInvokedActions = [...newInvokedActions, ia];
                  }
                  newPurity = promotePurity(newPurity, 'read-write');
                }
              }

              // Inherit purity from body program
              if (bodyRec.purity === 'read-write') {
                newPurity = promotePurity(newPurity, 'read-write');
              }

              return {
                ...updated,
                bindings: newBindings,
                invokedActions: newInvokedActions,
                purity: newPurity,
              } as unknown as Record<string, unknown>;
            });
            return complete(b2, 'ok', { program }) as StorageProgram<Result>;
          },
        ),
      ),
    ) as StorageProgram<Result>;
  },

};

export const queryProgramHandler = autoInterpret(_handler);
