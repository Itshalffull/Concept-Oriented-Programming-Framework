// DefinitionUnit — Source definition unit extraction and fingerprinting
// Parses source trees into definition units, supports pattern-based search, and diffs.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DefinitionUnitStorage,
  DefinitionUnitExtractInput,
  DefinitionUnitExtractOutput,
  DefinitionUnitFindBySymbolInput,
  DefinitionUnitFindBySymbolOutput,
  DefinitionUnitFindByPatternInput,
  DefinitionUnitFindByPatternOutput,
  DefinitionUnitDiffInput,
  DefinitionUnitDiffOutput,
} from './types.js';

import {
  extractOk,
  extractNotADefinition,
  findBySymbolOk,
  findBySymbolNotfound,
  findByPatternOk,
  diffOk,
  diffSame,
} from './types.js';

export interface DefinitionUnitError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): DefinitionUnitError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** FNV-1a hash for deterministic content fingerprinting. */
const fingerprint = (content: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const DEFINITION_NODE_TYPES: readonly string[] = [
  'function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'variable_declaration',
  'method_definition',
  'enum_declaration',
] as const;

export interface DefinitionUnitHandler {
  readonly extract: (
    input: DefinitionUnitExtractInput,
    storage: DefinitionUnitStorage,
  ) => TE.TaskEither<DefinitionUnitError, DefinitionUnitExtractOutput>;
  readonly findBySymbol: (
    input: DefinitionUnitFindBySymbolInput,
    storage: DefinitionUnitStorage,
  ) => TE.TaskEither<DefinitionUnitError, DefinitionUnitFindBySymbolOutput>;
  readonly findByPattern: (
    input: DefinitionUnitFindByPatternInput,
    storage: DefinitionUnitStorage,
  ) => TE.TaskEither<DefinitionUnitError, DefinitionUnitFindByPatternOutput>;
  readonly diff: (
    input: DefinitionUnitDiffInput,
    storage: DefinitionUnitStorage,
  ) => TE.TaskEither<DefinitionUnitError, DefinitionUnitDiffOutput>;
}

// --- Implementation ---

export const definitionUnitHandler: DefinitionUnitHandler = {
  extract: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Look up the syntax tree record to determine the node type at the given byte range
          const treeRecord = await storage.get('tree', input.tree);
          const nodeType = treeRecord
            ? String(treeRecord['nodeTypeAt'] ?? 'expression_statement')
            : 'expression_statement';

          if (!DEFINITION_NODE_TYPES.includes(nodeType)) {
            return extractNotADefinition(nodeType);
          }

          const content = `${input.tree}:${input.startByte}-${input.endByte}`;
          const fp = fingerprint(content);
          const unitId = `unit_${fp}`;

          await storage.put('definition_unit', unitId, {
            id: unitId,
            tree: input.tree,
            startByte: input.startByte,
            endByte: input.endByte,
            nodeType,
            fingerprint: fp,
            byteLength: input.endByte - input.startByte,
            createdAt: new Date().toISOString(),
          });

          return extractOk(unitId);
        },
        storageError,
      ),
    ),

  findBySymbol: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('definition_unit', { symbol: input.symbol }),
        storageError,
      ),
      TE.map((records) =>
        records.length === 0
          ? findBySymbolNotfound()
          : findBySymbolOk(String(records[0]['id'])),
      ),
    ),

  findByPattern: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('definition_unit', { nodeType: input.kind });
          const filtered = records.filter((r) => {
            const name = String(r['name'] ?? r['id'] ?? '');
            try {
              return new RegExp(input.namePattern).test(name);
            } catch {
              return name.includes(input.namePattern);
            }
          });
          return findByPatternOk(JSON.stringify(filtered.map((r) => String(r['id']))));
        },
        storageError,
      ),
    ),

  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const unitA = await storage.get('definition_unit', input.a);
          const unitB = await storage.get('definition_unit', input.b);
          if (!unitA || !unitB) {
            return diffOk(JSON.stringify([{ type: 'missing', detail: !unitA ? input.a : input.b }]));
          }
          const fpA = String(unitA['fingerprint']);
          const fpB = String(unitB['fingerprint']);
          if (fpA === fpB) {
            return diffSame();
          }
          const changes: Record<string, unknown>[] = [];
          if (unitA['nodeType'] !== unitB['nodeType']) {
            changes.push({ type: 'kind_changed', from: unitA['nodeType'], to: unitB['nodeType'] });
          }
          if (Number(unitA['byteLength']) !== Number(unitB['byteLength'])) {
            changes.push({ type: 'size_changed', from: unitA['byteLength'], to: unitB['byteLength'] });
          }
          if (changes.length === 0) {
            changes.push({ type: 'content_changed', fingerprint: { from: fpA, to: fpB } });
          }
          return diffOk(JSON.stringify(changes));
        },
        storageError,
      ),
    ),
};
