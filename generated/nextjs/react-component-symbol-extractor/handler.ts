// ReactComponentSymbolExtractor — Extracts React-specific symbols from JSX/TSX
// source: component declarations, prop interfaces, hook usage (useState, useEffect,
// custom hooks), context providers/consumers, and forwardRef wrappers.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ReactComponentSymbolExtractorStorage,
  ReactComponentSymbolExtractorInitializeInput,
  ReactComponentSymbolExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface ReactComponentSymbolExtractorError {
  readonly code: string;
  readonly message: string;
}

interface ReactSymbol {
  readonly name: string;
  readonly kind: 'component' | 'hook' | 'context' | 'prop-type' | 'forward-ref' | 'memo' | 'hoc';
  readonly file: string;
  readonly exported: boolean;
}

// --- Helpers ---

const storageError = (error: unknown): ReactComponentSymbolExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `rcse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Extract function/arrow component declarations
const extractComponents = (file: string, content: string): readonly ReactSymbol[] => {
  const results: ReactSymbol[] = [];
  const seen = new Set<string>();

  // Match: export function ComponentName or function ComponentName
  const funcRegex = /(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)\s*[(<]/g;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({
        name,
        kind: 'component',
        file,
        exported: content.includes(`export`) && match[0].includes('export'),
      });
    }
  }

  // Match: const ComponentName = (props) => or const ComponentName: React.FC
  const arrowRegex = /(?:export\s+)?const\s+([A-Z]\w*)\s*(?::\s*(?:React\.)?FC[^=]*)?=\s*(?:\([^)]*\)|[^=])\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({
        name,
        kind: 'component',
        file,
        exported: match[0].includes('export'),
      });
    }
  }

  return results;
};

// Extract hook usage: useState, useEffect, custom hooks (useXxx)
const extractHooks = (file: string, content: string): readonly ReactSymbol[] => {
  const results: ReactSymbol[] = [];
  const seen = new Set<string>();

  // Custom hook definitions: function useXxx or const useXxx
  const hookDefRegex = /(?:export\s+)?(?:function|const)\s+(use[A-Z]\w*)/g;
  let match: RegExpExecArray | null;
  while ((match = hookDefRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({
        name,
        kind: 'hook',
        file,
        exported: match[0].includes('export'),
      });
    }
  }

  return results;
};

// Extract context declarations: createContext, useContext references
const extractContexts = (file: string, content: string): readonly ReactSymbol[] => {
  const results: ReactSymbol[] = [];
  const seen = new Set<string>();

  // Match: const XxxContext = createContext or React.createContext
  const ctxRegex = /(?:export\s+)?const\s+(\w+Context)\s*=\s*(?:React\.)?createContext/g;
  let match: RegExpExecArray | null;
  while ((match = ctxRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({
        name,
        kind: 'context',
        file,
        exported: match[0].includes('export'),
      });
    }
  }

  return results;
};

// Extract prop type/interface definitions
const extractPropTypes = (file: string, content: string): readonly ReactSymbol[] => {
  const results: ReactSymbol[] = [];
  const seen = new Set<string>();

  // Match: interface XxxProps or type XxxProps
  const propsRegex = /(?:export\s+)?(?:interface|type)\s+(\w+Props)\s*[{=<]/g;
  let match: RegExpExecArray | null;
  while ((match = propsRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({
        name,
        kind: 'prop-type',
        file,
        exported: match[0].includes('export'),
      });
    }
  }

  return results;
};

// Extract forwardRef wrappings
const extractForwardRefs = (file: string, content: string): readonly ReactSymbol[] => {
  const results: ReactSymbol[] = [];

  const fwdRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:React\.)?forwardRef/g;
  let match: RegExpExecArray | null;
  while ((match = fwdRegex.exec(content)) !== null) {
    results.push({
      name: match[1],
      kind: 'forward-ref',
      file,
      exported: match[0].includes('export'),
    });
  }

  return results;
};

// Extract React.memo wrappings
const extractMemos = (file: string, content: string): readonly ReactSymbol[] => {
  const results: ReactSymbol[] = [];

  const memoRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:React\.)?memo\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = memoRegex.exec(content)) !== null) {
    results.push({
      name: match[1],
      kind: 'memo',
      file,
      exported: match[0].includes('export'),
    });
  }

  return results;
};

// Full extraction pipeline
const extractAllSymbols = (file: string, content: string): readonly ReactSymbol[] => [
  ...extractComponents(file, content),
  ...extractHooks(file, content),
  ...extractContexts(file, content),
  ...extractPropTypes(file, content),
  ...extractForwardRefs(file, content),
  ...extractMemos(file, content),
];

// --- Handler interface ---

export interface ReactComponentSymbolExtractorHandler {
  readonly initialize: (
    input: ReactComponentSymbolExtractorInitializeInput,
    storage: ReactComponentSymbolExtractorStorage,
  ) => TE.TaskEither<ReactComponentSymbolExtractorError, ReactComponentSymbolExtractorInitializeOutput>;
  readonly extract: (
    input: { readonly file: string; readonly content: string },
    storage: ReactComponentSymbolExtractorStorage,
  ) => TE.TaskEither<ReactComponentSymbolExtractorError, { readonly symbols: readonly ReactSymbol[] }>;
  readonly getComponents: (
    input: { readonly file: string },
    storage: ReactComponentSymbolExtractorStorage,
  ) => TE.TaskEither<ReactComponentSymbolExtractorError, { readonly components: readonly ReactSymbol[] }>;
  readonly getHooks: (
    input: { readonly file: string },
    storage: ReactComponentSymbolExtractorStorage,
  ) => TE.TaskEither<ReactComponentSymbolExtractorError, { readonly hooks: readonly ReactSymbol[] }>;
  readonly findByName: (
    input: { readonly name: string },
    storage: ReactComponentSymbolExtractorStorage,
  ) => TE.TaskEither<ReactComponentSymbolExtractorError, { readonly symbols: readonly ReactSymbol[] }>;
}

// --- Implementation ---

export const reactComponentSymbolExtractorHandler: ReactComponentSymbolExtractorHandler = {
  // Verify storage and load existing symbol counts.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('react_symbols');
          await storage.put('react_extractor_instances', instanceId, {
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

  // Parse a JSX/TSX file and extract all React symbols.
  extract: (input, storage) =>
    pipe(
      TE.of(extractAllSymbols(input.file, input.content)),
      TE.chain((symbols) =>
        TE.tryCatch(
          async () => {
            // Clear previous symbols for this file
            const old = await storage.find('react_symbols', { file: input.file });
            for (const rec of old) {
              const key = `${rec['file']}:${rec['kind']}:${rec['name']}`;
              await storage.delete('react_symbols', key);
            }
            // Store new symbols
            for (const sym of symbols) {
              const key = `${sym.file}:${sym.kind}:${sym.name}`;
              await storage.put('react_symbols', key, {
                name: sym.name,
                kind: sym.kind,
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

  // Get only component symbols from a specific file.
  getComponents: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('react_symbols', { file: input.file }),
        storageError,
      ),
      TE.map((records) => ({
        components: records
          .filter((r) => String(r['kind'] ?? '') === 'component')
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: 'component' as const,
            file: String(r['file'] ?? ''),
            exported: Boolean(r['exported'] ?? false),
          })),
      })),
    ),

  // Get only hook symbols from a specific file.
  getHooks: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('react_symbols', { file: input.file }),
        storageError,
      ),
      TE.map((records) => ({
        hooks: records
          .filter((r) => String(r['kind'] ?? '') === 'hook')
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: 'hook' as const,
            file: String(r['file'] ?? ''),
            exported: Boolean(r['exported'] ?? false),
          })),
      })),
    ),

  // Find all React symbols matching a name across all files.
  findByName: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('react_symbols'),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records
          .filter((r) => String(r['name'] ?? '') === input.name)
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: String(r['kind'] ?? 'component') as ReactSymbol['kind'],
            file: String(r['file'] ?? ''),
            exported: Boolean(r['exported'] ?? false),
          })),
      })),
    ),
};
