// SyncSpecSymbolExtractor — Extracts symbols from .sync spec files including
// sync rule names, trigger references, binding field paths, guard names,
// and transform function identifiers with source file association.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncSpecSymbolExtractorStorage,
  SyncSpecSymbolExtractorInitializeInput,
  SyncSpecSymbolExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface SyncSpecSymbolExtractorError {
  readonly code: string;
  readonly message: string;
}

interface SyncSymbol {
  readonly name: string;
  readonly kind: 'sync-rule' | 'trigger' | 'binding' | 'guard' | 'transform' | 'field-ref' | 'concept-ref';
  readonly qualifiedName: string;
  readonly file: string;
}

// --- Helpers ---

const storageError = (error: unknown): SyncSpecSymbolExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `ssse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Extract symbols from a sync spec (JSON)
const extractSyncSymbols = (file: string, specBody: string): readonly SyncSymbol[] => {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(specBody);
  } catch {
    return extractFromLines(file, specBody);
  }

  const symbols: SyncSymbol[] = [];
  const syncName = String(spec['name'] ?? '');

  if (syncName !== '') {
    symbols.push({
      name: syncName,
      kind: 'sync-rule',
      qualifiedName: syncName,
      file,
    });
  }

  // Bindings
  const bindings = spec['bindings'];
  if (Array.isArray(bindings)) {
    for (const binding of bindings) {
      if (typeof binding === 'object' && binding !== null) {
        const b = binding as Record<string, unknown>;
        const name = String(b['name'] ?? '');
        if (name !== '') {
          symbols.push({
            name,
            kind: 'binding',
            qualifiedName: syncName !== '' ? `${syncName}.binding.${name}` : name,
            file,
          });
        }
        // Source and target concept refs
        const source = String(b['source'] ?? b['from'] ?? '');
        const target = String(b['target'] ?? b['to'] ?? '');
        if (source !== '') {
          symbols.push({
            name: source,
            kind: 'concept-ref',
            qualifiedName: syncName !== '' ? `${syncName}.ref.${source}` : source,
            file,
          });
        }
        if (target !== '') {
          symbols.push({
            name: target,
            kind: 'concept-ref',
            qualifiedName: syncName !== '' ? `${syncName}.ref.${target}` : target,
            file,
          });
        }
        // Field references
        const sourceField = String(b['sourceField'] ?? '');
        const targetField = String(b['targetField'] ?? '');
        if (sourceField !== '') {
          symbols.push({
            name: sourceField,
            kind: 'field-ref',
            qualifiedName: syncName !== '' ? `${syncName}.field.${sourceField}` : sourceField,
            file,
          });
        }
        if (targetField !== '') {
          symbols.push({
            name: targetField,
            kind: 'field-ref',
            qualifiedName: syncName !== '' ? `${syncName}.field.${targetField}` : targetField,
            file,
          });
        }
      }
    }
  }

  // Triggers
  const triggers = spec['triggers'];
  if (Array.isArray(triggers)) {
    for (const trigger of triggers) {
      const name = typeof trigger === 'string'
        ? trigger
        : String((trigger as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        symbols.push({
          name,
          kind: 'trigger',
          qualifiedName: syncName !== '' ? `${syncName}.trigger.${name}` : name,
          file,
        });
      }
    }
  }

  // Guards
  const guards = spec['guards'];
  if (Array.isArray(guards)) {
    for (const guard of guards) {
      const name = typeof guard === 'string'
        ? guard
        : String((guard as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        symbols.push({
          name,
          kind: 'guard',
          qualifiedName: syncName !== '' ? `${syncName}.guard.${name}` : name,
          file,
        });
      }
    }
  }

  // Transforms
  const transforms = spec['transforms'];
  if (Array.isArray(transforms)) {
    for (const transform of transforms) {
      const name = typeof transform === 'string'
        ? transform
        : String((transform as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        symbols.push({
          name,
          kind: 'transform',
          qualifiedName: syncName !== '' ? `${syncName}.transform.${name}` : name,
          file,
        });
      }
    }
  }

  return symbols;
};

// Line-based extraction for raw .sync file format
const extractFromLines = (file: string, content: string): readonly SyncSymbol[] => {
  const symbols: SyncSymbol[] = [];
  const lines = content.split('\n');
  let currentSync = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Match sync rule declaration: "sync SyncName {"
    const syncMatch = trimmed.match(/^sync\s+(\w+)/);
    if (syncMatch !== null) {
      currentSync = syncMatch[1];
      symbols.push({
        name: currentSync,
        kind: 'sync-rule',
        qualifiedName: currentSync,
        file,
      });
      continue;
    }

    // Match trigger declaration: "trigger conceptName.actionName"
    const triggerMatch = trimmed.match(/^trigger\s+([\w.]+)/);
    if (triggerMatch !== null) {
      symbols.push({
        name: triggerMatch[1],
        kind: 'trigger',
        qualifiedName: currentSync !== '' ? `${currentSync}.trigger.${triggerMatch[1]}` : triggerMatch[1],
        file,
      });
      continue;
    }

    // Match bind declaration: "bind source.field -> target.field"
    const bindMatch = trimmed.match(/^bind\s+([\w.]+)\s*(?:->|<->|<-)\s*([\w.]+)/);
    if (bindMatch !== null) {
      symbols.push({
        name: `${bindMatch[1]}->${bindMatch[2]}`,
        kind: 'binding',
        qualifiedName: currentSync !== '' ? `${currentSync}.binding.${bindMatch[1]}` : bindMatch[1],
        file,
      });
    }

    // Match guard: "guard guardName"
    const guardMatch = trimmed.match(/^guard\s+(\w+)/);
    if (guardMatch !== null) {
      symbols.push({
        name: guardMatch[1],
        kind: 'guard',
        qualifiedName: currentSync !== '' ? `${currentSync}.guard.${guardMatch[1]}` : guardMatch[1],
        file,
      });
    }
  }

  return symbols;
};

// --- Handler interface ---

export interface SyncSpecSymbolExtractorHandler {
  readonly initialize: (
    input: SyncSpecSymbolExtractorInitializeInput,
    storage: SyncSpecSymbolExtractorStorage,
  ) => TE.TaskEither<SyncSpecSymbolExtractorError, SyncSpecSymbolExtractorInitializeOutput>;
  readonly extract: (
    input: { readonly file: string; readonly content: string },
    storage: SyncSpecSymbolExtractorStorage,
  ) => TE.TaskEither<SyncSpecSymbolExtractorError, { readonly symbols: readonly SyncSymbol[] }>;
  readonly getSymbolsForFile: (
    input: { readonly file: string },
    storage: SyncSpecSymbolExtractorStorage,
  ) => TE.TaskEither<SyncSpecSymbolExtractorError, { readonly symbols: readonly SyncSymbol[] }>;
  readonly findByKind: (
    input: { readonly kind: string },
    storage: SyncSpecSymbolExtractorStorage,
  ) => TE.TaskEither<SyncSpecSymbolExtractorError, { readonly symbols: readonly SyncSymbol[] }>;
}

// --- Implementation ---

export const syncSpecSymbolExtractorHandler: SyncSpecSymbolExtractorHandler = {
  // Verify storage and load existing symbol metadata.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('sync_symbols');
          await storage.put('sync_extractor_instances', instanceId, {
            id: instanceId,
            symbolCount: existing.length,
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

  // Parse a .sync file and extract all symbols, persisting to storage.
  extract: (input, storage) =>
    pipe(
      TE.of(extractSyncSymbols(input.file, input.content)),
      TE.chain((symbols) =>
        TE.tryCatch(
          async () => {
            // Clear previous symbols for this file
            const old = await storage.find('sync_symbols', { file: input.file });
            for (const rec of old) {
              const key = String(rec['qualifiedName'] ?? '');
              if (key !== '') await storage.delete('sync_symbols', key);
            }
            // Store new symbols
            for (const sym of symbols) {
              await storage.put('sync_symbols', sym.qualifiedName, {
                name: sym.name,
                kind: sym.kind,
                qualifiedName: sym.qualifiedName,
                file: sym.file,
                updatedAt: nowISO(),
              });
            }
            return { symbols };
          },
          storageError,
        ),
      ),
    ),

  // Retrieve all symbols for a specific file.
  getSymbolsForFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sync_symbols', { file: input.file }),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records.map((r) => ({
          name: String(r['name'] ?? ''),
          kind: String(r['kind'] ?? 'sync-rule') as SyncSymbol['kind'],
          qualifiedName: String(r['qualifiedName'] ?? ''),
          file: String(r['file'] ?? ''),
        })),
      })),
    ),

  // Find all symbols of a specific kind across all files.
  findByKind: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sync_symbols'),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records
          .filter((r) => String(r['kind'] ?? '') === input.kind)
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: String(r['kind'] ?? 'sync-rule') as SyncSymbol['kind'],
            qualifiedName: String(r['qualifiedName'] ?? ''),
            file: String(r['file'] ?? ''),
          })),
      })),
    ),
};
