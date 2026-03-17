import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * Parse a serialized StorageProgram and extract read/write sets.
 *
 * Fast path: if the serialized program includes structural effects
 * (accumulated during construction), use those directly — O(1).
 *
 * Fallback: walk the instruction list for programs that lack
 * structural effects (e.g., deserialized from older format or
 * built outside the DSL).
 */
function extractSets(programStr: string): { readSet: string[]; writeSet: string[] } {
  const readSet = new Set<string>();
  const writeSet = new Set<string>();

  try {
    const parsed = JSON.parse(programStr);

    // Fast path: structural effects from the program itself
    if (parsed.effects) {
      const reads: string[] = Array.isArray(parsed.effects.reads) ? parsed.effects.reads : [];
      const writes: string[] = Array.isArray(parsed.effects.writes) ? parsed.effects.writes : [];
      return { readSet: reads, writeSet: writes };
    }

    // Fallback: instruction walk
    const instructions = parsed.instructions || parsed.input || [];
    if (typeof instructions === 'string') {
      const ops = instructions.split(';').map((s: string) => s.trim());
      for (const op of ops) {
        const match = op.match(/^(get|find|put|del)\((\w+)/);
        if (match) {
          const [, tag, relation] = match;
          if (tag === 'get' || tag === 'find') readSet.add(relation);
          if (tag === 'put' || tag === 'del') writeSet.add(relation);
        }
      }
    } else if (Array.isArray(instructions)) {
      for (const instr of instructions) {
        if (instr.tag === 'get' || instr.tag === 'find') readSet.add(instr.relation);
        if (instr.tag === 'put' || instr.tag === 'del') writeSet.add(instr.relation);
      }
    }
  } catch {
    const ops = programStr.split(';').map(s => s.trim());
    for (const op of ops) {
      const match = op.match(/^(get|find|put|del)\((\w+)/);
      if (match) {
        const [, tag, relation] = match;
        if (tag === 'get' || tag === 'find') readSet.add(relation);
        if (tag === 'put' || tag === 'del') writeSet.add(relation);
      }
    }
  }

  return { readSet: [...readSet], writeSet: [...writeSet] };
}

/**
 * ReadWriteSetProvider — functional handler.
 *
 * Analyzes a serialized program and returns a StorageProgram that
 * stores the analysis result and returns read/write sets + purity.
 *
 * Prefers structural effects from the program's built-in effect
 * tracking (accumulated during construction). Falls back to
 * instruction-walk for programs without structural effects.
 */
export const readWriteSetProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const program = input.program as string;

    try {
      const { readSet, writeSet } = extractSets(program);
      let purity: string;
      if (writeSet.length > 0) purity = 'read-write';
      else if (readSet.length > 0) purity = 'read-only';
      else purity = 'pure';

      const resultId = `rws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = put(p, 'results', resultId, {
        readSet: JSON.stringify(readSet),
        writeSet: JSON.stringify(writeSet),
        purity,
      });
      p = pure(p, {
        variant: 'ok',
        result: resultId,
        readSet: JSON.stringify(readSet),
        writeSet: JSON.stringify(writeSet),
        purity,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Failed to analyze program: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
