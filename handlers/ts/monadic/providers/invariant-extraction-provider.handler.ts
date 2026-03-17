import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

export const invariantExtractionProviderHandler: ConceptHandler = {
  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const conceptSpec = input.conceptSpec as string;

    try {
      const properties: string[] = [];

      // Extract basic properties from instruction patterns
      const readRelations = new Set<string>();
      const writeRelations = new Set<string>();

      try {
        const parsed = JSON.parse(program);
        const instructions = parsed.instructions || [];
        for (const instr of instructions) {
          if (instr.tag === 'get' || instr.tag === 'find') readRelations.add(instr.relation);
          if (instr.tag === 'put') {
            writeRelations.add(instr.relation);
            // For every put, generate a postcondition:
            // "after execution, relation[key] contains the written value"
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
        // Textual format extraction
        const putMatches = program.matchAll(/put\((\w+),\s*(\w+)/g);
        for (const match of putMatches) {
          properties.push(`postcondition: after execution, ${match[1]}[${match[2]}] contains the written value`);
        }
        const delMatches = program.matchAll(/del\((\w+),\s*(\w+)/g);
        for (const match of delMatches) {
          properties.push(`postcondition: after execution, ${match[1]}[${match[2]}] does not exist`);
        }
      }

      // If we have a concept spec, add frame conditions
      if (conceptSpec) {
        for (const rel of readRelations) {
          if (!writeRelations.has(rel)) {
            properties.push(`frame: ${rel} is not modified by this action`);
          }
        }
      }

      const resultId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await storage.put('results', resultId, { properties, conceptRef: conceptSpec });

      return {
        variant: 'ok',
        result: resultId,
        properties: JSON.stringify(properties),
      };
    } catch (e) {
      return { variant: 'error', message: `Invariant extraction failed: ${(e as Error).message}` };
    }
  },
};
