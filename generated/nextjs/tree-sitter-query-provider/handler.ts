// Tree-sitter S-expression query execution engine.
// Validates query patterns, matches them against serialized tree representations,
// and returns structured match results with captured node references.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterQueryProviderStorage,
  TreeSitterQueryProviderInitializeInput,
  TreeSitterQueryProviderInitializeOutput,
  TreeSitterQueryProviderExecuteInput,
  TreeSitterQueryProviderExecuteOutput,
} from './types.js';

import {
  initializeOk,
  executeOk,
  executeInvalidPattern,
} from './types.js';

export interface TreeSitterQueryProviderError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterQueryProviderHandler {
  readonly initialize: (
    input: TreeSitterQueryProviderInitializeInput,
    storage: TreeSitterQueryProviderStorage,
  ) => TE.TaskEither<TreeSitterQueryProviderError, TreeSitterQueryProviderInitializeOutput>;
  readonly execute: (
    input: TreeSitterQueryProviderExecuteInput,
    storage: TreeSitterQueryProviderStorage,
  ) => TE.TaskEither<TreeSitterQueryProviderError, TreeSitterQueryProviderExecuteOutput>;
}

// --- Pure helpers ---

/** S-expression token types for pattern parsing */
interface SExprToken {
  readonly type: 'open' | 'close' | 'symbol' | 'capture' | 'wildcard' | 'predicate';
  readonly value: string;
}

/** Validate S-expression pattern syntax: balanced parens and valid captures */
const validatePattern = (pattern: string): E.Either<string, readonly SExprToken[]> => {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return E.left('Pattern cannot be empty');
  }

  const tokens: SExprToken[] = [];
  let depth = 0;
  let i = 0;

  while (i < trimmed.length) {
    const ch = trimmed[i];

    if (ch === '(') {
      depth++;
      tokens.push({ type: 'open', value: '(' });
      i++;
    } else if (ch === ')') {
      depth--;
      if (depth < 0) {
        return E.left(`Unmatched closing parenthesis at position ${i}`);
      }
      tokens.push({ type: 'close', value: ')' });
      i++;
    } else if (ch === '@') {
      // Capture name
      let name = '';
      i++;
      while (i < trimmed.length && /[a-zA-Z0-9_.]/.test(trimmed[i])) {
        name += trimmed[i];
        i++;
      }
      if (name.length === 0) {
        return E.left(`Empty capture name at position ${i - 1}`);
      }
      tokens.push({ type: 'capture', value: `@${name}` });
    } else if (ch === '_') {
      tokens.push({ type: 'wildcard', value: '_' });
      i++;
    } else if (ch === '#') {
      // Predicate
      let pred = '';
      i++;
      while (i < trimmed.length && /[a-zA-Z0-9_!?-]/.test(trimmed[i])) {
        pred += trimmed[i];
        i++;
      }
      tokens.push({ type: 'predicate', value: `#${pred}` });
    } else if (/\s/.test(ch)) {
      i++;
    } else if (/[a-zA-Z_]/.test(ch)) {
      let symbol = '';
      while (i < trimmed.length && /[a-zA-Z0-9_]/.test(trimmed[i])) {
        symbol += trimmed[i];
        i++;
      }
      tokens.push({ type: 'symbol', value: symbol });
    } else if (ch === '"') {
      // String literal in pattern
      let str = '"';
      i++;
      while (i < trimmed.length && trimmed[i] !== '"') {
        if (trimmed[i] === '\\') {
          str += trimmed[i];
          i++;
          if (i < trimmed.length) {
            str += trimmed[i];
            i++;
          }
        } else {
          str += trimmed[i];
          i++;
        }
      }
      if (i >= trimmed.length) {
        return E.left('Unterminated string literal in pattern');
      }
      str += '"';
      i++;
      tokens.push({ type: 'symbol', value: str });
    } else {
      return E.left(`Unexpected character '${ch}' at position ${i}`);
    }
  }

  if (depth !== 0) {
    return E.left(`${depth} unclosed parenthes${depth === 1 ? 'is' : 'es'} in pattern`);
  }

  if (tokens.length === 0) {
    return E.left('Pattern produced no tokens');
  }

  return E.right(tokens);
};

/** Match tokenized pattern against a serialized tree (S-expression format) */
const executePatternMatch = (
  tokens: readonly SExprToken[],
  treeSExpr: string,
): readonly Record<string, unknown>[] => {
  // Parse tree S-expression into a flat sequence of node descriptors
  const treeTokens: string[] = [];
  let ti = 0;
  while (ti < treeSExpr.length) {
    const tc = treeSExpr[ti];
    if (tc === '(' || tc === ')') {
      treeTokens.push(tc);
      ti++;
    } else if (/\s/.test(tc)) {
      ti++;
    } else {
      let word = '';
      while (ti < treeSExpr.length && !/[\s()]/.test(treeSExpr[ti])) {
        word += treeSExpr[ti];
        ti++;
      }
      treeTokens.push(word);
    }
  }

  // Extract node type names from pattern (first symbol after each open paren)
  const patternNodeTypes: string[] = [];
  for (let pi = 0; pi < tokens.length; pi++) {
    if (tokens[pi].type === 'open' && pi + 1 < tokens.length && tokens[pi + 1].type === 'symbol') {
      patternNodeTypes.push(tokens[pi + 1].value);
    }
  }

  // Find all positions in tree tokens matching the pattern root node type
  const matches: Record<string, unknown>[] = [];
  if (patternNodeTypes.length === 0) {
    return matches;
  }

  const rootType = patternNodeTypes[0];
  for (let tti = 0; tti < treeTokens.length; tti++) {
    if (treeTokens[tti] === '(' && tti + 1 < treeTokens.length && treeTokens[tti + 1] === rootType) {
      // Collect the matched subtree text
      let depth = 0;
      let start = tti;
      let end = tti;
      for (let scan = tti; scan < treeTokens.length; scan++) {
        if (treeTokens[scan] === '(') depth++;
        if (treeTokens[scan] === ')') depth--;
        if (depth === 0) {
          end = scan;
          break;
        }
      }

      const capturedText = treeTokens.slice(start, end + 1).join(' ');
      const captures: Record<string, string> = {};

      // Bind captures from pattern to matched subtree
      for (const token of tokens) {
        if (token.type === 'capture') {
          captures[token.value] = capturedText;
        }
      }

      matches.push({
        nodeType: rootType,
        position: tti,
        text: capturedText,
        captures,
      });
    }
  }

  return matches;
};

const toStorageError = (error: unknown): TreeSitterQueryProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterQueryProviderHandler: TreeSitterQueryProviderHandler = {
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = `query-provider-${Date.now()}`;

          await storage.put('query_providers', instanceId, {
            instanceId,
            supportedPredicates: ['#eq?', '#match?', '#not-eq?', '#any-of?'],
            maxPatternDepth: 32,
            initializedAt: new Date().toISOString(),
          });

          return initializeOk(instanceId);
        },
        toStorageError,
      ),
    ),

  execute: (input, storage) =>
    pipe(
      TE.of(validatePattern(input.pattern)),
      TE.chain((validationResult) =>
        pipe(
          validationResult,
          E.fold(
            (errorMsg) =>
              TE.right<TreeSitterQueryProviderError, TreeSitterQueryProviderExecuteOutput>(
                executeInvalidPattern(errorMsg),
              ),
            (tokens) =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const matches = executePatternMatch(tokens, input.tree);

                    // Cache the query result for repeated execution
                    const queryId = `query-${Date.now()}`;
                    await storage.put('query_results', queryId, {
                      queryId,
                      pattern: input.pattern,
                      tokenCount: tokens.length,
                      matchCount: matches.length,
                      matches: JSON.stringify(matches),
                      executedAt: new Date().toISOString(),
                    });

                    return executeOk(JSON.stringify(matches));
                  },
                  toStorageError,
                ),
              ),
          ),
        ),
      ),
    ),
};
