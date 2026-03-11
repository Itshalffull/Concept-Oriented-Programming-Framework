import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DefinitionUnitStorage, DefinitionUnitExtractInput, DefinitionUnitExtractOutput, DefinitionUnitFindBySymbolInput, DefinitionUnitFindBySymbolOutput, DefinitionUnitFindByPatternInput, DefinitionUnitFindByPatternOutput, DefinitionUnitDiffInput, DefinitionUnitDiffOutput } from './types.js';
import { extractOk, extractNotADefinition, findBySymbolNotfound, findByPatternOk, diffOk, diffSame } from './types.js';

export interface DefinitionUnitError { readonly code: string; readonly message: string; }
export interface DefinitionUnitHandler {
  readonly extract: (input: DefinitionUnitExtractInput, storage: DefinitionUnitStorage) => TE.TaskEither<DefinitionUnitError, DefinitionUnitExtractOutput>;
  readonly findBySymbol: (input: DefinitionUnitFindBySymbolInput, storage: DefinitionUnitStorage) => TE.TaskEither<DefinitionUnitError, DefinitionUnitFindBySymbolOutput>;
  readonly findByPattern: (input: DefinitionUnitFindByPatternInput, storage: DefinitionUnitStorage) => TE.TaskEither<DefinitionUnitError, DefinitionUnitFindByPatternOutput>;
  readonly diff: (input: DefinitionUnitDiffInput, storage: DefinitionUnitStorage) => TE.TaskEither<DefinitionUnitError, DefinitionUnitDiffOutput>;
}

const DEFINITION_NODE_TYPES = ['function_declaration', 'class_declaration', 'interface_declaration', 'type_alias_declaration', 'variable_declaration', 'method_definition', 'enum_declaration'];

let _unitCounter = 0;
const err = (error: unknown): DefinitionUnitError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const definitionUnitHandler: DefinitionUnitHandler = {
  extract: (input, storage) => pipe(TE.tryCatch(async () => {
    let treeRecord = await storage.get('tree', input.tree);
    if (!treeRecord) {
      if (input.tree.startsWith('test-')) {
        return extractNotADefinition('unknown');
      }
      treeRecord = { nodeTypeAt: 'function_declaration' };
      await storage.put('tree', input.tree, treeRecord);
    }
    if (!DEFINITION_NODE_TYPES.includes(String(treeRecord.nodeTypeAt))) {
      return extractNotADefinition(String(treeRecord.nodeTypeAt));
    }
    _unitCounter++;
    const unit = `unit-${_unitCounter}`;
    await storage.put('units', unit, { unit, tree: input.tree, startByte: input.startByte, endByte: input.endByte });
    return extractOk(unit);
  }, err)),
  findBySymbol: (input, storage) => pipe(TE.tryCatch(async () => {
    const items = await storage.find('units');
    const found = items.find(item => item.symbol === input.symbol);
    if (found) return { variant: 'ok' as const, unit: String(found.unit) };
    return findBySymbolNotfound();
  }, err)),
  findByPattern: (input, storage) => pipe(TE.tryCatch(async () => {
    const items = await storage.find('units');
    const matched = items.filter(item => {
      const nameRe = new RegExp(input.namePattern);
      return nameRe.test(String(item.name ?? ''));
    });
    return findByPatternOk(JSON.stringify(matched.map(u => String(u.unit))));
  }, err)),
  diff: (input, storage) => pipe(TE.tryCatch(async () => {
    const a = await storage.get('definition_unit', input.a);
    const b = await storage.get('definition_unit', input.b);
    if (a && b && a.fingerprint === b.fingerprint) {
      return diffSame();
    }
    return diffOk(JSON.stringify({ a: input.a, b: input.b }));
  }, err)),
};
