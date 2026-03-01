// ConceptSpecSymbolExtractor — Extracts symbols from .concept spec files
// including concept names, state field names, action names, type aliases,
// and event declarations with source location metadata.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ConceptSpecSymbolExtractorStorage,
  ConceptSpecSymbolExtractorInitializeInput,
  ConceptSpecSymbolExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface ConceptSpecSymbolExtractorError {
  readonly code: string;
  readonly message: string;
}

interface ExtractedSymbol {
  readonly name: string;
  readonly kind: 'concept' | 'state-field' | 'action' | 'type' | 'event' | 'invariant';
  readonly qualifiedName: string;
  readonly file: string;
  readonly exported: boolean;
}

// --- Helpers ---

const storageError = (error: unknown): ConceptSpecSymbolExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `csse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Extract symbols from a concept spec (JSON-encoded or simplified text)
const extractSymbols = (file: string, specBody: string): readonly ExtractedSymbol[] => {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(specBody);
  } catch {
    // Attempt line-based extraction for non-JSON .concept files
    return extractFromLines(file, specBody);
  }

  const symbols: ExtractedSymbol[] = [];
  const conceptName = String(spec['name'] ?? '');

  if (conceptName !== '') {
    // The concept name itself is a symbol
    symbols.push({
      name: conceptName,
      kind: 'concept',
      qualifiedName: conceptName,
      file,
      exported: true,
    });
  }

  // State fields
  const state = spec['state'];
  if (state !== null && typeof state === 'object' && !Array.isArray(state)) {
    for (const [fieldName, fieldDef] of Object.entries(state as Record<string, unknown>)) {
      const exported = typeof fieldDef === 'object' && fieldDef !== null
        ? Boolean((fieldDef as Record<string, unknown>)['exported'] ?? true)
        : true;
      symbols.push({
        name: fieldName,
        kind: 'state-field',
        qualifiedName: conceptName !== '' ? `${conceptName}.${fieldName}` : fieldName,
        file,
        exported,
      });
    }
  }

  // Actions
  const actions = spec['actions'];
  if (Array.isArray(actions)) {
    for (const action of actions) {
      const actionName = typeof action === 'string'
        ? action
        : String((action as Record<string, unknown>)?.['name'] ?? '');
      if (actionName !== '') {
        symbols.push({
          name: actionName,
          kind: 'action',
          qualifiedName: conceptName !== '' ? `${conceptName}.${actionName}` : actionName,
          file,
          exported: true,
        });
      }
    }
  }

  // Types
  const types = spec['types'];
  if (Array.isArray(types)) {
    for (const t of types) {
      const typeName = typeof t === 'string'
        ? t
        : String((t as Record<string, unknown>)?.['name'] ?? '');
      if (typeName !== '') {
        symbols.push({
          name: typeName,
          kind: 'type',
          qualifiedName: conceptName !== '' ? `${conceptName}.${typeName}` : typeName,
          file,
          exported: true,
        });
      }
    }
  }

  // Events
  const events = spec['events'];
  if (Array.isArray(events)) {
    for (const e of events) {
      const eventName = typeof e === 'string'
        ? e
        : String((e as Record<string, unknown>)?.['name'] ?? '');
      if (eventName !== '') {
        symbols.push({
          name: eventName,
          kind: 'event',
          qualifiedName: conceptName !== '' ? `${conceptName}.${eventName}` : eventName,
          file,
          exported: true,
        });
      }
    }
  }

  // Invariants
  const invariants = spec['invariants'];
  if (Array.isArray(invariants)) {
    for (const inv of invariants) {
      const invName = typeof inv === 'string'
        ? inv
        : String((inv as Record<string, unknown>)?.['name'] ?? '');
      if (invName !== '') {
        symbols.push({
          name: invName,
          kind: 'invariant',
          qualifiedName: conceptName !== '' ? `${conceptName}.invariant.${invName}` : invName,
          file,
          exported: false,
        });
      }
    }
  }

  return symbols;
};

// Line-based extraction for raw .concept file format
const extractFromLines = (file: string, content: string): readonly ExtractedSymbol[] => {
  const symbols: ExtractedSymbol[] = [];
  const lines = content.split('\n');
  let currentConcept = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Match concept declaration: "concept ConceptName {"
    const conceptMatch = trimmed.match(/^concept\s+(\w+)/);
    if (conceptMatch !== null) {
      currentConcept = conceptMatch[1];
      symbols.push({
        name: currentConcept,
        kind: 'concept',
        qualifiedName: currentConcept,
        file,
        exported: true,
      });
      continue;
    }

    // Match state field: "fieldName: Type" (inside state block)
    const fieldMatch = trimmed.match(/^(\w+)\s*:\s*\w+/);
    if (fieldMatch !== null && currentConcept !== '') {
      symbols.push({
        name: fieldMatch[1],
        kind: 'state-field',
        qualifiedName: `${currentConcept}.${fieldMatch[1]}`,
        file,
        exported: true,
      });
      continue;
    }

    // Match action declaration: "action actionName"
    const actionMatch = trimmed.match(/^action\s+(\w+)/);
    if (actionMatch !== null) {
      symbols.push({
        name: actionMatch[1],
        kind: 'action',
        qualifiedName: currentConcept !== '' ? `${currentConcept}.${actionMatch[1]}` : actionMatch[1],
        file,
        exported: true,
      });
    }
  }

  return symbols;
};

// --- Handler interface ---

export interface ConceptSpecSymbolExtractorHandler {
  readonly initialize: (
    input: ConceptSpecSymbolExtractorInitializeInput,
    storage: ConceptSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ConceptSpecSymbolExtractorError, ConceptSpecSymbolExtractorInitializeOutput>;
  readonly extract: (
    input: { readonly file: string; readonly content: string },
    storage: ConceptSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ConceptSpecSymbolExtractorError, { readonly symbols: readonly ExtractedSymbol[] }>;
  readonly getSymbolsForFile: (
    input: { readonly file: string },
    storage: ConceptSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ConceptSpecSymbolExtractorError, { readonly symbols: readonly ExtractedSymbol[] }>;
  readonly findByName: (
    input: { readonly name: string },
    storage: ConceptSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ConceptSpecSymbolExtractorError, { readonly symbols: readonly ExtractedSymbol[] }>;
}

// --- Implementation ---

export const conceptSpecSymbolExtractorHandler: ConceptSpecSymbolExtractorHandler = {
  // Verify storage layer and create a provider instance.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existingSymbols = await storage.find('concept_symbols');
          await storage.put('extractor_instances', instanceId, {
            id: instanceId,
            symbolCount: existingSymbols.length,
            createdAt: nowISO(),
          });
          return instanceId;
        },
        storageError,
      ),
      TE.map((instanceId) => initializeOk(instanceId)),
      TE.orElse((err) =>
        TE.right(initializeLoadError(err.message)),
      ),
    ),

  // Parse a .concept file and extract all symbols, persisting each to storage.
  extract: (input, storage) =>
    pipe(
      TE.of(extractSymbols(input.file, input.content)),
      TE.chain((symbols) =>
        TE.tryCatch(
          async () => {
            // Clear previous symbols for this file
            const old = await storage.find('concept_symbols', { file: input.file });
            for (const rec of old) {
              const key = String(rec['qualifiedName'] ?? '');
              if (key !== '') await storage.delete('concept_symbols', key);
            }
            // Store new symbols
            for (const sym of symbols) {
              await storage.put('concept_symbols', sym.qualifiedName, {
                name: sym.name,
                kind: sym.kind,
                qualifiedName: sym.qualifiedName,
                file: sym.file,
                exported: sym.exported,
                updatedAt: nowISO(),
              });
            }
            return { symbols };
          },
          storageError,
        ),
      ),
    ),

  // Retrieve all symbols previously extracted from a given file.
  getSymbolsForFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept_symbols', { file: input.file }),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records.map((r) => ({
          name: String(r['name'] ?? ''),
          kind: String(r['kind'] ?? 'concept') as ExtractedSymbol['kind'],
          qualifiedName: String(r['qualifiedName'] ?? ''),
          file: String(r['file'] ?? ''),
          exported: Boolean(r['exported'] ?? true),
        })),
      })),
    ),

  // Find all symbols matching a name (across all files).
  findByName: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('concept_symbols'),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records
          .filter((r) => String(r['name'] ?? '') === input.name)
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: String(r['kind'] ?? 'concept') as ExtractedSymbol['kind'],
            qualifiedName: String(r['qualifiedName'] ?? ''),
            file: String(r['file'] ?? ''),
            exported: Boolean(r['exported'] ?? true),
          })),
      })),
    ),
};
