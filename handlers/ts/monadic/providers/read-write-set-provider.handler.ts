import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

/**
 * Parse a serialized StorageProgram instruction list and extract
 * which relations are read (get/find) and written (put/del).
 */
function extractSets(programStr: string): { readSet: string[]; writeSet: string[] } {
  const readSet = new Set<string>();
  const writeSet = new Set<string>();

  try {
    const parsed = JSON.parse(programStr);
    const instructions = parsed.instructions || parsed.input || [];
    if (typeof instructions === 'string') {
      // Simple textual program format: "get(rel, key); put(rel, key, val)"
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
    // Try simple textual format
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

export const readWriteSetProviderHandler: ConceptHandler = {
  async analyze(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;

    try {
      const { readSet, writeSet } = extractSets(program);
      let purity: string;
      if (writeSet.length > 0) purity = 'read-write';
      else if (readSet.length > 0) purity = 'read-only';
      else purity = 'pure';

      const resultId = `rws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await storage.put('results', resultId, {
        readSet: JSON.stringify(readSet),
        writeSet: JSON.stringify(writeSet),
        purity,
      });

      return {
        variant: 'ok',
        result: resultId,
        readSet: JSON.stringify(readSet),
        writeSet: JSON.stringify(writeSet),
        purity,
      };
    } catch (e) {
      return { variant: 'error', message: `Failed to analyze program: ${(e as Error).message}` };
    }
  },
};
