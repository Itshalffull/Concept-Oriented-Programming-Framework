// ScoreApi concept handler — code-as-data query surface for files, symbols, scopes, and flows.
// Provides a unified read API over the Clef Score index for navigation and analysis.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ScoreApiStorage,
  ScoreApiListFilesInput,
  ScoreApiListFilesOutput,
  ScoreApiGetFileTreeInput,
  ScoreApiGetFileTreeOutput,
  ScoreApiGetFileContentInput,
  ScoreApiGetFileContentOutput,
  ScoreApiGetDefinitionsInput,
  ScoreApiGetDefinitionsOutput,
  ScoreApiMatchPatternInput,
  ScoreApiMatchPatternOutput,
  ScoreApiFindSymbolInput,
  ScoreApiFindSymbolOutput,
  ScoreApiGetReferencesInput,
  ScoreApiGetReferencesOutput,
  ScoreApiGetScopeInput,
  ScoreApiGetScopeOutput,
  ScoreApiGetRelationshipsInput,
  ScoreApiGetRelationshipsOutput,
  ScoreApiListConceptsInput,
  ScoreApiListConceptsOutput,
  ScoreApiGetConceptInput,
  ScoreApiGetConceptOutput,
  ScoreApiGetActionInput,
  ScoreApiGetActionOutput,
  ScoreApiListSyncsInput,
  ScoreApiListSyncsOutput,
  ScoreApiGetSyncInput,
  ScoreApiGetSyncOutput,
  ScoreApiGetFlowInput,
  ScoreApiGetFlowOutput,
  ScoreApiGetDependenciesInput,
  ScoreApiGetDependenciesOutput,
  ScoreApiGetDependentsInput,
  ScoreApiGetDependentsOutput,
  ScoreApiGetImpactInput,
  ScoreApiGetImpactOutput,
  ScoreApiGetDataFlowInput,
  ScoreApiGetDataFlowOutput,
  ScoreApiSearchInput,
  ScoreApiSearchOutput,
  ScoreApiExplainInput,
  ScoreApiExplainOutput,
  ScoreApiStatusInput,
  ScoreApiStatusOutput,
  ScoreApiReindexInput,
  ScoreApiReindexOutput,
} from './types.js';

import {
  listFilesOk,
  listFilesEmpty,
  getFileTreeOk,
  getFileTreeNotFound,
  getFileContentOk,
  getFileContentNotFound,
  getDefinitionsOk,
  getDefinitionsNotFound,
  matchPatternOk,
  matchPatternInvalidPattern,
  findSymbolOk,
  findSymbolNotFound,
  getReferencesOk,
  getReferencesNotFound,
  getScopeOk,
  getScopeNotFound,
  getRelationshipsOk,
  getRelationshipsNotFound,
  listConceptsOk,
  getConceptOk,
  getConceptNotFound,
  getActionOk,
  getActionNotFound,
  listSyncsOk,
  getSyncOk,
  getSyncNotFound,
  getFlowOk,
  getFlowNotFound,
  getDependenciesOk,
  getDependenciesNotFound,
  getDependentsOk,
  getDependentsNotFound,
  getImpactOk,
  getImpactNotFound,
  getDataFlowOk,
  getDataFlowNoPath,
  searchOk,
  searchEmpty,
  explainOk,
  explainNotFound,
  statusOk,
  reindexOk,
  reindexInProgress,
} from './types.js';

export interface ScoreApiError {
  readonly code: string;
  readonly message: string;
}

export interface ScoreApiHandler {
  readonly listFiles: (input: ScoreApiListFilesInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiListFilesOutput>;
  readonly getFileTree: (input: ScoreApiGetFileTreeInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetFileTreeOutput>;
  readonly getFileContent: (input: ScoreApiGetFileContentInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetFileContentOutput>;
  readonly getDefinitions: (input: ScoreApiGetDefinitionsInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetDefinitionsOutput>;
  readonly matchPattern: (input: ScoreApiMatchPatternInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiMatchPatternOutput>;
  readonly findSymbol: (input: ScoreApiFindSymbolInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiFindSymbolOutput>;
  readonly getReferences: (input: ScoreApiGetReferencesInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetReferencesOutput>;
  readonly getScope: (input: ScoreApiGetScopeInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetScopeOutput>;
  readonly getRelationships: (input: ScoreApiGetRelationshipsInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetRelationshipsOutput>;
  readonly listConcepts: (input: ScoreApiListConceptsInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiListConceptsOutput>;
  readonly getConcept: (input: ScoreApiGetConceptInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetConceptOutput>;
  readonly getAction: (input: ScoreApiGetActionInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetActionOutput>;
  readonly listSyncs: (input: ScoreApiListSyncsInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiListSyncsOutput>;
  readonly getSync: (input: ScoreApiGetSyncInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetSyncOutput>;
  readonly getFlow: (input: ScoreApiGetFlowInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetFlowOutput>;
  readonly getDependencies: (input: ScoreApiGetDependenciesInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetDependenciesOutput>;
  readonly getDependents: (input: ScoreApiGetDependentsInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetDependentsOutput>;
  readonly getImpact: (input: ScoreApiGetImpactInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetImpactOutput>;
  readonly getDataFlow: (input: ScoreApiGetDataFlowInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiGetDataFlowOutput>;
  readonly search: (input: ScoreApiSearchInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiSearchOutput>;
  readonly explain: (input: ScoreApiExplainInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiExplainOutput>;
  readonly status: (input: ScoreApiStatusInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiStatusOutput>;
  readonly reindex: (input: ScoreApiReindexInput, storage: ScoreApiStorage) => TE.TaskEither<ScoreApiError, ScoreApiReindexOutput>;
}

// --- Pure helpers ---

const toStorageError = (error: unknown): ScoreApiError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const arr = (v: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(v) ? v as readonly Record<string, unknown>[] : [];

const matchesGlob = (filePath: string, pattern: string): boolean => {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<GLOBSTAR>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<GLOBSTAR>>/g, '.*');
  return new RegExp(`^${regex}$`).test(filePath);
};

const isValidRegex = (pattern: string): boolean => {
  try { new RegExp(pattern); return true; } catch { return false; }
};

// --- Implementation ---

export const scoreApiHandler: ScoreApiHandler = {
  listFiles: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('file');
          const matching = records.filter((r) => matchesGlob(str(r['path']), input.pattern));
          if (matching.length === 0) return listFilesEmpty(input.pattern);
          return listFilesOk(
            matching.map((r) => ({
              path: str(r['path']),
              language: str(r['language']),
              role: str(r['role']),
              size: num(r['size']),
            })),
          );
        },
        toStorageError,
      ),
    ),

  getFileTree: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('file', input.path), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getFileTreeNotFound(input.path)),
            () =>
              TE.tryCatch(
                async () => {
                  const allFiles = await storage.find('file');
                  const prefix = input.path.endsWith('/') ? input.path : `${input.path}/`;
                  const dirs = new Set<string>();
                  let fileCount = 0;
                  const lines: string[] = [];
                  for (const f of allFiles) {
                    const p = str(f['path']);
                    if (!p.startsWith(prefix)) continue;
                    const relative = p.slice(prefix.length);
                    const depth = relative.split('/').filter(Boolean).length;
                    if (depth > input.depth) continue;
                    fileCount++;
                    lines.push(p);
                    const parts = relative.split('/');
                    if (parts.length > 1) {
                      dirs.add(parts.slice(0, -1).join('/'));
                    }
                  }
                  return getFileTreeOk(lines.join('\n'), fileCount, dirs.size);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  getFileContent: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('file', input.path), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getFileContentNotFound(input.path)),
            (found) =>
              TE.right(
                getFileContentOk(
                  str(found['content']),
                  str(found['language']),
                  Array.isArray(found['definitions']) ? found['definitions'] as readonly string[] : [],
                ),
              ),
          ),
        ),
      ),
    ),

  getDefinitions: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('file', input.path), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getDefinitionsNotFound(input.path)),
            () =>
              TE.tryCatch(
                async () => {
                  const defs = await storage.find('definition', { file: input.path });
                  return getDefinitionsOk(
                    defs.map((d) => ({
                      name: str(d['name']),
                      kind: str(d['kind']),
                      line: num(d['line']),
                      span: str(d['span']),
                    })),
                  );
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  matchPattern: (input, _storage) =>
    isValidRegex(input.pattern)
      ? pipe(
          TE.tryCatch(
            async () => {
              const files = await _storage.find('file', { language: input.language });
              const regex = new RegExp(input.pattern, 'g');
              const matches: { readonly file: string; readonly line: number; readonly text: string; readonly context: string }[] = [];
              for (const f of files) {
                const content = str(f['content']);
                const lines = content.split('\n');
                for (let idx = 0; idx < lines.length; idx++) {
                  regex.lastIndex = 0;
                  if (regex.test(lines[idx])) {
                    matches.push({
                      file: str(f['path']),
                      line: idx + 1,
                      text: lines[idx].trim(),
                      context: lines.slice(Math.max(0, idx - 1), idx + 2).join('\n'),
                    });
                  }
                }
              }
              return matchPatternOk(matches);
            },
            toStorageError,
          ),
        )
      : TE.right(matchPatternInvalidPattern(input.pattern, 'Invalid regular expression syntax')),

  findSymbol: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('symbol', { name: input.name });
          if (records.length === 0) return findSymbolNotFound(input.name);
          return findSymbolOk(
            records.map((r) => ({
              name: str(r['name']),
              kind: str(r['kind']),
              file: str(r['file']),
              line: num(r['line']),
              scope: str(r['scope']),
            })),
          );
        },
        toStorageError,
      ),
    ),

  getReferences: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('symbol', input.symbol), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getReferencesNotFound(input.symbol)),
            (sym) =>
              TE.tryCatch(
                async () => {
                  const refs = await storage.find('reference', { symbol: input.symbol });
                  return getReferencesOk(
                    { file: str(sym['file']), line: num(sym['line']) },
                    refs.map((r) => ({ file: str(r['file']), line: num(r['line']), kind: str(r['kind']) })),
                  );
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  getScope: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('file', input.file), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getScopeNotFound(input.file)),
            () =>
              TE.tryCatch(
                async () => {
                  const scopes = await storage.find('scope', { file: input.file });
                  const enclosing = scopes.find(
                    (s) => num(s['startLine']) <= input.line && num(s['endLine']) >= input.line,
                  );
                  if (!enclosing) return getScopeOk('global', [], O.none);
                  const symbols = await storage.find('symbol', { scope: str(enclosing['name']) });
                  return getScopeOk(
                    str(enclosing['name']),
                    symbols.map((s) => ({ name: str(s['name']), kind: str(s['kind']) })),
                    O.fromNullable(enclosing['parent'] as string | null),
                  );
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  getRelationships: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('symbol', input.symbol), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getRelationshipsNotFound(input.symbol)),
            () =>
              TE.tryCatch(
                async () => {
                  const outbound = await storage.find('relationship', { from: input.symbol });
                  const inbound = await storage.find('relationship', { to: input.symbol });
                  return getRelationshipsOk(
                    [...outbound, ...inbound].map((r) => ({
                      from: str(r['from']),
                      to: str(r['to']),
                      kind: str(r['kind']),
                      file: str(r['file']),
                    })),
                  );
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  listConcepts: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('concept');
          return listConceptsOk(
            records.map((r) => ({
              name: str(r['name']),
              purpose: str(r['purpose']),
              actions: Array.isArray(r['actions']) ? r['actions'] as readonly string[] : [],
              stateFields: Array.isArray(r['stateFields']) ? r['stateFields'] as readonly string[] : [],
              file: str(r['file']),
            })),
          );
        },
        toStorageError,
      ),
    ),

  getConcept: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('concept', input.name), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getConceptNotFound(input.name)),
            (found) =>
              TE.right(
                getConceptOk({
                  name: str(found['name']),
                  purpose: str(found['purpose']),
                  typeParams: Array.isArray(found['typeParams']) ? found['typeParams'] as readonly string[] : [],
                  actions: arr(found['actions']).map((a) => ({
                    name: str(a['name']),
                    params: Array.isArray(a['params']) ? a['params'] as readonly string[] : [],
                    variants: Array.isArray(a['variants']) ? a['variants'] as readonly string[] : [],
                  })),
                  stateFields: arr(found['stateFields']).map((sf) => ({
                    name: str(sf['name']),
                    type: str(sf['type']),
                    relation: str(sf['relation']),
                  })),
                  invariants: Array.isArray(found['invariants']) ? found['invariants'] as readonly string[] : [],
                  file: str(found['file']),
                }),
              ),
          ),
        ),
      ),
    ),

  getAction: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('action', `${input.concept}::${input.action}`), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getActionNotFound(input.concept, input.action)),
            (found) =>
              TE.right(
                getActionOk({
                  name: str(found['name']),
                  params: arr(found['params']).map((p) => ({ name: str(p['name']), type: str(p['type']) })),
                  variants: arr(found['variants']).map((v) => ({
                    name: str(v['name']),
                    fields: Array.isArray(v['fields']) ? v['fields'] as readonly string[] : [],
                    prose: str(v['prose']),
                  })),
                  description: str(found['description']),
                }),
              ),
          ),
        ),
      ),
    ),

  listSyncs: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('sync');
          return listSyncsOk(
            records.map((r) => ({
              name: str(r['name']),
              annotation: str(r['annotation']),
              triggers: Array.isArray(r['triggers']) ? r['triggers'] as readonly string[] : [],
              effects: Array.isArray(r['effects']) ? r['effects'] as readonly string[] : [],
              file: str(r['file']),
            })),
          );
        },
        toStorageError,
      ),
    ),

  getSync: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('sync', input.name), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getSyncNotFound(input.name)),
            (found) =>
              TE.right(
                getSyncOk({
                  name: str(found['name']),
                  annotation: str(found['annotation']),
                  when: arr(found['when']).map((w) => ({
                    concept: str(w['concept']),
                    action: str(w['action']),
                    bindings: Array.isArray(w['bindings']) ? w['bindings'] as readonly string[] : [],
                  })),
                  where: Array.isArray(found['where']) ? found['where'] as readonly string[] : [],
                  then: arr(found['then']).map((t) => ({
                    concept: str(t['concept']),
                    action: str(t['action']),
                    bindings: Array.isArray(t['bindings']) ? t['bindings'] as readonly string[] : [],
                  })),
                  file: str(found['file']),
                }),
              ),
          ),
        ),
      ),
    ),

  getFlow: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const syncs = await storage.find('sync');
          const steps: { readonly step: number; readonly concept: string; readonly action: string; readonly sync: string; readonly variant: string }[] = [];
          let stepNum = 1;
          const visited = new Set<string>();
          const queue: { readonly concept: string; readonly action: string }[] = [
            { concept: input.startConcept, action: input.startAction },
          ];

          while (queue.length > 0) {
            const current = queue.shift()!;
            const key = `${current.concept}::${current.action}`;
            if (visited.has(key)) continue;
            visited.add(key);

            for (const s of syncs) {
              const whenArr = arr(s['when']);
              const isTrigger = whenArr.some(
                (w) => str(w['concept']) === current.concept && str(w['action']) === current.action,
              );
              if (!isTrigger) continue;
              const thenArr = arr(s['then']);
              for (const t of thenArr) {
                const step = {
                  step: stepNum++,
                  concept: str(t['concept']),
                  action: str(t['action']),
                  sync: str(s['name']),
                  variant: str(t['variant']),
                };
                steps.push(step);
                queue.push({ concept: step.concept, action: step.action });
              }
            }
          }

          if (steps.length === 0) return getFlowNotFound(input.startConcept, input.startAction);
          return getFlowOk(steps);
        },
        toStorageError,
      ),
    ),

  getDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('symbol', input.symbol), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getDependenciesNotFound(input.symbol)),
            () =>
              TE.tryCatch(
                async () => {
                  const directRels = await storage.find('relationship', { from: input.symbol, kind: 'depends' });
                  const directDeps = directRels.map((r) => ({ name: str(r['to']), kind: str(r['kind']), file: str(r['file']) }));
                  const visited = new Set<string>([input.symbol, ...directDeps.map((d) => d.name)]);
                  const transitiveDeps: { readonly name: string; readonly kind: string; readonly file: string }[] = [];
                  const queue = directDeps.map((d) => d.name);
                  while (queue.length > 0) {
                    const cur = queue.shift()!;
                    const next = await storage.find('relationship', { from: cur, kind: 'depends' });
                    for (const r of next) {
                      const name = str(r['to']);
                      if (!visited.has(name)) {
                        visited.add(name);
                        transitiveDeps.push({ name, kind: str(r['kind']), file: str(r['file']) });
                        queue.push(name);
                      }
                    }
                  }
                  return getDependenciesOk(directDeps, transitiveDeps);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  getDependents: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('symbol', input.symbol), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getDependentsNotFound(input.symbol)),
            () =>
              TE.tryCatch(
                async () => {
                  const directRels = await storage.find('relationship', { to: input.symbol, kind: 'depends' });
                  const directDeps = directRels.map((r) => ({ name: str(r['from']), kind: str(r['kind']), file: str(r['file']) }));
                  const visited = new Set<string>([input.symbol, ...directDeps.map((d) => d.name)]);
                  const transitiveDeps: { readonly name: string; readonly kind: string; readonly file: string }[] = [];
                  const queue = directDeps.map((d) => d.name);
                  while (queue.length > 0) {
                    const cur = queue.shift()!;
                    const next = await storage.find('relationship', { to: cur, kind: 'depends' });
                    for (const r of next) {
                      const name = str(r['from']);
                      if (!visited.has(name)) {
                        visited.add(name);
                        transitiveDeps.push({ name, kind: str(r['kind']), file: str(r['file']) });
                        queue.push(name);
                      }
                    }
                  }
                  return getDependentsOk(directDeps, transitiveDeps);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  getImpact: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('file', input.file), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getImpactNotFound(input.file)),
            () =>
              TE.tryCatch(
                async () => {
                  const symbols = await storage.find('symbol', { file: input.file });
                  const directSet = new Set<string>();
                  const directImpact: { readonly file: string; readonly reason: string }[] = [];
                  for (const sym of symbols) {
                    const refs = await storage.find('reference', { symbol: str(sym['name']) });
                    for (const ref of refs) {
                      const refFile = str(ref['file']);
                      if (refFile !== input.file && !directSet.has(refFile)) {
                        directSet.add(refFile);
                        directImpact.push({ file: refFile, reason: `references ${str(sym['name'])}` });
                      }
                    }
                  }
                  return getImpactOk(directImpact, []);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  getDataFlow: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const fromSym = await storage.get('symbol', input.from);
          if (!fromSym) return getDataFlowNoPath(input.from, input.to);

          const paths: { readonly hops: { readonly symbol: string; readonly file: string; readonly kind: string }[]; readonly length: number }[] = [];
          const visited = new Set<string>();

          const dfs = async (current: string, trail: { readonly symbol: string; readonly file: string; readonly kind: string }[]): Promise<void> => {
            if (current === input.to) {
              paths.push({ hops: [...trail], length: trail.length });
              return;
            }
            if (visited.has(current) || trail.length > 10) return;
            visited.add(current);
            const rels = await storage.find('relationship', { from: current });
            for (const r of rels) {
              await dfs(str(r['to']), [...trail, { symbol: str(r['to']), file: str(r['file']), kind: str(r['kind']) }]);
            }
            visited.delete(current);
          };

          await dfs(input.from, [{ symbol: input.from, file: str(fromSym['file']), kind: str(fromSym['kind']) }]);
          if (paths.length === 0) return getDataFlowNoPath(input.from, input.to);
          return getDataFlowOk(paths);
        },
        toStorageError,
      ),
    ),

  search: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const symbols = await storage.find('symbol');
          const queryLower = input.query.toLowerCase();
          const scored = symbols
            .map((s) => {
              const name = str(s['name']).toLowerCase();
              const score = name === queryLower ? 1.0 : name.includes(queryLower) ? 0.7 : 0;
              return { record: s, score };
            })
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, input.limit);

          if (scored.length === 0) return searchEmpty(input.query);
          return searchOk(
            scored.map((s) => ({
              name: str(s.record['name']),
              kind: str(s.record['kind']),
              file: str(s.record['file']),
              line: num(s.record['line']),
              score: s.score,
              snippet: str(s.record['snippet']),
            })),
          );
        },
        toStorageError,
      ),
    ),

  explain: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('symbol', input.symbol), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(explainNotFound(input.symbol)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const refs = await storage.find('reference', { symbol: input.symbol });
                  const rels = await storage.find('relationship', { from: input.symbol });
                  return explainOk(
                    `${str(found['kind'])} '${str(found['name'])}' defined in ${str(found['file'])}`,
                    str(found['kind']),
                    str(found['file']),
                    [...new Set(refs.map((r) => str(r['file'])))],
                    rels.map((r) => `${str(r['kind'])} -> ${str(r['to'])}`),
                  );
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  status: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const concepts = await storage.find('concept');
          const symbols = await storage.find('symbol');
          const files = await storage.find('file');
          const syncs = await storage.find('sync');
          const meta = await storage.get('meta', 'index_status');
          const lastIndexed = meta ? new Date(str(meta['lastIndexed'])) : new Date(0);
          return statusOk(files.length > 0, concepts.length, symbols.length, files.length, syncs.length, lastIndexed);
        },
        toStorageError,
      ),
    ),

  reindex: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const meta = await storage.get('meta', 'index_status');
          if (meta && str(meta['status']) === 'in_progress') {
            return reindexInProgress(new Date(str(meta['startedAt'])));
          }
          const start = Date.now();
          await storage.put('meta', 'index_status', { status: 'in_progress', startedAt: new Date().toISOString() });
          const concepts = await storage.find('concept');
          const symbols = await storage.find('symbol');
          const files = await storage.find('file');
          const syncs = await storage.find('sync');
          await storage.put('meta', 'index_status', { status: 'complete', lastIndexed: new Date().toISOString() });
          return reindexOk(concepts.length, symbols.length, files.length, syncs.length, Date.now() - start);
        },
        toStorageError,
      ),
    ),
};
