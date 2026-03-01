// ThemeSpecSymbolExtractor — Extracts symbols from theme spec files including
// theme names, token declarations (colors, spacing, typography), scale values,
// variant names, and semantic alias definitions with file association.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ThemeSpecSymbolExtractorStorage,
  ThemeSpecSymbolExtractorInitializeInput,
  ThemeSpecSymbolExtractorInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface ThemeSpecSymbolExtractorError {
  readonly code: string;
  readonly message: string;
}

interface ThemeSymbol {
  readonly name: string;
  readonly kind: 'theme' | 'token' | 'scale' | 'variant' | 'alias' | 'breakpoint' | 'color-scheme';
  readonly qualifiedName: string;
  readonly file: string;
  readonly value: string;
}

// --- Helpers ---

const storageError = (error: unknown): ThemeSpecSymbolExtractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `tsse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Extract symbols from a JSON theme spec
const extractThemeSymbols = (file: string, specBody: string): readonly ThemeSymbol[] => {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(specBody);
  } catch {
    return extractFromLines(file, specBody);
  }

  const symbols: ThemeSymbol[] = [];
  const themeName = String(spec['name'] ?? '');

  if (themeName !== '') {
    symbols.push({
      name: themeName,
      kind: 'theme',
      qualifiedName: themeName,
      file,
      value: '',
    });
  }

  // Tokens: recursively walk the token tree
  const tokens = spec['tokens'];
  if (tokens !== null && typeof tokens === 'object' && !Array.isArray(tokens)) {
    const walkTokens = (obj: Record<string, unknown>, prefix: string): void => {
      for (const [key, value] of Object.entries(obj)) {
        const tokenPath = prefix !== '' ? `${prefix}.${key}` : key;
        if (typeof value === 'string' || typeof value === 'number') {
          symbols.push({
            name: key,
            kind: 'token',
            qualifiedName: themeName !== '' ? `${themeName}.${tokenPath}` : tokenPath,
            file,
            value: String(value),
          });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Check if this is a leaf token with a $value property
          const leafValue = (value as Record<string, unknown>)['$value'] ?? (value as Record<string, unknown>)['value'];
          if (leafValue !== undefined) {
            symbols.push({
              name: key,
              kind: 'token',
              qualifiedName: themeName !== '' ? `${themeName}.${tokenPath}` : tokenPath,
              file,
              value: String(leafValue),
            });
          } else {
            // Nested token group, recurse
            walkTokens(value as Record<string, unknown>, tokenPath);
          }
        }
      }
    };
    walkTokens(tokens as Record<string, unknown>, '');
  }

  // Scales (e.g. spacing scale, font size scale)
  const scales = spec['scales'];
  if (scales !== null && typeof scales === 'object' && !Array.isArray(scales)) {
    for (const [scaleName, scaleValues] of Object.entries(scales as Record<string, unknown>)) {
      if (Array.isArray(scaleValues)) {
        for (let i = 0; i < scaleValues.length; i++) {
          symbols.push({
            name: `${scaleName}.${i}`,
            kind: 'scale',
            qualifiedName: themeName !== '' ? `${themeName}.scale.${scaleName}.${i}` : `${scaleName}.${i}`,
            file,
            value: String(scaleValues[i]),
          });
        }
      } else if (typeof scaleValues === 'object' && scaleValues !== null) {
        for (const [stepName, stepValue] of Object.entries(scaleValues as Record<string, unknown>)) {
          symbols.push({
            name: `${scaleName}.${stepName}`,
            kind: 'scale',
            qualifiedName: themeName !== '' ? `${themeName}.scale.${scaleName}.${stepName}` : `${scaleName}.${stepName}`,
            file,
            value: String(stepValue),
          });
        }
      }
    }
  }

  // Variants
  const variants = spec['variants'];
  if (Array.isArray(variants)) {
    for (const variant of variants) {
      const name = typeof variant === 'string'
        ? variant
        : String((variant as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        symbols.push({
          name,
          kind: 'variant',
          qualifiedName: themeName !== '' ? `${themeName}.variant.${name}` : name,
          file,
          value: '',
        });
      }
    }
  } else if (typeof variants === 'object' && variants !== null) {
    for (const variantName of Object.keys(variants as Record<string, unknown>)) {
      symbols.push({
        name: variantName,
        kind: 'variant',
        qualifiedName: themeName !== '' ? `${themeName}.variant.${variantName}` : variantName,
        file,
        value: '',
      });
    }
  }

  // Semantic aliases
  const aliases = spec['aliases'] ?? spec['semantic'];
  if (aliases !== null && typeof aliases === 'object' && !Array.isArray(aliases)) {
    for (const [aliasName, aliasValue] of Object.entries(aliases as Record<string, unknown>)) {
      symbols.push({
        name: aliasName,
        kind: 'alias',
        qualifiedName: themeName !== '' ? `${themeName}.alias.${aliasName}` : aliasName,
        file,
        value: String(aliasValue ?? ''),
      });
    }
  }

  // Breakpoints
  const breakpoints = spec['breakpoints'];
  if (breakpoints !== null && typeof breakpoints === 'object' && !Array.isArray(breakpoints)) {
    for (const [bpName, bpValue] of Object.entries(breakpoints as Record<string, unknown>)) {
      symbols.push({
        name: bpName,
        kind: 'breakpoint',
        qualifiedName: themeName !== '' ? `${themeName}.breakpoint.${bpName}` : bpName,
        file,
        value: String(bpValue ?? ''),
      });
    }
  }

  // Color schemes
  const colorSchemes = spec['colorSchemes'] ?? spec['modes'];
  if (Array.isArray(colorSchemes)) {
    for (const scheme of colorSchemes) {
      const name = typeof scheme === 'string'
        ? scheme
        : String((scheme as Record<string, unknown>)?.['name'] ?? '');
      if (name !== '') {
        symbols.push({
          name,
          kind: 'color-scheme',
          qualifiedName: themeName !== '' ? `${themeName}.colorScheme.${name}` : name,
          file,
          value: '',
        });
      }
    }
  }

  return symbols;
};

// Line-based extraction for raw theme spec files
const extractFromLines = (file: string, content: string): readonly ThemeSymbol[] => {
  const symbols: ThemeSymbol[] = [];
  const lines = content.split('\n');
  let currentTheme = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Match theme declaration: "theme ThemeName {"
    const themeMatch = trimmed.match(/^theme\s+(\w+)/);
    if (themeMatch !== null) {
      currentTheme = themeMatch[1];
      symbols.push({
        name: currentTheme,
        kind: 'theme',
        qualifiedName: currentTheme,
        file,
        value: '',
      });
      continue;
    }

    // Match token declaration: "tokenName: value" or "--token-name: value"
    const tokenMatch = trimmed.match(/^([\w-]+)\s*:\s*(.+)/);
    if (tokenMatch !== null && currentTheme !== '') {
      symbols.push({
        name: tokenMatch[1],
        kind: 'token',
        qualifiedName: `${currentTheme}.${tokenMatch[1]}`,
        file,
        value: tokenMatch[2].replace(/;$/, '').trim(),
      });
    }
  }

  return symbols;
};

// --- Handler interface ---

export interface ThemeSpecSymbolExtractorHandler {
  readonly initialize: (
    input: ThemeSpecSymbolExtractorInitializeInput,
    storage: ThemeSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ThemeSpecSymbolExtractorError, ThemeSpecSymbolExtractorInitializeOutput>;
  readonly extract: (
    input: { readonly file: string; readonly content: string },
    storage: ThemeSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ThemeSpecSymbolExtractorError, { readonly symbols: readonly ThemeSymbol[] }>;
  readonly getSymbolsForFile: (
    input: { readonly file: string },
    storage: ThemeSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ThemeSpecSymbolExtractorError, { readonly symbols: readonly ThemeSymbol[] }>;
  readonly getTokens: (
    input: { readonly theme: string },
    storage: ThemeSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ThemeSpecSymbolExtractorError, { readonly tokens: readonly ThemeSymbol[] }>;
  readonly findByName: (
    input: { readonly name: string },
    storage: ThemeSpecSymbolExtractorStorage,
  ) => TE.TaskEither<ThemeSpecSymbolExtractorError, { readonly symbols: readonly ThemeSymbol[] }>;
}

// --- Implementation ---

export const themeSpecSymbolExtractorHandler: ThemeSpecSymbolExtractorHandler = {
  // Verify storage and count existing theme symbols.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const existing = await storage.find('theme_symbols');
          await storage.put('theme_extractor_instances', instanceId, {
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

  // Parse a theme spec file and extract all symbols, persisting to storage.
  extract: (input, storage) =>
    pipe(
      TE.of(extractThemeSymbols(input.file, input.content)),
      TE.chain((symbols) =>
        TE.tryCatch(
          async () => {
            // Clear previous symbols for this file
            const old = await storage.find('theme_symbols', { file: input.file });
            for (const rec of old) {
              const key = String(rec['qualifiedName'] ?? '');
              if (key !== '') await storage.delete('theme_symbols', key);
            }
            // Store new symbols
            for (const sym of symbols) {
              await storage.put('theme_symbols', sym.qualifiedName, {
                name: sym.name,
                kind: sym.kind,
                qualifiedName: sym.qualifiedName,
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

  // Retrieve all symbols for a specific file.
  getSymbolsForFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('theme_symbols', { file: input.file }),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records.map((r) => ({
          name: String(r['name'] ?? ''),
          kind: String(r['kind'] ?? 'token') as ThemeSymbol['kind'],
          qualifiedName: String(r['qualifiedName'] ?? ''),
          file: String(r['file'] ?? ''),
          value: String(r['value'] ?? ''),
        })),
      })),
    ),

  // Get only token symbols belonging to a specific theme.
  getTokens: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('theme_symbols'),
        storageError,
      ),
      TE.map((records) => ({
        tokens: records
          .filter((r) => {
            const kind = String(r['kind'] ?? '');
            const qName = String(r['qualifiedName'] ?? '');
            return kind === 'token' && qName.startsWith(`${input.theme}.`);
          })
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: 'token' as const,
            qualifiedName: String(r['qualifiedName'] ?? ''),
            file: String(r['file'] ?? ''),
            value: String(r['value'] ?? ''),
          })),
      })),
    ),

  // Search all stored theme symbols by name across all files.
  findByName: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('theme_symbols'),
        storageError,
      ),
      TE.map((records) => ({
        symbols: records
          .filter((r) => String(r['name'] ?? '') === input.name)
          .map((r) => ({
            name: String(r['name'] ?? ''),
            kind: String(r['kind'] ?? 'token') as ThemeSymbol['kind'],
            qualifiedName: String(r['qualifiedName'] ?? ''),
            file: String(r['file'] ?? ''),
            value: String(r['value'] ?? ''),
          })),
      })),
    ),
};
