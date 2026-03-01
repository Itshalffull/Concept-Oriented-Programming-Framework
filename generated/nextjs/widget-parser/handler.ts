// WidgetParser — Parse widget spec files into AST with structural validation
// Converts widget spec source text into a typed AST and validates completeness.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetParserStorage,
  WidgetParserParseInput,
  WidgetParserParseOutput,
  WidgetParserValidateInput,
  WidgetParserValidateOutput,
} from './types.js';

import {
  parseOk,
  parseError,
  validateOk,
  validateIncomplete,
} from './types.js';

export interface WidgetParserError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetParserHandler {
  readonly parse: (
    input: WidgetParserParseInput,
    storage: WidgetParserStorage,
  ) => TE.TaskEither<WidgetParserError, WidgetParserParseOutput>;
  readonly validate: (
    input: WidgetParserValidateInput,
    storage: WidgetParserStorage,
  ) => TE.TaskEither<WidgetParserError, WidgetParserValidateOutput>;
}

// --- Helpers ---

const toError = (error: unknown): WidgetParserError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Required top-level keys that must appear in a valid widget spec. */
const REQUIRED_KEYS: readonly string[] = ['name', 'parts'];
const OPTIONAL_KEYS: readonly string[] = ['props', 'states', 'events', 'slots', 'variants'];

/**
 * Parse raw widget spec source (JSON) into an AST, collecting errors
 * for any structural issues found.
 */
const parseWidgetSource = (
  widgetName: string,
  source: string,
): { readonly ast: Record<string, unknown> | null; readonly errors: readonly string[] } => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(source) as Record<string, unknown>;
  } catch (e) {
    return { ast: null, errors: [`Syntax error: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const errors: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (!(key in parsed)) {
      errors.push(`Missing required field '${key}'`);
    }
  }
  if (typeof parsed['name'] === 'string' && parsed['name'] !== widgetName) {
    errors.push(`Widget name mismatch: spec says '${parsed['name']}' but expected '${widgetName}'`);
  }
  if ('parts' in parsed && !Array.isArray(parsed['parts'])) {
    errors.push(`Field 'parts' must be an array`);
  }
  if (Array.isArray(parsed['parts'])) {
    for (const [i, part] of (parsed['parts'] as readonly unknown[]).entries()) {
      if (typeof part !== 'object' || part === null) {
        errors.push(`parts[${i}] must be an object`);
      } else {
        const p = part as Record<string, unknown>;
        if (!('name' in p)) {
          errors.push(`parts[${i}] missing required 'name' field`);
        }
      }
    }
  }
  if (errors.length > 0) {
    return { ast: null, errors };
  }
  // Build normalized AST
  const ast: Record<string, unknown> = {
    name: parsed['name'],
    parts: parsed['parts'],
    props: Array.isArray(parsed['props']) ? parsed['props'] : [],
    states: Array.isArray(parsed['states']) ? parsed['states'] : [],
    events: Array.isArray(parsed['events']) ? parsed['events'] : [],
    slots: Array.isArray(parsed['slots']) ? parsed['slots'] : [],
    variants: Array.isArray(parsed['variants']) ? parsed['variants'] : [],
  };
  return { ast, errors: [] };
};

// --- Implementation ---

export const widgetParserHandler: WidgetParserHandler = {
  // Parse a widget spec source into a structured AST
  parse: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const result = parseWidgetSource(input.widget, input.source);
          if (result.ast === null) {
            return parseError(input.widget, result.errors);
          }
          const astStr = JSON.stringify(result.ast);
          // Persist the parsed AST for downstream consumers (WidgetGen, validation)
          await storage.put('widget_ast', input.widget, {
            widget: input.widget,
            ast: astStr,
            source: input.source,
            parsedAt: new Date().toISOString(),
          });
          return parseOk(input.widget, astStr);
        },
        toError,
      ),
    ),

  // Validate a previously parsed widget AST for completeness
  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('widget_ast', input.widget),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(validateIncomplete(input.widget, [`Widget '${input.widget}' has not been parsed yet`]) as WidgetParserValidateOutput),
            (found) => {
              const warnings: string[] = [];
              let ast: Record<string, unknown>;
              try {
                ast = JSON.parse(String(found['ast'] ?? '{}')) as Record<string, unknown>;
              } catch {
                return TE.right(validateIncomplete(input.widget, ['Stored AST is corrupted']) as WidgetParserValidateOutput);
              }
              const parts = Array.isArray(ast['parts']) ? ast['parts'] as readonly Record<string, unknown>[] : [];
              if (parts.length === 0) {
                warnings.push('Widget has no anatomy parts defined');
              }
              const props = Array.isArray(ast['props']) ? ast['props'] : [];
              if (props.length === 0) {
                warnings.push('Widget has no props defined');
              }
              const states = Array.isArray(ast['states']) ? ast['states'] : [];
              if (states.length === 0) {
                warnings.push('Widget has no states defined');
              }
              if (warnings.length > 0) {
                return TE.right(validateIncomplete(input.widget, warnings) as WidgetParserValidateOutput);
              }
              return TE.right(validateOk(input.widget) as WidgetParserValidateOutput);
            },
          ),
        ),
      ),
    ),
};
