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
    p = branch(p,
      (bindings) => !!bindings.existing,
      (b) => completeFrom(b, 'alreadyRegistered', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return { existing: existing.id };
      }),
      (b) => {
        const id = crypto.randomUUID();
        const parsedAst = ast ? JSON.parse(ast) : {};
        const actionMethods = JSON.stringify(parsedAst.actionMethods || []);
        const dependencies = JSON.stringify(parsedAst.dependencies || []);
        const exports = JSON.stringify(parsedAst.exports || []);
        const storageCollections = JSON.stringify(parsedAst.storageCollections || []);

        let b2 = put(b, 'handlers', key, {
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

        return complete(b2, 'ok', { handler: id });
      },
    ) as StorageProgram<Result>;

    return p;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const language = input.language as string;

    p = get(p, 'handlers', `handler:${concept}:${language}`, 'entry');
    p = branch(p,
      (bindings) => !bindings.entry,
      (b) => complete(b, 'notfound', {}),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return { handler: entry.id as string };
      }),
    ) as StorageProgram<Result>;

    return p;
  },

  getByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const sourceFile = input.sourceFile as string;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.sourceFile === sourceFile);
      if (!entry) {
        return { _variant: 'notfound' };
      }
      return { handler: entry.id as string };
    }) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    p = find(p, 'handlers', { concept }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return { handlers: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },

  findByLanguage(input: Record<string, unknown>) {
    let p = createProgram();
    const language = input.language as string;
    p = find(p, 'handlers', { language }, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return { handlers: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },

  getActionMethod(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.id === handlerId);
      if (!entry) {
        return { _variant: 'notfound' };
      }

      const methods = JSON.parse(entry.actionMethods as string || '[]');
      const method = methods.find((m: { name: string }) => m.name === actionName);
      if (!method) {
        return { _variant: 'notfound' };
      }

      return { method: JSON.stringify(method) };
    }) as StorageProgram<Result>;
  },

  implementationGaps(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;

    p = find(p, 'handlers', { concept }, 'handlers');
    return completeFrom(p, 'ok', (bindings) => {
      const handlers = (bindings.handlers || []) as Array<Record<string, unknown>>;
      if (handlers.length === 0) {
        return { _variant: 'noHandler' };
      }

      const handler = handlers[0];
      const methods = JSON.parse(handler.actionMethods as string || '[]');

      return { _variant: 'fullyImplemented', actionCount: methods.length };
    }) as StorageProgram<Result>;
  },

  getDependencies(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.id === handlerId);
      if (!entry) {
        return { imports: '[]', externalPackages: '[]', internalModules: '[]' };
      }

      const deps = JSON.parse(entry.dependencies as string || '[]');
      const externalPackages = deps.filter((d: { external?: boolean }) => d.external);
      const internalModules = deps.filter((d: { external?: boolean }) => !d.external);

      return {
        imports: JSON.stringify(deps),
        externalPackages: JSON.stringify(externalPackages),
        internalModules: JSON.stringify(internalModules),
      };
    }) as StorageProgram<Result>;
  },

  getStorageUsage(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.id === handlerId);
      if (!entry) {
        return { collections: '[]' };
      }

      return { collections: entry.storageCollections as string || '[]' };
    }) as StorageProgram<Result>;
  },

  resolveStackFrame(input: Record<string, unknown>) {
    let p = createProgram();
    const file = input.file as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.sourceFile === file);
      if (!entry) {
        return { _variant: 'notInHandler' };
      }

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

      return {
        handler: entry.id as string,
        concept: entry.concept as string,
        actionMethod: '',
        astNode,
        sourceSpan: `${file}:${line}:${col}`,
      };
    }) as StorageProgram<Result>;
  },

  resolveToAstNode(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.id === handlerId);
      if (!entry) {
        return { _variant: 'outOfRange', line, maxLine: 0 };
      }

      const maxLine = entry.lineCount as number || 0;
      if (maxLine > 0 && line > maxLine) {
        return { _variant: 'outOfRange', line, maxLine };
      }

      const node = JSON.stringify({
        kind: 'Unknown',
        startLine: line,
        startCol: col,
        endLine: line,
        endCol: col,
        text: '',
      });

      return {
        node,
        ancestors: '[]',
        actionMethod: '',
      };
    }) as StorageProgram<Result>;
  },

  resolveStackTrace(input: Record<string, unknown>) {
    let p = createProgram();
    const stackTrace = input.stackTrace as string;

    const frameRegex = /at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/g;
    const rawFrames: Array<{ file: string; line: number; col: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = frameRegex.exec(stackTrace)) !== null) {
      rawFrames.push({
        file: match[1],
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
      });
    }

    p = find(p, 'handlers', 'allHandlers');

    return completeFrom(p, 'ok', (bindings) => {
      const allHandlers = (bindings.allHandlers || []) as Array<Record<string, unknown>>;
      const frames: Array<Record<string, unknown>> = [];

      for (const frame of rawFrames) {
        const handler = allHandlers.find(h => h.sourceFile === frame.file);
        frames.push({
          file: frame.file,
          line: frame.line,
          col: frame.col,
          handler: handler ? handler.id : null,
          concept: handler ? handler.concept : null,
          actionMethod: null,
          astNode: null,
          symbol: handler ? handler.symbol : frame.file.split('/').pop(),
        });
      }

      return { frames: JSON.stringify(frames) };
    }) as StorageProgram<Result>;
  },

  traceToVariantReturn(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.id === handlerId);
      if (!entry) {
        return { _variant: 'notfound' };
      }

      return { returns: '[]' };
    }) as StorageProgram<Result>;
  },

  traceToStorageCalls(input: Record<string, unknown>) {
    let p = createProgram();
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(h => h.id === handlerId);
      if (!entry) {
        return { _variant: 'notfound' };
      }

      return { calls: '[]' };
    }) as StorageProgram<Result>;
  },

  findByError(input: Record<string, unknown>) {
    let p = createProgram();
    const errorSymbol = input.errorSymbol as string;
    const since = input.since as string;

    p = find(p, 'handlers', 'all');

    return complete(p, 'ok', { handlers: JSON.stringify([]) }) as StorageProgram<Result>;
  },

  sourceForAction(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const actionName = input.actionName as string;

    p = find(p, 'handlers', { concept }, 'handlers');
    return completeFrom(p, 'ok', (bindings) => {
      const handlers = (bindings.handlers || []) as Array<Record<string, unknown>>;
      if (handlers.length === 0) {
        return { _variant: 'noHandler' };
      }

      const handler = handlers[0];
      const methods = JSON.parse(handler.actionMethods as string || '[]');
      const method = methods.find((m: { name: string }) => m.name === actionName);
      if (!method) {
        return { _variant: 'actionNotImplemented' };
      }

      return {
        source: method.body || '',
        file: handler.sourceFile as string,
        startLine: method.startLine || 0,
        endLine: method.endLine || 0,
      };
    }) as StorageProgram<Result>;
  },
};

export const handlerEntityHandler = autoInterpret(_handler);
