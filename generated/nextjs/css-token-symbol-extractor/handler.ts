// CssTokenSymbolExtractor — Extracts CSS symbols from stylesheets including
// custom properties (--var), class names, keyframe animation names, and
// @layer declarations for design token analysis.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CssTokenSymbolExtractorStorage,
  CssTokenSymbolExtractorInitializeInput,
  CssTokenSymbolExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface CssTokenSymbolExtractorError {
  readonly code: string;
  readonly message: string;
}

interface CssSymbol {
  readonly name: string;
  readonly kind: 'custom-property' | 'class' | 'keyframes' | 'layer' | 'id' | 'media-query';
  readonly file: string;
  readonly value: string;
}

// --- Helpers ---

const storageError = (error: unknown): CssTokenSymbolExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `ctse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Extract CSS custom properties: --property-name: value;
const extractCustomProperties = (file: string, content: string): readonly CssSymbol[] => {
  const results: CssSymbol[] = [];
  const regex = /(--[\w-]+)\s*:\s*([^;]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    results.push({
      name: match[1],
      kind: 'custom-property',
      file,
      value: match[2].trim(),
    });
  }
  return results;
};

// Extract class names: .class-name
const extractClassNames = (file: string, content: string): readonly CssSymbol[] => {
  const results: CssSymbol[] = [];
  const seen = new Set<string>();
  // Match class selectors, avoiding pseudo-classes and property values
  const regex = /\.([a-zA-Z_][\w-]*)\s*[{,:\s[>+~]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ name, kind: 'class', file, value: '' });
    }
  }
  return results;
};

// Extract keyframes: @keyframes animation-name
const extractKeyframes = (file: string, content: string): readonly CssSymbol[] => {
  const results: CssSymbol[] = [];
  const regex = /@keyframes\s+([\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    results.push({ name: match[1], kind: 'keyframes', file, value: '' });
  }
  return results;
};

// Extract @layer declarations
const extractLayers = (file: string, content: string): readonly CssSymbol[] => {
  const results: CssSymbol[] = [];
  const regex = /@layer\s+([\w-]+(?:\s*,\s*[\w-]+)*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const layers = match[1].split(',').map((l) => l.trim());
    for (const layer of layers) {
      results.push({ name: layer, kind: 'layer', file, value: '' });
    }
  }
  return results;
};

// Extract ID selectors: #id-name
const extractIds = (file: string, content: string): readonly CssSymbol[] => {
  const results: CssSymbol[] = [];
  const seen = new Set<string>();
  const regex = /#([a-zA-Z_][\w-]*)\s*[{,:\s]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ name, kind: 'id', file, value: '' });
    }
  }
  return results;
};

// Extract named media queries: @media (--custom-media)
const extractMediaQueries = (file: string, content: string): readonly CssSymbol[] => {
  const results: CssSymbol[] = [];
  const regex = /@custom-media\s+(--[\w-]+)\s+([^;]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    results.push({ name: match[1], kind: 'media-query', file, value: match[2].trim() });
  }
  return results;
};

// Full extraction pipeline
const extractAllSymbols = (file: string, content: string): readonly CssSymbol[] => [
  ...extractCustomProperties(file, content),
  ...extractClassNames(file, content),
  ...extractKeyframes(file, content),
  ...extractLayers(file, content),
  ...extractIds(file, content),
  ...extractMediaQueries(file, content),
];

// --- Handler interface ---

export interface CssTokenSymbolExtractorHandler {
  readonly initialize: (
    input: CssTokenSymbolExtractorInitializeInput,
    storage: CssTokenSymbolExtractorStorage,
  ) => TE.TaskEither<CssTokenSymbolExtractorError, CssTokenSymbolExtractorInitializeOutput>;
  readonly extract: (
    input: { readonly file: string; readonly content: string },
    storage: CssTokenSymbolExtractorStorage,
  ) => TE.TaskEither<CssTokenSymbolExtractorError, { readonly symbols: readonly CssSymbol[] }>;
  readonly getCustomProperties: (
    input: { readonly file: string },
    storage: CssTokenSymbolExtractorStorage,
  ) => TE.TaskEither<CssTokenSymbolExtractorError, { readonly properties: readonly CssSymbol[] }>;
  readonly findByName: (
    input: { readonly name: string },
    storage: CssTokenSymbolExtractorStorage,
  ) => TE.TaskEither<CssTokenSymbolExtractorError, { readonly symbols: readonly CssSymbol[] }>;
}

// --- Implementation ---

export const cssTokenSymbolExtractorHandler: CssTokenSymbolExtractorHandler = {
  // Verify storage accessibility and create an extractor instance.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existingSymbols = await storage.find('css_symbols');
          await storage.put('css_extractor_instances', instanceId, {
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

  // Parse a CSS file and extract all symbol types, persisting to storage.
  extract: (input, storage) =>
    pipe(
      TE.of(extractAllSymbols(input.file, input.content)),
      TE.chain((symbols) =>
        TE.tryCatch(
          async () => {
            // Clear previous symbols for this file
            const old = await storage.find('css_symbols', { file: input.file });
            for (const rec of old) {
              const key = `${rec['file']}:${rec['kind']}:${rec['name']}`;
              await storage.delete('css_symbols', key);
            }
            // Persist new symbols
            for (const sym of symbols) {
              const key = `${sym.file}:${sym.kind}:${sym.name}`;
              await storage.put('css_symbols', key, {
                name: sym.name,
                kind: sym.kind,
                file: sym.file,
                value: sym.value,
                updatedAt: nowISO(),
              });
            }
            return { symbols };
          },
          storageError,
        ),
      ),
    ),

  // Retrieve only custom properties from a specific CSS file.
  getCustomProperties: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('css_symbols', { file: input.file }),
        storageError,
      ),
      TE.map((records) => ({
        properties: records
          .filter((r) => String(r['kind'] ?? '') === 'custom-property')
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: 'custom-property' as const,
            file: String(r['file'] ?? ''),
            value: String(r['value'] ?? ''),
          })),
      })),
    ),

  // Search all stored CSS symbols by name across all files.
  findByName: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('css_symbols'),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records
          .filter((r) => String(r['name'] ?? '') === input.name)
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: String(r['kind'] ?? 'custom-property') as CssSymbol['kind'],
            file: String(r['file'] ?? ''),
            value: String(r['value'] ?? ''),
          })),
      })),
    ),
};
