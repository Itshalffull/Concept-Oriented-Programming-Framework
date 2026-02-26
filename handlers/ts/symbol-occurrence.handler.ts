// ============================================================
// SymbolOccurrence Handler
//
// Records where a Symbol appears in a file -- exact location and
// semantic role. Enables go-to-definition, find-references, and
// rename-refactoring across the entire project.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `symbol-occurrence-${++idCounter}`;
}

export const symbolOccurrenceHandler: ConceptHandler = {
  async record(input: Record<string, unknown>, storage: ConceptStorage) {
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
    await storage.put('symbol-occurrence', id, {
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

    return { variant: 'ok', occurrence: id };
  },

  async findDefinitions(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;

    const all = await storage.find('symbol-occurrence', { symbol });
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

    return { variant: 'ok', occurrences: JSON.stringify(occurrences) };
  },

  async findReferences(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const roleFilter = input.roleFilter as string;

    const all = await storage.find('symbol-occurrence', { symbol });

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

    return { variant: 'ok', occurrences: JSON.stringify(occurrences) };
  },

  async findAtPosition(input: Record<string, unknown>, storage: ConceptStorage) {
    const file = input.file as string;
    const row = input.row as number;
    const col = input.col as number;

    const all = await storage.find('symbol-occurrence', { file });

    // Find an occurrence that spans the given position
    const match = all.find((occ) => {
      const startRow = occ.startRow as number;
      const startCol = occ.startCol as number;
      const endRow = occ.endRow as number;
      const endCol = occ.endCol as number;

      // Position is within the occurrence span
      if (row < startRow || row > endRow) return false;
      if (row === startRow && col < startCol) return false;
      if (row === endRow && col > endCol) return false;
      return true;
    });

    if (!match) {
      return { variant: 'noSymbolAtPosition' };
    }

    return {
      variant: 'ok',
      occurrence: match.id as string,
      symbol: match.symbol as string,
    };
  },

  async findInFile(input: Record<string, unknown>, storage: ConceptStorage) {
    const file = input.file as string;

    const results = await storage.find('symbol-occurrence', { file });

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

    return { variant: 'ok', occurrences: JSON.stringify(occurrences) };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSymbolOccurrenceCounter(): void {
  idCounter = 0;
}
