import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, pure, relation, at,
  type StorageProgram, type StateLens,
} from '../../../../runtime/storage-program.ts';

interface ExtractedLens {
  relation: string;
  key?: string;
  field?: string;
  kind: 'relation' | 'record' | 'field';
  access: 'read' | 'write' | 'read-write';
}

interface ParsedInstruction {
  tag: string;
  relation?: string;
  key?: string;
  bindAs?: string;
  lens?: { segments: Array<{ kind: string; name?: string; value?: string }> };
  thenBranch?: { instructions: ParsedInstruction[] };
  elseBranch?: { instructions: ParsedInstruction[] };
  first?: { instructions: ParsedInstruction[] };
  second?: { instructions: ParsedInstruction[] };
}

/** Walk an instruction tree and extract implicit lenses. */
function extractLenses(instructions: ParsedInstruction[]): ExtractedLens[] {
  const lenses: ExtractedLens[] = [];
  const seen = new Set<string>();

  function walk(instrs: ParsedInstruction[]): void {
    for (const instr of instrs) {
      switch (instr.tag) {
        case 'get':
        case 'find': {
          const lensKey = `${instr.relation}:${instr.key || '*'}:read`;
          if (!seen.has(lensKey)) {
            seen.add(lensKey);
            lenses.push({
              relation: instr.relation!,
              key: instr.key || undefined,
              kind: instr.key ? 'record' : 'relation',
              access: 'read',
            });
          }
          break;
        }
        case 'put':
        case 'putFrom':
        case 'del':
        case 'delFrom': {
          const lensKey = `${instr.relation}:${instr.key || '*'}:write`;
          if (!seen.has(lensKey)) {
            seen.add(lensKey);
            lenses.push({
              relation: instr.relation!,
              key: instr.key || undefined,
              kind: instr.key ? 'record' : 'relation',
              access: 'write',
            });
          }
          break;
        }
        case 'merge':
        case 'mergeFrom': {
          const lensKey = `${instr.relation}:${instr.key || '*'}:read-write`;
          if (!seen.has(lensKey)) {
            seen.add(lensKey);
            lenses.push({
              relation: instr.relation!,
              key: instr.key || undefined,
              kind: instr.key ? 'record' : 'relation',
              access: 'read-write',
            });
          }
          break;
        }
        case 'getLens': {
          if (instr.lens) {
            const segs = instr.lens.segments;
            const rel = segs.find(s => s.kind === 'relation');
            const key = segs.find(s => s.kind === 'key');
            const field = segs.find(s => s.kind === 'field');
            if (rel) {
              lenses.push({
                relation: rel.name!,
                key: key?.value,
                field: field?.name,
                kind: field ? 'field' : key ? 'record' : 'relation',
                access: 'read',
              });
            }
          }
          break;
        }
        case 'putLens': {
          if (instr.lens) {
            const segs = instr.lens.segments;
            const rel = segs.find(s => s.kind === 'relation');
            const key = segs.find(s => s.kind === 'key');
            const field = segs.find(s => s.kind === 'field');
            if (rel) {
              lenses.push({
                relation: rel.name!,
                key: key?.value,
                field: field?.name,
                kind: field ? 'field' : key ? 'record' : 'relation',
                access: 'write',
              });
            }
          }
          break;
        }
        case 'modifyLens': {
          if (instr.lens) {
            const segs = instr.lens.segments;
            const rel = segs.find(s => s.kind === 'relation');
            const key = segs.find(s => s.kind === 'key');
            const field = segs.find(s => s.kind === 'field');
            if (rel) {
              lenses.push({
                relation: rel.name!,
                key: key?.value,
                field: field?.name,
                kind: field ? 'field' : key ? 'record' : 'relation',
                access: 'read-write',
              });
            }
          }
          break;
        }
        case 'branch': {
          if (instr.thenBranch?.instructions) walk(instr.thenBranch.instructions);
          if (instr.elseBranch?.instructions) walk(instr.elseBranch.instructions);
          break;
        }
        case 'bind': {
          if (instr.first?.instructions) walk(instr.first.instructions);
          if (instr.second?.instructions) walk(instr.second.instructions);
          break;
        }
      }
    }
  }

  walk(instructions);
  return lenses;
}

/** Build per-lens access pattern summary. */
function buildAccessPattern(lenses: ExtractedLens[]): Record<string, string> {
  const pattern: Record<string, string> = {};
  for (const l of lenses) {
    const key = l.field
      ? `${l.relation}.${l.key || '*'}.${l.field}`
      : l.key
        ? `${l.relation}.${l.key}`
        : l.relation;
    const existing = pattern[key];
    if (!existing) {
      pattern[key] = l.access;
    } else if (existing !== l.access && existing !== 'read-write') {
      pattern[key] = 'read-write';
    }
  }
  return pattern;
}

// Module-scope lens for results relation — dogfooding
const resultsRel = relation('results');

/**
 * LensExtractionProvider — functional handler.
 *
 * Walks a serialized StorageProgram's instruction tree and extracts
 * implicit lens references from string-based storage access.
 */
export const lensExtractionProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const program = input.program as string;

    try {
      const parsed = JSON.parse(program);
      const instructions = parsed.instructions || [];
      const lenses = extractLenses(instructions);
      const accessPattern = buildAccessPattern(lenses);

      const resultId = `lex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const lensesJson = JSON.stringify(lenses);
      const accessPatternJson = JSON.stringify(accessPattern);

      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        lenses: lensesJson,
        accessPattern: accessPatternJson,
      });
      p = pure(p, {
        variant: 'ok',
        result: resultId,
        lenses: lensesJson,
        accessPattern: accessPatternJson,
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
