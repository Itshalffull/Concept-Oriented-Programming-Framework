// ============================================================
// SymbolOccurrence Handler Tests
//
// Tests for recording, querying, and position-based lookup of
// symbol occurrences in files. Supports go-to-definition,
// find-references, and rename-refactoring scenarios.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  symbolOccurrenceHandler,
  resetSymbolOccurrenceCounter,
} from '../handlers/ts/symbol-occurrence.handler.js';

describe('SymbolOccurrence', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSymbolOccurrenceCounter();
  });

  // ── record ────────────────────────────────────────────────

  describe('record', () => {
    it('records an occurrence and returns ok with an id', async () => {
      const result = await symbolOccurrenceHandler.record({
        symbol: 'clef/concept/Article',
        file: 'article.concept',
        startRow: 1, startCol: 9, endRow: 1, endCol: 16,
        startByte: 8, endByte: 15,
        role: 'definition',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.occurrence).toBe('symbol-occurrence-1');
    });

    it('assigns sequential ids', async () => {
      const r1 = await symbolOccurrenceHandler.record({
        symbol: 'sym-A', file: 'a.ts',
        startRow: 1, startCol: 1, endRow: 1, endCol: 5,
        startByte: 0, endByte: 4, role: 'definition',
      }, storage);
      const r2 = await symbolOccurrenceHandler.record({
        symbol: 'sym-B', file: 'b.ts',
        startRow: 2, startCol: 1, endRow: 2, endCol: 5,
        startByte: 10, endByte: 14, role: 'reference',
      }, storage);

      expect(r1.occurrence).toBe('symbol-occurrence-1');
      expect(r2.occurrence).toBe('symbol-occurrence-2');
    });
  });

  // ── findDefinitions ───────────────────────────────────────

  describe('findDefinitions', () => {
    beforeEach(async () => {
      await symbolOccurrenceHandler.record({
        symbol: 'clef/concept/Article', file: 'article.concept',
        startRow: 1, startCol: 9, endRow: 1, endCol: 16,
        startByte: 8, endByte: 15, role: 'definition',
      }, storage);
      await symbolOccurrenceHandler.record({
        symbol: 'clef/concept/Article', file: 'sync.sync',
        startRow: 3, startCol: 5, endRow: 3, endCol: 12,
        startByte: 30, endByte: 37, role: 'reference',
      }, storage);
      await symbolOccurrenceHandler.record({
        symbol: 'clef/concept/Article', file: 'handler.ts',
        startRow: 10, startCol: 1, endRow: 10, endCol: 8,
        startByte: 100, endByte: 107, role: 'definition,export',
      }, storage);
    });

    it('returns only definition occurrences', async () => {
      const result = await symbolOccurrenceHandler.findDefinitions({
        symbol: 'clef/concept/Article',
      }, storage);

      expect(result.variant).toBe('ok');
      const occurrences = JSON.parse(result.occurrences as string);
      expect(occurrences).toHaveLength(2);
      expect(occurrences.every((o: Record<string, string>) =>
        o.role.split(',').map((r: string) => r.trim()).includes('definition')
      )).toBe(true);
    });

    it('returns noDefinitions when none exist', async () => {
      const result = await symbolOccurrenceHandler.findDefinitions({
        symbol: 'clef/concept/NonExistent',
      }, storage);

      expect(result.variant).toBe('noDefinitions');
    });
  });

  // ── findReferences ────────────────────────────────────────

  describe('findReferences', () => {
    beforeEach(async () => {
      await symbolOccurrenceHandler.record({
        symbol: 'sym-X', file: 'a.ts',
        startRow: 1, startCol: 1, endRow: 1, endCol: 5,
        startByte: 0, endByte: 4, role: 'definition',
      }, storage);
      await symbolOccurrenceHandler.record({
        symbol: 'sym-X', file: 'b.ts',
        startRow: 5, startCol: 10, endRow: 5, endCol: 14,
        startByte: 50, endByte: 54, role: 'reference',
      }, storage);
      await symbolOccurrenceHandler.record({
        symbol: 'sym-X', file: 'c.ts',
        startRow: 8, startCol: 3, endRow: 8, endCol: 7,
        startByte: 80, endByte: 84, role: 'reference',
      }, storage);
    });

    it('returns all occurrences when no roleFilter', async () => {
      const result = await symbolOccurrenceHandler.findReferences({
        symbol: 'sym-X', roleFilter: '',
      }, storage);

      expect(result.variant).toBe('ok');
      const occurrences = JSON.parse(result.occurrences as string);
      expect(occurrences).toHaveLength(3);
    });

    it('filters by role', async () => {
      const result = await symbolOccurrenceHandler.findReferences({
        symbol: 'sym-X', roleFilter: 'reference',
      }, storage);

      expect(result.variant).toBe('ok');
      const occurrences = JSON.parse(result.occurrences as string);
      expect(occurrences).toHaveLength(2);
    });

    it('returns noReferences when no matches', async () => {
      const result = await symbolOccurrenceHandler.findReferences({
        symbol: 'nonexistent', roleFilter: '',
      }, storage);

      expect(result.variant).toBe('noReferences');
    });
  });

  // ── findAtPosition ────────────────────────────────────────

  describe('findAtPosition', () => {
    beforeEach(async () => {
      // Occurrence spanning row 5, cols 10-20
      await symbolOccurrenceHandler.record({
        symbol: 'sym-A', file: 'main.ts',
        startRow: 5, startCol: 10, endRow: 5, endCol: 20,
        startByte: 50, endByte: 60, role: 'definition',
      }, storage);
      // Occurrence spanning rows 8-10
      await symbolOccurrenceHandler.record({
        symbol: 'sym-B', file: 'main.ts',
        startRow: 8, startCol: 1, endRow: 10, endCol: 5,
        startByte: 80, endByte: 110, role: 'reference',
      }, storage);
    });

    it('finds symbol at exact start position', async () => {
      const result = await symbolOccurrenceHandler.findAtPosition({
        file: 'main.ts', row: 5, col: 10,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBe('sym-A');
    });

    it('finds symbol at position within span', async () => {
      const result = await symbolOccurrenceHandler.findAtPosition({
        file: 'main.ts', row: 5, col: 15,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBe('sym-A');
    });

    it('finds multi-line occurrence at middle row', async () => {
      const result = await symbolOccurrenceHandler.findAtPosition({
        file: 'main.ts', row: 9, col: 1,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBe('sym-B');
    });

    it('returns noSymbolAtPosition when no match', async () => {
      const result = await symbolOccurrenceHandler.findAtPosition({
        file: 'main.ts', row: 100, col: 1,
      }, storage);

      expect(result.variant).toBe('noSymbolAtPosition');
    });

    it('returns noSymbolAtPosition for wrong file', async () => {
      const result = await symbolOccurrenceHandler.findAtPosition({
        file: 'other.ts', row: 5, col: 10,
      }, storage);

      expect(result.variant).toBe('noSymbolAtPosition');
    });
  });

  // ── findInFile ────────────────────────────────────────────

  describe('findInFile', () => {
    it('returns all occurrences in a file', async () => {
      await symbolOccurrenceHandler.record({
        symbol: 'sym-A', file: 'main.ts',
        startRow: 1, startCol: 1, endRow: 1, endCol: 5,
        startByte: 0, endByte: 4, role: 'definition',
      }, storage);
      await symbolOccurrenceHandler.record({
        symbol: 'sym-B', file: 'main.ts',
        startRow: 10, startCol: 1, endRow: 10, endCol: 5,
        startByte: 100, endByte: 104, role: 'reference',
      }, storage);
      await symbolOccurrenceHandler.record({
        symbol: 'sym-C', file: 'other.ts',
        startRow: 1, startCol: 1, endRow: 1, endCol: 5,
        startByte: 0, endByte: 4, role: 'definition',
      }, storage);

      const result = await symbolOccurrenceHandler.findInFile({ file: 'main.ts' }, storage);
      expect(result.variant).toBe('ok');
      const occurrences = JSON.parse(result.occurrences as string);
      expect(occurrences).toHaveLength(2);
    });

    it('returns empty array for file with no occurrences', async () => {
      const result = await symbolOccurrenceHandler.findInFile({ file: 'empty.ts' }, storage);
      expect(result.variant).toBe('ok');
      const occurrences = JSON.parse(result.occurrences as string);
      expect(occurrences).toHaveLength(0);
    });
  });
});
