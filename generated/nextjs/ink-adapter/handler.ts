// InkAdapter — handler.ts
// Ink (React for CLI) platform adapter: normalizes widget props into
// Ink-compatible terminal component representations using Box, Text,
// and Ink-specific layout primitives for interactive CLI applications.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  InkAdapterStorage,
  InkAdapterNormalizeInput,
  InkAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface InkAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface InkAdapterHandler {
  readonly normalize: (
    input: InkAdapterNormalizeInput,
    storage: InkAdapterStorage,
  ) => TE.TaskEither<InkAdapterError, InkAdapterNormalizeOutput>;
}

// --- Ink-specific prop mappings ---

/** Map of CSS-like layout props to Ink Box equivalents */
const INK_LAYOUT_MAP: Readonly<Record<string, string>> = {
  'flex-direction': 'flexDirection',
  'align-items': 'alignItems',
  'justify-content': 'justifyContent',
  'padding': 'paddingX',
  'margin': 'marginX',
  'width': 'width',
  'height': 'height',
  'border': 'borderStyle',
};

/** Ink-supported border styles */
const INK_BORDER_STYLES: ReadonlySet<string> = new Set([
  'single', 'double', 'round', 'bold', 'singleDouble', 'doubleSingle', 'classic',
]);

/** Supported Ink component primitives */
const INK_PRIMITIVES: ReadonlySet<string> = new Set([
  'Box', 'Text', 'Newline', 'Spacer', 'Static', 'Transform',
]);

const storageError = (error: unknown): InkAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse JSON props, returning None on invalid input */
const parseProps = (raw: string): O.Option<Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? O.some(parsed as Record<string, unknown>)
      : O.none;
  } catch {
    return O.none;
  }
};

/** Normalize a border value to an Ink-supported border style */
const normalizeBorder = (value: unknown): string | undefined => {
  if (typeof value === 'string' && INK_BORDER_STYLES.has(value)) return value;
  if (typeof value === 'boolean' && value) return 'single';
  return undefined;
};

/** Transform generic widget props into Ink-compatible prop object */
const transformToInkProps = (
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const inkKey = INK_LAYOUT_MAP[key];
    if (inkKey !== undefined) {
      if (key === 'border') {
        const borderVal = normalizeBorder(value);
        if (borderVal !== undefined) result['borderStyle'] = borderVal;
      } else {
        result[inkKey] = value;
      }
    } else if (key === 'color' || key === 'backgroundColor') {
      // Text color props pass through for Ink Text component
      result[key] = value;
    } else if (key === 'bold' || key === 'italic' || key === 'underline' || key === 'strikethrough') {
      result[key] = value;
    } else if (key === 'wrap') {
      result['wrap'] = value === 'truncate' ? 'truncate-end' : value;
    } else {
      // Pass through unrecognized props (Ink allows custom props)
      result[key] = value;
    }
  }

  return result;
};

/** Determine the target Ink component from adapter string */
const resolveInkComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'Box';
  return INK_PRIMITIVES.has(component) ? component : 'Box';
};

// --- Implementation ---

export const inkAdapterHandler: InkAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveInkComponent(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for Ink adapter "${input.adapter}"`),
              (parsed) => {
                const inkProps = transformToInkProps(parsed);
                const normalized = JSON.stringify({
                  component,
                  props: inkProps,
                  platform: 'ink',
                  runtime: 'node',
                  renderTarget: 'terminal',
                });
                return normalizeOk(input.adapter, normalized);
              },
            ),
          );
        },
        storageError,
      ),
      TE.chain((result) =>
        result.variant === 'error'
          ? TE.right(result)
          : pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('inkadapter', input.adapter, {
                    adapter: input.adapter,
                    normalized: result.normalized,
                    timestamp: Date.now(),
                  });
                  return result;
                },
                storageError,
              ),
            ),
      ),
    ),
};
