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
};

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
            return withReadField(appendInstruction(rec, instruction), source) as unknown as Record<string, unknown>;
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
            return appendInstruction(rec, instruction) as unknown as Record<string, unknown>;
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
            return appendInstruction(rec, instruction) as unknown as Record<string, unknown>;
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
            return appendInstruction(rec, instruction) as unknown as Record<string, unknown>;
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
            return appendInstruction(rec, instruction) as unknown as Record<string, unknown>;
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
            return appendInstruction(rec, instruction) as unknown as Record<string, unknown>;
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
          const composed: ProgramRecord = {
            program: composedId,
            instructions: combinedInstructions,
            bindings: [],
            terminated: r2.terminated,
            readFields: Array.from(readFieldSet),
          };
          return composed as unknown as Record<string, unknown>;
        });
        return complete(b2, 'ok', { program: composedId }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

};

export const queryProgramHandler = autoInterpret(_handler);
