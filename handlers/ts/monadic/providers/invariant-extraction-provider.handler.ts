// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, put, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * InvariantExtractionProvider — functional handler.
 *
 * Extracts formal properties (postconditions, frame conditions) from a
 * program's instruction set. Returns a StorageProgram that stores and
 * returns the extracted invariants.
 */
export const invariantExtractionProviderHandler: FunctionalConceptHandler = {
  extract(input: Record<string, unknown>) {
    if (!input.program || (typeof input.program === 'string' && (input.program as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'program is required' }) as StorageProgram<Result>;
    }
    const program = input.program as string;
    const conceptSpec = input.conceptSpec as string;

    try {
      const properties: string[] = [];
      const readRelations = new Set<string>();
      const writeRelations = new Set<string>();

      try {
        const parsed = JSON.parse(program);
        const instructions = parsed.instructions || [];
        for (const instr of instructions) {
          if (instr.tag === 'get' || instr.tag === 'find') readRelations.add(instr.relation);
          if (instr.tag === 'put') {
            writeRelations.add(instr.relation);
            properties.push(
              `postcondition: after execution, ${instr.relation}[${instr.key}] contains the written value`,
            );
          }
          if (instr.tag === 'del') {
            writeRelations.add(instr.relation);
            properties.push(
              `postcondition: after execution, ${instr.relation}[${instr.key}] does not exist`,
            );
          }
        }
      } catch {
        const putMatches = program.matchAll(/put\((\w+),\s*(\w+)/g);
        for (const match of putMatches) {
          properties.push(`postcondition: after execution, ${match[1]}[${match[2]}] contains the written value`);
        }
        const delMatches = program.matchAll(/del\((\w+),\s*(\w+)/g);
        for (const match of delMatches) {
          properties.push(`postcondition: after execution, ${match[1]}[${match[2]}] does not exist`);
        }
      }

      // Frame conditions: relations read but not written
      if (conceptSpec) {
        for (const rel of readRelations) {
          if (!writeRelations.has(rel)) {
            properties.push(`frame: ${rel} is not modified by this action`);
          }
        }
      }

      const resultId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = put(p, 'results', resultId, { properties, conceptRef: conceptSpec });
      p = pure(p, {
        variant: 'ok',
        result: resultId,
        properties: JSON.stringify(properties),
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Invariant extraction failed: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
