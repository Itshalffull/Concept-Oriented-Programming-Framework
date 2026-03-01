// StructuralPattern — Code pattern matching (observer, factory, visitor, etc.)
// Compiles structural patterns from syntax, matches them against parsed trees.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  StructuralPatternStorage,
  StructuralPatternCreateInput,
  StructuralPatternCreateOutput,
  StructuralPatternMatchInput,
  StructuralPatternMatchOutput,
  StructuralPatternMatchProjectInput,
  StructuralPatternMatchProjectOutput,
} from './types.js';

import {
  createOk,
  createInvalidSyntax,
  matchOk,
  matchNoMatches,
  matchIncompatibleLanguage,
  matchProjectOk,
  matchProjectNoMatches,
} from './types.js';

export interface StructuralPatternError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): StructuralPatternError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Validate structural pattern syntax. Returns null if valid, or error position. */
const validatePatternSyntax = (syntax: string): { readonly valid: boolean; readonly message: string; readonly position: number } => {
  // Check for balanced brackets/parens
  let depth = 0;
  for (let i = 0; i < syntax.length; i++) {
    if (syntax[i] === '(' || syntax[i] === '[' || syntax[i] === '{') depth++;
    if (syntax[i] === ')' || syntax[i] === ']' || syntax[i] === '}') depth--;
    if (depth < 0) {
      return { valid: false, message: `Unexpected closing bracket at position ${i}`, position: i };
    }
  }
  if (depth !== 0) {
    return { valid: false, message: 'Unmatched opening bracket', position: syntax.length - 1 };
  }
  if (syntax.trim().length === 0) {
    return { valid: false, message: 'Empty pattern', position: 0 };
  }
  return { valid: true, message: '', position: 0 };
};

export interface StructuralPatternHandler {
  readonly create: (
    input: StructuralPatternCreateInput,
    storage: StructuralPatternStorage,
  ) => TE.TaskEither<StructuralPatternError, StructuralPatternCreateOutput>;
  readonly match: (
    input: StructuralPatternMatchInput,
    storage: StructuralPatternStorage,
  ) => TE.TaskEither<StructuralPatternError, StructuralPatternMatchOutput>;
  readonly matchProject: (
    input: StructuralPatternMatchProjectInput,
    storage: StructuralPatternStorage,
  ) => TE.TaskEither<StructuralPatternError, StructuralPatternMatchProjectOutput>;
}

// --- Implementation ---

export const structuralPatternHandler: StructuralPatternHandler = {
  create: (input, storage) => {
    const validation = validatePatternSyntax(input.syntax);
    if (!validation.valid) {
      return TE.right(createInvalidSyntax(validation.message, validation.position));
    }
    return pipe(
      TE.tryCatch(
        async () => {
          const patternId = `pat_${input.language}_${Date.now()}`;
          await storage.put('pattern', patternId, {
            id: patternId,
            syntax: input.syntax,
            source: input.source,
            language: input.language,
            createdAt: new Date().toISOString(),
          });
          return createOk(patternId);
        },
        storageError,
      ),
    );
  },

  match: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const pattern = await storage.get('pattern', input.pattern);
          if (!pattern) {
            return matchNoMatches();
          }
          const patternLang = String(pattern['language']);

          // Check language compatibility via the tree's grammar
          const tree = await storage.get('tree', input.tree);
          const treeLang = tree ? String(tree['language'] ?? tree['grammar'] ?? '') : '';

          if (treeLang && patternLang && treeLang !== patternLang) {
            return matchIncompatibleLanguage(patternLang, treeLang);
          }

          // Search the tree's nodes for matches against the pattern's syntax
          const treeNodes = await storage.find('tree_node', { tree: input.tree });
          const patternSyntax = String(pattern['syntax']);
          const matches = treeNodes.filter((node) => {
            const nodeText = String(node['text'] ?? '');
            return nodeText.includes(patternSyntax) || String(node['type'] ?? '').includes(patternSyntax);
          });

          if (matches.length === 0) {
            return matchNoMatches();
          }

          const results = matches.map((m) => ({
            nodeId: String(m['id']),
            startByte: Number(m['startByte'] ?? 0),
            endByte: Number(m['endByte'] ?? 0),
          }));
          return matchOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  matchProject: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const pattern = await storage.get('pattern', input.pattern);
          if (!pattern) {
            return matchProjectNoMatches();
          }
          const patternLang = String(pattern['language']);
          const patternSyntax = String(pattern['syntax']);

          // Search all trees in the project that match the pattern's language
          const trees = await storage.find('tree', { language: patternLang });
          const allResults: { readonly file: string; readonly matches: number }[] = [];

          for (const tree of trees) {
            const treeId = String(tree['id'] ?? tree['file']);
            const nodes = await storage.find('tree_node', { tree: treeId });
            const hits = nodes.filter((n) =>
              String(n['text'] ?? '').includes(patternSyntax) ||
              String(n['type'] ?? '').includes(patternSyntax),
            );
            if (hits.length > 0) {
              allResults.push({ file: String(tree['file'] ?? treeId), matches: hits.length });
            }
          }

          if (allResults.length === 0) {
            return matchProjectNoMatches();
          }
          return matchProjectOk(JSON.stringify(allResults));
        },
        storageError,
      ),
    ),
};
