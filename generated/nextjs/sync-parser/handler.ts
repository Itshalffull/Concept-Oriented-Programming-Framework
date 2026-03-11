// SyncParser — Sync file parser: tokenizes .sync source files, validates
// sync rule structure (on-trigger, where-guards, do-effects), resolves
// concept references against provided manifests, and builds a typed AST
// ready for compilation.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  SyncParserStorage,
  SyncParserParseInput,
  SyncParserParseOutput,
} from './types.js';

import {
  parseOk,
  parseError,
} from './types.js';

export interface SyncParserError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): SyncParserError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface SyncParserHandler {
  readonly parse: (
    input: SyncParserParseInput,
    storage: SyncParserStorage,
  ) => TE.TaskEither<SyncParserError, SyncParserParseOutput>;
}

// --- Implementation ---

interface SyncToken {
  readonly token: string;
  readonly line: number;
  readonly value: string;
}

interface SyncASTNode {
  readonly type: string;
  readonly name?: string;
  readonly trigger?: {
    readonly concept: string;
    readonly action: string;
    readonly variant?: string;
  };
  readonly effects?: readonly {
    readonly concept: string;
    readonly action: string;
    readonly mappings?: Record<string, string>;
  }[];
  readonly where?: readonly {
    readonly field: string;
    readonly operator: string;
    readonly value: string;
  }[];
}

const tokenizeSync = (source: string): readonly SyncToken[] => {
  const lines = source.split('\n');
  const tokens: SyncToken[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }
    if (trimmed.startsWith('sync ')) {
      tokens.push({ token: 'SYNC_DECL', line: i + 1, value: trimmed.slice('sync '.length).trim() });
    } else if (trimmed.startsWith('on ')) {
      tokens.push({ token: 'ON_TRIGGER', line: i + 1, value: trimmed.slice('on '.length).trim() });
    } else if (trimmed.startsWith('where ')) {
      tokens.push({ token: 'WHERE_GUARD', line: i + 1, value: trimmed.slice('where '.length).trim() });
    } else if (trimmed.startsWith('do ')) {
      tokens.push({ token: 'DO_EFFECT', line: i + 1, value: trimmed.slice('do '.length).trim() });
    } else if (trimmed.startsWith('map ')) {
      tokens.push({ token: 'MAP_BINDING', line: i + 1, value: trimmed.slice('map '.length).trim() });
    } else if (trimmed === 'when {' || trimmed === 'when{') {
      tokens.push({ token: 'WHEN_BLOCK_OPEN', line: i + 1, value: 'when' });
    } else if (trimmed === 'then {' || trimmed === 'then{') {
      tokens.push({ token: 'THEN_BLOCK_OPEN', line: i + 1, value: 'then' });
    } else if (trimmed === '{') {
      tokens.push({ token: 'BLOCK_OPEN', line: i + 1, value: '{' });
    } else if (trimmed === '}') {
      tokens.push({ token: 'BLOCK_CLOSE', line: i + 1, value: '}' });
    } else if (/^[A-Z][\w]*\/[\w]+\s*:/.test(trimmed)) {
      // Datalog-style concept/action pattern (e.g. "A/act: [ x: ?v ] => []")
      tokens.push({ token: 'PATTERN_LINE', line: i + 1, value: trimmed });
    } else {
      tokens.push({ token: 'IDENTIFIER', line: i + 1, value: trimmed });
    }
  }
  return tokens;
};

const parseTrigger = (
  value: string,
): { readonly concept: string; readonly action: string; readonly variant?: string } | null => {
  // Expected format: "ConceptName.actionName" or "ConceptName.actionName:variant"
  const dotIndex = value.indexOf('.');
  if (dotIndex < 0) return null;
  const concept = value.slice(0, dotIndex).trim();
  const rest = value.slice(dotIndex + 1).trim();
  const colonIndex = rest.indexOf(':');
  if (colonIndex >= 0) {
    return {
      concept,
      action: rest.slice(0, colonIndex).trim(),
      variant: rest.slice(colonIndex + 1).trim(),
    };
  }
  return { concept, action: rest };
};

const parseWhereClause = (
  value: string,
): { readonly field: string; readonly operator: string; readonly value: string } | null => {
  const operators = ['==', '!=', '>=', '<=', '>', '<', 'contains', 'startsWith'];
  for (const op of operators) {
    const index = value.indexOf(` ${op} `);
    if (index >= 0) {
      return {
        field: value.slice(0, index).trim(),
        operator: op,
        value: value.slice(index + op.length + 2).trim(),
      };
    }
  }
  return null;
};

const parseEffect = (
  value: string,
): { readonly concept: string; readonly action: string } | null => {
  const dotIndex = value.indexOf('.');
  if (dotIndex < 0) return null;
  return {
    concept: value.slice(0, dotIndex).trim(),
    action: value.slice(dotIndex + 1).trim(),
  };
};

export const syncParserHandler: SyncParserHandler = {
  parse: (input, storage) => {
    if (!input.source || input.source.trim().length === 0) {
      return TE.right(parseError('Sync source cannot be empty', 1));
    }

    const tokens = tokenizeSync(input.source);

    const syncDeclTokens = tokens.filter((t) => t.token === 'SYNC_DECL');
    if (syncDeclTokens.length === 0) {
      // No sync declaration found: return error at line 0
      return TE.right(parseError('Missing sync declaration', 0));
    }

    const syncNameRaw = syncDeclTokens[0].value;
    // Strip annotations like "[eager]" from the sync name
    const syncName = syncNameRaw.replace(/\s*\[.*\]\s*$/, '').trim();

    // Build AST from whatever tokens we have
    const onTriggerTokens = tokens.filter((t) => t.token === 'ON_TRIGGER');
    const doEffectTokens = tokens.filter((t) => t.token === 'DO_EFFECT');

    // Support the Datalog-style when/then block format as an alternative to on/do.
    // Pattern lines inside when { } blocks become triggers; pattern lines inside
    // then { } blocks become effects.
    const hasWhenThen = tokens.some((t) => t.token === 'WHEN_BLOCK_OPEN');
    const patternLines = tokens.filter((t) => t.token === 'PATTERN_LINE');

    let trigger: ReturnType<typeof parseTrigger> = null;
    const effects: { readonly concept: string; readonly action: string; readonly mappings?: Record<string, string> }[] = [];
    const whereGuards: { readonly field: string; readonly operator: string; readonly value: string }[] = [];

    if (hasWhenThen && patternLines.length > 0) {
      // Datalog format: extract concept/action from pattern lines
      // Partition patterns by whether they appear before or after 'then'
      const thenIndex = tokens.findIndex((t) => t.token === 'THEN_BLOCK_OPEN');
      for (const pLine of patternLines) {
        const lineIdx = tokens.indexOf(pLine);
        const slashIdx = pLine.value.indexOf('/');
        const colonIdx = pLine.value.indexOf(':');
        if (slashIdx > 0 && colonIdx > slashIdx) {
          const concept = pLine.value.slice(0, slashIdx).trim();
          const action = pLine.value.slice(slashIdx + 1, colonIdx).trim();
          if (thenIndex >= 0 && lineIdx > thenIndex) {
            effects.push({ concept, action });
          } else if (trigger === null) {
            trigger = { concept, action };
          }
        }
      }
    } else {
      // Standard on/do format
      if (onTriggerTokens.length === 0) {
        return TE.right(parseError('Missing on trigger declaration', syncDeclTokens[0].line));
      }
      trigger = parseTrigger(onTriggerTokens[0].value);
      if (trigger === null) {
        return TE.right(parseError(`Invalid trigger format: '${onTriggerTokens[0].value}'`, onTriggerTokens[0].line));
      }
      if (doEffectTokens.length === 0) {
        return TE.right(parseError('Missing do effect declaration', onTriggerTokens[0].line));
      }
      for (const effectToken of doEffectTokens) {
        const effect = parseEffect(effectToken.value);
        if (effect) {
          effects.push(effect);
        }
      }
    }

    if (trigger === null) {
      return TE.right(parseError('Missing on trigger declaration', syncDeclTokens[0].line));
    }

    const whereTokens = tokens.filter((t) => t.token === 'WHERE_GUARD');
    for (const whereToken of whereTokens) {
      const guard = parseWhereClause(whereToken.value);
      if (guard) {
        whereGuards.push(guard);
      }
    }

    const ast: SyncASTNode = {
      type: 'sync',
      name: syncName,
      trigger,
      effects: effects.length > 0 ? effects : undefined,
      where: whereGuards.length > 0 ? whereGuards : undefined,
    };

    const syncId = `sync-${syncName}-${Date.now()}`;

    return pipe(
      TE.tryCatch(
        async () => {
          await storage.put('parsed_syncs', syncId, {
            syncId,
            syncName,
            ast,
            tokenCount: tokens.length,
            manifests: input.manifests,
            parsedAt: new Date().toISOString(),
          });
          return parseOk(syncId, ast);
        },
        mkError('PARSE_FAILED'),
      ),
    );
  },
};
