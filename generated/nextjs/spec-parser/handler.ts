// SpecParser — Concept specification parser: tokenizes concept spec source
// files, validates structural correctness (concept name, state fields, actions,
// output variants, annotations), builds a typed AST, and caches parsed results.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SpecParserStorage,
  SpecParserParseInput,
  SpecParserParseOutput,
} from './types.js';

import {
  parseOk,
  parseError,
} from './types.js';

export interface SpecParserError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): SpecParserError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface SpecParserHandler {
  readonly parse: (
    input: SpecParserParseInput,
    storage: SpecParserStorage,
  ) => TE.TaskEither<SpecParserError, SpecParserParseOutput>;
}

// --- Implementation ---

interface SpecASTNode {
  readonly type: string;
  readonly name?: string;
  readonly children?: readonly SpecASTNode[];
  readonly value?: string;
  readonly line?: number;
}

const tokenize = (
  source: string,
): readonly { readonly token: string; readonly line: number; readonly value: string }[] => {
  const lines = source.split('\n');
  const tokens: { readonly token: string; readonly line: number; readonly value: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0 || trimmed.startsWith('//')) {
      continue;
    }
    if (trimmed.startsWith('concept ')) {
      tokens.push({ token: 'CONCEPT_DECL', line: i + 1, value: trimmed.slice('concept '.length).trim() });
    } else if (trimmed.startsWith('state ')) {
      tokens.push({ token: 'STATE_DECL', line: i + 1, value: trimmed.slice('state '.length).trim() });
    } else if (trimmed.startsWith('action ')) {
      tokens.push({ token: 'ACTION_DECL', line: i + 1, value: trimmed.slice('action '.length).trim() });
    } else if (trimmed.startsWith('output ')) {
      tokens.push({ token: 'OUTPUT_DECL', line: i + 1, value: trimmed.slice('output '.length).trim() });
    } else if (trimmed.startsWith('@')) {
      tokens.push({ token: 'ANNOTATION', line: i + 1, value: trimmed });
    } else if (trimmed === '{') {
      tokens.push({ token: 'BLOCK_OPEN', line: i + 1, value: '{' });
    } else if (trimmed === '}') {
      tokens.push({ token: 'BLOCK_CLOSE', line: i + 1, value: '}' });
    } else if (trimmed.includes(':')) {
      tokens.push({ token: 'FIELD_DECL', line: i + 1, value: trimmed });
    } else {
      tokens.push({ token: 'IDENTIFIER', line: i + 1, value: trimmed });
    }
  }
  return tokens;
};

const buildAST = (
  tokens: readonly { readonly token: string; readonly line: number; readonly value: string }[],
): { readonly ast: SpecASTNode; readonly errors: readonly { readonly message: string; readonly line: number }[] } => {
  const errors: { readonly message: string; readonly line: number }[] = [];
  const children: SpecASTNode[] = [];
  let conceptName = '';

  const conceptTokens = tokens.filter((t) => t.token === 'CONCEPT_DECL');
  if (conceptTokens.length === 0) {
    errors.push({ message: 'Missing concept declaration', line: 1 });
  } else {
    conceptName = conceptTokens[0].value;
  }

  const stateTokens = tokens.filter((t) => t.token === 'STATE_DECL');
  stateTokens.forEach((t) => {
    children.push({ type: 'state', name: t.value, line: t.line });
  });

  const actionTokens = tokens.filter((t) => t.token === 'ACTION_DECL');
  actionTokens.forEach((t) => {
    children.push({ type: 'action', name: t.value, line: t.line });
  });

  const outputTokens = tokens.filter((t) => t.token === 'OUTPUT_DECL');
  outputTokens.forEach((t) => {
    children.push({ type: 'output', name: t.value, line: t.line });
  });

  const annotationTokens = tokens.filter((t) => t.token === 'ANNOTATION');
  annotationTokens.forEach((t) => {
    children.push({ type: 'annotation', value: t.value, line: t.line });
  });

  const fieldTokens = tokens.filter((t) => t.token === 'FIELD_DECL');
  fieldTokens.forEach((t) => {
    const parts = t.value.split(':').map((p) => p.trim());
    children.push({
      type: 'field',
      name: parts[0],
      value: parts.slice(1).join(':').trim(),
      line: t.line,
    });
  });

  const ast: SpecASTNode = {
    type: 'concept',
    name: conceptName,
    children,
  };

  return { ast, errors };
};

export const specParserHandler: SpecParserHandler = {
  parse: (input, storage) => {
    if (!input.source || input.source.trim().length === 0) {
      return TE.right(parseError('Source cannot be empty', 1));
    }

    const tokens = tokenize(input.source);
    const { ast, errors } = buildAST(tokens);

    if (errors.length > 0) {
      return TE.right(
        parseError(errors[0].message, errors[0].line),
      );
    }

    const specId = `spec-${ast.name ?? 'unknown'}-${Date.now()}`;

    return pipe(
      TE.tryCatch(
        async () => {
          await storage.put('parsed_specs', specId, {
            specId,
            conceptName: ast.name,
            ast,
            tokenCount: tokens.length,
            parsedAt: new Date().toISOString(),
          });
          return parseOk(specId, ast);
        },
        mkError('PARSE_FAILED'),
      ),
    );
  },
};
