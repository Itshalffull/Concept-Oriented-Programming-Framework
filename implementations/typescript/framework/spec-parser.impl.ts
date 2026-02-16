// ============================================================
// Stage 1 — SpecParser Concept Implementation
//
// Wraps the Stage 0 kernel's parseConceptFile as a proper
// concept handler. Parses .concept source strings into ASTs
// and stores them keyed by a generated spec reference.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';
import { parseConceptFile } from '../../../kernel/src/parser.js';
import { generateId } from '../../../kernel/src/types.js';

export const specParserHandler: ConceptHandler = {
  async parse(input, storage) {
    const source = input.source as string;
    if (!source || typeof source !== 'string') {
      return { variant: 'error', message: 'source is required and must be a string', line: 0 };
    }

    try {
      const ast = parseConceptFile(source);
      const specId = generateId();

      // Store the spec in the "specs" set relation
      await storage.put('specs', specId, { specId });

      // Store the AST keyed by spec reference
      await storage.put('ast', specId, { specId, ast: JSON.parse(JSON.stringify(ast)) });

      return { variant: 'ok', spec: specId, ast };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Try to extract line number from parse error messages like "Parse error at line 5: ..."
      const lineMatch = message.match(/line (\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : 0;
      return { variant: 'error', message, line };
    }
  },
};
