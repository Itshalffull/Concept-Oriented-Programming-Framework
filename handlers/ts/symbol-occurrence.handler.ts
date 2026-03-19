// @migrated dsl-constructs 2026-03-18
// ============================================================
// SymbolOccurrence Handler
//
// Records where a Symbol appears in a file -- exact location and
// semantic role. Enables go-to-definition, find-references, and
// rename-refactoring across the entire project.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `symbol-occurrence-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  record(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const file = input.file as string;
    const startRow = input.startRow as number;
    const startCol = input.startCol as number;
    const endRow = input.endRow as number;
    const endCol = input.endCol as number;
    const startByte = input.startByte as number;
    const endByte = input.endByte as number;
    const role = input.role as string;

    const id = nextId();
    let p = createProgram();
    p = put(p, 'symbol-occurrence', id, {
      id,
      symbol,
      file,
      startRow,
      startCol,
      endRow,
      endCol,
      startByte,
      endByte,
      role,
      enclosingSymbol: '',
    });

    return complete(p, 'ok', { occurrence: id }) as StorageProgram<Result>;
  },

  findDefinitions(input: Record<string, unknown>) {
    const symbol = input.symbol as string;

    let p = createProgram();
    p = find(p, 'symbol-occurrence', { symbol }, 'all');

    return completeFrom(p, 'ok', (b) => {
      const all = b.all as Record<string, unknown>[];
      const definitions = all.filter((occ) => {
        const role = occ.role as string;
        return role.split(',').map((r) => r.trim()).includes('definition');
      });

      if (definitions.length === 0) {
        return { variant: 'noDefinitions' };
      }

      const occurrences = definitions.map((occ) => ({
        id: occ.id,
        symbol: occ.symbol,
        file: occ.file,
        startRow: occ.startRow,
        startCol: occ.startCol,
        endRow: occ.endRow,
        endCol: occ.endCol,
        startByte: occ.startByte,
        endByte: occ.endByte,
        role: occ.role,
      }));

      return { occurrences: JSON.stringify(occurrences) };
    }) as StorageProgram<Result>;
  },

  findReferences(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const roleFilter = input.roleFilter as string;

    let p = createProgram();
    p = find(p, 'symbol-occurrence', { symbol }, 'all');

    return completeFrom(p, 'ok', (b) => {
      const all = b.all as Record<string, unknown>[];

      let filtered = all;
      if (roleFilter !== undefined && roleFilter !== '') {
        filtered = all.filter((occ) => {
          const roles = (occ.role as string).split(',').map((r) => r.trim());
          return roles.includes(roleFilter);
        });
      }

      if (filtered.length === 0) {
        return { variant: 'noReferences' };
      }

      const occurrences = filtered.map((occ) => ({
        id: occ.id,
        symbol: occ.symbol,
        file: occ.file,
        startRow: occ.startRow,
        startCol: occ.startCol,
        endRow: occ.endRow,
        endCol: occ.endCol,
        startByte: occ.startByte,
        endByte: occ.endByte,
        role: occ.role,
      }));

      return { occurrences: JSON.stringify(occurrences) };
    }) as StorageProgram<Result>;
  },

  findAtPosition(input: Record<string, unknown>) {
    const file = input.file as string;
    const row = input.row as number;
    const col = input.col as number;

    let p = createProgram();
    p = find(p, 'symbol-occurrence', { file }, 'all');

    return completeFrom(p, 'ok', (b) => {
      const all = b.all as Record<string, unknown>[];

      const match = all.find((occ) => {
        const startRow = occ.startRow as number;
        const startCol = occ.startCol as number;
        const endRow = occ.endRow as number;
        const endCol = occ.endCol as number;

        if (row < startRow || row > endRow) return false;
        if (row === startRow && col < startCol) return false;
        if (row === endRow && col > endCol) return false;
        return true;
      });

      if (!match) {
        return { variant: 'noSymbolAtPosition' };
      }

      return {
        occurrence: match.id as string,
        symbol: match.symbol as string,
      };
    }) as StorageProgram<Result>;
  },

  findInFile(input: Record<string, unknown>) {
    const file = input.file as string;

    let p = createProgram();
    p = find(p, 'symbol-occurrence', { file }, 'results');

    return completeFrom(p, 'ok', (b) => {
      const results = b.results as Record<string, unknown>[];
      const occurrences = results.map((occ) => ({
        id: occ.id,
        symbol: occ.symbol,
        file: occ.file,
        startRow: occ.startRow,
        startCol: occ.startCol,
        endRow: occ.endRow,
        endCol: occ.endCol,
        startByte: occ.startByte,
        endByte: occ.endByte,
        role: occ.role,
      }));

      return { occurrences: JSON.stringify(occurrences) };
    }) as StorageProgram<Result>;
  },
};

export const symbolOccurrenceHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSymbolOccurrenceCounter(): void {
  idCounter = 0;
}
