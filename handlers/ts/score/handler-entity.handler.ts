// @migrated dsl-constructs 2026-03-18
// HandlerEntity Concept Implementation
//
// Queryable representation of concept handler implementation files.
// Links handler source to concept entities, action entities, parsed AST,
// dependencies, and runtime behavior. Enables stack trace correlation,
// error root-cause analysis, and implementation coverage tracking.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const sourceFile = input.sourceFile as string;
    const language = input.language as string;
    const ast = input.ast as string;

    const key = `handler:${concept}:${language}`;
    p = get(p, 'handlers', key, 'existing');
    if (existing) {
      return complete(p, 'alreadyRegistered', { existing: existing.id }) as StorageProgram<Result>;
    }

    const id = crypto.randomUUID();
    // TODO: Parse AST to extract action methods, dependencies, exports, storage collections
    const parsedAst = ast ? JSON.parse(ast) : {};
    const actionMethods = JSON.stringify(parsedAst.actionMethods || []);
    const dependencies = JSON.stringify(parsedAst.dependencies || []);
    const exports = JSON.stringify(parsedAst.exports || []);
    const storageCollections = JSON.stringify(parsedAst.storageCollections || []);

    p = put(p, 'handlers', key, {
      id,
      concept,
      sourceFile,
      language,
      ast,
      symbol: `${concept}Handler`,
      actionMethods,
      dependencies,
      exports,
      storageCollections,
      lineCount: parsedAst.lineCount || 0,
      lastModified: new Date().toISOString(),
    });

    return complete(p, 'ok', { handler: id }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const language = input.language as string;

    p = get(p, 'handlers', `handler:${concept}:${language}`, 'entry');
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { handler: entry.id }) as StorageProgram<Result>;
  },

  getByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const sourceFile = input.sourceFile as string;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.sourceFile === sourceFile);
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { handler: entry.id }) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    p = find(p, 'handlers', { concept }, 'all');

    return complete(p, 'ok', { handlers: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  findByLanguage(input: Record<string, unknown>) {
    let p = createProgram();
    const language = input.language as string;
    p = find(p, 'handlers', { language }, 'all');

    return complete(p, 'ok', { handlers: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  getActionMethod(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    const methods = JSON.parse(entry.actionMethods as string || '[]');
    const method = methods.find((m: { name: string }) => m.name === actionName);
    if (!method) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { method: JSON.stringify(method) }) as StorageProgram<Result>;
  },

  implementationGaps(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;

    p = find(p, 'handlers', { concept }, 'handlers');
    if (handlers.length === 0) {
      return complete(p, 'noHandler', {}) as StorageProgram<Result>;
    }

    // TODO: Compare declared actions from ConceptEntity against implemented methods
    // For now, report fully implemented based on handler metadata
    const handler = handlers[0];
    const methods = JSON.parse(handler.actionMethods as string || '[]');

    return complete(p, 'fullyImplemented', { actionCount: methods.length }) as StorageProgram<Result>;
  },

  getDependencies(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return complete(p, 'ok', { imports: '[]', externalPackages: '[]', internalModules: '[]' }) as StorageProgram<Result>;
    }

    const deps = JSON.parse(entry.dependencies as string || '[]');
    const externalPackages = deps.filter((d: { external?: boolean }) => d.external);
    const internalModules = deps.filter((d: { external?: boolean }) => !d.external);

    return complete(p, 'ok', {
      imports: JSON.stringify(deps),
      externalPackages: JSON.stringify(externalPackages),
      internalModules: JSON.stringify(internalModules),
    }) as StorageProgram<Result>;
  },

  getStorageUsage(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return complete(p, 'ok', { collections: '[]' }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { collections: entry.storageCollections as string || '[]' }) as StorageProgram<Result>;
  },

  resolveStackFrame(input: Record<string, unknown>) {
    let p = createProgram();
    const file = input.file as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.sourceFile === file);
    if (!entry) {
      return complete(p, 'notInHandler', {}) as StorageProgram<Result>;
    }

    // TODO: Walk AST to find exact node at line:col
    const astNode = JSON.stringify({
      kind: 'Unknown',
      startLine: line,
      startCol: col,
      endLine: line,
      endCol: col,
      text: '',
      parent: null,
      children: [],
    });

    return complete(p, 'ok', {
      handler: entry.id as string,
      concept: entry.concept as string,
      actionMethod: '',
      astNode,
      sourceSpan: `${file}:${line}:${col}`,
    }) as StorageProgram<Result>;
  },

  resolveToAstNode(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return complete(p, 'outOfRange', { line, maxLine: 0 }) as StorageProgram<Result>;
    }

    const maxLine = entry.lineCount as number || 0;
    if (maxLine > 0 && line > maxLine) {
      return complete(p, 'outOfRange', { line, maxLine }) as StorageProgram<Result>;
    }

    // TODO: Walk AST to find innermost node at line:col
    const node = JSON.stringify({
      kind: 'Unknown',
      startLine: line,
      startCol: col,
      endLine: line,
      endCol: col,
      text: '',
    });

    return complete(p, 'ok', {
      node,
      ancestors: '[]',
      actionMethod: '',
    }) as StorageProgram<Result>;
  },

  resolveStackTrace(input: Record<string, unknown>) {
    let p = createProgram();
    const stackTrace = input.stackTrace as string;

    // Parse stack trace lines to extract file:line:col
    const frameRegex = /at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/g;
    const frames: Array<Record<string, unknown>> = [];
    let match: RegExpExecArray | null;

    p = find(p, 'handlers', 'allHandlers');

    while ((match = frameRegex.exec(stackTrace)) !== null) {
      const file = match[1];
      const line = parseInt(match[2], 10);
      const col = parseInt(match[3], 10);

      const handler = allHandlers.find(h => h.sourceFile === file);

      frames.push({
        file,
        line,
        col,
        handler: handler ? handler.id : null,
        concept: handler ? handler.concept : null,
        actionMethod: null,
        astNode: null,
        symbol: handler ? handler.symbol : file.split('/').pop(),
      });
    }

    return complete(p, 'ok', { frames: JSON.stringify(frames) }) as StorageProgram<Result>;
  },

  traceToVariantReturn(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    // TODO: Parse AST to find all `return { variant: '...' }` statements
    return complete(p, 'ok', { returns: '[]' }) as StorageProgram<Result>;
  },

  traceToStorageCalls(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', 'all');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    // TODO: Parse AST to find all storage.put/get/find/del calls
    return complete(p, 'ok', { calls: '[]' }) as StorageProgram<Result>;
  },

  findByError(input: Record<string, unknown>) {
    let p = createProgram();
    const errorSymbol = input.errorSymbol as string;
    const since = input.since as string;

    // TODO: Cross-reference with ErrorCorrelation entities
    p = find(p, 'handlers', 'all');

    return complete(p, 'ok', { handlers: JSON.stringify([]) }) as StorageProgram<Result>;
  },

  sourceForAction(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', { concept }, 'handlers');
    if (handlers.length === 0) {
      return complete(p, 'noHandler', {}) as StorageProgram<Result>;
    }

    const handler = handlers[0];
    const methods = JSON.parse(handler.actionMethods as string || '[]');
    const method = methods.find((m: { name: string }) => m.name === actionName);
    if (!method) {
      return complete(p, 'actionNotImplemented', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', {
      source: method.body || '',
      file: handler.sourceFile as string,
      startLine: method.startLine || 0,
      endLine: method.endLine || 0,
    }) as StorageProgram<Result>;
  },
};

export const handlerEntityHandler = autoInterpret(_handler);
